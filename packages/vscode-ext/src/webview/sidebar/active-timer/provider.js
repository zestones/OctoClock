// packages/vscode-ext/src/webview/sidebar/active-timer/provider.js
//
// WebviewViewProvider for the "Active Timer" sidebar panel.
//
// Architecture:
//   - The host (provider) subscribes to storage events and sends a
//     `timerUpdate` postMessage to the webview on every state change.
//   - The webview runs its own setInterval counter so the display ticks
//     smoothly even when no storage events fire.
//   - retainContextWhenHidden: true keeps the counter alive when the panel
//     is scrolled out of view or another view is focused.
//
// postMessage protocol:
//   host → webview  { type: 'timerUpdate', payload: { running, issueNumber, repo, startTime } }
//   webview → host  { type: 'stop' }
//   webview → host  { type: 'openMyIssues' }

import * as vscode from 'vscode';
import { StorageService } from '../../../../../core/src/services/storage.service.js';
import { STORAGE_KEYS } from '../../../../../core/src/utils/constants.utils.js';
import { getHtml } from './html.js';

export class ActiveTimerProvider {
    static viewType = 'octoclock.activeTimer';

    /** @type {vscode.WebviewView | undefined} */
    _view = undefined;

    /** @type {string | null} */
    _activeIssue = null;

    /** @type {string | null} */
    _startTime = null;

    /**
     * @param {vscode.ExtensionContext} context
     * @param {import('../../../../../core/src/ports/storage-events.port.js').StorageEventsPort} events
     */
    constructor(context, events) {
        this._context = context;

        const unsubscribe = events.subscribe((event) => {
            if (event.type === 'set') {
                if (event.key === STORAGE_KEYS.ACTIVE_ISSUE) this._activeIssue = event.value ?? null;
                if (event.key === STORAGE_KEYS.START_TIME) this._startTime = event.value ?? null;
            } else if (event.type === 'remove') {
                if (event.key === STORAGE_KEYS.ACTIVE_ISSUE) this._activeIssue = null;
                if (event.key === STORAGE_KEYS.START_TIME) this._startTime = null;
            } else if (event.type === 'removeMultiple') {
                if (event.keys.includes(STORAGE_KEYS.ACTIVE_ISSUE)) this._activeIssue = null;
                if (event.keys.includes(STORAGE_KEYS.START_TIME)) this._startTime = null;
            }
            this._sendUpdate();
        });

        this.dispose = () => unsubscribe();
    }

    /** @param {vscode.WebviewView} webviewView */
    resolveWebviewView(webviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'dist')],
        };

        webviewView.webview.html = getHtml(webviewView.webview, this._context.extensionUri);

        webviewView.webview.onDidReceiveMessage((message) => {
            if (message.type === 'stop') {
                vscode.commands.executeCommand('octoclock.stopTimer');
            } else if (message.type === 'openMyIssues') {
                vscode.commands.executeCommand('octoclock.myIssues.focus');
            }
        });

        // Restore state from storage for the case where the webview was
        // created after the timer was already running (e.g. after restart).
        StorageService.getMultiple([STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME])
            .then((values) => {
                this._activeIssue = values[STORAGE_KEYS.ACTIVE_ISSUE] ?? null;
                this._startTime = values[STORAGE_KEYS.START_TIME] ?? null;
                this._sendUpdate();
            })
            .catch(() => {
                // StorageService not ready — remain in idle state.
            });
    }

    _sendUpdate() {
        if (!this._view) return;
        const running = !!(this._activeIssue && this._startTime);
        const parts = this._activeIssue ? this._activeIssue.split('/') : [];
        // ACTIVE_ISSUE path format: /owner/repo/issues/42
        // split('/') → ['', 'owner', 'repo', 'issues', '42']
        const issueNumber = parts.length >= 5 ? parts[4] : '?';
        const repo = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : '';
        this._view.webview.postMessage({
            type: 'timerUpdate',
            payload: { running, issueNumber, repo, startTime: this._startTime },
        });
    }
}
