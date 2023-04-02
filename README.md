# Vendorfiles <!-- omit from toc -->

[![NPM Version](https://img.shields.io/npm/v/vendorfiles)](https://www.npmjs.com/package/vendorfiles)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Araxeus/vendorfiles/blob/main/LICENSE)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/Araxeus/vendorfiles)

Welcome to Vendorfiles, the package manager that streamlines the process of installing and updating files from a GitHub repository, while also providing version control.

Whether you need to manage CSS, JavaScript, images, binaries, or any other type of file, Vendorfiles makes it easy to keep your dependencies up-to-date and organized.

But that's not all - Vendorfiles is not limited to managing text files - it can also be used to install applications. By creating a vendorfile configuration inside a folder in your `$env.path`, and adding a repository such as fzf, you can specify the binary file you need from the zipped release asset. With this setup, it's easy to install, update, or delete the application and enjoy all the benefits of version control.

## Table of Contents <!-- omit from toc -->

- [Installation](#installation)
- [Configuration](#configuration)
  - [GitHub Releases](#github-releases)
- [Commands](#commands)
  - [Sync](#sync)
  - [Update](#update)
  - [Outdated](#outdated)
  - [Install](#install)
  - [Uninstall](#uninstall)
  - [Login](#login)
- [GitHub Action](#github-action)

## Installation

Global

```bash
npm install -g vendorfiles
```

Local

```bash
npm install vendorfiles
```

## Configuration

Vendorfiles will look for a configuration file in the following order:

1. vendor.toml
2. vendor.yml
3. vendor.yaml
4. vendor.json
5. package.json

To sync your vendor files with the config file, simply define your vendor files under the `vendorDependencies` key in your config file and run the command `vendor sync`.

The following examples are in JSON format, but you can also use TOML or YAML. For more examples, see [the examples folder](./examples/)

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

By default, Vendorfiles will create a directory named `vendor` in your project root.

You can change this by defining a `vendorFolder` key in a `vendorConfig` object:

```json
"vendorConfig": {
   "vendorFolder": "./my-vendors"
},
```

You can also define a `vendorFolder` key in each dependency to change the folder where its files will be installed. if this key is not defined, the folder will default to the dependency's name.

This key can use the `{vendorfolder}` placeholder to refer to the vendor folder defined in the `vendorConfig` object.

```json5
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

To rename or move files, you can specify an object with the source file as the key and the destination file as the value, as shown in the example below:

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

### GitHub Releases

You can download release assets by using the `{release}/` placeholder in the file path.

Additionally, you can use the `{version}` placeholder to refer to the version of the dependency, without the trailing `v`. Here's an example:

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

To extract files from a compressed release archive, you can define an object that specifies the archive path as the key and the files to extract as the value. Here's an example:

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
                    "{release}/fzf-{version}-windows_amd64.zip": {
                        "fzf.exe": "my-custom-fzf.exe"
                    }
                }
            ]
        }
    }
}
```

## Commands

```text
Usage: vendor command [options]

Commands:
  sync|s [options]                            Sync config file
  update|upgrade [names...]                   Update outdated dependencies
  outdated|o                                  List outdated dependencies
  install|add [options] <url/name> [version]  Install a dependency
  uninstall|remove [names...]                 Uninstall dependencies
  login|auth [token]                          Login to GitHub
  help [command]                              display help for command

Options:
  -dir, --folder [folder]                     Folder containing the config file
  -v, --version                               output the current version
  -h, --help                                  display help for command
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

Update all/selected dependencies to their latest version (the tag of the latest release)

Options:
  -pr|--pr    Output pull request text for gh action (default: false)
  -h, --help  display help for command

Examples:
    vendor update
    vendor bump React
    vendor update React Express
```

### Outdated

```text
Usage: vendor outdated|o [options]

List outdated dependencies

Options:
  -h, --help  display help for command

Examples:
    vendor outdated
    vendor o
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
    vendor add Araxeus/vendorfiles v1.0.0 -f README.md LICENSE
    vendor i https://github.com/th-ch/youtube-music -f "{release}/YouTube-Music-{version}.exe"
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
    vendor remove React youtube-music
```

### Login

```text
Usage: vendor login|auth [options] [token]

Login to GitHub to increase rate limit

Arguments:
  token       GitHub token (leave empty to login via browser)

Options:
  -h, --help  display help for command

Examples:
    vendor login
    vendor auth <token>
```

## GitHub Action

You can use the [vendorfiles-action](https://github.com/marketplace/actions/vendorfiles-updater) to automatically update your dependencies.

```yaml
- uses: Araxeus/vendorfiles-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    package-manager: yarn
```

More information can be found in the [action's readme](https://github.com/Araxeus/vendorfiles-action#readme).
