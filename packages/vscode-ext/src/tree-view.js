// packages/vscode-ext/src/tree-view.js
//
// RepoTreeProvider — drives the "OctoClock" tree view in the VS Code Explorer.
//
// Node hierarchy:
//   RepoNode  (owner/repo)
//     IssueNode  (#123 – Fix the bug, "1h 23min")
//       SessionNode  (2025-05-09 — 45min)
//
// Data sources:
//   PINNED_REPOS  – always shown even if no sessions recorded yet
//   TRACKED_TIMES – session entries; aggregated via AggregationService
//
// The tree refreshes when TRACKED_TIMES or PINNED_REPOS changes. All other
// storage events are ignored. The entire subtree is rebuilt on each refresh
// (data is small; lazy per-level storage reads add complexity for no gain).

import * as vscode from 'vscode';
import { AggregationService } from '../../core/src/utils/aggregation.utils.js';
import { StorageService } from '../../core/src/services/storage.service.js';
import { STORAGE_KEYS } from '../../core/src/utils/constants.utils.js';
import { TimeService } from '../../core/src/utils/time.utils.js';

// ---------------------------------------------------------------------------
// Node classes
// ---------------------------------------------------------------------------

export class RepoNode extends vscode.TreeItem {
    /**
     * @param {string} fullName - e.g. "owner/repo"
     * @param {number} totalSeconds - aggregate of all issue sessions
     * @param {IssueNode[]} issueNodes - pre-built children
     */
    constructor(fullName, totalSeconds, issueNodes) {
        const state =
            issueNodes.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;
        super(fullName, state);
        this.fullName = fullName;
        this.issueNodes = issueNodes;
        this.tooltip =
            totalSeconds > 0
                ? `Total: ${TimeService.formatHuman(totalSeconds)}`
                : 'No sessions yet';
        this.contextValue = 'octoclock.repo';
    }
}

export class IssueNode extends vscode.TreeItem {
    /**
     * @param {string} issueUrl - canonical issue path from stored entry, e.g. "/owner/repo/issues/123"
     * @param {string} displayTitle - human-readable title
     * @param {number} totalSeconds
     * @param {SessionNode[]} sessionNodes - pre-built children
     */
    constructor(issueUrl, displayTitle, totalSeconds, sessionNodes) {
        super(displayTitle, vscode.TreeItemCollapsibleState.Collapsed);
        this.issueUrl = issueUrl;
        this.totalSeconds = totalSeconds;
        this.sessionNodes = sessionNodes;
        this.description = TimeService.formatHuman(totalSeconds);
        this.tooltip = `${issueUrl}\nTotal: ${TimeService.formatHuman(totalSeconds)}`;
        this.contextValue = 'octoclock.issue';
    }
}

export class SessionNode extends vscode.TreeItem {
    /**
     * @param {string} date - "YYYY-MM-DD"
     * @param {number} seconds
     */
    constructor(date, seconds) {
        super(`${date} — ${TimeService.formatHuman(seconds)}`, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'octoclock.session';
    }
}

// ---------------------------------------------------------------------------
// Tree data provider
// ---------------------------------------------------------------------------

export class RepoTreeProvider {
    /** @type {vscode.EventEmitter<undefined>} */
    #emitter = new vscode.EventEmitter();

    /**
     * VS Code reads this property to subscribe to tree change events.
     * @type {vscode.Event<undefined>}
     */
    onDidChangeTreeData = this.#emitter.event;

    /** @type {() => void} */
    #unsubscribe;

    /**
     * @param {import('../../core/src/ports/storage-events.port.js').StorageEventsPort} events
     */
    constructor(events) {
        this.#unsubscribe = events.subscribe((event) => {
            const keys =
                event.type === 'removeMultiple' ? event.keys : [event.key];
            if (
                keys.includes(STORAGE_KEYS.TRACKED_TIMES) ||
                keys.includes(STORAGE_KEYS.PINNED_REPOS)
            ) {
                this.#emitter.fire(undefined);
            }
        });
    }

    /**
     * @param {RepoNode | IssueNode | SessionNode} element
     */
    getTreeItem(element) {
        return element;
    }

    /**
     * @param {RepoNode | IssueNode | SessionNode | undefined} element
     * @returns {Promise<(RepoNode | IssueNode | SessionNode)[]>}
     */
    async getChildren(element) {
        if (!element) {
            return this.#buildRepoNodes();
        }
        if (element instanceof RepoNode) {
            return element.issueNodes;
        }
        if (element instanceof IssueNode) {
            return element.sessionNodes;
        }
        return [];
    }

    /**
     * Loads storage once and builds the full tree eagerly.
     * @returns {Promise<RepoNode[]>}
     */
    async #buildRepoNodes() {
        const [pinned, trackedTimes] = await Promise.all([
            StorageService.get(STORAGE_KEYS.PINNED_REPOS),
            StorageService.get(STORAGE_KEYS.TRACKED_TIMES),
        ]);

        const pinnedNames = (pinned ?? []).map((r) => r.fullName);
        const breakdown = AggregationService.getRepoBreakdownDetailed(trackedTimes ?? []);
        const trackedNames = Object.keys(breakdown);

        // Union: pinned repos (always shown) + repos with tracked time.
        // Set preserves insertion order; pinnedNames come first.
        const allNames = [...new Set([...pinnedNames, ...trackedNames])];

        return allNames.map((fullName) => {
            const issueMap = breakdown[fullName] ?? {};

            const issueNodes = Object.entries(issueMap).map(([issueUrl, data]) => {
                // issueUrl is the raw key from getRepoBreakdownDetailed — it IS
                // the stored TrackedTimeEntry.issueUrl, never derived from labels.
                const sessionNodes = data.sessions.map(
                    (s) => new SessionNode(s.date, s.seconds),
                );
                return new IssueNode(
                    issueUrl,
                    data.title || issueUrl,
                    data.totalSeconds,
                    sessionNodes,
                );
            });

            const totalSeconds = issueNodes.reduce((s, n) => s + n.totalSeconds, 0);
            return new RepoNode(fullName, totalSeconds, issueNodes);
        });
    }

    dispose() {
        this.#unsubscribe();
        this.#emitter.dispose();
    }
}
