import { StoragePort } from '../../../core/src/ports/storage.port.js';

/**
 * Chrome MV3 implementation of StoragePort backed by chrome.storage.local.
 *
 * Emits storage mutation events through the injected StorageEventsPort so that
 * hooks and services can react without using chrome.storage.onChanged directly.
 *
 * Also bridges cross-context mutations (e.g. popup → content script) by
 * subscribing to chrome.storage.onChanged and re-emitting any change that was
 * NOT originated locally. Deduplication is done via a pending-keys Set: before
 * each mutation the affected keys are registered; when chrome.storage.onChanged
 * fires, locally-originated keys are skipped (already emitted) and deleted from
 * the Set, while keys absent from the Set are treated as cross-context.
 *
 * @extends {StoragePort}
 */
export class ChromeStorageAdapter extends StoragePort {
    /** @type {import('../../../core/src/ports/storage-events.port.js').StorageEventsPort} */
    #events;

    /**
     * Keys that were mutated locally in this process and whose
     * chrome.storage.onChanged callback has not fired yet.
     * @type {Set<string>}
     */
    #pendingLocalKeys = new Set();

    /**
     * @param {import('../../../core/src/ports/storage-events.port.js').StorageEventsPort} eventsPort
     */
    constructor(eventsPort) {
        super();
        this.#events = eventsPort;

        // Bridge cross-context changes (e.g. background or popup → content script).
        // Keys that originated locally are deduplicated and skipped.
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            for (const [key, { newValue }] of Object.entries(changes)) {
                if (this.#pendingLocalKeys.delete(key)) continue; // local — already emitted
                if (newValue === undefined) {
                    this.#events.emit({ type: 'remove', key });
                } else {
                    this.#events.emit({ type: 'set', key, value: newValue });
                }
            }
        });
    }

    /** @param {string} key @returns {Promise<any>} */
    async get(key) {
        const data = await chrome.storage.local.get(key);
        return data[key] ?? null;
    }

    /** @param {string} key @param {any} value @returns {Promise<void>} */
    async set(key, value) {
        this.#pendingLocalKeys.add(key);
        await chrome.storage.local.set({ [key]: value });
        this.#events.emit({ type: 'set', key, value });
    }

    /** @param {string} key @returns {Promise<void>} */
    async remove(key) {
        this.#pendingLocalKeys.add(key);
        await chrome.storage.local.remove(key);
        this.#events.emit({ type: 'remove', key });
    }

    /** @param {string[]} keys @returns {Promise<Record<string, any>>} */
    async getMultiple(keys) {
        const data = await chrome.storage.local.get(keys);
        const result = {};
        for (const key of keys) {
            result[key] = data[key] ?? null;
        }
        return result;
    }

    /**
     * Removes multiple keys in a single chrome.storage.local.remove call and
     * emits ONE compound removeMultiple event (not one event per key).
     * @param {string[]} keys @returns {Promise<void>}
     */
    async removeMultiple(keys) {
        for (const key of keys) this.#pendingLocalKeys.add(key);
        await chrome.storage.local.remove(keys);
        this.#events.emit({ type: 'removeMultiple', keys });
    }
}
