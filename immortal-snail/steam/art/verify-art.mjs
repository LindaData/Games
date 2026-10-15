#!/usr/bin/env node
/**
 * Checks that every Steam graphic, icon and screenshot exists at the exact pixel size Steam wants.
 *   npm run verify            # from immortal-snail/steam
 * Exit code 1 when anything is missing or the wrong size.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, imageSizes } from './images.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const steamDir = path.resolve(here, '..');
const gameDir = path.resolve(steamDir, '..');
const art = (f) => path.join(steamDir, 'store', 'art', f);
const build = (f) => path.join(gameDir, 'desktop', 'build', f);

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

/** [file, [[w, h], ...] exact sizes it must contain, extra checks] */
const EXPECTED = [
  [art('header_capsule_920x430.png'), [[920, 430]]],
  [art('small_capsule_462x174.png'), [[462, 174]]],
  [art('main_capsule_1232x706.png'), [[1232, 706]]],
  [art('vertical_capsule_748x896.png'), [[748, 896]]],
  [art('library_capsule_600x900.png'), [[600, 900]]],
  [art('library_header_920x430.png'), [[920, 430]]],
  [art('library_hero_3840x1240.png'), [[3840, 1240]]],
  [art('library_logo_1280x720.png'), [[1280, 720]], { transparent: true }],
  [art('page_background_1438x810.png'), [[1438, 810]]],
  [art('community_icon_184x184.jpg'), [[184, 184]], { jpeg: true }],
  [art('client_icon.ico'), [[16, 16], [32, 32]]],
  [art('client_icon_256.png'), [[256, 256]]],
  [build('icon.png'), [[1024, 1024]]],
  [build('icon-512.png'), [[512, 512]]],
  ...ICON_SIZES.map((s) => [build(`icons/${s}x${s}.png`), [[s, s]]]),
  [build('icon.ico'), [16, 24, 32, 48, 64, 128, 256].map((s) => [s, s])],
  [build('icon.icns'), [16, 32, 64, 128, 256, 512, 1024].map((s) => [s, s])],
  [path.join(gameDir, 'desktop', 'assets', 'icon.png'), [[256, 256]]],
];

export function verifyArt({ quiet = false } = {}) {
  let problems = 0;
  const say = (ok, msg) => {
    if (!ok) problems++;
    if (!quiet || !ok) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  };
  console.log('Size check:');
  for (const [file, sizes, opts = {}] of EXPECTED) {
    const name = path.relative(gameDir, file);
    if (!existsSync(file)) {
      say(false, `${name} is missing`);
      continue;
    }
    const buf = readFileSync(file);
    let found;
    try {
      found = imageSizes(buf, name);
    } catch (e) {
      say(false, `${name}: ${e.message}`);
      continue;
    }
    const has = (w, h) => found.some((f) => f.width === w && f.height === h);
    const missing = sizes.filter(([w, h]) => !has(w, h));
    const label = [...new Set(found.map((f) => `${f.width}x${f.height}`))].join(', ');
    say(missing.length === 0 && (sizes.length > 1 || found.length === 1), `${name}  ${label}`);
    if (opts.jpeg) say(buf[0] === 0xff && buf[1] === 0xd8, `${name} is a JPEG`);
    if (opts.transparent) {
      const { width, height, rgba } = decodePng(buf);
      const corners = [0, width - 1, (height - 1) * width, height * width - 1].map((i) => rgba[i * 4 + 3]);
      say(found[0].alpha && corners.every((a) => a === 0), `${name} has a transparent background`);
    }
  }

  const shotsDir = path.join(steamDir, 'store', 'screenshots');
  const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => f.endsWith('.png')) : [];
  for (const f of shots) {
    const [s] = imageSizes(readFileSync(path.join(shotsDir, f)), f);
    say(s.width === 1920 && s.height === 1080, `store/screenshots/${f}  ${s.width}x${s.height}`);
  }
  if (shots.length < 5) console.log(`  note store/screenshots has ${shots.length} screenshot(s); Steam needs at least 5 (run npm run screenshots)`);

  console.log(problems ? `\n${problems} problem(s)` : '\nAll art present at the right sizes.');
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(verifyArt() ? 1 : 0);
}
