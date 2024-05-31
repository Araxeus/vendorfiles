import type { PackageJson } from 'type-fest';
import type {
    FilesArray,
    Lockfile,
    Repository,
    VendorConfig,
    VendorDependency,
    VendorLock,
    VendorLockFiles,
} from './types.js';

import { deepStrictEqual } from 'node:assert';
import { createWriteStream, existsSync } from 'node:fs';
import {
    mkdir,
    readFile,
    readdir,
    realpath,
    rm,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { finished } from 'node:stream/promises';

import parseJson from 'parse-json';

import { getConfig, getRunOptions } from './config.js';
import github from './github.js';

export function assert(condition: boolean, message: string): asserts condition {
    if (!condition) {
        error(message);
    }
}

export function green(message: string): string {
    return `\x1b[32m${message}\x1b[0m`;
}

export function red(message: string): string {
    return `\x1b[31m${message}\x1b[0m`;
}

export function yellow(message: string): string {
    return `\x1b[33m${message}\x1b[0m`;
}

export function cyan(message: string): string {
    return `\x1b[36m${message}\x1b[0m`;
}

export function error(message: string): never {
    console.error(red(`ERROR: ${message}`));
    process.exit(1);
}

export function warning(message: string): void {
    if (getRunOptions().prMode) return;
    console.warn(yellow(`WARNING: ${message}`));
}

export function success(message: string): void {
    if (getRunOptions().prMode) return;
    console.log(green(`SUCCESS: ${message}`));
}

export function info(message: string): void {
    if (getRunOptions().prMode) return;
    console.log(cyan(`INFO: ${message}`));
}

export function isGitHubUrl(url: string): boolean {
    return /^https?:(?:)\/\/(?:www\.)?github\.com\/[^/]+\/[^/]+$/.test(url);
}

export async function readableToFile(
    body: NodeJS.ReadableStream,
    savePath: string,
    log = true,
) {
    await mkdir(path.dirname(savePath), { recursive: true });

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
        repository: string;
        version: string;
        files: FilesArray;
    },
    filepath: string,
): Promise<void> {
    let lockfile: Lockfile;
    const vendorLock: VendorLock = {
        repository: data.repository,
        version: data.version,
        files: configFilesToVendorlockFiles(data.files, data.version),
    };

    try {
        lockfile = await readLockfile(filepath);

        lockfile[name] = vendorLock;
    } catch {
        lockfile = { [name]: vendorLock };
    }
    await writeFile(filepath, JSON.stringify(lockfile, null, 2));
}

export async function getNewVersion(
    dependency: VendorDependency,
    repo: Repository,
    showOutdatedOnly?: boolean,
): Promise<string> {
    let newVersion: string;

    if (dependency.hashVersionFile) {
        let hashVersionFile = dependency.hashVersionFile;
        if (hashVersionFile === true) {
            if (typeof dependency.files[0] === 'string') {
                hashVersionFile = dependency.files[0];
            } else if (typeof dependency.files[0] === 'object') {
                hashVersionFile = Object.keys(dependency.files[0])[0];
            } else {
                error(
                    `files[0] is invalid for hashVersionFile, must be a string or an object - got ${typeof dependency
                        .files[0]}`,
                );
            }
        }
        if (typeof hashVersionFile === 'string') {
            const fileCommitSha = await github
                .getFileCommitSha({
                    repo,
                    path: hashVersionFile,
                })
                .catch((err) => {
                    error(
                        `Error while getting commit sha for ${hashVersionFile}:\n${err}`,
                    );
                });
            newVersion = fileCommitSha;
        } else {
            error('hashVersionFile is invalid, must be a string or true');
        }
    } else {
        try {
            const latestRelease = await github.getLatestRelease(repo);
            newVersion = latestRelease.tag_name as string;
        } catch {
            if (showOutdatedOnly) {
                error(`Could not find a version for ${dependency.name}`);
            }
            newVersion = '';
        }
    }

    return newVersion;
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

        const { dependencies } = await getConfig();
        const thisFiles = dependencies[name].files;

        const expectedLockFiles = configFilesToVendorlockFiles(
            thisFiles,
            dependencies[name].version || '',
        );

        deepStrictEqual(expectedLockFiles, thisLockFiles);
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
    const { dependencies, config, configFileSettings } = await getConfig();
    const files: Record<string, string> = {};

    for (const [name, dependency] of Object.entries(dependencies)) {
        const filesFromConfig = flatFiles(
            configFilesToVendorlockFiles(
                dependency.files,
                dependency.version || '',
            ),
        );
        for (const file of filesFromConfig) {
            files[
                path.join(
                    getDependencyFolder({
                        dependency,
                        config,
                        configPath: configFileSettings.path,
                        backupName: name,
                    }),
                    file,
                )
            ] = name;
        }
    }

    return files;
}

export async function readLockfile(filepath: string): Promise<Lockfile> {
    return parseJson(await readFile(filepath, 'utf-8')) as Lockfile;
}

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
    assert(!!match, `Invalid GitHub URL: ${url}`);

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
        `config key 'vendorDependencies.${name}.repository' is not a valid github url`,
    );
    assert(
        Array.isArray(dependency.files) && dependency.files.length > 0,
        `config key 'vendorDependencies.${name}.files' is not a valid array`,
    );
}

export function getDependencyFolder({
    dependency,
    config,
    configPath,
    backupName,
}: {
    dependency: VendorDependency;
    config: VendorConfig;
    configPath: string;
    backupName: string;
}): string {
    return path.join(
        path.dirname(configPath),
        dependency.vendorFolder?.replace(
            '{vendorFolder}',
            config.vendorFolder,
        ) || config.vendorFolder,
        dependency.vendorFolder ? '' : dependency.name || backupName,
    );
}

export async function getPackageJson(): Promise<PackageJson> {
    const pkg: PackageJson = parseJson(
        await readFile(new URL('../../package.json', import.meta.url), 'utf-8'),
    );

    assert(!!pkg, 'Could not find package.json');

    return pkg;
}

// biome-ignore lint/suspicious/noExplicitAny: circular types are hard
export function replaceVersionInObject(obj: any, version: string) {
    if (typeof obj === 'string') {
        return replaceVersion(obj, version);
    }
    if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            obj[key] = replaceVersionInObject(obj[key], version);
        }
    }
    return obj;
}

export function configFilesToVendorlockFiles(
    arr: FilesArray,
    version: string,
): VendorLockFiles {
    const obj = {};
    for (const item of arr) {
        if (typeof item !== 'string') {
            Object.assign(
                obj,
                replaceVersionInObject(structuredClone(item), version),
            );
        } else {
            Object.assign(obj, {
                [item]: replaceVersion(path.basename(item), version),
            });
        }
    }

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
