import { useCallback, useEffect, useState } from 'preact/hooks';
import { StorageService } from '../services/storage.service.js';
import { STORAGE_KEYS } from '../utils/constants.utils.js';

export function useTheme() {
    const [preference, setPreference] = useState('system');
    const [systemDark, setSystemDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

    useEffect(() => {
        StorageService.get(STORAGE_KEYS.THEME).then((saved) => {
            if (saved) setPreference(saved);
        });
    }, []);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => setSystemDark(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const isDark = preference === 'dark' || (preference === 'system' && systemDark);

    const setTheme = useCallback(async (newTheme) => {
        setPreference(newTheme);
        await StorageService.set(STORAGE_KEYS.THEME, newTheme);
    }, []);

    return { theme: preference, isDark, setTheme };
}
