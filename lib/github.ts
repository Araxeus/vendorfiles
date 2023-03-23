import { Repository } from './types.js';

import { Octokit } from '@octokit/rest';
import { error, trimStartMatches, warning } from './utils.js';

import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.GITHUB_TOKEN)
    warning('GITHUB_TOKEN env variable was not found, you may be rate limited');

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
});

export async function getFile({
    repo,
    path,
    ref,
}: {
    repo: Repository;
    path: string;
    ref: string;
}) {
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
        .then((res) => {
            //console.log(res.data);
            return res.data;
        });
}

export async function findRepoUrl(name: string) {
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

export async function downloadReleaseFile({
    repo,
    path,
    version,
    savePath,
}: { repo: Repository; path: string; version: string, savePath: string }) {
    const release = await (version
        ? getReleaseFromTag({ ...repo, tag: version })
        : getLatestRelease(repo));

    if (!release) {
        error(`Release "${version}" was not found in ${release.url}`);
    }

    const asset_id = release.assets.find(
        (asset: { name: string }) => asset.name === path,
    )?.id;

    if (!asset_id) {
        error(`Release asset "${path}" was not found in ${release.url}`);
    }

    const asset = await octokit.repos
        .getReleaseAsset({
            owner: repo.owner,
            repo: repo.name,
            asset_id,
            mediaType: {
                format: 'raw',
            },
        })
        .then((res) => res.data)
        .catch((err) => {
            if (err.status === 404) {
                error(`Got 404 error when trying to download release asset "${path}" from ${release.url}`);
            }
        });

    if (!asset) {
        error(`Release asset "${path}" failed to download from ${release.url}`);
    }

    // console.log({
    //     asset_id,
    //     node_id: asset.node_id,
    // });

    const requestOptions = octokit.request.endpoint(
        'GET /repos/:owner/:repo/releases/assets/:asset_id',
        {
            headers: {
                Accept: 'application/octet-stream',
            },
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
            owner: repo.owner,
            repo: repo.name,
            asset_id,
        },
    );

    // @ts-expect-error
    const req = await fetch(requestOptions.url, requestOptions);
    // console.log({
    //     req,
    // })
    if (!(req.ok && req.body)) {
        error(`Release asset "${path}" failed to download from ${release.url}`);
    }

    return req.body;
}

export default {
    getFile,
    getLatestRelease,
    downloadReleaseFile,
    findRepoUrl,
};
