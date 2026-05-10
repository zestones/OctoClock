// packages/vscode-ext/src/integrations/sync-watcher.js
//
// Periodically pulls the latest tracker-comment state from GitHub so that
// timers started/stopped in another context (browser extension, content
// script on github.com) propagate to this VS Code window.
//
// Trigger points:
//   1. setInterval — every `pollIntervalMs` while AUTO_SYNC + token are set.
//   2. vscode.window.onDidChangeWindowState — pull immediately on focus regain.
//
// All pulls are best-effort and serialized via a single in-flight guard so we
// never stack overlapping syncs. Errors are logged, never surfaced.

import * as vscode from 'vscode';
import { StorageService } from '../../../core/src/services/storage.service.js';
import { syncFromGitHub } from '../../../core/src/services/sync.service.js';
import { STORAGE_KEYS } from '../../../core/src/utils/constants.utils.js';

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_TRIGGER_GAP_MS = 5_000; // debounce focus-triggered runs

export class SyncWatcher {
    /**
     * @param {vscode.ExtensionContext} context
     * @param {{ pollIntervalMs?: number }} [opts]
     */
    constructor(context, opts = {}) {
        this._intervalMs = opts.pollIntervalMs ?? DEFAULT_INTERVAL_MS;
        /** @type {ReturnType<typeof setInterval> | null} */
        this._intervalHandle = null;
        this._inflight = false;
        this._lastRunAt = 0;

        // Periodic poll.
        this._intervalHandle = setInterval(() => this._maybeSync('interval'), this._intervalMs);

        // Window-focus poll. Run as soon as the user comes back to the window
        // so the UI reflects whatever happened in the browser meanwhile.
        const focusSub =
            typeof vscode.window.onDidChangeWindowState === 'function'
                ? vscode.window.onDidChangeWindowState((state) => {
                      if (state.focused) this._maybeSync('focus');
                  })
                : { dispose() {} };

        context.subscriptions.push({
            dispose: () => {
                if (this._intervalHandle) clearInterval(this._intervalHandle);
                this._intervalHandle = null;
                focusSub.dispose();
            },
        });
    }

    /**
     * Run syncFromGitHub if AUTO_SYNC + token are present and no sync is currently
     * in flight. Debounces rapid triggers (e.g. focus events).
     *
     * @param {'interval' | 'focus'} reason
     */
    async _maybeSync(reason) {
        if (this._inflight) return;
        const now = Date.now();
        if (now - this._lastRunAt < MIN_TRIGGER_GAP_MS) return;

        try {
            const [autoSync, token] = await Promise.all([
                StorageService.get(STORAGE_KEYS.AUTO_SYNC),
                StorageService.get(STORAGE_KEYS.GITHUB_TOKEN),
            ]);
            if (!autoSync || !token) return;

            this._inflight = true;
            this._lastRunAt = now;
            await syncFromGitHub();
        } catch (e) {
            console.error(`OctoClock: SyncWatcher (${reason}) failed:`, e);
        } finally {
            this._inflight = false;
        }
    }
}
