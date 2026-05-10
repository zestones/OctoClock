// packages/vscode-ext/src/webview/sidebar/team-stats/view/TeamStatsPanel.jsx
//
// Compact stats panel: KPI cards (your time today, team time this week),
// horizontal bar chart of top issues, team activity rows, and the
// "Full Dashboard →" button.
//
// Receives a single `stats` message from the host carrying everything
// pre-aggregated; the webview is presentation-only.

import { useState } from 'preact/hooks';
import { useVscodeMessage } from '../../../shared/hooks/useVscodeMessage.js';

// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();

/** @param {number} seconds */
function fmtHM(seconds) {
    if (!seconds || seconds < 0) return '0h';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
}

/** @param {string} login */
function initials(login) {
    if (!login) return '?';
    const parts = login.replace(/[-_]/g, ' ').split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** @param {string} dateStr — "YYYY-MM-DD" */
function recencyLabel(dateStr) {
    if (!dateStr) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr);
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diff <= 0) return 'today';
    if (diff === 1) return 'yesterday';
    if (diff < 7) return `${diff}d ago`;
    return dateStr;
}

export function TeamStatsPanel() {
    const [stats, setStats] = useState(/** @type {any} */(null));

    useVscodeMessage('stats', (msg) => setStats(msg.payload));

    if (!stats) {
        return (
            <div class="ts-section">
                <div class="ts-empty">Loading team stats…</div>
            </div>
        );
    }

    const { myTimeToday, teamTimeWeek, issuesTouchedToday, issueBars, teamRows } = stats;
    const maxBar = issueBars && issueBars.length > 0 ? Math.max(...issueBars.map((b) => b.seconds), 1) : 1;

    return (
        <div>
            <div class="ts-section">
                <div class="kpi-grid">
                    <div class="kpi">
                        <div class="kpi-label">Your time today</div>
                        <div class="kpi-value">{fmtHM(myTimeToday)}</div>
                        <div class="kpi-sub">
                            {issuesTouchedToday || 0} issue{issuesTouchedToday === 1 ? '' : 's'}
                        </div>
                    </div>
                    <div class="kpi">
                        <div class="kpi-label">Team this week</div>
                        <div class="kpi-value">{fmtHM(teamTimeWeek)}</div>
                        <div class="kpi-sub">
                            {(teamRows || []).length} member{teamRows && teamRows.length === 1 ? '' : 's'}
                        </div>
                    </div>
                </div>
            </div>

            <div class="ts-section">
                <div class="ts-heading">Top issues</div>
                {!issueBars || issueBars.length === 0 ? (
                    <div class="ts-empty">No tracked time yet</div>
                ) : (
                    <div class="bars">
                        {issueBars.map((b) => (
                            <div key={b.issueUrl}>
                                <div class="bar-row">
                                    <span class="bar-lbl" title={b.title}>
                                        {b.title}
                                    </span>
                                    <span class="bar-time">{fmtHM(b.seconds)}</span>
                                </div>
                                <div class="bar-track">
                                    <div class="bar-fill" style={`width:${Math.round((b.seconds / maxBar) * 100)}%`} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div class="ts-section">
                <div class="ts-heading">Team today</div>
                {!teamRows || teamRows.length === 0 ? (
                    <div class="ts-empty">No team activity today</div>
                ) : (
                    teamRows.map((r) => (
                        <div key={r.user} class="team-row">
                            <span class="avatar">{initials(r.user)}</span>
                            <div>
                                <div class="team-name">{r.user}</div>
                                <div class="team-meta">
                                    {r.lastIssueTitle || '—'} · {recencyLabel(r.lastDate)}
                                </div>
                            </div>
                            <span class="team-time">{fmtHM(r.todaySeconds)}</span>
                        </div>
                    ))
                )}
            </div>

            <div class="ts-footer">
                <button
                    type="button"
                    class="btn-dashboard"
                    onClick={() => vscode.postMessage({ type: 'openDashboard' })}
                >
                    <i class="codicon codicon-dashboard" />
                    &nbsp;Full Dashboard&nbsp;&rarr;
                </button>
            </div>
        </div>
    );
}
