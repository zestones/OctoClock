import { useMemo, useState } from 'preact/hooks';
import { EditTimeModal } from '../../components/EditTimeModal.jsx';
import { SearchInput } from '../../components/SearchInput.jsx';
import { IconChevronLeft, IconChevronRight, IconClock, IconEdit, IconExternalLink } from '../../icons.jsx';
import { TimerService } from '../../services/timer.service.js';
import { TimeService } from '../../utils/time.utils.js';

export function RepoDetailView({ repo, repoDetails, userMode, onBack }) {
    const [expandedIssue, setExpandedIssue] = useState(null);
    const [filterText, setFilterText] = useState('');
    const [editingSession, setEditingSession] = useState(null);

    const details = repoDetails || {};
    const issueList = useMemo(() => {
        return Object.entries(details)
            .map(([url, data]) => ({
                url,
                ...data,
                sessionCount: data.sessions.length,
                uniqueUsers: [...new Set(data.sessions.map((s) => s.user).filter(Boolean))],
            }))
            .sort((a, b) => b.totalSeconds - a.totalSeconds);
    }, [details]);

    const filtered = useMemo(() => {
        if (!filterText) return issueList;
        const term = filterText.toLowerCase();
        return issueList.filter(
            (i) => i.title.toLowerCase().includes(term) || i.issueNumber.toLowerCase().includes(term),
        );
    }, [issueList, filterText]);

    const totalSeconds = useMemo(() => issueList.reduce((s, i) => s + i.totalSeconds, 0), [issueList]);
    const maxIssueSeconds = useMemo(() => Math.max(...issueList.map((i) => i.totalSeconds), 1), [issueList]);

    return (
        <div className="p-4">
            {/* Back button */}
            <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1 text-[12px] text-accent hover:text-accent-hover cursor-pointer font-medium mb-3 transition-colors"
            >
                <IconChevronLeft size={14} />
                Back
            </button>

            {/* Repo name + link */}
            <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] font-semibold text-primary truncate">{repo}</span>
                <a
                    href={`https://github.com/${repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted hover:text-accent transition-colors shrink-0"
                >
                    <IconExternalLink size={12} />
                </a>
            </div>

            {/* Summary line */}
            <div className="flex items-center gap-3 text-[11px] text-muted mb-4">
                <span className="font-mono font-semibold text-accent-text tabular-nums">
                    {TimeService.formatTime(totalSeconds)}
                </span>
                <span className="text-faint">·</span>
                <span>{issueList.length} issue{issueList.length !== 1 ? 's' : ''}</span>
                {userMode === 'everyone' &&
                    (() => {
                        const allUsers = [...new Set(issueList.flatMap((i) => i.uniqueUsers))];
                        return allUsers.length > 1 ? (
                            <>
                                <span className="text-faint">·</span>
                                <span>{allUsers.length} contributors</span>
                            </>
                        ) : null;
                    })()}
            </div>

            {/* Filter (only if many issues) */}
            {issueList.length > 5 && (
                <div className="mb-3">
                    <SearchInput placeholder="Filter issues..." value={filterText} onInput={setFilterText} className="" />
                </div>
            )}

            {/* Issue list */}
            <div className="space-y-1">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center py-8">
                        <div className="text-faint mb-2">
                            <IconClock size={24} />
                        </div>
                        <div className="text-[12px] text-muted">No issues found</div>
                    </div>
                ) : (
                    filtered.map((issue) => {
                        const isOpen = expandedIssue === issue.url;
                        const percentage = maxIssueSeconds > 0 ? (issue.totalSeconds / maxIssueSeconds) * 100 : 0;

                        return (
                            <div key={issue.url}>
                                {/* Issue row */}
                                <button
                                    type="button"
                                    className={`w-full text-left rounded-xl px-3 py-2 cursor-pointer transition-all border ${isOpen
                                            ? 'bg-surface border-border-default shadow-sm'
                                            : 'bg-base border-transparent hover:bg-surface hover:border-border-subtle'
                                        }`}
                                    onClick={() => setExpandedIssue(isOpen ? null : issue.url)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`text-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                                        >
                                            <IconChevronRight size={10} />
                                        </span>
                                        <span className="text-[12px] text-primary truncate flex-1">
                                            {issue.issueNumber && (
                                                <span className="text-muted font-mono text-[11px] mr-1">
                                                    {issue.issueNumber}
                                                </span>
                                            )}
                                            {issue.title}
                                        </span>
                                        <span className="text-[11px] font-mono font-semibold tabular-nums text-accent-text shrink-0">
                                            {TimeService.formatTime(issue.totalSeconds)}
                                        </span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="mt-1.5 ml-5 bg-raised rounded-full h-1">
                                        <div
                                            className="bg-accent h-1 rounded-full transition-all duration-500"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </button>

                                {/* Expanded sessions */}
                                <div className={`repo-expand ${isOpen ? 'expanded' : ''}`}>
                                    <div>
                                        <div className="ml-7 py-1 space-y-0.5">
                                            {issue.sessions
                                                .sort((a, b) => b.date.localeCompare(a.date) || b.seconds - a.seconds)
                                                .map((session, si) => (
                                                    <div
                                                        key={si}
                                                        className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] hover:bg-surface transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2 text-muted">
                                                            <span className="font-medium text-secondary">
                                                                {session.date}
                                                            </span>
                                                            {session.user && userMode === 'everyone' && (
                                                                <span className="text-[10px] bg-raised px-1.5 py-0.5 rounded-full">
                                                                    {session.user}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {userMode !== 'everyone' ? (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingSession({
                                                                        issueUrl: issue.url,
                                                                        date: session.date,
                                                                        seconds: session.seconds,
                                                                    });
                                                                }}
                                                                className="flex items-center gap-1 text-[11px] text-accent-text hover:text-accent cursor-pointer transition-colors font-mono tabular-nums"
                                                                title="Adjust tracked time"
                                                            >
                                                                <IconEdit size={10} />
                                                                {TimeService.formatTime(session.seconds)}
                                                            </button>
                                                        ) : (
                                                            <span className="text-secondary font-mono tabular-nums">
                                                                {TimeService.formatTime(session.seconds)}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {editingSession && (
                <EditTimeModal
                    date={editingSession.date}
                    seconds={editingSession.seconds}
                    onCancel={() => setEditingSession(null)}
                    onConfirm={async (newSeconds) => {
                        await TimerService.updateSessionTime(
                            editingSession.issueUrl,
                            editingSession.date,
                            editingSession.seconds,
                            newSeconds,
                        );
                        setEditingSession(null);
                    }}
                />
            )}
        </div>
    );
}
