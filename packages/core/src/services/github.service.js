import {
    buildTrackerMarker,
    GITHUB_API_URL,
    matchesTrackerMarker,
    TRACKER_PAYLOAD_PREFIX,
} from '../utils/constants.utils.js';
import { TimeService } from '../utils/time.utils.js';
import { CacheService } from './cache.service.js';
import { GitHubStorageService } from './github-storage.service.js';

const TRACKER_SYNC_LOG_PREFIX = '[TrackerSync][github]';

function getErrorMessage(error) {
    if (error instanceof Error) return error.message;
    return String(error);
}

export class GitHubService {
    static parseIssueUrl(url) {
        const match = url.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
        if (!match) throw new Error('Invalid GitHub issue URL');

        return {
            owner: match[1],
            repo: match[2],
            issueNumber: parseInt(match[3], 10),
            fullRepo: `${match[1]}/${match[2]}`,
        };
    }

    static simplifyIssue(apiIssue, repoFullName) {
        return {
            number: apiIssue.number,
            title: apiIssue.title,
            issueUrl: `/${repoFullName}/issues/${apiIssue.number}`,
            state: apiIssue.state,
            labels: (apiIssue.labels || []).map((l) => l.name),
            assignees: (apiIssue.assignees || []).map((a) => a.login),
            user: apiIssue.user?.login || '',
        };
    }

    static async apiRequest(endpoint, options = {}) {
        const token = await GitHubStorageService.getGitHubToken();
        if (!token) throw new Error('GitHub token not found');

        const response = await fetch(`${GITHUB_API_URL}${endpoint}`, {
            ...options,
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'GitHub API request failed');
        }

        return response.json();
    }

    static async getUser() {
        return GitHubService.apiRequest('/user');
    }

    static async getRateLimit() {
        const data = await GitHubService.apiRequest('/rate_limit');
        const { limit, remaining, reset } = data.rate;
        return { limit, remaining, resetAt: new Date(reset * 1000) };
    }

    // --- Tracker comment methods ---

    static async getCurrentUsername() {
        const cached = await CacheService.getCachedUser();
        if (cached?.login) return cached.login;
        const user = await GitHubService.getUser();
        return user.login;
    }

    /**
     * Build the tracker comment body.
     *
     * @param {Array<{date:string, seconds:number}>} entries
     * @param {string} username
     * @param {string|null} [running] - ISO timestamp when an active session started, or null/undefined when no session is in progress.
     * @returns {string}
     */
    static buildTrackerCommentBody(entries, username, running = null) {
        const sorted = entries
            .map((e) => ({ date: e.date, seconds: Math.floor(e.seconds) }))
            .sort((a, b) => a.date.localeCompare(b.date) || 0);

        const totalSeconds = sorted.reduce((sum, e) => sum + e.seconds, 0);
        const marker = buildTrackerMarker(username);

        let body = `${marker}\n`;
        body += `⏱️ **Total tracked time: ${TimeService.formatHuman(totalSeconds)}**\n\n`;

        if (running) {
            body += `🟢 **Currently tracking** — session started at ${running}\n\n`;
        }

        if (sorted.length > 0) {
            body += `| # | Date | Duration |\n|---|------|----------|\n`;
            sorted.forEach((e, i) => {
                body += `| ${i + 1} | ${e.date} | ${TimeService.formatHuman(e.seconds)} |\n`;
            });
            body += '\n';
        }

        const payload = btoa(JSON.stringify({ v: 2, entries: sorted, running: running ?? null }));
        body += `${TRACKER_PAYLOAD_PREFIX}${payload} -->`;

        return body;
    }

