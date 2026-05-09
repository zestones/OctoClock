// packages/vscode-ext/__tests__/tree-view.test.js
//
// Unit tests for RepoTreeProvider and tree node classes.
//
// The 'vscode' module is mocked before any import that transitively uses it,
// so vi.mock() is declared first.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => {
    const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };

    class TreeItem {
        constructor(label, collapsibleState) {
            this.label = label;
            this.collapsibleState = collapsibleState;
        }
    }

    class EventEmitter {
        constructor() {
            this._listeners = [];
            // VS Code EventEmitter exposes its event as a property (not a method call)
            this.event = (listener) => {
                this._listeners.push(listener);
                return { dispose: () => this._listeners.splice(this._listeners.indexOf(listener), 1) };
            };
        }
        fire(data) {
            for (const l of [...this._listeners]) l(data);
        }
        dispose() {
            this._listeners = [];
        }
    }

    return { TreeItem, TreeItemCollapsibleState, EventEmitter };
});

import { StorageEventsPort } from '../../core/src/ports/storage-events.port.js';
import { StoragePort } from '../../core/src/ports/storage.port.js';
import { StorageService } from '../../core/src/services/storage.service.js';
import { STORAGE_KEYS } from '../../core/src/utils/constants.utils.js';
import { IssueNode, RepoNode, RepoTreeProvider, SessionNode } from '../src/tree-view.js';

// ---------------------------------------------------------------------------
// In-memory storage
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
// Sample data
// ---------------------------------------------------------------------------
const ENTRY_A = {
    issueUrl: '/owner/repo-a/issues/1',
    title: 'repo-a | Fix the bug | #1',
    seconds: 3600,
    date: '2025-05-09',
};
const ENTRY_A2 = {
    issueUrl: '/owner/repo-a/issues/1',
    title: 'repo-a | Fix the bug | #1',
    seconds: 1800,
    date: '2025-05-10',
};
const ENTRY_B = {
    issueUrl: '/owner/repo-b/issues/42',
    title: 'repo-b | Add feature | #42',
    seconds: 900,
    date: '2025-05-09',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Drains microtask queue */
async function flushPromises() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}

// ---------------------------------------------------------------------------
// Node class tests
// ---------------------------------------------------------------------------

describe('RepoNode', () => {
    it('label is the fullName', () => {
        const node = new RepoNode('owner/repo', 3600, []);
        expect(node.label).toBe('owner/repo');
    });

    it('collapsibleState is None when there are no issue nodes', () => {
        const node = new RepoNode('owner/repo', 0, []);
        expect(node.collapsibleState).toBe(0); // None
    });

    it('collapsibleState is Collapsed when issue nodes are present', () => {
        const issueNode = new IssueNode('/owner/repo/issues/1', 'Fix bug', 60, []);
        const node = new RepoNode('owner/repo', 60, [issueNode]);
        expect(node.collapsibleState).toBe(1); // Collapsed
    });

    it('tooltip shows total time when totalSeconds > 0', () => {
        const node = new RepoNode('owner/repo', 3600, []);
        expect(node.tooltip).toContain('Total:');
    });

    it('tooltip says "No sessions yet" when totalSeconds === 0', () => {
        const node = new RepoNode('owner/repo', 0, []);
        expect(node.tooltip).toBe('No sessions yet');
    });

    it('contextValue is octoclock.repo', () => {
        const node = new RepoNode('owner/repo', 0, []);
        expect(node.contextValue).toBe('octoclock.repo');
    });
});

describe('IssueNode', () => {
    it('label is the displayTitle', () => {
        const node = new IssueNode('/owner/repo/issues/1', 'Fix bug', 3600, []);
        expect(node.label).toBe('Fix bug');
    });

    it('issueUrl is stored and not derived from the label', () => {
        const node = new IssueNode('/owner/repo/issues/99', 'Some title', 0, []);
        expect(node.issueUrl).toBe('/owner/repo/issues/99');
    });

    it('description shows the formatted duration', () => {
        const node = new IssueNode('/owner/repo/issues/1', 'Fix bug', 3600, []);
        expect(node.description).toContain('1h');
    });

    it('tooltip includes issueUrl', () => {
        const node = new IssueNode('/owner/repo/issues/5', 'title', 600, []);
        expect(node.tooltip).toContain('/owner/repo/issues/5');
    });

    it('collapsibleState is Collapsed', () => {
        const node = new IssueNode('/owner/repo/issues/1', 'Fix bug', 0, []);
        expect(node.collapsibleState).toBe(1); // Collapsed
    });

    it('contextValue is octoclock.issue', () => {
        const node = new IssueNode('/owner/repo/issues/1', 'Fix bug', 0, []);
        expect(node.contextValue).toBe('octoclock.issue');
    });
});

