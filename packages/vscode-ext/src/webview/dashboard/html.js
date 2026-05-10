// packages/vscode-ext/src/webview/dashboard/html.js
//
// HTML shell for the OctoClock Dashboard WebviewPanel.

import * as vscode from 'vscode';
import { buildCsp } from '../csp.js';
import { getNonce } from '../nonce.js';

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
  const appUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'dashboard', 'app.js'));

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
    body { padding: 0; margin: 0; }
    .dash { display: flex; flex-direction: column; height: 100vh; min-height: 0; font-family: var(--oc-font-ui); }

    /* Topbar */
    .dash-topbar { display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-bottom: 1px solid var(--oc-border); flex-shrink: 0; }
    .dash-title  { font-size: 14px; font-weight: 600; color: var(--oc-fg); margin-right: auto; }

    .pills { display: inline-flex; gap: 0; border: 1px solid var(--oc-border); border-radius: 4px; overflow: hidden; }
    .pill  { background: transparent; border: 0; color: var(--oc-fg); font-size: 11px; padding: 4px 10px; cursor: pointer; }
    .pill:hover { background: var(--oc-border); }
    .pill.active { background: var(--oc-accent, #007acc); color: var(--oc-bg); }

    .week-nav { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--oc-muted); }
    .week-nav button { display: inline-flex; align-items: center; justify-content: center; background: transparent; border: 0; color: var(--oc-fg); cursor: pointer; padding: 2px 6px; border-radius: 2px; }
    .week-nav button:hover:not(:disabled) { background: var(--oc-border); }
    .week-nav button:disabled { opacity: .35; cursor: not-allowed; }
    .week-nav .codicon { font-size: 13px; }
    .week-nav .label { font-family: var(--oc-font-mono); }

    /* Tabs */
    .dash-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--oc-border); flex-shrink: 0; }
    .tab { background: transparent; border: 0; color: var(--oc-muted); font-size: 12px; padding: 8px 16px; cursor: pointer; border-bottom: 2px solid transparent; }
    .tab:hover { color: var(--oc-fg); }
    .tab.active { color: var(--oc-fg); border-bottom-color: var(--oc-accent, #007acc); }

    /* Content */
    .dash-content { flex: 1; overflow: auto; padding: 16px; }

    /* KPI strip */
    .kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
    .kpi-card { background: var(--oc-bg-alt, rgba(255,255,255,.03)); border: 1px solid var(--oc-border); border-radius: 4px; padding: 10px 12px; }
    .kpi-card .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--oc-muted); }
    .kpi-card .val { font-family: var(--oc-font-mono); font-size: 20px; font-weight: 600; color: var(--oc-fg); margin-top: 4px; }
    .kpi-card .sub { font-size: 10px; color: var(--oc-desc); margin-top: 2px; }

    /* Daily bar chart */
    .daily-chart { background: var(--oc-bg-alt, rgba(255,255,255,.03)); border: 1px solid var(--oc-border); border-radius: 4px; padding: 12px; margin-bottom: 16px; }
    .daily-chart .heading { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--oc-muted); margin-bottom: 10px; }
    .daily-bars { display: flex; align-items: flex-end; gap: 4px; height: 80px; }
    .daily-bar  { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
    .daily-bar .fill { width: 100%; max-width: 24px; background: var(--oc-accent, #007acc); border-radius: 2px 2px 0 0; min-height: 1px; }
    .daily-bar .lbl  { font-size: 9px; color: var(--oc-muted); white-space: nowrap; }

    /* Section headings */
    .dash-section { margin-bottom: 24px; }
    .dash-section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--oc-muted); margin: 0 0 8px; font-weight: 600; }

    /* Tables */
    .dash-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .dash-table th, .dash-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--oc-border); }
    .dash-table th { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: var(--oc-muted); font-weight: 600; }
    .dash-table tr:hover td { background: var(--oc-bg-alt, rgba(255,255,255,.04)); }
    .dash-table .num { font-family: var(--oc-font-mono); text-align: right; }

    /* Sessions filters */
    .sess-filters { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
    .sess-filters select, .sess-filters input { background: var(--oc-bg); color: var(--oc-fg); border: 1px solid var(--oc-border); border-radius: 2px; padding: 4px 6px; font-size: 11px; font-family: var(--oc-font-ui); }
    .sess-filters label { font-size: 11px; color: var(--oc-muted); }

    .sess-day { margin-bottom: 16px; }
    .sess-day .day-hdr { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--oc-muted); padding: 4px 0; border-bottom: 1px solid var(--oc-border); }
    .sess-row { display: grid; grid-template-columns: 1fr 120px 80px; gap: 8px; padding: 6px 0; font-size: 12px; align-items: center; }
    .sess-row .title { color: var(--oc-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sess-row .user  { font-size: 11px; color: var(--oc-desc); }
    .sess-row .dur   { font-family: var(--oc-font-mono); text-align: right; color: var(--oc-fg); }

    /* Issues view (UI-6) */
    .issue-row { border-bottom: 1px solid var(--oc-border); }
    .issue-row .hdr { display: grid; grid-template-columns: 16px 1fr 140px 80px; gap: 8px; padding: 8px 0; align-items: center; cursor: pointer; font-size: 12px; }
    .issue-row .hdr:hover { background: var(--oc-bg-alt, rgba(255,255,255,.04)); }
    .issue-row .caret { color: var(--oc-muted); transition: transform .12s ease; }
    .issue-row.open .caret { transform: rotate(90deg); }
    .issue-row .title { color: var(--oc-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .issue-row .repo  { font-size: 11px; color: var(--oc-desc); font-family: var(--oc-font-mono); }
    .issue-row .total { font-family: var(--oc-font-mono); text-align: right; color: var(--oc-fg); }
    .issue-row .breakdown { padding: 4px 0 8px 32px; display: flex; flex-direction: column; gap: 2px; }
    .issue-row .br-row { display: grid; grid-template-columns: 1fr 80px 60px; gap: 8px; font-size: 11px; padding: 2px 0; }
    .issue-row .br-row .u { color: var(--oc-fg); }
    .issue-row .br-row .s { color: var(--oc-desc); text-align: right; }
    .issue-row .br-row .t { font-family: var(--oc-font-mono); text-align: right; color: var(--oc-fg); }

    /* Members view (UI-6) */
    .members-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .member-card { background: var(--oc-bg-alt, rgba(255,255,255,.03)); border: 1px solid var(--oc-border); border-radius: 6px; padding: 12px; cursor: pointer; transition: border-color .12s ease; }
    .member-card:hover { border-color: var(--oc-accent, var(--oc-fg)); }
    .member-card .top { display: flex; align-items: center; gap: 10px; }
    .member-card .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--oc-accent, #4a8fe7); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; }
    .member-card .name { font-size: 13px; color: var(--oc-fg); font-weight: 600; }
    .member-card .stats { margin-top: 8px; display: flex; gap: 12px; font-size: 11px; color: var(--oc-desc); }
    .member-card .stats .v { font-family: var(--oc-font-mono); color: var(--oc-fg); }
    .member-card .bar { margin-top: 8px; height: 4px; background: var(--oc-border); border-radius: 2px; overflow: hidden; }
    .member-card .bar .fill { height: 100%; background: var(--oc-accent, #4a8fe7); }

    /* Member drill-down (UI-6) */
    .drill-back { display: inline-flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--oc-border); color: var(--oc-fg); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-bottom: 12px; }
    .drill-back:hover { border-color: var(--oc-accent, var(--oc-fg)); }
    .drill-hdr { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .drill-hdr .avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--oc-accent, #4a8fe7); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; }
    .drill-hdr .name { font-size: 16px; color: var(--oc-fg); font-weight: 600; }

    .empty-msg { color: var(--oc-muted); font-style: italic; padding: 12px 0; font-size: 12px; }
  </style>
  <title>OctoClock Dashboard</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${appUri}"></script>
</body>
</html>`;
}
