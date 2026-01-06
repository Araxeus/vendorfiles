import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { select } from '@inquirer/prompts';
import { $ } from 'bun';
import detectIndent from 'detect-indent';
import semver from 'semver';

const PKG = resolve(import.meta.dir, '..');
$.cwd(PKG);

// check that git working directory is clean
const gitStatus = await $`git status --porcelain`.text();
if (gitStatus !== '') {
    console.error(
        'Git working directory is not clean. Please commit changes before bumping version.',
    );
    process.exit(1);
}

const pkgJsonPath = resolve(PKG, 'package.json');
const raw = await readFile(pkgJsonPath, 'utf-8');
const indent = detectIndent(raw).indent || 2;
const pkgJson = JSON.parse(raw);

const versions = {
    patch: semver.inc(pkgJson.version, 'patch'),
    minor: semver.inc(pkgJson.version, 'minor'),
    major: semver.inc(pkgJson.version, 'major'),
};
const bumpType = (await select({
    message: `current: ${pkgJson.version} bump to:`,
    choices: [
        {
            name: `Patch - (${versions.patch})`,
            value: 'patch',
            description: 'x.y.Z',
        },
        {
            name: `Minor - (${versions.minor})`,
            value: 'minor',
            description: 'x.Y.z',
        },
        {
            name: `Major - (${versions.major})`,
            value: 'major',
            description: 'X.y.z',
        },
    ],
}).catch(() => process.exit(1))) as keyof typeof versions;

const newVersion = versions[bumpType];
if (!newVersion) {
    console.error('Failed to increment version.');
    process.exit(1);
}

pkgJson.version = newVersion;
await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, indent), 'utf-8');
console.log(`Updated package.json to version ${newVersion}`);

await $`bun format`.quiet();

await $`git add .`;
await $`git commit -m "v${newVersion}"`;
await $`git tag v${newVersion}`;

console.log(`Committed and tagged version v${newVersion} successfully.
run 'git push origin main && git push --tags origin main' to push changes.`);
