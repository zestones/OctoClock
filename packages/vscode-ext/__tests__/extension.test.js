import { describe, expect, it } from 'vitest';
import { activate, deactivate } from '../src/extension.js';

const makeContext = (overrides = {}) =>
    /** @type {import('vscode').ExtensionContext} */(
        /** @type {any} */ ({
        globalState: { get: () => undefined, update: async () => { } },
        secrets: { get: async () => undefined, store: async () => { }, delete: async () => { } },
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
