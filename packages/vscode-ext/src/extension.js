// packages/vscode-ext/src/extension.js
//
// VS Code extension entry point.
// Exported activate(context) is called by VS Code when the extension activates.
// Activation event: onStartupFinished (lazy — does not block editor startup).

import * as vscode from 'vscode';
import { StorageService } from '../../core/src/services/storage.service.js';
import { storageEvents } from '../../core/src/services/storage-events.js';
import { syncFromGitHub } from '../../core/src/services/sync.service.js';
import { TimerService } from '../../core/src/services/timer.service.js';
import { STORAGE_KEYS } from '../../core/src/utils/constants.utils.js';
import { VSCodeMessagingAdapter } from './adapters/vscode-messaging.adapter.js';
import { VSCodeStorageAdapter } from './adapters/vscode-storage.adapter.js';
import { registerCommands } from './commands.js';
import { createStatusBarController } from './status-bar.js';
import { RepoTreeProvider } from './tree-view.js';

/**
 * Called by VS Code when the extension is activated.
 *
 * Asserts that the two storage APIs the extension depends on are accessible:
 * - context.globalState  – keyed persistent state (timer data, cached issues)
 * - context.secrets      – encrypted store for the GitHub token
 *
 * These will always be present in VS Code ≥1.53. The guards exist to surface
 * unexpected misconfiguration immediately rather than at the first storage call.
 *
 * @param {import('vscode').ExtensionContext} context
 */
export function activate(context) {
    if (!context.globalState) {
        throw new Error('OctoClock: context.globalState is not available');
    }
    if (!context.secrets) {
        throw new Error('OctoClock: context.secrets is not available');
    }

    StorageService.setAdapter(new VSCodeStorageAdapter(context.globalState, context.secrets, storageEvents));
    TimerService.setMessagingPort(new VSCodeMessagingAdapter());

    // Non-blocking recovery: if AUTO_SYNC is enabled and a GitHub token is
    // present, pull tracker-comment data from GitHub and merge it into local
    // storage. Fire-and-forget so activation completes immediately and any
    // network errors are logged rather than surfaced to the user.
    Promise.all([StorageService.get(STORAGE_KEYS.AUTO_SYNC), StorageService.get(STORAGE_KEYS.GITHUB_TOKEN)])
        .then(([autoSync, token]) => {
            if (autoSync && token) {
                syncFromGitHub().catch((e) => console.error('OctoClock: Auto-sync failed:', e));
            }
        })
        .catch((e) => console.error('OctoClock: Failed to check auto-sync settings:', e));

    registerCommands(context);

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    context.subscriptions.push(createStatusBarController(statusBarItem, storageEvents));

    const treeProvider = new RepoTreeProvider(storageEvents);
    context.subscriptions.push(
        vscode.window.createTreeView('octoclock.repoTree', { treeDataProvider: treeProvider }),
        treeProvider,
    );

    console.log('OctoClock: activated');
}

export function deactivate() {}
