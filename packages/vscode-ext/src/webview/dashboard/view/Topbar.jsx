// packages/vscode-ext/src/webview/dashboard/view/Topbar.jsx
//
// Range pills (Today / Week / Month / All) + week navigation arrows.
// Matches the prototype topbar (index.html L2491–L2510).

const RANGES = /** @type {Array<{ id: 'today'|'week'|'month'|'all', label: string }>} */ ([
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'all', label: 'All time' },
]);

/**
 * @param {{
 *   range: 'today'|'week'|'month'|'all',
 *   weekOffset: number,
 *   window: { start: string|null, end: string|null },
 *   onRangeChange: (r: 'today'|'week'|'month'|'all') => void,
 *   onWeekShift: (delta: number) => void,
 * }} props
 */
export function Topbar({ range, weekOffset, window: w, onRangeChange, onWeekShift }) {
    const isWeek = range === 'week';
    const label = w.start && w.end ? (w.start === w.end ? w.start : `${w.start} → ${w.end}`) : 'all time';

    return (
        <div class="dash-topbar">
            <span class="dash-title">
                <i class="codicon codicon-dashboard" />
                &nbsp;OctoClock Dashboard
            </span>
            <div class="pills" role="tablist">
                {RANGES.map((r) => (
                    <button
                        key={r.id}
                        type="button"
                        class={`pill ${range === r.id ? 'active' : ''}`}
                        onClick={() => onRangeChange(r.id)}
                    >
                        {r.label}
                    </button>
                ))}
            </div>
            <div class="week-nav">
                <button type="button" onClick={() => onWeekShift(-1)} disabled={!isWeek} aria-label="Previous week">
                    &larr;
                </button>
                <span class="label">{label}</span>
                <button
                    type="button"
                    onClick={() => onWeekShift(1)}
                    disabled={!isWeek || weekOffset >= 0}
                    aria-label="Next week"
                >
                    &rarr;
                </button>
            </div>
        </div>
    );
}
