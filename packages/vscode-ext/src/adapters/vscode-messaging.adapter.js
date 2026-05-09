// packages/vscode-ext/src/adapters/vscode-messaging.adapter.js
//
// VS Code implementation of MessagingPort.
//
// In the browser extension, syncTrackerComment messages travel from the popup
// to the background service worker, which serialises writes per issue via
// SyncQueue.  In VS Code there is no service worker, so the extension host
// handles the full flow inline:
//
//   TimerService.syncComment
//     → VSCodeMessagingAdapter.syncComment
//       → SyncQueue.enqueue (per issueUrl)
//         → #syncTrackerComment (mirrors background/index.js:53-84)
//           → StorageService / GitHubService

import { MessagingPort } from '../../../core/src/ports/messaging.port.js';
import { GitHubService } from '../../../core/src/services/github.service.js';
import { StorageService } from '../../../core/src/services/storage.service.js';
import { SyncQueue } from '../../../core/src/sync-queue.js';
import { STORAGE_KEYS } from '../../../core/src/utils/constants.utils.js';

const LOG_PREFIX = '[TrackerSync][vscode]';

/** @param {unknown} error @returns {string} */
function getErrorMessage(error) {
    if (error instanceof Error) return error.message;
    return String(error);
}

export class VSCodeMessagingAdapter extends MessagingPort {
    /** @type {SyncQueue} */
    #queue = new SyncQueue();

    /**
     * Perform the GitHub tracker-comment create/update, mirroring the logic in
     * background/index.js `syncTrackerComment`.
     *
     * @param {{ issueUrl: string, owner: string, repo: string, issueNumber: number }} payload
     * @returns {Promise<import('../../../core/src/ports/messaging.port.js').SyncCommentResult>}
     */
    async #syncTrackerComment({ issueUrl, owner, repo, issueNumber }) {
        console.info(LOG_PREFIX, 'Starting tracker sync job', {
            issueUrl,
            owner,
            repo,
            issueNumber,
        });

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
        });

        commentIds[commentKey] = result.commentId;
        await StorageService.set(STORAGE_KEYS.COMMENT_IDS, commentIds);

        console.info(LOG_PREFIX, 'Tracker sync job completed', {
            issueUrl,
            issueEntriesCount: issueEntries.length,
            commentId: result.commentId,
        });

        return { commentId: result.commentId };
    }

    /**
     * Queue a tracker-comment sync for the given issue.
     *
     * Jobs for the same issueUrl run serially — a stop, edit, and delete sequence
     * cannot produce out-of-order writes even when triggered in rapid succession.
     *
     * @param {string} issueUrl
     * @param {string} owner
     * @param {string} repo
     * @param {number} issueNumber
     * @returns {Promise<import('../../../core/src/ports/messaging.port.js').SyncCommentResult>}
     */
    syncComment(issueUrl, owner, repo, issueNumber) {
        const hadPendingJob = this.#queue.has(issueUrl);

        console.info(
            LOG_PREFIX,
            hadPendingJob ? 'Queueing tracker sync behind pending job' : 'Queueing tracker sync',
            { issueUrl },
        );

        const next = this.#queue.enqueue(issueUrl, () =>
            this.#syncTrackerComment({ issueUrl, owner, repo, issueNumber }),
        );

        next.finally(() => {
            console.info(LOG_PREFIX, 'Tracker sync queue drained for issue', { issueUrl });
        }).catch(() => { }); // suppress unhandled rejection on the finally-chain

        return next;
    }

    /**
     * No-op — VS Code has no browser tabs to notify.
     * @param {string} _issueUrl
     */
    notifyTimerStarted(_issueUrl) { }

    /**
     * No-op — VS Code has no browser tabs to notify.
     * @param {string} _issueUrl
     */
    notifyTimerStopped(_issueUrl) { }
}
