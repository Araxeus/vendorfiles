import { Octokit } from '@octokit/rest';
import { error, warning } from './utils.js';
import * as dotenv from 'dotenv';
dotenv.config();
if (!process.env.GITHUB_TOKEN)
    warning('GITHUB_TOKEN env variable was not found, you may be rate limited');
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
});
// TODO add support for other git providers
export async function getFile({ repo, path, ref, }) {
    return octokit.repos
        .getContent({
        owner: repo.owner,
        repo: repo.name,
        path,
        mediaType: {
            format: 'raw',
        },
        ref,
    })
        .then(({ data }) => data);
}
export async function getLatestRelease({ owner, name: repo }) {
    return octokit.repos
        .getLatestRelease({
        owner,
        repo,
    })
        .then(({ data }) => data);
}
export async function findRepoUrl(name) {
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
export default {
    getFile,
    getLatestRelease,
    findRepo: findRepoUrl,
};
