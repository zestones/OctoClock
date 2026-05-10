import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activate, deactivate } from '../src/extension.js';

// Must be hoisted before any import that touches 'vscode'.
vi.mock('vscode', () => ({
    commands: {
        registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
        executeCommand: vi.fn(),
    },
    StatusBarAlignment: { Left: 1, Right: 2 },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    TreeItem: class TreeItem {
        constructor(label, collapsibleState) {
            this.label = label;
            this.collapsibleState = collapsibleState;
        }
    },
    EventEmitter: class EventEmitter {
        constructor() {
            this._listeners = [];
            this.event = (listener) => {
                this._listeners.push(listener);
                return { dispose: () => {} };
            };
        }
        fire(data) {
            for (const l of this._listeners) l(data);
        }
        dispose() {}
    },
    window: {
        showInputBox: vi.fn(),
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        createStatusBarItem: vi.fn(() => ({
            show: vi.fn(),
            dispose: vi.fn(),
            text: '',
            tooltip: '',
            command: undefined,
        })),
        createTreeView: vi.fn(() => ({ dispose: vi.fn() })),
        registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
    },
    workspace: {
        workspaceFolders: [],
        onDidChangeWorkspaceFolders: vi.fn(() => ({ dispose: vi.fn() })),
        onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
        onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
        getConfiguration: vi.fn(() => ({ get: vi.fn((_k, def) => def) })),
        fs: { readFile: vi.fn().mockRejectedValue(new Error('not found')) },
    },
    extensions: {
        getExtension: vi.fn(() => undefined),
        onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
    },
    languages: {
        registerCodeLensProvider: vi.fn(() => ({ dispose: vi.fn() })),
    },
    CodeLens: class CodeLens {
        constructor(range, command) {
            this.range = range;
            this.command = command;
        }
    },
    Range: class Range {
        constructor(sl, sc, el, ec) {
            this.start = { line: sl, character: sc };
            this.end = { line: el, character: ec };
        }
    },
    Uri: { joinPath: vi.fn((base, ...segs) => ({ ...base, path: `${base?.path ?? ''}/${segs.join('/')}` })) },
    ThemeIcon: class ThemeIcon {
        constructor(id, color) {
            this.id = id;
            this.color = color;
        }
    },
    ThemeColor: class ThemeColor {
        constructor(id) {
            this.id = id;
        }
    },
}));

vi.mock('../../core/src/services/sync.service.js', () => ({
    syncFromGitHub: vi.fn().mockResolvedValue({ importedCount: 3 }),
    syncRepoFromGitHub: vi.fn().mockResolvedValue({ importedCount: 1 }),
}));

import { syncFromGitHub } from '../../core/src/services/sync.service.js';
import { STORAGE_KEYS } from '../../core/src/utils/constants.utils.js';

const makeContext = (overrides = {}) =>
    /** @type {import('vscode').ExtensionContext} */ (
        /** @type {any} */ ({
            globalState: { get: () => undefined, update: async () => {} },
            secrets: { get: async () => undefined, store: async () => {}, delete: async () => {} },
            subscriptions: [],
            ...overrides,
        })
    );

describe('activate', () => {
    it('does not throw when globalState and secrets are present', () => {
        expect(() => activate(makeContext())).not.toThrow();
    });

    it('throws when globalState is missing', () => {
        expect(() => activate(makeContext({ globalState: undefined }))).toThrow('context.globalState is not available');
    });

    it('throws when secrets is missing', () => {
        expect(() => activate(makeContext({ secrets: undefined }))).toThrow('context.secrets is not available');
    });
});

describe('deactivate', () => {
    it('is exported and does not throw', () => {
        expect(typeof deactivate).toBe('function');
        expect(() => deactivate()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Auto-sync recovery on activation
// ---------------------------------------------------------------------------
describe('activate — auto-sync recovery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /** Drains the microtask queue so fire-and-forget promises settle. */
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    it('calls syncFromGitHub when AUTO_SYNC is true and a token is stored', async () => {
        const ctx = makeContext({
            globalState: {
                get: (key) => (key === STORAGE_KEYS.AUTO_SYNC ? true : undefined),
                update: async () => {},
            },
            secrets: {
                get: async (key) => (key === STORAGE_KEYS.GITHUB_TOKEN ? JSON.stringify('my-token') : undefined),
                store: async () => {},
                delete: async () => {},
            },
        });

        activate(ctx);
        await flush();

        expect(syncFromGitHub).toHaveBeenCalledOnce();
    });

    it('does not call syncFromGitHub when AUTO_SYNC is false', async () => {
        const ctx = makeContext({
            globalState: {
                get: (key) => (key === STORAGE_KEYS.AUTO_SYNC ? false : undefined),
                update: async () => {},
            },
            secrets: {
                get: async (key) => (key === STORAGE_KEYS.GITHUB_TOKEN ? JSON.stringify('my-token') : undefined),
                store: async () => {},
                delete: async () => {},
            },
        });

        activate(ctx);
        await flush();

        expect(syncFromGitHub).not.toHaveBeenCalled();
    });

    it('does not call syncFromGitHub when the token is absent', async () => {
        const ctx = makeContext({
            globalState: {
                get: (key) => (key === STORAGE_KEYS.AUTO_SYNC ? true : undefined),
                update: async () => {},
            },
            secrets: {
                get: async () => undefined,
                store: async () => {},
                delete: async () => {},
            },
        });

        activate(ctx);
        await flush();

        expect(syncFromGitHub).not.toHaveBeenCalled();
    });

    it('does not throw when syncFromGitHub rejects', async () => {
        /** @type {any} */
        const spy = syncFromGitHub;
        spy.mockRejectedValue(new Error('network timeout'));

        const ctx = makeContext({
            globalState: {
                get: (key) => (key === STORAGE_KEYS.AUTO_SYNC ? true : undefined),
                update: async () => {},
            },
            secrets: {
                get: async (key) => (key === STORAGE_KEYS.GITHUB_TOKEN ? JSON.stringify('tok') : undefined),
                store: async () => {},
                delete: async () => {},
            },
        });

        // Error must be swallowed — activation must not reject.
        await expect(async () => {
            activate(ctx);
            await flush();
        }).not.toThrow();
    });
});
