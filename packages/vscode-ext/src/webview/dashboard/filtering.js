// packages/vscode-ext/src/webview/dashboard/filtering.js
//
// Pure, host-side filtering helpers for the Dashboard panel.
// Kept separate from `panel.js` so they can be unit-tested without
// spinning up a webview and so the panel stays small and readable.
//
// The webview never imports these — it only requests data via the
// message protocol (`rangeChange` / `filterChange`) and renders what the
// host returns. All business logic stays in the extension host.

import { AggregationService } from '../../../../core/src/utils/aggregation.utils.js';
import { TimeService } from '../../../../core/src/utils/time.utils.js';

/**
 * Compute [startDate, endDate] (inclusive, "YYYY-MM-DD") for a given range.
 *
 * @param {{ range: 'today' | 'week' | 'month' | 'all', weekOffset?: number, customStart?: string, customEnd?: string }} params
 * @returns {{ start: string | null, end: string | null }}
 */
export function computeDateRange({ range, weekOffset = 0, customStart, customEnd }) {
    if (customStart && customEnd) return { start: customStart, end: customEnd };
    const today = new Date();
    if (range === 'today') {
        const d = TimeService.getLocalDateString(today);
        return { start: d, end: d };
    }
    if (range === 'week') {
        const dayOfWeek = today.getDay();
        const daysFromMonday = (dayOfWeek + 6) % 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - daysFromMonday + weekOffset * 7);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
            start: TimeService.getLocalDateString(monday),
            end: TimeService.getLocalDateString(sunday),
        };
    }
    if (range === 'month') {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
            start: TimeService.getLocalDateString(first),
            end: TimeService.getLocalDateString(last),
        };
    }
    // 'all'
    return { start: null, end: null };
}

/**
 * Filter an array of session-like entries (TrackedTimeEntry or EveryoneDataEntry)
 * by an inclusive date window. `null` start/end means "no bound on that side".
 *
 * @template {{ date: string }} T
 * @param {T[]} entries
 * @param {{ start: string | null, end: string | null }} window
 * @returns {T[]}
 */
export function filterByWindow(entries, { start, end }) {
    if (!start && !end) return entries;
    return entries.filter((e) => {
        if (start && e.date < start) return false;
        if (end && e.date > end) return false;
        return true;
    });
}

/**
 * Extract `owner/repo` from a GitHub issue URL. Returns an empty string when
 * the URL does not match the expected GitHub layout.
 *
 * @param {string} url
 * @returns {string}
 */
export function parseRepoFromUrl(url) {
    if (!url) return '';
    const m = /github\.com\/([^/]+\/[^/]+)\//.exec(url);
    return m ? m[1] : '';
}

/**
 * Compute per-member drill-down stats from the already-filtered entries.
 *
 * @param {Array<{ issueUrl: string, title: string, seconds: number, date: string, user?: string }>} entries
 * @param {string} user
 * @returns {{
 *   user: string,
 *   total: number,
 *   sessionsCount: number,
 *   issuesTouched: number,
 *   issueRows: Array<{ issueUrl: string, title: string, seconds: number, sessions: number }>,
 *   sessionLog: Array<{ issueUrl: string, title: string, seconds: number, date: string }>
 * }}
 */
