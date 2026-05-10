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
import { useState, useEffect, useRef } from 'preact/hooks';
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
    const startTimeRef = useRef(/** @type {number|null} */(null));

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
        return (
            <div class="row timer-row h28">
                <span class="dot pulse" />
                <i class="codicon codicon-repo row-icon icon-desc" />
                <span class="row-lbl">
                    <span class="dim-fg">{repo}</span>
                    &nbsp;&rsaquo;&nbsp;
                    <span>{'#' + issueNumber}</span>
                </span>
                <span class="timer">{fmtTimer(elapsed)}</span>
                <div class="row-always">
                    <button
                        type="button"
                        class="btn-stop"
                        onClick={() => vscode.postMessage({ type: 'stop' })}
                    >
                        <i class="codicon codicon-debug-stop" />
                        &nbsp;Stop
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div class="row">
            <i class="codicon codicon-clock row-icon icon-muted" />
            <span class="row-lbl dim">No active timer &mdash; start from My Issues</span>
        </div>
    );
}
