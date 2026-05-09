// packages/vscode-ext/src/extension.js
//
// VS Code extension entry point.
// Exported activate(context) is called by VS Code when the extension activates.
// Activation event: onStartupFinished (lazy — does not block editor startup).

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

    console.log('OctoClock: activated');
}

export function deactivate() { }
