// packages/vscode-ext/src/webview/sidebar/my-issues/provider.js
//
// WebviewViewProvider for the "My Issues" sidebar panel.
// Lists open GitHub issues assigned to the authenticated user.
//
// TODO (UI-2): implement full My Issues UI.

import * as vscode from 'vscode';
import { buildCsp } from '../../csp.js';
import { getNonce } from '../../nonce.js';

export class MyIssuesProvider {
    static viewType = 'octoclock.myIssues';

    /** @param {vscode.ExtensionContext} context */
    constructor(context) {
        this._context = context;
    }

    /** @param {vscode.WebviewView} webviewView */
    resolveWebviewView(webviewView) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._context.extensionUri, 'dist'),
            ],
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
  <title>My Issues</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
