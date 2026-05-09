import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessagingPort } from '../../packages/core/src/ports/messaging.port.js';
import { TimerService } from '../../src/services/timer.service.js';

// ---------------------------------------------------------------------------
// Minimal stub implementations of MessagingPort
// ---------------------------------------------------------------------------

class FakeMessagingAdapter extends MessagingPort {
    syncComment = vi.fn(() => Promise.resolve({ ok: true, commentId: 99 }));
    notifyTimerStarted = vi.fn();
    notifyTimerStopped = vi.fn();
}

/** No-op adapter — intended to model a future VS Code adapter that has no tabs */
class NoOpMessagingAdapter extends MessagingPort {
    syncComment() {
        return Promise.resolve({ ok: true, commentId: null });
    }
    notifyTimerStarted() { }
    notifyTimerStopped() { }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset the private static #messagingPort field between tests. */
function resetMessagingPort() {
    TimerService.setMessagingPort(null);
}

// ---------------------------------------------------------------------------
// TimerService.syncComment delegation
// ---------------------------------------------------------------------------

describe('TimerService.syncComment — delegation', () => {
    let fake;

    beforeEach(() => {
        fake = new FakeMessagingAdapter();
        TimerService.setMessagingPort(fake);
    });

    afterEach(() => {
        resetMessagingPort();
    });

    it('delegates to the messaging port with the correct arguments', async () => {
        await TimerService.syncComment('https://github.com/owner/repo/issues/1', 'owner', 'repo', 1);

        expect(fake.syncComment).toHaveBeenCalledOnce();
        expect(fake.syncComment).toHaveBeenCalledWith(
            'https://github.com/owner/repo/issues/1',
            'owner',
            'repo',
            1,
        );
    });

    it('returns the value resolved by the port', async () => {
        const result = await TimerService.syncComment(
            'https://github.com/owner/repo/issues/2',
            'owner',
            'repo',
            2,
        );
        expect(result).toEqual({ ok: true, commentId: 99 });
    });

    it('throws when no messaging port is configured', async () => {
        resetMessagingPort();
        await expect(
            TimerService.syncComment('https://github.com/owner/repo/issues/3', 'owner', 'repo', 3),
        ).rejects.toThrow('TimerService: no MessagingPort set');
    });
});

// ---------------------------------------------------------------------------
// VS Code-style no-op adapter
// ---------------------------------------------------------------------------

describe('NoOpMessagingAdapter — timerStarted / timerStopped do not throw', () => {
    let adapter;

    beforeEach(() => {
        adapter = new NoOpMessagingAdapter();
        TimerService.setMessagingPort(adapter);
    });

    afterEach(() => {
        resetMessagingPort();
    });

    it('notifyTimerStarted does not throw', () => {
        expect(() => adapter.notifyTimerStarted('https://github.com/owner/repo/issues/1')).not.toThrow();
    });

    it('notifyTimerStopped does not throw', () => {
        expect(() => adapter.notifyTimerStopped('https://github.com/owner/repo/issues/1')).not.toThrow();
    });

    it('syncComment resolves without network call', async () => {
        const result = await adapter.syncComment(
            'https://github.com/owner/repo/issues/1',
            'owner',
            'repo',
            1,
        );
        expect(result).toEqual({ ok: true, commentId: null });
    });
});

// ---------------------------------------------------------------------------
// MessagingPort abstract base — throws on unimplemented methods
// ---------------------------------------------------------------------------

describe('MessagingPort abstract base', () => {
    const port = new MessagingPort();

    it('syncComment throws', () => {
        expect(() => port.syncComment('u', 'o', 'r', 1)).toThrow('MessagingPort.syncComment not implemented');
    });

    it('notifyTimerStarted throws', () => {
        expect(() => port.notifyTimerStarted('u')).toThrow('MessagingPort.notifyTimerStarted not implemented');
    });

    it('notifyTimerStopped throws', () => {
        expect(() => port.notifyTimerStopped('u')).toThrow('MessagingPort.notifyTimerStopped not implemented');
    });
});
