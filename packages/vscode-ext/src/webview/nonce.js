// packages/vscode-ext/src/webview/nonce.js
//
// Generates a cryptographically random nonce for use in Content-Security-Policy
// headers and matching <script nonce="..."> / <style nonce="..."> attributes.
//
// The nonce is regenerated on every call — providers must use the same value
// returned from a single getNonce() call for both the CSP header and the HTML
// template rendered in that request.

// @ts-ignore — node:crypto is a Node.js built-in available in the VS Code
// extension host (Node.js 18+). The project's jsconfig.json does not include
// @types/node to avoid type conflicts with @types/chrome in the browser-ext
// workspace package.
import { randomBytes } from 'node:crypto';

/**
 * Returns a 32-character hex nonce (128 bits of cryptographic randomness).
 *
 * @returns {string}
 */
export function getNonce() {
    return randomBytes(16).toString('hex');
}
