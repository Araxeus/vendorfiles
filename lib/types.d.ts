export type VendorsOptions = {
    dependencies: VendorDependencies;
    config: VendorConfig;
    configFile: ConfigFile;
    configFileSettings: ConfigFileSettings;
};

export type ConfigFile = {
    vendorConfig: VendorConfig;
    vendorDependencies: VendorDependencies;
    [key: string]: unknown;
};

export type ConfigFileSettings = {
    format: 'toml' | 'yml' | 'json';
    path: string;
    indent?: number | string;
};

export type VendorConfig = {
    vendorFolder: string;
};

export type VendorDependencies = {
    [key: string]: VendorDependency;
};

export type FileInputOutput = {
    [input: string]: string | { [input: string]: string };
};

export type FilesArray = (string | FileInputOutput)[];

export type VendorDependency = {
    repository: string;
    files: FilesArray;
    version?: string;
    name?: string;
    vendorFolder?: string;
};

// LOCKFILE TYPES
export type Lockfile = { [key: string]: VendorLock };

export type VendorLock = {
    version: string;
    repository: string;
    files: VendorLockFiles;
};

export type VendorLockFiles = {
    [key: string]: VendorLockFile;
};

export type VendorLockFile = string | { [key: string]: string };

export type Repository = {
    owner: string;
    name: string;
};
