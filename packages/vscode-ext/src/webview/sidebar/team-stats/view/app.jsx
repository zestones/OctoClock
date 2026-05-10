// packages/vscode-ext/src/webview/sidebar/team-stats/view/app.jsx
//
// Entry point for the Team Stats webview bundle.

import { h, render } from 'preact';
import { TeamStatsPanel } from './TeamStatsPanel.jsx';

render(h(TeamStatsPanel, null), /** @type {Element} */(document.getElementById('app')));
