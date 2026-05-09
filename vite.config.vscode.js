import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Build the VS Code extension as a single CJS bundle.
//
// Key constraints:
// - format: 'cjs'   — VS Code extension host loads extensions via require().
// - external: vscode — provided by the extension host; must never be bundled.
// - minify: false   — keeps stack traces readable during development.
// - sourcemap: true — enables debugging in the Extension Development Host.

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'packages/vscode-ext/src/extension.js'),
            formats: ['cjs'],
            fileName: () => 'extension.js',
        },
        rollupOptions: {
            external: ['vscode'],
        },
        outDir: 'packages/vscode-ext/dist',
        emptyOutDir: true,
        sourcemap: true,
        minify: false,
        target: 'node18',
    },
});
