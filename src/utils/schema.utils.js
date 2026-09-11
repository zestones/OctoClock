/**
 * @file Central type definitions for all chrome.storage.local data shapes.
 *
 * These are JSDoc typedefs only - no runtime code. Import types like:
 *   @type {import('./schema.utils.js').TrackedTimeEntry}
 *
 * Schema version: 1 (see SCHEMA_VERSION in constants.utils.js)
 */

// ─── Core tracked data ──────────────────────────────────────────────

/**
 * A single timer session recorded when the user stops a timer.
 * Stored in: STORAGE_KEYS.TRACKED_TIMES (array)
 *
 * @typedef {Object} TrackedTimeEntry
 * @property {string} issueUrl - Issue path, e.g. "/owner/repo/issues/123"
 * @property {string} title - Display title, e.g. "(owner) repo | Fix bug | #123"
 * @property {number} seconds - Duration of the session in seconds
 * @property {string} date - Local date "YYYY-MM-DD" (from TimeService.getLocalDateString)
 */

/**
 * An issue the user has tracked at least once.
 * Stored in: STORAGE_KEYS.ISSUES (array)
 *
 * @typedef {Object} IssueEntry
 * @property {string} url - Issue path, e.g. "/owner/repo/issues/123"
 * @property {string} title - Display title, e.g. "(owner) repo | Fix bug | #123"
 */

/**
 * A pinned repository the user has bookmarked for quick access.
 * Stored in: STORAGE_KEYS.PINNED_REPOS (array)
 *
 * @typedef {Object} PinnedRepo
 * @property {string} fullName - Repo slug, e.g. "owner/repo"
 */

// ─── User & auth ────────────────────────────────────────────────────

/**
 * Cached GitHub user info.
 * Stored in: cache:user (via CacheService)
 *
 * @typedef {Object} CachedUser
 * @property {string} login - GitHub username
 * @property {string} avatar_url - Avatar URL
 * @property {string} [name] - Display name (may be null)
 */

// ─── GitHub issue cache ─────────────────────────────────────────────

/**
 * Simplified issue from the GitHub API, used for the issues list UI.
 * Stored in: cache:issues:<fullName> (via CacheService, auto-expires)
 *
 * @typedef {Object} SimplifiedIssue
 * @property {number} number - Issue number
 * @property {string} title - Issue title
 * @property {string} issueUrl - Issue path, e.g. "/owner/repo/issues/123"
 * @property {'open'|'closed'} state - Issue state
 * @property {string[]} labels - Label names
 * @property {string[]} assignees - Assignee logins
 * @property {string} user - Issue author login
 */

// ─── Sync / collaboration ───────────────────────────────────────────

/**
 * A tracked entry with user attribution, used in the "Everyone" stats view.
 * Stored in: STORAGE_KEYS.EVERYONE_DATA (array)
 *
 * @typedef {Object} EveryoneDataEntry
 * @property {string} issueUrl - Issue path
 * @property {string} title - Display title
 * @property {number} seconds - Duration in seconds
 * @property {string} date - Local date "YYYY-MM-DD"
 * @property {string} user - GitHub username who tracked this session
 */

/**
 * Map of comment IDs for GitHub tracker comments.
 * Stored in: STORAGE_KEYS.COMMENT_IDS (object)
 *
 * Keys are "username:/owner/repo/issues/123", values are GitHub comment IDs.
 *
 * @typedef {Object<string, number>} CommentIdsMap
 */

// ─── Timer state (transient) ────────────────────────────────────────

/**
 * Return value from TimerService.startTimer / stopTimer.
 *
 * @typedef {Object} TimerResult
 * @property {string} issueUrl - Issue path
 * @property {number} totalTime - Total tracked seconds for this issue
 * @property {boolean} isRunning - Whether the timer is currently running
 */

// ─── Cache envelope ─────────────────────────────────────────────────

/**
 * Wrapper stored by CacheService around cached data.
 * Internal to CacheService - consumers receive unwrapped data.
 *
 * @typedef {Object} CacheEnvelope
 * @property {*} data - The cached payload
 * @property {number} fetchedAt - Timestamp (Date.now()) when cached
 * @property {number} ttl - Time-to-live in milliseconds
 */

// ─── Storage map ────────────────────────────────────────────────────

/**
 * Complete map of chrome.storage.local keys and their types.
 *
 * @typedef {Object} StorageSchema
 * @property {number} schemaVersion - Current schema version (SCHEMA_VERSION)
 * @property {string} githubToken - GitHub PAT (ghp_... or github_pat_...)
 * @property {string|null} activeIssue - Currently timed issue URL, or null
 * @property {string|null} startTime - ISO 8601 timestamp of timer start, or null
 * @property {TrackedTimeEntry[]} trackedTimes - All recorded timer sessions
 * @property {IssueEntry[]} issues - All issues the user has tracked
 * @property {PinnedRepo[]} pinnedRepos - Bookmarked repositories
 * @property {CachedUser|null} cachedUser - Cached via CacheEnvelope
 * @property {CommentIdsMap} commentIds - GitHub comment ID cache
 * @property {boolean} autoSync - Whether auto-sync on popup open is enabled
 * @property {string} theme - "system" | "light" | "dark"
 * @property {EveryoneDataEntry[]} everyoneData - Aggregated team data
 */

export {};
