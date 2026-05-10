// packages/vscode-ext/src/webview/sidebar/my-issues/view/MyIssuesPanel.jsx
//
// Root component for the My Issues sidebar panel.
//
// Coordinates:
//   - issues list + filter state (query, statusTab)
//   - timer state (running, activeIssueId)
//   - branch suggestion row
//
// All host communication goes through useVscodeMessage.
// CSS classes are defined in html.js's <style nonce> block.

import { h } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { useVscodeMessage } from '../../../shared/hooks/useVscodeMessage.js';
import { BranchRow } from './BranchRow.jsx';
import { FilterBar } from './FilterBar.jsx';
import { IssueList } from './IssueList.jsx';

// acquireVsCodeApi is injected by VS Code into every webview context.
// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();

export function MyIssuesPanel() {
    const [issues, setIssues] = useState(/** @type {any[]} */ ([]));
    const [query, setQuery] = useState('');
    const [statusTab, setStatusTab] = useState('open');
    const [timerRunning, setTimerRunning] = useState(false);
    const [activeIssueId, setActiveIssueId] = useState(/** @type {number|null} */ (null));
    const [branch, setBranch] = useState(
        /** @type {{ issueId: number, branch: string, url: string, title: string }|null} */ (null),
    );

    useVscodeMessage('issues', (msg) => setIssues(msg.items));

    useVscodeMessage('timerState', (msg) => {
        setTimerRunning(msg.running);
        setActiveIssueId(msg.activeIssueId);
    });

    useVscodeMessage('branchSuggestion', (msg) => {
        const issue = issues.find((i) => i.id === msg.issueId);
        if (!issue) {
            setBranch(null);
            return;
        }
        setBranch({ issueId: msg.issueId, branch: msg.branch, url: issue.url, title: issue.title });
    });

    const onStartTimer = useCallback((url) => {
        vscode.postMessage({ type: 'startTimer', url });
    }, []);

    const onStopTimer = useCallback(() => {
        vscode.postMessage({ type: 'stopTimer' });
    }, []);

    const onOpenUrl = useCallback((url) => {
        vscode.postMessage({ type: 'openUrl', url });
    }, []);

    // Send 'ready' once on mount so the host delivers initial issues + timer state.
    useEffect(() => {
        vscode.postMessage({ type: 'ready' });
    }, []);

    return (
        <div>
            {branch && (
                <BranchRow
                    branch={branch}
                    timerRunning={timerRunning}
                    activeIssueId={activeIssueId}
                    onTrack={onStartTimer}
                />
            )}
            <FilterBar query={query} onQuery={setQuery} tab={statusTab} onTab={setStatusTab} />
            <IssueList
                issues={issues}
                query={query}
                statusTab={statusTab}
                timerRunning={timerRunning}
                activeIssueId={activeIssueId}
                onStart={onStartTimer}
                onStop={onStopTimer}
                onOpen={onOpenUrl}
            />
        </div>
    );
}
