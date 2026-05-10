// packages/vscode-ext/src/webview/sidebar/my-issues/view/IssueList.jsx
//
// Filtered list of issue rows. Each row shows:
//   - Status icon (open / closed / active timer)
//   - Issue title with search highlight
//   - On hover: start-timer button + open-in-GitHub button
//
// CSS classes defined in html.js.

import { h } from 'preact';

/**
 * Escape special HTML characters to prevent XSS.
 * @param {string} s
 * @returns {string}
 */
function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Wrap the first match of query in <mark>. Both inputs are HTML-escaped first.
 * @param {string} text
 * @param {string} query
 * @returns {string} — safe HTML string
 */
function highlight(text, query) {
    const escaped = escHtml(text);
    if (!query) return escaped;
    const escapedQuery = escHtml(query);
    const idx = escaped.toLowerCase().indexOf(escapedQuery.toLowerCase());
    if (idx === -1) return escaped;
    return (
        escaped.slice(0, idx) +
        '<mark>' +
        escaped.slice(idx, idx + escapedQuery.length) +
        '</mark>' +
        escaped.slice(idx + escapedQuery.length)
    );
}

/**
 * @param {{
 *   issues: Array<{ id: number, title: string, status: string, repo: string, url: string }>,
 *   query: string,
 *   statusTab: string,
 *   timerRunning: boolean,
 *   activeIssueId: number|null,
 *   onStart: (url: string) => void,
 *   onStop: () => void,
 *   onOpen: (url: string) => void,
 * }} props
 */
export function IssueList({ issues, query, statusTab, timerRunning, activeIssueId, onStart, onOpen }) {
    const q = query.toLowerCase();

    const filtered = issues.filter((issue) => {
        const matchStatus = statusTab === 'all' || issue.status === statusTab;
        const matchQuery = !q || issue.title.toLowerCase().includes(q) || String(issue.id).includes(q.replace('#', ''));
        return matchStatus && matchQuery;
    });

    if (filtered.length === 0) {
        const msg = issues.length === 0 ? 'Loading\u2026' : 'No matching issues';
        return <div class="no-results">{msg}</div>;
    }

    return (
        <div>
            {filtered.map((issue) => {
                const isActive = timerRunning && issue.id === activeIssueId;
                const isClosed = issue.status === 'closed';
                const iconColor = isActive ? 'var(--oc-timer)' : isClosed ? 'var(--oc-muted)' : 'var(--oc-open)';
                const iconName = isActive
                    ? 'codicon-clock'
                    : isClosed
                      ? 'codicon-issue-closed'
                      : 'codicon-issue-opened';

                // dangerouslySetInnerHTML is safe here — highlight() HTML-escapes
                // both text and query before inserting <mark>.
                const labelHtml = `#${issue.id}&nbsp;&nbsp;${highlight(issue.title, query)}`;

                return (
                    <div key={issue.id} class="row">
                        <i class={`codicon ${iconName} row-icon`} style={`color:${iconColor}`} />
                        {/* eslint-disable-next-line react/no-danger */}
                        <span
                            class={`row-lbl${isClosed ? ' dim' : ''}`}
                            dangerouslySetInnerHTML={{ __html: labelHtml }}
                        />
                        <div class="row-act">
                            {!isClosed && (
                                <button
                                    type="button"
                                    class="ib btn-start"
                                    title={isActive ? 'Already tracking' : 'Start timer'}
                                    disabled={isActive}
                                    onClick={() => !isActive && onStart(issue.url)}
                                >
                                    <i class={`codicon ${isActive ? 'codicon-clock' : 'codicon-play'}`} />
                                </button>
                            )}
                            <button
                                type="button"
                                class="ib btn-open"
                                title="Open in GitHub"
                                onClick={() => onOpen(issue.url)}
                            >
                                <i class="codicon codicon-link-external" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
