/**
 * What the service worker keeps for offline play, and the web app manifest. Pure functions: the
 * build (vite-plugin-site.ts) feeds them the built files; the tests call them directly.
 */
import type { Site } from '../site';

/** Built files that are never needed offline (or are the service worker itself). */
const SKIP = [/^sw\.js$/, /^og\.png$/, /\.map$/, /(^|\/)\./, /^THIRD-PARTY-NOTICES\.txt$/];

/**
 * The files to precache, as paths relative to the site root ("./" for index.html, "assets/x.js"),
 * sorted so the list (and the service worker built from it) is the same on every build.
 */
export function precacheList(files: readonly string[]): string[] {
  return (
    files
      .map((f) => f.replace(/\\/g, '/').replace(/^\.?\//, ''))
      .filter((f) => f && !SKIP.some((re) => re.test(f)))
      // The page is kept under the site's root address ("./"), which is what the browser asks for.
      .map((f) => (f === 'index.html' ? './' : f))
      .sort()
  );
}

/** The service worker: the template with the file list and the cache version filled in. */
export function serviceWorkerSource(template: string, files: readonly string[], version: string): string {
  for (const token of ['__PRECACHE__', '__VERSION__']) {
    if (template.split(token).length !== 2) throw new Error(`service worker template: ${token} must appear exactly once`);
  }
  return template.replace('__PRECACHE__', JSON.stringify(files)).replace('__VERSION__', JSON.stringify(version));
}

/** The web app manifest (manifest.webmanifest). Paths are relative to the manifest itself. */
export function webManifest(site: Site) {
  return {
    id: './',
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: site.colors.light,
    theme_color: site.colors.light,
    categories: ['games'],
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/** index.html placeholders (%SITE_NAME% …) and what they become. */
export function htmlTokens(site: Site): Record<string, string> {
  return {
    SITE_NAME: site.name,
    SITE_SHORT_NAME: site.shortName,
    SITE_DESCRIPTION: site.description,
    SITE_URL: site.url,
    SITE_COLOR_LIGHT: site.colors.light,
    SITE_COLOR_DARK: site.colors.dark,
  };
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Fill in the %TOKEN% placeholders. An unknown placeholder is an error, so none slips through. */
export function fillHtml(html: string, tokens: Record<string, string>): string {
  return html.replace(/%(SITE_[A-Z_]+)%/g, (_, key: string) => {
    if (!(key in tokens)) throw new Error(`index.html: unknown placeholder %${key}%`);
    return escapeAttr(tokens[key]);
  });
}
