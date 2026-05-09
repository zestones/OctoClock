# VS Code Extension – Architecture Audit

## Context

OctoClock is currently a Chrome Extension (MV3) built with Preact + Vite + Tailwind.
This document audits what it would take to also ship it as an idiomatic VS Code extension,
and how to structure the codebase so both targets live in a single monorepo without duplicating logic.

---

## 1. Code ownership map

| Path                                       | Platform dependency                                         | Portable?        |
|--------------------------------------------|-------------------------------------------------------------|------------------|
| `src/utils/`                               | None                                                        | ✅ 100%           |
| `src/services/github.service.js`           | None (`fetch` works in Node)                                | ✅ 100%           |
| `src/services/cache.service.js`            | `StorageService` (1 adapter needed)                         | ✅ after adapter  |
| `src/services/issue-storage.service.js`    | `StorageService`                                            | ✅ after adapter  |
| `src/services/pinned-repos.service.js`     | `StorageService`                                            | ✅ after adapter  |
| `src/services/timer.service.js`            | `StorageService` + `chrome.runtime.sendMessage`             | ✅ after adapters |
| `src/services/github-storage.service.js`   | `StorageService`                                            | ✅ after adapter  |
| `src/services/everyone-data.service.js`    | `StorageService`                                            | ✅ after adapter  |
| `src/services/sync.service.js`             | `StorageService`                                            | ✅ after adapter  |
| `src/services/storage.service.js`          | `chrome.storage.local` (hard-coded)                         | ⚠️ replace       |
| `src/services/storage-listener.service.js` | `chrome.storage.onChanged`                                  | ⚠️ replace       |
| `src/background/index.js`                  | `chrome.alarms`, `chrome.runtime`, service worker lifecycle | ❌ Chrome-only    |
| `src/content/`                             | DOM injection into github.com                               | ❌ Chrome-only    |
| `src/popup/` (Preact UI)                   | Preact/JSX (browser rendering)                              | ❌ Chrome-only    |
| `src/hooks/`                               | Preact hooks                                                | ❌ Chrome-only    |
| `src/components/`                          | Preact components                                           | ❌ Chrome-only    |

**~60% of the business logic is already portable, but there are three browser-coupled seams to extract:**
storage access, runtime messaging, and storage change events. Most Chrome-specific code lives in
`background/`, `content/`, `popup/`, plus the small subset of services that touch `chrome.*` directly
(`storage.service.js`, `storage-listener.service.js`, and `timer.service.js`).

---

## 2. The first blocker: `StorageService`

Every service imports `StorageService` and calls `get/set/remove/getMultiple`.
Abstracting this into a platform-agnostic interface is the first and largest reuse step,
but it is not the only seam. Full reuse of the timer flows also requires a messaging port
and a storage-events port because `timer.service.js` and the reactive UI still depend on
`chrome.runtime.sendMessage` and `chrome.storage.onChanged` semantics.

### 2.1 Proposed interface (JSDoc)

```js
/**
 * @typedef {Object} IStorageService
 * @property {(key: string) => Promise<any>} get
 * @property {(key: string, value: any) => Promise<void>} set
 * @property {(key: string) => Promise<void>} remove
 * @property {(keys: string[]) => Promise<Record<string, any>>} getMultiple
 * @property {(keys: string[]) => Promise<void>} removeMultiple
 */
```

### 2.2 Chrome adapter (current code, moved)

```js
// packages/browser-ext/src/adapters/chrome-storage.adapter.js
export class ChromeStorageAdapter {
    static async get(key) { ... }          // chrome.storage.local.get
    static async set(key, value) { ... }   // chrome.storage.local.set
    // ...
}
```

### 2.3 VS Code adapter

```js
// packages/vscode-ext/src/adapters/vscode-storage.adapter.js
// Uses ExtensionContext injected at activation time
export class VSCodeStorageAdapter {
    static #ctx = null;
    static init(context) { this.#ctx = context; }

    static async get(key) {
        return this.#ctx.globalState.get(key) ?? null;
    }
    static async set(key, value) {
        return this.#ctx.globalState.update(key, value);
    }
    // ...
}
```

> The GitHub token should use `context.secrets` instead of `globalState` on the VS Code side —
> it is encrypted at rest by VS Code and is not synced across machines. Keep the existing
> token-format validation unless the product intentionally relaxes it: the regex is still a
> useful input/data-integrity guard even when storage is secure.

### 2.4 Dependency injection at boot

Each platform entry point injects its adapter before any service runs.
In the browser build that means **all runtime entry points**, not just the background worker:
`background/index.js`, `popup.jsx`, and `content/index.js` must either import a shared bootstrap
module or call the setup directly.

