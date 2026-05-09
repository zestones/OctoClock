/**
 * Platform-agnostic storage event emitter.
 *
 * Every storage mutation (set, remove, removeMultiple) should be forwarded here
 * so that UI hooks and services can react to state changes without depending on
 * chrome.storage.onChanged or any other platform API.
 *
 * Event shapes:
 *   { type: 'set',           key: string,   value: any      }
 *   { type: 'remove',        key: string                    }
 *   { type: 'removeMultiple', keys: string[]               }
 */
export class StorageEventsPort {
    /** @type {Set<(event: StorageEvent) => void>} */
    #listeners = new Set();

    /**
     * Emit a storage mutation event to all active subscribers.
     * @param {StorageEvent} event
     */
    emit(event) {
        for (const listener of this.#listeners) {
            listener(event);
        }
    }

    /**
     * Subscribe to storage mutation events.
     * @param {(event: StorageEvent) => void} listener
     * @returns {() => void} Unsubscribe function — call it to stop receiving events.
     */
    subscribe(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }
}

/**
 * @typedef {{ type: 'set';           key: string; value: any    }} StorageSetEvent
 * @typedef {{ type: 'remove';        key: string                }} StorageRemoveEvent
 * @typedef {{ type: 'removeMultiple'; keys: string[]            }} StorageRemoveMultipleEvent
 * @typedef {StorageSetEvent | StorageRemoveEvent | StorageRemoveMultipleEvent} StorageEvent
 */