describe('SessionNode', () => {
    it('label includes date and formatted duration', () => {
        const node = new SessionNode('2025-05-09', 3660);
        expect(node.label).toContain('2025-05-09');
        expect(node.label).toContain('1h');
    });

    it('collapsibleState is None', () => {
        const node = new SessionNode('2025-05-09', 60);
        expect(node.collapsibleState).toBe(0); // None
    });

    it('contextValue is octoclock.session', () => {
        const node = new SessionNode('2025-05-09', 60);
        expect(node.contextValue).toBe('octoclock.session');
    });
});

// ---------------------------------------------------------------------------
// RepoTreeProvider tests
// ---------------------------------------------------------------------------

describe('RepoTreeProvider', () => {
    /** @type {InMemoryStorage} */
    let storage;
    /** @type {StorageEventsPort} */
    let events;
    /** @type {RepoTreeProvider} */
    let provider;

    beforeEach(() => {
        storage = new InMemoryStorage();
        StorageService.setAdapter(storage);
        events = new StorageEventsPort();
        provider = new RepoTreeProvider(events);
    });

    afterEach(() => {
        provider.dispose();
        StorageService.setAdapter(null);
    });

    // -----------------------------------------------------------------------
    // getTreeItem
    // -----------------------------------------------------------------------
    it('getTreeItem returns the element unchanged', () => {
        const node = new RepoNode('owner/repo', 0, []);
        expect(provider.getTreeItem(node)).toBe(node);
    });

    // -----------------------------------------------------------------------
    // getChildren — root (no element)
    // -----------------------------------------------------------------------
    it('returns [] when storage is empty', async () => {
        const result = await provider.getChildren(undefined);
        expect(result).toEqual([]);
    });

    it('returns a RepoNode for each pinned repo even with no tracked time', async () => {
        await storage.set(STORAGE_KEYS.PINNED_REPOS, [{ fullName: 'owner/repo-a' }]);
        const result = await provider.getChildren(undefined);

        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(RepoNode);
        expect(result[0].label).toBe('owner/repo-a');
    });

    it('returns a RepoNode for a repo with tracked time even if not pinned', async () => {
        await storage.set(STORAGE_KEYS.TRACKED_TIMES, [ENTRY_A]);
        const result = await provider.getChildren(undefined);

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('owner/repo-a');
    });

    it('deduplicates repos that are both pinned and have tracked time', async () => {
        await storage.set(STORAGE_KEYS.PINNED_REPOS, [{ fullName: 'owner/repo-a' }]);
        await storage.set(STORAGE_KEYS.TRACKED_TIMES, [ENTRY_A]);
        const result = await provider.getChildren(undefined);

        expect(result).toHaveLength(1);
    });

    it('returns multiple repo nodes for multiple repos', async () => {
        await storage.set(STORAGE_KEYS.TRACKED_TIMES, [ENTRY_A, ENTRY_B]);
        const result = await provider.getChildren(undefined);

        expect(result).toHaveLength(2);
        const labels = result.map((n) => n.label);
        expect(labels).toContain('owner/repo-a');
        expect(labels).toContain('owner/repo-b');
    });

    it('pinned repos appear before repos only in tracked times', async () => {
        await storage.set(STORAGE_KEYS.PINNED_REPOS, [{ fullName: 'owner/repo-b' }]);
        await storage.set(STORAGE_KEYS.TRACKED_TIMES, [ENTRY_A, ENTRY_B]);
        const result = await provider.getChildren(undefined);

        expect(result[0].label).toBe('owner/repo-b');
        expect(result[1].label).toBe('owner/repo-a');
    });

    // -----------------------------------------------------------------------
    // getChildren — RepoNode
    // -----------------------------------------------------------------------
    it('returns IssueNode children for a RepoNode', async () => {
        await storage.set(STORAGE_KEYS.TRACKED_TIMES, [ENTRY_A]);
        const repos = await provider.getChildren(undefined);

        const issues = await provider.getChildren(repos[0]);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toBeInstanceOf(IssueNode);
    });

    it('IssueNode.issueUrl is the stored entry issueUrl (not derived from display string)', async () => {
        await storage.set(STORAGE_KEYS.TRACKED_TIMES, [ENTRY_A]);
        const [repo] = await provider.getChildren(undefined);
        const [issue] = /** @type {any[]} */ (await provider.getChildren(repo));

        expect(issue.issueUrl).toBe('/owner/repo-a/issues/1');
    });

    it('aggregates multiple sessions for the same issue into one IssueNode', async () => {
        await storage.set(STORAGE_KEYS.TRACKED_TIMES, [ENTRY_A, ENTRY_A2]);
        const [repo] = await provider.getChildren(undefined);
        const issues = /** @type {any[]} */ (await provider.getChildren(repo));

        expect(issues).toHaveLength(1);
        expect(issues[0].totalSeconds).toBe(ENTRY_A.seconds + ENTRY_A2.seconds);
    });

    it('returns [] for a pinned repo with no tracked time', async () => {
        await storage.set(STORAGE_KEYS.PINNED_REPOS, [{ fullName: 'owner/empty-repo' }]);
        const [repo] = await provider.getChildren(undefined);
        const issues = await provider.getChildren(repo);

        expect(issues).toEqual([]);
    });

    // -----------------------------------------------------------------------
    // getChildren — IssueNode
    // -----------------------------------------------------------------------
    it('returns SessionNode children for an IssueNode', async () => {
        await storage.set(STORAGE_KEYS.TRACKED_TIMES, [ENTRY_A, ENTRY_A2]);
        const [repo] = await provider.getChildren(undefined);
        const [issue] = await provider.getChildren(repo);
        const sessions = await provider.getChildren(issue);

        expect(sessions).toHaveLength(2);
        expect(sessions[0]).toBeInstanceOf(SessionNode);
    });

    it('SessionNode label includes date and duration', async () => {
        await storage.set(STORAGE_KEYS.TRACKED_TIMES, [ENTRY_A]);
        const [repo] = await provider.getChildren(undefined);
        const [issue] = await provider.getChildren(repo);
        const [session] = await provider.getChildren(issue);

        expect(session.label).toContain('2025-05-09');
        expect(session.label).toMatch(/1h/);
    });

    // -----------------------------------------------------------------------
    // getChildren — SessionNode (leaf)
    // -----------------------------------------------------------------------
    it('returns [] for a SessionNode (it is a leaf)', async () => {
        const session = new SessionNode('2025-05-09', 60);
        const result = await provider.getChildren(session);
        expect(result).toEqual([]);
    });

    // -----------------------------------------------------------------------
    // Storage event reactions
    // -----------------------------------------------------------------------
    it('fires onDidChangeTreeData when TRACKED_TIMES is set', async () => {
        let fired = false;
        provider.onDidChangeTreeData(() => { fired = true; });

        events.emit({ type: 'set', key: STORAGE_KEYS.TRACKED_TIMES, value: [] });
        expect(fired).toBe(true);
    });

    it('fires onDidChangeTreeData when PINNED_REPOS is set', async () => {
        let fired = false;
        provider.onDidChangeTreeData(() => { fired = true; });

        events.emit({ type: 'set', key: STORAGE_KEYS.PINNED_REPOS, value: [] });
        expect(fired).toBe(true);
    });

    it('fires onDidChangeTreeData when TRACKED_TIMES is removed', async () => {
        let fired = false;
        provider.onDidChangeTreeData(() => { fired = true; });

        events.emit({ type: 'remove', key: STORAGE_KEYS.TRACKED_TIMES });
        expect(fired).toBe(true);
    });

    it('fires onDidChangeTreeData when TRACKED_TIMES is in a removeMultiple', async () => {
        let fired = false;
        provider.onDidChangeTreeData(() => { fired = true; });

        events.emit({
            type: 'removeMultiple',
            keys: [STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.TRACKED_TIMES],
        });
        expect(fired).toBe(true);
    });

    it('does NOT fire onDidChangeTreeData for unrelated storage events', async () => {
        let fired = false;
        provider.onDidChangeTreeData(() => { fired = true; });

        events.emit({ type: 'set', key: STORAGE_KEYS.GITHUB_TOKEN, value: 'tok' });
        events.emit({ type: 'remove', key: STORAGE_KEYS.ACTIVE_ISSUE });
        expect(fired).toBe(false);
    });

    // -----------------------------------------------------------------------
    // dispose
    // -----------------------------------------------------------------------
    it('stops reacting to storage events after dispose()', async () => {
        let fired = false;
        provider.onDidChangeTreeData(() => { fired = true; });

        provider.dispose();

        events.emit({ type: 'set', key: STORAGE_KEYS.TRACKED_TIMES, value: [] });
        expect(fired).toBe(false);
    });
});