```js
// browser-ext: bootstrap imported by background/index.js, popup.jsx, and content/index.js
StorageService.setAdapter(ChromeStorageAdapter);

// vscode-ext: extension.ts activate()
StorageService.setAdapter(VSCodeStorageAdapter);
```

After this change, storage access can be routed entirely through `StorageService`,
but timer-related flows still need separate messaging and storage-event ports.

---

## 3. Messaging and ordered sync layer

In the browser extension, `timer.service.js` sends `chrome.runtime.sendMessage('syncTrackerComment')`
to delegate sync to the background worker because the popup is ephemeral.
It also emits `timerStarted` / `timerStopped` notifications so other browser contexts can react.

In VS Code there is no popup/background split, so the extension host is the natural place to own
this logic. However, that does **not** remove the need for ordered per-issue sync.
The current browser worker serializes tracker-comment writes for the same issue; the VS Code port
should preserve that queue so stop/edit/delete actions cannot race and overwrite the tracker comment
with stale data.

The fix is a second abstraction: a `MessagingPort` that is either
`chrome.runtime.sendMessage` or a direct function call into a queued handler:

```js
// packages/core/src/ports/messaging.port.js
let _handler = null;
export const MessagingPort = {
    setHandler(fn) { _handler = fn; },
    async send(action, payload) { return _handler(action, payload); },
};

// browser-ext wires:
MessagingPort.setHandler((action, payload) =>
    new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action, ...payload }, (res) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(res);
        });
    })
);

// vscode-ext wires:
MessagingPort.setHandler(async (action, payload) => {
    if (action === 'syncTrackerComment') return queueTrackerCommentSync(payload);
    throw new Error(`Unknown action: ${action}`);
});
```

In VS Code, `timerStarted` / `timerStopped` usually do not need a message bus.
They can be replaced by `StorageEventsPort` listeners or direct provider refreshes
because the status bar and tree view live in the extension host.

---

## 4. Storage events (`chrome.storage.onChanged`)

`useStorageListener` and `storage-listener.service.js` rely on `chrome.storage.onChanged`.

VS Code has no equivalent native event for `globalState` changes.
The replacement is a tiny in-process event emitter that the storage adapter fires on
`set`, `remove`, and `removeMultiple` so active-timer teardown is observable too:

```js
// packages/core/src/ports/storage-events.port.js
const listeners = new Map();
export const StorageEventsPort = {
    emit(key, newValue) { listeners.get(key)?.forEach((cb) => cb(newValue)); },
    on(key, cb) { /* add to map */ return () => { /* remove */ }; },
};

// VSCodeStorageAdapter.set/remove/removeMultiple call StorageEventsPort.emit(key, valueOrNull)
```

In the browser adapter, `StorageEventsPort.emit` is driven by `chrome.storage.onChanged` as before.
Core services and hooks only use `StorageEventsPort` — no `chrome.*` reference anywhere.
For extension-host UI (`StatusBarItem`, `TreeView`), an in-process emitter is sufficient.
If a `WebviewPanel` is used, it must proxy storage changes over `postMessage` because the webview
runs in a separate context.

---

## 5. VS Code UI – idiomatic approach

Minimize `WebviewPanel` usage. The primary interaction model should feel native to VS Code;
reserve webviews for charts or richer settings UX only if the native surfaces become limiting.

### 5.1 Feature → VS Code primitive mapping

| OctoClock feature                  | VS Code primitive                                                                                                                                                  |
|------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Active timer display               | `StatusBarItem` (always visible, bottom bar)                                                                                                                       |
| Start / Stop timer                 | `StatusBarItem` button + `vscode.commands.registerCommand`                                                                                                         |
| Issues list (per repo)             | `TreeView` with `TreeDataProvider`                                                                                                                                 |
| Pinned repos                       | Top-level tree nodes                                                                                                                                               |
| Issue detail (sessions)            | Child tree nodes under each issue                                                                                                                                  |
| Filter (open/assigned/closed)      | `QuickPick` triggered from tree toolbar                                                                                                                            |
| Search issues                      | `QuickPick` with `onDidChangeValue` debounce                                                                                                                       |
| Stats / calendar                   | `WebviewPanel` (read-only chart, no interactivity needed inline)                                                                                                   |
| Settings (token, theme, auto-sync) | `SecretStorage` + command / `InputBox` for token, `contributes.configuration` for theme + auto-sync; optional `WebviewPanel` only if richer UX is worth the bridge |
| Delete / edit session              | Inline tree item buttons (`TreeItem.command` + `iconPath`)                                                                                                         |
| Sync to GitHub comment             | Command palette + auto on stop, while preserving per-issue queue semantics                                                                                         |
| Recover tracked time from GitHub   | Command + activation hook when auto-sync is enabled + repo-pin hook                                                                                                |

