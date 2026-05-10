// packages/vscode-ext/src/webview/sidebar/my-issues/view/FilterBar.jsx
//
// Search input + Open/Closed/All tab buttons.
// CSS classes defined in html.js.

import { h } from 'preact';
import { useRef } from 'preact/hooks';

const TABS = /** @type {const} */ (['open', 'closed', 'all']);

/**
 * @param {{
 *   query: string,
 *   onQuery: (q: string) => void,
 *   tab: string,
 *   onTab: (t: string) => void,
 * }} props
 */
export function FilterBar({ query, onQuery, tab, onTab }) {
    const debounce = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null));

    const handleInput = (/** @type {Event} */ e) => {
        const value = /** @type {HTMLInputElement} */ (e.target).value;
        if (debounce.current) clearTimeout(debounce.current);
        debounce.current = setTimeout(() => onQuery(value), 120);
    };

    return (
        <div class="filter-bar">
            <input
                class="filter-input"
                type="text"
                placeholder="Filter by title or #id\u2026"
                autocomplete="off"
                aria-label="Filter issues by title or number"
                value={query}
                onInput={handleInput}
            />
            <div class="filter-tabs" role="tablist" aria-label="Issue state filter">
                {TABS.map((t) => (
                    <button
                        key={t}
                        type="button"
                        class={`ftab${tab === t ? ' on' : ''}`}
                        role="tab"
                        aria-selected={tab === t}
                        onClick={() => onTab(t)}
                    >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>
        </div>
    );
}
