import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChromeStorageAdapter } from '../../src/adapters/chrome-storage.adapter.js';

// ---------------------------------------------------------------------------
// Fake chrome.storage.local
// ---------------------------------------------------------------------------
function makeFakeStorage() {
    const store = {};
    return {
        store,
        get: vi.fn(async (keys) => {
            if (typeof keys === 'string') {
                return { [keys]: store[keys] };
            }
            const result = {};
            for (const k of keys) {
                if (Object.hasOwn(store, k)) {
                    result[k] = store[k];
                }
            }
            return result;
        }),
        set: vi.fn(async (obj) => {
            Object.assign(store, obj);
        }),
        remove: vi.fn(async (keys) => {
            const ks = Array.isArray(keys) ? keys : [keys];
            for (const k of ks) {
                delete store[k];
            }
        }),
    };
}

let fakeStorage;
let adapter;

beforeEach(() => {
    fakeStorage = makeFakeStorage();
    vi.stubGlobal('chrome', { storage: { local: fakeStorage } });
    adapter = new ChromeStorageAdapter();
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------
describe('get', () => {
    it('returns the stored value', async () => {
        fakeStorage.store.foo = 'bar';
        expect(await adapter.get('foo')).toBe('bar');
    });

    it('returns null for absent keys', async () => {
        expect(await adapter.get('missing')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// set
// ---------------------------------------------------------------------------
describe('set', () => {
    it('stores a value and retrieves it', async () => {
        await adapter.set('count', 42);
        expect(await adapter.get('count')).toBe(42);
    });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------
describe('remove', () => {
    it('deletes a key', async () => {
        fakeStorage.store.x = 1;
        await adapter.remove('x');
        expect(await adapter.get('x')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// getMultiple
// ---------------------------------------------------------------------------
describe('getMultiple', () => {
    it('returns all requested keys', async () => {
        fakeStorage.store.a = 1;
        fakeStorage.store.b = 2;
        const result = await adapter.getMultiple(['a', 'b', 'c']);
        expect(result).toEqual({ a: 1, b: 2, c: null });
    });
});

// ---------------------------------------------------------------------------
// removeMultiple
// ---------------------------------------------------------------------------
describe('removeMultiple', () => {
    it('removes all specified keys in a single chrome.storage.local.remove call', async () => {
        fakeStorage.store.k1 = 'v1';
        fakeStorage.store.k2 = 'v2';

        await adapter.removeMultiple(['k1', 'k2']);

        // Both keys gone
        expect(await adapter.get('k1')).toBeNull();
        expect(await adapter.get('k2')).toBeNull();

        // Chrome remove was called exactly once (not twice)
        expect(fakeStorage.remove).toHaveBeenCalledTimes(1);
        expect(fakeStorage.remove).toHaveBeenCalledWith(['k1', 'k2']);
    });
});
