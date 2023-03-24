import type {
    FilesArray,
    Lockfile,
    Repository,
    VendorConfig,
    VendorDependency,
    VendorLock,
    VendorLockFiles,
} from './types.js';

import {
    readFile,
    writeFile,
    realpath,
    rm,
    readdir,
    mkdir,
} from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';
import { deepStrictEqual } from 'node:assert';
import type { ReadableStream } from 'stream/web';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

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

export async function readableToFile(
    file: ReadableStream,
    savePath: string,
    log = true,
) {
    await mkdir(path.dirname(savePath), { recursive: true });

    const body = Readable.fromWeb(file);
    const download_write_stream = createWriteStream(savePath);
    await finished(body.pipe(download_write_stream))
        .then(() => {
            if (log) info(`Saved ${savePath}`);
        })
        .catch((err) => {
            if (log) error(`Could not save ${savePath}:\n${err}`);
        });
}

export function replaceVersion(path: string, version: string) {
    return path.replace('{version}', trimStartMatches(version, 'v'));
}

export async function writeLockfile(
    name: string,
    data: {
        version: string;
        repository: string;
        files: FilesArray;
    },
    filepath: string,
): Promise<void> {
    let lockfile: Lockfile;
    const vendorLock: VendorLock = {
        version: data.version,
        repository: data.repository,
        files: pkgFilesToVendorlockFiles(data.files, data.version),
    };

    try {
        lockfile = await readLockfile(filepath);

        // const previousFiles = lockfile[name].files;

        // const allPreviousFiles = Object.values(lockfile).map(

        // // now search the lockfile for duplicates (on field that !== name)
        // for

        // newFiles?.forEach((file) => {
        //     previousFiles.forEach(({ depName, files }) => {
        //         if (files.includes(file)) {
        //             warning(
        //                 `Duplicate file in lockfile! "${file}" is being added to ${name} but already exists in ${depName}`,
        //             );
        //         }
        //     });
        // });

        lockfile[name] = vendorLock;
    } catch {
        lockfile = { [name]: vendorLock };
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

        for (const [file, n] of Object.entries(allFilesFromConfig)) {
            if (n === name && !existsSync(file)) {
                return true;
            }
        }

        const thisLockFiles = lockfile[name].files;

        const {
            dependencies,
            // config, pkgPath
        } = await getConfig();
        const thisFiles = dependencies[name].files;
        // const bareFilePath = thisFiles.map((file) =>
        //     typeof file === 'string' ? path.basename(file) : file,
        // );

        // const depPath = getDependencyFolder({
        //     dependency: dependencies[name],
        //     config,
        //     pkgPath,
        //     backupName: name,
        // });

        const allPkg = pkgFilesToVendorlockFiles(
            thisFiles,
            dependencies[name].version || '',
        );

        let deepEq = false;
        try {
            deepStrictEqual(allPkg, thisLockFiles);
            deepEq = true;
        } catch {
            deepEq = false;
            error('lockfile is not equal to config');
        }

        // console.log({
        //     allPkg,
        //     thisLockFiles,
        //     deepEq,
        // });
    } catch {
        return true;
    }

    return false;
}

export async function deleteFileAndEmptyFolders(
    cwd: string,
    relativeFilepath: string,
) {
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
        } else {
            // Stop traversing if the directory is not empty
            break;
        }
        // Move up to the parent directory
        dir = path.resolve(dir, '..');
    }
}

/**
    transform {
        "./dist/file1": "file1",
        "./dist/file2": "file2",
        "archive.zip": {
            "zip1src": "zip1",
            "zip2src": "zip2",
        }
        ./dist/file3: "file3",
    }

    to [ "file1", "file2", "zip1", "zip2", "file3" ]    
**/

export function flatFiles(files: VendorLockFiles) {
    return Object.values(files).flatMap((file) =>
        typeof file === 'string' ? file : Object.values(file),
    );
}

export async function getAllFilesFromConfig() {
    const { dependencies, config, pkgPath } = await getConfig();
    const files: Record<string, string> = {};

    for (const [name, dependency] of Object.entries(dependencies)) {
        const filesFromConfig = flatFiles(
            pkgFilesToVendorlockFiles(
                dependency.files,
                dependency.version || '',
            ),
        );

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
        `package.json key 'vendorDependencies.${name}.files' is not a valid array`,
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

export async function getPackageJson(folderPath?: string): Promise<ReadResult> {
    folderPath ||= await realpath(
        process.env.INIT_CWD || process.env.PWD || process.cwd(),
    );
    const pkg = await readPackageUp({
        cwd: folderPath,
        normalize: false,
    });

    if (!pkg) {
        error('Could not find package.json');
    }

    return pkg;
}

// rome-ignore lint/suspicious/noExplicitAny: circular types are hard
export function replaceVersionInObject(obj: any, version: string) {
    if (typeof obj === 'string') {
        return replaceVersion(obj, version);
    }
    if (typeof obj === 'object') {
        Object.keys(obj).forEach((key) => {
            obj[key] = replaceVersionInObject(obj[key], version);
        });
    }
    return obj;
}

export function pkgFilesToVendorlockFiles(
    arr: FilesArray,
    version: string,
): VendorLockFiles {
    const obj = {};
    arr.forEach((item) => {
        if (typeof item !== 'string') {
            Object.assign(obj, replaceVersionInObject(item, version));
        } else {
            Object.assign(obj, {
                [item]: replaceVersionInObject(path.basename(item), version),
            });
        }
        return true;
    });

    return obj;
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

export function random() {
    return Math.random().toString(36).substring(7);
}
