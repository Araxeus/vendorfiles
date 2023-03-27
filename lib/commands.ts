import type {
    ConfigFile,
    ConfigFileSettings,
    Lockfile,
    VendorConfig,
    VendorDependency,
    VendorsOptions,
} from './types.js';

import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';

import { unarchive } from 'unarchive';

import { writeConfig } from './config.js';
import github from './github.js';
import {
    ownerAndNameFromRepoUrl,
    writeLockfile,
    checkIfNeedsUpdate,
    error,
    info,
    success,
    validateVendorDependency,
    getDependencyFolder,
    getFilesFromLockfile,
    readLockfile,
    flatFiles,
    deleteFileAndEmptyFolders,
    readableToFile,
    configFilesToVendorlockFiles,
    replaceVersion,
    random,
    assert,
} from './utils.js';

export async function sync(
    { config, dependencies, configFile, configFileSettings }: VendorsOptions,
    {
        shouldUpdate = false,
        force = false,
    }: { shouldUpdate?: boolean; force?: boolean } = {},
) {
    for (const [name, dependency] of Object.entries(dependencies)) {
        validateVendorDependency(name, dependency);

        dependency.name = name;

        await install({
            dependency,
            configFile,
            configFileSettings,
            config,
            shouldUpdate,
            force,
        });
    }
}

export async function uninstall(
    name: string,
    { dependencies, config, configFile, configFileSettings }: VendorsOptions,
) {
    const dep = dependencies[name];
    assert(!!dep, `Dependency ${name} not found in ${configFileSettings.path}`);

    const depDirectory = dep
        ? getDependencyFolder({
              dependency: dep,
              config,
              configPath: configFileSettings.path,
              backupName: name,
          })
        : path.join(
              path.dirname(configFileSettings.path),
              config.vendorFolder,
              name,
          );

    const lockfilePath = path.join(depDirectory, 'vendor-lock.json');
    let lockfile: Lockfile | undefined;

    try {
        lockfile = await readLockfile(lockfilePath);
        for (const file of flatFiles(lockfile[name].files)) {
            try {
                await deleteFileAndEmptyFolders(depDirectory, file);
            } catch {}
        }
    } catch {}

    for (const file of flatFiles(
        configFilesToVendorlockFiles(dep.files, dep.version || ''),
    )) {
        try {
            await deleteFileAndEmptyFolders(depDirectory, file);
        } catch {}
    }

    // check if name is the only key in the lockfile
    if (lockfile?.[name] && Object.keys(lockfile).length === 1) {
        // if so, delete the lockfile
        await fs.rm(lockfilePath, { force: true });

        // if the dependency folder is empty, delete it
        if ((await fs.readdir(depDirectory)).length === 0) {
            await fs.rm(depDirectory, { recursive: true, force: true });
        }
    } else if (lockfile?.[name]) {
        // if not, remove the dependency from the lockfile
        // @ts-expect-error Type 'undefined' is not assignable to type 'VendorLock'
        lockfile[name] = undefined;
        await fs.writeFile(lockfilePath, JSON.stringify(lockfile, null, 2));
    }

    // @ts-expect-error Type 'undefined' is not assignable to type 'VendorDependency'
    configFile.vendorDependencies[name] = undefined;

    await writeConfig({
        configFile,
        configFileSettings,
    });

    success(`Uninstalled ${name}`);
}

