import { useCallback, useEffect, useState } from 'preact/hooks';
import { StorageService } from '../services/storage.service.js';
import { STORAGE_KEYS } from '../utils/constants.utils.js';

const VALID_PAGES = ['issues', 'stats', 'calendar', 'settings'];
const VALID_FILTERS = ['open', 'assigned', 'created', 'closed'];

const DEFAULT_PAGE = 'issues';
const DEFAULT_FILTER = 'open';

export function useUIState() {
    const [page, setPageState] = useState(DEFAULT_PAGE);
    const [issuesFilter, setIssuesFilterState] = useState(DEFAULT_FILTER);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const load = async () => {
            const { lastPage, issuesFilter: savedFilter } = await StorageService.getMultiple([
                STORAGE_KEYS.LAST_PAGE,
                STORAGE_KEYS.ISSUES_FILTER,
            ]);
            if (VALID_PAGES.includes(lastPage)) setPageState(lastPage);
            if (VALID_FILTERS.includes(savedFilter)) setIssuesFilterState(savedFilter);
            setLoaded(true);
        };
        load();
    }, []);

    const setPage = useCallback((newPage) => {
        setPageState(newPage);
        StorageService.set(STORAGE_KEYS.LAST_PAGE, newPage);
    }, []);

    const setIssuesFilter = useCallback((newFilter) => {
        setIssuesFilterState(newFilter);
        StorageService.set(STORAGE_KEYS.ISSUES_FILTER, newFilter);
    }, []);

    return { page, setPage, issuesFilter, setIssuesFilter, loaded };
}
