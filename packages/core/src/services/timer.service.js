import { STORAGE_KEYS } from '../utils/constants.utils.js';
import { TimeService } from '../utils/time.utils.js';
import { GitHubService } from './github.service.js';
import { GitHubStorageService } from './github-storage.service.js';
import { IssueStorageService } from './issue-storage.service.js';
import { StorageService } from './storage.service.js';

const TRACKER_SYNC_LOG_PREFIX = '[TrackerSync][popup]';

function getErrorMessage(error) {
    if (error instanceof Error) return error.message;
    return String(error);
}

/**
 * @typedef {Object} SessionMutationResult
 * @property {boolean} ok
 * @property {'synced' | 'skipped' | 'failed'} syncStatus
 * @property {string | null} syncError
 */

export class TimerService {
    /** @type {import('../ports/messaging.port.js').MessagingPort | null} */
    static #messagingPort = null;

    /** @param {import('../ports/messaging.port.js').MessagingPort} port */
    static setMessagingPort(port) {
        TimerService.#messagingPort = port;
    }

    static #assertMessagingPort() {
        if (!TimerService.#messagingPort) {
            throw new Error(
                'TimerService: no MessagingPort set. Call TimerService.setMessagingPort() during bootstrap.',
            );
        }
    }

    /** @param {string} issueUrl @returns {Promise<number>} Total seconds */
    static async getTotalTimeForIssue(issueUrl) {
        /** @type {import('../utils/schema.utils.js').TrackedTimeEntry[]} */
        const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
        return trackedTimes
            .filter((entry) => entry.issueUrl === issueUrl)
            .reduce((total, entry) => total + (entry.seconds || 0), 0);
    }

    /**
     * Queue tracker-comment sync through the messaging port.
     * In the browser the port forwards to the background worker, which serializes
     * writes per issue via SyncQueue. In VS Code the port calls GitHub directly.
     *
     * @param {string} issueUrl
     * @param {string} owner
     * @param {string} repo
     * @param {number} issueNumber
     * @param {string|null} [running] - ISO timestamp of the in-progress session, or null to clear.
     */
    static async syncComment(issueUrl, owner, repo, issueNumber, running = null) {
        TimerService.#assertMessagingPort();
        console.info(TRACKER_SYNC_LOG_PREFIX, 'Requesting tracker sync', {
            issueUrl,
            owner,
            repo,
            issueNumber,
            running: running ?? null,
        });
        const response = await TimerService.#messagingPort.syncComment(issueUrl, owner, repo, issueNumber, running);
        console.info(TRACKER_SYNC_LOG_PREFIX, 'Tracker sync completed', {
            issueUrl,
            commentId: response.commentId,
        });
        return response;
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
            const fullIssueTitle = issue?.title || `(${owner}) ${repo} | ${title} | #${issueNumber}`;

            // Merge remote entries into local before starting
            await TimerService.backfillRemoteEntries(issueUrl, owner, repo, issueNumber, fullIssueTitle);

            const startedAt = new Date().toISOString();
            await Promise.all([
                StorageService.set(STORAGE_KEYS.ACTIVE_ISSUE, issueUrl),
                StorageService.set(STORAGE_KEYS.START_TIME, startedAt),
            ]);

            if (!issue) {
                await IssueStorageService.add({ url: issueUrl, title: fullIssueTitle });
            }

            const totalTime = await TimerService.getTotalTimeForIssue(issueUrl);
            TimerService.#assertMessagingPort();
            TimerService.#messagingPort.notifyTimerStarted(issueUrl);

            // Cross-context heartbeat: push the running marker to GitHub so the
            // VS Code extension (or another browser context) picks up the active
            // timer on its next sync. Fire-and-forget — never block start.
            const githubToken = await GitHubStorageService.getGitHubToken();
            if (githubToken) {
                void TimerService.syncComment(issueUrl, owner, repo, issueNumber, startedAt).catch((error) => {
                    console.error('Background sync on start failed:', error);
                });
            }

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

            // Sync to GitHub in the background worker (non-blocking)
            if (githubToken) {
                void TimerService.syncComment(issueUrl, owner, repo, issueNumber).catch((error) => {
                    console.error('Background sync failed:', error);
                });
            }

            TimerService.#assertMessagingPort();
            TimerService.#messagingPort.notifyTimerStopped(issueUrl);
            return { issueUrl, totalTime, isRunning: false };
        } catch (error) {
            console.error('Failed to stop timer:', error);
            return { issueUrl, totalTime: 0, isRunning: false };
        }
    }

    /** @param {string} issueUrl @param {string} date @param {number} seconds @returns {Promise<SessionMutationResult>} */
    static async deleteSession(issueUrl, date, seconds) {
        try {
            const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
            const idx = trackedTimes.findIndex(
                (e) => e.issueUrl === issueUrl && e.date === date && e.seconds === seconds,
            );
            if (idx === -1) {
                console.warn(TRACKER_SYNC_LOG_PREFIX, 'Delete session target not found', {
                    issueUrl,
                    date,
                    seconds,
                });
                return { ok: false, syncStatus: 'skipped', syncError: null };
            }

            trackedTimes.splice(idx, 1);
            await StorageService.set(STORAGE_KEYS.TRACKED_TIMES, trackedTimes);

            console.info(TRACKER_SYNC_LOG_PREFIX, 'Deleted session locally', {
                issueUrl,
                date,
                seconds,
                remainingIssueEntries: trackedTimes.filter((entry) => entry.issueUrl === issueUrl).length,
            });

            const githubToken = await GitHubStorageService.getGitHubToken();
            /** @type {SessionMutationResult['syncStatus']} */
            let syncStatus = 'skipped';
            /** @type {SessionMutationResult['syncError']} */
            let syncError = null;
            if (githubToken) {
                const { owner, repo, issueNumber } = GitHubService.parseIssueUrl(issueUrl);
                try {
                    await TimerService.syncComment(issueUrl, owner, repo, issueNumber);
                    syncStatus = 'synced';
                } catch (error) {
                    syncError = getErrorMessage(error);
                    console.error(TRACKER_SYNC_LOG_PREFIX, 'Failed to sync tracker comment after deleting session', {
                        issueUrl,
                        date,
                        seconds,
                        error: syncError,
                    });
                    syncStatus = 'failed';
                }
            }
            return { ok: true, syncStatus, syncError };
        } catch (error) {
            console.error(TRACKER_SYNC_LOG_PREFIX, 'Failed to delete session locally', {
                issueUrl,
                date,
                seconds,
                error: getErrorMessage(error),
            });
            return { ok: false, syncStatus: 'skipped', syncError: null };
        }
    }

    /** @param {string} issueUrl @param {string} date @param {number} oldSeconds @param {number} newSeconds @returns {Promise<SessionMutationResult>} */
    static async updateSessionTime(issueUrl, date, oldSeconds, newSeconds) {
        try {
            const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
            const idx = trackedTimes.findIndex(
                (e) => e.issueUrl === issueUrl && e.date === date && e.seconds === oldSeconds,
            );
            if (idx === -1) {
                console.warn(TRACKER_SYNC_LOG_PREFIX, 'Update session target not found', {
                    issueUrl,
                    date,
                    oldSeconds,
                    newSeconds,
                });
                return { ok: false, syncStatus: 'skipped', syncError: null };
            }

            trackedTimes[idx] = { ...trackedTimes[idx], seconds: newSeconds };
            await StorageService.set(STORAGE_KEYS.TRACKED_TIMES, trackedTimes);

            console.info(TRACKER_SYNC_LOG_PREFIX, 'Updated session locally', {
                issueUrl,
                date,
                oldSeconds,
                newSeconds,
            });

            const githubToken = await GitHubStorageService.getGitHubToken();
            /** @type {SessionMutationResult['syncStatus']} */
            let syncStatus = 'skipped';
            /** @type {SessionMutationResult['syncError']} */
            let syncError = null;
            if (githubToken) {
                const { owner, repo, issueNumber } = GitHubService.parseIssueUrl(issueUrl);
                try {
                    await TimerService.syncComment(issueUrl, owner, repo, issueNumber);
                    syncStatus = 'synced';
                } catch (error) {
                    syncError = getErrorMessage(error);
                    console.error(TRACKER_SYNC_LOG_PREFIX, 'Failed to sync tracker comment after updating session', {
                        issueUrl,
                        date,
                        oldSeconds,
                        newSeconds,
                        error: syncError,
                    });
                    syncStatus = 'failed';
                }
            }
            return { ok: true, syncStatus, syncError };
        } catch (error) {
            console.error(TRACKER_SYNC_LOG_PREFIX, 'Failed to update session locally', {
                issueUrl,
                date,
                oldSeconds,
                newSeconds,
                error: getErrorMessage(error),
            });
            return { ok: false, syncStatus: 'skipped', syncError: null };
        }
    }

    /**
     * Fetches remote entries from the GitHub comment for this issue
     * and merges any missing ones into local storage.
     *
     * If `title` is omitted, the title is derived from existing local entries
     * for that issue (falling back to a generic "(owner) repo | #n" string).
     * This lets callers that don't have the issue title handy (e.g. the
     * tracker-comment sync handlers) still safely pull-merge before pushing.
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

            const parsed = GitHubService.parseTrackerPayload(comment.body);
            const remoteEntries = parsed?.entries ?? [];
            if (remoteEntries.length === 0) return;

            const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
            const localKeys = new Set(
                trackedTimes.filter((e) => e.issueUrl === issueUrl).map((e) => `${e.date}:${e.seconds}`),
            );

            // Derive a title if the caller didn't supply one. Fall back to
            // any existing local entry's title, or a generic descriptor.
            let resolvedTitle = title;
            if (!resolvedTitle) {
                const existing = trackedTimes.find((e) => e.issueUrl === issueUrl);
                resolvedTitle = existing?.title || `(${owner}) ${repo} | #${issueNumber}`;
            }

            let added = false;
            for (const entry of remoteEntries) {
                const key = `${entry.date}:${entry.seconds}`;
                if (!localKeys.has(key)) {
                    trackedTimes.push({
                        issueUrl,
                        title: resolvedTitle,
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
}
