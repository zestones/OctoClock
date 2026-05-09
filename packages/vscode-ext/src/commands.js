// packages/vscode-ext/src/commands.js
//
// Registers all OctoClock VS Code commands and wires them to core services.
//
// Each command handler is pushed onto context.subscriptions so VS Code
// disposes the registration when the extension is deactivated.

import * as vscode from 'vscode';
import { GitHubService } from '../../core/src/services/github.service.js';
import { StorageService } from '../../core/src/services/storage.service.js';
import { TimerService } from '../../core/src/services/timer.service.js';
import { STORAGE_KEYS } from '../../core/src/utils/constants.utils.js';

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
        // octoclock.startTimer
        // Prompt for an issue URL, normalise it, then delegate to TimerService.
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.startTimer', async () => {
            const raw = await vscode.window.showInputBox({
                prompt: 'Enter the GitHub issue URL',
                placeHolder: 'https://github.com/owner/repo/issues/123',
            });

            if (!raw) return; // user pressed Escape or left the input empty

            const issueUrl = normalizeIssueUrl(raw);
            if (!issueUrl) {
                vscode.window.showErrorMessage(
                    `OctoClock: Invalid issue URL — expected https://github.com/owner/repo/issues/123 format`,
                );
                return;
            }

            try {
                const result = await TimerService.startTimer(issueUrl);
                if (result.isRunning) {
                    vscode.window.showInformationMessage(
                        `OctoClock: Timer started for ${issueUrl}`,
                    );
                } else {
                    vscode.window.showWarningMessage(
                        `OctoClock: Failed to start timer for ${issueUrl}`,
                    );
                }
            } catch (error) {
                vscode.window.showErrorMessage(
                    `OctoClock: ${error instanceof Error ? error.message : String(error)}`,
                );
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
                vscode.window.showInformationMessage(
                    `OctoClock: Timer stopped for ${issueUrl}`,
                );
            } catch (error) {
                vscode.window.showErrorMessage(
                    `OctoClock: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }),

        // ----------------------------------------------------------------
        // octoclock.syncNow
        // Trigger a queued tracker-comment sync for the active issue.
        // ----------------------------------------------------------------
        vscode.commands.registerCommand('octoclock.syncNow', async () => {
            const issueUrl = await StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE);
            if (!issueUrl) {
                vscode.window.showInformationMessage('OctoClock: No active issue to sync');
                return;
            }

            try {
                const { owner, repo, issueNumber } = GitHubService.parseIssueUrl(issueUrl);
                await TimerService.syncComment(issueUrl, owner, repo, issueNumber);
                vscode.window.showInformationMessage('OctoClock: Tracker comment synced');
            } catch (error) {
                vscode.window.showErrorMessage(
                    `OctoClock: Sync failed — ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }),
    );
}
