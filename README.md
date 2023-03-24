# vendorfiles

[![NPM Version](https://img.shields.io/npm/v/vendorfiles)](https://www.npmjs.com/package/vendorfiles)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Araxeus/vendorfiles/blob/main/LICENSE)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/Araxeus/vendorfiles)

`vendorfiles` is a tool that simplifies the management of vendor files in your project.

## Installation

### Global

```bash
npm install -g vendorfiles
```

### Local

```bash
npm install vendorfiles
```

## Configuration

In your package.json file, you can define your vendor files under the `vendorDependencies` key.

you can then run `vendor sync` to sync your vendor files with the config file.

```json
{
    "vendorDependencies": {
        "Cooltipz": {
            "version": "v2.2.0",
            "repository": "https://github.com/jackdomleo7/Cooltipz.css",
            "files": ["cooltipz.min.css", "LICENSE"]
        },
        "Coloris": {
            "version": "v0.17.1",
            "repository": "https://github.com/mdbassit/Coloris",
            "files": ["dist/coloris.min.js", "dist/coloris.min.css", "LICENSE"]
        }
    }
}
```

The vendor directory defaults to the `vendor` folder in your project root. You can change this by defining a `vendorFolder` key in the `vendorConfig` object.

```json
"vendorConfig": {
   "vendorFolder": "./my-vendors"
},
```

You can also define a `vendorFolder` key in the `vendorDependencies` object to change the folder where the files will be installed. if not defined it will default to the name of the dependency.

this key can use the `{vendorfolder}` placeholder to refer to the vendor folder defined in the `vendorConfig` object.

```json
{
    "vendorConfig": {
      "vendorFolder": "./my-vendors"
    },
    "vendorDependencies": {
        "Cooltipz": {
            "version": "v2.2.0",
            "repository": "https://github.com/jackdomleo7/Cooltipz.css",
            "files": ["cooltipz.min.css", "LICENSE"],
            "vendorFolder": "{vendorFolder}/Cooltipz" // this will output the files in ./my-vendors/Cooltipz
        },
        "Coloris": {
            "version": "v0.17.1",
            "repository": "https://github.com/mdbassit/Coloris",
            "files": ["dist/coloris.min.js", "dist/coloris.min.css", "LICENSE"],
            "vendorFolder": "{vendorFolder}" // this will output the files inside ./my-vendors/
        }
    }
}
```

if you want to rename/move the files, you can use an object with the source file as key and the destination file as value.

```json
{
    "vendorDependencies": {
        "Cooltipz": {
            "version": "v2.2.0",
            "repository": "https://github.com/mdbassit/Coloris",
            "files": [
                "dist/coloris.min.js",
                "dist/coloris.min.css",
                {
                    "LICENSE": "../licenses/COLORIS_LICENSE"
                }
            ]
        }
    }
}
```

if you want to download release assets from a GitHub repository you can use the `{release}/` placeholder in the file path.

then you can also use the `{version}` placeholder to refer to the version of the dependency. (trailing <kbd>v</kbd> is removed)
  
```json
{
    "vendorDependencies": {
        "fzf": {
            "version": "0.38.0",
            "repository": "https://github.com/junegunn/fzf",
            "files": [
                "LICENSE",
                "{release}/fzf-{version}-linux_amd64.tar.gz ",
                {
                    "{release}/fzf-{version}-windows_amd64.zip": "fzf-windows.zip"
                }
            ]
        }
    }
}
```

if you want to extract files from a compressed archive, you can specify an object with the archive path as key and the files to extract as value. here's an example:

```json
{
    "vendorDependencies": {
        "fzf": {
            "version": "0.38.0",
            "repository": "https://github.com/junegunn/fzf",
            "files": [
                "LICENSE",
                {
                    "{release}/fzf-{version}-linux_amd64.tar.gz": [ "fzf" ],
                    "{release}/fzf-{version}-windows_amd64.tar.gz": {
                        "fzf.exe": "my-custom-fzf.exe"
                    }
                }
            ]
        }
    }
}
```

## Commands

vendorfiles provides various commands for managing your vendor files.

### Supported Commands and Options

```text
Usage: vendor command [options]

Options:
  -v, --version                               output the current version
  -c, --ci                                    CI mode (default: false)
  -h, --help                                  display help for command

Commands:
  sync|s [options]                            Sync config file
  update|upgrade [names...]                   Update dependencies
  install|add [options] <url/name> [version]  Install a dependency
  uninstall|remove [names...]                 Uninstall dependencies
  help [command]                              display help for command
```

### Sync

```text
Usage: vendor sync|s [options]

Sync all dependencies in the config file

Options:
  -f, --force  Force sync
  -h, --help   display help for command

Examples:
    vendor sync
    vendor sync -f
```

### Update

```text
Usage: vendor update|upgrade [options] [names...]

Update all/selected dependencies to their latest version (from GitHub Releases))

Options:
  -h, --help  display help for command

Examples:
    vendor update
    vendor update React
    vendor update React Express
```

### Install

```text
Usage: vendor install|add [options] <url/name> [version]

Install a dependency. origin can be a GitHub repo URL or owner/repo format or name of repo to search for.
Files have to be provided with -f or --files <files...>

Arguments:
  url/name                GitHub repo URL or owner/repo format or name of repo to search for
  version                 Version to install

Options:
  -n, --name [name]       Name to write in dependencies
  -f, --files <files...>  Files to install
  -h, --help              display help for command

Examples:
  vendor install React -n MyReact -f README.md
  vendor install Araxeus/vendorfiles v1.0.0 -f README.md LICENSE
  vendor install https://github.com/th-ch/youtube-music -f "{release}/YouTube-Music-{version}.exe"
```

### Uninstall

```text
Usage: vendor uninstall|remove [options] [names...]

Uninstall all/selected dependencies

Arguments:
  names       Package names to uninstall

Options:
  -h, --help  display help for command

Examples:
    vendor uninstall React
    vendor uninstall React youtube-music
```
