// packages/vscode-ext/src/webview/csp.js
//
// Single source of truth for Content-Security-Policy headers used by every
// OctoClock WebviewView and WebviewPanel provider.
//
// Usage in a provider:
//
//   const nonce = getNonce();
//   const csp   = buildCsp(nonce, webview);
//
//   return `<!DOCTYPE html>
//   <html>
//   <head>
//     <meta http-equiv="Content-Security-Policy" content="${csp}">
//     <script nonce="${nonce}" src="${scriptUri}"></script>
//     <link rel="stylesheet" href="${tokenUri}">
//   </head>
//   ...`;

/**
 * Builds the Content-Security-Policy string for an OctoClock webview.
 *
 * Directives:
 *   default-src  'none'          — deny everything not listed below
 *   script-src   'nonce-<N>'     — only scripts carrying the matching nonce run
 *   style-src    cspSource nonce — stylesheets from localResourceRoots + <style nonce>
 *   img-src      cspSource https: data:
 *                                — local icons, remote GitHub avatars, data URIs
 *   font-src     cspSource       — codicons font from localResourceRoots
 *
 * No connect-src is set: webview↔host communication uses postMessage only
 * and does not require network access.
 *
 * @param {string} nonce                        - Random nonce from getNonce()
 * @param {import('vscode').Webview} webview    - VS Code Webview instance
 * @returns {string}
 */
export function buildCsp(nonce, webview) {
    const src = webview.cspSource;
    return [
        `default-src 'none'`,
        `script-src 'nonce-${nonce}'`,
        `style-src ${src} 'nonce-${nonce}'`,
        `img-src ${src} https: data:`,
        `font-src ${src}`,
    ].join('; ');
}
