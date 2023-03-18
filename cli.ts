import { Command } from 'commander';
const program = new Command();

import { isCI } from 'ci-info';

import { error, isGitHubUrl, ownerAndNameFromRepoUrl } from './lib/utils.js';

import { sync, install, uninstall } from './lib/commands.js';
import { getConfig } from './lib/config.js';

const vendorOptions = await getConfig();

const listCmd = new Command('list')
  .alias('ls')
  .alias('l')
  .option('-o, --outdated', 'Show only outdated packages')
  .action((outdatedOnly = false) => {
    outdatedOnly ? outdated() : list();
  });

const outdatedCmd = new Command('outdated')
  .alias('o')
  .alias('out')
  .action(() => {
    outdated();
  });

const installCmd = new Command('install')
  .alias('i')
  .alias('add')
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

      if (!name) {
        name = ownerAndNameFromRepoUrl(url).name;
      }

      installOne({ url, files, version, name: name });
    } else if (!url) {
      error('url arg is missing');
    } else if (!files) {
      error('files arg is missing');
    }
  });

const uninstallCmd = new Command('uninstall')
  .alias('un')
  .alias('remove')
  .alias('rm')
  .alias('r')
  .alias('delete')
  .alias('del')
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
  .alias('u')
  .alias('up')
  .alias('upgrade')
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

const syncCmd = new Command('sync')
  .alias('s')
  .alias('syn')
  .action(() => {
    syncAll();
  });

program
  .addCommand(installCmd)
  .addCommand(uninstallCmd)
  .addCommand(updateCmd)
  .addCommand(syncCmd)
  .addCommand(listCmd)
  .addCommand(outdatedCmd)
  // TODO add ci option (which will print pr details to stdout on update)
  .option('-c, --ci', 'CI mode', isCI)
  .parse();

// [X] done
function upgradeAll() {
  sync(vendorOptions, true);
}

// [X] done
function syncAll() {
  sync(vendorOptions, false);
}

// [X] done
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

// [X] done
function uninstallOne(name: string) {
  uninstall(name, vendorOptions);
}

// [ ] TODO
function upgradeOne(name: string) {
  console.log('upgrading', name);
}

// [ ] TODO
function list() {
  console.log('list');
}

// [ ] TODO
function outdated() {
  console.log('outdated');
}
