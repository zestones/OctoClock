// packages/vscode-ext/src/tracked-time-tree.js
//
// TrackedTimeProvider — drives the "Tracked Time" tree view inside the
// OctoClock activity-bar container. It is the **only** OctoClock panel
// rendered as a native TreeView (every other panel is a Webview): the
// three-level expand/collapse hierarchy is trivially correct in a TreeView
// and would be costly to reproduce inside a webview.
//
// Hierarchy:
//   RepoNode  (owner/repo, total time)
//     IssueNode  (#id title, total time, may be the active issue)
//       SessionNode  (date — duration)
//
// Data sources:
//   PINNED_REPOS  — surfaced even when no sessions recorded yet
//   TRACKED_TIMES — session entries, aggregated via AggregationService
//   ACTIVE_ISSUE  — drives the "active" icon/contextValue on the matching IssueNode
//
// Refresh triggers (TRACKED_TIMES, PINNED_REPOS, ACTIVE_ISSUE storage events).

import * as vscode from 'vscode';
import { StorageService } from '../../core/src/services/storage.service.js';
import { AggregationService } from '../../core/src/utils/aggregation.utils.js';
import { STORAGE_KEYS } from '../../core/src/utils/constants.utils.js';
import { TimeService } from '../../core/src/utils/time.utils.js';

// ---------------------------------------------------------------------------
// Workspace filter helpers
// ---------------------------------------------------------------------------

const WORKSPACE_FILTER_KEY = 'octoclock.trackedTime.workspaceFilter';
const UTF8_DECODER = new TextDecoder('utf-8');

/**
 * Returns the set of "owner/repo" pairs derivable from open workspace folders'
 * git remotes. Only matches GitHub HTTPS / SSH remotes; non-git folders or
 * folders without a `.git/config` are silently ignored.
 *
 * @returns {Promise<Set<string>>}
 */
async function getWorkspaceRepoSlugs() {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const slugs = new Set();
    await Promise.all(
        folders.map(async (folder) => {
            try {
                const configUri = vscode.Uri.joinPath(folder.uri, '.git', 'config');
                const bytes = await vscode.workspace.fs.readFile(configUri);
                const text = UTF8_DECODER.decode(bytes);
                // Match `url = ...github.com[:/]owner/repo(.git)?` on any remote.
                const re =
                    /url\s*=\s*(?:https?:\/\/[^\s/]*github\.com\/|git@github\.com:)([^\s/]+)\/([^\s/]+?)(?:\.git)?\s*$/gim;
                for (let m = re.exec(text); m; m = re.exec(text)) {
                    slugs.add(`${m[1]}/${m[2]}`);
                }
            } catch {
                // No .git/config — folder isn't a git repo. Skip.
            }
        }),
    );
    return slugs;
}

// ---------------------------------------------------------------------------
// Node classes
// ---------------------------------------------------------------------------

export class TrackedRepoNode extends vscode.TreeItem {
    /**
     * @param {string} fullName       e.g. "owner/repo"
     * @param {number} totalSeconds   aggregate of all child issue sessions
     * @param {TrackedIssueNode[]} issueNodes
     */
    constructor(fullName, totalSeconds, issueNodes) {
        const state =
            issueNodes.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        super(fullName, state);
        this.fullName = fullName;
        this.issueNodes = issueNodes;
        this.totalSeconds = totalSeconds;
        this.iconPath = new vscode.ThemeIcon('repo');
        this.description = totalSeconds > 0 ? TimeService.formatHuman(totalSeconds) : '';
        this.tooltip = totalSeconds > 0 ? `Total: ${TimeService.formatHuman(totalSeconds)}` : 'No sessions yet';
        this.contextValue = 'oc-repo';
    }
}

