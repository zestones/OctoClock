// packages/vscode-ext/src/webview/dashboard/view/MemberDetailView.jsx
//
// Drill-down sub-view for a single member: KPI cards + per-issue table + session log.

/** @param {string} name */
function initials(name) {
    if (!name) return '?';
    const parts = name
        .replace(/[()]/g, '')
        .split(/[\s_\-.]+/)
        .filter(Boolean);
    if (parts.length === 0) return name.charAt(0).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** @param {number} seconds */
function fmtHM(seconds) {
    if (!seconds || seconds < 0) return '0h';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
}

/**
 * @param {{
 *   detail: any,
 *   onBack: () => void,
 * }} props
 */
export function MemberDetailView({ detail, onBack }) {
    if (!detail) return <div class="empty-msg">Loading member…</div>;
    const { user, total, sessionsCount, issuesTouched, issueRows, sessionLog } = detail;

    return (
        <div>
            <button type="button" class="drill-back" onClick={onBack}>
                <i class="codicon codicon-arrow-left" />
                &nbsp;Back to members
            </button>
            <div class="drill-hdr">
                <div class="avatar">{initials(user)}</div>
                <div class="name">{user}</div>
            </div>
            <div class="kpi-strip">
                <div class="kpi-card">
                    <div class="lbl">Total time</div>
                    <div class="val">{fmtHM(total)}</div>
                    <div class="sub">in selected range</div>
                </div>
                <div class="kpi-card">
                    <div class="lbl">Sessions</div>
                    <div class="val">{sessionsCount}</div>
                    <div class="sub">recorded</div>
                </div>
                <div class="kpi-card">
                    <div class="lbl">Issues</div>
                    <div class="val">{issuesTouched}</div>
                    <div class="sub">touched</div>
                </div>
            </div>

            <div class="dash-section">
                <h3>Issues</h3>
                {issueRows.length === 0 ? (
                    <div class="empty-msg">No issues for this member in this range</div>
                ) : (
                    <table class="dash-table">
                        <thead>
                            <tr>
                                <th>Issue</th>
                                <th>Sessions</th>
                                <th class="num">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {issueRows.map((r) => (
                                <tr key={r.issueUrl}>
                                    <td title={r.issueUrl}>{r.title}</td>
                                    <td>{r.sessions}</td>
                                    <td class="num">{fmtHM(r.seconds)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div class="dash-section">
                <h3>Session log</h3>
                {sessionLog.length === 0 ? (
                    <div class="empty-msg">No sessions</div>
                ) : (
                    sessionLog.map((s, i) => (
                        <div key={`${s.date}-${i}`} class="sess-row">
                            <span class="title" title={s.issueUrl}>
                                {s.title}
                            </span>
                            <span class="user">{s.date}</span>
                            <span class="dur">{fmtHM(s.seconds)}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
