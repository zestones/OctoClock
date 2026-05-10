import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

// Build the VS Code webview bundles as browser-targeted ES modules.
//
// Each entry point produces a self-contained script loaded by its
// corresponding WebviewView / WebviewPanel provider via webview HTML.
//
// Key constraints:
// - format: 'es'    — standard ES module; loaded with <script type="module"
//                     nonce="…"> which is fully supported by VS Code's
//                     Chromium-based webview renderer (1.85+).
// - target: es2022  — modern JS; VS Code 1.85+ ships a modern Chromium.
// - minify: false   — readable source during development.
// - sourcemap: true — enables DevTools debugging in the webview.
//
// Entry points (one per sidebar panel + dashboard):
//   sidebar/active-timer/view/app.jsx  — Active Timer panel
//   sidebar/my-issues/view/app.jsx     — My Issues panel
//   dashboard/app.js                   — full-screen dashboard panel

const webviewSrc = resolve(__dirname, 'packages/vscode-ext/src/webview');
const webviewDir = webviewSrc;
const outDir = resolve(__dirname, 'packages/vscode-ext/dist/webview');

/**
 * Copies static CSS assets from src/webview/ to dist/webview/ so that
 * html.js shells can reference them via webview.asWebviewUri().
 *
 * Files copied:
 *   tokens.css            — --oc-* design tokens (theme-aware)
 *   shared/components.css — shared layout + component classes
 *
 * @returns {import('vite').Plugin}
 */
function copyWebviewCss() {
    return {
        name: 'copy-webview-css',
        closeBundle() {
            mkdirSync(resolve(outDir, 'shared'), { recursive: true });
            copyFileSync(resolve(webviewSrc, 'tokens.css'), resolve(outDir, 'tokens.css'));
            copyFileSync(resolve(webviewSrc, 'shared/components.css'), resolve(outDir, 'shared/components.css'));
        },
    };
}

export default defineConfig({
    plugins: [preact(), copyWebviewCss()],
    build: {
        rollupOptions: {
            input: {
                'sidebar/active-timer/app': resolve(webviewDir, 'sidebar/active-timer/view/app.jsx'),
                'sidebar/my-issues/app': resolve(webviewDir, 'sidebar/my-issues/view/app.jsx'),
                'sidebar/team-stats/app': resolve(webviewDir, 'sidebar/team-stats/view/app.jsx'),
                'dashboard/app': resolve(webviewDir, 'dashboard/app.js'),
            },
            output: {
                format: 'es',
                entryFileNames: '[name].js',
                // No code-splitting for webview bundles — each view gets a
                // single self-contained file.
                chunkFileNames: '[name]/chunk.js',
                assetFileNames: '[name][extname]',
            },
        },
        outDir,
        emptyOutDir: false,
        sourcemap: true,
        minify: false,
        target: 'es2022',
    },
});