export class TrackedIssueNode extends vscode.TreeItem {
    /**
     * @param {string} issueUrl       e.g. "/owner/repo/issues/123"
     * @param {string} displayTitle
     * @param {number} totalSeconds
     * @param {TrackedSessionNode[]} sessionNodes
     * @param {boolean} isActive      true when this issue currently has the running timer
     */
    constructor(issueUrl, displayTitle, totalSeconds, sessionNodes, isActive) {
        const state =
            sessionNodes.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        super(displayTitle, state);
        this.issueUrl = issueUrl;
        this.totalSeconds = totalSeconds;
        this.sessionNodes = sessionNodes;
        this.isActive = isActive;
        this.description = TimeService.formatHuman(totalSeconds);
        this.tooltip = `${issueUrl}\nTotal: ${TimeService.formatHuman(totalSeconds)}`;
        if (isActive) {
            this.iconPath = new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.green'));
            this.contextValue = 'oc-issue-active';
        } else {
            this.iconPath = new vscode.ThemeIcon('history');
            this.contextValue = 'oc-issue';
        }
    }
}

export class TrackedSessionNode extends vscode.TreeItem {
    /**
     * @param {string} issueUrl
     * @param {string} date     "YYYY-MM-DD"
     * @param {number} seconds
     */
    constructor(issueUrl, date, seconds) {
        super(date, vscode.TreeItemCollapsibleState.None);
        this.issueUrl = issueUrl;
        this.date = date;
        this.seconds = seconds;
        this.description = TimeService.formatHuman(seconds);
        this.tooltip = `${date} — ${TimeService.formatHuman(seconds)}`;
        this.iconPath = new vscode.ThemeIcon('history');
        this.contextValue = 'oc-session';
    }
}

export class WorkspaceFilterNode extends vscode.TreeItem {
    /** @param {boolean} enabled */
    constructor(enabled) {
        super('Workspace filter', vscode.TreeItemCollapsibleState.None);
        this.description = enabled ? 'on' : 'off';
        this.tooltip = enabled ? 'Showing repositories from this workspace only' : 'Showing all pinned repositories';
        this.iconPath = new vscode.ThemeIcon(enabled ? 'filter-filled' : 'filter');
        this.contextValue = 'oc-workspace-filter';
        this.command = {
            command: 'octoclock.toggleWorkspaceFilter',
            title: 'Toggle workspace filter',
        };
    }
}

/**
 * Synthetic root node displayed at the top of Tracked Time while a timer is
 * running. Visually elevates the active issue so it is never buried inside a
 * collapsed repo node (matches the mockup's `timer-row`).
 */
export class CurrentlyTrackingNode extends vscode.TreeItem {
    /**
     * @param {string} issueUrl
     * @param {string} displayTitle
     */
    constructor(issueUrl, displayTitle) {
        super(displayTitle, vscode.TreeItemCollapsibleState.None);
        this.issueUrl = issueUrl;
        this.iconPath = new vscode.ThemeIcon('record', new vscode.ThemeColor('charts.green'));
        this.description = 'tracking\u2026';
        this.tooltip = `Currently tracking ${issueUrl}`;
        this.contextValue = 'oc-currently-tracking';
        this.command = {
            command: 'octoclock.openActiveTimer',
            title: 'Show active timer',
        };
    }
}

// ---------------------------------------------------------------------------
// Tree data provider
// ---------------------------------------------------------------------------

export class TrackedTimeProvider {
    static viewType = 'octoclock.trackedTime';

    /** @type {vscode.EventEmitter<undefined>} */
    #emitter = new vscode.EventEmitter();

    /** VS Code subscribes to this for tree refreshes. */
    onDidChangeTreeData = this.#emitter.event;

    /** @type {() => void} */
    #unsubscribe;

    /** @type {() => void} */
    #fsWatcherDispose;

    /** @type {import('vscode').ExtensionContext} */
    #context;