export function computeMemberDetail(entries, user) {
    const own = entries.filter((e) => (e.user || '(you)') === user);
    /** @type {Map<string, { issueUrl: string, title: string, seconds: number, sessions: number }>} */
    const issueMap = new Map();
    let total = 0;
    for (const e of own) {
        total += e.seconds || 0;
        const cleanTitle = AggregationService.extractCleanTitle(e.title);
        const r = issueMap.get(e.issueUrl) ?? { issueUrl: e.issueUrl, title: cleanTitle, seconds: 0, sessions: 0 };
        r.seconds += e.seconds || 0;
        r.sessions += 1;
        issueMap.set(e.issueUrl, r);
    }
    const issueRows = [...issueMap.values()].sort((a, b) => b.seconds - a.seconds);
    const sessionLog = own
        .map((e) => ({
            issueUrl: e.issueUrl,
            title: AggregationService.extractCleanTitle(e.title),
            seconds: e.seconds || 0,
            date: e.date,
        }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
    return {
        user,
        total,
        sessionsCount: own.length,
        issuesTouched: issueMap.size,
        issueRows,
        sessionLog,
    };
}

/**
 * Aggregate filtered entries into the Dashboard's `data` payload.
 *
 * `entries` is the canonical sessions array; we treat it as `EveryoneDataEntry[]`
 * (each row has `user`) but local-user-only TrackedTimeEntry rows (no `user`)
 * are also accepted: they are bucketed under the synthetic key `'(you)'`.
 *
 * @param {Array<{ issueUrl: string, title: string, seconds: number, date: string, user?: string }>} entries
 * @returns {{
 *   total: number,
 *   sessionsCount: number,
 *   issuesTouched: number,
 *   membersCount: number,
 *   dailyBuckets: Array<{ date: string, seconds: number }>,
 *   issueRows: Array<{ issueUrl: string, title: string, repo: string, seconds: number, sessions: number, members: string[], byMember: Array<{ user: string, seconds: number, sessions: number }> }>,
 *   memberRows: Array<{ user: string, seconds: number, sessions: number, lastIssueTitle: string, lastDate: string }>,
 *   sessionLog: Array<{ issueUrl: string, title: string, seconds: number, date: string, user: string }>
 * }}
 */
export function aggregate(entries) {
    const total = AggregationService.getTotalSeconds(entries);
    const sessionsCount = entries.length;

    /** @type {Map<string, { date: string, seconds: number }>} */
    const dayMap = new Map();
    /** @type {Map<string, { issueUrl: string, title: string, seconds: number, sessions: number, members: Set<string>, byMember: Map<string, { user: string, seconds: number, sessions: number }> }>} */
    const issueMap = new Map();
    /** @type {Map<string, { user: string, seconds: number, sessions: number, lastIssueTitle: string, lastDate: string }>} */
    const memberMap = new Map();

    for (const e of entries) {
        const user = e.user || '(you)';
        const seconds = e.seconds || 0;

        // Daily totals.
        const day = dayMap.get(e.date) ?? { date: e.date, seconds: 0 };
        day.seconds += seconds;
        dayMap.set(e.date, day);

        // Per-issue.
        const cleanTitle = AggregationService.extractCleanTitle(e.title);
        const ir = issueMap.get(e.issueUrl) ?? {
            issueUrl: e.issueUrl,
            title: cleanTitle,
            seconds: 0,
            sessions: 0,
            members: new Set(),
            byMember: new Map(),
        };
        ir.seconds += seconds;
        ir.sessions += 1;
        ir.members.add(user);
        const im = ir.byMember.get(user) ?? { user, seconds: 0, sessions: 0 };
        im.seconds += seconds;
        im.sessions += 1;
        ir.byMember.set(user, im);
        issueMap.set(e.issueUrl, ir);

        // Per-member.
        const mr = memberMap.get(user) ?? {
            user,
            seconds: 0,
            sessions: 0,
            lastIssueTitle: '',
            lastDate: '',
        };
        mr.seconds += seconds;
        mr.sessions += 1;
        if (!mr.lastDate || e.date > mr.lastDate) {
            mr.lastDate = e.date;
            mr.lastIssueTitle = cleanTitle;
        }
        memberMap.set(user, mr);
    }

    const dailyBuckets = [...dayMap.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    const issueRows = [...issueMap.values()]
        .map((r) => ({
            issueUrl: r.issueUrl,
            title: r.title,
            repo: parseRepoFromUrl(r.issueUrl),
            seconds: r.seconds,
            sessions: r.sessions,
            members: [...r.members],
            byMember: [...r.byMember.values()].sort((a, b) => b.seconds - a.seconds),
        }))
        .sort((a, b) => b.seconds - a.seconds);
    const memberRows = [...memberMap.values()].sort((a, b) => b.seconds - a.seconds);
    const sessionLog = [...entries]
        .map((e) => ({
            issueUrl: e.issueUrl,
            title: AggregationService.extractCleanTitle(e.title),
            seconds: e.seconds || 0,
            date: e.date,
            user: e.user || '(you)',
        }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));

    return {
        total,
        sessionsCount,
        issuesTouched: issueMap.size,
        membersCount: memberMap.size,
        dailyBuckets,
        issueRows,
        memberRows,
        sessionLog,
    };
}

/**
 * Apply the (optional) member + issue filter sent by the webview.
 *
 * @template {{ user?: string, issueUrl: string }} T
 * @param {T[]} entries
 * @param {{ memberFilter?: string | null, issueFilter?: string | null }} filters
 * @returns {T[]}
 */
export function applyFilters(entries, { memberFilter, issueFilter } = {}) {
    return entries.filter((e) => {
        if (memberFilter && (e.user || '(you)') !== memberFilter) return false;
        if (issueFilter && e.issueUrl !== issueFilter) return false;
        return true;
    });
}
