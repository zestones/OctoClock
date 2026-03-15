<div align="center">
<img src="./docs/screenshots/og-home.png" alt="OctoClock logo" align="center" />
</div>

<br/>

[![CI](https://github.com/zestones/github-timetracker-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/zestones/github-timetracker-extension/actions/workflows/ci.yml) [![GitHub release](https://img.shields.io/github/v/release/zestones/github-timetracker-extension)](https://github.com/zestones/github-timetracker-extension/releases)

_A feature-rich browser extension that brings time tracking directly into GitHub. Track time on issues, pin repositories, visualize your work in a calendar, analyze stats per repo, and collaborate with your team — all without leaving GitHub._

> [!NOTE]
> This project was forked and significantly expanded from [lywebdev/github-timetracker-extension](https://github.com/lywebdev/github-timetracker-extension).

## Screenshots

### Dark Theme

<table>
  <tr>
    <td align="center"><strong>Issues</strong></td>
    <td align="center"><strong>Calendar</strong></td>
    <td align="center"><strong>Stats</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/dark/issues.png" width="280" alt="Issues tab — dark" /></td>
    <td><img src="docs/screenshots/dark/calendar.png" width="280" alt="Calendar view — dark" /></td>
    <td><img src="docs/screenshots/dark/stats.png" width="280" alt="Stats overview — dark" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Repo Details</strong></td>
    <td align="center"><strong>Contributors</strong></td>
    <td align="center"><strong>Settings</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/dark/stats-details.png" width="280" alt="Repository detail view — dark" /></td>
    <td><img src="docs/screenshots/dark/stats-contributors.png" width="280" alt="Contributors view — dark" /></td>
    <td><img src="docs/screenshots/dark/settings.png" width="280" alt="Settings panel — dark" /></td>
  </tr>
</table>

### Light Theme

<table>
  <tr>
    <td align="center"><strong>Issues</strong></td>
    <td align="center"><strong>Calendar</strong></td>
    <td align="center"><strong>Stats</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/light/issues.png" width="280" alt="Issues tab — light" /></td>
    <td><img src="docs/screenshots/light/calendar.png" width="280" alt="Calendar view — light" /></td>
    <td><img src="docs/screenshots/light/stats.png" width="280" alt="Stats overview — light" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Repo Details</strong></td>
    <td align="center"><strong>Contributors</strong></td>
    <td align="center"><strong>Settings</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/light/stats-details.png" width="280" alt="Repository detail view — light" /></td>
    <td><img src="docs/screenshots/light/stats-contributors.png" width="280" alt="Contributors view — light" /></td>
    <td><img src="docs/screenshots/light/settings.png" width="280" alt="Settings panel — light" /></td>
  </tr>
</table>

---

## Features

### Time Tracking

A **Start / Stop Timer** button is injected directly on every GitHub issue page. It displays a real-time elapsed counter combining accumulated and current session time.

> [!NOTE]
> Starting a new timer automatically stops the previous one — preventing overlaps and ensuring accurate tracking. Timer state survives browser restarts and recovers gracefully from crashes.

### Issue Browser

Pin any GitHub repository for quick access from the extension popup. Browse, search, and filter issues by status (open, closed), assignee, or creator — and start or stop timers without leaving the popup.

> [!TIP]
> Issue lists are cached with a 5-minute TTL to keep API usage minimal even when switching between repos frequently.

### Calendar

An interactive monthly calendar highlights every day with tracked time. Days are shaded with a **5-level heat map** inspired by GitHub's contribution graph — the more time tracked on a given day, the more intense the colour — making it easy to spot busy and quiet periods at a glance. The week starts on **Monday**. Click any day to see a full breakdown of issues worked on (including issue number and repository) and total time spent. Entries are searchable and update live while a timer is running.

### Stats and Analytics

Summary cards display time tracked **today**, **this week**, **this month**, and **all time**. A per-repository breakdown shows horizontal bar charts with percentage distribution. Drilling into a repository reveals total time, number of sessions, average session length, and days worked per issue — sortable by any of those dimensions. A custom date range picker allows filtering to any period.

> [!TIP]
> Forgot to stop a timer? Go to **Stats → repository → expand an issue** and click the session duration to manually correct it. Both local storage and the synced GitHub comment are updated instantly.

An **Everyone** mode automatically fetches all team members' tracker comments from issues when toggled — no manual sync required. Your own data always appears instantly from local storage, while others' data loads in the background. Drilling into a repository switches between an **Issues** tab and a **Contributors** tab, which shows a stacked time-distribution bar chart, per-contributor breakdowns with color-coded progress bars, and expandable per-issue detail for each user.

### Sync and Data Recovery

The extension posts time sessions as formatted Markdown tables to GitHub issue comments. These comments double as a backup: tracked times can be recovered from them after data loss or when setting up on a new device.

When a timer is started, the extension automatically **backfills remote entries** from the corresponding GitHub comment into local storage — ensuring your data stays in sync without manual intervention.

> [!IMPORTANT]
> Auto-sync triggers on popup open (optional toggle in Settings) and automatically when pinning a new repo. The merge logic only imports remote data when it exceeds local records — your local data is never silently overwritten.

### More Features

| Feature           | Details                                                                                            |
|-------------------|----------------------------------------------------------------------------------------------------|
| **Theme support** | System (auto-detect), Light, and Dark modes — preference persists across sessions                  |
| **Data export**   | Export as CSV or JSON — CSV includes formula injection protection                                  |
| **Settings**      | Masked token display, API rate limit indicator with reset countdown, token format validation       |
| **Offline-first** | All data in Chrome `storage.local` — background worker refreshes every 15 min, ~33k entry capacity |

---

## Architecture

```mermaid
graph TD
    subgraph ext [Browser Extension]
        direction TB
        CS[Content Script]
        BG[Background Service Worker]
        PO[Popup UI]
    end

    GH[GitHub Issue Page]
    ST[(Chrome Storage)]
    API[GitHub API]

    CS -- injects timer --> GH
    CS -- messages --> BG
    BG -- alarms / cache --> ST
    PO -- reads / writes --> ST
    PO -- API calls --> API
    BG -- periodic refresh --> API
```

The extension is composed of three independently built entry points:

- **Content Script** — monitors GitHub navigation and injects the timer button on issue pages. Communicates with the background worker to synchronize timer state across tabs.
- **Background Service Worker** — manages cache refresh alarms, timer persistence, and message forwarding between content scripts and the popup.
- **Popup UI** — the main interface with four tabs (Issues, Calendar, Stats, Settings). Built with Preact and Tailwind CSS.

---

## Tech Stack

| Layer                | Technology                                                                    |
|----------------------|-------------------------------------------------------------------------------|
| UI Framework         | [Preact](https://preactjs.com/)                                               |
| Styling              | [Tailwind CSS v4](https://tailwindcss.com/)                                   |
| Build Tool           | [Vite](https://vitejs.dev/) (separate configs for popup, background, content) |
| Linting / Formatting | [Biome](https://biomejs.dev/)                                                 |
| Type Checking        | TypeScript via JSDoc annotations                                              |
| Extension Manifest   | Manifest V3                                                                   |

---

## Getting Started

1. Download the latest `github-time-tracker-vX.Y.Z.zip` from the [Releases](https://github.com/zestones/github-timetracker-extension/releases) page.
2. Extract the zip into a permanent folder (e.g. `~/extensions/github-timetracker`). **Remember this location — you'll need it for updates.**
3. Open `chrome://extensions` → enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** → select the extracted folder.
5. Navigate to any GitHub issue — a **Start Timer** button appears automatically.
6. Open the extension popup and add a GitHub Classic Personal Access Token in **Settings** to unlock syncing, issue browsing, and commenting.

> [!TIP]
> To fix a missed stop after the fact, go to **Stats → repository → expand an issue** and click the session duration to correct it manually.

---

## Updating to a New Version

> [!NOTE]
> **Your data is safe regardless of how you update.** All tracked time is synced to GitHub issue comments, so even if you load the extension fresh from a new folder, everything can be recovered in one click via **Settings → Sync from GitHub**.

**Update steps:**

1. Download the new `github-time-tracker-vX.Y.Z.zip` from [Releases](https://github.com/zestones/github-timetracker-extension/releases).
2. Extract the zip and **overwrite the contents of your existing folder**, or extract to a new folder entirely — your choice.
3. Open `chrome://extensions`, find GitHub Time Tracker, and click the **reload icon** (↺). If you used a new folder, click **Load unpacked** instead and select it.
4. If you loaded into a new folder, open **Settings → Sync from GitHub** to pull all your history back from the issue comments.

> [!TIP]
> In-place reload (same folder) is the fastest path — no re-auth, no sync needed. A new folder requires re-entering your token and triggering a sync, but no data is lost.



## Privacy

All data stays in your browser. No analytics, no telemetry, no external servers. The only network requests go to the GitHub API, authorized by your token, for features you explicitly use.

See the full [Privacy Policy](docs/privacy-policy.md).

---

## Links

- [Original Repository](https://github.com/lywebdev/github-timetracker-extension)
- [Privacy Policy](docs/privacy-policy.md)
