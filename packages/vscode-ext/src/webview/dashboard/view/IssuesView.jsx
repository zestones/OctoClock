// packages/vscode-ext/src/webview/dashboard/view/IssuesView.jsx
//
// Issues tab — expandable rows showing per-contributor breakdown.
// Expand/collapse state is local to the webview (no host round-trip),
// preserved across hide/show by `retainContextWhenHidden: true`.

import { useState } from 'preact/hooks';

/** @param {number} seconds */
function fmtHM(seconds) {
    if (!seconds || seconds < 0) return '0h';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
}

/** @param {{ payload: any }} props */
export function IssuesView({ payload }) {
    const [open, setOpen] = useState(/** @type {Record<string, boolean>} */({}));
    const { issueRows } = payload;

    /** @param {string} url */
    const toggle = (url) => setOpen((o) => ({ ...o, [url]: !o[url] }));

    if (issueRows.length === 0) {
        return <div class="empty-msg">No issues tracked in this range</div>;
    }

    return (
        <div>
            {issueRows.map((r) => {
                const isOpen = !!open[r.issueUrl];
                return (
                    <div key={r.issueUrl} class={`issue-row ${isOpen ? 'open' : ''}`}>
                        <div
                            class="hdr"
                            role="button"
                            tabIndex={0}
                            onClick={() => toggle(r.issueUrl)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') toggle(r.issueUrl);
                            }}
                        >
                            <i class="codicon codicon-chevron-right caret" />
                            <span class="title" title={r.issueUrl}>
                                {r.title}
                            </span>
                            <span class="repo">{r.repo || '—'}</span>
                            <span class="total">{fmtHM(r.seconds)}</span>
                        </div>
                        {isOpen && (
                            <div class="breakdown">
                                {r.byMember.map((m) => (
                                    <div key={m.user} class="br-row">
                                        <span class="u">{m.user}</span>
                                        <span class="s">
                                            {m.sessions} session{m.sessions === 1 ? '' : 's'}
                                        </span>
                                        <span class="t">{fmtHM(m.seconds)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
