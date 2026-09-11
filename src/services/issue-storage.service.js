import { STORAGE_KEYS } from '../utils/constants.utils.js';
import { StorageService } from './storage.service.js';

const STORAGE_KEY = STORAGE_KEYS.ISSUES;

export class IssueStorageService {
    /** @returns {Promise<import('../utils/schema.utils.js').IssueEntry[]>} */
    static async getAll() {
        return (await StorageService.get(STORAGE_KEY)) ?? [];
    }

    /** @param {import('../utils/schema.utils.js').IssueEntry} issue */
    static async add(issue) {
        const issues = await IssueStorageService.getAll();
        const exists = issues.some((i) => i.url === issue.url);
        if (!exists) {
            issues.push(issue);
            await StorageService.set(STORAGE_KEY, issues);
        }
    }

    static async update(url, updates) {
        const issues = await IssueStorageService.getAll();
        const updated = issues.map((issue) => (issue.url === url ? { ...issue, ...updates } : issue));
        await StorageService.set(STORAGE_KEY, updated);
    }

    static async remove(url) {
        const issues = await IssueStorageService.getAll();
        const filtered = issues.filter((issue) => issue.url !== url);
        await StorageService.set(STORAGE_KEY, filtered);
    }

    static async removeAll() {
        await StorageService.remove(STORAGE_KEYS.ISSUES);
    }

    static async getByUrl(url) {
        const issues = await IssueStorageService.getAll();
        return issues.find((issue) => issue.url === url) || null;
    }

    static async exists(url) {
        const issues = await IssueStorageService.getAll();
        return issues.some((issue) => issue.url === url);
    }
}
