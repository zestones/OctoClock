// packages/core/src/ports/messaging.port.js

/**
 * Platform-neutral interface for cross-context messaging.
 *
 * @typedef {{ commentId: number }} SyncCommentResult
 */

export class MessagingPort {
    /**
     * Queue a tracker-comment sync for the given issue.
     * Returns a promise that resolves with the comment ID once the sync completes.
     *
     * @param {string} _issueUrl
     * @param {string} _owner
     * @param {string} _repo
     * @param {number} _issueNumber
     * @returns {Promise<SyncCommentResult>}
     */
    syncComment(_issueUrl, _owner, _repo, _issueNumber) {
        throw new Error('MessagingPort.syncComment not implemented');
    }

    /**
     * Notify that a timer has started for the given issue URL.
     * In environments without browser tabs (e.g. VS Code) this is a no-op.
     *
     * @param {string} _issueUrl
     * @returns {void}
     */
    notifyTimerStarted(_issueUrl) {
        throw new Error('MessagingPort.notifyTimerStarted not implemented');
    }

    /**
     * Notify that a timer has stopped for the given issue URL.
     * In environments without browser tabs (e.g. VS Code) this is a no-op.
     *
     * @param {string} _issueUrl
     * @returns {void}
     */
    notifyTimerStopped(_issueUrl) {
        throw new Error('MessagingPort.notifyTimerStopped not implemented');
    }
}
