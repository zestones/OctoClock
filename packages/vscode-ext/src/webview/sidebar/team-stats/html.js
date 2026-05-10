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
    /* Tokens scoped to this panel. Fall back to VS Code theme tokens. */
    :root {
      --ts-fg:       var(--vscode-foreground, #cccccc);
      --ts-desc:     var(--vscode-descriptionForeground, #868686);
      --ts-muted:    #525252;
      --ts-border:   var(--vscode-panel-border, rgba(255,255,255,.08));
      --ts-accent:   var(--vscode-charts-blue, #007acc);
      --ts-accent-2: #6fb3e8;
      --ts-mono:     var(--vscode-editor-font-family, 'Cascadia Code','SF Mono',Consolas,monospace);
    }

    body { padding: 0; margin: 0; font-size: 13px; line-height: 1; }

    /* ── Stat cards (matches mockup .stat-cards / .stat-card) ─────────── */
    .stat-cards { display: flex; gap: 6px; padding: 8px 8px 4px; }
    .stat-card {
      flex: 1;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 4px;
      padding: 9px 10px;
    }
    .stat-card.accent {
      background: rgba(0,122,204,.07);
      border-color: rgba(0,122,204,.18);
    }
    .sc-val { font-size: 18px; font-weight: 700; color: #e0e0e0; letter-spacing: -.5px; }
    .sc-lbl { font-size: 11px; color: var(--ts-desc); margin-top: 3px; }
    .sc-sub { font-size: 11px; color: var(--ts-accent); margin-top: 3px; }

    /* ── Section headers (mockup .team-hdr) ───────────────────────────── */
    .team-hdr {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .08em;
      color: #888;
      text-transform: uppercase;
      padding: 7px 8px 2px;
    }

    /* ── Bar rows (mockup .bar-row / .bar-lbl / .bar-track / .bar-fill / .bar-val) ── */
    .bar-row { display: flex; align-items: center; gap: 7px; padding: 3px 8px; }
    .bar-lbl {
      width: 70px;
      font-size: 11px;
      color: var(--ts-desc);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }
    .bar-track {
      flex: 1;
      height: 3px;
      background: rgba(255,255,255,.07);
      border-radius: 2px;
      overflow: hidden;
    }
    .bar-fill { height: 100%; border-radius: 2px; background: var(--ts-accent); }
    .bar-val {
      width: 44px;
      font-size: 11px;
      color: var(--ts-fg);
      text-align: right;
      white-space: nowrap;
      flex-shrink: 0;
      font-family: var(--ts-mono);
    }

    /* ── Team rows (mockup .av / .when / .row) ────────────────────────── */
    .team-row {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 3px 8px;
      cursor: default;
    }
    .av {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      font-weight: 700;
      color: #fff;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    .team-name {
      flex: 1;
      font-size: 12px;
      color: var(--ts-fg);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .when { font-size: 11px; color: var(--ts-desc); white-space: nowrap; flex-shrink: 0; }
    .team-time { font-family: var(--ts-mono); font-size: 11px; color: var(--ts-fg); flex-shrink: 0; }

    /* ── Empty states ─────────────────────────────────────────────────── */
    .ts-empty {
      color: var(--ts-desc);
      font-style: italic;
      font-size: 11px;
      padding: 4px 8px 8px;
      line-height: 1.5;
    }
    .ts-hint { font-style: normal; color: var(--ts-accent-2); font-size: 11px; display: block; margin-top: 2px; }

    /* ── Dashboard button (mockup .dashboard-btn) ─────────────────────── */
    .dashboard-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin: 10px 8px 8px;
      height: 28px;
      width: calc(100% - 16px);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 3px;
      background: rgba(255,255,255,.04);
      color: var(--ts-fg);
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
    }
    .dashboard-btn:hover {
      background: rgba(255,255,255,.08);
      border-color: rgba(255,255,255,.18);
    }
    .dashboard-btn .codicon { font-size: 14px; }
  </style>
  <title>Team Stats</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${appUri}"></script>
</body>
</html>`;
}
