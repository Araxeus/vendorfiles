import path from 'node:path';
import fs from 'node:fs/promises';

import { writePackage } from 'write-pkg';

import type {
  VendorConfig,
  VendorDependency,
  VendorsOptions,
} from './types.js';
import type { PackageJson } from 'read-pkg-up';

import github from './github.js';
import {
  ownerAndNameFromRepoUrl,
  writeVendorFile,
  readVendorFile,
  error,
  info,
  success,
  validateVendorDependency,
  getDependencyFolder,
} from './utils.js';

export async function sync(
  { config, dependencies, pkgPath, pkgJson }: VendorsOptions,
  shouldUpdate?: boolean,
) {
  for (const [name, dependency] of Object.entries(dependencies)) {
    validateVendorDependency(name, dependency);

    dependency.name = name;

    await install({
      dependency,
      pkgPath,
      pkgJson,
      config,
      shouldUpdate,
    });
  }
}

export async function uninstall(
  name: string,
  { dependencies, config, pkgPath, pkgJson }: VendorsOptions,
) {
  const dep = dependencies[name];

  const depDirectory = dep
    ? getDependencyFolder({
        dependency: dep,
        config,
        pkgPath,
        backupName: name,
      })
    : path.join(path.dirname(pkgPath), config.vendorFolder, name);

  await fs.rm(depDirectory, { recursive: true, force: true });

  // @ts-expect-error
  pkgJson.vendorDependencies[name] = undefined;
  // @ts-expect-error
  await writePackage(pkgPath, pkgJson);

  success(`Uninstalled ${name}`);
}

export async function install({
  dependency,
  pkgPath,
  pkgJson,
  config,
  shouldUpdate,
  newVersion,
}: {
  dependency: VendorDependency;
  pkgPath: string;
  pkgJson: PackageJson;
  config: VendorConfig;
  shouldUpdate?: boolean;
  newVersion?: string;
}) {
  const repo = ownerAndNameFromRepoUrl(dependency.repository);

  dependency.name ||= repo.name;

  const depDirectory = getDependencyFolder({
    dependency,
    config,
    pkgPath,
    backupName: dependency.name,
  });
  // path.join(
  //   path.dirname(pkgPath),
  //   dependency.vendorFolder?.replace('{vendorFolder}', config.vendorFolder) ||
  //     config.vendorFolder,
  //   dependency.vendorFolder ? '' : dependency.name,
  // );
  const vendorfilePath = path.join(depDirectory, 'vendor.json');

  // if the dependency folder does not exist, create it
  await fs.mkdir(depDirectory, { recursive: true });

  // remove files that are not in the vendorfile
  const filesInFolder = await fs.readdir(depDirectory);
  const fileNames = dependency.files.map((file) => path.basename(file));
  for (const file of filesInFolder) {
    if (!fileNames.includes(file) && file !== 'vendor.json') {
      await fs.rm(path.join(depDirectory, file));
    }
  }

  // check if the dependency needs to be updated

  if (!(shouldUpdate || newVersion)) {
    newVersion = dependency.version;
  }

  if (!newVersion) {
    const latestRelease = await github.getLatestRelease(repo);
    newVersion = latestRelease.tag_name;
  }

  if (!(await checkIfNeedsUpdate(vendorfilePath, newVersion))) return;

  await Promise.all(
    dependency.files.map(async (file) => {
      const downloadedFile = await github
        .getFile({
          repo,
          path: file,
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

      const filename = path.basename(file);

      const savePath = path.join(depDirectory, path.basename(filename));

      await fs.writeFile(savePath, downloadedFile, 'utf-8').then(() => {
        info(`Saved ${savePath}`);
      });
    }),
  );

  await writeVendorFile(
    {
      name: dependency.name,
      version: newVersion || 'latest',
      repository: dependency.repository,
      files: dependency.files,
    },
    vendorfilePath,
  );

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
    } as VendorDependency;
    // @ts-expect-error
    await writePackage(pkgPath, pkgJson);
  }

  if (shouldUpdate) {
    success(`Updated ${dependency.name} from ${old_version} to ${newVersion}`);
  } else {
    success(`Installed ${dependency.name} ${newVersion}`);
  }
}

async function checkIfNeedsUpdate(vendorfilePath: string, newVersion: string) {
  try {
    const vendorfile = await readVendorFile(vendorfilePath);
    return vendorfile.version !== newVersion;
  } catch {
    return true;
  }
}
