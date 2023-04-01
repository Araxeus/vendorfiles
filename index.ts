export * from './lib/commands.js';
export * from './lib/config.js';
export * from './lib/github.js';
export * from './lib/utils.js';
export type {
    Repository,
    ConfigFile,
    ConfigFileSettings,
    VendorConfig,
    FileInputOutput,
    FilesArray,
    Lockfile,
    VendorLock,
    VendorLockFiles,
    VendorLockFile,
    VendorDependencies,
    VendorDependency,
    VendorsOptions,
} from './lib/types.d.ts';

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
