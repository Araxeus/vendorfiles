// Build standalone executables for multiple platforms using Bun's build system.
// Usage: bun build-executables.ts [target1 target2 ...]
//
import { resolve, sep } from 'node:path';

let targets = [
    'linux-x64',
    'linux-arm64',
    'windows-x64',
    'darwin-x64',
    'darwin-arm64',
    'linux-x64-musl',
    'linux-arm64-musl',
];

const onlyTargets = process.argv.slice(2);
if (onlyTargets.length > 0) {
    onlyTargets.forEach(target => {
        if (!targets.includes(target)) {
            console.error(`Unknown target: ${target}`);
            process.exit(1);
        }
    });
    targets = onlyTargets;
}

for (const _target of targets) {
    const target = `bun-${_target}-modern` as Bun.Build.Target;
    const outdir = resolve(import.meta.dir, '..', 'bin', _target);
    await Bun.build({
        entrypoints: [resolve(import.meta.dir, '..', 'cli.ts')],
        compile: {
            outfile: 'vendor',
            target,
        },
        outdir,
        minify: true,
        sourcemap: true,
    });
    const ext = _target.startsWith('windows') ? '.exe' : '';
    console.log(`Built ${outdir}${sep}vendor${ext}`);
}
