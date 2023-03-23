import path from 'node:path';
import fs from 'node:fs/promises';
import { writePackage } from 'write-pkg';
import github from './github.js';
import { ownerAndNameFromRepoUrl, writeLockfile, checkIfNeedsUpdate, error, info, success, validateVendorDependency, getDependencyFolder, getFilesFromLockfile, readLockfile, flatFiles, deleteFileAndEmptyFolders, saveFile, pkgFilesToVendorlockFiles, replaceVersion, } from './utils.js';
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
        for (const file of flatFiles(lockfile[name].files)) {
            try {
                await deleteFileAndEmptyFolders(depDirectory, file);
            }
            catch { }
        }
    }
    catch { }
    for (const file of flatFiles(pkgFilesToVendorlockFiles(dep.files, dep.version || ''))) {
        try {
            await deleteFileAndEmptyFolders(depDirectory, file);
        }
        catch { }
    }
    // check if name is the only key in the lockfile
    if (lockfile?.[name] && Object.keys(lockfile).length === 1) {
        // if so, delete the lockfile
        await fs.rm(lockfilePath, { force: true });
        // if the dependency folder is empty, delete it
        if ((await fs.readdir(depDirectory)).length === 0) {
            await fs.rm(depDirectory, { recursive: true, force: true });
        }
    }
    else if (lockfile?.[name]) {
        // if not, remove the dependency from the lockfile
        // @ts-expect-error Type 'undefined' is not assignable to type 'VendorLock'
        lockfile[name] = undefined;
        await fs.writeFile(lockfilePath, JSON.stringify(lockfile, null, 2));
    }
    // @ts-expect-error Property 'vendorDependencies' does not exist on type 'PackageJson'
    pkgJson.vendorDependencies[name] = undefined;
    // @ts-expect-error 'PackageJson' is not assignable to parameter of type 'JsonObject'
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
    if (!newVersion) {
        error(`Could not find a version for ${dependency.name}`);
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
            await deleteFileAndEmptyFolders(depDirectory, file);
        }
    }
    const allFiles = dependency.files.flatMap((file) => 
    // @ts-expect-error Type 'string' is not assignable to type '[string, string]'
    typeof file === 'object' ? Object.entries(file) : file);
    const ref = newVersion; // TODO DELETE
    const releaseFiles = [];
    await Promise.all(allFiles.map(async (file) => {
        let input;
        // type of parameter two
        let output;
        if (Array.isArray(file)) {
            input = file[0];
            output = file[1];
        }
        else if (typeof file === 'string') {
            input = file;
            output = path.basename(file);
        }
        else {
            error(`File ${file} is not a string or an array`);
        }
        if (input.startsWith('{release}/')) {
            releaseFiles.push({ input, output });
            return;
        }
        else if (typeof output !== 'string') {
            error(`File ${JSON.stringify(file)}\nis not a string, and {release} is not used}`);
        }
        const downloadedFile = await github
            .getFile({
            repo,
            path: input,
            ref,
        })
            .catch((err) => {
            if (err.status === 404) {
                error(`File "${file}" was not found in ${dependency.repository}`);
            }
            else {
                error(`Could not download file "${file}" from ${dependency.repository}: ${err.message}`);
            }
        });
        if (typeof downloadedFile !== 'string') {
            error(`File ${file} from ${dependency.repository} is not a string`);
        }
        const savePath = path.join(depDirectory, output);
        await saveFile(downloadedFile, savePath);
    }));
    await Promise.all(
    // file.output is either a string that or an object which would mean that we want to extract the files from the downloaded archive
    releaseFiles.map(async (file) => {
        const input = replaceVersion(file.input, ref).replace('{release}/', '');
        const output = file.output;
        const savePath = path.join(depDirectory, typeof output === 'string'
            ? replaceVersion(output, ref)
            : Math.random().toString(36).substring(7));
        const releaseFile = await github.downloadReleaseFile({
            repo,
            path: input,
            version: ref,
            savePath,
        });
        //console.log(releaseFile); // DELETE
        // if releaseFile is a `Request` object, it means that it is a stream and we should pipe it to a file
        await saveFile(releaseFile, savePath, true);
        if (typeof output === 'object') {
            try {
                // rome-ignore lint/suspicious/noExplicitAny: <explanation>
                const extractReleaseFiles = async (..._a) => error('Not implemented'); // TODO
                await extractReleaseFiles({
                    filePath: savePath,
                    files: output,
                    depDirectory,
                });
            }
            finally {
                info(`Extracted ${savePath}`);
                await fs.rm(savePath, { force: true });
            }
        }
        else {
            info(`Downloaded ${savePath}`);
        }
    }));
    await writeLockfile(dependency.name, {
        version: newVersion,
        repository: dependency.repository,
        files: dependency.files,
    }, lockfilePath);
    const old_version = dependency.version;
    // @ts-expect-error Property 'vendorDependencies' does not exist on type 'PackageJson'
    if (shouldUpdate || !pkgJson.vendorDependencies[dependency.name]?.version) {
        // @ts-expect-error Property 'vendorDependencies' does not exist on type 'PackageJson'
        pkgJson.vendorDependencies[dependency.name] = {
            name: dependency.name,
            version: newVersion,
            repository: dependency.repository,
            files: dependency.files,
            vendorFolder: dependency.vendorFolder,
        };
        // @ts-expect-error 'PackageJson' is not assignable to parameter of type 'JsonObject'
        await writePackage(pkgPath, pkgJson);
    }
    if (shouldUpdate) {
        success(`Updated ${dependency.name} from ${old_version} to ${newVersion}`);
    }
    else {
        success(`Installed ${dependency.name} ${newVersion}`);
    }
}
