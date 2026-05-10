// packages/vscode-ext/src/webview/shared/hooks/useVscodeMessage.js
//
// Subscribes to VS Code webview `message` events and calls the handler
// whenever a message of the given type arrives.
//
// Usage:
//   useVscodeMessage('timerState', (msg) => setState(msg));
//
// The handler is stable across renders — no need to memoize at the call site.

import { useEffect, useRef } from 'preact/hooks';

/**
 * @template T
 * @param {string} type - The message type to listen for.
 * @param {(message: T) => void} handler - Called for every matching message.
 */
export function useVscodeMessage(type, handler) {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        const listener = (/** @type {MessageEvent} */ event) => {
            if (event.data?.type === type) {
                handlerRef.current(event.data);
            }
        };
        window.addEventListener('message', listener);
        return () => window.removeEventListener('message', listener);
    }, [type]);
}
