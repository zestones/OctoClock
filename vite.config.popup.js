import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';
import {viteStaticCopy} from "vite-plugin-static-copy";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [
        preact(),
        viteStaticCopy({
            targets: [
                {
                    src: 'popup.html',
                    dest: ''
                }
            ]
        }),
        cssInjectedByJsPlugin(),
        tailwindcss()
    ],
    build: {
        rollupOptions: {
            input: resolve(__dirname, 'popup.jsx'),
            output: {
                entryFileNames: 'popup.js',
                inlineDynamicImports: true
            }
        },
        outDir: 'dist',
        emptyOutDir: false,
        // minify: false
    }
});
