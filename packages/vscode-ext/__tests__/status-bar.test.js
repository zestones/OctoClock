// packages/vscode-ext/__tests__/status-bar.test.js
//
// Unit tests for createStatusBarController.
//
// Strategy:
//   - InMemoryStorage is used as the StoragePort adapter so tests are
//     hermetic (no VS Code runtime, no real storage).
//   - vi.useFakeTimers() is called per-test where setInterval behaviour needs
//     to be verified; all other tests rely on synchronous event emission.
//   - flushPromises() drains the microtask queue to let StorageService
//     .getMultiple().then() run before any assertion.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoragePort } from '../../core/src/ports/storage.port.js';
import { StorageEventsPort } from '../../core/src/ports/storage-events.port.js';
import { StorageService } from '../../core/src/services/storage.service.js';
import { STORAGE_KEYS } from '../../core/src/utils/constants.utils.js';
import { createStatusBarController } from '../src/status-bar.js';

// ---------------------------------------------------------------------------
// In-memory StoragePort
// ---------------------------------------------------------------------------
class InMemoryStorage extends StoragePort {
    #store = new Map();

    async get(key) {
        return this.#store.get(key) ?? null;
    }
    async set(key, value) {
        this.#store.set(key, value);
    }
    async remove(key) {
        this.#store.delete(key);
    }
    async getMultiple(keys) {
        return Object.fromEntries(keys.map((k) => [k, this.#store.get(k) ?? null]));
    }
    async removeMultiple(keys) {
        for (const k of keys) this.#store.delete(k);
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem() {
    return /** @type {any} */ ({
        command: undefined,
        text: '',
        tooltip: '',
        show: vi.fn(),
        dispose: vi.fn(),
    });
}

/** Drain the microtask queue deeply enough to flush StorageService.getMultiple(). */
async function flushPromises() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('createStatusBarController', () => {
    /** @type {InMemoryStorage} */
    let storage;
    /** @type {StorageEventsPort} */
    let events;
    /** @type {ReturnType<typeof makeItem>} */
    let item;

    beforeEach(() => {
        storage = new InMemoryStorage();
        StorageService.setAdapter(storage);
        events = new StorageEventsPort();
        item = makeItem();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        StorageService.setAdapter(null);
    });

    // -----------------------------------------------------------------------
    // Setup
    // -----------------------------------------------------------------------
    it('calls item.show()', () => {
        createStatusBarController(item, events);
        expect(item.show).toHaveBeenCalledOnce();
    });

    it('sets item.command to octoclock.stopTimer', () => {
        createStatusBarController(item, events);
        expect(item.command).toBe('octoclock.stopTimer');
    });

    // -----------------------------------------------------------------------
    // Initial state — idle (empty storage)
    // -----------------------------------------------------------------------
    it('shows idle text when no timer is in storage', async () => {
        createStatusBarController(item, events);
        await flushPromises();
        expect(item.text).toBe('$(clock) OctoClock');
    });

    it('sets tooltip to "no timer running" when idle', async () => {
        createStatusBarController(item, events);
        await flushPromises();
        expect(item.tooltip).toContain('no timer running');
    });

    // -----------------------------------------------------------------------
    // Initial state — active (storage already has timer, e.g. after restart)
    // -----------------------------------------------------------------------
    it('shows active state when storage already has ACTIVE_ISSUE and START_TIME', async () => {
        vi.useFakeTimers();
        await storage.set(STORAGE_KEYS.ACTIVE_ISSUE, '/owner/repo/issues/1');
        await storage.set(STORAGE_KEYS.START_TIME, new Date().toISOString());

        createStatusBarController(item, events);
        await flushPromises();

        expect(item.text).toContain('$(clock)');
        expect(item.text).not.toBe('$(clock) OctoClock');
    });

    // -----------------------------------------------------------------------
    // Storage event reactions
    // -----------------------------------------------------------------------
    it('remains idle when only ACTIVE_ISSUE is set (START_TIME missing)', () => {
        createStatusBarController(item, events);
        events.emit({ type: 'set', key: STORAGE_KEYS.ACTIVE_ISSUE, value: '/owner/repo/issues/2' });
        expect(item.text).toBe('$(clock) OctoClock');
    });

    it('starts ticking when both ACTIVE_ISSUE and START_TIME set events fire', () => {
        vi.useFakeTimers();
        createStatusBarController(item, events);

        events.emit({ type: 'set', key: STORAGE_KEYS.ACTIVE_ISSUE, value: '/owner/repo/issues/1' });
        events.emit({ type: 'set', key: STORAGE_KEYS.START_TIME, value: new Date().toISOString() });

        expect(item.text).toContain('$(clock)');
        expect(item.text).not.toBe('$(clock) OctoClock');
    });

    it("resets to idle on a 'remove' ACTIVE_ISSUE event", () => {
        vi.useFakeTimers();
        createStatusBarController(item, events);

        events.emit({ type: 'set', key: STORAGE_KEYS.ACTIVE_ISSUE, value: '/owner/repo/issues/1' });
        events.emit({ type: 'set', key: STORAGE_KEYS.START_TIME, value: new Date().toISOString() });
        events.emit({ type: 'remove', key: STORAGE_KEYS.ACTIVE_ISSUE });

        expect(item.text).toBe('$(clock) OctoClock');
    });

    it("resets to idle on a 'remove' START_TIME event", () => {
        vi.useFakeTimers();
        createStatusBarController(item, events);

        events.emit({ type: 'set', key: STORAGE_KEYS.ACTIVE_ISSUE, value: '/owner/repo/issues/1' });
        events.emit({ type: 'set', key: STORAGE_KEYS.START_TIME, value: new Date().toISOString() });
        events.emit({ type: 'remove', key: STORAGE_KEYS.START_TIME });

        expect(item.text).toBe('$(clock) OctoClock');
    });

    it("resets to idle on a 'removeMultiple' event covering both ACTIVE_ISSUE and START_TIME", () => {
        vi.useFakeTimers();
        createStatusBarController(item, events);

        events.emit({ type: 'set', key: STORAGE_KEYS.ACTIVE_ISSUE, value: '/owner/repo/issues/1' });
        events.emit({ type: 'set', key: STORAGE_KEYS.START_TIME, value: new Date().toISOString() });
        events.emit({
            type: 'removeMultiple',
            keys: [STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME],
        });

        expect(item.text).toBe('$(clock) OctoClock');
    });

    it("does not change state on 'removeMultiple' that excludes timer keys", () => {
        vi.useFakeTimers();
        createStatusBarController(item, events);

        events.emit({ type: 'set', key: STORAGE_KEYS.ACTIVE_ISSUE, value: '/owner/repo/issues/3' });
        events.emit({ type: 'set', key: STORAGE_KEYS.START_TIME, value: new Date().toISOString() });

        const textAfterActivation = item.text;

        events.emit({ type: 'removeMultiple', keys: [STORAGE_KEYS.GITHUB_TOKEN] });

        // Active text should be unchanged — the irrelevant removeMultiple must not reset the timer
        expect(item.text).toBe(textAfterActivation);
        expect(item.text).not.toBe('$(clock) OctoClock');
    });

    // -----------------------------------------------------------------------
    // Tick — elapsed time updates
    // -----------------------------------------------------------------------
    it('updates elapsed time on each tick', () => {
        vi.useFakeTimers();
        const now = new Date();
        vi.setSystemTime(now);

        createStatusBarController(item, events);
        events.emit({ type: 'set', key: STORAGE_KEYS.ACTIVE_ISSUE, value: '/owner/repo/issues/1' });
        events.emit({ type: 'set', key: STORAGE_KEYS.START_TIME, value: now.toISOString() });

        const textAt0 = item.text; // immediate tick: 00:00:00

        vi.advanceTimersByTime(2000);

        const textAt2 = item.text; // two ticks: 00:00:02

        expect(textAt0).not.toBe(textAt2);
        expect(textAt2).toMatch(/00:00:0[12]/); // 1 or 2 seconds depending on rounding
    });

    // -----------------------------------------------------------------------
    // Dispose
    // -----------------------------------------------------------------------
    it('calls item.dispose() on dispose()', () => {
        const controller = createStatusBarController(item, events);
        controller.dispose();
        expect(item.dispose).toHaveBeenCalledOnce();
    });

    it('stops the tick interval on dispose() and resets to idle', () => {
        vi.useFakeTimers();
        const controller = createStatusBarController(item, events);

        events.emit({ type: 'set', key: STORAGE_KEYS.ACTIVE_ISSUE, value: '/owner/repo/issues/1' });
        events.emit({ type: 'set', key: STORAGE_KEYS.START_TIME, value: new Date().toISOString() });

        controller.dispose();

        vi.advanceTimersByTime(5000);

        // Timer was cleared; text must be idle (set by stopTick inside dispose)
        expect(item.text).toBe('$(clock) OctoClock');
    });

    it('stops receiving storage events after dispose()', () => {
        const controller = createStatusBarController(item, events);
        controller.dispose();

        // These events would normally start the tick — they must be ignored after dispose
        events.emit({ type: 'set', key: STORAGE_KEYS.ACTIVE_ISSUE, value: '/owner/repo/issues/1' });
        events.emit({ type: 'set', key: STORAGE_KEYS.START_TIME, value: new Date().toISOString() });

        expect(item.text).toBe('$(clock) OctoClock');
    });
});
