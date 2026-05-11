import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];

if (!version) {
    console.error('Usage: node ./scripts/sync-version.mjs <version>');
    process.exit(1);
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
    'package.json',
    'packages/browser-ext/package.json',
    'packages/browser-ext/manifest.json',
    'packages/core/package.json',
    'packages/vscode-ext/package.json',
];

for (const relativePath of files) {
    const filePath = resolve(rootDir, relativePath);
    const json = JSON.parse(readFileSync(filePath, 'utf8'));

    if (json.version === version) continue;

    json.version = version;
    writeFileSync(filePath, `${JSON.stringify(json, null, 4)}\n`);
    console.log(`Updated ${relativePath} -> ${version}`);
}