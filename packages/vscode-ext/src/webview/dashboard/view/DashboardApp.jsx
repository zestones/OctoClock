// packages/vscode-ext/src/webview/dashboard/view/DashboardApp.jsx
//
// Top-level dashboard component — handles the message protocol with the
// host, manages local UI state (active tab, range, filters, selected
// member), and routes to the per-view renderers.

import { useEffect, useRef, useState } from 'preact/hooks';
import { useVscodeMessage } from '../../shared/hooks/useVscodeMessage.js';
import { IssuesView } from './IssuesView.jsx';
import { MemberDetailView } from './MemberDetailView.jsx';
import { MembersView } from './MembersView.jsx';
import { OverviewView } from './OverviewView.jsx';
import { SessionsView } from './SessionsView.jsx';
import { Topbar } from './Topbar.jsx';

// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();

/** @typedef {'overview' | 'issues' | 'members' | 'sessions'} TabId */

const TABS = /** @type {Array<{ id: TabId, label: string, icon: string }>} */ ([
    { id: 'overview', label: 'Overview', icon: 'graph' },
    { id: 'issues', label: 'Issues', icon: 'issues' },
    { id: 'members', label: 'Members', icon: 'organization' },
    { id: 'sessions', label: 'Sessions', icon: 'history' },
]);

export function DashboardApp() {
    const [activeTab, setActiveTab] = useState(/** @type {TabId} */('overview'));
    const [range, setRange] = useState(/** @type {'today'|'week'|'month'|'all'} */('week'));
    const [weekOffset, setWeekOffset] = useState(0);
    const [memberFilter, setMemberFilter] = useState(/** @type {string|null} */(null));
    const [issueFilter, setIssueFilter] = useState(/** @type {string|null} */(null));
    const [payload, setPayload] = useState(/** @type {any} */(null));
    const [windowRange, setWindowRange] = useState(
        /** @type {{ start: string|null, end: string|null }} */({ start: null, end: null }),
    );

    // Member drill-down state.
    const [selectedMember, setSelectedMember] = useState(/** @type {string|null} */(null));
    const [memberDetail, setMemberDetail] = useState(/** @type {any} */(null));
    const savedScrollRef = useRef(0);
    const contentRef = useRef(/** @type {HTMLDivElement|null} */(null));

    useEffect(() => {
        vscode.postMessage({ type: 'ready' });
    }, []);

    useVscodeMessage('init', (msg) => {
        setPayload(msg.payload);
        setWindowRange(msg.window);
        if (msg.range) setRange(msg.range);
        if (typeof msg.weekOffset === 'number') setWeekOffset(msg.weekOffset);
    });
    useVscodeMessage('data', (msg) => {
        setPayload(msg.payload);
        setWindowRange(msg.window);
    });
    useVscodeMessage('memberDetail', (msg) => {
        setMemberDetail(msg.payload);
    });

    /**
     * @param {{ range?: string, weekOffset?: number, memberFilter?: string|null, issueFilter?: string|null }} patch
     */
    const requestData = (patch) => {
        const next = {
            range: patch.range ?? range,
            weekOffset: patch.weekOffset ?? weekOffset,
            memberFilter: patch.memberFilter !== undefined ? patch.memberFilter : memberFilter,
            issueFilter: patch.issueFilter !== undefined ? patch.issueFilter : issueFilter,
        };
        if (patch.range !== undefined) setRange(/** @type {any} */(patch.range));
        if (patch.weekOffset !== undefined) setWeekOffset(patch.weekOffset);
        if (patch.memberFilter !== undefined) setMemberFilter(patch.memberFilter);
        if (patch.issueFilter !== undefined) setIssueFilter(patch.issueFilter);
        vscode.postMessage({ type: 'rangeChange', ...next });
    };

    /** @param {string} user */
    const openMember = (user) => {
        savedScrollRef.current = contentRef.current?.scrollTop ?? 0;
        setSelectedMember(user);
        setMemberDetail(null);
        vscode.postMessage({
            type: 'memberDrill',
            memberId: user,
            range,
            weekOffset,
            memberFilter,
            issueFilter,
        });
    };

    const closeMember = () => {
        setSelectedMember(null);
        setMemberDetail(null);
        // Restore scroll after the list re-mounts.
        requestAnimationFrame(() => {
            if (contentRef.current) contentRef.current.scrollTop = savedScrollRef.current;
        });
    };

    // Re-fetch member detail when the range or filters change while drilled in.
    useEffect(() => {
        if (!selectedMember) return;
        vscode.postMessage({
            type: 'memberDrill',
            memberId: selectedMember,
            range,
            weekOffset,
            memberFilter,
            issueFilter,
        });
    }, [range, weekOffset, memberFilter, issueFilter, selectedMember]);

    /** @param {TabId} t */
    const switchTab = (t) => {
        if (t !== 'members' && selectedMember) {
            setSelectedMember(null);
            setMemberDetail(null);
        }
        setActiveTab(t);
    };

    return (
        <div class="dash">
            <Topbar
                range={range}
                weekOffset={weekOffset}
                window={windowRange}
                onRangeChange={(r) => requestData({ range: r, weekOffset: 0 })}
                onWeekShift={(delta) => requestData({ range: 'week', weekOffset: weekOffset + delta })}
            />
            <div class="dash-tabs" role="tablist">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        class={`tab ${activeTab === t.id ? 'active' : ''}`}
                        aria-selected={activeTab === t.id}
                        onClick={() => switchTab(t.id)}
                    >
                        <i class={`codicon codicon-${t.icon}`} />
                        &nbsp;{t.label}
                    </button>
                ))}
            </div>
            <div class="dash-content" ref={contentRef}>
                {!payload ? (
                    <div class="empty-msg">Loading…</div>
                ) : activeTab === 'overview' ? (
                    <OverviewView payload={payload} />
                ) : activeTab === 'issues' ? (
                    <IssuesView payload={payload} />
                ) : activeTab === 'members' ? (
                    selectedMember ? (
                        <MemberDetailView detail={memberDetail} onBack={closeMember} />
                    ) : (
                        <MembersView payload={payload} onSelect={openMember} />
                    )
                ) : (
                    <SessionsView
                        payload={payload}
                        memberFilter={memberFilter}
                        issueFilter={issueFilter}
                        onFilterChange={(p) => requestData(p)}
                    />
                )}
            </div>
        </div>
    );
}
