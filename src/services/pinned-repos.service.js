import { STORAGE_KEYS } from '../utils/constants.utils.js';
import { CacheService } from './cache.service.js';
import { StorageService } from './storage.service.js';

export class PinnedReposService {
    /** @returns {Promise<import('../utils/schema.utils.js').PinnedRepo[]>} */
    static async getPinnedRepos() {
        return (await StorageService.get(STORAGE_KEYS.PINNED_REPOS)) ?? [];
    }

    /** @param {import('../utils/schema.utils.js').PinnedRepo} repo */
    static async addPinnedRepo(repo) {
        const repos = await PinnedReposService.getPinnedRepos();
        if (repos.some((r) => r.fullName === repo.fullName)) return;
        repos.push(repo);
        await StorageService.set(STORAGE_KEYS.PINNED_REPOS, repos);
    }

    static async removePinnedRepo(fullName) {
        const repos = await PinnedReposService.getPinnedRepos();
        const filtered = repos.filter((r) => r.fullName !== fullName);
        await StorageService.set(STORAGE_KEYS.PINNED_REPOS, filtered);
        await CacheService.invalidate(`issues:${fullName}`);
    }
}
