import { STORAGE_KEYS } from '../utils/constants.utils.js';
import { GitHubService } from './github.service.js';
import { IssueStorageService } from './issue-storage.service.js';
import { PinnedReposService } from './pinned-repos.service.js';
import { StorageService } from './storage.service.js';

/**
 * Build a title map from local issues and tracked entries,
 * then fill missing titles from the GitHub API.
 *
 * @param {Array} allUsersData - Items returned by GitHubService.fetchAllUsersData
 * @param {import('../utils/schema.utils.js').TrackedTimeEntry[]} tracked - Local tracked entries
 * @returns {Promise<Record<string, string>>} issueUrl → display title
 */
async function buildTitleMap(allUsersData, tracked) {
    const issues = await IssueStorageService.getAll();
    /** @type {Record<string, string>} */
    const titleMap = {};
    for (const issue of issues) {
        titleMap[issue.url] = issue.title;
    }
    for (const entry of tracked) {
        if (!titleMap[entry.issueUrl]) titleMap[entry.issueUrl] = entry.title;
    }

    const missingUrls = new Set();
    for (const item of allUsersData) {
        if (!titleMap[item.issueUrl]) missingUrls.add(item.issueUrl);
    }

    if (missingUrls.size > 0) {
        const repoSet = new Set();
        for (const url of missingUrls) {
            const { owner, repo } = GitHubService.parseIssueUrl(url);
            repoSet.add(`${owner}/${repo}`);
        }
        for (const fullRepo of repoSet) {
            const [owner, repoName] = fullRepo.split('/');
            try {
                const repoIssues = await GitHubService.getRepoIssues(owner, repoName);
                for (const issue of repoIssues) {
                    const key = `/${owner}/${repoName}/issues/${issue.number}`;
                    if (!titleMap[key]) {
                        titleMap[key] = `(${owner}) ${repoName} | ${issue.title} | #${issue.number}`;
                    }
                }
            } catch (e) {
                console.error(`Failed to fetch issues for ${fullRepo}:`, e);
            }
        }
    }

    return titleMap;
}

/**
 * Fetch everyone's tracked data from GitHub, flatten into entries,
 * cache the result, and merge the current user's remote entries into local storage.
 *
 * @param {string|null} username - Current user's GitHub login (null to skip merge)
 * @param {import('../utils/schema.utils.js').TrackedTimeEntry[]} tracked - Current local tracked entries
 * @returns {Promise<import('../utils/schema.utils.js').EveryoneDataEntry[]>} Flat list of everyone entries
 */
export async function fetchAndMergeEveryoneData(username, tracked) {
    const pinnedRepos = await PinnedReposService.getPinnedRepos();
    if (pinnedRepos.length === 0) return [];

    const allUsersData = await GitHubService.fetchAllUsersData(pinnedRepos);
    const titleMap = await buildTitleMap(allUsersData, tracked);

    const flatEntries = allUsersData.flatMap((item) =>
        item.entries.map((e) => ({
            issueUrl: item.issueUrl,
            title: titleMap[item.issueUrl] || `#${item.issueUrl.split('/').pop()}`,
            seconds: e.seconds,
            date: e.date,
            user: item.user,
        })),
    );

    await StorageService.set(STORAGE_KEYS.EVERYONE_DATA, flatEntries);

    // Merge current user's remote entries into local storage
    if (username) {
        const remoteMe = flatEntries.filter((e) => e.user === username);
        const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
        const localKeys = new Set(trackedTimes.map((e) => `${e.issueUrl}|${e.date}|${e.seconds}`));
        const newEntries = remoteMe.filter((e) => !localKeys.has(`${e.issueUrl}|${e.date}|${e.seconds}`));
        if (newEntries.length > 0) {
            trackedTimes.push(
                ...newEntries.map((e) => ({
                    issueUrl: e.issueUrl,
                    title: e.title,
                    seconds: e.seconds,
                    date: e.date,
                })),
            );
            await StorageService.set(STORAGE_KEYS.TRACKED_TIMES, trackedTimes);
        }
    }

    return flatEntries;
}
