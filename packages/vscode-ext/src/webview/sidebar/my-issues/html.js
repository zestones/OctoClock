// packages/vscode-ext/src/webview/sidebar/my-issues/html.js
//
// Generates the HTML shell for the My Issues webview panel.
//
// The shell loads:
//   1. tokens.css — --oc-* design tokens
//   2. A nonce'd <style> with all panel CSS (classes used by the Preact bundle)
//   3. The Vite bundle as a nonce-tagged ES module

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
    const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'fonts', 'codicon.ttf'));
    const appUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'sidebar', 'my-issues', 'app.js'),
    );

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${tokensUri}">
  <link rel="stylesheet" href="${componentsUri}">
  <style nonce="${nonce}">
    /* codicons @font-face must stay here — needs a runtime webview URI */
    @font-face { font-family: 'codicon'; src: url('${codiconsUri}') format('truetype'); }

    /* ── My Issues: panel-specific ── */
    .branch-row { background: rgba(197,134,192,.06); border-left: 2px solid rgba(197,134,192,.35); padding-left: 18px; }
    .branch-row:hover { background: rgba(197,134,192,.12); }
    .bpill { font-size: 11px; font-family: var(--oc-font-mono); background: rgba(197,134,192,.15); color: var(--oc-branch); border-radius: 3px; padding: 1px 5px; white-space: nowrap; flex-shrink: 0; }
    .btn-track { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-family: var(--oc-font-ui); background: rgba(78,201,176,.1); color: var(--oc-timer); border: 1px solid rgba(78,201,176,.25); border-radius: 2px; padding: 0 6px; height: 20px; cursor: pointer; flex-shrink: 0; }
    .btn-track:hover { background: rgba(78,201,176,.2); }
    .btn-track:disabled { opacity: .35; cursor: default; }
    .btn-track .codicon { font-size: 12px; }
  </style>
  <title>My Issues</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${appUri}"></script>
</body>
</html>`;
}
