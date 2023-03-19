import { Command } from '@commander-js/extra-typings';
const program = new Command();

import { isCI } from 'ci-info';

import {
  error,
  getPackageJson,
  isGitHubUrl,
  ownerAndNameFromRepoUrl,
} from './lib/utils.js';

import { sync, install, uninstall } from './lib/commands.js';
import { getConfig } from './lib/config.js';

const vendorOptions = await getConfig();

const installCmd = new Command('install')
  .alias('add')
  .alias('i')
  .alias('a')
  .argument('<url>', 'GitHub repo URL')
  .argument('[version]', 'Version to install')
  .option('-n, --name [name]', 'Name to write in vendor.json')
  .option('-f, --files <files...>', 'Files to install')
  .action((url, version, { name, files }) => {
    if (url && files) {
      if (url.match(/^[^/]+\/[^/]+$/)) {
        // url is in format owner/repo
        url = `https://www.github.com/${url}`;
      } else if (!isGitHubUrl(url)) {
        error('Invalid GitHub URL');
      }

      if (typeof name !== 'string' || name.length === 0) {
        name = ownerAndNameFromRepoUrl(url).name;
      }

      installOne({ url, files, version, name });
    } else if (!url && files) {
      error('url arg is missing');
    } else if (!files && url) {
      error('files arg is missing');
    } else {
      syncAll();
    }
  });

const uninstallCmd = new Command('uninstall')
  .alias('remove')
  .alias('delete')
  .alias('del')
  .alias('rm')
  .alias('un')
  .alias('r')
  .argument('[names...]', 'Package names to uninstall')
  .action((names) => {
    if (names.length === 0) {
      error('No package names provided');
    } else {
      names.forEach((name: string) => {
        uninstallOne(name);
      });
    }
  });

const updateCmd = new Command('update')
  .alias('upgrade')
  .alias('up')
  .alias('u')
  .argument('[names...]')
  .action((names) => {
    if (names.length === 0) {
      upgradeAll();
    } else {
      names.forEach((name: string) => {
        upgradeOne(name);
      });
    }
  });

const syncCmd = new Command('sync').alias('s').action(syncAll);

program
  .addCommand(installCmd)
  .addCommand(uninstallCmd)
  .addCommand(updateCmd)
  .addCommand(syncCmd)
  .version(
    (await getPackageJson(import.meta.url)).packageJson.version || 'unknown',
    '-v, --version',
    'output the current version',
  )
  // TODO add ci option (which will print pr details to stdout on update)
  .option('-c, --ci', 'CI mode', isCI)
  .parse();

function upgradeAll() {
  sync(vendorOptions, true);
}

function syncAll() {
  sync(vendorOptions, false);
}

function installOne({
  url,
  name,
  version,
  files,
}: { url: string; files: string[]; version?: string; name?: string }) {
  install({
    dependency: { repository: url, files, version, name },
    config: vendorOptions.config,
    pkgPath: vendorOptions.pkgPath,
    pkgJson: vendorOptions.pkgJson,
    shouldUpdate: !!version,
  });
}

function uninstallOne(name: string) {
  uninstall(name, vendorOptions);
}

function upgradeOne(name: string) {
  // @ts-expect-error
  const dep = vendorOptions.pkgJson.vendorDependencies?.[name];
  if (!dep) {
    error(`No dependency found with name ${name}`);
  } else if (!dep.repository) {
    error(`No repository found for dependency ${name}`);
  } else if (!dep.files) {
    error(`No files found for dependency ${name}`);
  }

  installOne({
    url: dep.repository,
    files: dep.files,
    name,
  });
}
