import { Repository } from './types.js';

import { Octokit } from '@octokit/rest';

// no point trying to "hack it", this token has no permissions at all and is used only to circumvent the rate limit
const NO_PERMISSIONS_ACCESS_TOKEN = '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';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || NO_PERMISSIONS_ACCESS_TOKEN,
});

// TODO add support for other git providers

export async function getFile({
  repo,
  path,
  ref,
}: {
  repo: Repository;
  path: string;
  ref?: string;
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
    .then(({ data }) => data);
}

export async function getLatestRelease({ owner, name: repo }: Repository) {
  return octokit.repos
    .getLatestRelease({
      owner,
      repo,
    })
    .then(({ data }) => data);
}

export default {
  getFile,
  getLatestRelease,
};
