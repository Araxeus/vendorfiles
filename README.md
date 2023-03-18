# vendorfiles

This is a simple tool to help you manage your vendor files.

## Installation

### Global

```bash
npm install -g vendorfiles
```

### Local

```bash
npm install vendorfiles
```

## Usage

You define vendor files package.json under the `vendorDependencies` key.

```json
{
"vendorDependencies": {
    "Cooltipz": {
      "name": "Cooltipz.css",
      "version": "v2.2.0",
      "repository": "https://github.com/jackdomleo7/Cooltipz.css",
      "files": [
        "cooltipz.min.css",
        "LICENSE"
      ]
    },
    "Coloris": {
      "version": "v0.17.1",
      "repository": "https://github.com/mdbassit/Coloris",
      "files": [
        "dist/coloris.min.js",
        "dist/coloris.min.css",
        "LICENSE"
      ]
    }
  }
}
```
