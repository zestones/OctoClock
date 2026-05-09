// packages/vscode-ext/e2e/suite/index.cjs
//
// Extension host test entry point for @vscode/test-electron.
//
// This file is loaded inside the VS Code extension host process.
// It must export a `run()` function; @vscode/test-electron calls it and
// treats any thrown / rejected error as a test failure.
//
// We deliberately avoid Mocha globals (describe/it) because the extension
// host's sandboxed module loader prevents global pollution from Mocha.
// Instead we use a minimal inline runner with plain Node.js `assert`.

'use strict';

const assert = require('node:assert');
const vscode = require('vscode');

const EXT_ID = 'zestones.octoclock';

const COMMANDS = [
    'octoclock.startTimer',
    'octoclock.stopTimer',
    'octoclock.syncNow',
    'octoclock.pinRepo',
    'octoclock.unpinRepo',
    'octoclock.deleteSession',
    'octoclock.editSession',
];

// ---------------------------------------------------------------------------
// Tiny inline runner — no external test framework needed
// ---------------------------------------------------------------------------

/** @type {{ name: string; err: Error }[]} */
const failures = [];
let passed = 0;

/**
 * @param {string} name
 * @param {() => Promise<void> | void} fn
 */
async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✓  ${name}`);
        passed++;
    } catch (/** @type {any} */ err) {
        console.error(`  ✗  ${name}`);
        console.error(`     ${err?.message ?? err}`);
        failures.push({ name, err });
    }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

exports.run = async function run() {
    // Activate the extension if it hasn't been activated yet.
    const ext = vscode.extensions.getExtension(EXT_ID);
    if (ext && !ext.isActive) {
        await ext.activate();
    }

    console.log('\nOctoClock VS Code Extension — e2e');
    console.log('===================================');

    // -- Presence & activation -----------------------------------------------

    await test('extension is present in the extensions list', async () => {
        assert.ok(ext, `Extension "${EXT_ID}" not found — check publisher + name in package.json`);
    });

    await test('extension is active after activation', async () => {
        assert.ok(ext?.isActive, `Extension "${EXT_ID}" is not active`);
    });

    // -- Command registration ------------------------------------------------

    const allCommands = await vscode.commands.getCommands(/* filterInternal */ true);

    for (const cmd of COMMANDS) {
        await test(`registers command: ${cmd}`, async () => {
            assert.ok(
                allCommands.includes(cmd),
                `Command "${cmd}" is not registered — check registerCommands() in commands.js`,
            );
        });
    }

    // -- Resilience: commands that need no token / active timer ---------------

    await test('stopTimer — no active timer — does not throw', async () => {
        // No timer running → should show a warning message, not throw.
        await vscode.commands.executeCommand('octoclock.stopTimer');
    });

    await test('syncNow — no token — does not throw', async () => {
        // No token stored → should show an error/warning message, not crash.
        await vscode.commands.executeCommand('octoclock.syncNow');
    });

    // -- Summary -------------------------------------------------------------

    const total = passed + failures.length;
    console.log(`\n  ${passed} passing, ${failures.length} failing  (${total} total)\n`);

    if (failures.length > 0) {
        const names = failures.map((f) => `  • ${f.name}`).join('\n');
        throw new Error(`${failures.length} e2e test(s) failed:\n${names}`);
    }
};
