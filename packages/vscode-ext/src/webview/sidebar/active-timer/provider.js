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
import { buildCsp } from '../../csp.js';
import { getNonce } from '../../nonce.js';

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

        webviewView.webview.html = this._getHtml(webviewView.webview);

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

    /** @param {vscode.Webview} webview */
    _getHtml(webview) {
        const nonce = getNonce();
        const csp = buildCsp(nonce, webview);
        const tokensUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'tokens.css'),
        );
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'fonts', 'codicon.ttf'),
        );

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${tokensUri}">
  <style nonce="${nonce}">
    @font-face {
      font-family: 'codicon';
      src: url('${codiconsUri}') format('truetype');
    }
    .codicon { font: normal normal 16px/1 codicon; display: inline-block; }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--oc-font-ui);
      font-size: 13px;
      color: var(--oc-fg);
      background: transparent;
      line-height: 1;
    }

    .row {
      display: flex;
      align-items: center;
      height: 22px;
      padding: 0 6px 0 20px;
      gap: 5px;
      user-select: none;
    }
    .row.h28 { height: 28px; }
    .row.timer-row {
      background: rgba(0, 122, 204, .08);
      border-left: 2px solid rgba(0, 122, 204, .45);
      padding-left: 18px;
    }
    .row.timer-row:hover { background: rgba(0, 122, 204, .13); }

    .row-icon {
      flex-shrink: 0;
      width: 16px;
      text-align: center;
      font-size: 14px;
    }
    .row-lbl {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 13px;
      color: var(--oc-fg);
    }
    .row-lbl.dim { color: var(--oc-muted); font-style: italic; }
    .row-always { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .dim-fg { color: var(--oc-desc); }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--oc-timer);
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .25; }
    }
    .dot.pulse { animation: pulse 1.8s ease-in-out infinite; }

    .timer {
      font-family: var(--oc-font-mono);
      font-size: 12px;
      font-weight: 600;
      color: var(--oc-timer);
      letter-spacing: .03em;
      flex-shrink: 0;
    }

    .btn-stop {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      font-family: var(--oc-font-ui);
      background: rgba(244, 135, 113, .1);
      color: var(--oc-danger);
      border: 1px solid rgba(244, 135, 113, .2);
      border-radius: 2px;
      padding: 0 6px;
      height: 20px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .btn-stop:hover { background: rgba(244, 135, 113, .2); }
    .btn-stop .codicon { font-size: 12px; }
  </style>
  <title>Active Timer</title>
</head>
<body>
  <div id="timer-running-row" class="row timer-row h28" style="display:none">
    <div class="dot pulse"></div>
    <i class="codicon codicon-repo row-icon" style="color:var(--oc-desc)"></i>
    <span class="row-lbl">
      <span class="dim-fg" id="timer-repo"></span>&nbsp;&rsaquo;&nbsp;<span id="timer-issue-lbl"></span>
    </span>
    <span class="timer" id="timer-display">0:00:00</span>
    <div class="row-always">
      <button type="button" class="btn-stop" id="btn-stop">
        <i class="codicon codicon-debug-stop"></i>&nbsp;Stop
      </button>
    </div>
  </div>
  <div id="timer-idle-row" class="row">
    <i class="codicon codicon-clock row-icon" style="color:var(--oc-muted)"></i>
    <span class="row-lbl dim">No active timer &mdash; start from My Issues</span>
  </div>

  <script nonce="${nonce}">
    // @ts-nocheck
    const vscode = acquireVsCodeApi();

    let startTime = null;
    let tickInterval = null;

    function fmtTimer(s) {
      const h = Math.floor(s / 3600);
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const sec = String(s % 60).padStart(2, '0');
      return h + ':' + m + ':' + sec;
    }

    function tick() {
      if (!startTime) return;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const display = document.getElementById('timer-display');
      if (display) display.textContent = fmtTimer(elapsed);
    }

    function applyState(payload) {
      const runningRow = document.getElementById('timer-running-row');
      const idleRow = document.getElementById('timer-idle-row');
      if (!runningRow || !idleRow) return;

      if (payload.running) {
        startTime = payload.startTime ? new Date(payload.startTime).getTime() : Date.now();

        const repoEl = document.getElementById('timer-repo');
        const issueEl = document.getElementById('timer-issue-lbl');
        if (repoEl) repoEl.textContent = payload.repo || '';
        if (issueEl) issueEl.textContent = '#' + (payload.issueNumber || '?');

        runningRow.style.display = '';
        idleRow.style.display = 'none';

        if (!tickInterval) {
          tick();
          tickInterval = setInterval(tick, 1000);
        }
      } else {
        startTime = null;
        if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
        runningRow.style.display = 'none';
        idleRow.style.display = '';
      }
    }

    document.getElementById('btn-stop').addEventListener('click', () => {
      vscode.postMessage({ type: 'stop' });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'timerUpdate') {
        applyState(message.payload);
      }
    });
  </script>
</body>
</html>`;
    }
}
