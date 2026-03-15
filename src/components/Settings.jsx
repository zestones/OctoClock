import { useEffect, useState } from 'preact/hooks';
import { IconDownload, IconMonitor, IconMoon, IconRefresh, IconSun, IconTrash } from '../icons.jsx';
import { GitHubService } from '../services/github.service.js';
import { GitHubStorageService } from '../services/github-storage.service.js';
import { StorageService } from '../services/storage.service.js';
import { syncFromGitHub } from '../services/sync.service.js';
import { STORAGE_KEYS } from '../utils/constants.utils.js';

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
            const { PinnedReposService } = await import('../services/pinned-repos.service.js');
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
        <div className="p-4 space-y-5">
            {/* Account */}
            <div>
                <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">Account</div>
                <div className="bg-surface rounded-xl p-3.5">
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border-default">
                        {user?.avatar_url ? (
                            <img
                                src={user.avatar_url}
                                className="w-9 h-9 rounded-full ring-1 ring-ring-default"
                                alt="github user's avatar"
                            />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-raised" />
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-primary">{user?.login || 'Unknown'}</div>
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
                                    {rateLimit.resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                    className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-base border border-border-default text-danger-text hover:bg-danger-subtle cursor-pointer transition-colors"
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
                                className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-base border border-border-default text-accent hover:bg-accent-subtle cursor-pointer transition-colors"
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
                                className="w-full px-3 py-2 text-[13px] bg-base border border-border-default rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary placeholder:text-muted mb-2"
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
                <div className="flex gap-2">
                    {[
                        { id: 'system', label: 'System', icon: IconMonitor },
                        { id: 'light', label: 'Light', icon: IconSun },
                        { id: 'dark', label: 'Dark', icon: IconMoon },
                    ].map(({ id, label, icon: Icon }) => (
                        <button
                            type="button"
                            key={id}
                            onClick={() => onThemeChange(id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium py-2 rounded-xl cursor-pointer transition-colors border ${theme === id
                                    ? 'bg-accent-subtle text-accent border-accent-ring'
                                    : 'bg-surface text-tertiary border-border-default hover:bg-raised'
                                }`}
                        >
                            <Icon size={14} />
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
                        className="flex-1 flex items-center justify-center gap-1.5 bg-surface hover:bg-raised text-secondary text-[13px] font-medium py-2.5 rounded-xl cursor-pointer transition-colors border border-border-default"
                    >
                        <IconDownload size={14} />
                        CSV
                    </button>
                    <button
                        type="button"
                        onClick={async () => {
                            const tracked = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
                            exportJSON(tracked);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-surface hover:bg-raised text-secondary text-[13px] font-medium py-2.5 rounded-xl cursor-pointer transition-colors border border-border-default"
                    >
                        <IconDownload size={14} />
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
                        className="w-full flex items-center justify-center gap-1.5 bg-surface hover:bg-raised text-secondary text-[13px] font-medium py-2.5 rounded-xl cursor-pointer transition-colors border border-border-default disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <IconRefresh size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
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
                    <div className="mt-3 bg-surface rounded-xl p-3 border border-border-default">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0 mr-3">
                                <div className="text-[12px] font-medium text-primary">Auto-sync on popup open</div>
                                <div className="text-[11px] text-muted mt-0.5 leading-snug">
                                    Automatically sync tracked times from GitHub when you open the extension. Recovers
                                    data from all pinned repos.
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={toggleAutoSync}
                                className={`relative shrink-0 w-9 h-5 rounded-full transition-colors cursor-pointer ${autoSync ? 'bg-accent' : 'bg-raised border border-border-default'
                                    }`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoSync ? 'translate-x-4' : ''
                                        }`}
                                />
                            </button>
                        </div>
                        <div className="text-[10px] text-accent/65 mt-2 leading-snug">
                            Useful when switching browsers/devices or after clearing extension data. Also helps if
                            multiple team members use this extension — each user keeps their own tracked time.
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
                    className="w-full flex items-center justify-center gap-1.5 bg-danger-subtle hover:bg-danger-hover text-danger-text text-[13px] font-medium py-2.5 rounded-xl cursor-pointer transition-colors border border-danger-border"
                >
                    <IconTrash size={14} />
                    Clear All Tracked Data
                </button>
            </div>

            {/* Version */}
            <div className="text-center">
                <span className="text-[11px] text-faint">
                    OctoClock v{chrome.runtime.getManifest().version}
                </span>
            </div>
        </div>
    );
}
