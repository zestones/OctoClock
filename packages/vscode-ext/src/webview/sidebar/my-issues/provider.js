// packages/vscode-ext/src/webview/sidebar/my-issues/provider.js
//
// WebviewViewProvider for the "My Issues" sidebar panel.
//
// Architecture:
//   - On resolveWebviewView, all tracked issues are loaded from
//     IssueStorageService and pushed to the webview as an `issues` message.
//   - Storage events for ACTIVE_ISSUE/START_TIME are used to keep the
//     webview's track/stop button states in sync.
//   - Workspace folder changes trigger a re-load and re-push of issues.
//   - The branch suggestion row is populated when the git extension reports
//     a branch whose name contains a 2-6 digit number matching an issue.
//
// NOTE: IssueEntry has no `status` field — all issues default to 'open'.
//       Closed-tab filtering is a no-op until status tracking is added.
//
// postMessage protocol:
//   host → webview  { type: 'issues',           items: IssueItem[] }
//   host → webview  { type: 'timerState',        running: boolean, activeIssueId: number|null }
//   host → webview  { type: 'branchSuggestion',  issueId: number, branch: string }
//   webview → host  { type: 'ready' }
//   webview → host  { type: 'startTimer',        url: string }
//   webview → host  { type: 'stopTimer' }
//   webview → host  { type: 'openUrl',           url: string }

import * as vscode from 'vscode';
import { IssueStorageService } from '../../../../../core/src/services/issue-storage.service.js';
import { StorageService } from '../../../../../core/src/services/storage.service.js';
import { STORAGE_KEYS } from '../../../../../core/src/utils/constants.utils.js';
import { buildCsp } from '../../csp.js';
import { getNonce } from '../../nonce.js';

/** Issue URL path pattern, e.g. /owner/repo/issues/42 */
const ISSUE_URL_RE = /^\/[^/]+\/[^/]+\/issues\/\d+$/;

/**
 * Map a stored IssueEntry to the shape the webview expects.
 * Title format: "(owner) repo | Human title | #42" — extract the middle part.
 *
 * @param {{ url: string, title: string }} entry
 * @returns {{ id: number, title: string, status: string, repo: string, url: string }}
 */
function mapEntry(entry) {
    const parts = entry.url.split('/');
    // /owner/repo/issues/42 → ['', 'owner', 'repo', 'issues', '42']
    const id = parts.length >= 5 ? parseInt(parts[4], 10) : 0;
    const repo = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : '';

    const titleParts = entry.title.split(' | ');
    const human = titleParts.length >= 3 ? titleParts.slice(1, -1).join(' | ') : entry.title;

    return { id, title: human || entry.title, status: 'open', repo, url: entry.url };
}

