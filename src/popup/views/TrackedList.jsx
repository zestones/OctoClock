import { useActiveTimer } from '../../hooks/useActiveTimer.js';
import { IconExternalLink, IconPlay, IconStop } from '../../icons.jsx';
import { TimerService } from '../../services/timer.service.js';

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
        <div className="space-y-1">
            {entries.map((entry, i) => (
                <div
                    key={entry.issueUrl || i}
                    className="flex items-center gap-2 p-2 hover:bg-surface rounded-lg group transition-colors"
                >
                    <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-primary truncate leading-snug">
                            {entry.issueNumber && (
                                <span className="text-muted font-mono text-[11px]">{entry.issueNumber} </span>
                            )}
                            {entry.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted">
                            <span className="font-mono tabular-nums">{entry.displayTime}</span>
                            {entry.repo && (
                                <>
                                    <span className="text-faint">·</span>
                                    <span className="text-faint truncate max-w-30">{entry.repo}</span>
                                </>
                            )}
                            {entry.date && (
                                <>
                                    <span className="text-faint">·</span>
                                    <span>{entry.date}</span>
                                </>
                            )}
                            <a
                                href={`https://github.com${entry.issueUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-accent hover:text-accent-hover transition-colors"
                            >
                                <IconExternalLink size={10} />
                                <span>View</span>
                            </a>
                        </div>
                    </div>
                    {showTimerControls && (
                        <button
                            type="button"
                            onClick={() => handleTimerClick(entry)}
                            className={`shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md cursor-pointer transition-all ${isActive(entry)
                                ? 'bg-danger-subtle text-danger-text hover:bg-danger-hover'
                                : 'bg-success-subtle text-success-text hover:bg-success-hover opacity-0 group-hover:opacity-100'
                                }`}
                        >
                            {isActive(entry) ? (
                                <>
                                    <IconStop size={10} /> Stop
                                </>
                            ) : (
                                <>
                                    <IconPlay size={10} /> Start
                                </>
                            )}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
