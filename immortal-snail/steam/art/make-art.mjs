#!/usr/bin/env node
/**
 * Renders every Steam graphic and every app icon from the HTML/SVG templates in scenes.mjs.
 *
 *   npm run art                       # from immortal-snail/steam
 *   node art/make-art.mjs --only hero # just the files whose name contains "hero"
 *
 * Writes:
 *   steam/store/art/   header, small, main, vertical capsules; library capsule, header, hero, logo;
 *                      page background; community icon (JPG); client icon (.ico 16+32, 256 PNG)
 *   desktop/build/     icon.png (1024), icon-512.png, icons/NxN.png, icon.ico, icon.icns
 *   desktop/assets/    icon.png (256, the Linux window icon)
 * Then checks every size (verify-art.mjs).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium } from './browser.mjs';
import { encodeIcns, encodeIco } from './images.mjs';
import { fitTitles, iconPage, steamAssets } from './scenes.mjs';
import { verifyArt } from './verify-art.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const steamDir = path.resolve(here, '..');
const artDir = path.join(steamDir, 'store', 'art');
const desktopDir = path.resolve(steamDir, '..', 'desktop');
const buildDir = path.join(desktopDir, 'build');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const wanted = (name) => !only || name.includes(only);

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

const browser = await launchChromium();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(html, width, height, { type = 'png', transparent = false } = {}) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(fitTitles);
  return page.screenshot({
    type,
    quality: type === 'jpeg' ? 92 : undefined,
    omitBackground: transparent,
    clip: { x: 0, y: 0, width, height },
  });
}

function write(file, buf) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, buf);
  console.log(`  ${path.relative(path.resolve(steamDir, '..'), file)}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

try {
  console.log('Steam graphics:');
  for (const a of steamAssets()) {
    if (!wanted(a.file)) continue;
    write(path.join(artDir, a.file), await render(a.html, a.width, a.height, { type: a.type, transparent: a.transparent }));
  }

  if (wanted('icon')) {
    console.log('Icons:');
    const icons = new Map();
    for (const size of ICON_SIZES) icons.set(size, await render(iconPage(size), size, size, { transparent: true }));

    // Steam client icon: .ico with 16 and 32, plus a 256 PNG.
    write(path.join(artDir, 'client_icon.ico'), encodeIco([16, 32].map((size) => ({ size, png: icons.get(size) }))));
    write(path.join(artDir, 'client_icon_256.png'), icons.get(256));

    // Desktop app icons for electron-builder.
    write(path.join(buildDir, 'icon.png'), icons.get(1024));
    write(path.join(buildDir, 'icon-512.png'), icons.get(512));
    for (const size of ICON_SIZES) write(path.join(buildDir, 'icons', `${size}x${size}.png`), icons.get(size));
    write(path.join(buildDir, 'icon.ico'), encodeIco([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, png: icons.get(size) }))));
    write(path.join(buildDir, 'icon.icns'), encodeIcns(icons));
    write(path.join(desktopDir, 'assets', 'icon.png'), icons.get(256));
  }
} finally {
  await browser.close();
}

if (!only) {
  const problems = verifyArt();
  process.exit(problems ? 1 : 0);
}
