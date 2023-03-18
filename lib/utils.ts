import {
  Repository,
  VendorConfig,
  VendorDependency,
  VendorFile,
} from './types.js';

import fs from 'node:fs/promises';
import path from 'node:path';

import parseJson from 'parse-json';

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    error(message);
  }
}

export function error(message: string): never {
  console.error(`\x1b[31mERROR: ${message}\x1b[0m`);
  process.exit(1);
}

export function success(message: string): void {
  console.log(`\x1b[32m${message}\x1b[0m`);
}

export function info(message: string): void {
  console.log(`\x1b[36m${message}\x1b[0m`);
}

export async function writeVendorFile(
  data: VendorFile,
  filepath: string,
): Promise<void> {
  // stringify data nicely and write to path (create folder if needed)
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
}

export async function readVendorFile(filepath: string): Promise<VendorFile> {
  return parseJson(await fs.readFile(filepath, 'utf-8'));
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

export function isGitHubUrl(url: string): boolean {
  return /^https?:(?:)\/\/(?:www\.)?github\.com\/[^/]+\/[^/]+$/.test(url);
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
    Array.isArray(dependency.files) && typeof dependency.files[0] === 'string',
    `package.json key 'vendorDependencies.${name}.files' is not an array of strings`,
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
    dependency.vendorFolder?.replace('{vendorFolder}', config.vendorFolder) ||
      config.vendorFolder,
    dependency.vendorFolder ? '' : dependency.name || backupName,
  );
}
