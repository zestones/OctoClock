// packages/vscode-ext/src/webview/webview-globals.d.ts
//
// Type declarations for globals injected by VS Code into every
// webview context. These are NOT available in the extension host —
// only inside <script> tags within WebviewView / WebviewPanel HTML.
//
// acquireVsCodeApi is injected at webview load time and is callable
// exactly once per webview lifetime.

interface VsCodeApi<T = unknown> {
    postMessage(message: unknown): void;
    getState(): T | undefined;
    setState(state: T): void;
}

declare function acquireVsCodeApi<T = unknown>(): VsCodeApi<T>;
