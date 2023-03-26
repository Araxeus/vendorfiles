import type { Repository } from './types.js';
import type { ReadableStream } from 'stream/web';

import { assert, warning } from './utils.js';

import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.GITHUB_TOKEN)
    warning('GITHUB_TOKEN env variable was not found, you may be rate limited');

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
});

const releases = new Map();
async function getReleaseFromTag({
    owner,
    name,
    tag,
}: Repository & { tag: string }) {
    const key = `${owner}/${name}/${tag}`;
    if (releases.has(key)) {
        return releases.get(key);
    }
    const res = await octokit.repos.getReleaseByTag({
        owner,
        repo: name,
        tag,
    });
    releases.set(key, res.data);

    return res.data;
}

export async function getLatestRelease({ owner, name: repo }: Repository) {
    const key = `${owner}/${repo}/latest`;
    if (releases.has(key)) {
        return releases.get(key);
    }
    const res = await octokit.repos.getLatestRelease({
        owner,
        repo,
    });

    releases.set(key, res.data);
    return res.data;
}

export async function getFile({
    repo,
    path,
    ref,
}: {
    repo: Repository;
    path: string;
    ref: string;
}): Promise<ReadableStream<Uint8Array>> {
    const requestOptions = octokit.repos.getContent.endpoint({
        owner: repo.owner,
        repo: repo.name,
        path,
        Authorization: process.env.GITHUB_TOKEN
            ? `token ${process.env.GITHUB_TOKEN}`
            : undefined,
        mediaType: {
            format: 'raw',
        },
        ref,
    });

    // @ts-expect-error octokit type for requestOptions clashes with fetch
    const req = await fetch(requestOptions.url, requestOptions);

    if (!(req.ok && req.body)) {
        throw 'Request failed';
    }

    return req.body as ReadableStream<Uint8Array>;
}

export async function downloadReleaseFile({
    repo,
    path,
    version,
}: {
    repo: Repository;
    path: string;
    version: string;
}): Promise<ReadableStream<Uint8Array>> {
    const release = await (version
        ? getReleaseFromTag({ ...repo, tag: version })
        : getLatestRelease(repo));

    assert(!!release, `Release "${version}" was not found in ${release.url}`);

    assert(release.assets, `Release assets were not found in ${release.url}`);

    const asset_id = release.assets.find(
        (asset: { name: string }) => asset.name === path,
    )?.id;

    assert(
        !!asset_id,
        `Release asset "${path}" was not found in ${release.url}`,
    );

    const requestOptions = octokit.request.endpoint(
        'GET /repos/:owner/:repo/releases/assets/:asset_id',
        {
            headers: {
                Accept: 'application/octet-stream',
            },
            Authorization: process.env.GITHUB_TOKEN
                ? `token ${process.env.GITHUB_TOKEN}`
                : undefined,
            owner: repo.owner,
            repo: repo.name,
            asset_id,
        },
    );

    // @ts-expect-error octokit type for requestOptions clashes with fetch
    const req = await fetch(requestOptions.url, requestOptions);

    assert(
        !!req.ok && !!req.body,
        `Release asset "${path}" failed to download from ${release.url}`,
    );

    return req.body as ReadableStream<Uint8Array>;
}

export async function findRepoUrl(name: string) {
    const res = await octokit.search.repos({
        q: name,
        per_page: 1,
    });

    const item = res.data.items[0];

    assert(!!item, `No results found for "${name}"`);

    assert(
        item.name.toLowerCase() === name.toLowerCase(),
        `No results found for "${name}"\nDid you mean ${item.name}?`,
    )

    return item.html_url;
}

export default {
    getFile,
    getLatestRelease,
    downloadReleaseFile,
    findRepoUrl,
};
