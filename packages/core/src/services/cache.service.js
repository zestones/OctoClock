import { CACHE_PREFIX, CACHE_TTL, USER_CACHE_TTL } from '../utils/constants.utils.js';
import { StorageService } from './storage.service.js';

export class CacheService {
    static async get(key) {
        const cached = await StorageService.get(`${CACHE_PREFIX}${key}`);
        if (!cached) return null;
        if (Date.now() - cached.fetchedAt > (cached.ttl || CACHE_TTL)) return null;
        return cached.data;
    }

    static async set(key, data, ttl = CACHE_TTL) {
        await StorageService.set(`${CACHE_PREFIX}${key}`, {
            data,
            fetchedAt: Date.now(),
            ttl,
        });
    }

    static async invalidate(key) {
        await StorageService.remove(`${CACHE_PREFIX}${key}`);
    }

    /** @returns {Promise<import('../utils/schema.utils.js').CachedUser|null>} */
    static async getCachedUser() {
        return CacheService.get('user');
    }

    /** @param {import('../utils/schema.utils.js').CachedUser} user */
    static async setCachedUser(user) {
        await CacheService.set('user', user, USER_CACHE_TTL);
    }

    /** @param {string} fullName @returns {Promise<import('../utils/schema.utils.js').SimplifiedIssue[]|null>} */
    static async getCachedIssues(fullName) {
        return CacheService.get(`issues:${fullName}`);
    }

    /** @param {string} fullName @param {import('../utils/schema.utils.js').SimplifiedIssue[]} issues */
    static async setCachedIssues(fullName, issues) {
        await CacheService.set(`issues:${fullName}`, issues);
    }
}
