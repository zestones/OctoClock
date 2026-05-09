import { STORAGE_KEYS } from '../utils/constants.utils.js';
import { StorageService } from './storage.service.js';

const GITHUB_TOKEN_PATTERN = /^(ghp_[a-zA-Z0-9]{36,251}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}|[0-9a-f]{40})$/;

export class GitHubStorageService {
    static isValidTokenFormat(token) {
        return typeof token === 'string' && GITHUB_TOKEN_PATTERN.test(token);
    }

    static async getGitHubToken() {
        const token = await StorageService.get(STORAGE_KEYS.GITHUB_TOKEN);
        if (token && !GitHubStorageService.isValidTokenFormat(token)) {
            console.warn('Stored GitHub token has unexpected format');
            return null;
        }
        return token;
    }

    static async setGitHubToken(token) {
        if (!GitHubStorageService.isValidTokenFormat(token)) {
            throw new Error('Invalid GitHub token format');
        }
        return StorageService.set(STORAGE_KEYS.GITHUB_TOKEN, token);
    }

    static async removeGitHubToken() {
        return StorageService.remove(STORAGE_KEYS.GITHUB_TOKEN);
    }

    static async validateGitHubToken(token) {
        if (!GitHubStorageService.isValidTokenFormat(token)) return false;
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: { Authorization: `token ${token}` },
            });
            return response.ok;
        } catch (error) {
            console.error('Token validation failed:', error);
            return false;
        }
    }
}
