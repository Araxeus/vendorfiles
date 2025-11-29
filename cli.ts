#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings';
import { install, sync, uninstall } from './lib/commands.js';
import { getConfig, setRunOptions } from './lib/config.js';
import { findRepoUrl, login } from './lib/github.js';
import type { FilesArray, VendorsOptions } from './lib/types.js';
import {
    assert,
    getPackageJson,
    isGitHubUrl,
    ownerAndNameFromRepoUrl,
} from './lib/utils.js';

let vendorOptions: VendorsOptions;

const program = new Command();

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

const updateCmd = new Command('update')
    .alias('upgrade')
    .alias('bump')
    .alias('up')
    .alias('u')
    .argument('[names...]')
    .option('-p|--pr', 'Output pull request text for gh action', false)
    .action((names, { pr }) => {
        if (names.length === 0) {
            upgradeAll(pr);
        } else {
            for (const name of names) {
                upgradeOne(name);
            }
        }
    })
    .summary('Update outdated dependencies')
    .description(
        'Update all/selected dependencies to their latest version (the tag of the latest release)',
    )
    .addHelpText(
        'after',
        `
Examples:
    vendor update
    vendor bump React
    vendor update React Express
`,
    );

const outdatedCmd = new Command('outdated')
    .alias('o')
    .action(() => showOutdated())
    .summary('List outdated dependencies')
    .description('List outdated dependencies')
    .addHelpText(
        'after',
        `
Examples:
    vendor outdated
    vendor o
`,
    );

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
        if (source) {
            let url: string;
            if (isGitHubUrl(source)) {
                url = source;
            } else if (source.match(/^[^/]+\/[^/]+$/)) {
                // url is in format owner/repo
                url = `https://www.github.com/${source}`;
            } else {
                url = await findRepoUrl(source);
            }

            assert(isGitHubUrl(url), `Invalid GitHub URL "${url}"`);

            if (typeof name !== 'string' || name.length === 0) {
                name = ownerAndNameFromRepoUrl(url).name;
            }

            const deps =
                vendorOptions.dependencies[name] ||
                Object.values(vendorOptions.dependencies).find(
                    dep => dep.repository === url,
                ) ||
                {};

            assert(
                !!files || !!deps?.files,
                'you must provide files to install with -f or --files <files...>',
            );

            installOne({ url, files: files || deps.files, version, name });
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
    vendor add Araxeus/vendorfiles v1.0.0 -f README.md LICENSE
    vendor i https://github.com/th-ch/youtube-music -f "{release}/YouTube-Music-{version}.exe"
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
    .action(names => {
        assert(names.length > 0, 'No package names provided');

        for (const name of names) {
            uninstallOne(name);
        }
    })
    .summary('Uninstall dependencies')
    .description('Uninstall all/selected dependencies')
    .addHelpText(
        'after',
        `
Examples:
    vendor uninstall React
    vendor remove React youtube-music
`,
    );

const loginCmd = new Command('login')
    .alias('auth')
    .argument('[token]', 'GitHub token (leave empty to login via browser)')
    .action(token => login(token))
    .summary('Login to GitHub')
    .description('Login to GitHub to increase rate limit')
    .addHelpText(
        'after',
        `
Examples:
    vendor login
    vendor auth <token>
`,
    );

program
    .name('vendor')
    .hook('preAction', async () => {
        setRunOptions({
            configFolder: program.getOptionValue('folder') as
                | string
                | undefined,
        });
        vendorOptions = await getConfig();
    })
    .usage('command [options]')
    .addCommand(syncCmd)
    .addCommand(updateCmd)
    .addCommand(outdatedCmd)
    .addCommand(installCmd)
    .addCommand(uninstallCmd)
    .addCommand(loginCmd)
    .option('-d, --folder [folder]', 'Folder containing the config file')
    .version(
        (await getPackageJson()).version || 'unknown',
        '-v, --version',
        'output the current version',
    )
    .parse();

function upgradeAll(prMode: boolean) {
    if (prMode) {
        setRunOptions({ prMode });
    }

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

function showOutdated() {
    sync(vendorOptions, {
        shouldUpdate: true,
        showOutdatedOnly: true,
    });
}

function installOne({
    url,
    name,
    version,
    files,
}: {
    url: string;
    files: FilesArray;
    version?: string;
    name?: string;
}) {
    install({
        dependency: (name && vendorOptions.dependencies[name]) || {
            repository: url,
            files,
            version,
            name,
        },
        config: vendorOptions.config,
        configFile: vendorOptions.configFile,
        configFileSettings: vendorOptions.configFileSettings,
        shouldUpdate: !version,
        newVersion: version,
    });
}

function uninstallOne(name: string) {
    uninstall(name, vendorOptions);
}

function upgradeOne(name: string) {
    const dep = vendorOptions.configFile.vendorDependencies?.[name];
    assert(!!dep, `No dependency found with name ${name}`);
    assert(!!dep.repository, `No repository found for dependency ${name}`);
    assert(!!dep.files, `No files found for dependency ${name}`);

    installOne({
        url: dep.repository,
        files: dep.files,
        name,
    });
}
