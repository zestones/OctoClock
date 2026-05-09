// packages/vscode-ext/e2e/run-tests.mjs
//
// Launches a headless VS Code instance that loads the OctoClock extension
// and runs the e2e test suite inside the extension host.
//
// Usage (from repo root):
//   pnpm run test:e2e
//
// The extension must be built before running:
//   pnpm run build:vscode

import { runTests } from '@vscode/test-electron';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
    await runTests({
        /** Load the extension from its package root (contains package.json + dist/). */
        extensionDevelopmentPath: resolve(__dirname, '..'),

        /**
         * Path to the CJS module that exports `run()`.
         * @vscode/test-electron loads this file inside the extension host
         * and calls `run()` — any rejection is treated as a test failure.
         */
        extensionTestsPath: resolve(__dirname, 'suite/index.cjs'),

        launchArgs: [
            '--disable-extensions', // only our extension — no interference
            '--no-sandbox',         // required in some CI / remote-SSH envs
        ],
    });
} catch (err) {
    console.error('\ne2e tests failed:', err?.message ?? err);
    process.exit(1);
}
