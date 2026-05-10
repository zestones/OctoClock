// packages/vscode-ext/src/integrations/branch-watcher.js
//
// UI-7.2 — Status-bar / window notification when HEAD changes to a branch
// matching a known issue and no timer is currently running.
//
// Behaviour:
//   - Listens to the vscode.git extension API for HEAD-name changes.
//   - When the new branch name contains a 2-6 digit number that matches an
//     issue tracked in IssueStorageService **and** ACTIVE_ISSUE is empty,
//     show a one-time information notification with [Start tracking] action.
//   - Auto-dismiss is handled by VS Code's notification stack — we do not
//     re-suggest the same `(repoFullName, issueNumber, branch)` triple
//     again until the branch changes.
//
// Why not a `StatusBarItem`? VS Code's information notifications already
// auto-dismiss and surface the action button. A status bar suggestion would
// require a custom item plus a dismissal mechanism — strictly more code for
// the same UX. The notification is the idiomatic VS Code surface.
//
// Pure helper `findMatchingIssue` is exported for unit testing.

import * as vscode from 'vscode';
import { IssueStorageService } from '../../../core/src/services/issue-storage.service.js';
import { StorageService } from '../../../core/src/services/storage.service.js';
import { STORAGE_KEYS } from '../../../core/src/utils/constants.utils.js';

/**
 * Try to locate an issue whose number appears in `branch`. Prefers a match
 * inside `repoFullName` (when provided) so an unrelated `feature/42` branch
 * in repo A doesn't match issue #42 in repo B.
 *
 * @param {string} branch
 * @param {Array<{ url: string, title?: string }>} issues
 * @param {string | null} [repoFullName]   e.g. "owner/repo" — used to scope match
 * @returns {{ url: string, number: number } | null}
 */
export function findMatchingIssue(branch, issues, repoFullName = null) {
    if (!branch || !Array.isArray(issues) || issues.length === 0) return null;
    const m = branch.match(/\b(\d{2,6})\b/);
    if (!m) return null;
    const number = parseInt(m[1], 10);

    /** @type {{ url: string, number: number } | null} */
    let scoped = null;
    /** @type {{ url: string, number: number } | null} */
    let any = null;
    for (const i of issues) {
        const parts = i.url.split('/'); // /owner/repo/issues/N
        if (parts.length < 5) continue;
        const n = parseInt(parts[4], 10);
        if (n !== number) continue;
        const slug = `${parts[1]}/${parts[2]}`;
        if (repoFullName && slug === repoFullName) {
            scoped = { url: i.url, number: n };
            break;
        }
        if (!any) any = { url: i.url, number: n };
    }
    return scoped ?? any;
}

export class BranchWatcher {
    /** @param {vscode.ExtensionContext} context */
    constructor(context) {
        this._context = context;
        /** @type {string | null} */
        this._lastBranchSuggested = null;
        /** @type {{ dispose(): unknown } | null} */
        this._stateSubscription = null;

        // The git extension may not be ready immediately — try now and
        // whenever the set of active extensions changes (e.g. vscode.git
        // finishes its own lazy activation). We must NOT call ext.activate()
        // ourselves: VS Code throws if an extension tries to activate another.
        this._tryWire();
        const extChangeSub = vscode.extensions.onDidChange?.(() => this._tryWire());
        if (extChangeSub) this._context.subscriptions.push(extChangeSub);
    }

    _tryWire() {
        if (this._stateSubscription) return;
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension?.isActive) return;

        let api;
        try {
            api = gitExtension.exports?.getAPI?.(1);
        } catch {
            return;
        }
        if (!api) return;
        const repo = api.repositories[0];
        if (!repo) {
            // Wait for the first repo to be opened.
            const sub = api.onDidOpenRepository(() => this._tryWire());
            this._context.subscriptions.push(sub);
            return;
        }
        // Initial check for when activation happens after a branch is already
        // checked out.
        this._onHeadChanged(repo).catch(() => {});
        this._stateSubscription = repo.state.onDidChange(() => {
            this._onHeadChanged(repo).catch(() => {});
        });
        this._context.subscriptions.push(this._stateSubscription);
    }

    /** @param {any} repo */
    async _onHeadChanged(repo) {
        const branch = repo?.state?.HEAD?.name;
        if (!branch || branch === this._lastBranchSuggested) return;
        this._lastBranchSuggested = branch;

        const active = await StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE);
        if (active) return; // Timer is running — do not interrupt.

        const issues = await IssueStorageService.getAll();
        const repoSlug = this._slugFromRepo(repo);
        const match = findMatchingIssue(branch, issues, repoSlug);
        if (!match) return;

        const action = await vscode.window.showInformationMessage(
            `Start tracking #${match.number} from branch ${branch}?`,
            'Start tracking',
            'Dismiss',
        );
        if (action === 'Start tracking') {
            vscode.commands.executeCommand('octoclock.startTimer', match.url);
        }
    }

    /**
     * Best-effort `owner/repo` extraction from the git repo's first GitHub remote.
     * Returns null when no GitHub remote is configured.
     *
     * @param {any} repo
     * @returns {string | null}
     */
    _slugFromRepo(repo) {
        const remotes = repo?.state?.remotes ?? [];
        for (const r of remotes) {
            const url = r.fetchUrl || r.pushUrl || '';
            const m = /(?:https?:\/\/[^/]*github\.com\/|git@github\.com:)([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i.exec(url);
            if (m) return `${m[1]}/${m[2]}`;
        }
        return null;
    }
}
