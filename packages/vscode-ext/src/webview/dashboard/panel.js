// packages/vscode-ext/src/webview/dashboard/panel.js
//
// DashboardPanel — singleton WebviewPanel for the full-screen OctoClock dashboard.
//
// Architectural notes:
//   - Singleton via `DashboardPanel.currentPanel`. `open(context)` reveals
//     the existing panel or creates a new one.
//   - All filtering happens HOST-SIDE (`filtering.js`); the webview only
//     receives pre-computed payloads via the `data` message.
//   - State that is purely visual (active tab, scroll, expand/collapse)
//     stays in the webview and is preserved across hide/show by
//     `retainContextWhenHidden: true`.
//
// Message protocol:
//   webview → host
//     { type: 'ready' }
//     { type: 'rangeChange',  range, weekOffset?, customStart?, customEnd? }
//     { type: 'filterChange', memberFilter?, issueFilter? }
//     { type: 'memberDrill',  memberId }                       // UI-6
//
//   host → webview
//     { type: 'init',        sessions, payload }
//     { type: 'data',        payload }
//     { type: 'memberDetail', member, payload }                 // UI-6

import * as vscode from 'vscode';
import { StorageService } from '../../../../core/src/services/storage.service.js';
import { STORAGE_KEYS } from '../../../../core/src/utils/constants.utils.js';
import { aggregate, applyFilters, computeDateRange, computeMemberDetail, filterByWindow } from './filtering.js';
import { getHtml } from './html.js';

export class DashboardPanel {
    static viewType = 'octoclock.dashboard';

    /** @type {DashboardPanel | undefined} */
    static currentPanel;

    /**
     * Reveal the existing panel or create a new one.
     * Mirrors the `createOrShow` convention from the implementation plan.
     *
     * @param {vscode.ExtensionContext} context
     */
    static open(context) {
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal();
            return;
        }
        DashboardPanel.currentPanel = new DashboardPanel(context);
    }

    /** @param {vscode.ExtensionContext} context */
    constructor(context) {
        this._context = context;
        this._panel = vscode.window.createWebviewPanel(
            DashboardPanel.viewType,
            'OctoClock Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
                retainContextWhenHidden: true,
            },
        );
        this._panel.webview.html = getHtml(this._panel.webview, context.extensionUri);

        this._panel.webview.onDidReceiveMessage((msg) => this._handleMessage(msg));

        this._panel.onDidDispose(() => {
            DashboardPanel.currentPanel = undefined;
        });
    }

    /** @param {{ type: string, [k: string]: any }} msg */
    async _handleMessage(msg) {
        if (msg.type === 'ready') return this._sendInit();
        if (msg.type === 'rangeChange' || msg.type === 'filterChange') return this._sendFiltered(msg);
        if (msg.type === 'memberDrill') return this._sendMemberDetail(msg);
    }

    /**
     * Send a per-member drill-down payload. Re-uses the most recent
     * range + filters provided by the webview so the detail view stays
     * consistent with the list it was launched from.
     *
     * @param {{ memberId: string, range?: string, weekOffset?: number, customStart?: string, customEnd?: string, memberFilter?: string|null, issueFilter?: string|null }} msg
     */
    async _sendMemberDetail(msg) {
        const allSessions = await DashboardPanel._loadSessions();
        const window = computeDateRange({
            range: /** @type {any} */ (msg.range || 'week'),
            weekOffset: msg.weekOffset || 0,
            customStart: msg.customStart,
            customEnd: msg.customEnd,
        });
        const inRange = filterByWindow(allSessions, window);
        const detail = computeMemberDetail(inRange, msg.memberId);
        this._panel.webview.postMessage({
            type: 'memberDetail',
            member: msg.memberId,
            window,
            payload: detail,
        });
    }

    async _sendInit() {
        const allSessions = await DashboardPanel._loadSessions();
        // Default range: current week, no filters.
        const window = computeDateRange({ range: 'week', weekOffset: 0 });
        const filtered = filterByWindow(allSessions, window);
        const payload = aggregate(filtered);
        this._panel.webview.postMessage({
            type: 'init',
            range: 'week',
            weekOffset: 0,
            window,
            payload,
        });
    }

    /**
     * Handle both `rangeChange` and `filterChange`. The webview always sends
     * its full current state, so the host can compute the answer in one shot
     * without keeping shadow state.
     *
     * @param {{ type: string, range?: string, weekOffset?: number, customStart?: string, customEnd?: string, memberFilter?: string|null, issueFilter?: string|null }} msg
     */
    async _sendFiltered(msg) {
        const allSessions = await DashboardPanel._loadSessions();
        const window = computeDateRange({
            range: /** @type {any} */ (msg.range || 'week'),
            weekOffset: msg.weekOffset || 0,
            customStart: msg.customStart,
            customEnd: msg.customEnd,
        });
        const inRange = filterByWindow(allSessions, window);
        const filtered = applyFilters(inRange, {
            memberFilter: msg.memberFilter ?? null,
            issueFilter: msg.issueFilter ?? null,
        });
        const payload = aggregate(filtered);
        this._panel.webview.postMessage({
            type: 'data',
            range: msg.range || 'week',
            weekOffset: msg.weekOffset || 0,
            window,
            memberFilter: msg.memberFilter ?? null,
            issueFilter: msg.issueFilter ?? null,
            payload,
        });
    }

    /**
     * Merge EVERYONE_DATA + TRACKED_TIMES into a single sessions array.
     * Local-only entries (no `user`) are kept so the panel works pre-sync.
     *
     * @returns {Promise<Array<{ issueUrl: string, title: string, seconds: number, date: string, user?: string }>>}
     */
    static async _loadSessions() {
        const [trackedTimes, everyoneData] = await Promise.all([
            StorageService.get(STORAGE_KEYS.TRACKED_TIMES),
            StorageService.get(STORAGE_KEYS.EVERYONE_DATA),
        ]);
        const everyone = everyoneData ?? [];
        const local = trackedTimes ?? [];
        // Avoid double-counting: if a local entry exists in EVERYONE_DATA
        // (issueUrl + date + seconds + user-field-absent vs same user) skip it.
        // Heuristic — match on (issueUrl, date, seconds). EveryoneDataEntry rows
        // have `user`; local rows do not. Local rows that are NOT mirrored in
        // EVERYONE_DATA show up as the `(you)` synthetic user in aggregation.
        const everyoneKeys = new Set(everyone.map((e) => `${e.issueUrl}|${e.date}|${e.seconds}`));
        const localOnly = local.filter((e) => !everyoneKeys.has(`${e.issueUrl}|${e.date}|${e.seconds}`));
        return [...everyone, ...localOnly];
    }
}
