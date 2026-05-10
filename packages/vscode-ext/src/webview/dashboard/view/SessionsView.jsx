// packages/vscode-ext/src/webview/dashboard/view/SessionsView.jsx
//
// Sessions tab: filter dropdowns (member + issue) and a date-grouped session log.
// Filtering happens host-side; this view only renders what the host returns.

import { useMemo } from 'preact/hooks';

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
 *   memberFilter: string|null,
 *   issueFilter: string|null,
 *   onFilterChange: (patch: { memberFilter?: string|null, issueFilter?: string|null }) => void,
 * }} props
 */
export function SessionsView({ payload, memberFilter, issueFilter, onFilterChange }) {
    const { memberRows, issueRows, sessionLog } = payload;

    const grouped = useMemo(() => {
        /** @type {Map<string, typeof sessionLog>} */
        const m = new Map();
        for (const s of sessionLog) {
            const arr = m.get(s.date) ?? [];
            arr.push(s);
            m.set(s.date, arr);
        }
        return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    }, [sessionLog]);

    return (
        <div>
            <div class="sess-filters">
                <label>
                    Member:&nbsp;
                    <select
                        value={memberFilter ?? ''}
                        onChange={(e) =>
                            onFilterChange({
                                memberFilter: /** @type {HTMLSelectElement} */ (e.currentTarget).value || null,
                            })
                        }
                    >
                        <option value="">All members</option>
                        {memberRows.map((m) => (
                            <option key={m.user} value={m.user}>
                                {m.user}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Issue:&nbsp;
                    <select
                        value={issueFilter ?? ''}
                        onChange={(e) =>
                            onFilterChange({
                                issueFilter: /** @type {HTMLSelectElement} */ (e.currentTarget).value || null,
                            })
                        }
                    >
                        <option value="">All issues</option>
                        {issueRows.map((i) => (
                            <option key={i.issueUrl} value={i.issueUrl}>
                                {i.title}
                            </option>
                        ))}
                    </select>
                </label>
                {(memberFilter || issueFilter) && (
                    <button
                        type="button"
                        class="pill"
                        onClick={() => onFilterChange({ memberFilter: null, issueFilter: null })}
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {grouped.length === 0 ? (
                <div class="empty-msg">No sessions in this range</div>
            ) : (
                grouped.map(([date, rows]) => (
                    <div key={date} class="sess-day">
                        <div class="day-hdr">{date}</div>
                        {rows.map((s, i) => (
                            <div key={`${date}-${i}`} class="sess-row">
                                <span class="title" title={s.issueUrl}>
                                    {s.title}
                                </span>
                                <span class="user">{s.user}</span>
                                <span class="dur">{fmtHM(s.seconds)}</span>
                            </div>
                        ))}
                    </div>
                ))
            )}
        </div>
    );
}
