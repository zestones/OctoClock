import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [],
    build: {
        rollupOptions: {
            input: resolve(__dirname, 'src/background/index.js'),
            output: {
                entryFileNames: 'background.js',
                inlineDynamicImports: true,
            },
        },
        outDir: 'dist',
        emptyOutDir: false,
        // minify: false
    },
});
