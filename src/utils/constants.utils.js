export const GITHUB_API_URL = 'https://api.github.com';
export const SCHEMA_VERSION = 1;
export const STORAGE_KEYS = {
    SCHEMA_VERSION: 'schemaVersion',
    GITHUB_TOKEN: 'githubToken',
    ACTIVE_ISSUE: 'activeIssue',
    START_TIME: 'startTime',
    TRACKED_TIMES: 'trackedTimes',
    ISSUES: 'issues',
    PINNED_REPOS: 'pinnedRepos',
    CACHED_USER: 'cachedUser',
    COMMENT_IDS: 'commentIds',
    AUTO_SYNC: 'autoSync',
    THEME: 'theme',
    EVERYONE_DATA: 'everyoneData',
};
export const CACHE_PREFIX = 'cache:';
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const CACHE_REFRESH_INTERVAL = 15; // minutes, for chrome.alarms
export const TIME_UPDATE_INTERVAL = 1000;

export const DEBOUNCE_INJECT_MS = 500;
export const DEBOUNCE_SEARCH_MS = 400;

export const CONTAINER_CHECK_INTERVAL_MS = 500;
export const CONTAINER_CHECK_MAX_ATTEMPTS = 10;

export const USER_CACHE_TTL = 30 * 60 * 1000;
export const TRACKER_COMMENT_MARKER_PREFIX = '<!-- github-timetracker-data';

export const buildTrackerMarker = (username) => `<!-- github-timetracker-data:${username} -->`;
export const matchesTrackerMarker = (body, username) => {
    if (username) return body.includes(`<!-- github-timetracker-data:${username} -->`);
    return body.includes(TRACKER_COMMENT_MARKER_PREFIX);
};

export const TRACKER_PAYLOAD_PREFIX = '<!-- timetracker-payload:';
