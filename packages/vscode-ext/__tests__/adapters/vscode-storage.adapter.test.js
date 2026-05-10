import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageEventsPort } from '../../../core/src/ports/storage-events.port.js';
import { STORAGE_KEYS } from '../../../core/src/utils/constants.utils.js';
import { VSCodeStorageAdapter } from '../../src/adapters/vscode-storage.adapter.js';

// ---------------------------------------------------------------------------
// Fake VS Code context storage APIs
// ---------------------------------------------------------------------------
const makeGlobalState = () => {
    const store = new Map();
    return /** @type {any} */ ({
        get: vi.fn((key) => store.get(key)),
        update: vi.fn(async (key, value) => {
            if (value === undefined) {
                store.delete(key);
            } else {
                store.set(key, value);
            }
        }),
        keys: vi.fn(() => [...store.keys()]),
        _store: store,
    });
};

const makeSecrets = () => {
    const store = new Map();
    return /** @type {any} */ ({
        get: vi.fn(async (key) => store.get(key)),
        store: vi.fn(async (key, value) => store.set(key, value)),
        delete: vi.fn(async (key) => store.delete(key)),
        _store: store,
    });
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('VSCodeStorageAdapter', () => {
    let globalState;
    let secrets;
    let events;
    let adapter;

    beforeEach(() => {
        globalState = makeGlobalState();
        secrets = makeSecrets();
        events = new StorageEventsPort();
        adapter = new VSCodeStorageAdapter(globalState, secrets, events);
    });

    // -----------------------------------------------------------------------
    // Acceptance criterion 1 & 2 — GITHUB_TOKEN routes to secrets
    // -----------------------------------------------------------------------
    describe('GITHUB_TOKEN key routes to context.secrets', () => {
        it('set(GITHUB_TOKEN) writes to secrets, not globalState', async () => {
            const token = `ghp_${'a'.repeat(36)}`;
            await adapter.set(STORAGE_KEYS.GITHUB_TOKEN, token);

            expect(secrets.store).toHaveBeenCalledWith(STORAGE_KEYS.GITHUB_TOKEN, JSON.stringify(token));
            expect(globalState.update).not.toHaveBeenCalled();
        });

        it('get(GITHUB_TOKEN) reads from secrets, not globalState', async () => {
            const token = `ghp_${'b'.repeat(36)}`;
            await secrets.store(STORAGE_KEYS.GITHUB_TOKEN, JSON.stringify(token));

            const result = await adapter.get(STORAGE_KEYS.GITHUB_TOKEN);

            expect(secrets.get).toHaveBeenCalledWith(STORAGE_KEYS.GITHUB_TOKEN);
            expect(globalState.get).not.toHaveBeenCalled();
            expect(result).toBe(token);
        });

        it('get(GITHUB_TOKEN) returns null when secret is absent', async () => {
            const result = await adapter.get(STORAGE_KEYS.GITHUB_TOKEN);
            expect(result).toBeNull();
        });

        it('remove(GITHUB_TOKEN) calls secrets.delete', async () => {
            await adapter.remove(STORAGE_KEYS.GITHUB_TOKEN);
            expect(secrets.delete).toHaveBeenCalledWith(STORAGE_KEYS.GITHUB_TOKEN);
            expect(globalState.update).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Acceptance criterion 3 — all other keys use globalState
    // -----------------------------------------------------------------------
    describe('all other keys route to context.globalState', () => {
        it('set(otherKey) writes to globalState, not secrets', async () => {
            await adapter.set(STORAGE_KEYS.ACTIVE_ISSUE, '/owner/repo/issues/1');

            expect(globalState.update).toHaveBeenCalledWith(STORAGE_KEYS.ACTIVE_ISSUE, '/owner/repo/issues/1');
            expect(secrets.store).not.toHaveBeenCalled();
        });

        it('get(otherKey) reads from globalState, not secrets', async () => {
            globalState._store.set(STORAGE_KEYS.TRACKED_TIMES, [{ seconds: 30 }]);

            const result = await adapter.get(STORAGE_KEYS.TRACKED_TIMES);

            expect(globalState.get).toHaveBeenCalledWith(STORAGE_KEYS.TRACKED_TIMES);
            expect(secrets.get).not.toHaveBeenCalled();
            expect(result).toEqual([{ seconds: 30 }]);
        });

        it('get(otherKey) returns null when absent', async () => {
            const result = await adapter.get(STORAGE_KEYS.ACTIVE_ISSUE);
            expect(result).toBeNull();
        });

        it('remove(otherKey) calls globalState.update(key, undefined)', async () => {
            await adapter.remove(STORAGE_KEYS.ACTIVE_ISSUE);
            expect(globalState.update).toHaveBeenCalledWith(STORAGE_KEYS.ACTIVE_ISSUE, undefined);
            expect(secrets.delete).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // getMultiple and removeMultiple
    // -----------------------------------------------------------------------
    describe('getMultiple', () => {
        it('returns values from the correct backing store for each key', async () => {
            const token = `ghp_${'c'.repeat(36)}`;
            await secrets.store(STORAGE_KEYS.GITHUB_TOKEN, JSON.stringify(token));
            globalState._store.set(STORAGE_KEYS.ACTIVE_ISSUE, '/o/r/issues/2');

            const result = await adapter.getMultiple([
                STORAGE_KEYS.GITHUB_TOKEN,
                STORAGE_KEYS.ACTIVE_ISSUE,
                STORAGE_KEYS.TRACKED_TIMES,
            ]);

            expect(result[STORAGE_KEYS.GITHUB_TOKEN]).toBe(token);
            expect(result[STORAGE_KEYS.ACTIVE_ISSUE]).toBe('/o/r/issues/2');
            expect(result[STORAGE_KEYS.TRACKED_TIMES]).toBeNull();
        });
    });

    describe('removeMultiple', () => {
        it('removes from correct backing store for each key and emits one event', async () => {
            const emitted = [];
            events.subscribe((e) => emitted.push(e));

            await adapter.removeMultiple([STORAGE_KEYS.GITHUB_TOKEN, STORAGE_KEYS.ACTIVE_ISSUE]);

            expect(secrets.delete).toHaveBeenCalledWith(STORAGE_KEYS.GITHUB_TOKEN);
            expect(globalState.update).toHaveBeenCalledWith(STORAGE_KEYS.ACTIVE_ISSUE, undefined);
            expect(emitted).toHaveLength(1);
            expect(emitted[0].type).toBe('removeMultiple');
        });
    });

    // -----------------------------------------------------------------------
    // Acceptance criterion 4 — token round-trip preserves value for validation
    // -----------------------------------------------------------------------
    describe('token round-trip', () => {
        it('value read back from secrets matches what was stored (format validation can run)', async () => {
            const token = `ghp_${'d'.repeat(36)}`;
            await adapter.set(STORAGE_KEYS.GITHUB_TOKEN, token);
            const readBack = await adapter.get(STORAGE_KEYS.GITHUB_TOKEN);
            expect(readBack).toBe(token);
        });
    });

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    describe('storage events', () => {
        it('emits set event after set()', async () => {
            const emitted = [];
            events.subscribe((e) => emitted.push(e));

            await adapter.set(STORAGE_KEYS.ACTIVE_ISSUE, '/o/r/issues/3');

            expect(emitted).toHaveLength(1);
            expect(emitted[0]).toEqual({
                type: 'set',
                key: STORAGE_KEYS.ACTIVE_ISSUE,
                value: '/o/r/issues/3',
            });
        });

        it('emits remove event after remove()', async () => {
            const emitted = [];
            events.subscribe((e) => emitted.push(e));

            await adapter.remove(STORAGE_KEYS.ACTIVE_ISSUE);

            expect(emitted).toHaveLength(1);
            expect(emitted[0]).toEqual({ type: 'remove', key: STORAGE_KEYS.ACTIVE_ISSUE });
        });
    });
});
