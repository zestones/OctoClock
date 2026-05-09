// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/preact';
import { beforeEach, describe, expect, it } from 'vitest';
import { StorageEventsPort } from '../../packages/core/src/ports/storage-events.port.js';
import { StoragePort } from '../../packages/core/src/ports/storage.port.js';
import { StorageService } from '../../src/services/storage.service.js';
import { useActiveTimer } from '../../src/hooks/useActiveTimer.js';
import { STORAGE_KEYS } from '../../src/utils/constants.utils.js';

// ---------------------------------------------------------------------------
// In-memory adapter
// ---------------------------------------------------------------------------
class InMemoryAdapter extends StoragePort {
    constructor(initial = {}) {
        super();
        this.store = { ...initial };
    }

    async get(key) {
        return Object.hasOwn(this.store, key) ? this.store[key] : null;
    }

    async set(key, value) {
        this.store[key] = value;
    }

    async remove(key) {
        delete this.store[key];
    }

    async getMultiple(keys) {
        return Object.fromEntries(keys.map((k) => [k, this.store[k] ?? null]));
    }

    async removeMultiple(keys) {
        for (const k of keys) delete this.store[k];
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setup(initialStore = {}) {
    const fakeAdapter = new InMemoryAdapter(initialStore);
    StorageService.setAdapter(fakeAdapter);
    const fakeEvents = new StorageEventsPort();
    return { fakeAdapter, fakeEvents };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useActiveTimer — storage events', () => {
    beforeEach(() => {
        StorageService.setAdapter(new InMemoryAdapter());
    });

    it('loads initial activeIssue and startTime from storage', async () => {
        const { fakeEvents } = setup({
            [STORAGE_KEYS.ACTIVE_ISSUE]: 'https://github.com/org/repo/issues/1',
            [STORAGE_KEYS.START_TIME]: '2026-05-09T10:00:00.000Z',
        });

        const { result } = renderHook(() => useActiveTimer(fakeEvents));

        await waitFor(() => {
            expect(result.current.activeIssue).toBe('https://github.com/org/repo/issues/1');
        });
        expect(result.current.startTime).toBe('2026-05-09T10:00:00.000Z');
    });

    it('updates activeIssue on set event', async () => {
        const { fakeEvents } = setup();
        const { result } = renderHook(() => useActiveTimer(fakeEvents));
        await act(async () => { });

        act(() => {
            fakeEvents.emit({ type: 'set', key: STORAGE_KEYS.ACTIVE_ISSUE, value: 'url/1' });
        });

        expect(result.current.activeIssue).toBe('url/1');
    });

    // -------------------------------------------------------------------------
    // Critical regression — stopTimer calls removeMultiple([ACTIVE_ISSUE, START_TIME]).
    // If the hook only handles 'set' events, activeIssue and startTime will never
    // clear in the UI after the timer stops.
    // -------------------------------------------------------------------------
    it('clears both activeIssue and startTime on removeMultiple event', async () => {
        const { fakeEvents } = setup({
            [STORAGE_KEYS.ACTIVE_ISSUE]: 'url/1',
            [STORAGE_KEYS.START_TIME]: '2026-05-09T10:00:00.000Z',
        });

        const { result } = renderHook(() => useActiveTimer(fakeEvents));

        // Precondition: both values loaded
        await waitFor(() => {
            expect(result.current.activeIssue).toBe('url/1');
        });
        expect(result.current.startTime).toBe('2026-05-09T10:00:00.000Z');

        act(() => {
            fakeEvents.emit({
                type: 'removeMultiple',
                keys: [STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME],
            });
        });

        expect(result.current.activeIssue).toBeNull();
        expect(result.current.startTime).toBeNull();
    });

    it('clears activeIssue on individual remove event', async () => {
        const { fakeEvents } = setup({ [STORAGE_KEYS.ACTIVE_ISSUE]: 'url/1' });
        const { result } = renderHook(() => useActiveTimer(fakeEvents));
        await act(async () => { });

        act(() => {
            fakeEvents.emit({ type: 'remove', key: STORAGE_KEYS.ACTIVE_ISSUE });
        });

        expect(result.current.activeIssue).toBeNull();
    });
});
