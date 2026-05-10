// packages/vscode-ext/src/webview/sidebar/my-issues/view/BranchRow.jsx
//
// Branch suggestion row — shown when the git extension detects a branch
// whose name contains a number matching a tracked issue.
//
// CSS classes defined in html.js.

import { h } from 'preact';

/**
 * @param {{
 *   branch: { issueId: number, branch: string, url: string, title: string },
 *   timerRunning: boolean,
 *   activeIssueId: number|null,
 *   onTrack: (url: string) => void,
 * }} props
 */
export function BranchRow({ branch, timerRunning, activeIssueId, onTrack }) {
    const tracking = timerRunning && branch.issueId === activeIssueId;
    return (
        <div class="row h28 branch-row">
            <i class="codicon codicon-git-branch row-icon" style="color:var(--oc-branch)" aria-hidden="true" />
            <span class="bpill">{branch.branch}</span>
            <span class="row-lbl" style="color:var(--oc-desc);font-size:12px">
                {`#${branch.issueId} ${branch.title}`}
            </span>
            <button
                type="button"
                class="btn-track"
                disabled={tracking}
                aria-label={
                    tracking
                        ? `Already tracking issue #${branch.issueId}`
                        : `Track issue #${branch.issueId} for branch ${branch.branch}`
                }
                onClick={() => !tracking && onTrack(branch.url)}
            >
                <i class={tracking ? 'codicon codicon-clock' : 'codicon codicon-play'} aria-hidden="true" />
                &nbsp;{tracking ? 'Tracking' : 'Track'}
            </button>
        </div>
    );
}
