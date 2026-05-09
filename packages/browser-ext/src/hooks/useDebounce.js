import { useCallback, useEffect, useRef } from 'preact/hooks';

export function useDebounce(callback, delay) {
    const timerRef = useRef(null);
    const callbackRef = useRef(callback);

    callbackRef.current = callback;

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return useCallback(
        (...args) => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
        },
        [delay],
    );
}
