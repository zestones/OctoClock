// packages/vscode-ext/src/webview/sidebar/active-timer/view/app.jsx
//
// Entry point for the Active Timer webview bundle.
// Mounts the Preact component tree into <div id="app">.

import { h, render } from 'preact';
import { ActiveTimerPanel } from './ActiveTimerPanel.jsx';

render(h(ActiveTimerPanel, null), /** @type {Element} */(document.getElementById('app')));
