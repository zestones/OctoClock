// packages/vscode-ext/src/webview/dashboard/app.js
//
// Dashboard webview bundle entry point.
//
// This script runs inside the OctoClock dashboard WebviewPanel.
// The panel passes the full session/repo dataset via an initial
// { type: 'init', data: { … } } message.
//
// TODO (UI-5): replace stub with real dashboard components.

// acquireVsCodeApi is injected by VS Code into every webview context.
// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();

document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    if (app) {
        app.textContent = 'OctoClock dashboard loading…';
    }
});

// Keep the compiler happy — vscode is used once we have real panels.
void vscode;

// Required: marks this file as an ES module so TypeScript keeps its
// declarations in module scope (prevents redeclaration conflicts across
// webview entry points in the same tsconfig compilation unit).
export { };
