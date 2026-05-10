// packages/vscode-ext/src/webview/dashboard/panel.js
//
// WebviewPanel for the full-screen OctoClock dashboard.
// Opened via the "Open Dashboard" command; displays aggregated stats
// across all pinned repositories with chart-style time breakdowns.
//
// TODO (UI-5): implement full Dashboard UI.

import * as vscode from 'vscode';
import { buildCsp } from '../csp.js';
import { getNonce } from '../nonce.js';

export class DashboardPanel {
    static viewType = 'octoclock.dashboard';

    /** @type {DashboardPanel | undefined} */
    static _current;

    /** @param {vscode.ExtensionContext} context */
    static open(context) {
        if (DashboardPanel._current) {
            DashboardPanel._current._panel.reveal();
            return;
        }
        DashboardPanel._current = new DashboardPanel(context);
    }

    /** @param {vscode.ExtensionContext} context */
    constructor(context) {
        this._context = context;
        this._panel = vscode.window.createWebviewPanel(
            DashboardPanel.viewType,
            'OctoClock Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
                retainContextWhenHidden: true,
            },
        );
        this._panel.webview.html = this._getHtml(this._panel.webview);
        this._panel.onDidDispose(() => {
            DashboardPanel._current = undefined;
        });
    }

    /** @param {vscode.Webview} webview */
    _getHtml(webview) {
        const nonce = getNonce();
        const csp = buildCsp(nonce, webview);
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'dashboard', 'app.js'),
        );
        const tokensUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'tokens.css'),
        );
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${tokensUri}">
  <title>OctoClock Dashboard</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
