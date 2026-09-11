import { useEffect, useRef, useState } from 'preact/hooks';
import { StorageService } from '../services/storage.service.js';

export function useStorageListener(key, initialValue = null) {
    const [data, setData] = useState(initialValue);
    const initialRef = useRef(initialValue);

    useEffect(() => {
        const fetchData = async () => {
            const value = (await StorageService.get(key)) ?? initialRef.current;
            setData(value);
        };

        fetchData();

        const listener = (changes, area) => {
            if (area === 'local' && changes[key]) {
                setData(changes[key].newValue ?? initialRef.current);
            }
        };
        chrome.storage.onChanged.addListener(listener);

        return () => chrome.storage.onChanged.removeListener(listener);
    }, [key]);

    return data;
}
