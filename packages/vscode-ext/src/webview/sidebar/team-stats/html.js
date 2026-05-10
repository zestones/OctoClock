// packages/vscode-ext/src/webview/sidebar/team-stats/html.js
//
// HTML shell for the Team Stats compact sidebar panel. Mirrors active-timer/html.js.

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
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'sidebar', 'team-stats', 'app.js'),
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
    .ts-section { padding: 4px 8px 8px; }
    .ts-section + .ts-section { border-top: 1px solid var(--oc-border); }
    .ts-heading { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--oc-muted); margin: 6px 0 4px; }
    .ts-empty { color: var(--oc-desc); font-style: italic; font-size: 11px; padding: 4px 0; line-height: 1.5; }
    .ts-hint { font-style: normal; color: var(--oc-accent-fg, #6fb3e8); font-size: 10px; }

    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .kpi { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 4px; padding: 9px 10px; }
    .kpi-label { font-size: 10px; color: var(--oc-desc); text-transform: uppercase; letter-spacing: .05em; }
    .kpi-value { font-family: var(--oc-font-mono); font-size: 18px; font-weight: 700; color: var(--oc-fg); margin-top: 3px; letter-spacing: -.5px; }
    .kpi-sub   { font-size: 11px; color: var(--oc-desc); margin-top: 3px; }

    .bars { display: flex; flex-direction: column; gap: 4px; }
    .bar-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 6px; font-size: 11px; }
    .bar-row .bar-lbl { color: var(--oc-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar-row .bar-time { font-family: var(--oc-font-mono); color: var(--oc-muted); font-size: 10px; }
    .bar-track { grid-column: 1 / -1; height: 4px; background: var(--oc-border); border-radius: 2px; overflow: hidden; }
    .bar-fill  { height: 100%; background: var(--oc-accent, #007acc); border-radius: 2px; }

    .team-row { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 8px; padding: 4px 0; font-size: 11px; }
    .avatar { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--oc-accent, #007acc); color: var(--oc-bg); font-size: 10px; font-weight: 600; }
    .team-name { color: var(--oc-fg); }
    .team-meta { font-size: 10px; color: var(--oc-muted); }
    .team-time { font-family: var(--oc-font-mono); font-size: 11px; color: var(--oc-fg); }

    .ts-empty { color: var(--oc-muted); font-style: italic; padding: 4px 0; font-size: 11px; }

    .ts-footer { padding: 8px; border-top: 1px solid var(--oc-border); }
    .btn-dashboard { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; height: 22px; background: transparent; border: 1px solid var(--oc-border); color: var(--oc-fg); font-size: 11px; font-family: var(--oc-font-ui); border-radius: 2px; cursor: pointer; }
    .btn-dashboard:hover { background: var(--oc-border); }
    .btn-dashboard .codicon { font-size: 12px; }
  </style>
  <title>Team Stats</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${appUri}"></script>
</body>
</html>`;
}
