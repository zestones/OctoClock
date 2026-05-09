import { useEffect, useState } from 'preact/hooks';
import { StorageService } from '../../packages/core/src/services/storage.service.js';
import { storageEvents } from '../../packages/core/src/services/storage-events.js';
import { TimerService } from '../../packages/core/src/services/timer.service.js';
import { STORAGE_KEYS } from '../../packages/core/src/utils/constants.utils.js';

/**
 * @param {import('../../packages/core/src/ports/storage-events.port.js').StorageEventsPort} [eventsPort]
 */
export function useActiveTimer(eventsPort = storageEvents) {
    const [activeIssue, setActiveIssue] = useState(null);
    const [startTime, setStartTime] = useState(null);

    useEffect(() => {
        const load = async () => {
            const [active, start] = await Promise.all([
                StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE),
                StorageService.get(STORAGE_KEYS.START_TIME),
            ]);
            setActiveIssue(active);
            setStartTime(start);
        };
        load();

        const unsubscribe = eventsPort.subscribe((event) => {
            if (event.type === 'set') {
                if (event.key === STORAGE_KEYS.ACTIVE_ISSUE) setActiveIssue(event.value ?? null);
                if (event.key === STORAGE_KEYS.START_TIME) setStartTime(event.value ?? null);
            } else if (event.type === 'remove') {
                if (event.key === STORAGE_KEYS.ACTIVE_ISSUE) setActiveIssue(null);
                if (event.key === STORAGE_KEYS.START_TIME) setStartTime(null);
            } else if (event.type === 'removeMultiple') {
                if (event.keys.includes(STORAGE_KEYS.ACTIVE_ISSUE)) setActiveIssue(null);
                if (event.keys.includes(STORAGE_KEYS.START_TIME)) setStartTime(null);
            }
        });
        return unsubscribe;
    }, [eventsPort]);

    const isActive = (issueUrl) =>
        issueUrl === activeIssue && startTime && !Number.isNaN(new Date(startTime).getTime());

    const stop = async (issueUrl) => {
        const url = issueUrl ?? activeIssue;
        if (!url) return;
        await TimerService.stopTimer(url);
    };

    return { activeIssue, startTime, isActive, stop };
}
