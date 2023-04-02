import { assert } from './utils.js';

import toml, { Section } from '@ltd/j-toml';
import yaml from 'yaml';
import detectIndent from 'detect-indent';
import parseJson from 'parse-json';

import type {
    ConfigFile,
    ConfigFileSettings,
    VendorConfig,
    VendorDependencies,
    VendorsOptions,
} from './types.js';

import { EOL } from 'os';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const defaultConfig = {
    vendorFolder: './vendor',
};

const runOptions = {
    prMode: false,
    configFolder: '',
};
export function getRunOptions(): typeof runOptions {
    return runOptions;
}
export function setRunOptions(flags: Partial<typeof runOptions>) {
    Object.assign(runOptions, flags);
}

// function to get the configuration

async function findFirstFile(folderPath: string, files: string[]) {
    for (const file of files) {
        const filePath = path.join(folderPath, file);

        if (existsSync(filePath)) {
            return {
                data: await readFile(filePath, 'utf-8'),
                path: filePath,
            };
        }
    }

    return null;
}

async function getConfigFile(folderPath: string): Promise<
    | ({
          data: ConfigFile;
      } & ConfigFileSettings)
    | null
> {
    const tomlConfig = await findFirstFile(folderPath, ['vendor.toml']);
    if (tomlConfig) {
        return {
            format: 'toml',
            data: toml.parse(tomlConfig.data, {
                joiner: EOL,
            }) as ConfigFile,
            path: tomlConfig.path,
            indent: detectIndent(tomlConfig.data).indent || 2,
        };
    }

    const ymlConfig = await findFirstFile(folderPath, [
        'vendor.yml',
        'vendor.yaml',
    ]);
    if (ymlConfig) {
        return {
            format: 'yml',
            data: yaml.parse(ymlConfig.data),
            path: ymlConfig.path,
            indent: detectIndent(ymlConfig.data).indent || 2,
        };
    }

    const jsonConfig = await findFirstFile(folderPath, [
        'vendor.json',
        'package.json',
    ]);
    if (jsonConfig) {
        return {
            format: 'json',
            data: parseJson(jsonConfig.data),
            path: jsonConfig.path,
            indent: detectIndent(jsonConfig.data).indent || 2,
        };
    }

    return null;
}

let res: VendorsOptions;
export async function getConfig(): Promise<VendorsOptions> {
    if (res) return res;

    const folderPath = await realpath(
        runOptions.configFolder ||
            process.env.INIT_CWD ||
            process.env.PWD ||
            process.cwd(),
    );

    const configFile = await getConfigFile(folderPath);
    assert(
        !!configFile,
        'No configuration file found in the current directory.',
    );

    const dependencies: VendorDependencies =
        structuredClone(configFile.data.vendorDependencies) || {};
    assert(
        typeof dependencies === 'object',
        `Invalid vendorDependencies key in ${configFile.path}`,
    );

    const config: VendorConfig = configFile.data.vendorConfig || defaultConfig;
    config.vendorFolder = config.vendorFolder || defaultConfig.vendorFolder;
    assert(
        typeof config === 'object' && typeof config.vendorFolder === 'string',
        `Invalid vendorConfig key in ${configFile.path}`,
    );

    res = {
        dependencies,
        config,
        configFile: configFile.data,
        configFileSettings: {
            format: configFile.format,
            path: configFile.path,
            indent: configFile.indent,
        },
    };

    return res;
}

export async function writeConfig({
    configFile,
    configFileSettings,
}: { configFile: ConfigFile; configFileSettings: ConfigFileSettings }) {
    const indent = configFileSettings.indent;
    switch (configFileSettings.format) {
        case 'toml':
            Object.keys(configFile.vendorDependencies).forEach((key) => {
                if (configFile.vendorDependencies[key]) {
                    configFile.vendorDependencies[key] = Section(
                        configFile.vendorDependencies[key],
                    );
                }
            });
            await writeFile(
                configFileSettings.path,
                // @ts-expect-error toml doesn't understand that the ConfigFile type is just an object
                toml.stringify(configFile, {
                    newline: EOL,
                    indent: configFileSettings.indent,
                    newlineAround: 'section',
                }),
            );
            break;
        case 'yml':
            await writeFile(
                configFileSettings.path,
                yaml.stringify(configFile, {
                    indent:
                        typeof indent === 'number' ? indent : indent?.length,
                }),
            );
            break;
        case 'json':
            await writeFile(
                configFileSettings.path,
                JSON.stringify(configFile, null, indent),
            );
            break;
    }
}
