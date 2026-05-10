// packages/vscode-ext/src/webview/sidebar/team-stats/view/TeamStatsPanel.jsx
//
// Compact stats panel: KPI cards (your time today, team time this week),
// horizontal bar chart of top issues, team activity rows, and the
// Team stats sidebar with a Full Dashboard CTA.
//
// Receives a single `stats` message from the host carrying everything
// pre-aggregated; the webview is presentation-only.

import { useEffect, useState } from 'preact/hooks';
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

/**
 * Deterministic HSL color from a user login so each teammate gets a stable
 * avatar color across renders (matches the mockup's per-member avatar hue).
 * @param {string} login
 */
function avatarColor(login) {
    let hash = 0;
    for (let i = 0; i < login.length; i += 1) {
        hash = (hash * 31 + login.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    return `hsl(${hue}, 55%, 45%)`;
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

    useEffect(() => {
        vscode.postMessage({ type: 'ready' });
    }, []);

    if (!stats) {
        return <div class="ts-empty">Loading team stats…</div>;
    }

    const { myTimeToday, teamTimeWeek, issuesTouchedToday, issueBars, teamRows, currentUser } = stats;
    const maxBar = issueBars && issueBars.length > 0 ? Math.max(...issueBars.map((b) => b.seconds), 1) : 1;
    const avatarMap = currentUser?.login && currentUser?.avatarUrl
        ? { [currentUser.login]: currentUser.avatarUrl }
        : {};

    return (
        <div>
            {/* ── Stat cards ───────────────────────────────────────── */}
            <div class="stat-cards">
                <div class="stat-card accent">
                    <div class="sc-lbl">Your time today</div>
                    <div class="sc-val">{fmtHM(myTimeToday)}</div>
                    <div class="sc-sub">
                        {issuesTouchedToday || 0} issue{issuesTouchedToday === 1 ? '' : 's'}
                    </div>
                </div>
                <div class="stat-card">
                    <div class="sc-lbl">Team this week</div>
                    <div class="sc-val">{fmtHM(teamTimeWeek)}</div>
                    <div class="sc-sub">
                        {(teamRows || []).length} member{teamRows && teamRows.length === 1 ? '' : 's'}
                    </div>
                </div>
            </div>

            {/* ── Top issues ───────────────────────────────────────── */}
            <div class="team-hdr">Top issues</div>
            {!issueBars || issueBars.length === 0 ? (
                <div class="ts-empty">
                    No tracked time yet.
                    <span class="ts-hint">Start a timer on any issue to populate this view.</span>
                </div>
            ) : (
                issueBars.map((b) => {
                    const pct = Math.max(2, Math.round((b.seconds / maxBar) * 100));
                    return (
                        <div key={b.issueUrl} class="bar-row" title={b.title}>
                            {b.issueNumber ? <span class="bar-num">#{b.issueNumber}</span> : null}
                            <span class="bar-lbl">{b.title || 'Untitled'}</span>
                            <span class="bar-track">
                                <span class="bar-fill" style={`width:${pct}%`} />
                            </span>
                            <span class="bar-val">{fmtHM(b.seconds)}</span>
                        </div>
                    );
                })
            )}

            {/* ── Team today ───────────────────────────────────────── */}
            <div class="team-hdr">Team today</div>
            {!teamRows || teamRows.length === 0 ? (
                <div class="ts-empty">
                    No team activity yet.
                    <span class="ts-hint">Enable Auto Sync in Settings to see teammates.</span>
                </div>
            ) : (
                teamRows.map((r) => {
                    const url = avatarMap[r.user];
                    return (
                        <div key={r.user} class="team-row">
                            <span class="av" style={url ? '' : `background:${avatarColor(r.user)}`}>
                                {url ? <img src={url} alt={r.user} /> : initials(r.user)}
                            </span>
                            <span class="team-name" title={r.lastIssueTitle || ''}>{r.user}</span>
                            <span class="when">{recencyLabel(r.lastDate)}</span>
                            <span class="team-time">{fmtHM(r.todaySeconds)}</span>
                        </div>
                    );
                })
            )}

            {/* ── Full Dashboard button ────────────────────────────── */}
            <button
                type="button"
                class="dashboard-btn"
                onClick={() => vscode.postMessage({ type: 'openDashboard' })}
            >
                <i class="codicon codicon-graph" />
                <span>Full Dashboard</span>
                <i class="codicon codicon-chevron-right" />
            </button>
        </div>
    );
}
