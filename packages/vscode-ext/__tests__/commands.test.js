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

vi.mock('../../core/src/services/sync.service.js', () => ({
    syncRepoFromGitHub: vi.fn().mockResolvedValue({ importedCount: 1 }),
}));

import * as vscode from 'vscode';
import { StoragePort } from '../../core/src/ports/storage.port.js';
import { GitHubService } from '../../core/src/services/github.service.js';
import { PinnedReposService } from '../../core/src/services/pinned-repos.service.js';
import { StorageService } from '../../core/src/services/storage.service.js';
import { syncRepoFromGitHub } from '../../core/src/services/sync.service.js';
import { TimerService } from '../../core/src/services/timer.service.js';
import { STORAGE_KEYS } from '../../core/src/utils/constants.utils.js';
import { normalizeIssueUrl, parseDuration, registerCommands } from '../src/commands.js';

// ---------------------------------------------------------------------------
// In-memory storage for tests
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
// Helpers — extract command handlers after registerCommands() runs
// ---------------------------------------------------------------------------
function makeContext() {
    return /** @type {any} */ ({ subscriptions: [] });
}

function getHandler(commandId) {
    const call = /** @type {any} */ (vscode.commands.registerCommand).mock.calls.find(([id]) => id === commandId);
    if (!call) throw new Error(`Command '${commandId}' was not registered`);
    return call[1];
}

// ---------------------------------------------------------------------------
// normalizeIssueUrl — unit tests
// ---------------------------------------------------------------------------
describe('normalizeIssueUrl', () => {
    it('accepts a full HTTPS URL', () => {
        expect(normalizeIssueUrl('https://github.com/owner/repo/issues/42')).toBe('/owner/repo/issues/42');
    });

    it('accepts an HTTP URL', () => {
        expect(normalizeIssueUrl('http://github.com/owner/repo/issues/1')).toBe('/owner/repo/issues/1');
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
    let deleteSessionSpy;
    /** @type {any} */
    let updateSessionTimeSpy;
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
        deleteSessionSpy = vi.spyOn(TimerService, 'deleteSession');
        deleteSessionSpy.mockResolvedValue({ ok: true, syncStatus: 'synced', syncError: null });
        updateSessionTimeSpy = vi.spyOn(TimerService, 'updateSessionTime');
        updateSessionTimeSpy.mockResolvedValue({ ok: true, syncStatus: 'synced', syncError: null });

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
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('octoclock.startTimer', expect.any(Function));
        });

        it('calls TimerService.startTimer with the normalised URL', async () => {
            win.showInputBox.mockResolvedValue('https://github.com/owner/repo/issues/1');
            await getHandler('octoclock.startTimer')();

            expect(startTimerSpy).toHaveBeenCalledWith('/owner/repo/issues/1');
            expect(win.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('/owner/repo/issues/1'));
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

            expect(win.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('network failure'));
        });
    });

    // -----------------------------------------------------------------------
    // octoclock.stopTimer
    // -----------------------------------------------------------------------
    describe('octoclock.stopTimer', () => {
        it('is registered', () => {
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('octoclock.stopTimer', expect.any(Function));
        });

        it('calls TimerService.stopTimer with the active issue URL', async () => {
            await storage.set(STORAGE_KEYS.ACTIVE_ISSUE, '/owner/repo/issues/2');
            await getHandler('octoclock.stopTimer')();

            expect(stopTimerSpy).toHaveBeenCalledWith('/owner/repo/issues/2');
            expect(win.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('/owner/repo/issues/2'));
        });

        it('shows an info message when no timer is running', async () => {
            // ACTIVE_ISSUE is null (no entry in storage)
            await getHandler('octoclock.stopTimer')();

            expect(stopTimerSpy).not.toHaveBeenCalled();
            expect(win.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('No timer'));
        });

        it('shows an error when TimerService.stopTimer throws', async () => {
            await storage.set(STORAGE_KEYS.ACTIVE_ISSUE, '/owner/repo/issues/3');
            stopTimerSpy.mockRejectedValue(new Error('stop failed'));
            await getHandler('octoclock.stopTimer')();

            expect(win.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('stop failed'));
        });
    });

    // -----------------------------------------------------------------------
    // octoclock.syncNow
    // -----------------------------------------------------------------------
    describe('octoclock.syncNow', () => {
        it('is registered', () => {
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('octoclock.syncNow', expect.any(Function));
        });

        it('calls TimerService.syncComment for the active issue', async () => {
            await storage.set(STORAGE_KEYS.ACTIVE_ISSUE, '/owner/repo/issues/4');
            await getHandler('octoclock.syncNow')();

            expect(syncCommentSpy).toHaveBeenCalledWith('/owner/repo/issues/4', 'owner', 'repo', 4);
            expect(win.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('synced'));
        });

        it('shows an info message when there is no active issue', async () => {
            await getHandler('octoclock.syncNow')();

            expect(syncCommentSpy).not.toHaveBeenCalled();
            expect(win.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('No active issue'));
        });

        it('shows an error when syncComment throws', async () => {
            await storage.set(STORAGE_KEYS.ACTIVE_ISSUE, '/owner/repo/issues/5');
            syncCommentSpy.mockRejectedValue(new Error('rate limited'));
            await getHandler('octoclock.syncNow')();

            expect(win.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('rate limited'));
        });
    });
});

