import { TimeService } from './time.utils.js';

export class AggregationService {
    static parseRepo(issueUrl) {
        const parts = issueUrl.split('/');
        return `${parts[1]}/${parts[2]}`;
    }

    static getTimePerRepo(trackedTimes) {
        const repoMap = {};
        for (const entry of trackedTimes) {
            const repo = AggregationService.parseRepo(entry.issueUrl);
            repoMap[repo] = (repoMap[repo] || 0) + entry.seconds;
        }
        return Object.entries(repoMap)
            .map(([repo, seconds]) => ({
                repo,
                seconds,
                formatted: TimeService.formatTime(seconds),
            }))
            .sort((a, b) => b.seconds - a.seconds);
    }

    static parseEntryTitle(title) {
        const parts = title.split(' | ');
        if (parts.length >= 3) {
            return { issueTitle: parts.slice(1, -1).join(' | '), issueNumber: parts[parts.length - 1] };
        }
        // Handle 2-part format from older syncs: "(owner) repo | #number"
        if (parts.length === 2) {
            const numPart = parts[1].trim();
            if (numPart.startsWith('#')) {
                return { issueTitle: '', issueNumber: numPart };
            }
        }
        return { issueTitle: title, issueNumber: '' };
    }

    static extractCleanTitle(storedTitle) {
        if (!storedTitle) return 'Untitled';
        const { issueTitle, issueNumber } = AggregationService.parseEntryTitle(storedTitle);
        return issueTitle || issueNumber || storedTitle;
    }

    static getRepoBreakdownDetailed(entries) {
        const repoMap = {};
        for (const entry of entries) {
            const repo = AggregationService.parseRepo(entry.issueUrl);
            if (!repoMap[repo]) repoMap[repo] = {};
            const issueKey = entry.issueUrl;
            if (!repoMap[repo][issueKey]) {
                const { issueTitle, issueNumber } = AggregationService.parseEntryTitle(entry.title || '');
                repoMap[repo][issueKey] = {
                    title: issueTitle || issueNumber || issueKey,
                    issueNumber,
                    sessions: [],
                    totalSeconds: 0,
                };
            }
            repoMap[repo][issueKey].totalSeconds += entry.seconds;
            repoMap[repo][issueKey].sessions.push({
                date: entry.date,
                seconds: entry.seconds,
                user: entry.user,
            });
        }
        return repoMap;
    }

    static filterByDateRange(trackedTimes, startDate, endDate) {
        return trackedTimes.filter((e) => e.date >= startDate && e.date <= endDate);
    }

    static getTotalSeconds(entries) {
        return entries.reduce((sum, e) => sum + (e.seconds || 0), 0);
    }

    static getTodayEntries(trackedTimes) {
        const today = TimeService.getLocalDateString();
        return trackedTimes.filter((e) => e.date === today);
    }

    static getWeekEntries(trackedTimes) {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const daysFromMonday = (dayOfWeek + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - daysFromMonday);
        const start = TimeService.getLocalDateString(startOfWeek);
        const end = TimeService.getLocalDateString(now);
        return AggregationService.filterByDateRange(trackedTimes, start, end);
    }

    static getMonthEntries(trackedTimes) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const start = TimeService.getLocalDateString(startOfMonth);
        const end = TimeService.getLocalDateString(now);
        return AggregationService.filterByDateRange(trackedTimes, start, end);
    }
}
