# VS Code Extension – UI Vision & Audit

**Date:** 2026-05-10  
**Status:** Vision / design phase  
**Scope:** Complete redesign of the VS Code extension UX — what it could become.

---

## Executive Summary

The current extension is functional at the service level but its UI is a throwaway first draft.
It is buried inside Explorer with no icon, no context awareness, and no discoverability.
This document steps back from bug-fixing and asks: **what would a genuinely great VS Code time-tracking extension look like?**

The reference bar is high: GitHub Pull Requests & Issues, GitLens, and the Jira extension all
share the same pattern — a dedicated Activity Bar icon, a rich multi-panel sidebar, deep workspace
integration, and smart suggestions driven by what the user is already doing.

OctoClock has strong advantages most extensions lack: it already has team-time data
(`everyone-data.service.js`), a sync layer, pinned repos, and session history. The gap is purely
in the surface that exposes that data to the user.

---

## 1. Sidebar architecture — the foundation

The reference model is the **GitHub Pull Requests & Issues** extension. It owns a dedicated
Activity Bar icon and organizes its sidebar into multiple stacked panels, each focused on one
concern. Users never touch Explorer. Everything is discoverable in one place.

OctoClock should follow the exact same model.

```
Activity Bar
  [🕐]  ← OctoClock icon (monochromatic SVG, VS Code tints it)
```

```jsonc
"viewsContainers": {
    "activitybar": [{ "id": "octoclock", "title": "OctoClock", "icon": "resources/octoclock.svg" }]
},
"views": {
    "octoclock": [
        { "id": "octoclock.activeTimer",  "name": "Active Timer"   },
        { "id": "octoclock.myIssues",     "name": "My Issues"      },
        { "id": "octoclock.trackedTime",  "name": "Tracked Time"   },
        { "id": "octoclock.teamActivity", "name": "Team Activity"  },
        { "id": "octoclock.settings",     "name": "Settings"       }
    ]
}
```

---

## 2. Full sidebar vision

```
┌──────────────────────────────────────────────────────────────────┐
│ 🕐  OctoClock                                                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ▼ ACTIVE TIMER                                      [⬡ open]  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  $(watch)  owner/repo  ›  #42 Fix login redirect bug      │  │
│  │  ──────────────────────────────────────────────────────   │  │
│  │  ⏱  1 h  23 min  47 s  ━━━━━━━━━━━━━▶           [■ Stop] │  │
│  │  Started at  10:14 AM  ·  Today                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ▼ MY ISSUES                                    [↺ refresh]     │
│    Suggested by current branch:                                  │
│    $(git-branch)  fix/42-login-redirect  →  #42  [▶ Track]     │
│    ────────────────────────────────────                          │
│    Assigned to me  ·  owner/repo                                 │
│    $(issues) #42  Fix login redirect bug    open   [▶]          │
│    $(issues) #38  Add dark mode toggle      open   [▶]          │
│    $(issue-closed) #31  Update README       closed              │
│                                                                  │
│  ▼ TRACKED TIME                     [+ Pin repo]  [↺]  [⊟ all] │
│    $(repo) owner/repo-1                           3 h 12 min    │
│      $(watch)  #42  Fix login redirect          1 h 23 m  [■]   │
│        $(history)  2026-05-10                      45 min  [✎🗑] │
│        $(history)  2026-05-09                      38 min  [✎🗑] │
│      $(issues)  #38  Add dark mode              1 h 49 m  [▶]   │
│    $(repo) owner/repo-2                           0 h 00 min    │
│      ─ No sessions yet ─                                [unpin] │
│                                                                  │
│  ▼ TEAM ACTIVITY                                [↺ sync]        │
│    $(organization)  owner/repo-1  ·  last sync 3 min ago        │
│    $(person)  alice    #42  Fix login     2 h 10 min  today      │
│    $(person)  bob      #38  Dark mode    45 min       today      │
│    $(person)  carol    #51  API rate     1 h 02 min   yesterday  │
│                                                                  │
│  ▼ SETTINGS                                                      │
│    $(key)         GitHub Token      ✓ Configured    [change]     │
│    $(sync)        Auto-sync         ● On            [toggle]     │
│    $(bell)        Idle reminder     ● On · 30 min   [toggle]     │
│    $(cloud-upload) Sync now                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Smart features — what sets it apart

### 3.1 Auto-detect workspace repositories

When the user opens any folder in VS Code, the extension reads the workspace's git remotes
(via `vscode.workspace.workspaceFolders` + the git extension API or direct `.git/config` parsing)
and detects which pinned repos match the current workspace.

**Flow:**

1. On activation, iterate workspace folders and read `.git/config`.
2. Extract any `remote "origin"` URL that matches `github.com`.
3. If the detected repo is not yet pinned, show an **unobtrusive notification banner**:

```
OctoClock detected: owner/repo — [Pin & track]  [Dismiss]
```

4. If it is already pinned, silently highlight it in the Tracked Time view (scroll to it,
   bold the row).

No manual URL entry. No command palette. Zero friction for new workspaces.

---

### 3.2 Branch → issue auto-suggestion

When the active git branch changes (tracked via the VS Code git extension API
`vscode.extensions.getExtension('vscode.git')`), parse the branch name for an issue number.

**Patterns recognized:**

| Branch name             | Suggested issue |
|-------------------------|-----------------|
| `fix/42-login-redirect` | `#42`           |
| `feature/38_dark_mode`  | `#38`           |
| `issue-123`             | `#123`          |
| `42-something`          | `#42`           |

