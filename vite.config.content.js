import { defineConfig } from 'vite';
import { resolve } from 'path';
import preact from "@preact/preset-vite";
import {viteStaticCopy} from "vite-plugin-static-copy";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

export default defineConfig({
    plugins: [
        preact(),
        viteStaticCopy({
            targets: [
                {
                    src: 'manifest.json',
                    dest: '.'
                }
            ]
        }),
        cssInjectedByJsPlugin(),
    ],
    build: {
        rollupOptions: {
            input: resolve(__dirname, 'src/content/index.js'),
            output: {
                entryFileNames: 'content.js',
                inlineDynamicImports: true
            }
        },
        outDir: 'dist',
        emptyOutDir: false,
        // minify: false
    }
});
