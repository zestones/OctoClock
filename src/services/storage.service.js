export class StorageService {
    /** @param {string} key @returns {Promise<any>} */
    static async get(key) {
        const data = await chrome.storage.local.get(key);
        return data[key] ?? null;
    }

    static async set(key, value) {
        return chrome.storage.local.set({ [key]: value });
    }

    static async remove(key) {
        return chrome.storage.local.remove(key);
    }

    static async getMultiple(keys) {
        const data = await chrome.storage.local.get(keys);
        const result = {};
        for (const key of keys) {
            result[key] = data[key] ?? null;
        }
        return result;
    }

    static async removeMultiple(keys) {
        return chrome.storage.local.remove(keys);
    }
}
