import {
    FilesArray,
    Lockfile,
    Repository,
    VendorConfig,
    VendorDependency,
    VendorLock,
} from './types.js';

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

import parseJson from 'parse-json';

import { type ReadResult, readPackageUp } from 'read-pkg-up';
import { getConfig } from './config.js';

export function assert(condition: boolean, message: string): asserts condition {
    if (!condition) {
        error(message);
    }
}

export function error(message: string): never {
    console.error(`\x1b[31mERROR: ${message}\x1b[0m`);
    process.exit(1);
}

export function warning(message: string): void {
    console.warn(`\x1b[33mWARNING: ${message}\x1b[0m`);
}

export function success(message: string): void {
    console.log(`\x1b[32m${message}\x1b[0m`);
}

export function info(message: string): void {
    console.log(`\x1b[36m${message}\x1b[0m`);
}

export function isGitHubUrl(url: string): boolean {
    return /^https?:(?:)\/\/(?:www\.)?github\.com\/[^/]+\/[^/]+$/.test(url);
}

export async function writeLockfile(
    name: string,
    data: VendorLock,
    filepath: string,
): Promise<void> {
    let lockfile: Lockfile;

    data.files = consolidateObjectsInFilesArray(data.files).map((file) =>
        typeof file === 'string' ? path.basename(file) : file,
    );

    try {
        lockfile = await readLockfile(filepath);

        const previousFiles = Object.entries(lockfile).flatMap(
            ([n, { files }]) =>
                n === name
                    ? []
                    : {
                          depName: n,
                          files: flatFiles(files),
                      },
        );

        const newFiles = flatFiles(data.files);

        newFiles?.forEach((file) => {
            previousFiles.forEach(({ depName, files }) => {
                if (files.includes(file)) {
                    warning(
                        `Duplicate file in lockfile! "${file}" is being added to ${name} but already exists in ${depName}`,
                    );
                }
            });
        });

        lockfile[name] = data;
    } catch {
        lockfile = { [name]: data };
    }
    await writeFile(filepath, JSON.stringify(lockfile, null, 2));
}

export async function checkIfNeedsUpdate({
    lockfilePath,
    name,
    newVersion,
}: {
    lockfilePath: string;
    name: string;
    newVersion: string;
}) {
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
        const bareFilePath = thisFiles.map((file) =>
            typeof file === 'string' ? path.basename(file) : file,
        );

        const depPath = getDependencyFolder({
            dependency: dependencies[name],
            config,
            pkgPath,
            backupName: name,
        });

        for (const file of thisLockFiles) {
            if (typeof file === 'string') {
                if (
                    !(
                        bareFilePath.includes(file) &&
                        existsSync(path.join(depPath, file))
                    )
                ) {
                    return true;
                }
            } else {
                for (const [input, output] of Object.entries(file)) {
                    if (!thisFiles.some(
                      (f) => typeof f === 'object' && f[input] === output,
                  ) && existsSync(path.join(depPath, output),
                    )) {
                        return true;
                    }
                }
            }
        }
    } catch {
        return true;
    }

    return false;
}

export function flatFiles(files: FilesArray) {
    return files.flatMap((file) =>
        typeof file === 'string' ? path.basename(file) : Object.values(file),
    );
}

export async function getAllFilesFromConfig() {
    const { dependencies, config, pkgPath } = await getConfig();
    const files: Record<string, string> = {};

    for (const [name, dependency] of Object.entries(dependencies)) {
        const filesFromConfig = flatFiles(dependency.files);

        filesFromConfig.forEach((file) => {
            files[
                path.join(
                    getDependencyFolder({
                        dependency,
                        config,
                        pkgPath,
                        backupName: name,
                    }),
                    file,
                )
            ] = name;
        });
    }

    return files;
}

export async function readLockfile(filepath: string): Promise<Lockfile> {
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

export async function getFilesFromLockfile(
    filepath: string,
    name: string,
): Promise<string[]> {
    try {
        const lockfile = await readLockfile(filepath);
        return flatFiles(lockfile[name].files);
    } catch {
        return [];
    }
}

export function ownerAndNameFromRepoUrl(url: string): Repository {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
        error(`Invalid GitHub URL: ${url}`);
    }
    return {
        owner: match[1],
        name: match[2],
    };
}

export function validateVendorDependency(
    name: string,
    dependency: VendorDependency,
): asserts dependency is VendorDependency {
    assert(
        typeof dependency.repository === 'string' &&
            isGitHubUrl(dependency.repository),
        `package.json key 'vendorDependencies.${name}.repository' is not a valid github url`,
    );
    assert(
        Array.isArray(dependency.files) && dependency.files.length > 0,
        `package.json key 'vendorDependencies.${name}.files' is a valid array`,
    );
}

export function getDependencyFolder({
    dependency,
    config,
    pkgPath,
    backupName,
}: {
    dependency: VendorDependency;
    config: VendorConfig;
    pkgPath: string;
    backupName: string;
}): string {
    return path.join(
        path.dirname(pkgPath),
        dependency.vendorFolder?.replace(
            '{vendorFolder}',
            config.vendorFolder,
        ) || config.vendorFolder,
        dependency.vendorFolder ? '' : dependency.name || backupName,
    );
}

export async function getPackageJson(
    folderPath = path.dirname(realpathSync(process.argv[1])),
): Promise<ReadResult> {
    const pkg = await readPackageUp({
        cwd: folderPath,
        normalize: false,
    });

    if (!pkg) {
        error('Could not find package.json');
    }

    return pkg;
}

export function consolidateObjectsInFilesArray(arr: FilesArray) {
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

export function trimStartMatches(
    str: string | undefined,
    match: string,
): string {
    if (!str) return '';
    while (str.startsWith(match)) {
        str = str.slice(match.length);
    }
    return str;
}

export function trimEndMatches(str: string | undefined, match: string): string {
    if (!str) return '';
    while (str.endsWith(match)) {
        str = str.slice(0, -match.length);
    }
    return str;
}

export function trimMatches(str: string | undefined, match: string): string {
    return trimStartMatches(trimEndMatches(str, match), match);
}

export function getDuplicates<T>(arr: T[]): T[] {
    return arr.filter((item, index) => arr.indexOf(item) !== index);
}
