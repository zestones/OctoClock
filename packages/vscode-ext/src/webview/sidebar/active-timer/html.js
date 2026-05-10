// packages/vscode-ext/src/webview/sidebar/active-timer/html.js
//
// Generates the HTML shell for the Active Timer webview panel.
//
// The shell is a minimal page that:
//   1. Loads tokens.css for --oc-* design tokens.
//   2. Defines the codicons @font-face and resets.
//   3. Mounts a <div id="app"> for the Preact bundle.
//   4. Loads the Vite bundle as a nonce-tagged ES module.

import * as vscode from 'vscode';
import { buildCsp } from '../../csp.js';
import { getNonce } from '../../nonce.js';

/**
 * @param {import('vscode').Webview} webview
 * @param {import('vscode').Uri} extensionUri
 * @returns {string}
 */
export function getHtml(webview, extensionUri) {
    const nonce = getNonce();
    const csp = buildCsp(nonce, webview);

    const tokensUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'tokens.css'));
    const componentsUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'shared', 'components.css'),
    );
    const codiconsCssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'fonts', 'codicon.css'));
    const appUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'sidebar', 'active-timer', 'app.js'),
    );

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${tokensUri}">
  <link rel="stylesheet" href="${componentsUri}">
  <link rel="stylesheet" href="${codiconsCssUri}">
  <style nonce="${nonce}">
    /* ── Active Timer: panel-specific ── */
    .icon-desc  { color: var(--oc-desc); }
    .icon-muted { color: var(--oc-muted); }
    .row-lbl.dim { font-style: italic; }

    .row.timer-row { background: rgba(0,122,204,.08); border-left: 2px solid rgba(0,122,204,.45); padding-left: 18px; }
    .row.timer-row:hover { background: rgba(0,122,204,.13); }

    .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--oc-timer); }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
    .dot.pulse { animation: pulse 1.8s ease-in-out infinite; }

    .timer { font-family: var(--oc-font-mono); font-size: 12px; font-weight: 600; color: var(--oc-timer); letter-spacing: .03em; flex-shrink: 0; }

    .btn-stop { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-family: var(--oc-font-ui); background: rgba(244,135,113,.1); color: var(--oc-danger); border: 1px solid rgba(244,135,113,.2); border-radius: 2px; padding: 0 6px; height: 20px; cursor: pointer; flex-shrink: 0; }
    .btn-stop:hover { background: rgba(244,135,113,.2); }
    .btn-stop .codicon { font-size: 12px; }
  </style>
  <title>Active Timer</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${appUri}"></script>
</body>
</html>`;
}
