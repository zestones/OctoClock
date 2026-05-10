import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
    EventEmitter: class {
        constructor() {
            this.event = () => ({ dispose: () => {} });
        }
        fire() {}
        dispose() {}
    },
    TreeItem: class {
        constructor(label, state) {
            this.label = label;
            this.collapsibleState = state;
        }
    },
    TreeItemCollapsibleState: { None: 0 },
    ThemeIcon: class {
        constructor(id) {
            this.id = id;
        }
    },
    workspace: {
        onDidChangeConfiguration: () => ({ dispose: () => {} }),
        getConfiguration: () => ({ get: (_k, def) => def }),
    },
}));

import { maskToken } from '../src/settings-tree.js';

describe('settings-tree maskToken', () => {
    it('returns "not set" for falsy input', () => {
        expect(maskToken(undefined)).toBe('not set');
        expect(maskToken(null)).toBe('not set');
        expect(maskToken('')).toBe('not set');
    });

    it('uses dots for very short tokens', () => {
        expect(maskToken('abc')).toBe('••••');
        expect(maskToken('12345678')).toBe('••••');
    });

    it('keeps prefix and suffix for normal tokens', () => {
        const token = 'ghp_abcdefghij1234567890';
        const masked = maskToken(token);
        expect(masked.startsWith('ghp_')).toBe(true);
        expect(masked.endsWith('7890')).toBe(true);
        expect(masked).toContain('…');
    });

    it('does not leak the middle of the token', () => {
        const token = 'ghp_secret-middle-token-tail';
        expect(maskToken(token)).not.toContain('secret');
        expect(maskToken(token)).not.toContain('middle');
    });
});
