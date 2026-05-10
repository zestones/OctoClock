// packages/vscode-ext/src/webview/sidebar/app.js
//
// Sidebar webview bundle entry point.
//
// This script runs inside every OctoClock sidebar WebviewView.
// The provider decides which panel is active by posting an initial
// { type: 'init', panel: '<panelId>' } message, and this bundle
// renders the correct component.
//
// TODO (UI-1 → UI-4): replace stub with real panel components.

// acquireVsCodeApi is injected by VS Code into every webview context.
// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();

document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    if (app) {
        app.textContent = 'OctoClock loading…';
    }
});

// Keep the compiler happy — vscode is used once we have real panels.
void vscode;

// Required: marks this file as an ES module so TypeScript keeps its
// declarations in module scope (prevents redeclaration conflicts across
// webview entry points in the same tsconfig compilation unit).
export {};
