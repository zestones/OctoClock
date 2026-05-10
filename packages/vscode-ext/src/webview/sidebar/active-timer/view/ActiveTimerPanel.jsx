// packages/vscode-ext/src/webview/sidebar/active-timer/view/ActiveTimerPanel.jsx
//
// Root component for the Active Timer sidebar panel.
//
// Receives timerUpdate messages from the host and renders:
//   - A running row (dot + repo + issue + elapsed timer + stop button)
//   - An idle row ("No active timer — start from My Issues")
//
// CSS classes are defined in html.js's <style nonce> block so they pass CSP.

import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useVscodeMessage } from '../../../shared/hooks/useVscodeMessage.js';

// acquireVsCodeApi is injected by VS Code into every webview context.
// Called once at module scope — calling it twice throws.
// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();

/**
 * @param {number} totalSeconds
 * @returns {string}
 */
function fmtTimer(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

export function ActiveTimerPanel() {
    const [running, setRunning] = useState(false);
    const [issueNumber, setIssueNumber] = useState('?');
    const [repo, setRepo] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const startTimeRef = useRef(/** @type {number|null} */ (null));

    useVscodeMessage('timerUpdate', (msg) => {
        const p = msg.payload;
        setRunning(p.running);
        setIssueNumber(p.issueNumber || '?');
        setRepo(p.repo || '');
        if (p.running && p.startTime) {
            startTimeRef.current = new Date(p.startTime).getTime();
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        } else {
            startTimeRef.current = null;
            setElapsed(0);
        }
    });

    // Tick the elapsed counter every second while running.
    useEffect(() => {
        if (!running) return;
        const id = setInterval(() => {
            if (startTimeRef.current !== null) {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }
        }, 1000);
        return () => clearInterval(id);
    }, [running]);

    if (running) {
        const counter = fmtTimer(elapsed);
        const ariaSummary = `Tracking ${repo ? `${repo} ` : ''}#${issueNumber}, elapsed ${counter}`;
        return (
            <div class="row timer-row h28" role="status" aria-live="polite" aria-label={ariaSummary}>
                <span class="dot pulse" aria-hidden="true" />
                <i class="codicon codicon-repo row-icon icon-desc" aria-hidden="true" />
                <span class="row-lbl">
                    <span class="dim-fg">{repo}</span>
                    &nbsp;&rsaquo;&nbsp;
                    <span>{`#${issueNumber}`}</span>
                </span>
                <span class="timer" aria-hidden="true">
                    {counter}
                </span>
                <div class="row-always">
                    <button
                        type="button"
                        class="btn-stop"
                        aria-label={`Stop timer for #${issueNumber}`}
                        onClick={() => vscode.postMessage({ type: 'stop' })}
                    >
                        <i class="codicon codicon-debug-stop" aria-hidden="true" />
                        &nbsp;Stop
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div class="row" role="status" aria-live="polite">
            <i class="codicon codicon-clock row-icon icon-muted" aria-hidden="true" />
            <span class="row-lbl dim">No active timer &mdash; start from My Issues</span>
        </div>
    );
}
