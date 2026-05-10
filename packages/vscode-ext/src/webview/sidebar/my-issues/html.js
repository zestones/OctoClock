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
  const codiconsCssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'fonts', 'codicon.css'));
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
  <link rel="stylesheet" href="${codiconsCssUri}">
  <style nonce="${nonce}">
    /* ── My Issues: panel-specific ── */
    .issue-row { cursor: pointer; border-left: 2px solid transparent; padding-left: 18px; }
    .issue-row-active { background: var(--oc-accent-card-bg); border-left-color: var(--oc-timer); }
    .issue-row-active:hover { background: var(--oc-accent-card-bg); }
    .btn-start { color: var(--oc-open); }
    .btn-start:hover { color: var(--oc-open); background: rgba(63,185,80,.12); }
    .btn-start:disabled { color: var(--oc-muted); }
    .btn-open { color: var(--oc-desc); }
    .btn-open:hover { color: var(--oc-link); }
    .branch-row { background: rgba(197,134,192,.06); border-left: 2px solid rgba(197,134,192,.35); padding-left: 18px; }
    .branch-row:hover { background: rgba(197,134,192,.12); }
    .bpill { font-size: 11px; font-family: var(--oc-font-mono); background: rgba(197,134,192,.15); color: var(--oc-branch); border-radius: 3px; padding: 1px 5px; white-space: nowrap; flex-shrink: 0; }
    .btn-track { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-family: var(--oc-font-ui); background: rgba(78,201,176,.1); color: var(--oc-timer); border: 1px solid rgba(78,201,176,.25); border-radius: 2px; padding: 0 6px; height: 20px; cursor: pointer; flex-shrink: 0; }
    .btn-track:hover { background: rgba(78,201,176,.2); }
    .btn-track:disabled { opacity: .35; cursor: default; }
    .btn-track .codicon { font-size: 12px; }

    /* Repo grouping header */
    .repo-group-hdr { display: flex; align-items: center; gap: 4px; padding: 6px 8px 3px; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--oc-desc); user-select: none; }
    .repo-group-hdr .codicon { font-size: 11px; }
    .repo-group-count { margin-left: auto; font-weight: 500; color: var(--oc-muted); letter-spacing: 0; text-transform: none; }

    /* Workspace-only chip */
    .ws-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-family: var(--oc-font-ui); background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 3px; color: var(--oc-desc); padding: 1px 8px; height: 22px; cursor: pointer; align-self: flex-start; }
    .ws-chip:hover { background: rgba(255,255,255,.08); color: var(--oc-fg); }
    .ws-chip.on { background: rgba(0,122,204,.15); border-color: rgba(0,122,204,.35); color: var(--oc-accent-fg, #6fb3e8); }
    .ws-chip .codicon { font-size: 11px; }

    /* Empty-state hint (secondary line under "No matching issues") */
    .no-results-hint { display: inline-block; margin-top: 4px; font-size: 11px; color: var(--oc-muted); line-height: 1.4; }
  </style>
  <title>My Issues</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${appUri}"></script>
</body>
</html>`;
}
