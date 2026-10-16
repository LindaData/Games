#!/usr/bin/env node
/**
 * Checks the Windows build without Windows: the exe carries the game icon (all sizes of
 * build/icon.ico) and the version info, and the asar holds the web game.
 *   node scripts/check-win-exe.mjs [path/to/SnailmateChess.exe]
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXE_NAMES } from './exe-names.mjs';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ResEdit = require('resedit'); // comes with electron-builder
const { productName } = JSON.parse(readFileSync(path.join(desktopDir, 'package.json'), 'utf8'));
const exe = path.resolve(process.argv[2] ?? path.join(desktopDir, 'release', 'win-unpacked', `${EXE_NAMES.win}.exe`));

let failures = 0;
const check = (ok, msg) => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};

const pe = ResEdit.NtExecutable.from(readFileSync(exe), { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(pe);
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const sizes = groups.flatMap((g) => g.icons.map((i) => i.width || 256)).sort((a, b) => a - b);
check(groups.length >= 1 && [16, 32, 48, 256].every((s) => sizes.includes(s)), `exe icon sizes: ${sizes.join(', ')}`);

const ico = ResEdit.Data.IconFile.from(readFileSync(path.join(desktopDir, 'build', 'icon.ico')));
const icoSizes = ico.icons.map((i) => i.width || 256).sort((a, b) => a - b);
check(JSON.stringify(icoSizes) === JSON.stringify(sizes), 'exe icon matches build/icon.ico');

const [version] = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
const strings = version?.getAllLanguagesForStringValues?.().length ? version.getStringValues(version.getAllLanguagesForStringValues()[0]) : {};
check(strings.ProductName === productName, `ProductName "${strings.ProductName}"`);
check(Boolean(strings.FileVersion || strings.ProductVersion), `version ${strings.ProductVersion ?? strings.FileVersion}`);

const asar = readFileSync(path.join(path.dirname(exe), 'resources', 'app.asar'));
const headerSize = asar.readUInt32LE(12);
const header = asar.toString('utf8', 16, 16 + headerSize);
check(header.includes('"index.html"') && header.includes('"main.js"'), 'app.asar holds src/main.js and app/index.html');

console.log(failures ? `\n${failures} check(s) FAILED` : '\nWindows build looks right.');
process.exit(failures ? 1 : 0);