    /**
     * @param {import('vscode').ExtensionContext} context
     * @param {import('../../core/src/ports/storage-events.port.js').StorageEventsPort} events
     */
    constructor(context, events) {
        this.#context = context;
        this.#unsubscribe = events.subscribe((event) => {
            const keys = event.type === 'removeMultiple' ? event.keys : [event.key];
            if (
                keys.includes(STORAGE_KEYS.TRACKED_TIMES) ||
                keys.includes(STORAGE_KEYS.PINNED_REPOS) ||
                keys.includes(STORAGE_KEYS.ACTIVE_ISSUE)
            ) {
                this.refresh();
            }
        });

        // Refresh when workspace folders change so the workspace filter stays correct.
        const wsListener = vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh());
        this.#fsWatcherDispose = () => wsListener.dispose();
    }

    /** @returns {boolean} */
    get workspaceFilterEnabled() {
        return this.#context.globalState.get(WORKSPACE_FILTER_KEY, false);
    }

    /**
     * Toggle the workspace filter and refresh the view. Persists in globalState.
     * @returns {Promise<boolean>} the new state
     */
    async toggleWorkspaceFilter() {
        const next = !this.workspaceFilterEnabled;
        await this.#context.globalState.update(WORKSPACE_FILTER_KEY, next);
        await vscode.commands.executeCommand('setContext', 'octoclock.trackedTime.workspaceFilter', next);
        this.refresh();
        return next;
    }

    /** Force a re-render of the tree. */
    refresh() {
        this.#emitter.fire(undefined);
    }

    /** @param {vscode.TreeItem} element */
    getTreeItem(element) {
        return element;
    }

    /**
     * @param {TrackedRepoNode | TrackedIssueNode | TrackedSessionNode | undefined} element
     */
    async getChildren(element) {
        if (!element) {
            const [repos, activeIssue] = await Promise.all([
                this.#buildRepoNodes(),
                StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE),
            ]);
            const head = [new WorkspaceFilterNode(this.workspaceFilterEnabled)];
            if (activeIssue) {
                const title = this.#findIssueTitle(repos, activeIssue) || activeIssue;
                head.push(new CurrentlyTrackingNode(activeIssue, title));
            }
            return [...head, ...repos];
        }
        if (element instanceof TrackedRepoNode) return element.issueNodes;
        if (element instanceof TrackedIssueNode) return element.sessionNodes;
        return [];
    }

    /**
     * Look up the human title of an active issue from the freshly-built repo
     * subtree to avoid a second storage read.
     * @param {TrackedRepoNode[]} repos
     * @param {string} activeIssueUrl
     * @returns {string | null}
     */
    #findIssueTitle(repos, activeIssueUrl) {
        for (const repo of repos) {
            for (const issue of repo.issueNodes) {
                if (issue.issueUrl === activeIssueUrl) return String(issue.label);
            }
        }
        return null;
    }

    /** @returns {Promise<TrackedRepoNode[]>} */
    async #buildRepoNodes() {
        const [pinned, trackedTimes, activeIssue] = await Promise.all([
            StorageService.get(STORAGE_KEYS.PINNED_REPOS),
            StorageService.get(STORAGE_KEYS.TRACKED_TIMES),
            StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE),
        ]);

        const pinnedNames = (pinned ?? []).map((r) => r.fullName);
        const breakdown = AggregationService.getRepoBreakdownDetailed(trackedTimes ?? []);
        const trackedNames = Object.keys(breakdown);
        let allNames = [...new Set([...pinnedNames, ...trackedNames])];

        if (this.workspaceFilterEnabled) {
            const wsSlugs = await getWorkspaceRepoSlugs();
            allNames = allNames.filter((n) => wsSlugs.has(n));
        }

        return allNames.map((fullName) => {
            const issueMap = breakdown[fullName] ?? {};
            const issueNodes = Object.entries(issueMap).map(([issueUrl, data]) => {
                const sessionNodes = data.sessions.map((s) => new TrackedSessionNode(issueUrl, s.date, s.seconds));
                return new TrackedIssueNode(
                    issueUrl,
                    data.title || issueUrl,
                    data.totalSeconds,
                    sessionNodes,
                    issueUrl === activeIssue,
                );
            });
            const totalSeconds = issueNodes.reduce((s, n) => s + n.totalSeconds, 0);
            return new TrackedRepoNode(fullName, totalSeconds, issueNodes);
        });
    }

    dispose() {
        this.#unsubscribe();
        this.#fsWatcherDispose?.();
        this.#emitter.dispose();
    }
}
