import { TimeService } from '../../packages/core/src/utils/time.utils.js';
import { IconClock, IconExternalLink, IconPlay, IconStop } from '../icons.jsx';

export function IssueRow({ issue, isActive, onStart, onStop, trackedSeconds = 0 }) {
    const isClosed = issue.state === 'closed';
    return (
        <div
            className={`relative py-1.5 px-2.5 my-0.5 rounded-md border transition-all group ${isActive
                    ? 'bg-success-subtle/60 border-success-border border-l-[3px] border-l-success-dot shadow-sm'
                    : 'bg-base border-border-subtle hover:border-border-default hover:shadow-sm'
                } ${isClosed ? 'opacity-55' : ''}`}
        >
            {/* Top row: number + title + open link */}
            <div className="flex items-start gap-1.5 mb-0.5">
                <span
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isClosed ? 'bg-violet-value' : 'bg-success-dot'}`}
                />
                <a
                    href={`https://github.com${issue.issueUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 group/link"
                >
                    <span className="text-[13px] text-primary leading-snug line-clamp-2 group-hover/link:text-accent transition-colors">
                        <span className="text-muted font-mono text-[11px] mr-1">#{issue.number}</span>
                        <span className={isClosed ? 'line-through text-tertiary' : ''}>{issue.title}</span>
                    </span>
                </a>
                <span className="text-muted opacity-0 group-hover:opacity-60 shrink-0 mt-0.5 pointer-events-none transition-opacity">
                    <IconExternalLink size={11} />
                </span>
            </div>

            {/* Bottom row: tracked time + action button */}
            <div className="flex items-center justify-between ml-4">
                <div className="flex items-center gap-1 text-[11px] text-muted">
                    {trackedSeconds > 0 ? (
                        <>
                            <IconClock size={11} className="text-accent" />
                            <span className="font-mono font-medium text-accent-text">
                                {TimeService.formatTime(trackedSeconds)}
                            </span>
                        </>
                    ) : (
                        <span className="text-faint">No time tracked</span>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => (isActive ? onStop(issue) : onStart(issue))}
                    className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg cursor-pointer transition-all ${isActive
                            ? 'bg-danger-subtle text-danger-text hover:bg-danger-hover'
                            : 'bg-success-subtle text-success-text hover:bg-success-hover opacity-40 group-hover:opacity-100'
                        }`}
                >
                    {isActive ? (
                        <>
                            <IconStop size={11} />
                            <span>Stop</span>
                        </>
                    ) : (
                        <>
                            <IconPlay size={11} />
                            <span>Start</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
