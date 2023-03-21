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

export type FilesArray = (string | FileInputOutput)[];

export type VendorDependency = {
    repository: string;
    files: FilesArray;
    version?: string;
    name?: string;
    vendorFolder?: string;
};

export type Lockfile = { [key: string]: VendorLock };

export type FileInputOutput = {
    [input: string]: string;
};

export type VendorLock = {
    version: string;
    repository: string;
    files: FilesArray;
};

export type Repository = {
    owner: string;
    name: string;
};
