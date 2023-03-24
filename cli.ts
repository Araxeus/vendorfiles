#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings';
import { isCI } from 'ci-info';

import {
    error,
    getPackageJson,
    isGitHubUrl,
    ownerAndNameFromRepoUrl,
} from './lib/utils.js';
import { sync, install, uninstall } from './lib/commands.js';
import { getConfig } from './lib/config.js';
import { findRepoUrl } from './lib/github.js';

const vendorOptions = await getConfig();

const program = new Command();

const installCmd = new Command('install')
    .alias('add')
    .alias('i')
    .alias('a')
    .argument(
        '<url/name>',
        'GitHub repo URL or owner/repo format or name of repo to search for',
    )
    .argument('[version]', 'Version to install')
    .option('-n, --name [name]', 'Name to write in dependencies')
    .option('-f, --files <files...>', 'Files to install')
    .action(async (source, version, { name, files }) => {
        if (source && files) {
            let url;
            if (isGitHubUrl(source)) {
                url = source;
            } else if (source.match(/^[^/]+\/[^/]+$/)) {
                // url is in format owner/repo
                url = `https://www.github.com/${source}`;
            } else {
                url = await findRepoUrl(source);
            }

            if (!isGitHubUrl(url)) {
                error(`Invalid GitHub URL "${url}"`);
            }

            if (typeof name !== 'string' || name.length === 0) {
                name = ownerAndNameFromRepoUrl(url).name;
            }

            installOne({ url, files, version, name });
        } else if (source && !files) {
            error(
                'you must provide files to install with -f or --files <files...>',
            );
        } else {
            syncAll(true);
        }
    })
    .summary('Install a dependency')
    .description(
        'Install a dependency. origin can be a GitHub repo URL or owner/repo format or name of repo to search for.\nFiles have to be provided with -f or --files <files...>',
    )
    .addHelpText(
        'after',
        `
Examples:
  vendor install React -n MyReact -f README.md
  vendor install Araxeus/vendorfiles v1.0.0 -f README.md LICENSE
  vendor install https://github.com/th-ch/youtube-music -f "{release}/YouTube-Music-{version}.exe"
`,
    );

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
    })
    .summary('Uninstall dependencies')
    .description('Uninstall all/selected dependencies')
    .addHelpText(
        'after',
        `
Examples:
    vendor uninstall React
    vendor uninstall React youtube-music
`,
    );

const updateCmd = new Command('update')
    .alias('upgrade')
    .alias('bump')
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
    })
    .summary('Update dependencies')
    .description(
        'Update all/selected dependencies to their latest version (from GitHub Releases))',
    )
    .addHelpText(
        'after',
        `
Examples:
    vendor update
    vendor update React
    vendor update React Express
`,
    );

const syncCmd = new Command('sync')
    .alias('s')
    .option('-f, --force', 'Force sync')
    .action(({ force }) => syncAll(!!force))
    .summary('Sync config file')
    .description('Sync all dependencies in the config file')
    .addHelpText(
        'after',
        `
Examples:
    vendor sync
    vendor sync -f
`,
    );

program
    .name('vendor')
    .usage('command [options]')
    .addCommand(syncCmd)
    .addCommand(updateCmd)
    .addCommand(installCmd)
    .addCommand(uninstallCmd)

    .version(
        (await getPackageJson(import.meta.url)).packageJson.version ||
            'unknown',
        '-v, --version',
        'output the current version',
    )
    // TODO add ci option (which will print pr details to stdout on update)
    .option('-c, --ci', 'CI mode', isCI)
    .parse();

function upgradeAll() {
    sync(vendorOptions, {
        shouldUpdate: true,
    });
}

function syncAll(force: boolean) {
    sync(vendorOptions, {
        shouldUpdate: false,
        force,
    });
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
    // @ts-expect-error Property 'vendorDependencies' does not exist on type 'PackageJson'
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