### 5.2 Tree structure (visual)

```text
OCTOCLOCK                           ← TreeView title
├── ● owner/repo-one                ← PinnedRepoNode
│   ├── #42 Fix login bug    1h 23m ← IssueNode
│   │   ├── 2026-05-08  45m         ← SessionNode (with edit/delete inline)
│   │   └── 2026-05-09  38m
│   └── #51 Add dark mode    0h 12m
└── ● owner/repo-two
    └── #7 Crash on save     3h 01m
```

### 5.3 Status bar

```text
⏱ 00:42:15  owner/repo #42      ← click → stop timer command
```

When no timer is active:

```text
⏱ Start timer                   ← click → QuickPick issue picker
```

### 5.4 Commands registered

```json
"contributes": {
    "commands": [
        { "command": "octoclock.startTimer",    "title": "OctoClock: Start Timer" },
        { "command": "octoclock.stopTimer",     "title": "OctoClock: Stop Timer" },
        { "command": "octoclock.syncComment",   "title": "OctoClock: Sync GitHub Comment" },
        { "command": "octoclock.pinRepo",       "title": "OctoClock: Pin Repository" },
        { "command": "octoclock.editSession",   "title": "OctoClock: Edit Session" },
        { "command": "octoclock.deleteSession", "title": "OctoClock: Delete Session" },
        { "command": "octoclock.openSettings",  "title": "OctoClock: Settings" }
    ]
}
```

### 5.5 Token storage

```ts
// Secure, encrypted by VS Code
await context.secrets.store('octoclock.githubToken', token);
const token = await context.secrets.get('octoclock.githubToken');
```

Keep the existing format validation as a lightweight guard against malformed input or
corrupted persisted values. `context.secrets` improves storage security; it does not validate content.

### 5.6 Extension host location

Set `extensionKind` explicitly.
The safest default for OctoClock is `"extensionKind": ["workspace"]` so `globalState`, `secrets`,
GitHub API access, and repo-scoped commands live with the workspace in remote SSH/devcontainer/
Codespaces setups. A `"workspace", "ui"` fallback only makes sense if storage and secret location are
intentionally designed to follow the UI host instead.

### 5.7 Data model invariant

Core services assume issue identifiers are normalized relative paths such as
`/owner/repo/issues/123`, not arbitrary GitHub URLs.
The VS Code UI can keep this invariant unchanged; if it does not, it should introduce a single
normalization layer at the boundary before calling shared services.

---

## 6. Monorepo structure

```text
OctoClock/                          ← repo root
├── packages/
│   ├── core/                       ← shared business logic (no chrome.*, no vscode.*)
│   │   ├── src/
│   │   │   ├── services/           ← all current services (storage-agnostic)
│   │   │   ├── utils/              ← all current utils
│   │   │   └── ports/
│   │   │       ├── storage.port.js
│   │   │       ├── messaging.port.js
│   │   │       └── storage-events.port.js
│   │   └── package.json
│   │
│   ├── browser-ext/                ← Chrome extension (current app)
│   │   ├── src/
│   │   │   ├── adapters/
│   │   │   │   └── chrome-storage.adapter.js
│   │   │   ├── background/         ← service worker (Chrome-only)
│   │   │   ├── content/            ← DOM injection (Chrome-only)
│   │   │   ├── popup/              ← Preact UI (Chrome-only)
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── manifest.json
│   │   ├── popup.html
│   │   └── vite.config.*.js
│   │
│   └── vscode-ext/                 ← VS Code extension (new)
│       ├── src/
│       │   ├── adapters/
│       │   │   └── vscode-storage.adapter.ts
│       │   ├── providers/
│       │   │   ├── RepoTreeProvider.ts
│       │   │   └── IssueTreeProvider.ts
│       │   ├── ui/
│       │   │   ├── statusBar.ts
│       │   │   └── statsPanel.ts  (WebviewPanel for charts only)
│       │   └── extension.ts       ← activation entry point
│       └── package.json           ← VS Code extension manifest
│
├── biome.json                      ← shared lint config
├── tsconfig.base.json              ← shared TS config
└── package.json                    ← workspace root (npm workspaces)
```

### Workspace root `package.json`

```json
{
    "name": "octoclock",
    "private": true,
    "workspaces": ["packages/core", "packages/browser-ext", "packages/vscode-ext"],
    "scripts": {
        "build:browser": "npm run build --workspace=packages/browser-ext",
        "build:vscode": "npm run build --workspace=packages/vscode-ext",
        "build": "npm run build:browser && npm run build:vscode",
        "validate": "npm run typecheck && biome check ./packages"
    }
}
```

