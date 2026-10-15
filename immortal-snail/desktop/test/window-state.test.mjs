import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { FILE_NAME, loadWindowState, saveWindowState } = require('../src/window-state.js');

const DEFAULTS = { width: 1280, height: 860, minWidth: 420, minHeight: 700 };
const SCREEN = [{ x: 0, y: 0, width: 1920, height: 1040 }];
const dir = () => mkdtempSync(path.join(os.tmpdir(), 'snail-ws-'));

test('defaults when there is no file or it is corrupt', () => {
  const d = dir();
  assert.deepEqual(loadWindowState(d, SCREEN, DEFAULTS), { width: 1280, height: 860, isMaximized: false, isFullScreen: false });
  writeFileSync(path.join(d, FILE_NAME), '{not json');
  assert.equal(loadWindowState(d, SCREEN, DEFAULTS).width, 1280);
  writeFileSync(path.join(d, FILE_NAME), 'null');
  assert.equal(loadWindowState(d, SCREEN, DEFAULTS).width, 1280);
  writeFileSync(path.join(d, FILE_NAME), JSON.stringify({ width: 'big', x: 'left' }));
  const s = loadWindowState(d, SCREEN, DEFAULTS);
  assert.equal(s.width, 1280);
  assert.equal(s.x, undefined);
});

test('round trip', () => {
  const d = dir();
  saveWindowState(d, { x: 100, y: 50, width: 1000, height: 800, isMaximized: true, isFullScreen: false });
  assert.deepEqual(loadWindowState(d, SCREEN, DEFAULTS), { x: 100, y: 50, width: 1000, height: 800, isMaximized: true, isFullScreen: false });
  assert.ok(!existsSync(path.join(d, `${FILE_NAME}.${process.pid}.tmp`)));
  assert.equal(JSON.parse(readFileSync(path.join(d, FILE_NAME), 'utf8')).width, 1000);
});

test('enforces the minimum size and the largest display', () => {
  const d = dir();
  saveWindowState(d, { width: 100, height: 100 });
  assert.deepEqual([loadWindowState(d, SCREEN, DEFAULTS).width, loadWindowState(d, SCREEN, DEFAULTS).height], [420, 700]);
  saveWindowState(d, { width: 5000, height: 4000 });
  const s = loadWindowState(d, SCREEN, DEFAULTS);
  assert.deepEqual([s.width, s.height], [1920, 1040]);
});

test('drops a position that is off every display (unplugged monitor)', () => {
  const d = dir();
  saveWindowState(d, { x: 2500, y: 100, width: 1000, height: 800 });
  const s = loadWindowState(d, SCREEN, DEFAULTS);
  assert.equal(s.x, undefined);
  assert.equal(s.y, undefined);
  assert.equal(s.width, 1000);
  // Still on a second monitor: kept.
  const two = [...SCREEN, { x: 1920, y: 0, width: 2560, height: 1400 }];
  assert.equal(loadWindowState(d, two, DEFAULTS).x, 2500);
});
