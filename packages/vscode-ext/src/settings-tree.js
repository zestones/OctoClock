// packages/vscode-ext/src/settings-tree.js
//
// UI-8 — SettingsProvider for the OctoClock activity-bar "Settings" view.
//
// Implemented as a flat (single-level) TreeDataProvider rather than a
// webview because the surface is small and trivially keyboard-accessible.
//
// Nodes:
//   • Token             — masked status (set / not set), click → octoclock.configureToken
//   • Auto Sync         — boolean toggle (globalState STORAGE_KEYS.AUTO_SYNC)
//   • Idle Reminder     — boolean toggle (configuration octoclock.idleReminderEnabled)
//   • Idle Minutes      — numeric editor for octoclock.idleReminderMinutes
//   • Code Lens         — boolean toggle (configuration octoclock.enableCodeLens)
//   • Sync Now          — action node, click → octoclock.syncNow
//
// Refresh triggers:
//   • storage events for GITHUB_TOKEN and AUTO_SYNC
//   • vscode.workspace.onDidChangeConfiguration for octoclock.* keys
//
// All toggle/edit logic lives in dedicated commands (`octoclock.toggleAutoSync`,
// `octoclock.toggleIdleReminder`, `octoclock.editIdleMinutes`,
// `octoclock.toggleCodeLens`) so callers can also bind keybindings if desired.

import * as vscode from 'vscode';
import { GitHubStorageService } from '../../core/src/services/github-storage.service.js';
import { StorageService } from '../../core/src/services/storage.service.js';
import { STORAGE_KEYS } from '../../core/src/utils/constants.utils.js';

/** @param {string} token */
export function maskToken(token) {
    if (!token) return 'not set';
    if (token.length <= 8) return '••••';
    return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

/**
 * Convenience constructor for a SettingsNode. Each node embeds the command
 * VS Code should run when the user activates it (Enter / click).
 *
 * When `iconColor` is provided the icon is rendered with the matching theme
 * color (e.g. `charts.green` for "on" toggles, `charts.red` for "warning").
 *
 * @param {string} label
 * @param {string} description
 * @param {string} icon                   ThemeIcon id
 * @param {string} commandId
 * @param {string} contextValue
 * @param {string} [tooltip]
 * @param {string} [iconColor]            theme color id, e.g. "charts.green"
 */
function makeNode(label, description, icon, commandId, contextValue, tooltip, iconColor) {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = description;
    item.iconPath = iconColor
        ? new vscode.ThemeIcon(icon, new vscode.ThemeColor(iconColor))
        : new vscode.ThemeIcon(icon);
    item.command = { command: commandId, title: label };
    item.contextValue = contextValue;
    if (tooltip) item.tooltip = tooltip;
    return item;
}

export class SettingsProvider {
    static viewType = 'octoclock.settings';

    /**
     * @param {vscode.ExtensionContext} context
     * @param {import('../../core/src/ports/storage-events.port.js').StorageEventsPort} events
     */
    constructor(context, events) {
        this._context = context;
        this._emitter = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._emitter.event;

        const unsub = events.subscribe((e) => {
            const key = e.type === 'removeMultiple' ? null : e.key;
            if (
                e.type === 'removeMultiple'
                    ? e.keys.some((k) => k === STORAGE_KEYS.GITHUB_TOKEN || k === STORAGE_KEYS.AUTO_SYNC)
                    : key === STORAGE_KEYS.GITHUB_TOKEN || key === STORAGE_KEYS.AUTO_SYNC
            ) {
                this._emitter.fire();
            }
        });

        const cfgSub = vscode.workspace.onDidChangeConfiguration((e) => {
            if (
                e.affectsConfiguration('octoclock.idleReminderEnabled') ||
                e.affectsConfiguration('octoclock.idleReminderMinutes') ||
                e.affectsConfiguration('octoclock.enableCodeLens')
            ) {
                this._emitter.fire();
            }
        });

        this.dispose = () => {
            unsub?.();
            cfgSub.dispose();
            this._emitter.dispose();
        };
    }

    refresh() {
        this._emitter.fire();
    }

    /** @param {vscode.TreeItem} element */
    getTreeItem(element) {
        return element;
    }

    async getChildren() {
        const cfg = vscode.workspace.getConfiguration('octoclock');
        const [token, autoSync] = await Promise.all([
            GitHubStorageService.getGitHubToken().catch(() => null),
            StorageService.get(STORAGE_KEYS.AUTO_SYNC).catch(() => false),
        ]);

        const idleEnabled = Boolean(cfg.get('idleReminderEnabled', true));
        const idleMinutes = Number(cfg.get('idleReminderMinutes', 30)) || 30;
        const codeLens = Boolean(cfg.get('enableCodeLens', false));

        return [
            makeNode(
                'GitHub Token',
                token ? maskToken(token) : 'not set',
                token ? 'key' : 'warning',
                'octoclock.configureToken',
                'oc-setting-token',
                token
                    ? 'Token stored in OS keychain — click to replace'
                    : 'Click to set your GitHub personal access token',
                token ? 'charts.green' : 'charts.yellow',
            ),
            makeNode(
                'Auto Sync',
                autoSync ? 'on' : 'off',
                autoSync ? 'check' : 'circle-large-outline',
                'octoclock.toggleAutoSync',
                'oc-setting-toggle',
                'Pull tracker comments from GitHub on activation',
                autoSync ? 'charts.green' : undefined,
            ),
            makeNode(
                'Idle Reminder',
                idleEnabled ? 'on' : 'off',
                idleEnabled ? 'check' : 'circle-large-outline',
                'octoclock.toggleIdleReminder',
                'oc-setting-toggle',
                'Warn when no editor activity is detected during a timer',
                idleEnabled ? 'charts.green' : undefined,
            ),
            makeNode(
                'Idle Minutes',
                String(idleMinutes),
                'clock',
                'octoclock.editIdleMinutes',
                'oc-setting-input',
                'Minutes of inactivity before the idle reminder fires',
            ),
            makeNode(
                'Code Lens',
                codeLens ? 'on' : 'off',
                codeLens ? 'check' : 'circle-large-outline',
                'octoclock.toggleCodeLens',
                'oc-setting-toggle',
                "Show 'Track #N' lenses on issue references in source files",
                codeLens ? 'charts.green' : undefined,
            ),
            makeNode(
                'Sync Now',
                'pull issues + tracker comments',
                'sync',
                'octoclock.syncNow',
                'oc-setting-action',
                'Pull issues from GitHub for all pinned repos, then sync the active tracker comment',
            ),
        ];
    }
}