---

## 7. Migration steps (ordered by risk)

### Step 1 — Extract `core` package (low-to-medium risk, browser bootstrap sensitive)

1. Create `packages/core/` with its own `package.json` (`"name": "@octoclock/core"`).
2. Move `src/utils/` and `src/services/` into `packages/core/src/`.
3. Add the three ports (`storage.port.js`, `messaging.port.js`, `storage-events.port.js`) with empty no-op defaults.
4. Move the current `StorageService` implementation into `packages/browser-ext/src/adapters/chrome-storage.adapter.js` and wire it in a shared browser bootstrap imported by `background/index.js`, `popup.jsx`, and `content/index.js`.
5. Move `src/services/storage-listener.service.js` into the browser adapter layer or replace it with `StorageEventsPort` consumers.
6. Update `timer.service.js` to route `syncTrackerComment`, `timerStarted`, and `timerStopped` through ports instead of direct `chrome.runtime.sendMessage`.
7. Update all imports in `browser-ext` to point to `@octoclock/core`.
8. Run `npm run validate` plus a browser smoke test for popup start/stop, content-script start/stop, popup-open auto-sync, and repo-pin auto-sync — no intended behaviour change.

### Step 2 — VS Code extension scaffold (isolated, no risk to browser ext)

1. Run `yo code` or scaffold manually: `packages/vscode-ext/` with `extension.ts` entry.
2. Implement `VSCodeStorageAdapter` using `context.globalState` for normal data and `context.secrets` for the GitHub token.
3. Wire `StorageService.setAdapter(VSCodeStorageAdapter)` on `activate()` and initialize any storage-events bridge used by the status bar, tree view, or webviews.
4. Implement `MessagingPort` as a direct call into queued handlers, not a direct unqueued GitHub write.
5. Register `octoclock.startTimer` / `octoclock.stopTimer` commands — backed by `@octoclock/core` `TimerService`.
6. Add `StatusBarItem` driven by a `StorageEventsPort` listener on `ACTIVE_ISSUE` + `START_TIME`, including removal events.
7. Preserve current recovery flows: if auto-sync is enabled, run recovery on activation/open and when a repo is newly pinned.

### Step 3 — Tree view

1. Implement `RepoTreeProvider` backed by `PinnedReposService` + `IssueStorageService` from core, preserving the current issue identifier shape `/owner/repo/issues/123`.
2. Add `IssueNode` and `SessionNode` as `TreeItem` subclasses.
3. Inline edit/delete session buttons via `TreeItem.command` + context menu contributions.

### Step 4 — Stats panel (optional, can ship later)

Build a minimal `WebviewPanel` that loads a bundled chart page (can reuse Preact components
from `browser-ext` or write plain HTML/Chart.js — small scope).

---

## 8. Effort estimate by area

| Area                                  | Effort         |
|---------------------------------------|----------------|
| Extract core package + ports          | ~1–1.5 days    |
| VS Code storage + messaging adapters  | ~0.5–1 day     |
| Status bar                            | ~0.5 day       |
| Tree view (repos + issues + sessions) | ~2 days        |
| Commands + inline edit/delete         | ~1 day         |
| Token management + settings split     | ~0.5–1 day     |
| Recovery / auto-sync parity           | ~0.5 day       |
| Stats WebviewPanel                    | ~1–2 days      |
| **Total**                             | **~8–10 days** |

---

## 9. What does NOT need to change

- All of `src/utils/` — zero changes
- `github.service.js` — zero changes  
- Most service business logic — reusable once storage, messaging, and storage-events are injected
- The GitHub comment format / marker logic — identical on both platforms
- Biome lint config — shared across the monorepo
- Token validation policy — can stay shared; only the storage backend changes on VS Code
- The internal issue identifier format (`/owner/repo/issues/123`) — can remain unchanged if the VS Code layer normalizes inputs at the boundary

---

## 10. Decision summary

| Question                         | Answer                                                                                 |
|----------------------------------|----------------------------------------------------------------------------------------|
| Feasible?                        | Yes                                                                                    |
| Share codebase or fork?          | One monorepo, `packages/core` shared                                                   |
| Reuse Preact UI?                 | No — idiomatic VS Code means TreeView + StatusBar                                      |
| Biggest single change            | Extract storage, messaging, and storage-events into ports                              |
| Second biggest                   | TreeDataProvider implementation + sync/recovery parity                                 |
| Can both ship independently?     | Yes — each package has its own build + publish pipeline                                |
| Breaking changes to browser ext? | None intended, but Step 1 needs careful bootstrap + smoke testing to avoid regressions |
