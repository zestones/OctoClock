import { useEffect, useState } from 'preact/hooks';
import { GitHubService } from '../../packages/core/src/services/github.service.js';
import { GitHubStorageService } from '../../packages/core/src/services/github-storage.service.js';
import { StorageService } from '../../packages/core/src/services/storage.service.js';
import { syncFromGitHub } from '../../packages/core/src/services/sync.service.js';
import { STORAGE_KEYS } from '../../packages/core/src/utils/constants.utils.js';
import { IconDownload, IconMonitor, IconMoon, IconRefresh, IconSun, IconTrash } from '../icons.jsx';

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function sanitizeCSVCell(value) {
    let str = String(value);
    if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
    }
    return str.replace(/"/g, '""');
}

function exportCSV(tracked) {
    const header = 'Issue URL,Title,Seconds,Date\n';
    const rows = tracked
        .map((e) => {
            const url = `https://github.com${e.issueUrl}`;
            const title = sanitizeCSVCell(e.title || '');
            return `"${sanitizeCSVCell(url)}","${title}",${e.seconds},"${sanitizeCSVCell(e.date)}"`;
        })
        .join('\n');
    downloadFile(header + rows, `timetracker-export-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
}

function exportJSON(tracked) {
    const json = JSON.stringify(tracked, null, 2);
    downloadFile(json, `timetracker-export-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
}

export function Settings({ token, maskedToken, user, onTokenChange, onClearData, theme, onThemeChange }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [tokenStatus, setTokenStatus] = useState(null);
    const [syncStatus, setSyncStatus] = useState(null);
    const [autoSync, setAutoSync] = useState(false);
    const [rateLimit, setRateLimit] = useState(null);

    useEffect(() => {
        StorageService.get(STORAGE_KEYS.AUTO_SYNC).then((v) => setAutoSync(!!v));
        if (token) {
            GitHubService.getRateLimit()
                .then(setRateLimit)
                .catch(() => setRateLimit(null));
        }
    }, [token]);

    const toggleAutoSync = async () => {
        const newValue = !autoSync;
        setAutoSync(newValue);
        await StorageService.set(STORAGE_KEYS.AUTO_SYNC, newValue);
    };

    const handleSync = async () => {
        setSyncStatus('syncing');
        try {
            const { PinnedReposService } = await import('../../packages/core/src/services/pinned-repos.service.js');
            const repos = await PinnedReposService.getPinnedRepos();
            if (repos.length === 0) {
                setSyncStatus('no-repos');
                return;
            }
            const result = await syncFromGitHub();
            if (result === null) {
                setSyncStatus('no-data');
            } else {
                setSyncStatus(`done:${result.importedCount}`);
            }
        } catch (error) {
            console.error('Sync failed:', error);
            setSyncStatus('error');
        }
    };

    const handleSave = async () => {
        const isValid = await GitHubStorageService.validateGitHubToken(tokenInput);
        if (isValid) {
            await GitHubStorageService.setGitHubToken(tokenInput);
            onTokenChange(tokenInput);
            setIsEditing(false);
            setTokenInput('');
            setTokenStatus(null);
        } else {
            setTokenStatus('Invalid token');
        }
    };

    const handleRemove = async () => {
        await GitHubStorageService.removeGitHubToken();
        onTokenChange('');
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto popup-scroll px-4 pt-3 pb-4 space-y-4">
                {/* Account */}
                <div>
                    <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">Account</div>
                    <div className="bg-surface rounded-xl p-3.5 border border-border-subtle">
                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border-default">
                            {user?.avatar_url ? (
                                <img
                                    src={user.avatar_url}
                                    className="w-9 h-9 rounded-full ring-1 ring-border-subtle"
                                    alt="github user's avatar"
                                />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-raised" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-semibold text-primary">{user?.login || 'Unknown'}</div>
                                <div className="text-[11px] text-muted font-mono truncate">{maskedToken}</div>
                            </div>
                            {rateLimit && (
                                <div className="text-right shrink-0">
                                    <div className="text-[11px] font-mono tabular-nums text-secondary">
                                        {rateLimit.remaining}
                                        <span className="text-muted">/{rateLimit.limit}</span>
                                    </div>
                                    <div className="text-[10px] text-muted">
                                        resets{' '}
                                        {rateLimit.resetAt.toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isEditing ? (
                            <div className="flex gap-2">
                                {token && (
                                    <button
                                        type="button"
                                        onClick={handleRemove}
                                        className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-base border border-border-subtle text-danger-text hover:bg-danger-subtle cursor-pointer transition-colors"
                                    >
                                        Disconnect
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(true);
                                        setTokenInput('');
                                    }}
                                    className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-base border border-border-subtle text-accent hover:bg-accent-subtle cursor-pointer transition-colors"
                                >
                                    {token ? 'Change Token' : 'Set Token'}
                                </button>
                            </div>
                        ) : (
                            <div>
                                <input
                                    type="password"
                                    value={tokenInput}
                                    onInput={(e) => setTokenInput(e.currentTarget.value)}
                                    placeholder="GitHub Token (ghp_...)"
                                    className="w-full px-3 py-2 text-[13px] bg-base border border-border-subtle rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary placeholder:text-muted mb-2"
                                />
                                {tokenStatus && <div className="text-[11px] text-danger-text mb-2">{tokenStatus}</div>}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover cursor-pointer transition-colors"
                                    >
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setTokenStatus(null);
                                        }}
                                        className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-raised text-secondary hover:bg-overlay cursor-pointer transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Theme */}
                <div>
                    <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">Theme</div>
                    <div className="relative flex bg-surface rounded-xl p-0.5 border border-border-subtle">
                        <div
                            className="absolute top-0.5 bottom-0.5 rounded-lg bg-base shadow-sm pointer-events-none"
                            style={{
                                left: '2px',
                                width: 'calc(33.333% - 2px)',
                                transform: `translateX(${['system', 'light', 'dark'].indexOf(theme) * 100}%)`,
                                transition: 'transform 200ms ease-out',
                            }}
                        />
                        {[
                            { id: 'system', label: 'System', icon: IconMonitor },
                            { id: 'light', label: 'Light', icon: IconSun },
                            { id: 'dark', label: 'Dark', icon: IconMoon },
                        ].map(({ id, label, icon: Icon }) => (
                            <button
                                type="button"
                                key={id}
                                onClick={() => onThemeChange(id)}
                                className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium py-2 rounded-lg cursor-pointer transition-colors ${
                                    theme === id ? 'text-accent-text' : 'text-tertiary hover:text-secondary'
                                }`}
                            >
                                <Icon size={13} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Export */}
                <div>
                    <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">Export Data</div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={async () => {
                                const tracked = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
                                exportCSV(tracked);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-surface hover:bg-raised text-secondary text-[12px] font-medium py-2 rounded-xl cursor-pointer transition-colors border border-border-subtle"
                        >
                            <IconDownload size={13} />
                            CSV
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                const tracked = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
                                exportJSON(tracked);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-surface hover:bg-raised text-secondary text-[12px] font-medium py-2 rounded-xl cursor-pointer transition-colors border border-border-subtle"
                        >
                            <IconDownload size={13} />
                            JSON
                        </button>
                    </div>
                </div>

                {/* Sync from GitHub */}
                {token && (
                    <div>
                        <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">Sync</div>
                        <button
                            type="button"
                            onClick={handleSync}
                            disabled={syncStatus === 'syncing'}
                            className="w-full flex items-center justify-center gap-1.5 bg-surface hover:bg-raised text-secondary text-[12px] font-medium py-2 rounded-xl cursor-pointer transition-colors border border-border-subtle disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <IconRefresh size={13} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                            {syncStatus === 'syncing' ? 'Syncing...' : 'Sync from GitHub'}
                        </button>
                        {syncStatus && syncStatus !== 'syncing' && (
                            <div
                                className={`text-[11px] mt-1.5 text-center ${syncStatus === 'error' ? 'text-danger-text' : 'text-muted'}`}
                            >
                                {syncStatus === 'no-repos' && 'No pinned repos found. Pin repos first.'}
                                {syncStatus === 'no-data' && 'No tracked time found in GitHub comments.'}
                                {syncStatus === 'error' && 'Sync failed. Check your token and try again.'}
                                {syncStatus.startsWith('done:') && `Imported ${syncStatus.split(':')[1]} new entries.`}
                            </div>
                        )}

                        {/* Auto-sync toggle */}
                        <div className="mt-2 bg-surface rounded-xl p-3 border border-border-subtle">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0 mr-3">
                                    <div className="text-[12px] font-medium text-primary">Auto-sync on popup open</div>
                                    <div className="text-[11px] text-muted mt-0.5 leading-snug">
                                        Automatically sync tracked times from GitHub when you open the extension.
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleAutoSync}
                                    className={`relative shrink-0 w-9 h-5 rounded-full transition-colors cursor-pointer ${
                                        autoSync ? 'bg-accent' : 'bg-raised border border-border-subtle'
                                    }`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                            autoSync ? 'translate-x-4' : ''
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Danger Zone */}
                <div>
                    <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">Danger Zone</div>
                    <button
                        type="button"
                        onClick={onClearData}
                        className="w-full flex items-center justify-center gap-1.5 bg-danger-subtle hover:bg-danger-hover text-danger-text text-[12px] font-medium py-2 rounded-xl cursor-pointer transition-colors border border-danger-border"
                    >
                        <IconTrash size={13} />
                        Clear All Tracked Data
                    </button>
                </div>

                {/* Version */}
                <div className="text-center pt-1">
                    <span className="text-[10px] text-faint">OctoClock v{chrome.runtime.getManifest().version}</span>
                </div>
            </div>
        </div>
    );
}