When a pattern matches, the **My Issues** panel surfaces the suggestion at the top:

```
$(git-branch)  fix/42-login-redirect  →  #42 Fix login redirect bug   [▶ Track]
```

One click starts the timer. No typing. The developer switches branch → OctoClock already knows
what they're about to work on.

---

### 3.3 Idle timer reminder

A common problem with manual time tracking: you start coding, forget to start the timer, and lose
30 minutes of billable time.

The extension watches for keyboard/file-save activity (VS Code fires `workspace.onDidSaveTextDocument`
and the git extension fires commit events). If the user has been active for **N minutes** (configurable,
default 30) with no timer running, a status bar notification pulses and a toast appears:

```
OctoClock: You've been coding for 32 min with no active timer.   [Start timer]  [Dismiss]
```

Clicking **Start timer** opens the **My Issues** quick pick pre-filtered to the current branch
suggestion.

---

### 3.4 Team Activity view (built on existing `everyone-data.service.js`)

The codebase already has `everyone-data.service.js` which fetches and caches all users' tracked
time from GitHub tracker comments. The only missing piece is a UI surface.

**Team Activity panel — node hierarchy:**

```
$(organization)  owner/repo  ·  last sync 3 min ago       [↺]
  $(person)  alice    #42  Fix login     2 h 10 min  today
  $(person)  bob      #38  Dark mode    45 min       today
  $(person)  carol    #51  API rate     1 h 02 min   yesterday
```

- Refreshes when the user clicks ↺ or when AUTO_SYNC fires.
- Hovering a person row shows their total tracked time for the week as a tooltip.
- "Today" / "Yesterday" / date labels add scannable context without clutter.

This is OctoClock's biggest differentiator — **no other VS Code time-tracking extension shows
your team's activity inline in the sidebar.**

---

### 3.5 My Issues view — live GitHub API

Pull the authenticated user's assigned issues from the GitHub API for all pinned repos and show
them in a flat list, sorted by last-updated.

**Node anatomy:**

```
$(issues)  #42  Fix login redirect bug           open  · updated 2 h ago
  description: one-line excerpt from issue body
  $(watch)  You:  1 h 23 min logged
  $(organization)  Team:  3 h 55 min total
  [▶ Track]  [⬡ Open on GitHub]
```

- The `[▶ Track]` inline button starts the timer immediately.
- The `[⬡ Open on GitHub]` button opens the issue in the browser via `vscode.env.openExternal`.
- Closed issues are shown collapsed under a "Recently closed" group, not mixed into the open list.
- Issues with no logged time from anyone show a subtle "No time logged" description.

---

### 3.6 Status bar — informational, not destructive

**Current (broken) behavior:** clicking the status bar stops the timer immediately.

**Redesigned status bar:**

| State              | Text                        | Tooltip                                             | Click action            |
|--------------------|-----------------------------|-----------------------------------------------------|-------------------------|
| Idle               | `$(clock) OctoClock`        | "No timer running — click to start"                 | Open My Issues picker   |
| Active             | `$(watch) 1h 23m — #42`     | "Tracking: Fix login redirect bug · click to focus" | Focus Active Timer view |
| Active + idle warn | `$(warning) 32m · no timer` | "You've been active 32 min with no timer running"   | Open My Issues picker   |

The stop action is only reachable via the **[■ Stop]** inline button in the sidebar or via the
command palette. Never a single accidental click.

---

### 3.7 Editor CodeLens (optional, power feature)

When the user opens a file, the extension can show unobtrusive CodeLens annotations above
function signatures or class definitions — similar to how GitLens shows last-commit info.

**Use case:** a dev opens `auth/login.js`. The CodeLens shows:

```
$(history) 3 h 12 min tracked across 4 sessions — issue #42
```

Clicking it jumps to that issue in the Tracked Time panel.

This requires opting into `"editor.codeLens": true` and is disabled by default. It is a power
feature for teams that want deep issue/code traceability.

---

### 3.8 Quick Start flow (first launch)

On first activation with no token set, instead of silently doing nothing, show a dedicated
**Welcome panel** (a `WebviewPanel` or simply a `viewsWelcome` sequence):

