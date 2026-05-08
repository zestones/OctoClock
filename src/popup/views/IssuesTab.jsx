import { useMemo, useState } from 'preact/hooks';
import { IssueRow } from '../../components/IssueRow.jsx';
import { PinRepoModal } from '../../components/PinRepoModal.jsx';
import { SearchInput } from '../../components/SearchInput.jsx';
import { useActiveTimer } from '../../hooks/useActiveTimer.js';
import { useIssuesData } from '../../hooks/useIssuesData.js';
import { useStorageListener } from '../../hooks/useStorageListener.js';
import { IconChevronRight, IconPin, IconPlus, IconRefresh, IconSearch, IconX } from '../../icons.jsx';
import { IssueStorageService } from '../../services/issue-storage.service.js';
import { TimerService } from '../../services/timer.service.js';
import { STORAGE_KEYS } from '../../utils/constants.utils.js';

export function IssuesTab({ filter, onFilterChange }) {
    const [expandedRepos, setExpandedRepos] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [showPinModal, setShowPinModal] = useState(false);

    const filterOptions = [
        { id: 'open', label: 'Open' },
        { id: 'assigned', label: 'Assigned' },
        { id: 'created', label: 'Created' },
        { id: 'closed', label: 'Closed' },
    ];
    const activeFilterIndex = filterOptions.findIndex((f) => f.id === filter);

    const tracked = useStorageListener(STORAGE_KEYS.TRACKED_TIMES, []);
    const { activeIssue } = useActiveTimer();
    const { pinnedRepos, repoIssues, loading, currentUser, refreshRepoIssues, pinRepo, unpinRepo } = useIssuesData();

    const trackedTimeByIssue = useMemo(() => {
        const map = {};
        for (const entry of tracked) {
            map[entry.issueUrl] = (map[entry.issueUrl] || 0) + entry.seconds;
        }
        return map;
    }, [tracked]);

    const handleStart = async (issue) => {
        const [owner, repo] = issue.issueUrl.split('/').slice(1, 3);
        const fullTitle = `(${owner}) ${repo} | ${issue.title} | #${issue.number}`;
        await IssueStorageService.add({ url: issue.issueUrl, title: fullTitle });
        await TimerService.startTimer(issue.issueUrl);
    };

    const handleStop = async (issue) => {
        await TimerService.stopTimer(issue.issueUrl);
    };

    const filterIssue = (issue) => {
        if (filter === 'closed') return issue.state === 'closed';
        if (filter === 'open') return issue.state !== 'closed';
        if (filter === 'assigned') return issue.state !== 'closed' && (issue.assignees || []).includes(currentUser);
        if (filter === 'created') return issue.state !== 'closed' && issue.user === currentUser;
        return true;
    };

    const allFilteredIssues = useMemo(() => {
        if (!searchTerm) return null;
        const term = searchTerm.toLowerCase();
        const all = [];
        for (const [fullName, issues] of Object.entries(repoIssues)) {
            for (const issue of issues || []) {
                if (!filterIssue(issue)) continue;
                if (
                    issue.title.toLowerCase().includes(term) ||
                    `#${issue.number}`.includes(term) ||
                    fullName.toLowerCase().includes(term)
                ) {
                    all.push({ ...issue, repoName: fullName });
                }
            }
        }
        return all;
    }, [searchTerm, repoIssues, filter, currentUser]);

    return (
        <div className="flex flex-col h-full">
            {/* Fixed controls */}
            <div className="px-4 pt-3 pb-1 shrink-0 border-b border-border-subtle">
                {/* Search + Pin */}
                <div className="flex gap-2 mb-2">
                    <div className="flex-1">
                        <SearchInput
                            placeholder="Search issues..."
                            value={searchTerm}
                            onInput={setSearchTerm}
                            className=""
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowPinModal(true)}
                        className="shrink-0 w-1/3 flex items-center justify-center gap-1.5 text-[12px] font-medium text-muted hover:text-accent border border-dashed border-border-default hover:border-accent rounded-lg cursor-pointer transition-all hover:bg-accent-subtle/30"
                        title="Pin a repository"
                    >
                        <IconPlus size={13} />
                        Pin a repository
                    </button>
                </div>

                {/* Segmented filter control */}
                <div className="relative flex bg-surface rounded-lg p-0.5 mb-2 border border-border-subtle">
                    <div
                        className="absolute top-0.5 bottom-0.5 rounded-md bg-base shadow-sm pointer-events-none"
                        style={{
                            left: '2px',
                            width: 'calc(25% - 1px)',
                            transform: `translateX(${activeFilterIndex * 100}%)`,
                            transition: 'transform 200ms ease-out',
                        }}
                    />
                    {filterOptions.map((f) => (
                        <button
                            type="button"
                            key={f.id}
                            onClick={() => onFilterChange(f.id)}
                            className={`relative z-10 flex-1 text-[11px] px-2 py-1.5 rounded-md cursor-pointer transition-colors font-medium text-center ${
                                filter === f.id ? 'text-accent-text' : 'text-muted hover:text-secondary'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto popup-scroll px-4 pt-2 pb-14">
                {searchTerm && allFilteredIssues && (
                    <div>
                        {allFilteredIssues.length === 0 ? (
                            <div className="flex flex-col items-center py-10">
                                <div className="text-faint mb-2">
                                    <IconSearch size={28} />
                                </div>
                                <div className="text-[13px] text-muted">No issues found</div>
                                <div className="text-[11px] text-faint mt-0.5">Try a different search term</div>
                            </div>
                        ) : (
                            allFilteredIssues.map((issue) => (
                                <div key={issue.issueUrl}>
                                    <div className="text-[11px] text-muted px-2 mt-2 mb-0.5 font-medium">
                                        {issue.repoName}
                                    </div>
                                    <IssueRow
                                        issue={issue}
                                        isActive={activeIssue === issue.issueUrl}
                                        onStart={handleStart}
                                        onStop={handleStop}
                                        trackedSeconds={trackedTimeByIssue[issue.issueUrl] || 0}
                                    />
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Pinned repos */}
                {!searchTerm && (
                    <div>
                        {pinnedRepos.length === 0 && (
                            <div className="text-center py-10">
                                <div className="text-faint mb-3">
                                    <IconPin size={32} className="mx-auto" />
                                </div>
                                <div className="text-[13px] text-tertiary mb-1">No pinned repos yet</div>
                                <button
                                    type="button"
                                    onClick={() => setShowPinModal(true)}
                                    className="text-[13px] text-accent hover:text-accent-hover cursor-pointer font-medium"
                                >
                                    Pin your first repository
                                </button>
                            </div>
                        )}

                        {pinnedRepos.map((repo) => {
                            const issues = (repoIssues[repo.fullName] || []).filter(filterIssue);
                            const isExpanded = expandedRepos[repo.fullName];
                            return (
                                <div key={repo.fullName} className="mb-2">
                                    {/* Repo card header */}
                                    <div
                                        className={`flex items-center justify-between py-2.5 px-3 cursor-pointer rounded-xl border transition-all ${
                                            isExpanded
                                                ? 'bg-accent-subtle/40 border-accent-ring/30 shadow-sm'
                                                : 'bg-surface border-border-subtle hover:border-border-default hover:shadow-sm'
                                        }`}
                                        onClick={() =>
                                            setExpandedRepos((prev) => ({
                                                ...prev,
                                                [repo.fullName]: !prev[repo.fullName],
                                            }))
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setExpandedRepos((prev) => ({
                                                    ...prev,
                                                    [repo.fullName]: !prev[repo.fullName],
                                                }));
                                            }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="text-muted transition-transform duration-200"
                                                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                            >
                                                <IconChevronRight size={13} />
                                            </span>
                                            <span className="text-[13px] font-medium text-primary truncate">
                                                {repo.fullName}
                                            </span>
                                            {!loading[repo.fullName] && (
                                                <span className="text-[10px] font-medium text-muted bg-raised px-1.5 py-0.5 rounded-full shrink-0 min-w-5 text-center tabular-nums">
                                                    {issues.length}
                                                </span>
                                            )}
                                            {loading[repo.fullName] && (
                                                <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    refreshRepoIssues(repo);
                                                }}
                                                className="text-muted hover:text-secondary cursor-pointer p-1 rounded-lg hover:bg-raised transition-colors"
                                                title="Refresh issues"
                                            >
                                                <IconRefresh size={12} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    await unpinRepo(repo.fullName);
                                                }}
                                                className="text-muted hover:text-danger-text cursor-pointer p-1 rounded-lg hover:bg-raised transition-colors"
                                                title="Unpin repo"
                                            >
                                                <IconX size={12} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded issues list */}
                                    <div className={`repo-expand ${isExpanded ? 'expanded' : ''}`}>
                                        <div>
                                            <div className="mt-1 ml-3 pl-3 border-l border-border-subtle">
                                                {loading[repo.fullName] && !repoIssues[repo.fullName] ? (
                                                    <div className="space-y-2 py-2 pl-2">
                                                        {[1, 2, 3].map((i) => (
                                                            <div
                                                                key={i}
                                                                className="animate-pulse flex items-start gap-2"
                                                            >
                                                                <div className="w-2 h-2 mt-1.5 rounded-full bg-raised" />
                                                                <div className="flex-1 space-y-1.5">
                                                                    <div className="h-3 bg-raised rounded w-3/4" />
                                                                    <div className="h-2.5 bg-raised rounded w-1/3" />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : issues.length === 0 ? (
                                                    <div className="text-[12px] text-muted py-4 pl-2">
                                                        {filter === 'closed'
                                                            ? 'No closed issues'
                                                            : filter === 'open'
                                                              ? 'No open issues'
                                                              : 'No matching issues'}
                                                    </div>
                                                ) : (
                                                    issues.map((issue) => (
                                                        <IssueRow
                                                            key={issue.issueUrl}
                                                            issue={issue}
                                                            isActive={activeIssue === issue.issueUrl}
                                                            onStart={handleStart}
                                                            onStop={handleStop}
                                                            trackedSeconds={trackedTimeByIssue[issue.issueUrl] || 0}
                                                        />
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showPinModal && (
                <PinRepoModal
                    onClose={() => setShowPinModal(false)}
                    onPin={async (repo) => {
                        await pinRepo(repo);
                        setExpandedRepos((prev) => ({ ...prev, [repo.fullName]: true }));
                    }}
                    pinnedRepos={pinnedRepos}
                />
            )}
        </div>
    );
}
