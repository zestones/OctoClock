// packages/vscode-ext/src/webview/sidebar/tracked-time/provider.js
//
// WebviewViewProvider for the "Tracked Time" sidebar panel.
// Shows a breakdown of time tracked per issue / repository.
//
// TODO (UI-3): implement full Tracked Time UI.

import * as vscode from 'vscode';
import { buildCsp } from '../../csp.js';
import { getNonce } from '../../nonce.js';

export class TrackedTimeProvider {
    static viewType = 'octoclock.trackedTime';

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
  <title>Tracked Time</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
