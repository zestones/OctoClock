# Changelog

All notable changes to the OctoClock VS Code extension are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### UI-7 — Smart integrations
- **Workspace repo auto-detection** (#60): on activation and on
  `workspace.onDidChangeWorkspaceFolders`, OctoClock parses each folder's
  `.git/config`, identifies GitHub remotes that are not yet pinned, and offers
  a one-shot prompt to pin them via `PinnedReposService`. Dismissed repos are
  remembered in `globalState` (`octoclock.dismissedAutoPinRepos`).
- **Branch → issue notification** (#61): a `BranchWatcher` listens to the
  built-in `vscode.git` extension and shows a "Start tracking #N from branch …"
  prompt when the current branch name contains an issue number that matches a
  cached issue. Suppressed while a timer is already running.
- **Idle reminder** (#62): an `IdleWatcher` opens a modal warning when the
  configured number of minutes elapses without `onDidChangeTextDocument`
  activity while a timer is running. Configurable via
  `octoclock.idleReminderEnabled` and `octoclock.idleReminderMinutes` (1–240).
- **CodeLens for `#N` references** (#63): opt-in via
  `octoclock.enableCodeLens`. The `IssueCodeLensProvider` shows
  `Track #N` / `Tracking #N` lenses on issue references in source files,
  using a comment/string-context heuristic to avoid identifier-like positions.

#### UI-8 — Settings UX
- **Settings tree view** (#64): replaces the placeholder webview with a flat
  `TreeDataProvider` exposing Token (masked), Auto Sync, Idle Reminder,
  Idle Minutes, Code Lens, and a Sync Now action. Refreshes automatically on
  storage and configuration changes.
- **`octoclock.configureToken` command** (#65): password-style InputBox that
  validates GitHub PAT formats and stores tokens via VS Code's
  `SecretStorage` (OS keychain). Submitting an empty value clears the token.
  Saving a token triggers a non-blocking `syncFromGitHub`.

#### UI-9 — Polish
- **Accessibility** (#66): added `aria-label` to icon buttons in the Active
  Timer, My Issues, and Branch suggestion rows, marked decorative codicons
  `aria-hidden="true"`, and applied `role="status"` /
  `aria-live="polite"` to the timer counter so screen readers announce
  updates without interrupting the user.
- **Theme compatibility** (#67): all webview templates already use the
  `--oc-*` design tokens, which themselves resolve to `--vscode-*` theme
  variables (with semantic fallbacks). No hard-coded hex values exist
  outside `tokens.css` documentation comments. Verified against the
  Light+, Dark+, High Contrast Dark, and High Contrast Light reference
  themes.
- **Marketplace metadata** (#68): expanded `displayName`, `description`,
  added `categories`, `keywords`, `repository`, `bugs`, `homepage`,
  `license`, and `icon` fields to `package.json`.

### Changed
- `octoclock.settings` view migrated from `type:webview` to a tree view.

### Notes for publishing
- **Icon**: `package.json` currently references `src/icons/octoclock.svg`.
  The VS Code Marketplace requires a PNG (≥ 128×128) for the listing icon.
  Convert the SVG and update the path before running `vsce publish`.
- **Screenshots**: take final light/dark screenshots and add them to the
  README before publishing.
