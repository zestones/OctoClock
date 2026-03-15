### 1. **Repo expand/collapse — no animation**
The issues list appears/disappears instantly when toggling a repo. Adding a slide-down transition would feel much smoother.

### 2. **IssueRow external link icon — broken hover target**
In IssueRow.jsx, the `IconExternalLink` uses `group-hover/link:opacity-60`, but the `group/link` class is on the `<a>` tag — the icon is a sibling outside the `<a>`, so it never shows on hover. It should either be inside the `<a>` or use the parent `group` hover.

### 3. **No empty state illustration for search "no results"**
The "No issues found" text at IssuesTab.jsx is plain text. An icon (e.g., a search icon with a slash) would make it feel more polished.

### 4. **Start button only visible on hover — no affordance on touch/small screens**
The Start button in IssueRow.jsx has `opacity-0 group-hover:opacity-100`. In a Chrome extension popup there's always a cursor, but this hides the main CTA. Consider a subtle always-visible state (e.g., `opacity-40 group-hover:opacity-100`).

### 5. **Active timer issue in the list lacks visual prominence**
When an issue is actively being timed, the green tint is subtle (`bg-success-subtle/40`). A left accent bar or pulsing border would draw the eye faster.

### 6. **Segmented filter — no transition on pill movement**
Switching between Open/Assigned/Created/Closed snaps instantly. A sliding highlight indicator (like iOS segmented controls) would feel premium.

### 7. **Repo header — chevron rotation transition missing `duration`**
The chevron at IssuesTab.jsx uses inline `transform` but no CSS transition. It should rotate smoothly.

### 8. **Bottom padding missing for floating nav**
Content scrolls under the floating nav bar but there's no bottom padding on the scroll container, so the last items get hidden behind the nav without ability to scroll past.

### 10. **No loading skeleton for repos**
When repos load, there's only a spinner. Skeleton placeholders (gray pulsing bars) would prevent layout shift and feel more modern.

### 11. **Issue count badge overlaps when 3+ digits**
The `px-1.5` on the count badge could clip for numbers like `100+`. Using `min-w-5` or `tabular-nums` would stabilize it.

### 12. **Search input — no clear button**
When searching, there's no "X" to quickly clear the search field. Adding a clear icon that appears when the field has a value is expected UX.
