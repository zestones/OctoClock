import { STORAGE_KEYS } from '../utils/constants.utils.js';
import { TimeService } from '../utils/time.utils.js';
import { GitHubService } from './github.service.js';
import { GitHubStorageService } from './github-storage.service.js';
import { IssueStorageService } from './issue-storage.service.js';
import { StorageService } from './storage.service.js';

export class TimerService {
    /** @param {string} issueUrl @returns {Promise<number>} Total seconds */
    static async getTotalTimeForIssue(issueUrl) {
        /** @type {import('../utils/schema.utils.js').TrackedTimeEntry[]} */
        const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
        return trackedTimes
            .filter((entry) => entry.issueUrl === issueUrl)
            .reduce((total, entry) => total + (entry.seconds || 0), 0);
    }

    /** @param {string} issueUrl @param {string|null} [issueTitle] @returns {Promise<import('../utils/schema.utils.js').TimerResult>} */
    static async startTimer(issueUrl, issueTitle = null) {
        try {
            const [activeIssueUrl, startTime, issue] = await Promise.all([
                StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE),
                StorageService.get(STORAGE_KEYS.START_TIME),
                IssueStorageService.getByUrl(issueUrl),
            ]);

            if (activeIssueUrl && startTime && activeIssueUrl !== issueUrl) {
                await TimerService.stopTimer(activeIssueUrl);
            }

            const issueInfo = GitHubService.parseIssueUrl(issueUrl);
            const { owner, repo, issueNumber } = issueInfo;
            const title = issueTitle || 'Untitled';
            const fullIssueTitle = `(${owner}) ${repo} | ${title} | #${issueNumber}`;

            // Merge remote entries into local before starting
            await TimerService.backfillRemoteEntries(issueUrl, owner, repo, issueNumber, fullIssueTitle);

            await Promise.all([
                StorageService.set(STORAGE_KEYS.ACTIVE_ISSUE, issueUrl),
                StorageService.set(STORAGE_KEYS.START_TIME, new Date().toISOString()),
            ]);

            if (!issue) {
                await IssueStorageService.add({ url: issueUrl, title: fullIssueTitle });
            }

            const totalTime = await TimerService.getTotalTimeForIssue(issueUrl);
            chrome.runtime.sendMessage({ action: 'timerStarted', issueUrl });
            return { issueUrl, totalTime, isRunning: true };
        } catch (error) {
            console.error('Failed to start timer:', error);
            await StorageService.removeMultiple([STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME]);
            return { issueUrl, totalTime: 0, isRunning: false };
        }
    }

    /** @param {string} issueUrl @returns {Promise<import('../utils/schema.utils.js').TimerResult>} */
    static async stopTimer(issueUrl) {
        try {
            const [startTime, githubToken, trackedTimes, existingIssue] = await Promise.all([
                StorageService.get(STORAGE_KEYS.START_TIME),
                GitHubStorageService.getGitHubToken(),
                StorageService.get(STORAGE_KEYS.TRACKED_TIMES),
                IssueStorageService.getByUrl(issueUrl),
            ]);

            if (!startTime || Number.isNaN(new Date(startTime).getTime())) {
                console.error('Invalid startTime:', startTime);
                await StorageService.removeMultiple([STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME]);
                return { issueUrl, totalTime: 0, isRunning: false };
            }

            const taskTitle = existingIssue?.title || 'Untitled';
            const timeSpentSeconds = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);

            const issueInfo = GitHubService.parseIssueUrl(issueUrl);
            const { owner, repo, issueNumber } = issueInfo;

            const updatedTrackedTimes = [
                ...(trackedTimes ?? []),
                {
                    issueUrl,
                    title: taskTitle,
                    seconds: timeSpentSeconds,
                    date: TimeService.getLocalDateString(),
                },
            ];

            await Promise.all([
                StorageService.set(STORAGE_KEYS.TRACKED_TIMES, updatedTrackedTimes),
                StorageService.removeMultiple([STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME]),
            ]);

            const totalTime = await TimerService.getTotalTimeForIssue(issueUrl);

            // Sync to GitHub in the background (non-blocking)
            if (githubToken) {
                TimerService.syncCommentInBackground(issueUrl, owner, repo, issueNumber, updatedTrackedTimes);
            }

            chrome.runtime.sendMessage({ action: 'timerStopped', issueUrl });
            return { issueUrl, totalTime, isRunning: false };
        } catch (error) {
            console.error('Failed to stop timer:', error);
            return { issueUrl, totalTime: 0, isRunning: false };
        }
    }

    /** @param {string} issueUrl @param {string} date @param {number} oldSeconds @param {number} newSeconds @returns {Promise<boolean>} */
    static async updateSessionTime(issueUrl, date, oldSeconds, newSeconds) {
        try {
            const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
            const idx = trackedTimes.findIndex(
                (e) => e.issueUrl === issueUrl && e.date === date && e.seconds === oldSeconds,
            );
            if (idx === -1) return false;

            trackedTimes[idx] = { ...trackedTimes[idx], seconds: newSeconds };
            await StorageService.set(STORAGE_KEYS.TRACKED_TIMES, trackedTimes);

            const githubToken = await GitHubStorageService.getGitHubToken();
            if (githubToken) {
                const { owner, repo, issueNumber } = GitHubService.parseIssueUrl(issueUrl);
                TimerService.syncCommentInBackground(issueUrl, owner, repo, issueNumber, trackedTimes);
            }
            return true;
        } catch (error) {
            console.error('Failed to update session time:', error);
            return false;
        }
    }

    /**
     * Fetches remote entries from the GitHub comment for this issue
     * and merges any missing ones into local storage.
     */
    static async backfillRemoteEntries(issueUrl, owner, repo, issueNumber, title) {
        try {
            const githubToken = await GitHubStorageService.getGitHubToken();
            if (!githubToken) return;

            const username = await GitHubService.getCurrentUsername();
            const commentIds = (await StorageService.get(STORAGE_KEYS.COMMENT_IDS)) ?? {};
            const commentKey = `${username}:${issueUrl}`;

            const comment = await GitHubService.findTrackerComment(owner, repo, issueNumber, username);
            if (!comment) return;

            commentIds[commentKey] = comment.id;
            await StorageService.set(STORAGE_KEYS.COMMENT_IDS, commentIds);

            const remoteEntries = GitHubService.parseTrackerPayload(comment.body) || [];
            if (remoteEntries.length === 0) return;

            const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
            const localKeys = new Set(
                trackedTimes
                    .filter((e) => e.issueUrl === issueUrl)
                    .map((e) => `${e.date}:${e.seconds}`),
            );

            let added = false;
            for (const entry of remoteEntries) {
                const key = `${entry.date}:${entry.seconds}`;
                if (!localKeys.has(key)) {
                    trackedTimes.push({
                        issueUrl,
                        title,
                        seconds: entry.seconds,
                        date: entry.date,
                    });
                    localKeys.add(key);
                    added = true;
                }
            }
            if (added) {
                await StorageService.set(STORAGE_KEYS.TRACKED_TIMES, trackedTimes);
            }
        } catch (error) {
            console.error('Failed to backfill remote entries:', error);
        }
    }

    static syncCommentInBackground(issueUrl, owner, repo, issueNumber, trackedTimes) {
        (async () => {
            try {
                const issueEntries = trackedTimes
                    .filter((e) => e.issueUrl === issueUrl)
                    .map((e) => ({ date: e.date, seconds: e.seconds }));

                const commentIds = (await StorageService.get(STORAGE_KEYS.COMMENT_IDS)) ?? {};
                const username = await GitHubService.getCurrentUsername();
                const commentKey = `${username}:${issueUrl}`;
                const result = await GitHubService.createOrUpdateTrackerComment({
                    owner,
                    repo,
                    issueNumber,
                    entries: issueEntries,
                    cachedCommentId: commentIds[commentKey],
                });

                commentIds[commentKey] = result.commentId;
                await StorageService.set(STORAGE_KEYS.COMMENT_IDS, commentIds);
            } catch (error) {
                console.error('Background sync failed:', error);
            }
        })();
    }
}
