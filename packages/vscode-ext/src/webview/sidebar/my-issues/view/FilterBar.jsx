// packages/vscode-ext/src/webview/sidebar/my-issues/view/FilterBar.jsx
//
// Search input + Open/Closed/All tab buttons.
// CSS classes defined in html.js.

import { useRef } from 'preact/hooks';

const TABS = /** @type {const} */ (['open', 'closed', 'all']);

/**
 * @param {{
 *   query: string,
 *   onQuery: (q: string) => void,
 *   tab: string,
 *   onTab: (t: string) => void,
 *   workspaceOnly: boolean,
 *   onToggleWorkspace: () => void,
 *   workspaceAvailable: boolean,
 * }} props
 */
export function FilterBar({ query, onQuery, tab, onTab, workspaceOnly, onToggleWorkspace, workspaceAvailable }) {
    const debounce = useRef(/** @type {ReturnType<typeof setTimeout>|null} */(null));

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
                placeholder="Filter by title or #id..."
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
            {workspaceAvailable && (
                <button
                    type="button"
                    class={`ws-chip${workspaceOnly ? ' on' : ''}`}
                    onClick={onToggleWorkspace}
                    aria-pressed={workspaceOnly}
                    title={
                        workspaceOnly
                            ? 'Showing only issues for repos in this workspace'
                            : 'Showing issues from every tracked repo'
                    }
                >
                    <i class="codicon codicon-filter" aria-hidden="true" />
                    &nbsp;{workspaceOnly ? 'Workspace only' : 'All repos'}
                </button>
            )}
        </div>
    );
}
