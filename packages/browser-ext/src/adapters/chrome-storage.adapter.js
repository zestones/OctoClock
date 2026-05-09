import { StoragePort } from '../../../core/src/ports/storage.port.js';

/**
 * Chrome MV3 implementation of StoragePort backed by chrome.storage.local.
 * @extends {StoragePort}
 */
export class ChromeStorageAdapter extends StoragePort {
    /** @param {string} key @returns {Promise<any>} */
    async get(key) {
        const data = await chrome.storage.local.get(key);
        return data[key] ?? null;
    }

    /** @param {string} key @param {any} value @returns {Promise<void>} */
    async set(key, value) {
        return chrome.storage.local.set({ [key]: value });
    }

    /** @param {string} key @returns {Promise<void>} */
    async remove(key) {
        return chrome.storage.local.remove(key);
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

    /** @param {string[]} keys @returns {Promise<void>} */
    async removeMultiple(keys) {
        return chrome.storage.local.remove(keys);
    }
}
