import { getConfig } from './lib/config.js';
import { sync } from './lib/commands.js';
import { trimStartMatches } from './lib/utils.js';

const config = await getConfig();

//console.log(config);

// get first arg
const arg = trimStartMatches(process.argv.at(-1), '-').toLowerCase();

const shouldUpdate =
  arg === 'update' ||
  arg === 'upgrade' ||
  arg === 'u' ||
  arg === 'up' ||
  arg === 'reup';

await sync(config, shouldUpdate);