    /**
     * Parse a tracker comment body. Returns an object with `entries` and an optional
     * `running` ISO timestamp when the author of the comment has an active session.
     *
     * Backward-compatible with v1 payloads (no `running` field). Returns `null`
     * when no payload marker is found.
     *
     * @param {string} commentBody
     * @returns {{ entries: Array<{date:string, seconds:number}>, running: string|null } | null}
     */
    static parseTrackerPayload(commentBody) {
        const match = commentBody.match(/<!-- timetracker-payload:(.*?) -->/);
        if (!match) return null;
        try {
            const json = JSON.parse(atob(match[1]));
            if ((json.v === 1 || json.v === 2) && Array.isArray(json.entries)) {
                const running = typeof json.running === 'string' && json.running.length > 0 ? json.running : null;
                return { entries: json.entries, running };
            }
        } catch (e) {
            console.error('Failed to parse tracker payload:', e);
        }
        return null;
    }

    static async findTrackerComment(owner, repo, issueNumber, username) {
        let page = 1;
        while (page <= 10) {
            const comments = await GitHubService.apiRequest(
                `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
            );
            const found = comments.find((c) => c.body && matchesTrackerMarker(c.body, username));
            if (found) return found;
            if (comments.length < 100) break;
            page++;
        }
        return null;
    }

    static async createOrUpdateTrackerComment({ owner, repo, issueNumber, entries, cachedCommentId, running = null }) {
        const username = await GitHubService.getCurrentUsername();
        const body = GitHubService.buildTrackerCommentBody(entries, username, running);

        console.info(TRACKER_SYNC_LOG_PREFIX, 'Preparing tracker comment sync', {
            owner,
            repo,
            issueNumber,
            entryCount: entries.length,
            cachedCommentId: cachedCommentId ?? null,
        });

        // Try cached comment ID first — verify ownership before patching
        if (cachedCommentId) {
            try {
                const existing = await GitHubService.apiRequest(
                    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments/${cachedCommentId}`,
                );
                if (existing.user?.login === username && matchesTrackerMarker(existing.body || '', username)) {
                    console.info(TRACKER_SYNC_LOG_PREFIX, 'Updating tracker comment via cached comment id', {
                        owner,
                        repo,
                        issueNumber,
                        commentId: cachedCommentId,
                    });
                    const result = await GitHubService.apiRequest(
                        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments/${cachedCommentId}`,
                        { method: 'PATCH', body: JSON.stringify({ body }) },
                    );
                    return { comment: result, commentId: result.id };
                }
                // Cached comment belongs to different user, search for own comment
            } catch (error) {
                console.warn(TRACKER_SYNC_LOG_PREFIX, 'Cached comment lookup failed; falling back to search', {
                    owner,
                    repo,
                    issueNumber,
                    commentId: cachedCommentId,
                    error: getErrorMessage(error),
                });
                // Cached comment ID failed, fall through to search
            }
        }

        // Search for existing tracker comment owned by current user
        const existing = await GitHubService.findTrackerComment(owner, repo, issueNumber, username);
        if (existing && existing.user?.login === username) {
            try {
                console.info(TRACKER_SYNC_LOG_PREFIX, 'Updating tracker comment after search', {
                    owner,
                    repo,
                    issueNumber,
                    commentId: existing.id,
                });
                const result = await GitHubService.apiRequest(
                    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments/${existing.id}`,
                    { method: 'PATCH', body: JSON.stringify({ body }) },
                );
                return { comment: result, commentId: result.id };
            } catch (e) {
                console.error(TRACKER_SYNC_LOG_PREFIX, 'Failed to update existing tracker comment', {
                    owner,
                    repo,
                    issueNumber,
                    commentId: existing.id,
                    error: getErrorMessage(e),
                });
            }
        }

        // Create new comment
        console.info(TRACKER_SYNC_LOG_PREFIX, 'Creating new tracker comment', {
            owner,
            repo,
            issueNumber,
            entryCount: entries.length,
        });
        const result = await GitHubService.apiRequest(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments`,
            { method: 'POST', body: JSON.stringify({ body }) },
        );
        return { comment: result, commentId: result.id };
    }

    static async recoverTimesFromRepo(owner, repo) {
        const username = await GitHubService.getCurrentUsername();
        const results = [];
        let page = 1;
        while (page <= 50) {
            const comments = await GitHubService.apiRequest(
                `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments?per_page=100&page=${page}&sort=updated&direction=desc`,
            );
            for (const comment of comments) {
                if (comment.body && matchesTrackerMarker(comment.body, username)) {
                    const parsed = GitHubService.parseTrackerPayload(comment.body);
                    if (parsed) {
                        const issueMatch = comment.issue_url.match(/\/issues\/(\d+)$/);
                        if (issueMatch) {
                            results.push({
                                issueUrl: `/${owner}/${repo}/issues/${issueMatch[1]}`,
                                entries: parsed.entries,
                                running: parsed.running,
                                commentId: comment.id,
                            });
                        }
                    }
                }
            }
            if (comments.length < 100) break;
            page++;
        }
        return results;
    }

    static async recoverAllTimes(pinnedRepos) {
        const allRecovered = [];
        for (const repo of pinnedRepos) {
            const [owner, repoName] = repo.fullName.split('/');
            try {
                const repoResults = await GitHubService.recoverTimesFromRepo(owner, repoName);
                allRecovered.push(...repoResults);
            } catch (e) {
                console.error(`Recovery failed for ${repo.fullName}:`, e);
            }
        }
        return allRecovered;
    }

    static async recoverAllUsersTimesFromRepo(owner, repo) {
        const results = [];
        let page = 1;
        while (page <= 50) {
            const comments = await GitHubService.apiRequest(
                `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments?per_page=100&page=${page}&sort=updated&direction=desc`,
            );
            for (const comment of comments) {
                if (comment.body && matchesTrackerMarker(comment.body)) {
                    const parsed = GitHubService.parseTrackerPayload(comment.body);
                    if (parsed) {
                        const issueMatch = comment.issue_url.match(/\/issues\/(\d+)$/);
                        if (issueMatch) {
                            results.push({
                                issueUrl: `/${owner}/${repo}/issues/${issueMatch[1]}`,
                                user: comment.user.login,
                                entries: parsed.entries,
                                running: parsed.running,
                                commentId: comment.id,
                            });
                        }
                    }
                }
            }
            if (comments.length < 100) break;
            page++;
        }
        return results;
    }

    static async fetchAllUsersData(pinnedRepos) {
        const allData = [];
        for (const repo of pinnedRepos) {
            const [owner, repoName] = repo.fullName.split('/');
            try {
                const repoResults = await GitHubService.recoverAllUsersTimesFromRepo(owner, repoName);
                allData.push(...repoResults);
            } catch (e) {
                console.error(`Fetch all users failed for ${repo.fullName}:`, e);
            }
        }
        return allData;
    }

    static async searchRepositories(query) {
        const results = await GitHubService.apiRequest(
            `/search/repositories?q=${encodeURIComponent(query)}&per_page=20&sort=updated`,
        );
        return results.items || [];
    }

    static async getRepoIssues(owner, repo, { state = 'all' } = {}) {
        const issues = await GitHubService.apiRequest(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${state}&per_page=100&sort=updated`,
        );
        // Filter out pull requests (GitHub API returns PRs in /issues endpoint)
        return issues.filter((issue) => !issue.pull_request);
    }

    static async getAssignedIssues({ state = 'all' } = {}) {
        const issues = await GitHubService.apiRequest(
            `/issues?filter=assigned&state=${state}&per_page=100&sort=updated`,
        );
        return issues.filter((issue) => !issue.pull_request);
    }

    static async getCreatedIssues({ state = 'all' } = {}) {
        const issues = await GitHubService.apiRequest(
            `/issues?filter=created&state=${state}&per_page=100&sort=updated`,
        );
        return issues.filter((issue) => !issue.pull_request);
    }
}
