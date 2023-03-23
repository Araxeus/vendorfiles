import { PackageJson } from 'read-pkg-up';

export type VendorsOptions = {
    dependencies: VendorDependencies;
    config: VendorConfig;
    pkgPath: string;
    pkgJson: PackageJson;
};

export type VendorConfig = {
    vendorFolder: string;
};

export type InstallOptions = {
    dependency: VendorDependency;
    pkgPath: string;
    pkgJson: PackageJson;
    config: VendorConfig;
    shouldUpdate?: boolean;
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

// LOCKFILE

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
