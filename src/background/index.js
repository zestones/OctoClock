// background/index.js

import { CacheService } from '../services/cache.service.js';
import { GitHubService } from '../services/github.service.js';
import { GitHubStorageService } from '../services/github-storage.service.js';
import { PinnedReposService } from '../services/pinned-repos.service.js';
import { StorageService } from '../services/storage.service.js';
import { CACHE_REFRESH_INTERVAL, SCHEMA_VERSION, STORAGE_KEYS } from '../utils/constants.utils.js';

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

    chrome.alarms.get('refreshCache', (existing) => {
        if (!existing) {
            chrome.alarms.create('refreshCache', { periodInMinutes: CACHE_REFRESH_INTERVAL });
        }
    });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'refreshCache') {
        refreshCachedIssues();
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
