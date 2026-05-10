import { STORAGE_KEYS } from '../utils/constants.utils.js';
import { GitHubService } from './github.service.js';
import { IssueStorageService } from './issue-storage.service.js';
import { PinnedReposService } from './pinned-repos.service.js';
import { StorageService } from './storage.service.js';

/**
 * Merges recovered time entries into local storage.
 * Imports remote entries when local is empty or remote has more.
 */
async function mergeRecoveredTimes(recovered) {
    if (recovered.length === 0) return { importedCount: 0 };

    // Fetch issue titles from GitHub API for proper display
    const issueTitleMap = {};
    const repoSet = new Set(
        recovered.map((item) => {
            const { owner, repo } = GitHubService.parseIssueUrl(item.issueUrl);
            return `${owner}/${repo}`;
        }),
    );
    for (const fullRepo of repoSet) {
        const [owner, repoName] = fullRepo.split('/');
        try {
            const issues = await GitHubService.getRepoIssues(owner, repoName);
            for (const issue of issues) {
                issueTitleMap[`/${owner}/${repoName}/issues/${issue.number}`] = issue.title;
            }
        } catch (e) {
            console.error(`Failed to fetch issue titles for ${fullRepo}:`, e);
        }
    }

    const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
    const commentIds = (await StorageService.get(STORAGE_KEYS.COMMENT_IDS)) ?? {};
    const username = await GitHubService.getCurrentUsername();
    let importedCount = 0;

    for (const item of recovered) {
        const commentKey = `${username}:${item.issueUrl}`;
        commentIds[commentKey] = item.commentId;

        const localEntries = trackedTimes.filter((t) => t.issueUrl === item.issueUrl);
        const localKeys = new Set(localEntries.map((e) => `${e.date}:${e.seconds}`));

        const { owner, repo, issueNumber } = GitHubService.parseIssueUrl(item.issueUrl);
        const apiTitle = issueTitleMap[item.issueUrl];
        const title = apiTitle
            ? `(${owner}) ${repo} | ${apiTitle} | #${issueNumber}`
            : `(${owner}) ${repo} | #${issueNumber}`;

        // Union merge: append remote entries that are not already present
        // locally (keyed on date+seconds). Never delete or replace local
        // entries — that path caused cross-client data loss when a stop on
        // one surface had not yet been pushed before the other surface synced.
        for (const entry of item.entries) {
            const key = `${entry.date}:${entry.seconds}`;
            if (localKeys.has(key)) continue;
            trackedTimes.push({
                issueUrl: item.issueUrl,
                title,
                seconds: entry.seconds,
                date: entry.date,
            });
            localKeys.add(key);
            importedCount++;
        }

        const issueExists = await IssueStorageService.exists(item.issueUrl);
        if (!issueExists) {
            await IssueStorageService.add({ url: item.issueUrl, title });
        }
    }

    await StorageService.set(STORAGE_KEYS.TRACKED_TIMES, trackedTimes);
    await StorageService.set(STORAGE_KEYS.COMMENT_IDS, commentIds);

    return { importedCount };
}

/**
 * Refreshes the `status` field on every locally-tracked issue by querying
 * GitHub for each repo's current open/closed list. Best-effort: failures for
 * individual repos are logged and skipped (e.g. token lacks scope, repo
 * renamed). Returns the number of issues whose status changed.
 *
 * @returns {Promise<number>}
 */
export async function syncIssueStatuses() {
    const issues = await IssueStorageService.getAll();
    if (issues.length === 0) return 0;

    /** @type {Map<string, string[]>} */
    const reposToIssues = new Map();
    for (const issue of issues) {
        const { owner, repo } = GitHubService.parseIssueUrl(issue.url);
        const key = `${owner}/${repo}`;
        const list = reposToIssues.get(key) ?? [];
        list.push(issue.url);
        reposToIssues.set(key, list);
    }

    /** @type {Map<string, 'open'|'closed'>} */
    const stateByUrl = new Map();
    for (const repoKey of reposToIssues.keys()) {
        const [owner, repo] = repoKey.split('/');
        try {
            const remote = await GitHubService.getRepoIssues(owner, repo, { state: 'all' });
            for (const r of remote) {
                stateByUrl.set(`/${owner}/${repo}/issues/${r.number}`, r.state === 'closed' ? 'closed' : 'open');
            }
        } catch (e) {
            console.error(`OctoClock: status sync failed for ${repoKey}:`, e);
        }
    }

    let changed = 0;
    const updated = issues.map((i) => {
        const next = stateByUrl.get(i.url);
        if (!next) return i;
        if (i.status !== next) changed += 1;
        return { ...i, status: next };
    });
    if (changed > 0) {
        await StorageService.set(STORAGE_KEYS.ISSUES, updated);
    }
    return changed;
}

