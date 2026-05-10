// packages/vscode-ext/src/webview/sidebar/team-stats/provider.js
//
// WebviewViewProvider for the "Team Stats" sidebar panel.
//
// Architecture:
//   - The host aggregates EVERYONE_DATA + TRACKED_TIMES into a small
//     stats payload and posts it to the webview as `{ type: 'stats' }`.
//   - The webview is presentation-only (Preact) and never touches storage.
//
// Refresh triggers (per UI-4 implementation plan):
//   - storage events on TRACKED_TIMES or EVERYONE_DATA (covers timer
//     stop and team-sync completion in one subscription).
//   - Visibility-aware 5-minute interval: when the panel is visible and
//     the last refresh is older than 5 minutes, push fresh data.
//
// postMessage protocol:
//   host → webview  { type: 'stats', payload: { myTimeToday, teamTimeWeek,
//                     issuesTouchedToday, issueBars, teamRows } }
//   webview → host  { type: 'ready' }
//   webview → host  { type: 'openDashboard' }

import * as vscode from 'vscode';
import { StorageService } from '../../../../../core/src/services/storage.service.js';
import { AggregationService } from '../../../../../core/src/utils/aggregation.utils.js';
import { STORAGE_KEYS } from '../../../../../core/src/utils/constants.utils.js';
import { getHtml } from './html.js';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const TOP_ISSUE_BARS = 5;

export class TeamStatsProvider {
    static viewType = 'octoclock.teamStats';

    /** @type {vscode.WebviewView | undefined} */
    _view;

    /** @type {ReturnType<typeof setInterval> | undefined} */
    _interval;

    /** @type {number} */
    _lastSentAt = 0;

    /**
     * @param {vscode.ExtensionContext} context
     * @param {import('../../../../../core/src/ports/storage-events.port.js').StorageEventsPort} events
     */
    constructor(context, events) {
        this._context = context;

        const unsubscribe = events.subscribe((event) => {
            const keys = event.type === 'removeMultiple' ? event.keys : [event.key];
            if (keys.includes(STORAGE_KEYS.TRACKED_TIMES) || keys.includes(STORAGE_KEYS.EVERYONE_DATA)) {
                this._sendStats();
            }
        });

        this.dispose = () => {
            unsubscribe();
            if (this._interval) clearInterval(this._interval);
        };
    }

    /** @param {vscode.WebviewView} webviewView */
    resolveWebviewView(webviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'dist')],
        };

        webviewView.webview.html = getHtml(webviewView.webview, this._context.extensionUri);

        webviewView.webview.onDidReceiveMessage((message) => {
            if (message.type === 'ready') {
                this._sendStats();
            } else if (message.type === 'openDashboard') {
                vscode.commands.executeCommand('octoclock.openDashboard');
            }
        });

        // Visibility-aware refresh: refire when becoming visible if the last
        // push is stale; the interval handles the steady-state.
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible && Date.now() - this._lastSentAt > FIVE_MINUTES_MS) {
                this._sendStats();
            }
        });

        if (!this._interval) {
            this._interval = setInterval(() => {
                if (this._view?.visible) this._sendStats();
            }, FIVE_MINUTES_MS);
        }

        // Initial push.
        this._sendStats();
    }

    async _sendStats() {
        if (!this._view) return;
        try {
            const [trackedTimes, everyoneData] = await Promise.all([
                StorageService.get(STORAGE_KEYS.TRACKED_TIMES),
                StorageService.get(STORAGE_KEYS.EVERYONE_DATA),
            ]);
            const payload = TeamStatsProvider._aggregate(trackedTimes ?? [], everyoneData ?? []);
            this._view.webview.postMessage({ type: 'stats', payload });
            this._lastSentAt = Date.now();
        } catch {
            this._view.webview.postMessage({ type: 'stats', payload: TeamStatsProvider._emptyPayload() });
        }
    }

    static _emptyPayload() {
        return { myTimeToday: 0, teamTimeWeek: 0, issuesTouchedToday: 0, issueBars: [], teamRows: [] };
    }

    /**
     * Pure aggregation — exported as a static method so it is unit-testable
     * without spinning up a webview.
     *
     * @param {import('../../../../../core/src/utils/schema.utils.js').TrackedTimeEntry[]} trackedTimes
     * @param {import('../../../../../core/src/utils/schema.utils.js').EveryoneDataEntry[]} everyoneData
     */
    static _aggregate(trackedTimes, everyoneData) {
        // Your time today + issues touched today (from local TRACKED_TIMES).
        const todayEntries = AggregationService.getTodayEntries(trackedTimes);
        const myTimeToday = AggregationService.getTotalSeconds(todayEntries);
        const issuesTouchedToday = new Set(todayEntries.map((e) => e.issueUrl)).size;

        // Team time this week (everyone's entries within the current week).
        const weekEntries = AggregationService.getWeekEntries(everyoneData);
        const teamTimeWeek = AggregationService.getTotalSeconds(weekEntries);

        // Top N issues by total time across the team.
        /** @type {Record<string, { issueUrl: string, title: string, seconds: number }>} */
        const issueAgg = {};
        for (const e of everyoneData) {
            const k = e.issueUrl;
            if (!issueAgg[k]) {
                issueAgg[k] = {
                    issueUrl: k,
                    title: AggregationService.extractCleanTitle(e.title),
                    seconds: 0,
                };
            }
            issueAgg[k].seconds += e.seconds || 0;
        }
        const issueBars = Object.values(issueAgg)
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, TOP_ISSUE_BARS);

        // Per-user today rows: avatar initials, name, last issue, today seconds, last activity date.
        /** @type {Record<string, { user: string, todaySeconds: number, lastDate: string, lastIssueUrl: string, lastIssueTitle: string }>} */
        const teamAgg = {};
        for (const e of everyoneData) {
            const u = e.user;
            if (!u) continue;
            if (!teamAgg[u]) {
                teamAgg[u] = { user: u, todaySeconds: 0, lastDate: '', lastIssueUrl: '', lastIssueTitle: '' };
            }
            if (e.date && e.date > teamAgg[u].lastDate) {
                teamAgg[u].lastDate = e.date;
                teamAgg[u].lastIssueUrl = e.issueUrl;
                teamAgg[u].lastIssueTitle = AggregationService.extractCleanTitle(e.title);
            }
        }
        const todayStr = new Date().toISOString().slice(0, 10);
        for (const e of everyoneData) {
            if (e.date === todayStr && e.user) {
                teamAgg[e.user].todaySeconds += e.seconds || 0;
            }
        }
        const teamRows = Object.values(teamAgg).sort((a, b) => b.todaySeconds - a.todaySeconds);

        return { myTimeToday, teamTimeWeek, issuesTouchedToday, issueBars, teamRows };
    }
}
