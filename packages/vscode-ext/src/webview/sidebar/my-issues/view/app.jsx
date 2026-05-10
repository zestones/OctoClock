// packages/vscode-ext/src/webview/sidebar/my-issues/view/app.jsx
//
// Entry point for the My Issues webview bundle.
// Mounts the Preact component tree into <div id="app">.

import { h, render } from 'preact';
import { MyIssuesPanel } from './MyIssuesPanel.jsx';

render(h(MyIssuesPanel, null), /** @type {Element} */(document.getElementById('app')));
