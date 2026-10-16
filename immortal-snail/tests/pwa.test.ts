import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyticsAllowed } from '../src/analytics';
import { isIosSafari, shouldShowInstallHint, type Device } from '../src/pwa/installHint';
import { fillHtml, htmlTokens, precacheList, serviceWorkerSource, webManifest } from '../src/pwa/precache';
import { canUseServiceWorker } from '../src/pwa/register';
import { SITE } from '../src/site';

describe('site config', () => {
  it('is the one place for the name and address', () => {
    expect(SITE.name).toBe('Snailmate Chess');
    expect(SITE.shortName.length).toBeLessThanOrEqual(12); // fits under a home-screen icon
    expect(SITE.url).toMatch(/^https:\/\/[a-z0-9.-]+$/);
  });

  it('fills every placeholder in index.html, and only known ones', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const out = fillHtml(html, htmlTokens(SITE));
    expect(out).not.toMatch(/%SITE_[A-Z_]+%/);
    expect(out).toContain(`<title>${SITE.name}</title>`);
    expect(out).toContain(`<meta property="og:image" content="${SITE.url}/og.png" />`);
    expect(out).toContain(`<meta property="og:url" content="${SITE.url}/" />`);
    expect(out).toContain('viewport-fit=cover');
    expect(out).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(out).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(() => fillHtml('<p>%SITE_NOPE%</p>', htmlTokens(SITE))).toThrow(/SITE_NOPE/);
    expect(fillHtml('<p title="%SITE_NAME%">', { SITE_NAME: 'A "B" & <C>' })).toBe('<p title="A &quot;B&quot; &amp; &lt;C&gt;">');
  });
});

describe('web app manifest', () => {
  it('installs as a standalone app with the game colours and all icons', () => {
    const m = webManifest(SITE);
    expect(m).toMatchObject({ name: SITE.name, short_name: SITE.shortName, start_url: './', display: 'standalone', background_color: SITE.colors.light });
    expect(m.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
  });

  /** A PNG's width x height, from its header. */
  const pngSize = (file: string) => {
    const png = readFileSync(new URL(`../public/${file}`, import.meta.url));
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    return `${view.getUint32(16)}x${view.getUint32(20)}`;
  };

  it('points at icons that exist, at their real sizes', () => {
    for (const icon of webManifest(SITE).icons) expect(pngSize(icon.src)).toBe(icon.sizes);
    expect(pngSize('og.png')).toBe('1200x630');
    // WhatsApp and some other apps drop link-preview images over about 300 KB.
    expect(readFileSync(new URL('../public/og.png', import.meta.url)).byteLength).toBeLessThan(300 * 1024);
    expect(pngSize('apple-touch-icon.png')).toBe('180x180');
    expect(pngSize('favicon-32.png')).toBe('32x32');
    expect(pngSize('favicon-16.png')).toBe('16x16');
  });
});

describe('offline cache', () => {
  it('keeps every built file except the worker itself, the preview image and source maps', () => {
    const files = [
      'index.html',
      'sw.js',
      'og.png',
      'manifest.webmanifest',
      'assets/index-abc.js',
      'assets/index-abc.js.map',
      'assets/ai.worker-def.js',
      'icons\\icon-192.png',
      './favicon.svg',
      '.DS_Store',
      'THIRD-PARTY-NOTICES.txt',
    ];
    expect(precacheList(files)).toEqual(['./', 'assets/ai.worker-def.js', 'assets/index-abc.js', 'favicon.svg', 'icons/icon-192.png', 'manifest.webmanifest']);
  });

  it('builds the service worker from the template', () => {
    const template = readFileSync(new URL('../src/pwa/sw-template.js', import.meta.url), 'utf8');
    const sw = serviceWorkerSource(template, ['./', 'assets/a.js'], 'abc123');
    expect(sw).toContain('const VERSION = "abc123";');
    expect(sw).toContain('const PRECACHE = ["./","assets/a.js"];');
    expect(sw).not.toMatch(/__PRECACHE__|__VERSION__/);
    // A new version waits for the next launch instead of taking over a running game: it never
    // skips waiting by itself, only when the page asks (at launch).
    const install = sw.split("addEventListener('install'")[1].split('addEventListener(')[0];
    expect(install).not.toContain('skipWaiting');
    expect(sw).toMatch(/type === 'SKIP_WAITING'\) self\.skipWaiting\(\)/);
    expect(() => serviceWorkerSource('const x = 1;', [], 'v')).toThrow();
  });

  it('is only used on the built site over http(s), never in dev or the desktop app', () => {
    expect(canUseServiceWorker('https:', true)).toBe(true);
    expect(canUseServiceWorker('http:', true)).toBe(true);
    expect(canUseServiceWorker('https:', false)).toBe(false);
    expect(canUseServiceWorker('app:', true)).toBe(false);
    expect(canUseServiceWorker('file:', true)).toBe(false);
  });
});

describe('analytics', () => {
  it('only on the built site on a real host', () => {
    const at = (protocol: string, hostname: string, prod = true) => analyticsAllowed({ protocol, hostname }, prod);
    expect(at('https:', 'snailmate-chess.vercel.app')).toBe(true);
    expect(at('https:', 'snailmate-chess.vercel.app', false)).toBe(false);
    expect(at('app:', 'snail')).toBe(false);
    expect(at('file:', '')).toBe(false);
    expect(at('http:', 'localhost')).toBe(false);
    expect(at('http:', '127.0.0.1')).toBe(false);
    expect(at('http:', '[::1]')).toBe(false);
  });
});

describe('Add to Home Screen hint', () => {
  const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  const device = (userAgent: string, extra: Partial<Device> = {}): Device => ({ userAgent, platform: 'iPhone', maxTouchPoints: 5, standalone: false, ...extra });

  it('shows in iPhone and iPad Safari until closed, and not on the home screen', () => {
    expect(shouldShowInstallHint(device(SAFARI), false)).toBe(true);
    expect(shouldShowInstallHint(device(SAFARI), true)).toBe(false);
    expect(shouldShowInstallHint(device(SAFARI, { standalone: true }), false)).toBe(false);
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
    expect(isIosSafari({ userAgent: ipad, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIosSafari({ userAgent: ipad, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false); // a real Mac
  });

  it('stays away from other browsers and in-app web views', () => {
    const chromeIos = SAFARI.replace('Version/18.5', 'CriOS/140.0.0.0');
    const instagram = `${SAFARI} Instagram 350.0.0`;
    const facebook = SAFARI.replace('Safari/604.1', '[FBAN/FBIOS;FBAV/500.0]');
    const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
    for (const ua of [chromeIos, instagram, facebook, android]) expect(shouldShowInstallHint(device(ua), false)).toBe(false);
  });
});
