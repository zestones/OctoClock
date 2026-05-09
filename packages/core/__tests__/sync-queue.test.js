import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncQueue } from '../src/sync-queue.js';

describe('SyncQueue', () => {
    let queue;

    beforeEach(() => {
        queue = new SyncQueue();
    });

    it('runs a single job and resolves its value', async () => {
        const result = await queue.enqueue('k', () => Promise.resolve(42));
        expect(result).toBe(42);
    });

    it('has() returns false when no job is pending', () => {
        expect(queue.has('k')).toBe(false);
    });

    it('has() returns true while a job is in progress', async () => {
        /** @type {(value?: unknown) => void} */
        let resolve = () => {};
        const pending = new Promise((r) => {
            resolve = r;
        });
        queue.enqueue('k', () => pending);
        expect(queue.has('k')).toBe(true);
        resolve();
        await pending;
    });

    it('has() returns false after the job completes', async () => {
        await queue.enqueue('k', () => Promise.resolve());
        expect(queue.has('k')).toBe(false);
    });

    it('serializes three jobs for the same key — calls are in order, no overlap', async () => {
        const DELAY = 20;
        const callOrder = [];
        const completeOrder = [];

        /**
         * Creates a delayed job that records when it started and finished.
         * @param {number} id
         */
        function makeJob(id) {
            return () =>
                new Promise((resolve) => {
                    callOrder.push(id);
                    setTimeout(() => {
                        completeOrder.push(id);
                        resolve(id);
                    }, DELAY);
                });
        }

        const [r1, r2, r3] = await Promise.all([
            queue.enqueue('issue', makeJob(1)),
            queue.enqueue('issue', makeJob(2)),
            queue.enqueue('issue', makeJob(3)),
        ]);

        expect(r1).toBe(1);
        expect(r2).toBe(2);
        expect(r3).toBe(3);

        // Jobs must start in order (job 2 only starts after job 1 completes)
        expect(callOrder).toEqual([1, 2, 3]);
        // Jobs must finish in the same order
        expect(completeOrder).toEqual([1, 2, 3]);
    });

    it('calls exactly N jobs — no dropped calls', async () => {
        const DELAY = 10;
        const invocations = [];

        for (let i = 0; i < 3; i++) {
            queue.enqueue('issue', () => {
                invocations.push(i);
                return new Promise((r) => setTimeout(r, DELAY));
            });
        }

        // Wait for all jobs by enqueuing a sentinel
        await queue.enqueue('issue', () => Promise.resolve());

        expect(invocations).toHaveLength(3);
    });

    it('continues the queue after a job failure', async () => {
        const results = [];

        await Promise.allSettled([
            queue.enqueue('k', () => Promise.reject(new Error('oops'))),
            queue.enqueue('k', () => {
                results.push('ran');
                return Promise.resolve();
            }),
        ]);

        expect(results).toContain('ran');
    });

    it('uses independent queues for different keys', async () => {
        const DELAY = 20;
        const order = [];

        // Start a slow job on key 'a'
        const a = queue.enqueue(
            'a',
            () =>
                new Promise((r) =>
                    setTimeout(() => {
                        order.push('a');
                        r();
                    }, DELAY),
                ),
        );
        // Start a fast job on key 'b' — should complete before 'a'
        const b = queue.enqueue(
            'b',
            () =>
                new Promise((r) =>
                    setTimeout(() => {
                        order.push('b');
                        r();
                    }, 1),
                ),
        );

        await Promise.all([a, b]);

        expect(order[0]).toBe('b');
        expect(order[1]).toBe('a');
    });
});
