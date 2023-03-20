import { Octokit } from '@octokit/rest';
const octokit = new Octokit();

import { assert } from './utils.js';

const fixture = {
    owner: 'Araxeus',
    repo: 'Youtube-Volume-Scroll',
};

const latestRelease = await getLatestRelease(fixture.owner, fixture.repo);

console.log({
    latestReleaseTag: latestRelease?.tag_name,
});

const allReleases = await getAllReleases(fixture.owner, fixture.repo);

// console.log({
//     allReleases
// }); process.exit(0); // DELETE

assert(allReleases instanceof Array, 'getAllReleases should return an array');

const changelogs: Record<string, string> = {};

allReleases.forEach((release) => {
    assert(
        release instanceof Object && !!release.tag_name && !!release.body,
        'getAllReleases should return a valid array of objects',
    );

    changelogs[release.tag_name] = release.body;
});

console.log(JSON.stringify(changelogs, null, 2));

//////////////////////////////////////////////////////////////////////

function getLatestRelease(owner: string, repo: string) {
    return octokit.repos
        .getLatestRelease({
            owner,
            repo,
        })
        .then(({ data }) => data);
}

function getAllReleases(owner: string, repo: string) {
    return octokit.repos
        .listReleases({
            owner,
            repo,
        })
        .then(({ data }) => data);
}

// function getRelease(owner, repo, tag) {
//     return octokit.repos.getReleaseByTag({
//         owner,
//         repo,
//         tag,
//     });
// }

// function getReleasesBetweenTags(owner, repo, from, to) {
//     return octokit.repos
//         .listReleases({
//             owner,
//             repo,
//             per_page: 100,
//         })
//         .then(({ data }) => {
//             const fromIndex = data.findIndex(
//                 (release) => release.tag_name === from,
//             );
//             const toIndex = data.findIndex(
//                 (release) => release.tag_name === to,
//             );
//             return data.slice(fromIndex, toIndex + 1);
//         });
// }
