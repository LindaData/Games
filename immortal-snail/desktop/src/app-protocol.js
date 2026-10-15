'use strict';
/**
 * The `app://snail/` scheme. The game is served from this privileged custom scheme instead of
 * file:// so that it gets a real, stable origin: its module Web Worker loads, localStorage
 * persists (in userData) and the Content Security Policy below can say 'self'.
 *
 * Pure Node (no Electron imports) so the path handling is easy to test on its own.
 */
const fs = require('node:fs');
const path = require('node:path');

const APP_SCHEME = 'app';
const APP_HOST = 'snail';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const START_URL = `${APP_ORIGIN}/index.html`;

/** Registered with protocol.registerSchemesAsPrivileged before the app is ready. */
const SCHEME_PRIVILEGES = {
  standard: true, // a real origin (localStorage, relative URLs, module workers)
  secure: true, // treated like https (secure context)
  supportFetchAPI: true, // fetch() and the Worker script loader can read it
  corsEnabled: true,
  stream: true,
  codeCache: true,
};

// Everything the game needs comes from the app itself. Styles allow 'unsafe-inline' only because
// UI libraries sometimes set style attributes; no script can be inline or remote.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

function mimeType(file) {
  return MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Map an app:// URL to a file inside `root`, or null when the URL is not ours or would escape
 * `root` (encoded ..%2f, backslashes, drive letters, NUL bytes, other hosts...).
 * `p` is the path module (path.win32 in tests).
 */
function resolveAppPath(root, requestUrl, p = path) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) return null;

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null; // malformed percent-encoding
  }
  if (pathname.includes('\0')) return null;
  if (pathname === '' || pathname.endsWith('/') || pathname.endsWith('\\')) pathname += 'index.html';

  const base = p.resolve(root);
  const relative = p.normalize(pathname).replace(/^[/\\]+/, '');
  const full = p.resolve(base, relative);
  if (full !== base && !full.startsWith(base + p.sep)) return null;
  return full;
}

const plain = (status, text) =>
  new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
  });

/** A protocol.handle() handler that serves files from `root`. */
function createAppProtocolHandler(root) {
  return async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return plain(405, 'Method not allowed');
    const file = resolveAppPath(root, request.url);
    if (!file) return plain(404, 'Not found');
    let body;
    try {
      body = await fs.promises.readFile(file);
    } catch {
      return plain(404, 'Not found');
    }
    return new Response(request.method === 'HEAD' ? null : body, {
      status: 200,
      headers: {
        'Content-Type': mimeType(file),
        'Content-Length': String(body.length),
        'Content-Security-Policy': CSP,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      },
    });
  };
}

module.exports = {
  APP_SCHEME,
  APP_HOST,
  APP_ORIGIN,
  START_URL,
  SCHEME_PRIVILEGES,
  CSP,
  mimeType,
  resolveAppPath,
  createAppProtocolHandler,
};