/**
 * Reconciles the local active-timer state (ACTIVE_ISSUE / START_TIME) with the
 * `running` heartbeat marker carried by the user's tracker comments.
 *
 * Rules:
 *  - If a remote comment has `running` set, treat it as the authoritative active timer.
 *    Adopt it locally if it differs from current local state.
 *  - If no remote comment has `running`, clear local active-timer state.
 *  - Protect against a brief race after a local startTimer call: if local state
 *    is very recent (< 60s) and remote shows no marker, do NOT clear — the
 *    background push probably hasn't completed yet.
 *
 * @param {Array<{ issueUrl: string, running: string|null }>} recovered
 */
async function reconcileActiveTimerFromRemote(recovered) {
    // Pick the latest running marker across all recovered tracker comments.
    /** @type {{ issueUrl: string, running: string } | null} */
    let remoteActive = null;
    for (const item of recovered) {
        if (item.running) {
            if (!remoteActive || item.running > remoteActive.running) {
                remoteActive = { issueUrl: item.issueUrl, running: item.running };
            }
        }
    }

    const [localIssue, localStart] = await Promise.all([
        StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE),
        StorageService.get(STORAGE_KEYS.START_TIME),
    ]);

    if (remoteActive) {
        if (localIssue !== remoteActive.issueUrl || localStart !== remoteActive.running) {
            await Promise.all([
                StorageService.set(STORAGE_KEYS.ACTIVE_ISSUE, remoteActive.issueUrl),
                StorageService.set(STORAGE_KEYS.START_TIME, remoteActive.running),
            ]);
            console.info(
                'OctoClock: adopted remote active timer',
                remoteActive.issueUrl,
                'startedAt',
                remoteActive.running,
            );
        }
        return;
    }

    // Remote has no running marker — clear local IF local state is older than
    // 60s (otherwise the local push is probably still in flight).
    if (localIssue && localStart) {
        const ageMs = Date.now() - new Date(localStart).getTime();
        if (Number.isFinite(ageMs) && ageMs > 60_000) {
            await StorageService.removeMultiple([STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME]);
            console.info('OctoClock: cleared local active timer (no remote heartbeat)');
        }
    }
}

/**
 * Recovers tracked times from GitHub comments for all pinned repos.
 * Merges remote data into local storage (imports if no local data or remote has more).
 * Reconciles the cross-context active-timer state from remote `running` markers.
 *
 * Returns { importedCount } or null if nothing to recover.
 */
export async function syncFromGitHub() {
    const pinnedRepos = await PinnedReposService.getPinnedRepos();
    if (pinnedRepos.length === 0) return null;

    const recovered = await GitHubService.recoverAllTimes(pinnedRepos);
    const merge = recovered.length === 0 ? null : await mergeRecoveredTimes(recovered);

    // Reconcile cross-context active timer state. Even when no entries were
    // imported, a `running` marker may have appeared/disappeared remotely.
    try {
        await reconcileActiveTimerFromRemote(recovered);
    } catch (e) {
        console.error('OctoClock: active-timer reconciliation failed:', e);
    }

    // Best-effort status refresh; never blocks recovery.
    syncIssueStatuses().catch((e) => console.error('OctoClock: issue-status sync failed:', e));

    return merge;
}

/**
 * Recovers tracked times from GitHub comments for a single repo.
 * Used when a new repo is pinned with auto-sync enabled.
 */
export async function syncRepoFromGitHub(owner, repoName) {
    const recovered = await GitHubService.recoverTimesFromRepo(owner, repoName);
    if (recovered.length === 0) return null;

    return mergeRecoveredTimes(recovered);
}
