import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { fetchAndMergeEveryoneData } from '../../../packages/core/src/services/everyone-data.service.js';
import { StorageService } from '../../../packages/core/src/services/storage.service.js';
import { AggregationService } from '../../../packages/core/src/utils/aggregation.utils.js';
import { STORAGE_KEYS } from '../../../packages/core/src/utils/constants.utils.js';
import { TimeService } from '../../../packages/core/src/utils/time.utils.js';
import {
    IconCalendar,
    IconChart,
    IconChevronRight,
    IconClock,
    IconTrendingUp,
    IconUser,
    IconUsers,
    IconX,
} from '../../icons.jsx';
import { RepoDetailView } from './RepoDetailView.jsx';

export function StatsTab({ tracked, user }) {
    const [rangeMode, setRangeMode] = useState('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [userMode, setUserMode] = useState('me');
    const [everyoneData, setEveryoneData] = useState(null);
    const [everyoneLoading, setEveryoneLoading] = useState(false);

    const userModes = [
        { id: 'me', label: 'Me', icon: IconUser },
        { id: 'everyone', label: 'Everyone', icon: IconUsers },
    ];
    const activeUserIndex = userModes.findIndex((m) => m.id === userMode);

    // Load cached everyone data on mount
    useEffect(() => {
        StorageService.get(STORAGE_KEYS.EVERYONE_DATA).then((cached) => {
            if (cached && cached.length > 0) setEveryoneData(cached);
        });
    }, []);

    // Auto-fetch when switching to Everyone
    useEffect(() => {
        if (userMode === 'everyone' && !everyoneLoading) {
            fetchEveryoneData();
        }
    }, [userMode]);

    const fetchEveryoneData = useCallback(async () => {
        setEveryoneLoading(true);
        try {
            const entries = await fetchAndMergeEveryoneData(user?.login ?? null, tracked);
            setEveryoneData(entries);
        } catch (e) {
            console.error('Failed to fetch everyone data:', e);
            setEveryoneData([]);
        } finally {
            setEveryoneLoading(false);
        }
    }, [tracked, user]);

    // In Everyone mode, always use fresh local data for current user + cached remote data for others
    const activeEntries = useMemo(() => {
        if (userMode === 'everyone') {
            const username = user?.login;
            // Others' entries from remote (exclude current user to avoid duplicates)
            const othersEntries = (everyoneData || []).filter((e) => e.user !== username);
            // Current user's entries from local tracked data (always fresh)
            const myEntries = tracked.map((e) => ({ ...e, user: username || 'me' }));
            return [...myEntries, ...othersEntries];
        }
        return tracked;
    }, [userMode, everyoneData, tracked, user]);

    const filteredEntries = useMemo(() => {
        if (rangeMode === 'today') return AggregationService.getTodayEntries(activeEntries);
        if (rangeMode === 'week') return AggregationService.getWeekEntries(activeEntries);
        if (rangeMode === 'month') return AggregationService.getMonthEntries(activeEntries);
        if (rangeMode === 'custom' && customStart && customEnd) {
            return AggregationService.filterByDateRange(activeEntries, customStart, customEnd);
        }
        return activeEntries;
    }, [activeEntries, rangeMode, customStart, customEnd]);

    const todaySeconds = useMemo(
        () => AggregationService.getTotalSeconds(AggregationService.getTodayEntries(activeEntries)),
        [activeEntries],
    );
    const weekSeconds = useMemo(
        () => AggregationService.getTotalSeconds(AggregationService.getWeekEntries(activeEntries)),
        [activeEntries],
    );
    const monthSeconds = useMemo(
        () => AggregationService.getTotalSeconds(AggregationService.getMonthEntries(activeEntries)),
        [activeEntries],
    );
    const allSeconds = useMemo(() => AggregationService.getTotalSeconds(activeEntries), [activeEntries]);

    const repoBreakdown = useMemo(() => AggregationService.getTimePerRepo(filteredEntries), [filteredEntries]);

    const repoDetails = useMemo(() => AggregationService.getRepoBreakdownDetailed(filteredEntries), [filteredEntries]);

    const maxSeconds = useMemo(() => Math.max(...repoBreakdown.map((r) => r.seconds), 1), [repoBreakdown]);

    const totalFiltered = useMemo(() => AggregationService.getTotalSeconds(filteredEntries), [filteredEntries]);

    const cards = [
        { id: 'today', label: 'Today', seconds: todaySeconds, icon: IconClock },
        { id: 'week', label: 'This Week', seconds: weekSeconds, icon: IconCalendar },
        { id: 'month', label: 'This Month', seconds: monthSeconds, icon: IconChart },
        { id: 'all', label: 'All Time', seconds: allSeconds, icon: IconTrendingUp },
    ];

    const barColors = [
        { bar: 'bg-accent', bg: 'bg-accent-subtle/50' },
        { bar: 'bg-violet-text', bg: 'bg-violet-subtle/50' },
        { bar: 'bg-amber-text', bg: 'bg-amber-subtle/50' },
        { bar: 'bg-success-dot', bg: 'bg-success-subtle/50' },
        { bar: 'bg-danger-muted', bg: 'bg-danger-subtle/50' },
        { bar: 'bg-accent-ring', bg: 'bg-accent-subtle/30' },
    ];

    // Detail view for a selected repo
    if (selectedRepo) {
        return (
            <RepoDetailView
                repo={selectedRepo}
                repoDetails={repoDetails[selectedRepo]}
                userMode={userMode}
                onBack={() => setSelectedRepo(null)}
            />
        );
    }

    return (
        <div className="p-4">
            {/* Summary cards — 2×2 grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                {cards.map((card) => {
                    const active = rangeMode === card.id;
                    const CardIcon = card.icon;
                    return (
                        <button
                            type="button"
                            key={card.id}
                            className={`relative rounded-xl p-3 text-left cursor-pointer transition-all w-full border overflow-hidden ${active
                                    ? 'bg-accent-subtle/50 border-accent-ring/40 shadow-sm'
                                    : 'bg-surface border-border-subtle hover:border-border-default hover:shadow-sm'
                                }`}
                            onClick={() => setRangeMode(card.id)}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span
                                    className={`text-[11px] font-medium ${active ? 'text-accent-text' : 'text-tertiary'}`}
                                >
                                    {card.label}
                                </span>
                                <CardIcon size={13} className={active ? 'text-accent' : 'text-faint'} />
                            </div>
                            <div
                                className={`text-[16px] font-bold font-mono tabular-nums ${active ? 'text-accent' : 'text-primary'}`}
                            >
                                {TimeService.formatTime(card.seconds)}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Filters row */}
            <div className="flex items-center gap-2 mb-4">
                {/* User filter — sliding pill */}
                <div className="relative flex items-center rounded-lg border border-border-default overflow-hidden bg-surface p-0.5">
                    <div
                        className="absolute top-0.5 bottom-0.5 rounded-md bg-accent-subtle pointer-events-none"
                        style={{
                            left: '2px',
                            width: 'calc(50% - 2px)',
                            transform: `translateX(${activeUserIndex * 100}%)`,
                            transition: 'transform 200ms ease-out',
                        }}
                    />
                    {userModes.map((mode) => {
                        const ModeIcon = mode.icon;
                        return (
                            <button
                                type="button"
                                key={mode.id}
                                onClick={() => setUserMode(mode.id)}
                                className={`relative z-10 flex items-center gap-1 text-[11px] cursor-pointer font-medium px-2.5 py-1.5 transition-colors ${userMode === mode.id ? 'text-accent' : 'text-tertiary hover:text-secondary'
                                    }`}
                            >
                                <ModeIcon size={11} /> {mode.label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1" />

                {/* Custom date range */}
                <button
                    type="button"
                    onClick={() => setRangeMode(rangeMode === 'custom' ? 'all' : 'custom')}
                    className={`flex items-center gap-1.5 text-[11px] cursor-pointer transition-all font-medium px-2.5 py-1.5 rounded-lg border ${rangeMode === 'custom'
                            ? 'bg-accent-subtle text-accent border-accent-ring'
                            : 'bg-surface text-tertiary border-border-default hover:bg-raised hover:text-secondary'
                        }`}
                >
                    {rangeMode === 'custom' ? (
                        <>
                            <IconX size={11} /> Close
                        </>
                    ) : (
                        <>
                            <IconCalendar size={11} /> Custom
                        </>
                    )}
                </button>
            </div>

            {rangeMode === 'custom' && (
                <div className="flex items-center gap-2 mb-4 bg-surface rounded-xl border border-border-subtle p-3">
                    <input
                        type="date"
                        value={customStart}
                        onInput={(e) => setCustomStart(e.currentTarget.value)}
                        className="text-[12px] border border-border-default rounded-lg px-2.5 py-1.5 flex-1 bg-base focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary"
                    />
                    <span className="text-faint text-[11px]">to</span>
                    <input
                        type="date"
                        value={customEnd}
                        onInput={(e) => setCustomEnd(e.currentTarget.value)}
                        className="text-[12px] border border-border-default rounded-lg px-2.5 py-1.5 flex-1 bg-base focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary"
                    />
                </div>
            )}

            {/* Per-repo breakdown */}
            <div>
                <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">Repositories</div>
                {repoBreakdown.length === 0 ? (
                    <div className="flex flex-col items-center py-10">
                        <div className="text-faint mb-2">
                            <IconChart size={28} />
                        </div>
                        <div className="text-[13px] text-muted">No tracked time in this period</div>
                        <div className="text-[11px] text-faint mt-0.5">Start a timer to see stats</div>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {repoBreakdown.map(({ repo, seconds, formatted }, i) => {
                            const percentage = totalFiltered > 0 ? Math.round((seconds / totalFiltered) * 100) : 0;
                            const color = barColors[i % barColors.length];

                            return (
                                <button
                                    type="button"
                                    key={repo}
                                    className="w-full text-left cursor-pointer group rounded-xl border border-border-subtle bg-surface hover:border-border-default hover:shadow-sm p-2.5 transition-all"
                                    onClick={() => setSelectedRepo(repo)}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[12px] text-primary truncate font-medium group-hover:text-accent transition-colors">
                                            {repo}
                                        </span>
                                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                            <span className="text-[11px] font-medium text-accent-text font-mono tabular-nums">
                                                {formatted}
                                            </span>
                                            <span className="text-[10px] font-medium text-secondary bg-raised px-1.5 py-0.5 rounded-full min-w-6 text-center">
                                                {percentage}%
                                            </span>
                                            <span className="text-muted opacity-40 group-hover:opacity-100 transition-opacity">
                                                <IconChevronRight size={12} />
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`w-full ${color.bg} rounded-full h-1.5`}>
                                        <div
                                            className={`${color.bar} h-1.5 rounded-full transition-all duration-500`}
                                            style={{ width: `${(seconds / maxSeconds) * 100}%` }}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
