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

// TODO:

// Soon™:
// > add a --config option to specify a folder where to look for the config file
// > complete release-notes.ts
// > add github actions
// > "outdated" command
// > "list" command

// Later:
// > "dry run" mode
// > some kind of cache
// > Nice documentation website
// > add spinners
// > add tests (also test package as imported + installed globally)
// > add support for glob patterns
// > add support for other providers like npm / git (gitlab, bitbucket, etc.)
