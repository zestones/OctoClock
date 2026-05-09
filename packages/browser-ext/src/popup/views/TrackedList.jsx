import { TimerService } from '../../../../core/src/services/timer.service.js';
import { useActiveTimer } from '../../hooks/useActiveTimer.js';
import { IconClock, IconExternalLink, IconPlay, IconStop } from '../../icons.jsx';

export function TrackedList({ entries, showTimerControls = false }) {
    const { isActive: isTimerActive } = useActiveTimer();

    const handleTimerClick = async (entry) => {
        if (isTimerActive(entry.issueUrl)) {
            await TimerService.stopTimer(entry.issueUrl);
        } else {
            await TimerService.startTimer(entry.issueUrl);
        }
    };

    const isActive = (entry) => isTimerActive(entry.issueUrl);

    return (
        <div className="space-y-0.5">
            {entries.map((entry, i) => {
                const active = isActive(entry);
                return (
                    <div
                        key={entry.issueUrl || i}
                        className={`relative py-1.5 px-2.5 my-0.5 rounded-lg border transition-all group ${
                            active
                                ? 'bg-success-subtle/60 border-success-border border-l-[3px] border-l-success-dot shadow-sm'
                                : 'bg-surface border-border-subtle hover:border-border-default hover:shadow-sm'
                        }`}
                    >
                        {/* Top row: number + title + open link */}
                        <div className="flex items-start gap-1.5 mb-0.5">
                            <a
                                href={`https://github.com${entry.issueUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-w-0 group/link"
                            >
                                <span className="text-[13px] text-primary leading-snug line-clamp-2 group-hover/link:text-accent transition-colors">
                                    {entry.issueNumber && (
                                        <span className="text-muted font-mono text-[11px] mr-1">
                                            {entry.issueNumber}
                                        </span>
                                    )}
                                    {entry.title}
                                </span>
                            </a>
                            <span className="text-muted opacity-0 group-hover:opacity-60 shrink-0 mt-0.5 pointer-events-none transition-opacity">
                                <IconExternalLink size={11} />
                            </span>
                        </div>

                        {/* Bottom row: tracked time + repo + action button */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[11px] text-muted">
                                <div className="flex items-center gap-1">
                                    <IconClock size={11} className="text-accent" />
                                    <span className="font-mono font-medium text-accent-text">{entry.displayTime}</span>
                                </div>
                                {entry.repo && (
                                    <>
                                        <span className="text-faint">·</span>
                                        <span className="text-faint truncate max-w-28">{entry.repo}</span>
                                    </>
                                )}
                            </div>

                            {showTimerControls && (
                                <button
                                    type="button"
                                    onClick={() => handleTimerClick(entry)}
                                    className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                                        active
                                            ? 'bg-danger-subtle text-danger-text hover:bg-danger-hover'
                                            : 'bg-success-subtle text-success-text hover:bg-success-hover opacity-40 group-hover:opacity-100'
                                    }`}
                                >
                                    {active ? (
                                        <>
                                            <IconStop size={11} /> Stop
                                        </>
                                    ) : (
                                        <>
                                            <IconPlay size={11} /> Start
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
