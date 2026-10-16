'use strict';
/**
 * Remembers the window's size, position, maximised and fullscreen state in
 * <userData>/window-state.json. A missing, corrupt or off-screen state falls back to the defaults.
 * Pure Node: the caller passes the display work areas (screen.getAllDisplays()).
 */
const fs = require('node:fs');
const path = require('node:path');

const FILE_NAME = 'window-state.json';

const isInt = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 100000;

/** How many pixels of the rectangles overlap. */
function overlapArea(a, b) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * @param {string} dir userData folder
 * @param {{x:number,y:number,width:number,height:number}[]} workAreas display work areas
 * @param {{width:number,height:number,minWidth:number,minHeight:number}} defaults
 */
function loadWindowState(dir, workAreas, defaults) {
  const fallback = { width: defaults.width, height: defaults.height, isMaximized: false, isFullScreen: false };
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(path.join(dir, FILE_NAME), 'utf8'));
  } catch {
    return fallback; // missing or corrupt
  }
  if (!saved || typeof saved !== 'object') return fallback;

  const state = { ...fallback, isMaximized: saved.isMaximized === true, isFullScreen: saved.isFullScreen === true };
  if (isInt(saved.width) && isInt(saved.height)) {
    state.width = Math.max(defaults.minWidth, Math.round(saved.width));
    state.height = Math.max(defaults.minHeight, Math.round(saved.height));
  }
  if (isInt(saved.x) && isInt(saved.y)) {
    const rect = { x: Math.round(saved.x), y: Math.round(saved.y), width: state.width, height: state.height };
    // Only restore the position if a good part of the title bar area is still on some display
    // (monitors get unplugged); otherwise let the OS centre the window.
    const titleBar = { x: rect.x, y: rect.y, width: rect.width, height: 48 };
    const visible = workAreas.some((area) => overlapArea(titleBar, area) >= Math.min(rect.width, 200) * 24);
    if (visible) {
      state.x = rect.x;
      state.y = rect.y;
    }
  }
  // Never open bigger than the largest display.
  if (workAreas.length) {
    const maxW = Math.max(...workAreas.map((a) => a.width));
    const maxH = Math.max(...workAreas.map((a) => a.height));
    state.width = Math.max(defaults.minWidth, Math.min(state.width, maxW));
    state.height = Math.max(defaults.minHeight, Math.min(state.height, maxH));
  }
  return state;
}

/** Write atomically (temp file + rename) so a crash never leaves a half-written file. */
function saveWindowState(dir, state) {
  const file = path.join(dir, FILE_NAME);
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, file);
  } catch {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
  }
}

module.exports = { FILE_NAME, loadWindowState, saveWindowState, overlapArea };
