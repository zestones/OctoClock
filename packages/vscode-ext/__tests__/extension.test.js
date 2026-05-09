import { describe, expect, it, vi } from 'vitest';
import { activate, deactivate } from '../src/extension.js';

// commands.js imports 'vscode' — provide a minimal mock so activate() can run
// in the test environment without the VS Code extension host.
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

const makeContext = (overrides = {}) =>
    /** @type {import('vscode').ExtensionContext} */(
        /** @type {any} */ ({
        globalState: { get: () => undefined, update: async () => { } },
        secrets: { get: async () => undefined, store: async () => { }, delete: async () => { } },
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