export class MyIssuesProvider {
    static viewType = 'octoclock.myIssues';

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
                if (event.key === STORAGE_KEYS.ISSUES) this._sendIssues();
            } else if (event.type === 'remove') {
                if (event.key === STORAGE_KEYS.ACTIVE_ISSUE) this._activeIssue = null;
                if (event.key === STORAGE_KEYS.START_TIME) this._startTime = null;
            } else if (event.type === 'removeMultiple') {
                if (event.keys.includes(STORAGE_KEYS.ACTIVE_ISSUE)) this._activeIssue = null;
                if (event.keys.includes(STORAGE_KEYS.START_TIME)) this._startTime = null;
            }
            this._sendTimerState();
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
            if (message.type === 'ready') {
                this._sendIssues();
                this._sendTimerState();
            } else if (message.type === 'startTimer') {
                if (typeof message.url === 'string' && ISSUE_URL_RE.test(message.url)) {
                    vscode.commands.executeCommand('octoclock.startTimer', message.url);
                }
            } else if (message.type === 'stopTimer') {
                vscode.commands.executeCommand('octoclock.stopTimer');
            } else if (message.type === 'openUrl') {
                if (typeof message.url === 'string' && ISSUE_URL_RE.test(message.url)) {
                    vscode.env.openExternal(vscode.Uri.parse(`https://github.com${message.url}`));
                }
            }
        });

        // Re-push issues when workspace folders change.
        // Issues are global (not workspace-scoped) so this is a mechanism wiring
        // for future workspace-scoped filtering.
        this._context.subscriptions.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => this._sendIssues()),
        );

        // Restore timer state from storage (webview may open after timer started).
        StorageService.getMultiple([STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME])
            .then((values) => {
                this._activeIssue = values[STORAGE_KEYS.ACTIVE_ISSUE] ?? null;
                this._startTime = values[STORAGE_KEYS.START_TIME] ?? null;
                this._sendTimerState();
            })
            .catch(() => {
                // StorageService not ready — timer state will arrive via events.
            });

        // Load and send initial issue list.
        this._sendIssues();

        // Arm branch suggestion row if git API is available.
        this._wireBranchSuggestion();
    }

    /** Load issues from storage and post them to the webview. */
    _sendIssues() {
        if (!this._view) return;
        IssueStorageService.getAll()
            .then((entries) => {
                this._view?.webview.postMessage({
                    type: 'issues',
                    items: entries.map(mapEntry),
                });
            })
            .catch(() => {
                // StorageService not ready — webview remains in loading state.
            });
    }

    /** Post current timer state to the webview. */
    _sendTimerState() {
        if (!this._view) return;
        const running = !!(this._activeIssue && this._startTime);
        const parts = this._activeIssue ? this._activeIssue.split('/') : [];
        const activeIssueId = running && parts.length >= 5 ? parseInt(parts[4], 10) : null;
        this._view.webview.postMessage({ type: 'timerState', running, activeIssueId });
    }

    /**
     * Arm the branch suggestion row using the vscode.git extension API.
     * Silently no-ops when the git extension is not available.
     */
    _wireBranchSuggestion() {
        const git = vscode.extensions.getExtension('vscode.git')?.exports?.getAPI(1);
        if (!git) return;

        const send = () => {
            const branch = git.repositories[0]?.state.HEAD?.name ?? null;
            if (!branch) return;
            const match = branch.match(/\b(\d{2,6})\b/);
            if (match) {
                this._view?.webview.postMessage({
                    type: 'branchSuggestion',
                    issueId: parseInt(match[1], 10),
                    branch,
                });
            }
        };

        // Immediate check for when the panel opens after branch is already set.
        send();
        git.repositories[0]?.state.onDidChange(send);
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

    /* ── Rows ─────────────────────────────── */
    .row {
      display: flex;
      align-items: center;
      height: 22px;
      padding: 0 6px 0 20px;
      gap: 5px;
      user-select: none;
    }
    .row.h28 { height: 28px; }
    .row:hover { background: var(--oc-hover-bg); }

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
    .row-lbl.dim { color: var(--oc-muted); }
    .row-act {
      display: none;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }
    .row:hover .row-act { display: flex; }

    /* ── Icon button ──────────────────────── */
    .ib {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      background: none;
      border: none;
      border-radius: 3px;
      color: var(--oc-fg);
      cursor: pointer;
      padding: 0;
    }
    .ib:hover { background: var(--oc-hover-bg); }
    .ib:disabled { opacity: .35; cursor: default; }
    .ib .codicon { font-size: 14px; }

    /* ── Branch suggestion row ────────────── */
    .branch-row {
      background: rgba(197, 134, 192, .06);
      border-left: 2px solid rgba(197, 134, 192, .35);
      padding-left: 18px;
    }
    .branch-row:hover { background: rgba(197, 134, 192, .12); }
    .bpill {
      font-size: 11px;
      font-family: var(--oc-font-mono);
      background: rgba(197, 134, 192, .15);
      color: var(--oc-branch);
      border-radius: 3px;
      padding: 1px 5px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .btn-track {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      font-family: var(--oc-font-ui);
      background: rgba(78, 201, 176, .1);
      color: var(--oc-timer);
      border: 1px solid rgba(78, 201, 176, .25);
      border-radius: 2px;
      padding: 0 6px;
      height: 20px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .btn-track:hover { background: rgba(78, 201, 176, .2); }
    .btn-track:disabled { opacity: .35; cursor: default; }
    .btn-track .codicon { font-size: 12px; }

    /* ── Filter bar ───────────────────────── */
    .filter-bar {
      padding: 4px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .filter-input {
      width: 100%;
      font-size: 12px;
      font-family: var(--oc-font-ui);
      color: var(--oc-input-fg);
      background: var(--oc-input-bg);
      border: 1px solid var(--oc-input-border);
      border-radius: 2px;
      padding: 3px 6px;
      outline: none;
    }
    .filter-input:focus { border-color: var(--oc-focus); }
    .filter-input::placeholder { color: var(--oc-input-placeholder); }

    .filter-tabs {
      display: flex;
      gap: 3px;
    }
    .ftab {
      font-size: 11px;
      font-family: var(--oc-font-ui);
      background: none;
      border: 1px solid transparent;
      border-radius: 2px;
      color: var(--oc-tab-inactive-fg);
      cursor: pointer;
      padding: 2px 7px;
    }
    .ftab:hover { background: var(--oc-hover-bg); }
    .ftab.on {
      color: var(--oc-fg);
      border-color: var(--oc-btn-sec-border);
      background: var(--oc-card-bg);
    }

    /* ── Empty / loading states ───────────── */
    .no-results {
      padding: 8px 20px;
      font-size: 12px;
      color: var(--oc-muted);
    }
  </style>
  <title>My Issues</title>
</head>
<body>
  <!-- Branch suggestion row (hidden until branchSuggestion message arrives) -->
  <div class="row h28 branch-row" id="branch-row" style="display:none">
    <i class="codicon codicon-git-branch row-icon" style="color:var(--oc-branch)"></i>
    <span class="bpill" id="branch-pill"></span>
    <span class="row-lbl" id="branch-lbl" style="color:var(--oc-desc);font-size:12px"></span>
    <button type="button" class="btn-track" id="branch-track-btn">
      <i class="codicon codicon-play"></i>&nbsp;Track
    </button>
  </div>

  <!-- Filter -->
  <div class="filter-bar">
    <input class="filter-input" id="issue-search" placeholder="Filter by title or #id&hellip;" autocomplete="off" />
    <div class="filter-tabs">
      <button type="button" class="ftab on" data-tab="open">Open</button>
      <button type="button" class="ftab" data-tab="closed">Closed</button>
      <button type="button" class="ftab" data-tab="all">All</button>
    </div>
  </div>

  <div id="issues-list"><div class="no-results">Loading&hellip;</div></div>

  <script nonce="${nonce}">
    // @ts-nocheck
    const vscode = acquireVsCodeApi();

    let allIssues = [];
    let activeIssueId = null;
    let timerRunning = false;
    let statusTab = 'open';
    let debounce;

    function escHtml(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function render() {
      const query = (document.getElementById('issue-search')?.value || '').toLowerCase();
      const filtered = allIssues.filter(issue => {
        const matchStatus = statusTab === 'all' || issue.status === statusTab;
        const matchQuery = !query
          || issue.title.toLowerCase().includes(query)
          || String(issue.id).includes(query.replace('#', ''));
        return matchStatus && matchQuery;
      });

      const container = document.getElementById('issues-list');
      if (!container) return;

      if (filtered.length === 0) {
        container.innerHTML = '<div class="no-results">No matching issues</div>';
        return;
      }

      container.innerHTML = filtered.map(issue => {
        const isActive = timerRunning && issue.id === activeIssueId;
        const isClosed = issue.status === 'closed';
        const iconColor = isActive ? 'var(--oc-timer)' : isClosed ? 'var(--oc-muted)' : 'var(--oc-open)';
        const iconName = isActive ? 'codicon-clock' : isClosed ? 'codicon-issue-closed' : 'codicon-issue-opened';
        const lblClass = isClosed ? ' dim' : '';
        const playBtn = isClosed ? '' : isActive
          ? '<button type="button" class="ib" title="Already tracking" disabled><i class="codicon codicon-clock"></i></button>'
          : '<button type="button" class="ib btn-start" data-url="' + escHtml(issue.url) + '" title="Start timer"><i class="codicon codicon-play"></i></button>';
        return '<div class="row" data-id="' + issue.id + '">'
          + '<i class="codicon ' + iconName + ' row-icon" style="color:' + iconColor + '"></i>'
          + '<span class="row-lbl' + lblClass + '">#' + issue.id + '&nbsp;&nbsp;' + escHtml(issue.title) + '</span>'
          + '<div class="row-act">'
          + playBtn
          + '<button type="button" class="ib btn-open" data-url="' + escHtml(issue.url) + '" title="Open in GitHub"><i class="codicon codicon-link-external"></i></button>'
          + '</div></div>';
      }).join('');
    }

    function updateBranchBtn() {
      const btn = document.getElementById('branch-track-btn');
      if (!btn || !btn.dataset.url) return;
      const issueId = parseInt(btn.dataset.url.split('/').pop(), 10);
      const tracking = timerRunning && issueId === activeIssueId;
      btn.disabled = tracking;
      btn.innerHTML = tracking
        ? '<i class="codicon codicon-clock"></i>&nbsp;Tracking'
        : '<i class="codicon codicon-play"></i>&nbsp;Track';
    }

    document.getElementById('issue-search').addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(render, 120);
    });

    document.addEventListener('click', (e) => {
      const startBtn = e.target.closest('.btn-start');
      if (startBtn) {
        vscode.postMessage({ type: 'startTimer', url: startBtn.dataset.url });
        return;
      }
      const openBtn = e.target.closest('.btn-open');
      if (openBtn) {
        vscode.postMessage({ type: 'openUrl', url: openBtn.dataset.url });
        return;
      }
      const ftab = e.target.closest('.ftab[data-tab]');
      if (ftab) {
        statusTab = ftab.dataset.tab;
        document.querySelectorAll('.ftab').forEach(b => b.classList.toggle('on', b.dataset.tab === statusTab));
        render();
        return;
      }
      const branchBtn = e.target.closest('#branch-track-btn');
      if (branchBtn && !branchBtn.disabled && branchBtn.dataset.url) {
        vscode.postMessage({ type: 'startTimer', url: branchBtn.dataset.url });
      }
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'issues') {
        allIssues = msg.items;
        render();
      } else if (msg.type === 'timerState') {
        timerRunning = msg.running;
        activeIssueId = msg.activeIssueId;
        render();
        updateBranchBtn();
      } else if (msg.type === 'branchSuggestion') {
        const issue = allIssues.find(i => i.id === msg.issueId);
        const row = document.getElementById('branch-row');
        const pill = document.getElementById('branch-pill');
        const lbl = document.getElementById('branch-lbl');
        const btn = document.getElementById('branch-track-btn');
        if (!row || !pill || !lbl || !btn) return;
        if (!issue) { row.style.display = 'none'; return; }
        pill.textContent = msg.branch;
        lbl.textContent = '#' + issue.id + ' ' + issue.title;
        btn.dataset.url = issue.url;
        row.style.display = '';
        updateBranchBtn();
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
    }
}
