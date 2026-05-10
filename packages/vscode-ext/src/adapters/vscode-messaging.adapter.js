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
import { TimerService } from '../../../core/src/services/timer.service.js';
import { SyncQueue } from '../../../core/src/sync-queue.js';
import { STORAGE_KEYS } from '../../../core/src/utils/constants.utils.js';

const LOG_PREFIX = '[TrackerSync][vscode]';

/** @param {unknown} error @returns {string} */
function _getErrorMessage(error) {
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
    async #syncTrackerComment({ issueUrl, owner, repo, issueNumber, running = null }) {
        console.info(LOG_PREFIX, 'Starting tracker sync job', {
            issueUrl,
            owner,
            repo,
            issueNumber,
            running: running ?? null,
        });

        // Pull-merge before push: fold any remote-only entries (e.g. written
        // by the browser extension on the same issue) into local storage so
        // the upcoming overwrite of the GitHub comment carries the union of
        // both sides instead of wiping entries written elsewhere. Best-effort.
        try {
            await TimerService.backfillRemoteEntries(issueUrl, owner, repo, issueNumber);
        } catch (e) {
            console.error(LOG_PREFIX, 'pre-push backfill failed (continuing):', e);
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
     * @param {string} issueUrl
     * @param {string} owner
     * @param {string} repo
     * @param {number} issueNumber
     * @param {string|null} [running]
     * @returns {Promise<import('../../../core/src/ports/messaging.port.js').SyncCommentResult>}
     */
    syncComment(issueUrl, owner, repo, issueNumber, running = null) {
        const hadPendingJob = this.#queue.has(issueUrl);

        console.info(LOG_PREFIX, hadPendingJob ? 'Queueing tracker sync behind pending job' : 'Queueing tracker sync', {
            issueUrl,
            running: running ?? null,
        });

        const next = this.#queue.enqueue(issueUrl, () =>
            this.#syncTrackerComment({ issueUrl, owner, repo, issueNumber, running }),
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
