// content/index.js

import {
    CONTAINER_CHECK_INTERVAL_MS,
    CONTAINER_CHECK_MAX_ATTEMPTS,
    DEBOUNCE_INJECT_MS,
    STORAGE_KEYS,
} from '../utils/constants.utils.js';
import { isIssuePage } from './helpers.js';
import { injectTimerButton, resetInjectedFlag } from './injectTimerButton.js';

function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

const debouncedInjectTimerButton = debounce(injectTimerButton, DEBOUNCE_INJECT_MS);

function checkContainer(attempts = CONTAINER_CHECK_MAX_ATTEMPTS, delay = CONTAINER_CHECK_INTERVAL_MS) {
    const container = document.querySelector('[data-testid="issue-metadata-fixed"]');
    const buttonExists = document.querySelector('#track-time-btn');
    if (buttonExists) return;
    if (container || attempts <= 0) {
        debouncedInjectTimerButton();
        return;
    }
    setTimeout(() => checkContainer(attempts - 1, delay), delay);
}

// Initialize on load
if (isIssuePage()) {
    checkContainer();
}

// React to storage changes for timer state (replaces polling)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEYS.ACTIVE_ISSUE] || changes[STORAGE_KEYS.START_TIME]) {
        if (isIssuePage()) {
            const buttonExists = document.querySelector('#track-time-btn');
            if (!buttonExists) {
                checkContainer();
            }
        }
    }
});

// Detect SPA navigation via MutationObserver + popstate.
// No pushState monkey-patching — the MutationObserver fires when GitHub updates
// the DOM after any pushState call, catching the pathname change reliably without
// conflicting with other extensions or GitHub's own code.
let lastPathname = location.pathname;

function handleNavigation() {
    if (location.pathname === lastPathname) return;
    resetInjectedFlag();
    lastPathname = location.pathname;
    if (isIssuePage()) {
        checkContainer();
    }
}

const observer = new MutationObserver(() => {
    // SPA pathname change detection (cheap string comparison, checked first)
    if (location.pathname !== lastPathname) {
        handleNavigation();
        return;
    }

    // On issue pages, ensure button exists (debounced to avoid thrashing)
    if (isIssuePage()) {
        const buttonExists = document.querySelector('#track-time-btn');
        if (!buttonExists) {
            debouncedInjectTimerButton();
        }
    }
});
observer.observe(document.body, { childList: true, subtree: true });

// Back/forward navigation fires popstate
window.addEventListener('popstate', handleNavigation);

// Handle messages from popup/background for timer sync
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'timerStarted' || message.action === 'timerStopped') {
        if (isIssuePage() && message.issueUrl === location.pathname) {
            const buttonExists = document.querySelector('#track-time-btn');
            if (!buttonExists) {
                checkContainer(15, CONTAINER_CHECK_INTERVAL_MS);
            }
        }
        sendResponse({ received: true });
    }
});

// No 'unload' listener — it's unreliable in modern Chrome (bfcache skips it)
// and unnecessary: the observer and intervals are GC'd when the page is destroyed,
// and SPA navigation cleanup is handled by resetInjectedFlag() above.
