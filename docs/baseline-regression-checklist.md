# Baseline Regression Checklist – M0

> **Purpose:** Capture manually verified browser-extension behavior before any refactoring begins.
> This document is the reference used at Gate A (end of M1) to confirm the shared core has not introduced regressions.
>
**How to use:** Load the unpacked extension in Chrome, open DevTools for each context listed below, and follow each step exactly as written. Tick every checkbox as you go. Attach a screenshot or paste the console log excerpt into the GitHub issue comment when done.
---

## Prerequisites

Before starting:

- [x] Extension is built (`npm run build` or equivalent) and loaded as an unpacked extension in `chrome://extensions`
- [x] DevTools is open for the **popup** (right-click popup → Inspect), **background service worker** (link in `chrome://extensions`), and the **content script** (DevTools on any GitHub issue page → Console → filter by extension)
- [x] A GitHub token with `repo` scope is saved in the extension
- [x] At least one repo is pinned
- [x] `AUTO_SYNC` is **enabled** in Settings
- [x] You have access to a real GitHub issue URL (e.g. `https://github.com/owner/repo/issues/42`)

---

## Flow 1 – Popup: auto-sync on open

**Code path:** `App.jsx:41-43` → `StorageService.get(AUTO_SYNC)` → `syncFromGitHub()`
**Setup:** Ensure `AUTO_SYNC` is enabled and at least one issue has tracked time with a tracker comment already on GitHub.

1. [x] Close the popup if it is open
2. [x] Open the popup
3. [x] In the **popup DevTools console**, confirm you see no errors
4. [x] Confirm a network request to `api.github.com` was made (check the **Network** tab in popup DevTools, filter `api.github.com`)
5. [x] Confirm `trackedTimes` in `chrome.storage.local` was not corrupted — open popup DevTools console and run:
   ```js
   chrome.storage.local.get(['trackedTimes'], console.log)
   ```
6. [x] **Expected result:** `trackedTimes` is an array; entries from GitHub were merged (no duplicate removal of local-only entries)

**Disable** `AUTO_SYNC`, repeat steps 2–4, and confirm **no** `api.github.com` request fires. Re-enable when done.
Validated no api request fires when `AUTO_SYNC` is disabled, and that `trackedTimes` merges correctly without duplicates or data loss. No errors were observed in the console during sync.
---

## Flow 2 – Popup: timer start and stop

**Code path:** `TimerService.startTimer` → `StorageService.set(ACTIVE_ISSUE, START_TIME)` → `TimerService.stopTimer` → `StorageService.set(TRACKED_TIMES)` + `removeMultiple([ACTIVE_ISSUE, START_TIME])` → `TimerService.syncComment` → `chrome.runtime.sendMessage(syncTrackerComment)`
**Setup:** Navigate to the popup. Have an issue URL ready (use the `/owner/repo/issues/N` path format).

### Start timer

1. [x] In the popup, find an issue and click **Start Timer**
2. [x] Open popup DevTools console and run:
   ```js
   chrome.storage.local.get(['activeIssue', 'startTime'], console.log)
   ```
3. [x] **Expected result:** `activeIssue` equals the issue path (`/owner/repo/issues/N`); `startTime` is a valid ISO timestamp
> 
4. [x] The popup displays the running timer for the active issue

### Stop timer

5. [x] Wait at least 5 seconds, then click **Stop Timer** (or equivalent)
6. [x] In the popup DevTools console, run:
   ```js
   chrome.storage.local.get(['activeIssue', 'startTime', 'trackedTimes'], console.log)
   ```
7. [x] **Expected result:**
   - `activeIssue` is `null` or absent
   - `startTime` is `null` or absent
   - `trackedTimes` contains a new entry with `issueUrl`, `date`, `seconds > 0`, `title`
8. [x] In the **background service worker DevTools**, confirm `[TrackerSync][background]` log lines appear:
   - `Queueing tracker sync`
   - `Starting tracker sync job`
   - `Tracker sync job completed`
9. [x] Navigate to the GitHub issue in the browser and confirm the tracker comment was created or updated

---

## Flow 3 – Content script: timer button injection

**Code path:** `content/index.js:22-29` → `checkContainer` → `debouncedInjectTimerButton` → `injectTimerButton.js`
**Setup:** Navigate to a GitHub issue page (e.g. `https://github.com/owner/repo/issues/42`).

### Initial injection

1. [x] On a GitHub issue page, confirm the **Track Time** button is visible in the issue metadata sidebar (right column)
2. [x] Open DevTools on the issue page and confirm no extension errors in the console
3. [x] Button element has `id="track-time-btn"`

### Button shows correct state

