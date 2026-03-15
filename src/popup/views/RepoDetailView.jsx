import { useMemo, useState } from 'preact/hooks';
import { EditTimeModal } from '../../components/EditTimeModal.jsx';
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconEdit, IconExternalLink } from '../../icons.jsx';
import { TimerService } from '../../services/timer.service.js';
import { TimeService } from '../../utils/time.utils.js';

const SORT_OPTIONS = [
    { key: 'time', label: 'Time' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'avg', label: 'Avg' },
    { key: 'days', label: 'Days' },
];

export function RepoDetailView({ repo, repoDetails, userMode, onBack }) {
    const [sort, setSort] = useState({ key: 'time', dir: 'desc' });
    const [expandedIssue, setExpandedIssue] = useState(null);
    const [filterText, setFilterText] = useState('');
    const [editingSession, setEditingSession] = useState(null);

    const details = repoDetails || {};
    const issueList = useMemo(() => {
        return Object.entries(details).map(([url, data]) => ({
            url,
            ...data,
            sessionCount: data.sessions.length,
            avgSession: data.sessions.length > 0 ? data.totalSeconds / data.sessions.length : 0,
            uniqueDays: new Set(data.sessions.map((s) => s.date)).size,
            uniqueUsers: [...new Set(data.sessions.map((s) => s.user).filter(Boolean))],
        }));
    }, [details]);

    const filtered = useMemo(() => {
        if (!filterText) return issueList;
        const term = filterText.toLowerCase();
        return issueList.filter(
            (i) => i.title.toLowerCase().includes(term) || i.issueNumber.toLowerCase().includes(term),
        );
    }, [issueList, filterText]);

    const sorted = useMemo(() => {
        const list = [...filtered];
        const { key, dir } = sort;
        list.sort((a, b) => {
            let av, bv;
            if (key === 'time') {
                av = a.totalSeconds;
                bv = b.totalSeconds;
            } else if (key === 'sessions') {
                av = a.sessionCount;
                bv = b.sessionCount;
            } else if (key === 'avg') {
                av = a.avgSession;
                bv = b.avgSession;
            } else if (key === 'days') {
                av = a.uniqueDays;
                bv = b.uniqueDays;
            } else {
                av = a.totalSeconds;
                bv = b.totalSeconds;
            }
            return dir === 'asc' ? av - bv : bv - av;
        });
        return list;
    }, [filtered, sort]);

    const handleSort = (key) => {
        setSort((prev) => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
        }));
    };

    const totalSeconds = useMemo(() => issueList.reduce((s, i) => s + i.totalSeconds, 0), [issueList]);
    const totalSessions = useMemo(() => issueList.reduce((s, i) => s + i.sessionCount, 0), [issueList]);
    const allUsers = useMemo(() => [...new Set(issueList.flatMap((i) => i.uniqueUsers))], [issueList]);

    const stats = [
        { label: 'Total Time', value: TimeService.formatTime(totalSeconds) },
        { label: 'Issues', value: issueList.length },
        { label: 'Sessions', value: totalSessions },
        { label: 'Avg/Session', value: TimeService.formatTime(totalSessions > 0 ? totalSeconds / totalSessions : 0) },
    ];

    return (
        <div className="p-4">
            {/* Header */}
            <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1 text-[12px] text-accent hover:text-accent-hover cursor-pointer font-medium mb-3 transition-colors"
            >
                <IconChevronLeft size={14} />
                Back to overview
            </button>
            <div className="flex items-center gap-2 mb-4">
                <span className="text-[15px] font-semibold text-primary">{repo}</span>
                <a
                    href={`https://github.com/${repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-tertiary hover:text-accent transition-colors"
                >
                    <IconExternalLink size={12} />
                </a>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-4 gap-2 mb-4">
                {stats.map((s) => (
                    <div key={s.label} className="bg-surface rounded-lg p-2 text-center">
                        <div className="text-[10px] text-tertiary font-medium uppercase tracking-wider">{s.label}</div>
                        <div className="text-[13px] font-bold text-primary font-mono tabular-nums mt-0.5">
                            {s.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Contributors (everyone mode) */}
            {userMode === 'everyone' && allUsers.length > 1 && (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <span className="text-[11px] text-tertiary font-medium">Contributors:</span>
                    {allUsers.map((u) => (
                        <span key={u} className="text-[10px] text-secondary bg-raised px-1.5 py-0.5 rounded-full">
                            {u}
                        </span>
                    ))}
                </div>
            )}

            {/* Filter + Sort row */}
            <div className="flex items-center gap-2 mb-3">
                {issueList.length > 5 && (
                    <input
                        type="text"
                        placeholder="Filter issues..."
                        value={filterText}
                        onInput={(e) => setFilterText(e.currentTarget.value)}
                        className="flex-1 text-[12px] border border-border-default rounded-lg px-2.5 py-1.5 bg-surface focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary placeholder:text-tertiary"
                    />
                )}
                <div className="flex items-center gap-1 shrink-0">
                    {SORT_OPTIONS.map((opt) => {
                        const isActive = sort.key === opt.key;
                        const arrow = isActive ? (sort.dir === 'asc' ? '↑' : '↓') : '';
                        return (
                            <button
                                type="button"
                                key={opt.key}
                                onClick={() => handleSort(opt.key)}
                                className={`text-[10px] px-1 py-1 rounded-md cursor-pointer transition-colors font-medium ${isActive
                                        ? 'bg-accent-subtle text-accent'
                                        : 'text-tertiary hover:bg-raised hover:text-secondary'
                                    }`}
                            >
                                {opt.label}
                                {arrow && ` ${arrow}`}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Issue list */}
            <div className="space-y-1">
                {sorted.length === 0 ? (
                    <div className="text-[12px] text-tertiary text-center py-6">No issues match filter</div>
                ) : (
                    sorted.map((issue) => {
                        const isOpen = expandedIssue === issue.url;
                        return (
                            <div key={issue.url}>
                                <button
                                    type="button"
                                    className="flex items-start gap-1.5 py-2 px-2 rounded-lg hover:bg-surface cursor-pointer transition-colors w-full text-left"
                                    onClick={() => setExpandedIssue(isOpen ? null : issue.url)}
                                >
                                    <span className="text-tertiary shrink-0 mt-0.5">
                                        {isOpen ? <IconChevronDown size={11} /> : <IconChevronRight size={11} />}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-[12px] text-primary truncate">
                                                {issue.issueNumber && (
                                                    <span className="text-tertiary font-mono mr-1">
                                                        {issue.issueNumber}
                                                    </span>
                                                )}
                                                {issue.title}
                                            </span>
                                            <span className="text-[12px] font-mono tabular-nums text-primary font-semibold shrink-0">
                                                {TimeService.formatTime(issue.totalSeconds)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-tertiary">
                                            <span>
                                                {issue.sessionCount} session{issue.sessionCount !== 1 ? 's' : ''}
                                            </span>
                                            <span>avg {TimeService.formatTime(issue.avgSession)}</span>
                                            <span>
                                                {issue.uniqueDays} day{issue.uniqueDays !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                                {isOpen && (
                                    <div className="ml-6 border-l-2 border-border-subtle pl-3 py-1 mb-1 space-y-1.5">
                                        {issue.sessions
                                            .sort((a, b) => b.date.localeCompare(a.date) || b.seconds - a.seconds)
                                            .map((session, si) => (
                                                <div
                                                    key={si}
                                                    className="flex items-center justify-between gap-3 rounded-lg bg-surface px-2.5 py-2 text-[11px]"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-secondary font-medium">
                                                            {session.date}
                                                        </span>
                                                        {session.user && userMode === 'everyone' && (
                                                            <span className="text-[10px] text-secondary bg-raised px-1.5 py-0.5 rounded-full">
                                                                {session.user}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {userMode !== 'everyone' && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setEditingSession({
                                                                        issueUrl: issue.url,
                                                                        date: session.date,
                                                                        seconds: session.seconds,
                                                                    })
                                                                }
                                                                className="flex items-center gap-1.5 text-[11px] font-medium text-accent bg-accent-subtle hover:bg-accent hover:text-white cursor-pointer transition-all px-2.5 py-1 rounded-md font-mono tabular-nums shadow-sm"
                                                                title="Adjust tracked time"
                                                            >
                                                                <IconEdit size={12} />
                                                                {TimeService.formatTime(session.seconds)}
                                                            </button>
                                                        )}
                                                        {userMode === 'everyone' && (
                                                            <span className="text-secondary font-mono tabular-nums bg-raised px-2.5 py-1 rounded-md">
                                                                {TimeService.formatTime(session.seconds)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
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
