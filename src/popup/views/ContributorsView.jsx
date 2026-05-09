import { useMemo, useState } from 'preact/hooks';
import { TimeService } from '../../../packages/core/src/utils/time.utils.js';
import { IconChevronRight, IconUser } from '../../icons.jsx';

export function ContributorsView({ repoDetails }) {
    const [expandedUser, setExpandedUser] = useState(null);

    const details = repoDetails || {};

    const contributors = useMemo(() => {
        const userMap = {};
        for (const [url, data] of Object.entries(details)) {
            for (const session of data.sessions) {
                if (!session.user) continue;
                if (!userMap[session.user]) {
                    userMap[session.user] = { seconds: 0, sessions: 0, issues: new Set() };
                }
                userMap[session.user].seconds += session.seconds || 0;
                userMap[session.user].sessions += 1;
                userMap[session.user].issues.add(url);
            }
        }
        return Object.entries(userMap)
            .map(([user, stats]) => ({
                user,
                seconds: stats.seconds,
                sessionCount: stats.sessions,
                issueCount: stats.issues.size,
                avgSession: stats.sessions > 0 ? Math.round(stats.seconds / stats.sessions) : 0,
            }))
            .sort((a, b) => b.seconds - a.seconds);
    }, [details]);

    const userIssues = useMemo(() => {
        if (!expandedUser) return [];
        const issues = {};
        for (const [url, data] of Object.entries(details)) {
            const userSessions = data.sessions.filter((s) => s.user === expandedUser);
            if (userSessions.length === 0) continue;
            const totalSeconds = userSessions.reduce((sum, s) => sum + (s.seconds || 0), 0);
            issues[url] = {
                title: data.title,
                issueNumber: data.issueNumber,
                totalSeconds,
                sessionCount: userSessions.length,
                sessions: userSessions,
            };
        }
        return Object.entries(issues)
            .map(([url, data]) => ({ url, ...data }))
            .sort((a, b) => b.totalSeconds - a.totalSeconds);
    }, [details, expandedUser]);

    const totalSeconds = useMemo(() => contributors.reduce((s, c) => s + c.seconds, 0), [contributors]);
    const maxSeconds = useMemo(() => Math.max(...contributors.map((c) => c.seconds), 1), [contributors]);

    const barColors = [
        { bar: 'bg-accent', bg: 'bg-accent-subtle/50', dot: 'bg-accent' },
        { bar: 'bg-violet-text', bg: 'bg-violet-subtle/50', dot: 'bg-violet-text' },
        { bar: 'bg-amber-text', bg: 'bg-amber-subtle/50', dot: 'bg-amber-text' },
        { bar: 'bg-success-dot', bg: 'bg-success-subtle/50', dot: 'bg-success-dot' },
        { bar: 'bg-danger-muted', bg: 'bg-danger-subtle/50', dot: 'bg-danger-muted' },
        { bar: 'bg-accent-ring', bg: 'bg-accent-subtle/30', dot: 'bg-accent-ring' },
    ];

    return (
        <div className="flex-1 overflow-y-auto popup-scroll px-4 pt-2 pb-2">
            {contributors.length === 0 ? (
                <div className="flex flex-col items-center py-10">
                    <div className="text-faint mb-2">
                        <IconUser size={28} />
                    </div>
                    <div className="text-[13px] text-muted">No contributor data</div>
                    <div className="text-[11px] text-faint mt-0.5">Refresh everyone's data first</div>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {/* Distribution bar chart */}
                    <div className="bg-surface border border-border-subtle rounded-xl p-3 mb-1">
                        <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">
                            Time distribution
                        </div>
                        {/* Stacked bar */}
                        <div className="flex h-4 rounded-lg overflow-hidden bg-raised mb-2.5">
                            {contributors.map((contrib, i) => {
                                const pct = totalSeconds > 0 ? (contrib.seconds / totalSeconds) * 100 : 0;
                                if (pct < 0.5) return null;
                                return (
                                    <div
                                        key={contrib.user}
                                        className={`${barColors[i % barColors.length].bar} transition-all duration-500`}
                                        style={{ width: `${pct}%` }}
                                        title={`${contrib.user}: ${TimeService.formatTime(contrib.seconds)} (${Math.round(pct)}%)`}
                                    />
                                );
                            })}
                        </div>
                        {/* Legend */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {contributors.map((contrib, i) => {
                                const pct = totalSeconds > 0 ? Math.round((contrib.seconds / totalSeconds) * 100) : 0;
                                return (
                                    <div key={contrib.user} className="flex items-center gap-1">
                                        <div
                                            className={`w-2 h-2 rounded-full ${barColors[i % barColors.length].dot} shrink-0`}
                                        />
                                        <span className="text-[10px] text-secondary truncate max-w-20">
                                            {contrib.user}
                                        </span>
                                        <span className="text-[10px] text-faint font-mono tabular-nums">{pct}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {contributors.map((contrib, i) => {
                        const pct = totalSeconds > 0 ? Math.round((contrib.seconds / totalSeconds) * 100) : 0;
                        const isOpen = expandedUser === contrib.user;
                        const color = barColors[i % barColors.length];

                        return (
                            <div key={contrib.user}>
                                <button
                                    type="button"
                                    className={`w-full text-left rounded-xl p-2.5 cursor-pointer transition-all border ${isOpen
                                            ? 'bg-surface border-border-default shadow-sm'
                                            : 'bg-base border-transparent hover:bg-surface hover:border-border-subtle'
                                        }`}
                                    onClick={() => setExpandedUser(isOpen ? null : contrib.user)}
                                >
                                    {/* Name + time row */}
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className={`text-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                                            >
                                                <IconChevronRight size={10} />
                                            </span>
                                            <div className={`w-2.5 h-2.5 rounded-full ${color.dot} shrink-0`} />
                                            <span className="text-[12px] text-primary font-medium">{contrib.user}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                            <span className="text-[11px] font-mono font-semibold tabular-nums text-accent-text">
                                                {TimeService.formatTime(contrib.seconds)}
                                            </span>
                                            <span className="text-[10px] font-medium text-secondary bg-raised px-1.5 py-0.5 rounded-full min-w-6 text-center">
                                                {pct}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Bar with colored track */}
                                    <div className={`ml-5 ${color.bg} rounded-full h-1.5 mb-1.5`}>
                                        <div
                                            className={`${color.bar} h-1.5 rounded-full transition-all duration-500`}
                                            style={{ width: `${(contrib.seconds / maxSeconds) * 100}%` }}
                                        />
                                    </div>

                                    {/* Stats row */}
                                    <div className="ml-5 flex items-center gap-3 text-[10px] text-muted">
                                        <span>
                                            <span className="font-semibold text-secondary">{contrib.issueCount}</span>{' '}
                                            issue{contrib.issueCount !== 1 ? 's' : ''}
                                        </span>
                                        <span>
                                            <span className="font-semibold text-secondary">{contrib.sessionCount}</span>{' '}
                                            session{contrib.sessionCount !== 1 ? 's' : ''}
                                        </span>
                                        <span>
                                            avg{' '}
                                            <span className="font-semibold text-secondary font-mono tabular-nums">
                                                {TimeService.formatTime(contrib.avgSession)}
                                            </span>
                                        </span>
                                    </div>
                                </button>

                                {/* Expanded: per-issue breakdown for this user */}
                                <div className={`repo-expand ${isOpen ? 'expanded' : ''}`}>
                                    <div>
                                        <div className="ml-5 py-1 space-y-0.5">
                                            {userIssues.map((issue) => (
                                                <div
                                                    key={issue.url}
                                                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] hover:bg-surface transition-colors"
                                                >
                                                    <span className="text-primary truncate flex-1 mr-2">
                                                        {issue.issueNumber && (
                                                            <span className="text-muted font-mono text-[10px] mr-1">
                                                                {issue.issueNumber}
                                                            </span>
                                                        )}
                                                        {issue.title}
                                                    </span>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[10px] text-muted">
                                                            {issue.sessionCount} sess.
                                                        </span>
                                                        <span className="font-mono font-semibold tabular-nums text-accent-text">
                                                            {TimeService.formatTime(issue.totalSeconds)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
