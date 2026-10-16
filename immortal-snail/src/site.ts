/**
 * The game's name, public URL and look, in one place (`site.json`). Everything else reads them
 * from here: the page title and link-preview tags (index.html, filled in at build time by
 * vite-plugin-site.ts), the web app manifest, the header, the Share texts and the art script
 * (scripts/make-web-art.mjs). To rename the game or move it to another domain, edit site.json.
 *
 * Not from here: the desktop app's names (desktop/package.json, desktop/electron-builder.yml) and
 * the Steam kit (steam/), which have their own configs.
 */
import site from './site.json';

export interface Site {
  /** "Snailmate Chess" */
  name: string;
  /** Under the home-screen icon (about 12 characters fit). */
  shortName: string;
  /** The public address, no trailing slash. Used in Share links and link previews. */
  url: string;
  description: string;
  tagline: string;
  /** Page backgrounds (src/index.css --bg), light and dark. */
  colors: { light: string; dark: string };
}

export const SITE: Site = site;
