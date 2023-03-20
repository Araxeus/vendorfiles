import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
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
    try {
        lockfile = await readLockfile(filepath);
        const previousFiles = Object.entries(lockfile).flatMap(([n, { files }]) => (n === name ? [] : { depName: n, files }));
        data.files?.forEach((file) => {
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
        const thisFiles = flatFiles(dependencies[name].files);
        const depPath = getDependencyFolder({
            dependency: dependencies[name],
            config,
            pkgPath,
            backupName: name,
        });
        for (const file of thisLockFiles) {
            if (!(thisFiles.includes(file) &&
                existsSync(path.join(depPath, file)))) {
                return true;
            }
        }
    }
    catch {
        return true;
    }
    return false;
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
        return lockfile[name].files;
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
export async function getPackageJson(folderPath = path.dirname(realpathSync(process.argv[1]))) {
    const pkg = await readPackageUp({
        cwd: folderPath,
        normalize: false,
    });
    if (!pkg) {
        error('Could not find package.json');
    }
    return pkg;
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
