// packages/vscode-ext/src/integrations/idle-watcher.js
//
// UI-7.3 — Idle reminder watcher.
//
// While a timer is active and the editor sees no `onDidChangeTextDocument`
// event for `octoclock.idleReminderMinutes` (default 30, configurable),
// surface a modal dialog with [Keep Running] and [Stop Timer] actions.
//
// Wiring:
//   - Subscribes to STORAGE_KEYS.ACTIVE_ISSUE / START_TIME via `storageEvents`
//     to know when to arm/disarm.
//   - Subscribes to vscode.workspace.onDidChangeTextDocument to reset the
//     idle clock on any edit.
//   - When disarmed (no timer), the timeout is cleared so we never fire.
//
// The dialog is rendered via `vscode.window.showWarningMessage(..., { modal: true })`
// — the closest VS Code analogue to the prototype's idle modal. While the
// modal is up, further idle resets are ignored (`_dialogOpen` guard) so we
// don't stack dialogs if the user lets it sit.

import * as vscode from 'vscode';
import { StorageService } from '../../../core/src/services/storage.service.js';
import { STORAGE_KEYS } from '../../../core/src/utils/constants.utils.js';

/**
 * @param {() => number} [now]  injected for tests
 * @returns {number}            milliseconds in the configured idle window
 */
export function getIdleWindowMs(now = Date.now) {
    void now; // reserved for future per-time-of-day tweaks
    const cfg = vscode.workspace.getConfiguration('octoclock');
    const minutes = Math.max(1, Number(cfg.get('idleReminderMinutes', 30)) || 30);
    return minutes * 60 * 1000;
}

export class IdleWatcher {
    /**
     * @param {vscode.ExtensionContext} context
     * @param {import('../../../core/src/ports/storage-events.port.js').StorageEventsPort} events
     */
    constructor(context, events) {
        this._context = context;
        /** @type {ReturnType<typeof setTimeout> | null} */
        this._timer = null;
        this._armed = false;
        this._dialogOpen = false;

        // Hydrate initial timer state.
        StorageService.getMultiple([STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME])
            .then((vals) => {
                const active = vals[STORAGE_KEYS.ACTIVE_ISSUE];
                if (active) this._arm();
            })
            .catch(() => { });

        const unsub = events.subscribe((event) => {
            if (event.type === 'set' && event.key === STORAGE_KEYS.ACTIVE_ISSUE) {
                if (event.value) this._arm();
                else this._disarm();
            } else if (event.type === 'remove' && event.key === STORAGE_KEYS.ACTIVE_ISSUE) {
                this._disarm();
            } else if (event.type === 'removeMultiple' && event.keys.includes(STORAGE_KEYS.ACTIVE_ISSUE)) {
                this._disarm();
            }
        });

        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(() => this._onActivity()),
            // Treat configuration changes as activity-equivalent — reset timer
            // so a freshly-shortened window doesn't fire mid-edit.
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('octoclock.idleReminderMinutes')) this._onActivity();
            }),
            { dispose: unsub },
            { dispose: () => this._disarm() },
        );
    }

    _arm() {
        if (!this._isEnabled()) {
            this._disarm();
            return;
        }
        this._armed = true;
        this._scheduleNext();
    }

    _disarm() {
        this._armed = false;
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    _onActivity() {
        if (!this._armed || this._dialogOpen) return;
        this._scheduleNext();
    }

    _scheduleNext() {
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(() => this._fire(), getIdleWindowMs());
    }

    _isEnabled() {
        const cfg = vscode.workspace.getConfiguration('octoclock');
        // @ts-ignore
        return cfg.get('idleReminderEnabled', true) !== false;
    }

    async _fire() {
        if (!this._armed || this._dialogOpen) return;
        this._dialogOpen = true;
        try {
            const minutes = Math.round(getIdleWindowMs() / 60000);
            const action = await vscode.window.showWarningMessage(
                `OctoClock: No editor activity for ${minutes} minute${minutes === 1 ? '' : 's'}. Is the timer still relevant?`,
                { modal: true },
                'Keep Running',
                'Stop Timer',
            );
            if (action === 'Stop Timer') {
                await vscode.commands.executeCommand('octoclock.stopTimer');
            }
        } finally {
            this._dialogOpen = false;
            // Re-arm only if a timer is still running.
            if (this._armed) this._scheduleNext();
        }
    }
}
