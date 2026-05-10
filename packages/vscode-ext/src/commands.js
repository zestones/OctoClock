// packages/vscode-ext/src/commands.js
//
// Registers all OctoClock VS Code commands and wires them to core services.
//
// Each command handler is pushed onto context.subscriptions so VS Code
// disposes the registration when the extension is deactivated.

import * as vscode from 'vscode';
import { GitHubService } from '../../core/src/services/github.service.js';
import { GitHubStorageService } from '../../core/src/services/github-storage.service.js';
import { PinnedReposService } from '../../core/src/services/pinned-repos.service.js';
import { StorageService } from '../../core/src/services/storage.service.js';
import { syncFromGitHub, syncRepoFromGitHub } from '../../core/src/services/sync.service.js';
import { TimerService } from '../../core/src/services/timer.service.js';
import { STORAGE_KEYS } from '../../core/src/utils/constants.utils.js';
import { TimeService } from '../../core/src/utils/time.utils.js';

/**
 * Parses a "HH:MM:SS" string into total seconds.
 * Returns null if the format is invalid or the resulting duration is zero.
 *
 * Exported for unit testing.
 *
 * @param {string} raw
 * @returns {number | null}
 */
export function parseDuration(raw) {
    const match = raw.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (!match) return null;
    const total = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    return total > 0 ? total : null;
}

/**
 * Converts a raw user-supplied string into the path form that internal
 * services expect: `/owner/repo/issues/123`.
 *
 * Accepts:
 *   - Full HTTPS URLs:  https://github.com/owner/repo/issues/123
 *   - Path form:        /owner/repo/issues/123
 *
 * Returns null for anything that cannot be recognised — the command handler
 * must show an error and bail out without calling downstream services.
 *
 * Exported for unit testing.
 *
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizeIssueUrl(raw) {
    const trimmed = raw.trim();

    // Full HTTPS URL — extract the path portion
    const full = trimmed.match(/^https?:\/\/github\.com(\/[^/]+\/[^/]+\/issues\/\d+)$/);
    if (full) return full[1];

    // Already in path form
    if (/^\/[^/]+\/[^/]+\/issues\/\d+$/.test(trimmed)) return trimmed;

    return null;
}

/**
 * Register all OctoClock commands and attach their disposables to the
 * extension context so they are automatically cleaned up on deactivation.
 *
 * @param {import('vscode').ExtensionContext} context
 */
