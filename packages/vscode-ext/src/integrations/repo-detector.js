// packages/vscode-ext/src/integrations/repo-detector.js
//
// UI-7.1 — Auto-detect workspace repositories on activation.
//
// On activation (and on workspace folder change) enumerate the open
// workspace folders, parse `github.com/{owner}/{repo}` from each folder's
// `.git/config`, and prompt the user once per *unrecognised* repo:
// "Pin {owner}/{repo} to OctoClock?" with [Pin] [Dismiss] actions.
//
// Persistence:
//   - Pinning goes through `PinnedReposService.addPinnedRepo()`
//     (synced to `STORAGE_KEYS.PINNED_REPOS`, like the existing pin command).
//   - Dismissed repos are remembered in `globalState` under
//     `octoclock.dismissedAutoPinRepos` so we never prompt again.
//   - In-memory `_promptedThisSession` guards against re-prompting if the
//     same repo's `onDidChangeWorkspaceFolders` event fires twice in a row
//     before the user clicks anything.
//
// Pure helper `parseGitConfigForRepos` is exported for unit tests.

import * as vscode from 'vscode';
import { PinnedReposService } from '../../../core/src/services/pinned-repos.service.js';

const DISMISSED_KEY = 'octoclock.dismissedAutoPinRepos';
const UTF8_DECODER = new TextDecoder('utf-8');

/**
 * Extract the set of `owner/repo` strings from a `.git/config` blob.
 * Matches both HTTPS and SSH GitHub remotes; ignores non-GitHub remotes.
 *
 * @param {string} gitConfig
 * @returns {string[]}
 */
export function parseGitConfigForRepos(gitConfig) {
    if (!gitConfig) return [];
    /** @type {Set<string>} */
    const out = new Set();
    const re = /url\s*=\s*(?:https?:\/\/[^\s/]*github\.com\/|git@github\.com:)([^\s/]+)\/([^\s/]+?)(?:\.git)?\s*$/gim;
    for (let m = re.exec(gitConfig); m; m = re.exec(gitConfig)) {
        out.add(`${m[1]}/${m[2]}`);
    }
    return [...out];
}

/**
 * Read each workspace folder's `.git/config` and return the union of the
 * GitHub repo slugs found. Folders without a `.git/config` are silently
 * skipped (they may not be git repos at all).
 *
 * @returns {Promise<string[]>}
 */
async function detectWorkspaceRepos() {
    const folders = vscode.workspace.workspaceFolders ?? [];
    /** @type {Set<string>} */
    const found = new Set();
    await Promise.all(
        folders.map(async (folder) => {
            try {
                const configUri = vscode.Uri.joinPath(folder.uri, '.git', 'config');
                const bytes = await vscode.workspace.fs.readFile(configUri);
                const text = UTF8_DECODER.decode(bytes);
                for (const slug of parseGitConfigForRepos(text)) found.add(slug);
            } catch {
                // Not a git repo or config unreadable — skip.
            }
        }),
    );
    return [...found];
}

export class WorkspaceRepoDetector {
    /**
     * @param {vscode.ExtensionContext} context
     */
    constructor(context) {
        this._context = context;
        /** @type {Set<string>} */
        this._promptedThisSession = new Set();
        this._disposable = vscode.workspace.onDidChangeWorkspaceFolders(() => this.run());
        context.subscriptions.push(this._disposable);
    }

    /**
     * Detect repos and prompt for any new ones that haven't been pinned or
     * dismissed before. Safe to call repeatedly.
     */
    async run() {
        const detected = await detectWorkspaceRepos();
        if (detected.length === 0) return;

        const pinned = await PinnedReposService.getPinnedRepos();
        const pinnedNames = new Set(pinned.map((r) => r.fullName));
        const dismissed = new Set(/** @type {string[]} */(this._context.globalState.get(DISMISSED_KEY) ?? []));

        const candidates = detected.filter(
            (slug) => !pinnedNames.has(slug) && !dismissed.has(slug) && !this._promptedThisSession.has(slug),
        );

        for (const slug of candidates) {
            this._promptedThisSession.add(slug);
            this._promptOne(slug, dismissed).catch((e) =>
                console.error(`OctoClock: auto-pin prompt for ${slug} failed:`, e),
            );
        }
    }

    /**
     * @param {string} slug
     * @param {Set<string>} dismissed
     */
    async _promptOne(slug, dismissed) {
        const action = await vscode.window.showInformationMessage(`Pin ${slug} to OctoClock?`, 'Pin', 'Dismiss');
        if (action === 'Pin') {
            try {
                await PinnedReposService.addPinnedRepo({ fullName: slug });
                vscode.window.showInformationMessage(`OctoClock: Pinned ${slug}`);
            } catch (e) {
                vscode.window.showErrorMessage(`OctoClock: ${e instanceof Error ? e.message : String(e)}`);
            }
        } else if (action === 'Dismiss') {
            dismissed.add(slug);
            await this._context.globalState.update(DISMISSED_KEY, [...dismissed]);
        }
        // No action (notification timed out / dismissed by X) — leave
        // _promptedThisSession set so we don't spam again this session, but
        // we WILL ask again next reload (per-acceptance: prompt once per
        // unrecognised repo, not once per reload).
    }
}
