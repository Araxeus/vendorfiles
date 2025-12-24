import { existsSync } from 'node:fs';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import detectIndent from 'detect-indent';
import parseJson from 'parse-json';
import toml from 'smol-toml';
import yaml from 'yaml';
import type {
    ConfigFile,
    ConfigFileSettings,
    VendorConfig,
    VendorDependencies,
    VendorsOptions,
} from './types.js';
import { assert } from './utils.js';

const defaultConfig = {
    vendorFolder: './vendor',
};

const runOptions = {
    prMode: false,
    configLocation: '',
};
export function getRunOptions(): typeof runOptions {
    return runOptions;
}
export function setRunOptions(flags: Partial<typeof runOptions>) {
    Object.assign(runOptions, flags);
}

async function findFirstFile(folderOrFilePath: string, files: string[]) {
    const getFile = async (file: string) => ({
        data: await readFile(file, 'utf-8'),
        path: file,
    });
    const isAlreadyFilepath = files.find(f => folderOrFilePath.endsWith(f));
    if (isAlreadyFilepath && existsSync(folderOrFilePath)) {
        return getFile(folderOrFilePath);
    }
    for (const file of files) {
        const filePath = path.join(folderOrFilePath, file);
        if (existsSync(filePath)) return getFile(filePath);
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
            data = toml.parse(config.data) as ConfigFile;
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
        runOptions.configLocation ||
            process.env.VENDOR_CONFIG ||
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

    const defaultOptions =
        configFile.data.defaultVendorOptions || configFile.data.default || {};

    for (const depName of Object.keys(dependencies)) {
        const files = dependencies[depName].files;
        if (typeof files === 'string') {
            dependencies[depName].files = [files];
        }
        for (const defaultKey of Object.keys(defaultOptions)) {
            // @ts-expect-error expression of type 'string' can't be used to index type 'VendorDependency'
            dependencies[depName][defaultKey] ??= defaultOptions[defaultKey];
        }
    }

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
}: {
    configFile: ConfigFile;
    configFileSettings: ConfigFileSettings;
}) {
    const indent = configFileSettings.indent;
    const stringify = {
        toml: (configFile: ConfigFile) => toml.stringify(configFile),
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