```
Welcome to OctoClock 🕐

Step 1: Connect GitHub
  [Connect with GitHub token]

Step 2: OctoClock will auto-detect repos in your workspace.

Step 3: Start tracking — the extension will suggest issues
        based on your current branch.
```

No token → no noise. But the path to getting started is obvious and inline.

---

## 4. Status of current UI vs. vision (gap analysis)

| Feature                        | Current state          | Vision state                         |
|--------------------------------|------------------------|--------------------------------------|
| Activity Bar icon              | ❌ None (in Explorer)   | ✅ Dedicated icon                     |
| Extension marketplace icon     | ❌ Puzzle piece         | ✅ OctoClock SVG/PNG                  |
| Tree node icons                | ❌ Plain text           | ✅ ThemeIcons per node type           |
| Active timer panel             | ❌ Status bar only      | ✅ Live dedicated panel               |
| My Issues view                 | ❌ Does not exist       | ✅ GitHub API · assigned to me        |
| Team Activity view             | ❌ Does not exist       | ✅ everyone-data.service.js surfaced  |
| Auto-detect workspace repo     | ❌ Manual pin only      | ✅ .git/config parsed at activation   |
| Branch → issue suggestion      | ❌ Does not exist       | ✅ Branch name parsed, shown in panel |
| Idle reminder                  | ❌ Does not exist       | ✅ Configurable · status bar pulse    |
| Start timer UX                 | ❌ Type full URL        | ✅ QuickPick from My Issues           |
| Inline hover buttons           | ❌ Right-click only     | ✅ $(play) $(stop) $(trash) per row   |
| Status bar click               | ❌ Stops timer (!)      | ✅ Focuses sidebar                    |
| Issue label fallback           | ❌ Raw /owner/repo/…    | ✅ #42 extracted from URL             |
| Active issue highlight in tree | ❌ Identical to others  | ✅ $(watch) + contextValue            |
| Settings view                  | ❌ Command palette only | ✅ Token · auto-sync · idle reminder  |
| First-launch onboarding        | ❌ Silent               | ✅ Welcome panel with steps           |
| Editor CodeLens                | ❌ Does not exist       | ✅ Optional time annotations on files |

---

## 5. Implementation order

Work in self-contained chunks, each shippable independently.

| Wave | Items                                                                              | Why first                               |
|------|------------------------------------------------------------------------------------|-----------------------------------------|
| 1    | Activity Bar icon · extension icon · node ThemeIcons · issue label fallback (#123) | Zero-risk, huge visible improvement     |
| 2    | Status bar click → focus · active issue highlight · inline hover buttons           | UX correctness, fixes destructive click |
| 3    | Active Timer dedicated panel · welcome/empty state views                           | Core usability parity                   |
| 4    | My Issues view (GitHub API) · start timer QuickPick                                | Biggest daily-driver improvement        |
| 5    | Auto-detect workspace repo · branch → issue suggestion · idle reminder             | Smart, differentiating features         |
| 6    | Team Activity view (everyone-data.service.js) · Settings view · onboarding         | Team value · polish                     |
| 7    | Editor CodeLens · keyboard shortcuts                                               | Power-user layer                        |

---

## 6. New files required

| File                            | Purpose                                                                   |
|---------------------------------|---------------------------------------------------------------------------|
| `resources/octoclock.svg`       | Monochromatic 24×24 Activity Bar icon                                     |
| `resources/octoclock-128.png`   | Marketplace tile icon                                                     |
| `src/active-timer-provider.js`  | `TreeDataProvider` for the live Active Timer panel                        |
| `src/my-issues-provider.js`     | `TreeDataProvider` pulling GitHub API assigned issues + branch suggestion |
| `src/team-activity-provider.js` | `TreeDataProvider` wrapping `everyone-data.service.js`                    |
| `src/settings-provider.js`      | `TreeDataProvider` for token · auto-sync · idle-reminder settings         |
| `src/workspace-detector.js`     | Reads `.git/config`, detects GitHub remotes, emits repo suggestions       |
| `src/branch-watcher.js`         | Watches active branch via git API, parses issue number, notifies panels   |
| `src/idle-detector.js`          | Tracks activity, fires idle warning after configured minutes              |
| `src/codelens-provider.js`      | Optional CodeLens showing time logged per file (Wave 7)                   |

**Modified files:**

| File                | Change                                                                                 |
|---------------------|----------------------------------------------------------------------------------------|
| `package.json`      | `viewsContainers`, `views`, `viewsWelcome`, command icons, inline menus, `keybindings` |
| `src/tree-view.js`  | `iconPath` on all nodes · `activeIssue` passed to build · label fallback fix           |
| `src/status-bar.js` | Click → focus view · idle warning state                                                |
| `src/commands.js`   | `setToken`, `startTimerOn`, `focusActiveTimer`, `refreshMyIssues`, `setContext` calls  |
| `src/extension.js`  | Register all new providers, workspace detector, branch watcher, idle detector          |

