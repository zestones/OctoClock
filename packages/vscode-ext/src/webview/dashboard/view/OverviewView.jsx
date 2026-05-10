// packages/vscode-ext/src/webview/dashboard/view/OverviewView.jsx
//
// Overview tab: KPI strip, daily bar chart, top-issue table, team leaderboard.

/** @param {number} seconds */
function fmtHM(seconds) {
    if (!seconds || seconds < 0) return '0h';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
}

/** @param {{ payload: any }} props */
export function OverviewView({ payload }) {
    const { total, sessionsCount, issuesTouched, membersCount, dailyBuckets, issueRows, memberRows } = payload;
    const maxDay = dailyBuckets.length > 0 ? Math.max(...dailyBuckets.map((d) => d.seconds), 1) : 1;

    return (
        <div>
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
                <div class="kpi-card">
                    <div class="lbl">Members</div>
                    <div class="val">{membersCount}</div>
                    <div class="sub">active</div>
                </div>
            </div>

            <div class="daily-chart">
                <div class="heading">Daily breakdown</div>
                {dailyBuckets.length === 0 ? (
                    <div class="empty-msg">No data in this range</div>
                ) : (
                    <div class="daily-bars">
                        {dailyBuckets.map((d) => (
                            <div key={d.date} class="daily-bar" title={`${d.date} — ${fmtHM(d.seconds)}`}>
                                <div class="fill" style={`height:${Math.round((d.seconds / maxDay) * 76)}px`} />
                                <div class="lbl">{d.date.slice(5)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div class="dash-section">
                <h3>Top issues</h3>
                {issueRows.length === 0 ? (
                    <div class="empty-msg">No issues tracked in this range</div>
                ) : (
                    <table class="dash-table">
                        <thead>
                            <tr>
                                <th>Issue</th>
                                <th>Members</th>
                                <th>Sessions</th>
                                <th class="num">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {issueRows.map((r) => (
                                <tr key={r.issueUrl}>
                                    <td title={r.issueUrl}>{r.title}</td>
                                    <td>{r.members.join(', ')}</td>
                                    <td>{r.sessions}</td>
                                    <td class="num">{fmtHM(r.seconds)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div class="dash-section">
                <h3>Team leaderboard</h3>
                {memberRows.length === 0 ? (
                    <div class="empty-msg">No member activity in this range</div>
                ) : (
                    <table class="dash-table">
                        <thead>
                            <tr>
                                <th>Member</th>
                                <th>Last issue</th>
                                <th>Sessions</th>
                                <th class="num">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {memberRows.map((r) => (
                                <tr key={r.user}>
                                    <td>{r.user}</td>
                                    <td>{r.lastIssueTitle || '—'}</td>
                                    <td>{r.sessions}</td>
                                    <td class="num">{fmtHM(r.seconds)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
