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
    const config = await findFirstFile(folderPath, [
        'vendor.toml',
        'vendor.yml',
        'vendor.yaml',
        'vendor.json',
        'package.json',
    ]);
    if (config) {
        let data: ConfigFile;
        let format: 'toml' | 'yml' | 'json';
        if (config.path.endsWith('.toml')) {
            data = toml.parse(config.data, {
                joiner: EOL,
            }) as ConfigFile;
            format = 'toml';
        } else if (
            config.path.endsWith('.yml') ||
            config.path.endsWith('.yaml')
        ) {
            data = yaml.parse(config.data);
            format = 'yml';
        } else {
            data = parseJson(config.data) as ConfigFile;
            format = 'json';
        }
        return {
            format,
            data,
            path: config.path,
            indent: detectIndent(config.data).indent || 2,
            finalNewLine: config.data.match(/\r?\n$/)?.[0] || '',
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
            finalNewLine: configFile.finalNewLine,
        },
    };

    return res;
}

export async function writeConfig({
    configFile,
    configFileSettings,
}: { configFile: ConfigFile; configFileSettings: ConfigFileSettings }) {
    const indent = configFileSettings.indent;
    const stringify = {
        toml: (configFile: ConfigFile) => {
            Object.keys(configFile.vendorDependencies).forEach((key) => {
                if (configFile.vendorDependencies[key]) {
                    configFile.vendorDependencies[key] = Section(
                        configFile.vendorDependencies[key],
                    );
                }
            });
            // @ts-expect-error toml doesn't understand that the ConfigFile type is just an object
            return toml.stringify(configFile, {
                newline: EOL,
                indent,
                newlineAround: 'section',
            });
        },
        yml: (configFile: ConfigFile) =>
            yaml.stringify(configFile, {
                indent: typeof indent === 'number' ? indent : indent?.length,
            }),
        json: (configFile: ConfigFile) =>
            JSON.stringify(configFile, null, indent),
    };
    const data = stringify[configFileSettings.format](configFile);
    await writeFile(
        configFileSettings.path,
        data + configFileSettings.finalNewLine,
    );
}
