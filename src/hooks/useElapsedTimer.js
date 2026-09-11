import { useEffect, useRef, useState } from 'preact/hooks';
import { TimerService } from '../services/timer.service.js';
import { TIME_UPDATE_INTERVAL } from '../utils/constants.utils.js';
import { TimeService } from '../utils/time.utils.js';
import { useActiveTimer } from './useActiveTimer.js';

/**
 * Provides a live-updating formatted elapsed time string for the active timer.
 * Optionally includes previously tracked total time for the issue.
 *
 * @param {{ includeTotalTime?: boolean }} [options]
 * @returns {{ activeIssue: string|null, startTime: string|null, elapsedTime: string|null, isActive: (issueUrl: string) => boolean, stop: (issueUrl?: string) => Promise<void> }}
 */
export function useElapsedTimer({ includeTotalTime = false } = {}) {
    const { activeIssue, startTime, isActive, stop } = useActiveTimer();
    const [elapsedTime, setElapsedTime] = useState(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (!activeIssue || !startTime || Number.isNaN(new Date(startTime).getTime())) {
            setElapsedTime(null);
            return;
        }

        let cancelled = false;

        const startTicking = (offset) => {
            if (cancelled) return;
            const tick = () => {
                const elapsed = (Date.now() - new Date(startTime).getTime()) / 1000;
                setElapsedTime(TimeService.formatTime(elapsed + offset));
            };
            tick();
            intervalRef.current = setInterval(tick, TIME_UPDATE_INTERVAL);
        };

        if (includeTotalTime) {
            TimerService.getTotalTimeForIssue(activeIssue).then((total) => {
                startTicking(total);
            });
        } else {
            startTicking(0);
        }

        return () => {
            cancelled = true;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [activeIssue, startTime, includeTotalTime]);

    return { activeIssue, startTime, elapsedTime, isActive, stop };
}
