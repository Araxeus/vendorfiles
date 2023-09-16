// import { getConfig } from './lib/config.js';
// import { sync } from './lib/commands.js';
// const config = await getConfig();

import { trimStartMatches, error, info } from './lib/utils.js';

const args = process.argv
    .slice(2)
    .map((arg) => trimStartMatches(arg.toLowerCase(), '-'));

import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
});

switch (args[0]) {
    case 'search':
        await search(args[1]);
        break;
    default:
        info('Usage: test search [query]');
}

function maybe(name: string, value?: string | null) {
    return value ? { [name]: value } : {};
}

async function search(query: string) {
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

    const result = {
        name: item.full_name,
        owner: item.owner?.login,
        url: item.html_url,
        ...maybe('description', item.description),
        stars: item.stargazers_count,
        language: item.language,
        ...maybe('license', item.license?.name),
        ...maybe('homepage', item.homepage),
    };

    console.log(result);
}
