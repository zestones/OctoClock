import { beforeEach, describe, expect, it } from 'vitest';
import { StoragePort } from '../../packages/core/src/ports/storage.port.js';
import { StorageService } from '../../packages/core/src/services/storage.service.js';

// ---------------------------------------------------------------------------
// In-memory adapter (also validates StoragePort contract)
// ---------------------------------------------------------------------------
class InMemoryAdapter extends StoragePort {
    constructor() {
        super();
        this.store = {};
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
        for (const k of keys) {
            delete this.store[k];
        }
    }
}

// ---------------------------------------------------------------------------
// Reset adapter before each test so tests are isolated
// ---------------------------------------------------------------------------
let adapter;

beforeEach(() => {
    adapter = new InMemoryAdapter();
    StorageService.setAdapter(adapter);
});

// ---------------------------------------------------------------------------
// Delegation — every method must delegate to the adapter
// ---------------------------------------------------------------------------
describe('StorageService delegation', () => {
    it('get delegates to adapter', async () => {
        adapter.store.key = 'value';
        expect(await StorageService.get('key')).toBe('value');
    });

    it('set delegates to adapter', async () => {
        await StorageService.set('key', 99);
        expect(adapter.store.key).toBe(99);
    });

    it('remove delegates to adapter', async () => {
        adapter.store.key = true;
        await StorageService.remove('key');
        expect(adapter.store.key).toBeUndefined();
    });

    it('getMultiple delegates to adapter', async () => {
        adapter.store.a = 1;
        adapter.store.b = 2;
        const result = await StorageService.getMultiple(['a', 'b', 'c']);
        expect(result).toEqual({ a: 1, b: 2, c: null });
    });

    it('removeMultiple delegates to adapter', async () => {
        adapter.store.x = 'x';
        adapter.store.y = 'y';
        await StorageService.removeMultiple(['x', 'y']);
        expect(adapter.store.x).toBeUndefined();
        expect(adapter.store.y).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Adapter swap — changing the adapter changes the backing store
// ---------------------------------------------------------------------------
describe('adapter is swappable', () => {
    it('swapping the adapter changes the backing store without modifying StorageService', async () => {
        await StorageService.set('shared', 'adapter-A');
        expect(await StorageService.get('shared')).toBe('adapter-A');

        const adapterB = new InMemoryAdapter();
        StorageService.setAdapter(adapterB);

        // adapterB has its own empty store
        expect(await StorageService.get('shared')).toBeNull();

        await StorageService.set('shared', 'adapter-B');
        expect(await StorageService.get('shared')).toBe('adapter-B');

        // Original adapter unaffected
        expect(adapter.store.shared).toBe('adapter-A');
    });
});

// ---------------------------------------------------------------------------
// Guard — throws if no adapter has been registered
// ---------------------------------------------------------------------------
describe('no adapter guard', () => {
    it('throws a descriptive error when no adapter is set', async () => {
        StorageService.setAdapter(null);
        await expect(StorageService.get('any')).rejects.toThrow('StorageService: no adapter registered');
    });
});
