// packages/vscode-ext/src/webview/dashboard/view/app.jsx
//
// Entry point for the Dashboard webview bundle.

import { h, render } from 'preact';
import { DashboardApp } from './DashboardApp.jsx';

render(h(DashboardApp, null), /** @type {Element} */ (document.getElementById('app')));
