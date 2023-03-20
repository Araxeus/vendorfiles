// import { getConfig } from './lib/config.js';
// import { sync } from './lib/commands.js';
import { trimStartMatches, error } from './lib/utils.js';

// const config = await getConfig();

const arg = trimStartMatches(process.argv.slice(2).at(-1), '-').toLowerCase();

// const shouldUpdate =
//     arg === 'update' ||
//     arg === 'upgrade' ||
//     arg === 'u' ||
//     arg === 'up' ||
//     arg === 'reup';

// await sync(config, shouldUpdate);

import { Octokit } from '@octokit/rest';

// no point trying to "hack it", this token has no permissions at all and is used only to circumvent the rate limit
const NO_PERMISSIONS_ACCESS_TOKEN = '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';

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || NO_PERMISSIONS_ACCESS_TOKEN,
});

const query = arg || 'react';

const res = await octokit.search.repos({
    q: query,
    per_page: 1,
});

const item = res.data.items[0];

if (!item) {
    console.log(`No results found for "${query}"`);
    process.exit(0);
}

if (item.name.toLowerCase() !== query.toLowerCase()) {
    error(`No results found for "${query}"\nDid you mean ${item.name}?`);
}

async function findRepo(name: string) {
    const res = await octokit.search.repos({
        q: name,
        per_page: 1,
    });

    const item = res.data.items[0];

    if (!item) {
        error(`No results found for "${name}"`);
    }

    if (item.name.toLowerCase() !== name.toLowerCase()) {
        error(`No results found for "${name}"\nDid you mean ${item.name}?`);
    }

    return item.html_url;
}
