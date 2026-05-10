// packages/vscode-ext/__tests__/integrations/branch-watcher.test.js

import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
    extensions: { getExtension: vi.fn(() => undefined), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) },
}));

import * as vscode from 'vscode';
import { BranchWatcher, findMatchingIssue } from '../../src/integrations/branch-watcher.js';

const issues = [
    { url: '/owner1/repo1/issues/42', title: 'a' },
    { url: '/owner2/repo2/issues/42', title: 'b' },
    { url: '/owner1/repo1/issues/100', title: 'c' },
];

describe('findMatchingIssue', () => {
    it('returns null for branches without numeric segments', () => {
        expect(findMatchingIssue('main', issues)).toBeNull();
        expect(findMatchingIssue('feature/cleanup', issues)).toBeNull();
    });

    it('finds an issue by 2-6 digit number', () => {
        expect(findMatchingIssue('feature/42-fix', issues)).toEqual({
            url: '/owner1/repo1/issues/42',
            number: 42,
        });
    });

    it('prefers a repo-scoped match when ambiguous', () => {
        expect(findMatchingIssue('fix-42', issues, 'owner2/repo2')).toEqual({
            url: '/owner2/repo2/issues/42',
            number: 42,
        });
    });

    it('falls back to the first match when no scoped match exists', () => {
        expect(findMatchingIssue('fix-100', issues, 'owner2/repo2')).toEqual({
            url: '/owner1/repo1/issues/100',
            number: 100,
        });
    });

    it('ignores numbers outside 2-6 digits', () => {
        expect(findMatchingIssue('1', issues)).toBeNull();
    });

    it('returns null for empty issue lists', () => {
        expect(findMatchingIssue('feature/42', [])).toBeNull();
        expect(findMatchingIssue('feature/42', null)).toBeNull();
    });
});

describe('BranchWatcher', () => {
    it('does not read vscode.git exports until the git extension is active', () => {
        const exportsGetter = vi.fn(() => {
            throw new Error("Extension 'vscode.git' is not known or not activated.");
        });
        const gitExtension = { isActive: false };
        Object.defineProperty(gitExtension, 'exports', { get: exportsGetter });
        vi.mocked(vscode.extensions.getExtension).mockReturnValueOnce(gitExtension);

        expect(() => new BranchWatcher({ subscriptions: [] })).not.toThrow();
        expect(exportsGetter).not.toHaveBeenCalled();
    });
});
