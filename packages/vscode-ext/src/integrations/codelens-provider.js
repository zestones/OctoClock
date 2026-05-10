// packages/vscode-ext/src/integrations/codelens-provider.js
//
// UI-7.4 — CodeLens for `#<number>` issue references in source files.
//
// Opt-in via `octoclock.enableCodeLens` (default false). When enabled,
// scans every visible document for `#<number>` patterns inside comments
// and string literals (heuristic — see `looksReferential`) and emits a
// CodeLens that:
//   - reads `$(clock) Track #42` when the issue is *not* the active timer.
//   - reads `$(stop-circle) Tracking` when the issue *is* the active timer.
//
// Lens text refresh:
//   - Storage events for ACTIVE_ISSUE / ISSUES fire `_emitter.fire()` so
//     VS Code re-requests `provideCodeLenses` within ~1s.
//   - Configuration changes that toggle `enableCodeLens` also fire.
//
// Heuristic scan:
//   We only match `#N` when the line begins with a comment marker (`//`,
//   `#`, `--`, `/*`, ` *`) or the `#N` is inside a quoted string. This
//   keeps the lens off identifiers like `array[#42]` (which isn't legal
//   anyway) and JSX/HTML id selectors. False negatives are acceptable —
//   users who want a stricter view can disable the feature.
//
// The provider is registered for `{ scheme: 'file' }` only (no untitled
// or virtual docs) to avoid noisy lenses in scratch buffers.

import * as vscode from 'vscode';
import { IssueStorageService } from '../../../core/src/services/issue-storage.service.js';
import { StorageService } from '../../../core/src/services/storage.service.js';
import { STORAGE_KEYS } from '../../../core/src/utils/constants.utils.js';

const COMMENT_LINE_RE = /^\s*(?:\/\/|#|--|\/\*|\*)/;
const ISSUE_REF_RE = /#(\d{1,6})\b/g;

/**
 * @param {string} line
 * @param {number} hashIndex   index of the `#` character within `line`
 */
export function looksReferential(line, hashIndex) {
    if (COMMENT_LINE_RE.test(line)) return true;
    // Look for an unescaped quote before the `#` on the same line.
    const before = line.slice(0, hashIndex);
    const quoted = (before.match(/["'`]/g) ?? []).length;
    return quoted % 2 === 1;
}

export class IssueCodeLensProvider {
    static viewType = 'octoclock.issueCodeLens';

    /**
     * @param {import('../../../core/src/ports/storage-events.port.js').StorageEventsPort} events
     */
    constructor(events) {
        this._emitter = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this._emitter.event;

        /** @type {string | null} */
        this._activeIssue = null;
        /** @type {Set<string>} */
        this._knownNumbers = new Set();

        StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE)
            .then((v) => {
                this._activeIssue = v ?? null;
            })
            .catch(() => {});
        this._refreshKnownNumbers();

        this._unsubscribe = events.subscribe((e) => {
            if (e.type === 'set' && e.key === STORAGE_KEYS.ACTIVE_ISSUE) {
                this._activeIssue = e.value ?? null;
                this._emitter.fire();
            } else if (e.type === 'remove' && e.key === STORAGE_KEYS.ACTIVE_ISSUE) {
                this._activeIssue = null;
                this._emitter.fire();
            } else if (e.type === 'set' && e.key === STORAGE_KEYS.ISSUES) {
                this._refreshKnownNumbers().then(() => this._emitter.fire());
            }
        });
    }

    /**
     * Triggered by external listeners (configuration toggle, manual refresh).
     * Public because extension.js wires it to `onDidChangeConfiguration`.
     */
    refresh() {
        this._emitter.fire();
    }

    dispose() {
        try {
            this._unsubscribe?.();
        } catch {}
        this._emitter.dispose();
    }

    async _refreshKnownNumbers() {
        try {
            const issues = await IssueStorageService.getAll();
            this._issueCache = issues;
            this._knownNumbers = new Set(issues.map((i) => i.url.split('/')[4]).filter((s) => /^\d+$/.test(s ?? '')));
        } catch {
            this._issueCache = [];
            this._knownNumbers = new Set();
        }
    }

    /**
     * @param {vscode.TextDocument} document
     * @param {vscode.CancellationToken} _token
     * @returns {vscode.CodeLens[]}
     */
    provideCodeLenses(document, _token) {
        const cfg = vscode.workspace.getConfiguration('octoclock');
        if (!cfg.get('enableCodeLens', false)) return [];
        if (this._knownNumbers.size === 0) return [];

        /** @type {vscode.CodeLens[]} */
        const lenses = [];
        const seenLines = new Set();
        const lineCount = Math.min(document.lineCount, 5000); // cheap upper bound
        for (let i = 0; i < lineCount; i++) {
            const text = document.lineAt(i).text;
            ISSUE_REF_RE.lastIndex = 0;
            let m = ISSUE_REF_RE.exec(text);
            while (m) {
                const hashIdx = m.index;
                if (looksReferential(text, hashIdx) && this._knownNumbers.has(m[1]) && !seenLines.has(i)) {
                    seenLines.add(i);
                    const num = parseInt(m[1], 10);
                    const issueUrl = this._findIssueUrlForNumber(num);
                    const range = new vscode.Range(i, hashIdx, i, hashIdx + m[0].length);
                    const isActive = !!issueUrl && issueUrl === this._activeIssue;
                    const title = isActive ? `$(stop-circle) Tracking #${num}` : `$(clock) Track #${num}`;
                    lenses.push(
                        new vscode.CodeLens(range, {
                            title,
                            command: isActive ? 'octoclock.stopTimer' : 'octoclock.startTimer',
                            arguments: isActive ? [] : [issueUrl],
                        }),
                    );
                }
                m = ISSUE_REF_RE.exec(text);
            }
        }
        return lenses;
    }

    /**
     * Resolve the canonical issue URL for an integer issue number. Returns
     * the first matching cached entry (the cache is populated alongside
     * `_knownNumbers` so the two never disagree).
     *
     * @param {number} number
     * @returns {string | null}
     */
    _findIssueUrlForNumber(number) {
        const all = this._issueCache ?? [];
        for (const i of all) {
            const parts = i.url.split('/');
            if (parts.length >= 5 && parts[4] === String(number)) return i.url;
        }
        return null;
    }
}
