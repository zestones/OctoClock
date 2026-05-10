import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Build the VS Code extension host as a single CJS bundle.
//
// Key constraints:
// - format: 'cjs'   — VS Code extension host loads extensions via require().
// - external: vscode — provided by the extension host; must never be bundled.
// - minify: false   — keeps stack traces readable during development.
// - sourcemap: true — enables debugging in the Extension Development Host.
//
// Also copies the codicons font to dist/fonts/ so it can be served via
// webview.asWebviewUri() without network access.

/** @returns {import('vite').Plugin} */
function copyCodiconsFont() {
    return {
        name: 'copy-codicons-font',
        closeBundle() {
            const src = resolve(__dirname, 'node_modules/@vscode/codicons/dist/codicon.ttf');
            const destDir = resolve(__dirname, 'packages/vscode-ext/dist/fonts');
            mkdirSync(destDir, { recursive: true });
            copyFileSync(src, resolve(destDir, 'codicon.ttf'));
        },
    };
}

export default defineConfig({
    plugins: [copyCodiconsFont()],
    build: {
        lib: {
            entry: resolve(__dirname, 'packages/vscode-ext/src/extension.js'),
            formats: ['cjs'],
            fileName: () => 'extension.js',
        },
        rollupOptions: {
            // 'vscode' is provided by the extension host at runtime.
            // /^node:/ externalises all Node.js built-in modules (e.g.
            // node:crypto used by nonce.js) so they are required() at
            // runtime rather than bundled into the CJS output.
            external: ['vscode', /^node:/],
        },
        outDir: 'packages/vscode-ext/dist',
        emptyOutDir: true,
        sourcemap: true,
        minify: false,
        target: 'node18',
    },
});
