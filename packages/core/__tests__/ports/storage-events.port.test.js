import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageEventsPort } from '../../src/ports/storage-events.port.js';

let port;

beforeEach(() => {
    port = new StorageEventsPort();
});

describe('subscribe / emit', () => {
    it('calls the listener with the emitted event', () => {
        const listener = vi.fn();
        port.subscribe(listener);

        port.emit({ type: 'set', key: 'foo', value: 'bar' });

        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith({ type: 'set', key: 'foo', value: 'bar' });
    });

    it('calls multiple listeners', () => {
        const a = vi.fn();
        const b = vi.fn();
        port.subscribe(a);
        port.subscribe(b);

        port.emit({ type: 'remove', key: 'x' });

        expect(a).toHaveBeenCalledOnce();
        expect(b).toHaveBeenCalledOnce();
    });

    it('does not call unsubscribed listeners', () => {
        const listener = vi.fn();
        const unsubscribe = port.subscribe(listener);

        unsubscribe();
        port.emit({ type: 'removeMultiple', keys: ['a', 'b'] });

        expect(listener).not.toHaveBeenCalled();
    });

    it('only removes the specific listener, not all', () => {
        const a = vi.fn();
        const b = vi.fn();
        port.subscribe(a);
        const unsubB = port.subscribe(b);

        unsubB();
        port.emit({ type: 'set', key: 'k', value: 1 });

        expect(a).toHaveBeenCalledOnce();
        expect(b).not.toHaveBeenCalled();
    });
});

describe('event shapes', () => {
    it('emits set events', () => {
        const listener = vi.fn();
        port.subscribe(listener);
        port.emit({ type: 'set', key: 'theme', value: 'dark' });
        expect(listener).toHaveBeenCalledWith({ type: 'set', key: 'theme', value: 'dark' });
    });

    it('emits remove events', () => {
        const listener = vi.fn();
        port.subscribe(listener);
        port.emit({ type: 'remove', key: 'activeIssue' });
        expect(listener).toHaveBeenCalledWith({ type: 'remove', key: 'activeIssue' });
    });

    it('emits removeMultiple events', () => {
        const listener = vi.fn();
        port.subscribe(listener);
        port.emit({ type: 'removeMultiple', keys: ['activeIssue', 'startTime'] });
        expect(listener).toHaveBeenCalledWith({
            type: 'removeMultiple',
            keys: ['activeIssue', 'startTime'],
        });
    });
});
