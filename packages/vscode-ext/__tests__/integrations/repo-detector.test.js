// packages/vscode-ext/__tests__/integrations/repo-detector.test.js
//
// Unit tests for the pure parser used by WorkspaceRepoDetector.

import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [],
        onDidChangeWorkspaceFolders: vi.fn(() => ({ dispose: vi.fn() })),
        fs: { readFile: vi.fn() },
    },
    Uri: { joinPath: vi.fn() },
}));

import { parseGitConfigForRepos } from '../../src/integrations/repo-detector.js';

describe('parseGitConfigForRepos', () => {
    it('extracts owner/repo from an HTTPS GitHub remote', () => {
        const cfg = `
[remote "origin"]
\turl = https://github.com/zestones/OctoClock.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
`;
        expect(parseGitConfigForRepos(cfg)).toEqual(['zestones/OctoClock']);
    });

    it('extracts owner/repo from an SSH GitHub remote', () => {
        const cfg = `
[remote "origin"]
\turl = git@github.com:owner/repo.git
`;
        expect(parseGitConfigForRepos(cfg)).toEqual(['owner/repo']);
    });

    it('returns multiple unique slugs from multi-remote configs', () => {
        const cfg = `
[remote "origin"]
\turl = https://github.com/o1/r1
[remote "upstream"]
\turl = git@github.com:o2/r2.git
[remote "fork"]
\turl = https://github.com/o1/r1.git
`;
        const slugs = parseGitConfigForRepos(cfg);
        expect(slugs.sort()).toEqual(['o1/r1', 'o2/r2']);
    });

    it('ignores non-GitHub remotes', () => {
        const cfg = `
[remote "origin"]
\turl = https://gitlab.com/owner/repo.git
[remote "self"]
\turl = git@bitbucket.org:owner/repo.git
`;
        expect(parseGitConfigForRepos(cfg)).toEqual([]);
    });

    it('returns an empty array for empty/missing input', () => {
        expect(parseGitConfigForRepos('')).toEqual([]);
        expect(parseGitConfigForRepos(null)).toEqual([]);
        expect(parseGitConfigForRepos(undefined)).toEqual([]);
    });
});
