export * from './lib/commands.js';
export * from './lib/config.js';
export * from './lib/github.js';
export * from './lib/types.js';
export * from './lib/utils.js';

// TODO: complete release-notes.ts

// TODO: add tests (also test package as imported + installed globally)
// TODO: add spinners
// TODO: add docs
// TODO: add examples
// TODO: add github actions

// TODO? add multiple config locations (cosmiconfig)

// TODO? replace {version} in file output with version.trimStartMatch('v')
// TODO document that {version} is trimmed of leading 'v'
// TODO  document that  "vendorFolder": "{vendorFolder}/my-custom-folder-name" is allowed

// TODO? allow install from release assets (need to be able to unzip, tar, etc.)
/*
Either:

files: [
    readme.md,
    {release}/myapp-{version}.exe
]

Or:

files: [
    readme.md,
    {
        LICENSE: MYAPP_LICENSE,
        {release}/myapp-{version}.exe: myapp.exe
    }
]

Or if we want to extract files from archive:

files: [
    readme.md,
    {
        LICENSE: MYAPP_LICENSE,
        {release}/myapp-{version}.zip: [ myapp.exe, myapp.dll ]
    }
]

files: [
    readme.md,
    {
        LICENSE: MYAPP_LICENSE,
        {release}/myapp-{version}.zip: {
            myapp-{version}.exe: myapp.exe,
            myapp.dll: myapp.dll
        }
    }
]

*/

// TODO? add support for glob patterns
// TODO? add support for other git providers (gitlab, bitbucket, etc.)
