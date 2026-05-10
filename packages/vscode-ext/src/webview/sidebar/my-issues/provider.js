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
import { getHtml } from './html.js';

/** Issue URL path pattern, e.g. /owner/repo/issues/42 */
const ISSUE_URL_RE = /^\/[^/]+\/[^/]+\/issues\/\d+$/;

/**
 * Map a stored IssueEntry to the shape the webview expects.
 * Title format: "(owner) repo | Human title | #42" — extract the middle part.
 *
 * @param {{ url: string, title: string, status?: 'open'|'closed' }} entry
 * @returns {{ id: number, title: string, status: string, repo: string, url: string }}
 */
function mapEntry(entry) {
    const parts = entry.url.split('/');
    // /owner/repo/issues/42 → ['', 'owner', 'repo', 'issues', '42']
    const id = parts.length >= 5 ? parseInt(parts[4], 10) : 0;
    const repo = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : '';

    const titleParts = entry.title.split(' | ');
    const human = titleParts.length >= 3 ? titleParts.slice(1, -1).join(' | ') : entry.title;

    return { id, title: human || entry.title, status: entry.status || 'open', repo, url: entry.url };
}

/**
 * Best-effort scan of open workspace folders for GitHub repo slugs.
 * Mirrors the logic in tracked-time-tree.js getWorkspaceRepoSlugs().
 *
 * @returns {Promise<string[]>}
 */
async function getWorkspaceRepoSlugs() {
    const folders = vscode.workspace.workspaceFolders ?? [];
    /** @type {Set<string>} */
    const slugs = new Set();
    await Promise.all(
        folders.map(async (folder) => {
            try {
                const configUri = vscode.Uri.joinPath(folder.uri, '.git', 'config');
                const bytes = await vscode.workspace.fs.readFile(configUri);
                const text = Buffer.from(bytes).toString('utf8');
                const re =
                    /url\s*=\s*(?:https?:\/\/[^\s/]*github\.com\/|git@github\.com:)([^\s/]+)\/([^\s/]+?)(?:\.git)?\s*$/gim;
                for (let m = re.exec(text); m; m = re.exec(text)) {
                    slugs.add(`${m[1]}/${m[2]}`);
                }
            } catch {
                // Not a git repo — skip.
            }
        }),
    );
    return [...slugs];
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
        /** @type {{ dispose(): unknown } | null} */
        this._branchSubscription = null;

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

        const extChangeSub = vscode.extensions.onDidChange?.(() => this._wireBranchSuggestion());
        if (extChangeSub) this._context.subscriptions.push(extChangeSub);

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

        // Re-push issues + workspace repos when workspace folders change.
        this._context.subscriptions.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => {
                this._sendIssues();
                this._sendWorkspaceRepos();
            }),
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
        this._sendWorkspaceRepos();

        // Arm branch suggestion row if git API is available.
        this._wireBranchSuggestion();
    }

    /** Detect repos in open workspace folders and post them to the webview. */
    _sendWorkspaceRepos() {
        if (!this._view) return;
        getWorkspaceRepoSlugs()
            .then((slugs) => {
                this._view?.webview.postMessage({ type: 'workspaceRepos', items: slugs });
            })
            .catch(() => {
                this._view?.webview.postMessage({ type: 'workspaceRepos', items: [] });
            });
    }

    /** Load issues from storage and post them to the webview. */
    _sendIssues() {
        if (!this._view) return;
        IssueStorageService.getAll()
            .then((entries) => {
                const items = [];
                for (const entry of entries ?? []) {
                    try {
                        if (entry && typeof entry.url === 'string') items.push(mapEntry(entry));
                    } catch (err) {
                        console.warn('[OctoClock] Skipping malformed issue entry:', entry, err);
                    }
                }
                this._view?.webview.postMessage({ type: 'issues', items });
            })
            .catch((err) => {
                console.error('[OctoClock] Failed to load issues for sidebar:', err);
                // Still flip the webview out of the loading state so users see an empty UI.
                this._view?.webview.postMessage({ type: 'issues', items: [] });
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
        if (this._branchSubscription) return;

        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension?.isActive) return;

        let git;
        try {
            git = gitExtension.exports?.getAPI?.(1);
        } catch {
            return;
        }
        if (!git) return;
        const repo = git.repositories[0];
        if (!repo) return;

        const send = () => {
            const branch = repo.state.HEAD?.name ?? null;
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
        this._branchSubscription = repo.state.onDidChange(send);
        this._context.subscriptions.push(this._branchSubscription);
    }
}
