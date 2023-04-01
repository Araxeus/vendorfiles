import type { Repository } from './types.js';

import { assert, warning, success, error } from './utils.js';

import { Octokit } from '@octokit/rest';
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import { g, s } from './auth.js';
import open from 'open';
import * as dotenv from 'dotenv';
import getEnvPaths from 'env-paths';
import _fetch from 'make-fetch-happen';

const envPaths = getEnvPaths('vendorfiles');
const fetch = _fetch.defaults({
    cachePath: envPaths.cache,
    //cache: 'default',
});

dotenv.config();
const token = g();

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
    const res = await octokit().repos.getReleaseByTag({
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
    const res = await octokit().repos.getLatestRelease({
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
}) {
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

    // @ts-expect-error - make-fetch-happen types are either wrong or bugged on my end
    const req = await fetch(requestOptions.url, requestOptions);

    if (!(req.ok && req.body)) {
        throw 'Request failed';
    }

    return req.body;
}

export async function downloadReleaseFile({
    repo,
    path,
    version,
}: {
    repo: Repository;
    path: string;
    version: string;
}) {
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

    // @ts-expect-error - make-fetch-happen types are either wrong or bugged on my end
    const req = await fetch(requestOptions.url, requestOptions);

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

export async function login(token?: string) {
    if (token) {
        const res = await fetch('https://api.github.com', {
            cache: 'no-store',
            method: 'HEAD',
            headers: {
                Authorization: `bearer ${token}`,
            },
        });

        assert(res.status !== 401, 'Invalid token');
        assert(res.status !== 403, 'Token is rate limited');
        assert(res.ok, 'Something went wrong, try again later');
        await s(token);
        success('Token saved successfully');
        return;
    }
    try {
        const auth = createOAuthDeviceAuth({
            clientType: 'oauth-app',
            clientId: '39d3104ecbbfd876dfa5',
            scopes: [],
            async onVerification(verification) {
                console.log(
                    `First, copy your one-time code: ${verification.user_code}`,
                );
                console.log(
                    'Then press [Enter] to continue in your web browser',
                );
                await new Promise((resolve) => {
                    process.stdin.once('data', resolve);
                });
                console.log('Opening your web browser...');
                await open(verification.verification_uri);
            },
        });

        const tokenAuthentication = await auth({
            type: 'oauth',
        });

        await s(tokenAuthentication.token);

        success('Logged in successfully');
    } catch (e) {
        error(e as string);
    } finally {
        process.exit(0);
    }
}

export default {
    login,
    getFile,
    getLatestRelease,
    downloadReleaseFile,
    findRepoUrl,
};
