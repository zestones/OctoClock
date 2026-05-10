import { resolve } from 'node:path';
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
// Entry points:
//   webview/sidebar/app.js   — bundle for all five sidebar panels
//   webview/dashboard/app.js — bundle for the full-screen dashboard panel

const webviewDir = resolve(__dirname, 'packages/vscode-ext/src/webview');
const outDir = resolve(__dirname, 'packages/vscode-ext/dist/webview');

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                sidebar: resolve(webviewDir, 'sidebar/app.js'),
                dashboard: resolve(webviewDir, 'dashboard/app.js'),
            },
            output: {
                format: 'es',
                entryFileNames: '[name]/app.js',
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
