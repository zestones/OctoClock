// packages/vscode-ext/__tests__/integrations/codelens-provider.test.js

import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
    EventEmitter: class EventEmitter {
        constructor() {
            this.event = () => ({ dispose: () => {} });
        }
        fire() {}
        dispose() {}
    },
    workspace: { getConfiguration: vi.fn(() => ({ get: vi.fn() })) },
}));

import { looksReferential } from '../../src/integrations/codelens-provider.js';

describe('looksReferential', () => {
    it('matches inside line comments', () => {
        const line = '// see #42 for details';
        const idx = line.indexOf('#');
        expect(looksReferential(line, idx)).toBe(true);
    });

    it('matches inside block-comment continuation lines', () => {
        const line = ' * Tracks #42';
        const idx = line.indexOf('#');
        expect(looksReferential(line, idx)).toBe(true);
    });

    it('matches inside python/shell comments', () => {
        const line = '# fixes #42';
        const idx = line.lastIndexOf('#');
        expect(looksReferential(line, idx)).toBe(true);
    });

    it('matches inside SQL/lua comments', () => {
        const line = '-- see #42';
        const idx = line.indexOf('#');
        expect(looksReferential(line, idx)).toBe(true);
    });

    it('matches inside string literals', () => {
        const line = "throw new Error('see #42 for context')";
        const idx = line.indexOf('#');
        expect(looksReferential(line, idx)).toBe(true);
    });

    it('rejects bare identifier-like #N outside comments and strings', () => {
        const line = 'const x = arr[#42];';
        const idx = line.indexOf('#');
        expect(looksReferential(line, idx)).toBe(false);
    });
});