export async function install({
    dependency,
    configFile,
    configFileSettings,
    config,
    shouldUpdate,
    force,
    newVersion,
}: {
    dependency: VendorDependency;
    configFile: ConfigFile;
    configFileSettings: ConfigFileSettings;
    config: VendorConfig;
    shouldUpdate?: boolean;
    force?: boolean;
    newVersion?: string;
}) {
    const repo = ownerAndNameFromRepoUrl(dependency.repository);

    dependency.name ||= repo.name;

    const depDirectory = getDependencyFolder({
        dependency,
        config,
        configPath: configFileSettings.path,
        backupName: dependency.name,
    });

    const lockfilePath = path.join(depDirectory, 'vendor-lock.json');

    // check if the dependency needs to be updated
    if (!(shouldUpdate || newVersion)) {
        newVersion = dependency.version;
    }

    if (!newVersion) {
        const latestRelease = await github.getLatestRelease(repo);
        newVersion = latestRelease.tag_name as string;
    }

    assert(!!newVersion, `Could not find a version for ${dependency.name}`);

    const needUpdate =
        force ||
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
    const filesFromLockfile = await getFilesFromLockfile(
        lockfilePath,
        dependency.name,
    );
    for (const file of filesFromLockfile) {
        if (existsSync(path.join(depDirectory, file))) {
            await deleteFileAndEmptyFolders(depDirectory, file);
        }
    }

    const allFiles: (
        | string
        | [string, string]
        | [string, { [input: string]: string }]
    )[] = dependency.files.flatMap((file) =>
        // @ts-expect-error Type 'string' is not assignable to type '[string, string]'
        typeof file === 'object' ? Object.entries(file) : file,
    );

    const ref = newVersion; // TODO delete this after typescript bug is fixed (newVersion is not a string)

    type ReleaseFileOutput = string | { [input: string]: string };

    const releaseFiles: { input: string; output: ReleaseFileOutput }[] = [];

    await Promise.all(
        allFiles.map(async (file) => {
            let input: string;
            // type of parameter two
            let output: ReleaseFileOutput;
            if (Array.isArray(file)) {
                input = file[0];
                output = file[1];
            } else if (typeof file === 'string') {
                input = file;
                output = path.basename(file);
            } else {
                error(`File ${file} is not a string or an array`);
            }

            if (input.startsWith('{release}/')) {
                releaseFiles.push({ input, output });
                return;
            } else if (typeof output !== 'string') {
                error(
                    `File ${JSON.stringify(
                        file,
                    )}\nis not a string, and {release} is not used}`,
                );
            }

            const downloadedFile = await github
                .getFile({
                    repo,
                    path: input,
                    ref,
                })
                .catch((err) => {
                    if (err?.status === 404) {
                        error(
                            `File "${file}" was not found in ${dependency.repository}`,
                        );
                    } else {
                        error(
                            `${err.toString()}:\nCould not download file "${
                                typeof file === 'string' ? file : file[0]
                            }" from ${dependency.repository}`,
                        );
                    }
                });

            const savePath = path.join(depDirectory, output);

            await readableToFile(downloadedFile, savePath);
        }),
    );

    await Promise.all(
        // file.output is either a string that or an object which would mean that we want to extract the files from the downloaded archive
        releaseFiles.map(async (file) => {
            const input = replaceVersion(file.input, ref).replace(
                '{release}/',
                '',
            );
            const output = file.output;

            const releaseFile = await github.downloadReleaseFile({
                repo,
                path: input,
                version: ref,
            });

            if (typeof output === 'object') {
                const tempFolder = path.join(
                    os.tmpdir(),
                    `vendorfiles-${random()}`,
                );
                try {
                    // create temp folder
                    await fs.mkdir(tempFolder, { recursive: true });

                    // save archive to temp folder
                    const archivePath = path.join(tempFolder, input);
                    await readableToFile(releaseFile, archivePath, false);

                    // extract archive
                    const randomFolderName = path.join(tempFolder, random());

                    try {
                        await unarchive(archivePath, randomFolderName);
                    } catch {
                        await fs.rm(tempFolder, {
                            force: true,
                            recursive: true,
                        });
                        error(
                            `file "${input}" cannot be extracted.\nplease check that it's either a zip | tar | tar.gz`,
                        );
                    }

                    const inputOutput = Array.isArray(output)
                        ? output.map((o) => [o, o])
                        : Object.entries(output);

                    // move files
                    for (let [inputPath, outputPath] of inputOutput) {
                        inputPath = path.join(randomFolderName, inputPath);
                        outputPath = path.join(
                            depDirectory,
                            replaceVersion(outputPath, ref),
                        );
                        try {
                            await fs.access(inputPath);
                            await fs.mkdir(path.dirname(outputPath), {
                                recursive: true,
                            });
                            await fs.rename(inputPath, outputPath);
                            info(`Saved ${outputPath}`);
                        } catch (e) {
                            await fs.rm(tempFolder, {
                                force: true,
                                recursive: true,
                            });
                            error(
                                `Error while moving file "${inputPath}" to "${outputPath}":\n${e}`,
                            );
                        }
                    }
                } finally {
                    await fs.rm(tempFolder, { force: true, recursive: true });
                }
            } else {
                await readableToFile(
                    releaseFile,
                    path.join(depDirectory, replaceVersion(output, ref)),
                );
            }
        }),
    );

    await writeLockfile(
        dependency.name,
        {
            version: newVersion,
            repository: dependency.repository,
            files: dependency.files,
        },
        lockfilePath,
    );

    const old_version = dependency.version;

    if (newVersion !== old_version) {
        configFile.vendorDependencies[dependency.name] = {
            name: dependency.name,
            version: newVersion,
            repository: dependency.repository,
            files: dependency.files,
            vendorFolder: dependency.vendorFolder,
        } as VendorDependency;
        await writeConfig({
            configFile,
            configFileSettings,
        });
    }

    if (shouldUpdate) {
        success(
            `Updated ${dependency.name} from ${old_version} to ${newVersion}`,
        );
    } else {
        success(`Installed ${dependency.name} ${newVersion}`);
    }
}
