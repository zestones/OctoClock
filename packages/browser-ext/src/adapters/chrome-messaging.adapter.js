// packages/browser-ext/src/adapters/chrome-messaging.adapter.js

import { MessagingPort } from '../../../core/src/ports/messaging.port.js';

/**
 * Normalizes Chrome runtime error messages into user-readable strings.
 * @param {{ message?: string }} error
 * @returns {string}
 */
function normalizeSyncErrorMessage(error) {
    const message = error?.message ?? String(error);

    if (message === 'The message port closed before a response was received.') {
        return 'Background worker did not answer. Reload the extension and try again.';
    }

    if (message === 'Could not establish connection. Receiving end does not exist.') {
        return 'Background worker is not loaded. Reload the extension and try again.';
    }

    return message;
}

/**
 * Chrome MV3 implementation of MessagingPort.
 *
 * - syncComment   → chrome.runtime.sendMessage { action: 'syncTrackerComment' }
 * - notifyTimerStarted / notifyTimerStopped → fire-and-forget sendMessage
 */
export class ChromeMessagingAdapter extends MessagingPort {
    /**
     * @param {string} issueUrl
     * @param {string} owner
     * @param {string} repo
     * @param {number} issueNumber
     * @param {string|null} [running]
     * @returns {Promise<import('../../../core/src/ports/messaging.port.js').SyncCommentResult>}
     */
    syncComment(issueUrl, owner, repo, issueNumber, running = null) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: 'syncTrackerComment', issueUrl, owner, repo, issueNumber, running },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(normalizeSyncErrorMessage(chrome.runtime.lastError)));
                        return;
                    }
                    if (!response?.ok) {
                        reject(new Error(response?.error ?? 'Tracker comment sync failed'));
                        return;
                    }
                    resolve(response);
                },
            );
        });
    }

    /** @param {string} issueUrl */
    notifyTimerStarted(issueUrl) {
        chrome.runtime.sendMessage({ action: 'timerStarted', issueUrl });
    }

    /** @param {string} issueUrl */
    notifyTimerStopped(issueUrl) {
        chrome.runtime.sendMessage({ action: 'timerStopped', issueUrl });
    }
}
