// background/index.js

import '../browser-bootstrap.js';
import { CacheService } from '../../../core/src/services/cache.service.js';
import { GitHubService } from '../../../core/src/services/github.service.js';
import { GitHubStorageService } from '../../../core/src/services/github-storage.service.js';
import { PinnedReposService } from '../../../core/src/services/pinned-repos.service.js';
import { StorageService } from '../../../core/src/services/storage.service.js';
import { syncFromGitHub } from '../../../core/src/services/sync.service.js';
import { TimerService } from '../../../core/src/services/timer.service.js';
import { SyncQueue } from '../../../core/src/sync-queue.js';
import { CACHE_REFRESH_INTERVAL, SCHEMA_VERSION, STORAGE_KEYS } from '../../../core/src/utils/constants.utils.js';

const trackerSyncQueue = new SyncQueue();
const TRACKER_SYNC_LOG_PREFIX = '[TrackerSync][background]';

function getErrorMessage(error) {
    if (error instanceof Error) return error.message;
    return String(error);
}

async function refreshCachedIssues() {
    const token = await GitHubStorageService.getGitHubToken();
    if (!token) return;

    const pinnedRepos = await PinnedReposService.getPinnedRepos();
    for (const repo of pinnedRepos) {
        try {
            const [owner, repoName] = repo.fullName.split('/');
            const issues = await GitHubService.getRepoIssues(owner, repoName);
            const simplified = issues.map((i) => GitHubService.simplifyIssue(i, repo.fullName));
            await CacheService.setCachedIssues(repo.fullName, simplified);
        } catch (error) {
            console.error(`Background refresh failed for ${repo.fullName}:`, error);
        }
    }

    // Refresh user cache
    try {
        const user = await GitHubService.getUser();
        await CacheService.setCachedUser({
            login: user.login,
            avatar_url: user.avatar_url,
            name: user.name,
        });
    } catch (error) {
        console.error('Background user refresh failed:', error);
    }
}

async function syncTrackerComment({ issueUrl, owner, repo, issueNumber, running = null }) {
    console.info(TRACKER_SYNC_LOG_PREFIX, 'Starting tracker sync job', {
        issueUrl,
        owner,
        repo,
        issueNumber,
        running: running ?? null,
    });

    // Pull-merge before push: fold any remote-only entries (e.g. written by
    // VS Code on the same issue) into local storage so the upcoming overwrite
    // of the GitHub comment carries the union of both sides instead of wiping
    // entries written elsewhere. Best-effort — failures fall through to a
    // local-only push.
    try {
        await TimerService.backfillRemoteEntries(issueUrl, owner, repo, issueNumber);
    } catch (e) {
        console.error(TRACKER_SYNC_LOG_PREFIX, 'pre-push backfill failed (continuing):', e);
    }

    const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
    const issueEntries = trackedTimes
        .filter((entry) => entry.issueUrl === issueUrl)
        .map((entry) => ({ date: entry.date, seconds: entry.seconds }));

    const commentIds = (await StorageService.get(STORAGE_KEYS.COMMENT_IDS)) ?? {};
    const username = await GitHubService.getCurrentUsername();
    const commentKey = `${username}:${issueUrl}`;
    const result = await GitHubService.createOrUpdateTrackerComment({
        owner,
        repo,
        issueNumber,
        entries: issueEntries,
        cachedCommentId: commentIds[commentKey],
        running,
    });

    commentIds[commentKey] = result.commentId;
    await StorageService.set(STORAGE_KEYS.COMMENT_IDS, commentIds);

    console.info(TRACKER_SYNC_LOG_PREFIX, 'Tracker sync job completed', {
        issueUrl,
        issueEntriesCount: issueEntries.length,
        commentId: result.commentId,
    });

    return { commentId: result.commentId };
}

function queueTrackerCommentSync(payload) {
    const hadPendingJob = trackerSyncQueue.has(payload.issueUrl);

    console.info(
        TRACKER_SYNC_LOG_PREFIX,
        hadPendingJob ? 'Queueing tracker sync behind pending job' : 'Queueing tracker sync',
        { issueUrl: payload.issueUrl },
    );

    const next = trackerSyncQueue.enqueue(payload.issueUrl, () => syncTrackerComment(payload));

    next.finally(() => {
        console.info(TRACKER_SYNC_LOG_PREFIX, 'Tracker sync queue drained for issue', {
            issueUrl: payload.issueUrl,
        });
    });

    return next;
}

