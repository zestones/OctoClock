import { useEffect, useState } from 'preact/hooks';
import { StorageService } from '../services/storage.service.js';
import { TimerService } from '../services/timer.service.js';
import { STORAGE_KEYS } from '../utils/constants.utils.js';

export function useActiveTimer() {
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

        const listener = (changes, area) => {
            if (area !== 'local') return;
            if (changes[STORAGE_KEYS.ACTIVE_ISSUE]) {
                setActiveIssue(changes[STORAGE_KEYS.ACTIVE_ISSUE].newValue ?? null);
            }
            if (changes[STORAGE_KEYS.START_TIME]) {
                setStartTime(changes[STORAGE_KEYS.START_TIME].newValue ?? null);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    const isActive = (issueUrl) =>
        issueUrl === activeIssue && startTime && !Number.isNaN(new Date(startTime).getTime());

    const stop = async (issueUrl) => {
        const url = issueUrl ?? activeIssue;
        if (!url) return;
        await TimerService.stopTimer(url);
    };

    return { activeIssue, startTime, isActive, stop };
}
