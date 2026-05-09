import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    plugins: [
        preact(),
        viteStaticCopy({
            targets: [
                {
                    src: 'popup.html',
                    dest: '',
                },
            ],
        }),
        cssInjectedByJsPlugin(),
        tailwindcss(),
    ],
    build: {
        rollupOptions: {
            input: resolve(__dirname, 'popup.jsx'),
            output: {
                entryFileNames: 'popup.js',
                inlineDynamicImports: true,
            },
        },
        outDir: 'dist',
        emptyOutDir: false,
        // minify: false
    },
});
