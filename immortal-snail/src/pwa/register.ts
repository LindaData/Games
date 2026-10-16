/**
 * Registers the offline service worker (sw.js, built by vite-plugin-site.ts) on the web version.
 * Never in dev (Vite serves unbuilt files) and never in the desktop app, whose app:// pages are
 * not http(s).
 *
 * Updates: a new version downloads in the background while the old one keeps running, then waits.
 * When the page next launches and finds a version waiting, it lets it take over and reloads once,
 * right away, before anyone has tapped anything (the game is saved, so nothing is lost). A tab or
 * home-screen app left open checks for a new version whenever it comes back to the foreground.
 */

/** Only built pages served over http(s). */
export function canUseServiceWorker(protocol: string, production: boolean): boolean {
  return production && (protocol === 'https:' || protocol === 'http:');
}

export function registerServiceWorker(): void {
  if (!canUseServiceWorker(window.location.protocol, import.meta.env.PROD) || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  window.addEventListener('load', () => {
    sw.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then((reg) => {
        // A version installed during an earlier visit is still waiting: take it now, at launch.
        if (reg.waiting && sw.controller) {
          let reloaded = false;
          sw.addEventListener('controllerchange', () => {
            if (reloaded) return;
            reloaded = true;
            window.location.reload();
          });
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch(() => {
        /* no offline support (private mode, blocked): the game works without it */
      });
  });
}