4. [x] If no timer is running for this issue, button shows `0:00:00 Start Timer` (or similar idle text)
5. [x] If a timer is running for this issue, button shows elapsed time and updates every second

### Start timer from content script

6. [x] Click the **Track Time** button to start the timer
7. [x] Run in the issue page console:
   ```js
   chrome.storage.local.get(['activeIssue', 'startTime'], console.log)
   ```
8. [x] **Expected result:** `activeIssue` equals `location.pathname`; `startTime` is a valid ISO timestamp
9. [x] Button text updates every second to show elapsed time

### Stop timer from content script

10. [x] Click the button again to stop the timer
11. [x] Run in the issue page console:
    ```js
    chrome.storage.local.get(['activeIssue', 'startTime', 'trackedTimes'], console.log)
    ```
12. [x] **Expected result:** `activeIssue` and `startTime` are cleared; `trackedTimes` has a new entry for this issue
13. [x] Confirm tracker sync logs appear in the background service worker DevTools (same as Flow 2 step 8)

### Storage-event re-inject

14. [x] Navigate to a GitHub issue page and wait for the button to appear
15. [x] Start a timer **from the popup** for the same issue
16. [x] **Expected result:** The content-script button updates to show the running timer without a page reload
17. [x] Stop the timer from the popup
18. [x] **Expected result:** The content-script button resets to idle state

---

## Flow 4 – Background: sync queue serialization

**Code path:** `queueTrackerCommentSync` in `background/index.js:83-116` — per-issue promise chain preventing out-of-order writes
**Setup:** Have an issue with existing tracked time.

1. [x] Start a timer in the popup, immediately stop it, immediately delete the newly created session (via the tracked list), all within ~2 seconds
2. [x] In the background service worker console, confirm the sync log shows **sequential** job execution:
   - `Queueing tracker sync behind pending job` (if a job was already running)
   - Each `Starting tracker sync job` appears **after** the previous `Tracker sync job completed`
3. [x] **Expected result:** No interleaved log lines; the tracker comment on GitHub reflects the final correct state (not an intermediate state)

---

## Flow 5 – Repo pin: auto-sync

**Code path:** `useIssuesData.js:70-73` → `PinnedReposService.addPinnedRepo` → `syncRepoFromGitHub` (when `AUTO_SYNC` is enabled)
**Setup:** `AUTO_SYNC` is enabled. Unpin a repo that has tracker comments on GitHub (so sync has data to pull).

1. [x] In the popup Settings, unpin the repo
2. [x] Pin the repo again
3. [x] In the popup DevTools console, confirm a network request to `api.github.com` fires immediately after pinning
4. [x] Confirm `trackedTimes` is updated with any entries pulled from GitHub comments for that repo
5. [x] **Expected result:** No errors in the console; data from GitHub is merged into local storage

**Disable** `AUTO_SYNC`, repeat steps 2–4, and confirm **no** sync request fires on pin. Re-enable when done.

---

## Flow 6 – Session delete and edit

**Code path:** `TimerService.deleteSession` / `TimerService.updateSessionTime` → `StorageService.set(TRACKED_TIMES)` → `syncComment`
### Delete

1. [x] In the popup tracked list, delete a session
2. [x] Run in popup DevTools console:
   ```js
   chrome.storage.local.get(['trackedTimes'], console.log)
   ```
3. [x] **Expected result:** Session is absent from `trackedTimes`
4. [x] Tracker sync fires — confirm in background service worker logs

### Edit

5. [x] In the popup tracked list, edit a session's time (change duration)
6. [x] Run in popup DevTools console:
   ```js
   chrome.storage.local.get(['trackedTimes'], console.log)
   ```
7. [x] **Expected result:** Session's `seconds` field reflects the new value; no duplicate entry
8. [x] Tracker sync fires — confirm in background service worker logs

---

## Gate A sign-off

All boxes above must be ticked before beginning any VS Code work.

Copy and paste the table below as a comment on GitHub issue #16 when done:

```markdown
## Gate A – browser parity verification

| Flow                                         | Result | Notes |
|----------------------------------------------|--------|-------|
| Flow 1 – Popup auto-sync on open             | ✅ / ❌  |       |
| Flow 2 – Popup timer start and stop          | ✅ / ❌  |       |
| Flow 3 – Content script button injection     | ✅ / ❌  |       |
| Flow 4 – Background sync queue serialization | ✅ / ❌  |       |
| Flow 5 – Repo pin auto-sync                  | ✅ / ❌  |       |
| Flow 6 – Session delete and edit             | ✅ / ❌  |       |

**Verdict:** ✅ All flows pass — proceeding to M2 / ❌ Blocked — see notes above
```
