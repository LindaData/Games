#!/usr/bin/env node
/**
 * Builds the web game (immortal-snail/) into desktop/app/ with a relative base (./) so it can be
 * served from app://snail/. The normal web build (dist/, used for Vercel) is not touched.
 *
 *   node scripts/build-web.mjs           # npm ci in the game if needed, then build
 *   node scripts/build-web.mjs --ci      # always run npm ci in the game first
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gameDir = path.resolve(desktopDir, '..');
const outDir = path.join(desktopDir, 'app');
const isWin = process.platform === 'win32';

function run(cmd, args, cwd) {
  console.log(`> ${cmd} ${args.join(' ')}   (in ${path.relative(process.cwd(), cwd) || '.'})`);
  // npm is npm.cmd on Windows, which needs a shell. Arguments here never contain spaces.
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWin });
  if (r.status !== 0) {
    console.error(`build-web: "${cmd} ${args.join(' ')}" failed (exit ${r.status ?? r.signal})`);
    process.exit(r.status || 1);
  }
}

if (!existsSync(path.join(gameDir, 'package.json'))) {
  console.error(`build-web: no game found at ${gameDir}`);
  process.exit(1);
}
if (process.argv.includes('--ci') || !existsSync(path.join(gameDir, 'node_modules'))) {
  run('npm', ['ci', '--no-audit', '--no-fund'], gameDir);
}
// Vite's root is the game folder, so the relative outDir lands in desktop/app.
run('npm', ['run', 'build', '--', '--base', './', '--outDir', 'desktop/app', '--emptyOutDir'], gameDir);

const indexFile = path.join(outDir, 'index.html');
if (!existsSync(indexFile)) {
  console.error(`build-web: ${indexFile} was not produced`);
  process.exit(1);
}
const html = readFileSync(indexFile, 'utf8');
if (/(src|href)="\/(?!\/)/.test(html)) {
  console.error('build-web: index.html still has absolute asset URLs; the --base ./ flag did not apply');
  process.exit(1);
}

// Licence texts of everything bundled into the game (React, chess.js, ...), shipped next to the
// exe as THIRD-PARTY-NOTICES.txt (Electron's and Chromium's come with Electron itself).
const ls = spawnSync('npm', ['ls', '--omit=dev', '--all', '--parseable'], { cwd: gameDir, encoding: 'utf8', shell: isWin });
const notices = ['Immortal Snail Chess includes the following open source software.', ''];
for (const dir of [...new Set((ls.stdout ?? '').split(/\r?\n/).filter(Boolean))].slice(1).sort()) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    continue;
  }
  const licenseFile = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\..*)?$/i.test(f));
  notices.push('='.repeat(78), `${pkg.name} ${pkg.version} (${pkg.license ?? 'see below'})`, '='.repeat(78));
  notices.push(licenseFile ? readFileSync(path.join(dir, licenseFile), 'utf8').trim() : `License: ${pkg.license ?? 'unknown'}`, '');
}
writeFileSync(path.join(outDir, 'THIRD-PARTY-NOTICES.txt'), `${notices.join('\n')}\n`);
console.log(`build-web: game built into ${path.relative(process.cwd(), outDir) || outDir}`);
