import { useCallback, useEffect, useState } from 'preact/hooks';
import { CacheService } from '../services/cache.service.js';
import { GitHubService } from '../services/github.service.js';
import { GitHubStorageService } from '../services/github-storage.service.js';

export function useAuth() {
    const [token, setToken] = useState('');
    const [maskedToken, setMaskedToken] = useState('no token');
    const [tokenLoaded, setTokenLoaded] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [tokenError, setTokenError] = useState('');
    const [user, setUser] = useState(null);

    useEffect(() => {
        const loadToken = async () => {
            const savedToken = await GitHubStorageService.getGitHubToken();
            if (savedToken) {
                setToken(savedToken);
                setMaskedToken(`${savedToken.slice(0, 4)}••••••••`);

                const cachedUser = await CacheService.getCachedUser();
                if (cachedUser) {
                    setUser(cachedUser);
                } else {
                    try {
                        const userData = await GitHubService.getUser();
                        const userInfo = {
                            login: userData.login,
                            avatar_url: userData.avatar_url,
                            name: userData.name,
                        };
                        await CacheService.setCachedUser(userInfo);
                        setUser(userInfo);
                    } catch (e) {
                        console.error('Failed to fetch user:', e);
                    }
                }
            }
            setTokenLoaded(true);
        };
        loadToken();
    }, []);

    const handleTokenChange = useCallback((newToken) => {
        setToken(newToken);
        if (newToken) {
            setMaskedToken(`${newToken.slice(0, 4)}••••••••`);
            GitHubService.getUser()
                .then(async (userData) => {
                    const userInfo = { login: userData.login, avatar_url: userData.avatar_url, name: userData.name };
                    await CacheService.setCachedUser(userInfo);
                    setUser(userInfo);
                })
                .catch(() => setUser(null));
        } else {
            setMaskedToken('no token');
            setUser(null);
        }
    }, []);

    const saveToken = useCallback(async () => {
        const isValid = await GitHubStorageService.validateGitHubToken(tokenInput);
        if (isValid) {
            await GitHubStorageService.setGitHubToken(tokenInput);
            handleTokenChange(tokenInput);
            setTokenInput('');
            setTokenError('');
        } else {
            setTokenError('Invalid token. Please check and try again.');
        }
    }, [tokenInput, handleTokenChange]);

    return {
        token,
        maskedToken,
        user,
        tokenLoaded,
        tokenInput,
        tokenError,
        setTokenInput,
        saveToken,
        handleTokenChange,
    };
}
