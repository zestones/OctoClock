// packages/core/src/sync-queue.js

/**
 * Per-key async serializer.
 *
 * Jobs sharing the same key run one at a time in FIFO order.
 * A failure in one job does NOT drain the queue — the next job runs regardless.
 */
export class SyncQueue {
    /** @type {Map<string, Promise<unknown>>} */
    #queues = new Map();

    /**
     * Returns true if there is already a pending job for the given key.
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this.#queues.has(key);
    }

    /**
     * Enqueue a job for the given key. Jobs sharing the same key run serially.
     *
     * @template T
     * @param {string} key - Serialization key (e.g. issueUrl)
     * @param {() => Promise<T>} job - Async work to serialize
     * @returns {Promise<T>}
     */
    enqueue(key, job) {
        const previous = this.#queues.get(key) ?? Promise.resolve();
        const next = previous.catch(() => {}).then(() => job());
        this.#queues.set(key, next);
        next.finally(() => {
            if (this.#queues.get(key) === next) {
                this.#queues.delete(key);
            }
        }).catch(() => {}); // suppress unhandled rejection on the finally-chain branch
        return next;
    }
}
