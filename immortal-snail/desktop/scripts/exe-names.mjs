/**
 * The executables' names (win.executableName, linux.executableName), read from
 * electron-builder.yml so a rename there is picked up by the checks too.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const yaml = createRequire(import.meta.url)('js-yaml'); // comes with electron-builder

const config = yaml.load(readFileSync(path.join(desktopDir, 'electron-builder.yml'), 'utf8'));

/** "SnailmateChess" (Windows, without .exe) and "snailmate-chess" (the Linux launcher). */
export const EXE_NAMES = { win: config.win.executableName, linux: config.linux.executableName };
