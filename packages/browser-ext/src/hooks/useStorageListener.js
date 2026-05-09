import { useEffect, useRef, useState } from 'preact/hooks';
import { StorageService } from '../../../core/src/services/storage.service.js';
import { storageEvents } from '../../../core/src/services/storage-events.js';

/**
 * @param {string} key
 * @param {any} [initialValue]
 * @param {import('../../../core/src/ports/storage-events.port.js').StorageEventsPort} [eventsPort]
 */
export function useStorageListener(key, initialValue = null, eventsPort = storageEvents) {
    const [data, setData] = useState(initialValue);
    const initialRef = useRef(initialValue);

    useEffect(() => {
        const fetchData = async () => {
            const value = (await StorageService.get(key)) ?? initialRef.current;
            setData(value);
        };

        fetchData();

        const unsubscribe = eventsPort.subscribe((event) => {
            if (event.type === 'set' && event.key === key) {
                setData(event.value ?? initialRef.current);
            } else if (event.type === 'remove' && event.key === key) {
                setData(initialRef.current);
            } else if (event.type === 'removeMultiple' && event.keys.includes(key)) {
                setData(initialRef.current);
            }
        });

        return unsubscribe;
    }, [key, eventsPort]);

    return data;
}
