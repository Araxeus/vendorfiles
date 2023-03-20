import path from 'node:path';
import fs from 'node:fs/promises';
import { writePackage } from 'write-pkg';
import github from './github.js';
import { ownerAndNameFromRepoUrl, writeLockfile, checkIfNeedsUpdate, error, info, success, validateVendorDependency, getDependencyFolder, getFilesFromLockfile, readLockfile, flatFiles, } from './utils.js';
import { existsSync } from 'node:fs';
export async function sync({ config, dependencies, pkgPath, pkgJson }, { shouldUpdate = false, force = false, } = {}) {
    for (const [name, dependency] of Object.entries(dependencies)) {
        validateVendorDependency(name, dependency);
        dependency.name = name;
        await install({
            dependency,
            pkgPath,
            pkgJson,
            config,
            shouldUpdate,
            force,
        });
    }
}
export async function uninstall(name, { dependencies, config, pkgPath, pkgJson }) {
    const dep = dependencies[name];
    if (!dep) {
        error(`Dependency ${name} not found in package.json`);
    }
    const depDirectory = dep
        ? getDependencyFolder({
            dependency: dep,
            config,
            pkgPath,
            backupName: name,
        })
        : path.join(path.dirname(pkgPath), config.vendorFolder, name);
    const lockfilePath = path.join(depDirectory, 'vendor-lock.json');
    let lockfile;
    try {
        lockfile = await readLockfile(lockfilePath);
        for (const file of lockfile[name].files) {
            try {
                await fs.rm(path.join(depDirectory, file), { force: true });
            }
            catch { }
        }
    }
    catch { }
    const depFiles = flatFiles(dep.files);
    for (const file of depFiles) {
        try {
            await fs.rm(path.join(depDirectory, file), { force: true });
        }
        catch { }
    }
    // check if name is the only key in the lockfile
    // if so, delete the lockfile, otherwise, remove the dependency from the lockfile
    if (lockfile?.[name] && Object.keys(lockfile).length === 1) {
        // delete the lockfile
        await fs.rm(lockfilePath, { force: true });
    }
    else if (lockfile?.[name]) {
        // @ts-expect-error
        lockfile[name] = undefined;
        await fs.writeFile(lockfilePath, JSON.stringify(lockfile, null, 2));
    }
    if ((await fs.readdir(depDirectory)).length === 0) {
        await fs.rm(depDirectory, { recursive: true, force: true });
    }
    // @ts-expect-error
    pkgJson.vendorDependencies[name] = undefined;
    // @ts-expect-error
    await writePackage(pkgPath, pkgJson);
    success(`Uninstalled ${name}`);
}
export async function install({ dependency, pkgPath, pkgJson, config, shouldUpdate, force, newVersion, }) {
    const repo = ownerAndNameFromRepoUrl(dependency.repository);
    dependency.name ||= repo.name;
    const depDirectory = getDependencyFolder({
        dependency,
        config,
        pkgPath,
        backupName: dependency.name,
    });
    const lockfilePath = path.join(depDirectory, 'vendor-lock.json');
    // check if the dependency needs to be updated
    if (!(shouldUpdate || newVersion)) {
        newVersion = dependency.version;
    }
    if (!newVersion) {
        const latestRelease = await github.getLatestRelease(repo);
        newVersion = latestRelease.tag_name;
    }
    const needUpdate = force ||
        (await checkIfNeedsUpdate({
            name: dependency.name,
            lockfilePath,
            newVersion,
        }));
    if (!needUpdate) {
        info(`${dependency.name} is up to date`);
        return;
    }
    // if the dependency folder does not exist, create it
    await fs.mkdir(depDirectory, { recursive: true });
    // remove old files from the dependency folder
    const filesFromLockfile = await getFilesFromLockfile(lockfilePath, dependency.name);
    for (const file of filesFromLockfile) {
        if (existsSync(path.join(depDirectory, file))) {
            await fs.rm(path.join(depDirectory, file));
        }
    }
    const allFiles = dependency.files.flatMap((file) => 
    // @ts-expect-error
    typeof file === 'object' ? Object.entries(file) : file);
    await Promise.all(allFiles.map(async (file) => {
        let input;
        let output;
        if (Array.isArray(file)) {
            input = file[0];
            output = file[1];
        }
        else if (typeof file === 'string') {
            input = file;
            output = file;
        }
        else {
            error(`File ${file} is not a string or an array`);
        }
        const downloadedFile = await github
            .getFile({
            repo,
            path: input,
            ref: newVersion,
        })
            .catch((err) => {
            if (err.status === 404) {
                error(`File "${file}" was not found in ${dependency.repository}`);
            }
        });
        if (!(typeof downloadedFile === 'string')) {
            error(`File ${file} from ${dependency.repository} is not a string`);
        }
        const savePath = path.join(depDirectory, path.basename(output));
        await fs.writeFile(savePath, downloadedFile, 'utf-8').then(() => {
            info(`Saved ${savePath}`);
        });
    }));
    await writeLockfile(dependency.name, {
        version: newVersion || 'latest',
        repository: dependency.repository,
        files: flatFiles(dependency.files),
    }, lockfilePath);
    const old_version = dependency.version;
    // @ts-expect-error
    if (shouldUpdate || !pkgJson.vendorDependencies[dependency.name]?.version) {
        // @ts-expect-error
        pkgJson.vendorDependencies[dependency.name] = {
            name: dependency.name,
            version: newVersion,
            repository: dependency.repository,
            files: dependency.files,
            vendorFolder: dependency.vendorFolder,
        };
        // @ts-expect-error
        await writePackage(pkgPath, pkgJson);
    }
    if (shouldUpdate) {
        success(`Updated ${dependency.name} from ${old_version} to ${newVersion}`);
    }
    else {
        success(`Installed ${dependency.name} ${newVersion}`);
    }
}
