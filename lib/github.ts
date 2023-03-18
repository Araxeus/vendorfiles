import { Repository } from './types.js';

import { Octokit } from '@octokit/rest';
const octokit = new Octokit();


// TODO use GITHUB_TOKEN env variable

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
