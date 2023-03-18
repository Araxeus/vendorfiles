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

export type VendorDependency = {
  repository: string;
  files: string[];
  version?: string;
  name?: string;
  vendorFolder?: string;
};

export type VendorFile = {
  name: string;
  version: string;
  repository: string;
  files: string[];
};

export type Repository = {
  owner: string;
  name: string;
};
