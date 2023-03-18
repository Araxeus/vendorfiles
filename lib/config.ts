// we are working on a new package called "vendor-dependencies" that automatically takes care of creating/updating vendor dependencies
// the configuration is either in package.json or in a separate file called vendor-dependencies.json

import path from 'node:path';
import { realpathSync } from 'node:fs';

import { type ReadResult, readPackageUp } from 'read-pkg-up';

import { assert, error } from './utils.js';

import type { VendorConfig, VendorDependencies, VendorsOptions } from './types.js';

const defaultConfig = {
  vendorFolder: './vendor',
};

// function to get the configuration
export async function getConfig(): Promise<VendorsOptions> {
  // if there is a vendor-dependencies.json file in the current directory, use that
  // otherwise, use the configuration from package.json
  // if there is no configuration in package.json, use the default configuration

  const { packageJson: pkgJson, path: pkgPath } = await getPackageJson();

  // @ts-expect-error packageJson.vendorDependencies is not in the type definition
  const dependencies: VendorDependencies = pkgJson.vendorDependencies || {};
  assert(
    dependencies instanceof Object,
    'The vendorDependencies in package.json is invalid.',
  );

  // @ts-expect-error packageJson.vendorConfig is not in the type definition
  const config: VendorConfig = pkgJson.vendorConfig || defaultConfig;
  assert(
    config instanceof Object &&
      typeof config.vendorFolder === 'string' &&
      !/^(\/?[a-z0-9]+)+$/.test(config.vendorFolder),
    'The vendorConfig in package.json is invalid.',
  );

  return {
    dependencies,
    config,
    pkgJson,
    pkgPath,
  };
}

async function getPackageJson(): Promise<ReadResult> {
  const folderPath = path.dirname(realpathSync(process.argv[1]));
  const pkg = await readPackageUp({
    cwd: folderPath,
    normalize: false,
  });

  if (!pkg) {
    error('Could not find package.json');
  }

  return pkg;
}
