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
import { BranchWatcher } from './integrations/branch-watcher.js';
import { IssueCodeLensProvider } from './integrations/codelens-provider.js';
import { IdleWatcher } from './integrations/idle-watcher.js';
import { WorkspaceRepoDetector } from './integrations/repo-detector.js';
import { SyncWatcher } from './integrations/sync-watcher.js';
import { SettingsProvider } from './settings-tree.js';
import { createStatusBarController } from './status-bar.js';
import { TrackedTimeProvider } from './tracked-time-tree.js';
import { DashboardPanel } from './webview/dashboard/panel.js';
import { ActiveTimerProvider } from './webview/sidebar/active-timer/provider.js';
import { MyIssuesProvider } from './webview/sidebar/my-issues/provider.js';
import { TeamStatsProvider } from './webview/sidebar/team-stats/provider.js';

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
        .then(async ([autoSync, token]) => {
            // Default AUTO_SYNC to true on first run so cross-client sync
            // (browser ↔ VS Code) works out of the box.
            if (autoSync == null) {
                await StorageService.set(STORAGE_KEYS.AUTO_SYNC, true);
                autoSync = true;
            }
            if (autoSync && token) {
                syncFromGitHub().catch((e) => console.error('OctoClock: Auto-sync failed:', e));
            }
        })
        .catch((e) => console.error('OctoClock: Failed to check auto-sync settings:', e));

    registerCommands(context);

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    context.subscriptions.push(createStatusBarController(statusBarItem, storageEvents));

    const activeTimerProvider = new ActiveTimerProvider(context, storageEvents);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ActiveTimerProvider.viewType, activeTimerProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        }),
        activeTimerProvider,
    );

    const myIssuesProvider = new MyIssuesProvider(context, storageEvents);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(MyIssuesProvider.viewType, myIssuesProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        }),
        myIssuesProvider,
    );

    const trackedTimeProvider = new TrackedTimeProvider(context, storageEvents);
    context.subscriptions.push(
        vscode.window.createTreeView(TrackedTimeProvider.viewType, { treeDataProvider: trackedTimeProvider }),
        trackedTimeProvider,
        vscode.commands.registerCommand('octoclock.toggleWorkspaceFilter', () =>
            trackedTimeProvider.toggleWorkspaceFilter(),
        ),
        vscode.commands.registerCommand('octoclock.refreshTrackedTime', () => trackedTimeProvider.refresh()),
    );
    // Initialise the `setContext` flag so the title-bar icon reflects the
    // persisted toggle state from the moment the view loads.
    vscode.commands.executeCommand(
        'setContext',
        'octoclock.trackedTime.workspaceFilter',
        trackedTimeProvider.workspaceFilterEnabled,
    );

    const teamStatsProvider = new TeamStatsProvider(context, storageEvents);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(TeamStatsProvider.viewType, teamStatsProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        }),
        teamStatsProvider,
        vscode.commands.registerCommand('octoclock.openDashboard', () => DashboardPanel.open(context)),
    );
    // ---------- UI-7 — Smart integrations ----------
    // #60 Auto-detect workspace repos on activation + workspace folder change.
    const repoDetector = new WorkspaceRepoDetector(context);
    repoDetector.run().catch((e) => console.error('OctoClock: repo detector failed:', e));

    // #61 Branch → issue suggestion notification.
    new BranchWatcher(context);

    // #62 Idle reminder watcher.
    new IdleWatcher(context, storageEvents);

    // Cross-context active-timer sync — periodic + on window focus.
    // Picks up timers started/stopped in the browser extension or content script.
    new SyncWatcher(context);

    // #63 CodeLens for #N references (opt-in).
    const codeLensProvider = new IssueCodeLensProvider(storageEvents);
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider),
        codeLensProvider,
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('octoclock.enableCodeLens')) codeLensProvider.refresh();
        }),
    );

    // ---------- UI-8 — Settings tree view ----------
    const settingsProvider = new SettingsProvider(context, storageEvents);
    context.subscriptions.push(
        vscode.window.createTreeView(SettingsProvider.viewType, { treeDataProvider: settingsProvider }),
        { dispose: () => settingsProvider.dispose?.() },
        vscode.commands.registerCommand('octoclock.refreshSettings', () => settingsProvider.refresh()),
    );

    console.log('OctoClock: activated');
}

export function deactivate() {}