export function registerCommands(context) {
    context.subscriptions.push(
        // ----------------------------------------------------------------
        // octoclock.startTimer [issueUrl? | TreeItem?]
        // Accepts either a URL string (e.g. from My Issues), a TreeItem with an
        // `issueUrl` property (Tracked Time inline action), or no argument
        // (fall back to the interactive InputBox flow).
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.startTimer', async (arg) => {
            let issueUrl = typeof arg === 'string' ? arg : arg?.issueUrl;
            if (!issueUrl) {
                const raw = await vscode.window.showInputBox({
                    prompt: 'Enter the GitHub issue URL',
                    placeHolder: 'https://github.com/owner/repo/issues/123',
                });

                if (!raw) return; // user pressed Escape or left the input empty

                issueUrl = normalizeIssueUrl(raw);
                if (!issueUrl) {
                    vscode.window.showErrorMessage(
                        `OctoClock: Invalid issue URL — expected https://github.com/owner/repo/issues/123 format`,
                    );
                    return;
                }
            }

            try {
                const result = await TimerService.startTimer(issueUrl);
                if (result.isRunning) {
                    vscode.window.showInformationMessage(`OctoClock: Timer started for ${issueUrl}`);
                } else {
                    vscode.window.showWarningMessage(`OctoClock: Failed to start timer for ${issueUrl}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`OctoClock: ${error instanceof Error ? error.message : String(error)}`);
            }
        }),

        // ----------------------------------------------------------------
        // octoclock.stopTimer
        // Stop the currently active timer. No-op with a notice if none running.
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.stopTimer', async () => {
            const issueUrl = await StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE);
            if (!issueUrl) {
                vscode.window.showInformationMessage('OctoClock: No timer is currently running');
                return;
            }

            try {
                await TimerService.stopTimer(issueUrl);
                vscode.window.showInformationMessage(`OctoClock: Timer stopped for ${issueUrl}`);
            } catch (error) {
                vscode.window.showErrorMessage(`OctoClock: ${error instanceof Error ? error.message : String(error)}`);
            }
        }),

        // ----------------------------------------------------------------
        // octoclock.syncNow
        // Pull issues from GitHub for all pinned repos, then sync the
        // tracker comment for the currently active issue (if any).
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.syncNow', async () => {
            const issueUrl = await StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE);
            const errors = [];

            try {
                await syncFromGitHub();
            } catch (error) {
                errors.push(`pull issues: ${error instanceof Error ? error.message : String(error)}`);
            }

            if (issueUrl) {
                try {
                    const { owner, repo, issueNumber } = GitHubService.parseIssueUrl(issueUrl);
                    await TimerService.syncComment(issueUrl, owner, repo, issueNumber);
                } catch (error) {
                    errors.push(`tracker comment: ${error instanceof Error ? error.message : String(error)}`);
                }
            }

            if (errors.length > 0) {
                vscode.window.showErrorMessage(`OctoClock: Sync failed — ${errors.join('; ')}`);
            } else if (issueUrl) {
                vscode.window.showInformationMessage('OctoClock: Issues pulled and tracker comment synced');
            } else {
                vscode.window.showInformationMessage('OctoClock: Issues pulled from GitHub');
            }
        }),

        // ----------------------------------------------------------------
        // octoclock.pinRepo
        // Prompt for an owner/repo string, pin it via PinnedReposService,
        // then fire-and-forget syncRepoFromGitHub when AUTO_SYNC is on.
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.pinRepo', async () => {
            const raw = await vscode.window.showInputBox({
                prompt: 'Enter the GitHub repository to pin',
                placeHolder: 'owner/repo',
                validateInput(v) {
                    const parts = v.trim().split('/');
                    return parts.length === 2 && parts[0] && parts[1] ? null : 'Expected format: owner/repo';
                },
            });
            if (!raw) return;
            const parts = raw.trim().split('/');
            if (parts.length !== 2 || !parts[0] || !parts[1]) {
                vscode.window.showErrorMessage('OctoClock: Invalid repository format — use owner/repo');
                return;
            }
            const [owner, repoName] = parts;
            const fullName = `${owner}/${repoName}`;
            try {
                await PinnedReposService.addPinnedRepo({ fullName });
                vscode.window.showInformationMessage(`OctoClock: Pinned ${fullName}`);
                const autoSync = await StorageService.get(STORAGE_KEYS.AUTO_SYNC);
                if (autoSync) {
                    syncRepoFromGitHub(owner, repoName).catch((e) =>
                        console.error(`OctoClock: Auto-sync failed for ${fullName}:`, e),
                    );
                }
            } catch (error) {
                vscode.window.showErrorMessage(`OctoClock: ${error instanceof Error ? error.message : String(error)}`);
            }
        }),

        // ----------------------------------------------------------------
        // octoclock.unpinRepo
        // Remove a pinned repository via the tree-view context menu.
        // The item argument is the RepoNode that was right-clicked.
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.unpinRepo', async (item) => {
            if (!item?.fullName) return;
            try {
                await PinnedReposService.removePinnedRepo(item.fullName);
                vscode.window.showInformationMessage(`OctoClock: Unpinned ${item.fullName}`);
            } catch (error) {
                vscode.window.showErrorMessage(`OctoClock: ${error instanceof Error ? error.message : String(error)}`);
            }
        }),

        // ----------------------------------------------------------------
        // octoclock.deleteSession
        // Remove a single session from TRACKED_TIMES via the tree-view
        // context menu. The item argument is the SessionNode that was
        // right-clicked — VS Code passes it automatically.
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.deleteSession', async (item) => {
            if (!item?.issueUrl || !item?.date || item?.seconds === undefined) return;
            try {
                const result = await TimerService.deleteSession(item.issueUrl, item.date, item.seconds);
                if (result.ok) {
                    vscode.window.showInformationMessage('OctoClock: Session deleted');
                } else {
                    vscode.window.showWarningMessage('OctoClock: Session not found');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`OctoClock: ${error instanceof Error ? error.message : String(error)}`);
            }
        }),

        // ----------------------------------------------------------------
        // octoclock.editSession
        // Update a single session duration via the tree-view context menu.
        // Pre-fills the input box with the current HH:MM:SS value.
        // ----------------------------------------------------------------
        // octoclock.openActiveTimer
        // Reveals the Active Timer WebviewView in the OctoClock sidebar.
        // Used as the status bar item click handler so the user can see
        // the running timer details without stopping it.
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.openActiveTimer', () => {
            vscode.commands.executeCommand('octoclock.activeTimer.focus');
        }),

        // octoclock.editSession
        // Update a single session duration via the tree-view context menu.
        // Pre-fills the input box with the current HH:MM:SS value.
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.editSession', async (item) => {
            if (!item?.issueUrl || !item?.date || item?.seconds === undefined) return;
            const raw = await vscode.window.showInputBox({
                prompt: 'Enter new duration (HH:MM:SS)',
                value: TimeService.formatTime(item.seconds),
                validateInput(v) {
                    return parseDuration(v) === null
                        ? 'Expected HH:MM:SS format with duration greater than zero'
                        : null;
                },
            });
            if (!raw) return;
            const newSeconds = parseDuration(raw);
            if (newSeconds === null) {
                vscode.window.showErrorMessage('OctoClock: Invalid duration — use HH:MM:SS format');
                return;
            }
            try {
                const result = await TimerService.updateSessionTime(item.issueUrl, item.date, item.seconds, newSeconds);
                if (result.ok) {
                    vscode.window.showInformationMessage('OctoClock: Session updated');
                } else {
                    vscode.window.showWarningMessage('OctoClock: Session not found');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`OctoClock: ${error instanceof Error ? error.message : String(error)}`);
            }
        }),

        // ----------------------------------------------------------------
        // octoclock.configureToken  (UI-8 #65)
        // Prompt for a GitHub personal access token and persist it.
        // The token is routed by VSCodeStorageAdapter into context.secrets
        // (OS keychain). Submitting an empty value clears the stored token.
        // After a successful update we trigger a non-blocking sync so freshly
        // authorised users see their data without a manual refresh.
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.configureToken', async () => {
            const existing = await GitHubStorageService.getGitHubToken().catch(() => null);
            const raw = await vscode.window.showInputBox({
                password: true,
                prompt: existing
                    ? 'Replace GitHub personal access token (leave empty to remove)'
                    : 'Enter your GitHub personal access token',
                placeHolder: 'ghp_… or github_pat_…',
                ignoreFocusOut: true,
            });
            if (raw === undefined) return; // user pressed Escape

            const token = raw.trim();
            if (token === '') {
                await GitHubStorageService.removeGitHubToken();
                vscode.window.showInformationMessage('OctoClock: GitHub token removed');
                return;
            }

            if (!GitHubStorageService.isValidTokenFormat(token)) {
                vscode.window.showErrorMessage(
                    'OctoClock: Token format not recognised — expected ghp_… or github_pat_…',
                );
                return;
            }

            try {
                await GitHubStorageService.setGitHubToken(token);
                vscode.window.showInformationMessage('OctoClock: GitHub token saved');
                syncFromGitHub().catch((e) => console.error('OctoClock: post-token sync failed:', e));
            } catch (error) {
                vscode.window.showErrorMessage(
                    `OctoClock: Failed to save token — ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }),

        // ----------------------------------------------------------------
        // octoclock.toggleAutoSync  (UI-8)
        // Flip the AUTO_SYNC flag in StorageService. The browser-ext share
        // this storage key, so the toggle lives in StorageService rather
        // than in vscode configuration.
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.toggleAutoSync', async () => {
            const current = await StorageService.get(STORAGE_KEYS.AUTO_SYNC);
            const next = !current;
            await StorageService.set(STORAGE_KEYS.AUTO_SYNC, next);
            vscode.window.showInformationMessage(`OctoClock: Auto Sync ${next ? 'enabled' : 'disabled'}`);
        }),

        // ----------------------------------------------------------------
        // octoclock.toggleIdleReminder  (UI-8)
        // Flip the octoclock.idleReminderEnabled configuration value at
        // the Global scope so it follows the user across workspaces.
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.toggleIdleReminder', async () => {
            const cfg = vscode.workspace.getConfiguration('octoclock');
            const next = !(cfg.get('idleReminderEnabled', true) !== false);
            await cfg.update('idleReminderEnabled', next, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`OctoClock: Idle Reminder ${next ? 'enabled' : 'disabled'}`);
        }),

        // ----------------------------------------------------------------
        // octoclock.editIdleMinutes  (UI-8)
        // Prompt for an integer in [1, 240] and persist as
        // octoclock.idleReminderMinutes (Global scope).
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.editIdleMinutes', async () => {
            const cfg = vscode.workspace.getConfiguration('octoclock');
            const current = String(Number(cfg.get('idleReminderMinutes', 30)) || 30);
            const raw = await vscode.window.showInputBox({
                prompt: 'Idle reminder threshold in minutes (1–240)',
                value: current,
                validateInput(v) {
                    const n = Number(v);
                    if (!Number.isInteger(n) || n < 1 || n > 240) return 'Enter an integer between 1 and 240';
                    return null;
                },
            });
            if (raw === undefined) return;
            const minutes = Number(raw);
            await cfg.update('idleReminderMinutes', minutes, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`OctoClock: Idle Reminder set to ${minutes} minutes`);
        }),

        // ----------------------------------------------------------------
        // octoclock.toggleCodeLens  (UI-8)
        // Flip octoclock.enableCodeLens. The CodeLens provider listens on
        // onDidChangeConfiguration and refreshes automatically.
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.toggleCodeLens', async () => {
            const cfg = vscode.workspace.getConfiguration('octoclock');
            const next = cfg.get('enableCodeLens', false) !== true;
            await cfg.update('enableCodeLens', next, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`OctoClock: Code Lens ${next ? 'enabled' : 'disabled'}`);
        }),
    );
}
