import { useEffect, useState } from 'preact/hooks';
import { ActiveTimer } from '../components/ActiveTimer.jsx';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { Modal } from '../components/Modal.jsx';
import { Settings } from '../components/Settings.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useStorageListener } from '../hooks/useStorageListener.js';
import { useTheme } from '../hooks/useTheme.js';
import { useUIState } from '../hooks/useUIState.js';
import { IconCalendar, IconChart, IconIssues, IconSettings } from '../icons.jsx';
import { IssueStorageService } from '../services/issue-storage.service.js';
import { StorageService } from '../services/storage.service.js';
import { syncFromGitHub } from '../services/sync.service.js';
import { STORAGE_KEYS } from '../utils/constants.utils.js';
import { CalendarView } from './views/CalendarView.jsx';
import { IssuesTab } from './views/IssuesTab.jsx';
import { StatsTab } from './views/StatsTab.jsx';
import './App.css';

export function App() {
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const { page, setPage, issuesFilter, setIssuesFilter, loaded } = useUIState();
    const tracked = useStorageListener(STORAGE_KEYS.TRACKED_TIMES, []);
    const { theme, isDark, setTheme } = useTheme();
    const {
        token,
        maskedToken,
        user,
        tokenLoaded,
        tokenInput,
        tokenError,
        setTokenInput,
        saveToken,
        handleTokenChange,
    } = useAuth();

    // Auto-sync on popup open when enabled
    useEffect(() => {
        if (!token) return;
        StorageService.get(STORAGE_KEYS.AUTO_SYNC).then((autoSync) => {
            if (autoSync) {
                syncFromGitHub().catch((e) => console.error('Auto-sync failed:', e));
            }
        });
    }, [token]);

    const confirmClear = async () => {
        await StorageService.remove(STORAGE_KEYS.TRACKED_TIMES);
        await StorageService.remove(STORAGE_KEYS.EVERYONE_DATA);
        await IssueStorageService.removeAll();
        setShowClearConfirm(false);
    };

    if (!tokenLoaded || !loaded)
        return (
            <div
                className={`w-100 h-140 flex items-center justify-center font-['Inter',system-ui,sans-serif] bg-base ${isDark ? 'dark' : ''}`}
            >
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-[12px] text-muted">Loading…</span>
                </div>
            </div>
        );

    if (!token) {
        return (
            <div
                className={`w-100 h-140 flex flex-col items-center justify-center px-10 font-['Inter',system-ui,sans-serif] bg-base ${isDark ? 'dark' : ''}`}
            >
                <div className="mb-1">
                    <img src="/icons/favicon.png" alt="OctoClock" className="w-26 h-26" />
                </div>
                <h1 className="text-xl mb-0.5" style={{ fontFamily: "'Saira Stencil One', cursive" }}>
                    <span style={{ color: 'var(--th-brand-octo)' }}>Octo</span>
                    <span style={{ color: 'var(--th-brand-clock)' }}>Clock</span>
                </h1>
                <p
                    className="text-[11px] text-tertiary tracking-wide mb-1"
                    style={{ fontFamily: "'Saira Condensed', sans-serif" }}
                >
                    GitHub Time Tracker
                </p>
                <p className="text-[13px] text-tertiary text-center mb-8 leading-relaxed">
                    Track time spent on GitHub issues
                    <br />
                    directly from your browser.
                </p>
                <div className="w-full">
                    <input
                        type="password"
                        value={tokenInput}
                        onInput={(e) => setTokenInput(e.currentTarget.value)}
                        placeholder="GitHub Personal Access Token"
                        className="w-full px-3.5 py-2.5 text-[13px] bg-surface border border-border-default rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary placeholder:text-muted mb-2"
                    />
                    {tokenError && <p className="text-[11px] text-danger-text mb-2">{tokenError}</p>}
                    <button
                        type="button"
                        onClick={saveToken}
                        className="w-full bg-accent hover:bg-accent-hover text-white text-[13px] font-medium py-2.5 rounded-lg cursor-pointer transition-colors"
                    >
                        Connect
                    </button>
                </div>
                <p className="text-[11px] text-muted mt-6 text-center">
                    Requires a token with <span className="font-medium text-tertiary">repo</span> scope.
                </p>
            </div>
        );
    }

    const navItems = [
        { id: 'issues', icon: IconIssues, label: 'Issues' },
        { id: 'stats', icon: IconChart, label: 'Stats' },
        { id: 'calendar', icon: IconCalendar, label: 'Calendar' },
        { id: 'settings', icon: IconSettings, label: 'Settings' },
    ];

    return (
        <div
            className={`w-100 h-140 flex flex-col font-['Inter',system-ui,sans-serif] bg-base overflow-hidden ${isDark ? 'dark' : ''}`}
        >
            {/* Header */}
            <header className="flex items-center justify-between px-4 h-11 border-b border-border-subtle shrink-0">
                <div className="flex items-center gap-1.5">
                    <img src="/icons/favicon.png" alt="OctoClock" className="w-8 h-8" />
                    <div className="flex items-baseline gap-1.5">
                        <h1
                            className="text-[16px] tracking-tight"
                            style={{ fontFamily: "'Saira Stencil One', cursive" }}
                        >
                            <span style={{ color: 'var(--th-brand-octo)' }}>Octo</span>
                            <span style={{ color: 'var(--th-brand-clock)' }}>Clock</span>
                        </h1>
                    </div>
                </div>
                {user?.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt={user.login}
                        title={user.login}
                        className="w-6 h-6 rounded-full ring-1 ring-ring-default"
                    />
                ) : (
                    <div className="w-6 h-6 rounded-full bg-surface" />
                )}
            </header>

            {/* Active Timer Banner */}
            <ActiveTimer />

            {/* Page Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <ErrorBoundary>
                    {page === 'issues' && <IssuesTab filter={issuesFilter} onFilterChange={setIssuesFilter} />}
                    <div className={`flex-1 overflow-y-auto popup-scroll pb-14 ${page === 'issues' ? 'hidden' : ''}`}>
                        {page === 'stats' && <StatsTab tracked={tracked} user={user} />}
                        {page === 'calendar' && <CalendarView tracked={tracked} />}
                        {page === 'settings' && (
                            <Settings
                                token={token}
                                maskedToken={maskedToken}
                                user={user}
                                onTokenChange={handleTokenChange}
                                onClearData={() => setShowClearConfirm(true)}
                                theme={theme}
                                onThemeChange={setTheme}
                            />
                        )}
                    </div>
                </ErrorBoundary>
            </main>

            {/* Bottom Navigation — floating over content */}
            <div className="relative shrink-0 pointer-events-none">
                <nav className="absolute bottom-2 left-4 right-4 pointer-events-auto">
                    <div className="relative flex items-center bg-surface/80 backdrop-blur-md rounded-2xl p-1 shadow-lg border border-border-subtle">
                        <div
                            className="absolute top-1 bottom-1 rounded-xl bg-accent shadow-md pointer-events-none"
                            style={{
                                left: '4px',
                                width: 'calc(25% - 2px)',
                                transform: `translateX(${navItems.findIndex((n) => n.id === page) * 100}%)`,
                                transition: 'transform 200ms ease-out',
                            }}
                        />
                        {navItems.map(({ id, icon: Icon, label }) => {
                            const active = page === id;
                            return (
                                <button
                                    type="button"
                                    key={id}
                                    onClick={() => setPage(id)}
                                    className={`relative z-10 flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl cursor-pointer transition-colors duration-200 ${
                                        active ? 'text-white' : 'text-muted hover:text-primary'
                                    }`}
                                >
                                    <Icon size={16} strokeWidth={active ? 2.5 : 1.75} />
                                    <span className={`text-[9px] ${active ? 'font-bold' : 'font-medium'}`}>
                                        {label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </nav>
            </div>

            {showClearConfirm && (
                <Modal
                    title="Clear all data"
                    message="This will permanently delete all tracked times and issue data. This action cannot be undone."
                    confirmLabel="Clear Data"
                    confirmVariant="danger"
                    onConfirm={confirmClear}
                    onCancel={() => setShowClearConfirm(false)}
                />
            )}
        </div>
    );
}
