import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fake chrome global
//
// Must be set before browser-bootstrap.js executes so the ChromeStorageAdapter
// constructor can subscribe to chrome.storage.onChanged.
// ---------------------------------------------------------------------------
const fakeGet = vi.fn(async (key) => ({ [key]: undefined }));
const fakeSet = vi.fn(async () => { });
const fakeRemove = vi.fn(async () => { });
const onChangedAddListener = vi.fn();

beforeAll(async () => {
    globalThis.chrome = {
        storage: {
            local: { get: fakeGet, set: fakeSet, remove: fakeRemove },
            onChanged: { addListener: onChangedAddListener },
        },
        runtime: { sendMessage: vi.fn(), lastError: null },
    };

    // Load bootstrap — triggers StorageService.setAdapter + TimerService.setMessagingPort
    await import('../src/browser-bootstrap.js');
});

afterAll(() => {
    delete globalThis.chrome;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('browser-bootstrap', () => {
    it('registers the Chrome storage adapter — StorageService.get routes to chrome.storage.local.get', async () => {
        const { StorageService } = await import('../packages/core/src/services/storage.service.js');
        await StorageService.get('any-key');
        expect(fakeGet).toHaveBeenCalledWith('any-key');
    });

    it('chrome.storage.onChanged.addListener was called during adapter construction', () => {
        // Proves the chrome-specific cross-context bridge is registered
        expect(onChangedAddListener).toHaveBeenCalled();
    });

    it('without bootstrap the adapter guard throws — proves registration is mandatory', async () => {
        const { StorageService } = await import('../packages/core/src/services/storage.service.js');

        // Reset to simulate a missing bootstrap
        StorageService.setAdapter(null);
        await expect(StorageService.get('any-key')).rejects.toThrow(
            'StorageService: no adapter registered',
        );

        // Restore so later tests in this file are unaffected
        const { ChromeStorageAdapter } = await import(
            '../packages/browser-ext/src/adapters/chrome-storage.adapter.js'
        );
        const { storageEvents } = await import('../packages/core/src/services/storage-events.js');
        StorageService.setAdapter(new ChromeStorageAdapter(storageEvents));
    });
});
