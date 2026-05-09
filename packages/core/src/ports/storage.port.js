/**
 * Platform-agnostic storage contract.
 *
 * Every environment adapter (Chrome, VS Code globalState, in-memory for tests)
 * must extend this class and implement all five methods.
 *
 * @abstract
 */
export class StoragePort {
    /**
     * Retrieve a single value.
     * @param {string} _key
     * @returns {Promise<any>} Stored value, or null if absent.
     */
    async get(_key) {
        throw new Error('StoragePort.get not implemented');
    }

    /**
     * Persist a single key-value pair.
     * @param {string} _key
     * @param {any} _value
     * @returns {Promise<void>}
     */
    async set(_key, _value) {
        throw new Error('StoragePort.set not implemented');
    }

    /**
     * Delete a single key.
     * @param {string} _key
     * @returns {Promise<void>}
     */
    async remove(_key) {
        throw new Error('StoragePort.remove not implemented');
    }

    /**
     * Retrieve multiple keys in one call.
     * @param {string[]} _keys
     * @returns {Promise<Record<string, any>>} Map of key → value (null for absent keys).
     */
    async getMultiple(_keys) {
        throw new Error('StoragePort.getMultiple not implemented');
    }

    /**
     * Remove multiple keys in one call.
     *
     * Must remain distinct from remove(): callers such as TimerService.stopTimer
     * pass [ACTIVE_ISSUE, START_TIME] as a single operation so that storage-event
     * adapters can emit one compound event instead of two separate ones.
     * @param {string[]} _keys
     * @returns {Promise<void>}
     */
    async removeMultiple(_keys) {
        throw new Error('StoragePort.removeMultiple not implemented');
    }
}
