import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoragePort } from '../../../core/src/ports/storage.port.js';
import { GitHubService } from '../../../core/src/services/github.service.js';
import { StorageService } from '../../../core/src/services/storage.service.js';
import { STORAGE_KEYS } from '../../../core/src/utils/constants.utils.js';
import { VSCodeMessagingAdapter } from '../../src/adapters/vscode-messaging.adapter.js';

// ---------------------------------------------------------------------------
// Minimal in-memory StoragePort for tests
// ---------------------------------------------------------------------------
class InMemoryStorage extends StoragePort {
    #store = new Map();

    async get(key) {
        return this.#store.get(key) ?? null;
    }

    async set(key, value) {
        this.#store.set(key, value);
    }

    async remove(key) {
        this.#store.delete(key);
    }

    async getMultiple(keys) {
        return Object.fromEntries(keys.map((k) => [k, this.#store.get(k) ?? null]));
    }

    async removeMultiple(keys) {
        for (const k of keys) this.#store.delete(k);
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ISSUE_URL = '/owner/repo/issues/1';
const ISSUE_URL_2 = '/owner/repo/issues/2';
const OWNER = 'owner';
const REPO = 'repo';
const ISSUE_NUMBER = 1;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('VSCodeMessagingAdapter', () => {
    let adapter;
    let storage;
    /** @type {any} */
    let mockCreateOrUpdate;

    beforeEach(() => {
        storage = new InMemoryStorage();
        StorageService.setAdapter(storage);
        adapter = new VSCodeMessagingAdapter();

        // Stub GitHub API calls — not testing HTTP here
        vi.spyOn(GitHubService, 'getCurrentUsername').mockResolvedValue('testuser');
        mockCreateOrUpdate = vi.spyOn(GitHubService, 'createOrUpdateTrackerComment');
        mockCreateOrUpdate.mockResolvedValue({ comment: {}, commentId: 42 });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        StorageService.setAdapter(null);
    });

    // -----------------------------------------------------------------------
    // Acceptance criterion 1 — serial execution prevents out-of-order writes
    // -----------------------------------------------------------------------
    describe('serial queue per issueUrl', () => {
        it('resolves with the commentId from GitHub', async () => {
            const result = await adapter.syncComment(ISSUE_URL, OWNER, REPO, ISSUE_NUMBER);
            expect(result).toEqual({ commentId: 42 });
        });

        it('rapid calls for the same issueUrl execute serially, not concurrently', async () => {
            const order = [];

            mockCreateOrUpdate
                .mockImplementationOnce(async () => {
                    order.push(1);
                    return { comment: {}, commentId: 10 };
                })
                .mockImplementationOnce(async () => {
                    order.push(2);
                    return { comment: {}, commentId: 11 };
                })
                .mockImplementationOnce(async () => {
                    order.push(3);
                    return { comment: {}, commentId: 12 };
                });

            // Fire three calls without awaiting the previous — they must still
            // run in FIFO order because they share the same issueUrl key.
            await Promise.all([
                adapter.syncComment(ISSUE_URL, OWNER, REPO, ISSUE_NUMBER),
                adapter.syncComment(ISSUE_URL, OWNER, REPO, ISSUE_NUMBER),
                adapter.syncComment(ISSUE_URL, OWNER, REPO, ISSUE_NUMBER),
            ]);

            expect(order).toEqual([1, 2, 3]);
        });

        it('calls for different issueUrls do not block each other', async () => {
            const started = [];

            mockCreateOrUpdate.mockImplementation(async () => {
                // Track call start order
                started.push('call');
                return { comment: {}, commentId: 99 };
            });

            // Two independent queues — both should proceed without waiting
            const [r1, r2] = await Promise.all([
                adapter.syncComment(ISSUE_URL, OWNER, REPO, 1),
                adapter.syncComment(ISSUE_URL_2, OWNER, REPO, 2),
            ]);

            expect(r1).toEqual({ commentId: 99 });
            expect(r2).toEqual({ commentId: 99 });
            expect(started).toHaveLength(2);
        });

        it('a failed job does not block subsequent jobs for the same issueUrl', async () => {
            mockCreateOrUpdate
                .mockRejectedValueOnce(new Error('network error'))
                .mockResolvedValueOnce({ comment: {}, commentId: 55 });

            // First call rejects
            await expect(adapter.syncComment(ISSUE_URL, OWNER, REPO, ISSUE_NUMBER)).rejects.toThrow('network error');

            // Second call should still succeed
            const result = await adapter.syncComment(ISSUE_URL, OWNER, REPO, ISSUE_NUMBER);
            expect(result).toEqual({ commentId: 55 });
        });
    });

    // -----------------------------------------------------------------------
    // Acceptance criterion 2 — syncTrackerComment reads / writes storage correctly
    // -----------------------------------------------------------------------
    describe('syncTrackerComment storage interactions', () => {
        it('passes only entries for the given issueUrl to createOrUpdateTrackerComment', async () => {
            await storage.set(STORAGE_KEYS.TRACKED_TIMES, [
                { issueUrl: ISSUE_URL, date: '2024-01-01', seconds: 60 },
                { issueUrl: '/owner/repo/issues/99', date: '2024-01-02', seconds: 120 },
                { issueUrl: ISSUE_URL, date: '2024-01-03', seconds: 30 },
            ]);

            await adapter.syncComment(ISSUE_URL, OWNER, REPO, ISSUE_NUMBER);

            expect(GitHubService.createOrUpdateTrackerComment).toHaveBeenCalledWith(
                expect.objectContaining({
                    entries: [
                        { date: '2024-01-01', seconds: 60 },
                        { date: '2024-01-03', seconds: 30 },
                    ],
                }),
            );
        });

        it('passes null cachedCommentId when no prior comment exists', async () => {
            await adapter.syncComment(ISSUE_URL, OWNER, REPO, ISSUE_NUMBER);

            expect(GitHubService.createOrUpdateTrackerComment).toHaveBeenCalledWith(
                expect.objectContaining({ cachedCommentId: undefined }),
            );
        });

        it('passes existing commentId as cachedCommentId', async () => {
            await storage.set(STORAGE_KEYS.COMMENT_IDS, { 'testuser:/owner/repo/issues/1': 77 });

            await adapter.syncComment(ISSUE_URL, OWNER, REPO, ISSUE_NUMBER);

            expect(GitHubService.createOrUpdateTrackerComment).toHaveBeenCalledWith(
                expect.objectContaining({ cachedCommentId: 77 }),
            );
        });

        it('writes the new commentId back to COMMENT_IDS after sync', async () => {
            await adapter.syncComment(ISSUE_URL, OWNER, REPO, ISSUE_NUMBER);

            const commentIds = await storage.get(STORAGE_KEYS.COMMENT_IDS);
            expect(commentIds['testuser:/owner/repo/issues/1']).toBe(42);
        });

        it('handles missing TRACKED_TIMES gracefully (empty entries)', async () => {
            await adapter.syncComment(ISSUE_URL, OWNER, REPO, ISSUE_NUMBER);

            expect(GitHubService.createOrUpdateTrackerComment).toHaveBeenCalledWith(
                expect.objectContaining({ entries: [] }),
            );
        });
    });

    // -----------------------------------------------------------------------
    // notifyTimerStarted / notifyTimerStopped — no-op
    // -----------------------------------------------------------------------
    describe('timer notifications', () => {
        it('notifyTimerStarted does not throw', () => {
            expect(() => adapter.notifyTimerStarted(ISSUE_URL)).not.toThrow();
        });

        it('notifyTimerStopped does not throw', () => {
            expect(() => adapter.notifyTimerStopped(ISSUE_URL)).not.toThrow();
        });
    });
});
