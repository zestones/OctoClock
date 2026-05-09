import { StoragePort } from '../../../core/src/ports/storage.port.js';
import { STORAGE_KEYS } from '../../../core/src/utils/constants.utils.js';

/**
 * VS Code implementation of StoragePort.
 *
 * Routes the GitHub token key to context.secrets (OS keychain / encrypted
 * storage) and all other keys to context.globalState (persistent key-value
 * store scoped to the extension).
 *
 * Emits storage mutation events through the injected StorageEventsPort so that
 * tree view providers and other listeners can react to state changes.
 *
 * @extends {StoragePort}
 */
export class VSCodeStorageAdapter extends StoragePort {
    /** @type {import('vscode').Memento & { setKeysForSync?: (keys: string[]) => void }} */
    #globalState;

    /** @type {import('vscode').SecretStorage} */
    #secrets;

    /** @type {import('../../../core/src/ports/storage-events.port.js').StorageEventsPort} */
    #events;

    /**
     * @param {import('vscode').Memento} globalState
     * @param {import('vscode').SecretStorage} secrets
     * @param {import('../../../core/src/ports/storage-events.port.js').StorageEventsPort} eventsPort
     */
    constructor(globalState, secrets, eventsPort) {
        super();
        this.#globalState = globalState;
        this.#secrets = secrets;
        this.#events = eventsPort;
    }

    /**
     * Returns true if the key must be stored in context.secrets.
     * @param {string} key
     * @returns {boolean}
     */
    #isSecret(key) {
        return key === STORAGE_KEYS.GITHUB_TOKEN;
    }

    /** @param {string} key @returns {Promise<any>} */
    async get(key) {
        if (this.#isSecret(key)) {
            const raw = await this.#secrets.get(key);
            return raw != null ? JSON.parse(raw) : null;
        }
        return this.#globalState.get(key) ?? null;
    }

    /** @param {string} key @param {any} value @returns {Promise<void>} */
    async set(key, value) {
        if (this.#isSecret(key)) {
            await this.#secrets.store(key, JSON.stringify(value));
        } else {
            await this.#globalState.update(key, value);
        }
        this.#events.emit({ type: 'set', key, value });
    }

    /** @param {string} key @returns {Promise<void>} */
    async remove(key) {
        if (this.#isSecret(key)) {
            await this.#secrets.delete(key);
        } else {
            await this.#globalState.update(key, undefined);
        }
        this.#events.emit({ type: 'remove', key });
    }

    /** @param {string[]} keys @returns {Promise<Record<string, any>>} */
    async getMultiple(keys) {
        const result = {};
        for (const key of keys) {
            result[key] = await this.get(key);
        }
        return result;
    }

    /**
     * Removes multiple keys and emits a single compound event.
     * @param {string[]} keys @returns {Promise<void>}
     */
    async removeMultiple(keys) {
        for (const key of keys) {
            if (this.#isSecret(key)) {
                await this.#secrets.delete(key);
            } else {
                await this.#globalState.update(key, undefined);
            }
        }
        this.#events.emit({ type: 'removeMultiple', keys });
    }
}
