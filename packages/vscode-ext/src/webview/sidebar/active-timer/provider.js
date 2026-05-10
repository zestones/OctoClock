// packages/vscode-ext/src/webview/sidebar/active-timer/provider.js
//
// WebviewViewProvider for the "Active Timer" sidebar panel.
// Displays the currently running timer with start/stop controls.
//
// TODO (UI-1): implement full Active Timer UI.

import * as vscode from 'vscode';
import { buildCsp } from '../../csp.js';
import { getNonce } from '../../nonce.js';

export class ActiveTimerProvider {
    static viewType = 'octoclock.activeTimer';

    /** @param {vscode.ExtensionContext} context */
    constructor(context) {
        this._context = context;
    }

    /** @param {vscode.WebviewView} webviewView */
    resolveWebviewView(webviewView) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'dist')],
        };
        webviewView.webview.html = this._getHtml(webviewView.webview);
    }

    /** @param {vscode.Webview} webview */
    _getHtml(webview) {
        const nonce = getNonce();
        const csp = buildCsp(nonce, webview);
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'sidebar', 'app.js'),
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
  <title>Active Timer</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
