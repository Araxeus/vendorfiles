export * from './lib/commands.js';
export * from './lib/config.js';
export * from './lib/github.js';
export type {
    ConfigFile,
    ConfigFileSettings,
    FileInputOutput,
    FilesArray,
    Lockfile,
    Repository,
    VendorConfig,
    VendorDependencies,
    VendorDependency,
    VendorLock,
    VendorLockFile,
    VendorLockFiles,
    VendorsOptions,
} from './lib/types.d.ts';
export * from './lib/utils.js';

// Soon™:
// > add a --config option to specify a folder where to look for the config file
// > complete release-notes.ts (add to https://github.com/Araxeus/vendorfiles-action)

// Later:
// > Nice documentation website
// > add spinners
// > add tests (also test package as imported + installed globally)
// > add support for glob patterns
// > "dry run" mode
// > add support for other providers like npm / git (gitlab, bitbucket, etc.)
