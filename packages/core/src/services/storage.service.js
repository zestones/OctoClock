export class StorageService {
    /** @type {import('../ports/storage.port.js').StoragePort | null} */
    static #adapter = null;

    /**
     * Register the platform adapter. Must be called once at bootstrap before any
     * storage operation is invoked.
     * @param {import('../ports/storage.port.js').StoragePort} adapter
     */
    static setAdapter(adapter) {
        StorageService.#adapter = adapter;
    }

    static #assertAdapter() {
        if (!StorageService.#adapter) {
            throw new Error('StorageService: no adapter registered. Call StorageService.setAdapter() at bootstrap.');
        }
        return StorageService.#adapter;
    }

    /** @param {string} key @returns {Promise<any>} */
    static async get(key) {
        return StorageService.#assertAdapter().get(key);
    }

    /** @param {string} key @param {any} value @returns {Promise<void>} */
    static async set(key, value) {
        return StorageService.#assertAdapter().set(key, value);
    }

    /** @param {string} key @returns {Promise<void>} */
    static async remove(key) {
        return StorageService.#assertAdapter().remove(key);
    }

    /** @param {string[]} keys @returns {Promise<Record<string, any>>} */
    static async getMultiple(keys) {
        return StorageService.#assertAdapter().getMultiple(keys);
    }

    /** @param {string[]} keys @returns {Promise<void>} */
    static async removeMultiple(keys) {
        return StorageService.#assertAdapter().removeMultiple(keys);
    }
}
