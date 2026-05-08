import { useEffect, useMemo, useState } from 'preact/hooks';
import { EditTimeModal } from '../../components/EditTimeModal.jsx';
import { Modal } from '../../components/Modal.jsx';
import { SearchInput } from '../../components/SearchInput.jsx';
import {
    IconChevronLeft,
    IconChevronRight,
    IconClock,
    IconEdit,
    IconExternalLink,
    IconTrash,
    IconUser,
} from '../../icons.jsx';
import { TimerService } from '../../services/timer.service.js';
import { TimeService } from '../../utils/time.utils.js';
import { ContributorsView } from './ContributorsView.jsx';

export function RepoDetailView({ repo, repoDetails, userMode, onBack }) {
    const [expandedIssue, setExpandedIssue] = useState(null);
    const [filterText, setFilterText] = useState('');
    const [editingSession, setEditingSession] = useState(null);
    const [deletingSession, setDeletingSession] = useState(null);
    const [sessionStatus, setSessionStatus] = useState(null);
    const [detailTab, setDetailTab] = useState('issues');

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
    const totalSessions = useMemo(() => issueList.reduce((s, i) => s + i.sessionCount, 0), [issueList]);
    const maxIssueSeconds = useMemo(() => Math.max(...issueList.map((i) => i.totalSeconds), 1), [issueList]);

    const allUsers = useMemo(() => [...new Set(issueList.flatMap((i) => i.uniqueUsers))], [issueList]);
    const showTabs = userMode === 'everyone' && allUsers.length > 1;
    const tabOptions = [
        { id: 'issues', label: 'Issues' },
        { id: 'contributors', label: 'Contributors' },
    ];
    const activeTabIndex = tabOptions.findIndex((t) => t.id === detailTab);

    useEffect(() => {
        if (!sessionStatus) return;
        const timeoutId = setTimeout(() => setSessionStatus(null), 5000);
        return () => clearTimeout(timeoutId);
    }, [sessionStatus]);

    return (
        <div className="flex flex-col h-full">
            {/* Sticky header */}
            <div className="px-4 pt-3 pb-2 shrink-0 border-b border-border-subtle">
                {/* Back + repo name row */}
                <div className="flex items-center gap-2 mb-2">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-0.5 text-[12px] text-accent hover:text-accent-hover cursor-pointer font-medium transition-colors shrink-0"
                    >
                        <IconChevronLeft size={14} />
                        Back
                    </button>
                    <span className="text-faint text-[12px]">·</span>
                    <span className="text-[13px] font-semibold text-primary truncate">{repo}</span>
                    <a
                        href={`https://github.com/${repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted hover:text-accent transition-colors shrink-0"
                    >
                        <IconExternalLink size={11} />
                    </a>
                </div>

                {/* Metric pills */}
                <div className="flex items-center gap-1.5 mb-2">
                    <div className="flex items-center gap-1.5 bg-surface border border-border-subtle rounded-lg px-2 py-1">
                        <IconClock size={11} className="text-accent" />
                        <span className="text-[11px] font-mono font-semibold tabular-nums text-accent-text">
                            {TimeService.formatTime(totalSeconds)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface border border-border-subtle rounded-lg px-2 py-1">
                        <span className="text-[11px] font-semibold text-primary">{issueList.length}</span>
                        <span className="text-[10px] text-muted">issue{issueList.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface border border-border-subtle rounded-lg px-2 py-1">
                        <span className="text-[11px] font-semibold text-primary">{totalSessions}</span>
                        <span className="text-[10px] text-muted">session{totalSessions !== 1 ? 's' : ''}</span>
                    </div>
                    {userMode === 'everyone' && allUsers.length > 1 && (
                        <div className="flex items-center gap-1.5 bg-surface border border-border-subtle rounded-lg px-2 py-1">
                            <IconUser size={11} className="text-accent" />
                            <span className="text-[11px] font-semibold text-primary">{allUsers.length}</span>
                            <span className="text-[10px] text-muted">contrib.</span>
                        </div>
                    )}
                </div>

                {/* Tab toggle */}
                {showTabs && (
                    <div className="relative flex bg-surface rounded-lg p-0.5 mb-2 border border-border-subtle">
                        <div
                            className="absolute top-0.5 bottom-0.5 rounded-md bg-base shadow-sm pointer-events-none"
                            style={{
                                left: '2px',
                                width: 'calc(50% - 1px)',
                                transform: `translateX(${activeTabIndex * 100}%)`,
                                transition: 'transform 200ms ease-out',
                            }}
                        />
                        {tabOptions.map((t) => (
                            <button
                                type="button"
                                key={t.id}
                                onClick={() => setDetailTab(t.id)}
                                className={`relative z-10 flex-1 text-[11px] px-2 py-1.5 rounded-md cursor-pointer transition-colors font-medium text-center ${detailTab === t.id ? 'text-accent-text' : 'text-muted hover:text-secondary'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Search (issues tab only) */}
                {detailTab === 'issues' && (
                    <>
                        <SearchInput
                            placeholder="Filter issues..."
                            value={filterText}
                            onInput={setFilterText}
                            className=""
                        />
                        {sessionStatus && (
                            <div className="text-[11px] mt-1.5 text-center text-danger-text">{sessionStatus}</div>
                        )}
                    </>
                )}
            </div>

            {/* Scrollable content */}
            {detailTab === 'issues' ? (
                <div className="flex-1 overflow-y-auto popup-scroll px-4 pt-2 pb-2">
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
                                const percentage =
                                    maxIssueSeconds > 0 ? (issue.totalSeconds / maxIssueSeconds) * 100 : 0;

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
                                                        .sort(
                                                            (a, b) =>
                                                                b.date.localeCompare(a.date) || b.seconds - a.seconds,
                                                        )
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
                                                                    <div className="shrink-0 flex items-center gap-1.5">
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
                                                                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-base border border-transparent hover:border-accent-ring/30 hover:bg-accent-subtle/30 text-[11px] text-accent-text hover:text-accent cursor-pointer transition-colors font-mono tabular-nums"
                                                                            title="Edit session time"
                                                                        >
                                                                            <IconEdit size={11} />
                                                                            {TimeService.formatTime(session.seconds)}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setDeletingSession({
                                                                                    issueUrl: issue.url,
                                                                                    date: session.date,
                                                                                    seconds: session.seconds,
                                                                                });
                                                                            }}
                                                                            className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md bg-base border border-border-subtle text-muted hover:text-danger-text hover:bg-danger-subtle hover:border-danger-border cursor-pointer transition-colors"
                                                                            aria-label="Delete session"
                                                                            title="Delete session"
                                                                        >
                                                                            <IconTrash size={12} />
                                                                        </button>
                                                                    </div>
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
                </div>
            ) : (
                <ContributorsView repoDetails={details} />
            )}

            {editingSession && (
                <EditTimeModal
                    date={editingSession.date}
                    seconds={editingSession.seconds}
                    onCancel={() => setEditingSession(null)}
                    onConfirm={async (newSeconds) => {
                        const result = await TimerService.updateSessionTime(
                            editingSession.issueUrl,
                            editingSession.date,
                            editingSession.seconds,
                            newSeconds,
                        );
                        if (!result.ok) {
                            setSessionStatus('Could not update the session. Try again.');
                            return;
                        }
                        setEditingSession(null);
                        setSessionStatus(
                            result.syncStatus === 'failed'
                                ? `Saved locally, comment sync failed: ${result.syncError || 'unknown error'}`
                                : null,
                        );
                    }}
                />
            )}

            {deletingSession && (
                <Modal
                    title="Delete session"
                    message={`Delete the ${TimeService.formatTime(deletingSession.seconds)} session on ${deletingSession.date}? This cannot be undone.`}
                    confirmLabel="Delete"
                    confirmVariant="danger"
                    onCancel={() => setDeletingSession(null)}
                    onConfirm={async () => {
                        const pendingDelete = deletingSession;
                        setDeletingSession(null);

                        const result = await TimerService.deleteSession(
                            pendingDelete.issueUrl,
                            pendingDelete.date,
                            pendingDelete.seconds,
                        );
                        if (!result.ok) {
                            setSessionStatus('Could not delete the session. Try again.');
                            return;
                        }
                        setSessionStatus(
                            result.syncStatus === 'failed'
                                ? `Saved locally, comment sync failed: ${result.syncError || 'unknown error'}`
                                : null,
                        );
                    }}
                />
            )}
        </div>
    );
}
