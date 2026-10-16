/*
 * Service worker for the web version: offline play. Built into sw.js by vite-plugin-site.ts, which
 * fills in the list of built files and a version that changes whenever any of them changes.
 * Registered by src/pwa/register.ts on http(s) only, never in the desktop app or in dev.
 *
 * - install: download every built file into a cache named after the version. No skipWaiting():
 *   while an older version runs, the new one waits, and the page switches to it on its next launch.
 * - activate: delete older versions' caches and take control.
 * - fetch: cache first for the built files (every app page gets the cached index.html); anything
 *   else (analytics, other sites) goes to the network untouched.
 */
const VERSION = __VERSION__;
const PRECACHE = __PRECACHE__;
const PREFIX = 'snailmate-';
const CACHE = `${PREFIX}${VERSION}`;

const scopeUrl = (path) => new URL(path, self.registration.scope).href;
const SHELL = scopeUrl('./');
const PRECACHED = new Set(PRECACHE.map(scopeUrl));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((path) => new Request(scopeUrl(path), { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PREFIX) && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

// The page asks a waiting new version to take over (only right at launch, see register.ts).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/** One of the app's pages: the root, index.html, or a path without a file extension. */
function isAppPage(url) {
  if (!url.href.startsWith(self.registration.scope)) return false;
  const last = url.pathname.split('/').pop();
  return last === '' || last === 'index.html' || !last.includes('.');
}

/** A cached redirect can't answer a navigation, so hand back a plain copy of it. */
async function plain(response) {
  if (!response.redirected) return response;
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const key = request.mode === 'navigate' && isAppPage(url) ? SHELL : url.origin + url.pathname;
  if (!PRECACHED.has(key)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(key);
      return hit ? plain(hit) : fetch(request);
    })(),
  );
});
