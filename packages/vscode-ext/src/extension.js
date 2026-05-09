// packages/vscode-ext/src/extension.js
//
// VS Code extension entry point.
// Exported activate(context) is called by VS Code when the extension activates.
// Activation event: onStartupFinished (lazy — does not block editor startup).

import { storageEvents } from '../../core/src/services/storage-events.js';
import { StorageService } from '../../core/src/services/storage.service.js';
import { TimerService } from '../../core/src/services/timer.service.js';
import { VSCodeMessagingAdapter } from './adapters/vscode-messaging.adapter.js';
import { VSCodeStorageAdapter } from './adapters/vscode-storage.adapter.js';

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

    StorageService.setAdapter(
        new VSCodeStorageAdapter(context.globalState, context.secrets, storageEvents),
    );
    TimerService.setMessagingPort(new VSCodeMessagingAdapter());

    console.log('OctoClock: activated');
}

export function deactivate() { }
