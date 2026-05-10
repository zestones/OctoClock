// packages/vscode-ext/src/webview/dashboard/view/MembersView.jsx
//
// Members tab — 2-column CSS grid of member cards. Clicking a card
// triggers the drill-down via the `onSelect` callback.

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
 *   payload: any,
 *   onSelect: (user: string) => void,
 * }} props
 */
export function MembersView({ payload, onSelect }) {
    const { memberRows } = payload;
    if (memberRows.length === 0) {
        return <div class="empty-msg">No members in this range</div>;
    }
    const max = Math.max(...memberRows.map((m) => m.seconds), 1);

    return (
        <div class="members-grid">
            {memberRows.map((m) => (
                <div
                    key={m.user}
                    class="member-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(m.user)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onSelect(m.user);
                    }}
                >
                    <div class="top">
                        <div class="avatar">{initials(m.user)}</div>
                        <div class="name">{m.user}</div>
                    </div>
                    <div class="stats">
                        <span>
                            Total: <span class="v">{fmtHM(m.seconds)}</span>
                        </span>
                        <span>
                            Sessions: <span class="v">{m.sessions}</span>
                        </span>
                    </div>
                    <div class="bar">
                        <div class="fill" style={`width:${Math.round((m.seconds / max) * 100)}%`} />
                    </div>
                </div>
            ))}
        </div>
    );
}
