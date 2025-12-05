import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import getEnvPaths from 'env-paths';
import _fetch, { type FetchOptions } from 'make-fetch-happen';
import { token } from './auth.js';
import type { Repository } from './types.js';
import { assert, error, warning } from './utils.js';

const envPaths = getEnvPaths('vendorfiles');
const fetch = _fetch.defaults({
    cachePath: envPaths.cache,
    //cache: 'default',
});

let _octokit: Octokit;
const octokit = () => {
    if (!_octokit) {
        if (!token) {
            warning(
                'You may be rate limited, run `vendor login` or use a GITHUB_TOKEN env variable',
            );
        }

        _octokit = new Octokit({
            auth: token,
        });
    }
    return _octokit;
};

const releases = new Map<
    string,
    RestEndpointMethodTypes['repos']['getReleaseByTag']['response']['data']
>();
async function getReleaseFromTag({
    owner,
    name,
    tag,
}: Repository & { tag: string }) {
    const repo = `${owner}/${name}`;
    const key = `${repo}/${tag}`;
    for (const [k, release] of releases) {
        if (k === key || (k.startsWith(repo) && release.tag_name === tag)) {
            return release;
        }
    }

    const res = await octokit().repos.getReleaseByTag({
        owner,
        repo: name,
        tag,
    });
    releases.set(key, res.data);

    return res.data;
}

export async function getLatestRelease(
    { owner, name: repo }: Repository,
    releaseRegex?: string,
) {
    if (releaseRegex) {
        return getReleaseByRegex({ owner, name: repo }, releaseRegex);
    }
    const key = `${owner}/${repo}/latest`;

    const cached = releases.get(key);
    if (cached !== undefined) return cached;

    const res = await octokit().repos.getLatestRelease({
        owner,
        repo,
    });

    releases.set(key, res.data);
    return res.data;
}

export async function getReleaseByRegex(
    { owner, name: repo }: Repository,
    releaseRegex: string,
) {
    const key = `${owner}/${repo}/regex/${releaseRegex}`;

    const cached = releases.get(key);
    if (cached !== undefined) return cached;

    const releasesList = await octokit().repos.listReleases({
        owner,
        repo,
        per_page: 100,
    });

    const releaseRegexObj = new RegExp(releaseRegex);
    const matchedRelease = releasesList.data.find(
        release =>
            releaseRegexObj.test(release.tag_name) ||
            releaseRegexObj.test(release.name || ''),
    );
    if (matchedRelease) {
        releases.set(key, matchedRelease);
        return matchedRelease;
    }

    throw `No releases found matching ${releaseRegex.toString()} in ${owner}/${repo}`;
}

export async function getFileCommitSha({
    repo,
    path,
}: {
    repo: Repository;
    path: string;
}) {
    const commit = await octokit().repos.listCommits({
        owner: repo.owner,
        repo: repo.name,
        path,
        per_page: 1,
    });
    if (!commit.data?.[0]?.sha) {
        error(`No commits found for ${repo.owner}/${repo.name}: ${path}`);
    }
    return commit.data[0].sha;
}

export async function getFile({
    repo,
    path,
    ref,
}: {
    repo: Repository;
    path: string;
    ref: string | undefined;
}) {
    ref = ref || undefined;
    const requestOptions = octokit().repos.getContent.endpoint({
        owner: repo.owner,
        repo: repo.name,
        path,
        Authorization: token ? `bearer ${token}` : undefined,
        mediaType: {
            format: 'raw',
        },
        ref,
    });

    const req = await fetch(requestOptions.url, requestOptions as FetchOptions);

    if (!(req.ok && req.body)) {
        throw `Request failed with status ${req.status}`;
    }

    return req.body;
}

export async function downloadReleaseFile({
    repo,
    path,
    version,
    releaseRegex,
}: {
    repo: Repository;
    path: string;
    version: string;
    releaseRegex?: string;
}) {
    const release = await (version
        ? getReleaseFromTag({ ...repo, tag: version })
        : getLatestRelease(repo, releaseRegex));

    assert(
        !!release,
        `Release "${version}" was not found in ${repo.owner}/${repo.name}`,
    );

    assert(!!release.assets, `Release assets were not found in ${release.url}`);

    const asset_id = release.assets.find(
        (asset: { name: string }) => asset.name === path,
    )?.id;

    assert(
        !!asset_id,
        `Release asset "${path}" was not found in ${release.url}\nDid you forget to add a "v" before the version?`,
    );

    const requestOptions = octokit().request.endpoint(
        'GET /repos/:owner/:repo/releases/assets/:asset_id',
        {
            headers: {
                Accept: 'application/octet-stream',
            },
            Authorization: token ? `bearer ${token}` : undefined,
            owner: repo.owner,
            repo: repo.name,
            asset_id,
        },
    );

    const req = await fetch(requestOptions.url, requestOptions as FetchOptions);

    assert(
        !!req.ok && !!req.body,
        `Release asset "${path}" failed to download from ${release.url}`,
    );

    return req.body;
}

export async function findRepoUrl(name: string) {
    const res = await octokit().search.repos({
        q: name,
        per_page: 1,
    });

    const item = res.data.items[0];

    assert(!!item, `No results found for "${name}"`);

    assert(
        item.name.toLowerCase() === name.toLowerCase(),
        `No results found for "${name}"\nDid you mean ${item.name}?`,
    );

    return item.html_url;
}

export default {
    getFile,
    getFileCommitSha,
    getLatestRelease,
    downloadReleaseFile,
    findRepoUrl,
};