// Create the cache-refresh alarm only once — on install or extension update.
// Using onInstalled (not top-level) because top-level code runs every time the
// service worker wakes up, which would reset the alarm countdown and prevent it
// from ever firing if any event wakes the SW within the period interval.
chrome.runtime.onInstalled.addListener(async () => {
    // Set schema version on install/update for future data migrations
    const currentVersion = await StorageService.get(STORAGE_KEYS.SCHEMA_VERSION);
    if (!currentVersion || currentVersion < SCHEMA_VERSION) {
        await StorageService.set(STORAGE_KEYS.SCHEMA_VERSION, SCHEMA_VERSION);
    }

    // Default AUTO_SYNC to true on first install so cross-client sync
    // (browser ↔ VS Code) works out of the box.
    const autoSync = await StorageService.get(STORAGE_KEYS.AUTO_SYNC);
    if (autoSync == null) {
        await StorageService.set(STORAGE_KEYS.AUTO_SYNC, true);
    }

    chrome.alarms.get('refreshCache', (existing) => {
        if (!existing) {
            chrome.alarms.create('refreshCache', { periodInMinutes: CACHE_REFRESH_INTERVAL });
        }
    });

    // Cross-context active-timer sync — pulls remote tracker comments every minute
    // so timers started in VS Code (or another browser context) propagate here.
    chrome.alarms.get('crossContextSync', (existing) => {
        if (!existing) {
            chrome.alarms.create('crossContextSync', { periodInMinutes: 1 });
        }
    });
});

async function runCrossContextSync() {
    try {
        const [autoSync, token] = await Promise.all([
            StorageService.get(STORAGE_KEYS.AUTO_SYNC),
            GitHubStorageService.getGitHubToken(),
        ]);
        if (!autoSync || !token) return;
        await syncFromGitHub();
    } catch (e) {
        console.error('OctoClock: cross-context sync failed:', e);
    }
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'refreshCache') {
        refreshCachedIssues();
    } else if (alarm.name === 'crossContextSync') {
        runCrossContextSync();
    }
});

// NOTE: No onSuspend handler — MV3 service workers are killed immediately after
// onSuspend fires, so async work (storage writes, API calls) gets aborted mid-flight.
// Timer state (activeIssue + startTime) is already persisted in chrome.storage.local
// when the timer starts, so it survives SW restarts and browser restarts.
// The user stops the timer explicitly via the popup or content script, which calls
// TimerService.stopTimer() — the single source of truth for stop logic.

// Forward timerStarted/timerStopped messages to all GitHub tabs.
// Returns true to keep the message channel open — this tells Chrome the response
// will be sent asynchronously, AND keeps the service worker alive until sendResponse
// is called (prevents the SW from being killed mid-forwarding).
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'syncTrackerComment') {
        console.info(TRACKER_SYNC_LOG_PREFIX, 'Received syncTrackerComment message', {
            issueUrl: message.issueUrl,
            owner: message.owner,
            repo: message.repo,
            issueNumber: message.issueNumber,
        });

        queueTrackerCommentSync(message)
            .then((result) => {
                sendResponse({ ok: true, ...result });
            })
            .catch((error) => {
                const errorMessage = getErrorMessage(error);
                console.error(TRACKER_SYNC_LOG_PREFIX, 'Tracker comment sync failed', {
                    issueUrl: message.issueUrl,
                    error: errorMessage,
                });
                sendResponse({ ok: false, error: errorMessage });
            });
        return true;
    }

    if (message.action === 'timerStarted' || message.action === 'timerStopped') {
        chrome.tabs.query({ url: 'https://github.com/*' }, (tabs) => {
            tabs.forEach((tab) => {
                chrome.tabs.sendMessage(tab.id, message, () => {
                    void chrome.runtime.lastError;
                });
            });
            sendResponse({ forwarded: tabs.length });
        });
        return true; // keep message channel open for async sendResponse
    }
});
