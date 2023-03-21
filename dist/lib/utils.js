import { readFile, writeFile, realpath, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import parseJson from 'parse-json';
import { readPackageUp } from 'read-pkg-up';
import { getConfig } from './config.js';
export function assert(condition, message) {
    if (!condition) {
        error(message);
    }
}
export function error(message) {
    console.error(`\x1b[31mERROR: ${message}\x1b[0m`);
    process.exit(1);
}
export function warning(message) {
    console.warn(`\x1b[33mWARNING: ${message}\x1b[0m`);
}
export function success(message) {
    console.log(`\x1b[32m${message}\x1b[0m`);
}
export function info(message) {
    console.log(`\x1b[36m${message}\x1b[0m`);
}
export function isGitHubUrl(url) {
    return /^https?:(?:)\/\/(?:www\.)?github\.com\/[^/]+\/[^/]+$/.test(url);
}
export async function writeLockfile(name, data, filepath) {
    let lockfile;
    data.files = consolidateObjectsInFilesArray(data.files).map((file) => typeof file === 'string' ? path.basename(file) : file);
    try {
        lockfile = await readLockfile(filepath);
        const previousFiles = Object.entries(lockfile).flatMap(([n, { files }]) => n === name
            ? []
            : {
                depName: n,
                files: flatFiles(files),
            });
        const newFiles = flatFiles(data.files);
        newFiles?.forEach((file) => {
            previousFiles.forEach(({ depName, files }) => {
                if (files.includes(file)) {
                    warning(`Duplicate file in lockfile! "${file}" is being added to ${name} but already exists in ${depName}`);
                }
            });
        });
        lockfile[name] = data;
    }
    catch {
        lockfile = { [name]: data };
    }
    await writeFile(filepath, JSON.stringify(lockfile, null, 2));
}
export async function checkIfNeedsUpdate({ lockfilePath, name, newVersion, }) {
    try {
        const lockfile = await readLockfile(lockfilePath);
        if (lockfile[name].version !== newVersion) {
            return true;
        }
        const allFilesFromConfig = await getAllFilesFromConfig();
        const thisLockFiles = lockfile[name].files;
        for (const [file, n] of Object.entries(allFilesFromConfig)) {
            if (n === name && !existsSync(file)) {
                return true;
            }
        }
        const { dependencies, config, pkgPath } = await getConfig();
        const thisFiles = dependencies[name].files;
        const bareFilePath = thisFiles.map((file) => typeof file === 'string' ? path.basename(file) : file);
        const depPath = getDependencyFolder({
            dependency: dependencies[name],
            config,
            pkgPath,
            backupName: name,
        });
        for (const file of thisLockFiles) {
            if (typeof file === 'string') {
                if (!(bareFilePath.includes(file) &&
                    existsSync(path.join(depPath, file)))) {
                    return true;
                }
            }
            else {
                for (const [input, output] of Object.entries(file)) {
                    if (!thisFiles.some((f) => typeof f === 'object' && f[input] === output) &&
                        existsSync(path.join(depPath, output))) {
                        return true;
                    }
                }
            }
        }
    }
    catch {
        return true;
    }
    return false;
}
export async function deleteFileAndEmptyFolders(cwd, relativeFilepath) {
    cwd = await realpath(cwd);
    const filepath = path.join(cwd, relativeFilepath);
    // Delete the file
    await rm(filepath);
    // Traverse up the directory tree
    let dir = path.dirname(filepath);
    while (path.relative(cwd, dir) !== '.') {
        // Check if the directory is empty
        if ((await readdir(dir)).length === 0) {
            await rm(dir, { recursive: true, force: true });
        }
        else {
            // Stop traversing if the directory is not empty
            break;
        }
        // Move up to the parent directory
        dir = path.resolve(dir, '..');
    }
}
export function flatFiles(files) {
    return files.flatMap((file) => typeof file === 'string' ? path.basename(file) : Object.values(file));
}
export async function getAllFilesFromConfig() {
    const { dependencies, config, pkgPath } = await getConfig();
    const files = {};
    for (const [name, dependency] of Object.entries(dependencies)) {
        const filesFromConfig = flatFiles(dependency.files);
        filesFromConfig.forEach((file) => {
            files[path.join(getDependencyFolder({
                dependency,
                config,
                pkgPath,
                backupName: name,
            }), file)] = name;
        });
    }
    return files;
}
export async function readLockfile(filepath) {
    return parseJson(await readFile(filepath, 'utf-8'));
}
// export async function getAllFilesFromLockfile(
//     filepath: string,
// ): Promise<string[]> {
//     try {
//         const lockfile = await readLockfile(filepath);
//         return getAllFilesFromActualLockfile(lockfile);
//     } catch {
//         return [];
//     }
// }
// function getAllFilesFromActualLockfile(lockfile: Lockfile): string[] {
//     return Object.entries(lockfile).flatMap(([_, { files }]) =>
//         files.map((file) => path.basename(file)),
//     );
// }
export async function getFilesFromLockfile(filepath, name) {
    try {
        const lockfile = await readLockfile(filepath);
        return flatFiles(lockfile[name].files);
    }
    catch {
        return [];
    }
}
export function ownerAndNameFromRepoUrl(url) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
        error(`Invalid GitHub URL: ${url}`);
    }
    return {
        owner: match[1],
        name: match[2],
    };
}
export function validateVendorDependency(name, dependency) {
    assert(typeof dependency.repository === 'string' &&
        isGitHubUrl(dependency.repository), `package.json key 'vendorDependencies.${name}.repository' is not a valid github url`);
    assert(Array.isArray(dependency.files) && dependency.files.length > 0, `package.json key 'vendorDependencies.${name}.files' is a valid array`);
}
export function getDependencyFolder({ dependency, config, pkgPath, backupName, }) {
    return path.join(path.dirname(pkgPath), dependency.vendorFolder?.replace('{vendorFolder}', config.vendorFolder) || config.vendorFolder, dependency.vendorFolder ? '' : dependency.name || backupName);
}
export async function getPackageJson(folderPath) {
    folderPath ||= path.dirname(await realpath(process.argv[1]));
    const pkg = await readPackageUp({
        cwd: folderPath,
        normalize: false,
    });
    if (!pkg) {
        error('Could not find package.json');
    }
    return pkg;
}
export function consolidateObjectsInFilesArray(arr) {
    const obj = {};
    const newArr = arr.filter((item) => {
        if (typeof item === 'object' && !Array.isArray(item)) {
            Object.assign(obj, item);
            return false;
        }
        return true;
    });
    if (Object.keys(obj).length !== 0) {
        newArr.push(obj);
    }
    return newArr;
}
export function trimStartMatches(str, match) {
    if (!str)
        return '';
    while (str.startsWith(match)) {
        str = str.slice(match.length);
    }
    return str;
}
export function trimEndMatches(str, match) {
    if (!str)
        return '';
    while (str.endsWith(match)) {
        str = str.slice(0, -match.length);
    }
    return str;
}
export function trimMatches(str, match) {
    return trimStartMatches(trimEndMatches(str, match), match);
}
export function getDuplicates(arr) {
    return arr.filter((item, index) => arr.indexOf(item) !== index);
}
