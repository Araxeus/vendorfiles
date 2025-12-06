# Vendorfiles <!-- omit from toc -->

[![NPM Version](https://img.shields.io/npm/v/vendorfiles)](https://www.npmjs.com/package/vendorfiles)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Araxeus/vendorfiles/blob/main/LICENSE)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/Araxeus/vendorfiles)

Vendorfiles lets you pull files from GitHub repositories and keep them up to date. Think of it like a package manager, but for individual files — CSS libraries, binaries, config files, whatever you need.

- Download files directly from any GitHub repo
- Grab release assets (including extracting from zip/tar archives)
- Track versions via releases or commit hashes
- Configure with TOML, YAML, JSON, or package.json
- Automate updates with the included GitHub Action

## Table of Contents <!-- omit from toc -->

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Basic Setup](#basic-setup)
  - [Custom Output Paths](#custom-output-paths)
  - [Renaming Files](#renaming-files)
  - [Commit-Based Versioning](#commit-based-versioning)
  - [GitHub Releases](#github-releases)
  - [Filtering Releases](#filtering-releases)
  - [Default Options](#default-options)
- [Commands](#commands)
  - [Sync](#sync)
  - [Update](#update)
  - [Outdated](#outdated)
  - [Install](#install)
  - [Uninstall](#uninstall)
  - [Login](#login)
- [GitHub Action](#github-action)

## Quick Start

1. Install vendorfiles:
   ```bash
   npm install -g vendorfiles
   ```

2. Create a `vendor.json` in your project:
   ```json
   {
       "vendorDependencies": {
           "Coloris": {
               "version": "v0.17.1",
               "repository": "https://github.com/mdbassit/Coloris",
               "files": ["dist/coloris.min.js", "dist/coloris.min.css"]
           }
       }
   }
   ```

3. Run:
   ```bash
   vendor sync
   ```

That's it! Your files are now in `./vendor/Coloris/`.

## Installation

**Global** (recommended for CLI usage):
```bash
npm install -g vendorfiles
```

**Local** (for project-specific usage):
```bash
npm install vendorfiles
```

## Configuration

Vendorfiles looks for a config file in this order: `vendor.toml`, `vendor.yml`, `vendor.yaml`, `vendor.json`, `package.json`.

All examples below are in JSON, but TOML and YAML work too. See the [examples folder](./examples/) for more formats.

### Basic Setup

Define your dependencies under `vendorDependencies`:

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

By default, files are saved to `./vendor/{dependency-name}/`.

### Custom Output Paths

Change the base vendor folder with `vendorConfig`:

```json
{
    "vendorConfig": {
        "vendorFolder": "./my-vendors"
    }
}
```

Each dependency can also specify its own output folder. Use `{vendorFolder}` to reference the base folder:

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
            "vendorFolder": "{vendorFolder}/Cooltipz" // outputs to ./my-vendors/Cooltipz
        },
        "Coloris": {
            "version": "v0.17.1",
            "repository": "https://github.com/mdbassit/Coloris",
            "files": ["dist/coloris.min.js", "dist/coloris.min.css", "LICENSE"],
            "vendorFolder": "{vendorFolder}" // outputs directly to ./my-vendors/
        }
    }
}
```

### Renaming Files

Use an object with `source: destination` to rename or move files:

```json
{
    "vendorDependencies": {
        "Coloris": {
            "version": "v0.17.1",
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

### Commit-Based Versioning

By default, versions track GitHub releases. If you need to track a specific file's changes instead, use `hashVersionFile`:

```json
{
    "vendorDependencies": {
        "Cooltipz": {
            "repository": "https://github.com/jackdomleo7/Cooltipz.css",
            "version": "f6ec482ea395cead4fd849c05df6edd8da284a52",
            "hashVersionFile": "package.json",
            "files": ["cooltipz.min.css", "package.json"]
        },
        "Coloris": {
            "repository": "https://github.com/mdbassit/Coloris",
            "version": "v0.17.1",
            "hashVersionFile": true,
            "files": ["dist/coloris.min.js"]
        }
    }
}
```

- **String value**: Track that specific file's latest commit hash
- **`true`**: Track the first file in the `files` array

In the example above, Cooltipz tracks `package.json`'s commits, while Coloris tracks `dist/coloris.min.js`.

### GitHub Releases

Download release assets using `{release}/` in the file path. Use `{version}` to insert the semver version (without `v` prefix or suffixes like `-alpha`):

```json
{
    "vendorDependencies": {
        "fzf": {
            "version": "0.38.0",
            "repository": "https://github.com/junegunn/fzf",
            "files": [
                "LICENSE",
                "{release}/fzf-{version}-linux_amd64.tar.gz",
                {
                    "{release}/fzf-{version}-windows_amd64.zip": "fzf-windows.zip"
                }
            ]
        }
    }
}
```

**Extracting from archives:**

You can extract specific files from zip/tar archives:

```json
{
    "vendorDependencies": {
        "fzf": {
            "version": "0.38.0",
            "repository": "https://github.com/junegunn/fzf",
            "files": [
                "LICENSE",
                {
                    "{release}/fzf-{version}-linux_amd64.tar.gz": ["fzf"],
                    "{release}/fzf-{version}-windows_amd64.zip": {
                        "fzf.exe": "my-custom-fzf.exe"
                    }
                }
            ]
        }
    }
}
```

### Filtering Releases

Use `releaseRegex` to control which releases are considered when finding the "latest" version. The regex is tested against release tags/names.

Common patterns:
- Semver only: `"^v\\d+\\.\\d+\\.\\d+$"`
- Exclude pre-releases: `"^v(?!.*-(?:alpha|beta)).*"`
- Match title containing "stable": `"stable"`

```json
{
    "vendorDependencies": {
        "fzf": {
            "version": "0.38.0",
            "repository": "https://github.com/junegunn/fzf",
            "releaseRegex": "^v\\d+\\.\\d+\\.\\d+$",
            "files": ["{release}/fzf-{version}-linux_amd64.tar.gz"]
        }
    }
}
```

> **Note:** Use double escaping (`\\d`) in JSON strings.

### Default Options

Use a `default` or `defaultVendorOptions` object to share options across all dependencies:

```yml
vendorConfig:
  vendorFolder: .
default:
  vendorFolder: "{vendorFolder}"
  repository: https://github.com/nushell/nu_scripts
  hashVersionFile: true
vendorDependencies:
  nu-winget-completions:
    files: custom-completions/winget/winget-completions.nu
    version: 912bea4588ba089aebe956349488e7f78e56061c
  nu-cargo-completions:
    files: custom-completions/cargo/cargo-completions.nu
    version: afde2592a6254be7c14ccac520cb608bd1adbaf9
```

Individual dependencies can override any default option.

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
  -c, --config [file/folder path]             Config file path / Folder containing the config file
  -v, --version                               output the current version
  -h, --help                                  display help for command
```

### Sync

Download and sync all dependencies defined in your config file.

```text
Usage: vendor sync|s [options]

Options:
  -f, --force  Force sync (re-download all files)
  -h, --help   display help for command

Examples:
    vendor sync
    vendor sync -f
```

### Update

Update dependencies to their latest version.

```text
Usage: vendor update|upgrade [options] [names...]

Options:
  -p|--pr     Output pull request text for gh action (default: false)
  -h, --help  display help for command

Examples:
    vendor update              # update all
    vendor update React        # update one
    vendor update React Express  # update specific ones
```

### Outdated

Check which dependencies have newer versions available and output a list.

```text
Usage: vendor outdated|o [options]

Options:
  -h, --help  display help for command

Examples:
    vendor outdated
    vendor o
```

### Install

Add a new dependency interactively.

```text
Usage: vendor install|add [options] <url/name> [version]

Arguments:
  url/name                GitHub repo URL, owner/repo, or name to search for
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

Remove dependencies from your config and delete their files.

```text
Usage: vendor uninstall|remove [options] [names...]

Arguments:
  names       Package names to uninstall

Options:
  -h, --help  display help for command

Examples:
    vendor uninstall React
    vendor remove React youtube-music
```

### Login

Authenticate with GitHub to increase API rate limits.

```text
Usage: vendor login|auth [options] [token]

Arguments:
  token       GitHub token (leave empty to login via browser)

Options:
  -h, --help  display help for command

Examples:
    vendor login          # opens browser for OAuth
    vendor auth <token>   # use existing token
```

## GitHub Action

Automate dependency updates with [vendorfiles-action](https://github.com/marketplace/actions/vendorfiles-updater):

```yaml
- uses: Araxeus/vendorfiles-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    package-manager: yarn
```

See the [action's readme](https://github.com/Araxeus/vendorfiles-action#readme) for more options.
