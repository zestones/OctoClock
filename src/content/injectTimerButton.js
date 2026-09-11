// content/injectTimerButton.js

import { StorageService } from '../services/storage.service.js';
import { addStorageListener } from '../services/storage-listener.service.js';
import { TimerService } from '../services/timer.service.js';
import { STORAGE_KEYS, TIME_UPDATE_INTERVAL } from '../utils/constants.utils.js';
import { TimeService } from '../utils/time.utils.js';
import { getIssueTitle, isIssuePage } from './helpers.js';

// Flag to prevent duplicate injections on same page
let isInjected = false;
// Cleanup function for the current button's resources (interval + storage listener).
// Called on SPA navigation to prevent listener leaks.
let currentCleanup = null;

// Reset injection flag and clean up resources on SPA navigation
export function resetInjectedFlag() {
    if (currentCleanup) {
        currentCleanup();
        currentCleanup = null;
    }
    isInjected = false;
}

export async function injectTimerButton() {
    if (!isIssuePage()) {
        return;
    }

    const container = document.querySelector('[data-testid="issue-metadata-fixed"]');
    const buttonExists = document.querySelector('#track-time-btn');
    if (!container || buttonExists || isInjected) {
        return;
    }

    const btn = createTimerButton();
    isInjected = true;

    const updateButton = async () => {
        if (!document.querySelector('#track-time-btn')) {
            return;
        }
        const { activeIssue, startTime } = await StorageService.getMultiple([
            STORAGE_KEYS.ACTIVE_ISSUE,
            STORAGE_KEYS.START_TIME,
        ]);
        const totalTime = (await TimerService.getTotalTimeForIssue(location.pathname)) || 0;
        if (activeIssue === location.pathname && startTime && !Number.isNaN(new Date(startTime).getTime())) {
            updateButtonText(btn, startTime, totalTime);
            if (!btn.dataset.intervalId) {
                startButtonUpdateInterval(btn, totalTime);
            }
        } else {
            btn.textContent = `${TimeService.formatTime(0, totalTime)} Start Timer`;
            if (btn.dataset.intervalId) {
                clearInterval(Number(btn.dataset.intervalId));
                delete btn.dataset.intervalId;
            }
        }
    };

    container.append(btn);

    await updateButton();

    // Click listener
    btn.addEventListener('click', async () => {
        const { activeIssue, startTime } = await StorageService.getMultiple([
            STORAGE_KEYS.ACTIVE_ISSUE,
            STORAGE_KEYS.START_TIME,
        ]);
        if (activeIssue === location.pathname && startTime && !Number.isNaN(new Date(startTime).getTime())) {
            await TimerService.stopTimer(location.pathname);
        } else {
            const title = getIssueTitle();
            await TimerService.startTimer(location.pathname, title);
        }
        await updateButton();
    });

    // Listen for trackedTimes changes
    const removeListener = addStorageListener(STORAGE_KEYS.TRACKED_TIMES, () => {
        updateButton();
    });

    // Store cleanup for SPA navigation (called by resetInjectedFlag).
    // On real page unload, the entire JS context is destroyed — no manual cleanup needed.
    currentCleanup = () => {
        if (btn.dataset.intervalId) {
            clearInterval(Number(btn.dataset.intervalId));
            delete btn.dataset.intervalId;
        }
        removeListener();
    };
}

function createTimerButton() {
    const btn = document.createElement('button');
    btn.id = 'track-time-btn';
    btn.style.marginTop = '10px';
    btn.className = 'btn btn-sm';
    btn.textContent = 'Start Timer';
    return btn;
}

function updateButtonText(btn, startTime, totalTime) {
    btn.textContent = `${TimeService.timeStringSince(startTime, totalTime)} ⏸ Stop`;
}

function startButtonUpdateInterval(btn, totalTime) {
    const intervalId = setInterval(async () => {
        if (!document.querySelector('#track-time-btn')) {
            clearInterval(intervalId);
            delete btn.dataset.intervalId;
            return;
        }
        const { startTime } = await StorageService.getMultiple([STORAGE_KEYS.START_TIME]);
        if (startTime && !Number.isNaN(new Date(startTime).getTime())) {
            updateButtonText(btn, startTime, totalTime);
        } else {
            btn.textContent = `${TimeService.formatTime(0, totalTime)} Start Timer`;
            clearInterval(intervalId);
            delete btn.dataset.intervalId;
        }
    }, TIME_UPDATE_INTERVAL);
    btn.dataset.intervalId = intervalId;
}
