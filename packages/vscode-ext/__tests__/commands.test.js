import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Must be called before any module that imports 'vscode' is loaded.
vi.mock('vscode', () => ({
    commands: {
        registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
    },
    window: {
        showInputBox: vi.fn(),
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
    },
}));

import * as vscode from 'vscode';
import { StoragePort } from '../../core/src/ports/storage.port.js';
import { GitHubService } from '../../core/src/services/github.service.js';
import { StorageService } from '../../core/src/services/storage.service.js';
import { TimerService } from '../../core/src/services/timer.service.js';
import { STORAGE_KEYS } from '../../core/src/utils/constants.utils.js';
import { normalizeIssueUrl, registerCommands } from '../src/commands.js';

// ---------------------------------------------------------------------------
// In-memory storage for tests
// ---------------------------------------------------------------------------
class InMemoryStorage extends StoragePort {
    #store = new Map();
    async get(key) { return this.#store.get(key) ?? null; }
    async set(key, value) { this.#store.set(key, value); }
    async remove(key) { this.#store.delete(key); }
    async getMultiple(keys) { return Object.fromEntries(keys.map((k) => [k, this.#store.get(k) ?? null])); }
    async removeMultiple(keys) { for (const k of keys) this.#store.delete(k); }
}

// ---------------------------------------------------------------------------
// Helpers — extract command handlers after registerCommands() runs
// ---------------------------------------------------------------------------
function makeContext() {
    return /** @type {any} */ ({ subscriptions: [] });
}

function getHandler(commandId) {
    const call = /** @type {any} */ (vscode.commands.registerCommand).mock.calls
        .find(([id]) => id === commandId);
    if (!call) throw new Error(`Command '${commandId}' was not registered`);
    return call[1];
}

// ---------------------------------------------------------------------------
// normalizeIssueUrl — unit tests
// ---------------------------------------------------------------------------
describe('normalizeIssueUrl', () => {
    it('accepts a full HTTPS URL', () => {
        expect(normalizeIssueUrl('https://github.com/owner/repo/issues/42'))
            .toBe('/owner/repo/issues/42');
    });

    it('accepts an HTTP URL', () => {
        expect(normalizeIssueUrl('http://github.com/owner/repo/issues/1'))
            .toBe('/owner/repo/issues/1');
    });

    it('accepts path form without normalisation needed', () => {
        expect(normalizeIssueUrl('/owner/repo/issues/99')).toBe('/owner/repo/issues/99');
    });

    it('trims surrounding whitespace', () => {
        expect(normalizeIssueUrl('  /owner/repo/issues/5  ')).toBe('/owner/repo/issues/5');
    });

    it('returns null for a bare repo URL (no issue path)', () => {
        expect(normalizeIssueUrl('https://github.com/owner/repo')).toBeNull();
    });

    it('returns null for a random string', () => {
        expect(normalizeIssueUrl('not-a-url')).toBeNull();
    });

    it('returns null for an empty string', () => {
        expect(normalizeIssueUrl('')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------
describe('OctoClock commands', () => {
    let storage;
    /** @type {any} */
    let startTimerSpy;
    /** @type {any} */
    let stopTimerSpy;
    /** @type {any} */
    let syncCommentSpy;
    /** @type {any} */
    const win = vscode.window;

    beforeEach(() => {
        storage = new InMemoryStorage();
        StorageService.setAdapter(storage);

        vi.clearAllMocks();

        // Default stub for TimerService methods
        startTimerSpy = vi.spyOn(TimerService, 'startTimer');
        startTimerSpy.mockResolvedValue({ issueUrl: '/o/r/issues/1', totalTime: 0, isRunning: true });
        stopTimerSpy = vi.spyOn(TimerService, 'stopTimer');
        stopTimerSpy.mockResolvedValue({ issueUrl: '/o/r/issues/1', totalTime: 30, isRunning: false });
        syncCommentSpy = vi.spyOn(TimerService, 'syncComment');
        syncCommentSpy.mockResolvedValue({ commentId: 7 });

        registerCommands(makeContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
        StorageService.setAdapter(null);
    });

    // -----------------------------------------------------------------------
    // octoclock.startTimer
    // -----------------------------------------------------------------------
    describe('octoclock.startTimer', () => {
        it('is registered', () => {
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'octoclock.startTimer',
                expect.any(Function),
            );
        });

        it('calls TimerService.startTimer with the normalised URL', async () => {
            win.showInputBox.mockResolvedValue('https://github.com/owner/repo/issues/1');
            await getHandler('octoclock.startTimer')();

            expect(startTimerSpy).toHaveBeenCalledWith('/owner/repo/issues/1');
            expect(win.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('/owner/repo/issues/1'),
            );
        });

        it('also accepts path-form URLs', async () => {
            win.showInputBox.mockResolvedValue('/owner/repo/issues/5');
            await getHandler('octoclock.startTimer')();

            expect(startTimerSpy).toHaveBeenCalledWith('/owner/repo/issues/5');
        });

        it('shows an error for an invalid URL', async () => {
            win.showInputBox.mockResolvedValue('not-a-url');
            await getHandler('octoclock.startTimer')();

            expect(startTimerSpy).not.toHaveBeenCalled();
            expect(win.showErrorMessage).toHaveBeenCalled();
        });

        it('returns early when user cancels input (undefined)', async () => {
            win.showInputBox.mockResolvedValue(undefined);
            await getHandler('octoclock.startTimer')();

            expect(startTimerSpy).not.toHaveBeenCalled();
        });

        it('shows a warning when startTimer returns isRunning: false', async () => {
            startTimerSpy.mockResolvedValue({ issueUrl: '/o/r/issues/1', totalTime: 0, isRunning: false });
            win.showInputBox.mockResolvedValue('/owner/repo/issues/1');
            await getHandler('octoclock.startTimer')();

            expect(win.showWarningMessage).toHaveBeenCalled();
        });

        it('shows an error when TimerService.startTimer throws', async () => {
            startTimerSpy.mockRejectedValue(new Error('network failure'));
            win.showInputBox.mockResolvedValue('/owner/repo/issues/1');
            await getHandler('octoclock.startTimer')();

            expect(win.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('network failure'),
            );
        });
    });

    // -----------------------------------------------------------------------
    // octoclock.stopTimer
    // -----------------------------------------------------------------------
    describe('octoclock.stopTimer', () => {
        it('is registered', () => {
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'octoclock.stopTimer',
                expect.any(Function),
            );
        });

        it('calls TimerService.stopTimer with the active issue URL', async () => {
            await storage.set(STORAGE_KEYS.ACTIVE_ISSUE, '/owner/repo/issues/2');
            await getHandler('octoclock.stopTimer')();

            expect(stopTimerSpy).toHaveBeenCalledWith('/owner/repo/issues/2');
            expect(win.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('/owner/repo/issues/2'),
            );
        });

        it('shows an info message when no timer is running', async () => {
            // ACTIVE_ISSUE is null (no entry in storage)
            await getHandler('octoclock.stopTimer')();

            expect(stopTimerSpy).not.toHaveBeenCalled();
            expect(win.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('No timer'),
            );
        });

        it('shows an error when TimerService.stopTimer throws', async () => {
            await storage.set(STORAGE_KEYS.ACTIVE_ISSUE, '/owner/repo/issues/3');
            stopTimerSpy.mockRejectedValue(new Error('stop failed'));
            await getHandler('octoclock.stopTimer')();

            expect(win.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('stop failed'),
            );
        });
    });

    // -----------------------------------------------------------------------
    // octoclock.syncNow
    // -----------------------------------------------------------------------
    describe('octoclock.syncNow', () => {
        it('is registered', () => {
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'octoclock.syncNow',
                expect.any(Function),
            );
        });

        it('calls TimerService.syncComment for the active issue', async () => {
            await storage.set(STORAGE_KEYS.ACTIVE_ISSUE, '/owner/repo/issues/4');
            await getHandler('octoclock.syncNow')();

            expect(syncCommentSpy).toHaveBeenCalledWith(
                '/owner/repo/issues/4',
                'owner',
                'repo',
                4,
            );
            expect(win.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('synced'),
            );
        });

        it('shows an info message when there is no active issue', async () => {
            await getHandler('octoclock.syncNow')();

            expect(syncCommentSpy).not.toHaveBeenCalled();
            expect(win.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('No active issue'),
            );
        });

        it('shows an error when syncComment throws', async () => {
            await storage.set(STORAGE_KEYS.ACTIVE_ISSUE, '/owner/repo/issues/5');
            syncCommentSpy.mockRejectedValue(new Error('rate limited'));
            await getHandler('octoclock.syncNow')();

            expect(win.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('rate limited'),
            );
        });
    });
});
