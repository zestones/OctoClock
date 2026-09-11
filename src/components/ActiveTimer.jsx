import { useEffect, useState } from 'preact/hooks';
import { useElapsedTimer } from '../hooks/useElapsedTimer.js';
import { IconStop } from '../icons.jsx';
import { GitHubService } from '../services/github.service.js';
import { IssueStorageService } from '../services/issue-storage.service.js';
import { AggregationService } from '../utils/aggregation.utils.js';

export function ActiveTimer() {
    const { activeIssue, startTime, elapsedTime, stop } = useElapsedTimer({ includeTotalTime: true });
    const [issueInfo, setIssueInfo] = useState(null);

    useEffect(() => {
        if (!activeIssue) {
            setIssueInfo(null);
            return;
        }

        const loadInfo = async () => {
            const issue = await IssueStorageService.getByUrl(activeIssue);
            try {
                const parsed = GitHubService.parseIssueUrl(activeIssue);
                setIssueInfo({
                    ...parsed,
                    title: AggregationService.extractCleanTitle(issue?.title),
                });
            } catch (_e) {
                setIssueInfo({ fullRepo: 'unknown', issueNumber: 0, title: issue?.title || 'Untitled' });
            }
        };
        loadInfo();
    }, [activeIssue]);

    const handleStop = async () => {
        if (!activeIssue) return;
        await stop();
    };

    if (!activeIssue || !startTime) return null;

    return (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-success-subtle border-b border-success-border shrink-0">
            <div className="w-2 h-2 rounded-full bg-success-dot animate-pulse-dot shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="text-[11px] text-success-muted truncate">
                    {issueInfo?.fullRepo} #{issueInfo?.issueNumber}
                </div>
                <div className="text-[13px] font-medium text-success-text truncate">
                    {issueInfo?.title || 'Untitled'}
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-mono font-semibold text-success-text tabular-nums">
                    {elapsedTime || '00:00:00'}
                </span>
                <button
                    type="button"
                    onClick={handleStop}
                    className="flex items-center gap-1 bg-danger-muted hover:bg-danger-hover text-white text-[11px] font-medium pl-1.5 pr-2 py-1 rounded-md cursor-pointer transition-colors"
                >
                    <IconStop size={10} />
                    Stop
                </button>
            </div>
        </div>
    );
}
