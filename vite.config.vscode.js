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
// Also copies the codicons font + stylesheet to dist/fonts/ so they can be
// served via webview.asWebviewUri() without network access.
// codicon.css contains all .codicon-<name>::before glyph mappings; without
// it the font is loaded but nothing renders.

/** @returns {import('vite').Plugin} */
function copyCodiconsFont() {
    return {
        name: 'copy-codicons-font',
        closeBundle() {
            const srcDir = resolve(__dirname, 'node_modules/@vscode/codicons/dist');
            const destDir = resolve(__dirname, 'packages/vscode-ext/dist/fonts');
            mkdirSync(destDir, { recursive: true });
            copyFileSync(resolve(srcDir, 'codicon.ttf'), resolve(destDir, 'codicon.ttf'));
            copyFileSync(resolve(srcDir, 'codicon.css'), resolve(destDir, 'codicon.css'));
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
