// packages/vscode-ext/src/status-bar.js
//
// Drives a VS Code StatusBarItem based on ACTIVE_ISSUE / START_TIME storage events.
//
// State machine:
//   Idle  ──set ACTIVE_ISSUE + set START_TIME──►  Active (tick every second)
//   Active──remove ACTIVE_ISSUE or START_TIME──►  Idle
//
// The controller subscribes to StorageEventsPort so it reacts to all stop
// paths: explicit command, tree-view action, or direct storage removal.

import { StorageService } from '../../core/src/services/storage.service.js';
import { STORAGE_KEYS } from '../../core/src/utils/constants.utils.js';
import { TimeService } from '../../core/src/utils/time.utils.js';

const IDLE_TEXT = '$(clock) OctoClock';
const TICK_INTERVAL_MS = 1000;

/**
 * Creates a controller that drives a VS Code StatusBarItem based on
 * ACTIVE_ISSUE / START_TIME storage events.
 *
 * The returned object implements the VS Code `Disposable` interface so it can
 * be pushed directly onto `context.subscriptions`.
 *
 * @param {import('vscode').StatusBarItem} item
 * @param {import('../../core/src/ports/storage-events.port.js').StorageEventsPort} events
 * @returns {{ dispose: () => void }}
 */
export function createStatusBarController(item, events) {
    item.command = 'octoclock.openActiveTimer';
    item.show();

    /** @type {string | null} */
    let activeIssue = null;
    /** @type {string | null} */
    let startTime = null;
    /** @type {ReturnType<typeof setInterval> | null} */
    let tickInterval = null;

    function tick() {
        const issueNumber = activeIssue?.split('/').pop() ?? '?';
        item.text = `$(stop-circle) #${issueNumber} · ${TimeService.timeStringSince(startTime)}`;
        item.tooltip = `OctoClock: tracking #${issueNumber} — click to open Active Timer`;
    }

    function startTick() {
        if (tickInterval !== null) return;
        tick(); // immediate update before the first interval fires
        tickInterval = setInterval(tick, TICK_INTERVAL_MS);
    }

    function stopTick() {
        if (tickInterval !== null) {
            clearInterval(tickInterval);
            tickInterval = null;
        }
        item.text = IDLE_TEXT;
        item.tooltip = 'OctoClock: no timer running';
    }

    function refresh() {
        if (activeIssue && startTime) {
            startTick();
        } else {
            stopTick();
        }
    }

    // Subscribe before reading initial state so no event is missed while the
    // async storage read is in flight.
    const unsubscribe = events.subscribe((event) => {
        if (event.type === 'set') {
            if (event.key === STORAGE_KEYS.ACTIVE_ISSUE) activeIssue = event.value ?? null;
            if (event.key === STORAGE_KEYS.START_TIME) startTime = event.value ?? null;
        } else if (event.type === 'remove') {
            if (event.key === STORAGE_KEYS.ACTIVE_ISSUE) activeIssue = null;
            if (event.key === STORAGE_KEYS.START_TIME) startTime = null;
        } else if (event.type === 'removeMultiple') {
            if (event.keys.includes(STORAGE_KEYS.ACTIVE_ISSUE)) activeIssue = null;
            if (event.keys.includes(STORAGE_KEYS.START_TIME)) startTime = null;
        }
        refresh();
    });

    // Set idle state synchronously so the item is never blank, then read
    // storage to restore any timer that was active before activation.
    stopTick();
    StorageService.getMultiple([STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME])
        .then((values) => {
            activeIssue = values[STORAGE_KEYS.ACTIVE_ISSUE] ?? null;
            startTime = values[STORAGE_KEYS.START_TIME] ?? null;
            refresh();
        })
        .catch(() => {
            // Adapter not ready — remain in idle state.
        });

    return {
        dispose() {
            stopTick();
            unsubscribe();
            item.dispose();
        },
    };
}
