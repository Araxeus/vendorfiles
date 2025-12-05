import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve(import.meta.dir, '..', 'dist');

if (import.meta.main) {
    await rm(dist, { recursive: true, force: true });
    console.log(`Deleted ${dist}`);
}