// ---------------------------------------------------------------------------
// parseDuration — unit tests
// ---------------------------------------------------------------------------
describe('parseDuration', () => {
    it('parses a standard HH:MM:SS string', () => {
        expect(parseDuration('01:30:00')).toBe(5400);
    });

    it('parses single-digit hours', () => {
        expect(parseDuration('0:01:30')).toBe(90);
    });

    it('returns null for zero duration', () => {
        expect(parseDuration('00:00:00')).toBeNull();
    });

    it('returns null for non-numeric input', () => {
        expect(parseDuration('1h30m')).toBeNull();
    });

    it('returns null for an empty string', () => {
        expect(parseDuration('')).toBeNull();
    });

    it('trims surrounding whitespace before parsing', () => {
        expect(parseDuration('  00:45:00  ')).toBe(2700);
    });
});

// ---------------------------------------------------------------------------
// octoclock.deleteSession / octoclock.editSession
// ---------------------------------------------------------------------------
describe('OctoClock session commands', () => {
    let storage;
    /** @type {any} */
    let deleteSessionSpy2;
    /** @type {any} */
    let updateSessionTimeSpy2;
    /** @type {any} */
    const win2 = vscode.window;

    /** A minimal SessionNode-like object that commands receive from VS Code */
    const makeItem = (overrides = {}) => ({
        issueUrl: '/owner/repo/issues/7',
        date: '2025-05-09',
        seconds: 3600,
        ...overrides,
    });

    beforeEach(() => {
        storage = new InMemoryStorage();
        StorageService.setAdapter(storage);
        vi.clearAllMocks();

        deleteSessionSpy2 = vi.spyOn(TimerService, 'deleteSession');
        deleteSessionSpy2.mockResolvedValue({ ok: true, syncStatus: 'synced', syncError: null });
        updateSessionTimeSpy2 = vi.spyOn(TimerService, 'updateSessionTime');
        updateSessionTimeSpy2.mockResolvedValue({ ok: true, syncStatus: 'synced', syncError: null });

        registerCommands(makeContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
        StorageService.setAdapter(null);
    });

    // -----------------------------------------------------------------------
    // octoclock.deleteSession
    // -----------------------------------------------------------------------
    describe('octoclock.deleteSession', () => {
        it('is registered', () => {
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'octoclock.deleteSession',
                expect.any(Function),
            );
        });

        it('calls TimerService.deleteSession with issueUrl, date, seconds', async () => {
            const item = makeItem();
            await getHandler('octoclock.deleteSession')(item);

            expect(deleteSessionSpy2).toHaveBeenCalledWith('/owner/repo/issues/7', '2025-05-09', 3600);
            expect(win2.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('deleted'));
        });

        it('shows a warning when the session is not found (ok: false)', async () => {
            deleteSessionSpy2.mockResolvedValue({ ok: false, syncStatus: 'skipped', syncError: null });
            await getHandler('octoclock.deleteSession')(makeItem());

            expect(win2.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('not found'));
        });

        it('shows an error when TimerService.deleteSession throws', async () => {
            deleteSessionSpy2.mockRejectedValue(new Error('disk full'));
            await getHandler('octoclock.deleteSession')(makeItem());

            expect(win2.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('disk full'));
        });

        it('returns early when item is undefined', async () => {
            await getHandler('octoclock.deleteSession')(undefined);
            expect(deleteSessionSpy2).not.toHaveBeenCalled();
        });

        it('returns early when item is missing required properties', async () => {
            await getHandler('octoclock.deleteSession')({ issueUrl: '/o/r/issues/1' });
            expect(deleteSessionSpy2).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // octoclock.editSession
    // -----------------------------------------------------------------------
    describe('octoclock.editSession', () => {
        it('is registered', () => {
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('octoclock.editSession', expect.any(Function));
        });

        it('calls TimerService.updateSessionTime with parsed newSeconds', async () => {
            win2.showInputBox.mockResolvedValue('02:00:00'); // 7200 seconds
            await getHandler('octoclock.editSession')(makeItem());

            expect(updateSessionTimeSpy2).toHaveBeenCalledWith('/owner/repo/issues/7', '2025-05-09', 3600, 7200);
            expect(win2.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('updated'));
        });

        it('shows a warning when the session is not found (ok: false)', async () => {
            win2.showInputBox.mockResolvedValue('00:30:00');
            updateSessionTimeSpy2.mockResolvedValue({ ok: false, syncStatus: 'skipped', syncError: null });
            await getHandler('octoclock.editSession')(makeItem());

            expect(win2.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('not found'));
        });

        it('shows an error for an invalid duration string', async () => {
            win2.showInputBox.mockResolvedValue('not-a-duration');
            await getHandler('octoclock.editSession')(makeItem());

            expect(updateSessionTimeSpy2).not.toHaveBeenCalled();
            expect(win2.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Invalid duration'));
        });

        it('returns early when user cancels the input box (undefined)', async () => {
            win2.showInputBox.mockResolvedValue(undefined);
            await getHandler('octoclock.editSession')(makeItem());

            expect(updateSessionTimeSpy2).not.toHaveBeenCalled();
        });

        it('shows an error when TimerService.updateSessionTime throws', async () => {
            win2.showInputBox.mockResolvedValue('00:10:00');
            updateSessionTimeSpy2.mockRejectedValue(new Error('write failed'));
            await getHandler('octoclock.editSession')(makeItem());

            expect(win2.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('write failed'));
        });

        it('returns early when item is undefined', async () => {
            await getHandler('octoclock.editSession')(undefined);
            expect(win2.showInputBox).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// octoclock.pinRepo / octoclock.unpinRepo
// ---------------------------------------------------------------------------
describe('OctoClock repo pin commands', () => {
    let storage;
    /** @type {any} */
    let addPinnedRepoSpy;
    /** @type {any} */
    let removePinnedRepoSpy;
    /** @type {any} */
    const win3 = vscode.window;

    beforeEach(() => {
        storage = new InMemoryStorage();
        StorageService.setAdapter(storage);
        vi.clearAllMocks();

        addPinnedRepoSpy = vi.spyOn(PinnedReposService, 'addPinnedRepo');
        addPinnedRepoSpy.mockResolvedValue(undefined);
        removePinnedRepoSpy = vi.spyOn(PinnedReposService, 'removePinnedRepo');
        removePinnedRepoSpy.mockResolvedValue(undefined);

        registerCommands(makeContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
        StorageService.setAdapter(null);
    });

    // -----------------------------------------------------------------------
    // octoclock.pinRepo
    // -----------------------------------------------------------------------
    describe('octoclock.pinRepo', () => {
        it('is registered', () => {
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('octoclock.pinRepo', expect.any(Function));
        });

        it('pins a repo and shows an info message', async () => {
            win3.showInputBox.mockResolvedValue('owner/my-repo');
            await getHandler('octoclock.pinRepo')();

            expect(addPinnedRepoSpy).toHaveBeenCalledWith({ fullName: 'owner/my-repo' });
            expect(win3.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('owner/my-repo'));
        });

        it('returns early when user cancels the input box', async () => {
            win3.showInputBox.mockResolvedValue(undefined);
            await getHandler('octoclock.pinRepo')();

            expect(addPinnedRepoSpy).not.toHaveBeenCalled();
        });

        it('shows an error for an invalid owner/repo format', async () => {
            win3.showInputBox.mockResolvedValue('not-a-repo');
            await getHandler('octoclock.pinRepo')();

            expect(addPinnedRepoSpy).not.toHaveBeenCalled();
            expect(win3.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Invalid repository format'));
        });

        it('calls syncRepoFromGitHub when AUTO_SYNC is enabled', async () => {
            await storage.set(STORAGE_KEYS.AUTO_SYNC, true);
            win3.showInputBox.mockResolvedValue('owner/my-repo');
            await getHandler('octoclock.pinRepo')();

            expect(syncRepoFromGitHub).toHaveBeenCalledWith('owner', 'my-repo');
        });

        it('does not call syncRepoFromGitHub when AUTO_SYNC is disabled', async () => {
            await storage.set(STORAGE_KEYS.AUTO_SYNC, false);
            win3.showInputBox.mockResolvedValue('owner/my-repo');
            await getHandler('octoclock.pinRepo')();

            expect(syncRepoFromGitHub).not.toHaveBeenCalled();
        });

        it('shows an error when addPinnedRepo throws', async () => {
            addPinnedRepoSpy.mockRejectedValue(new Error('write error'));
            win3.showInputBox.mockResolvedValue('owner/my-repo');
            await getHandler('octoclock.pinRepo')();

            expect(win3.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('write error'));
        });
    });

    // -----------------------------------------------------------------------
    // octoclock.unpinRepo
    // -----------------------------------------------------------------------
    describe('octoclock.unpinRepo', () => {
        it('is registered', () => {
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('octoclock.unpinRepo', expect.any(Function));
        });

        it('unpins a repo and shows an info message', async () => {
            await getHandler('octoclock.unpinRepo')({ fullName: 'owner/my-repo' });

            expect(removePinnedRepoSpy).toHaveBeenCalledWith('owner/my-repo');
            expect(win3.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('owner/my-repo'));
        });

        it('returns early when item is undefined', async () => {
            await getHandler('octoclock.unpinRepo')(undefined);
            expect(removePinnedRepoSpy).not.toHaveBeenCalled();
        });

        it('returns early when item has no fullName', async () => {
            await getHandler('octoclock.unpinRepo')({});
            expect(removePinnedRepoSpy).not.toHaveBeenCalled();
        });

        it('shows an error when removePinnedRepo throws', async () => {
            removePinnedRepoSpy.mockRejectedValue(new Error('delete error'));
            await getHandler('octoclock.unpinRepo')({ fullName: 'owner/my-repo' });

            expect(win3.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('delete error'));
        });
    });
});
