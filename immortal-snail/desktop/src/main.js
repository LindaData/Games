'use strict';
/**
 * Snailmate Chess — Electron main process.
 *
 * One window that shows the web game (built into ../app) from the app://snail/ scheme.
 * No menu bar, no Node in the page, no navigation away from the game.
 */
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, Menu, dialog, nativeTheme, powerMonitor, protocol, screen, session, shell } = require('electron');
const { APP_ORIGIN, APP_SCHEME, START_URL, SCHEME_PRIVILEGES, createAppProtocolHandler } = require('./app-protocol');
const { loadWindowState, saveWindowState } = require('./window-state');

// The window title is the app's name: productName in package.json.
const TITLE = app.getName();
// Must match appId in electron-builder.yml.
const APP_ID = 'com.lindadata.snailmatechess';
const IS_DEV = !app.isPackaged;
const IS_MAC = process.platform === 'darwin';
const WEB_ROOT = path.join(__dirname, '..', 'app');
const ICON = path.join(__dirname, '..', 'assets', 'icon.png');
const WINDOW = { width: 1280, height: 860, minWidth: 420, minHeight: 700 };
// The game's page background (src/index.css --bg), light and dark, so there is no white flash.
const BACKGROUND = { light: '#dfe9d3', dark: '#0f2117' };
// How often the saved game (localStorage) is written to disk. Chromium on its own waits several
// seconds, or for a clean quit, so a crash or a force-stop would lose the last moves.
const FLUSH_STORAGE_MS = 1500;

// Must happen before the app is ready.
protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: SCHEME_PRIVILEGES }]);
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

/** @type {BrowserWindow | null} */
let mainWindow = null;

const isAppUrl = (url) => url === APP_ORIGIN || url.startsWith(`${APP_ORIGIN}/`);

function openExternally(url) {
  try {
    const { protocol: scheme } = new URL(url);
    if (scheme === 'https:' || scheme === 'http:') void shell.openExternal(url);
  } catch {
    /* not a URL: ignore */
  }
}

/** Lock every web contents (window, worker hosts, anything future) to the app scheme. */
function hardenWebContents(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openExternally(url);
  });
  contents.on('will-redirect', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
}

function restoreWindowState() {
  const workAreas = screen.getAllDisplays().map((d) => d.workArea);
  return loadWindowState(app.getPath('userData'), workAreas, WINDOW);
}

/**
 * Saves the window state shortly after it changes, and on close. The size and position saved are
 * the last ones seen while the window was neither maximised, fullscreen nor minimised (starting
 * from `normalBounds`): win.getNormalBounds() can't be trusted for that on Linux, where after a
 * maximise from the title bar (or at startup) it returns the maximised rectangle.
 */
function trackWindowState(win, normalBounds) {
  let timer = null;
  let normal = normalBounds;
  const save = () => {
    if (win.isDestroyed()) return;
    if (!win.isMaximized() && !win.isFullScreen() && !win.isMinimized()) normal = win.getBounds();
    saveWindowState(app.getPath('userData'), {
      x: normal.x,
      y: normal.y,
      width: normal.width,
      height: normal.height,
      isMaximized: win.isMaximized(),
      isFullScreen: win.isFullScreen(),
    });
  };
  const saveSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(save, 500);
  };
  for (const event of ['resize', 'move', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) {
    win.on(event, saveSoon);
  }
  win.on('close', () => {
    clearTimeout(timer);
    save();
  });
}

function toggleFullScreen(win) {
  win.setFullScreen(!win.isFullScreen());
}

/**
 * Keyboard shortcuts. There is no menu on Windows/Linux, so they are handled here.
 * F11 fullscreen, Esc leaves fullscreen (the game still gets the key), Ctrl/Cmd+Q quits,
 * Ctrl/Cmd +/-/0 zoom. Reload and DevTools only when running unpackaged (npm start).
 */
function handleShortcuts(win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
    const mod = IS_MAC ? input.meta : input.control;
    const wc = win.webContents;

    if (key === 'F11' || (IS_MAC && input.meta && input.control && key === 'f')) {
      event.preventDefault();
      toggleFullScreen(win);
    } else if (key === 'Escape') {
      if (win.isFullScreen()) win.setFullScreen(false);
    } else if (mod && !input.alt && key === 'q' && !IS_MAC) {
      event.preventDefault();
      app.quit();
    } else if (mod && !input.alt && (key === '=' || key === '+')) {
      event.preventDefault();
      wc.setZoomLevel(Math.min(wc.getZoomLevel() + 0.5, 3));
    } else if (mod && !input.alt && (key === '-' || key === '_')) {
      event.preventDefault();
      wc.setZoomLevel(Math.max(wc.getZoomLevel() - 0.5, -3));
    } else if (mod && !input.alt && key === '0') {
      event.preventDefault();
      wc.setZoomLevel(0);
    } else if (IS_DEV && (key === 'F5' || (mod && key === 'r'))) {
      event.preventDefault();
      wc.reload();
    } else if (IS_DEV && (key === 'F12' || (mod && input.shift && key === 'i'))) {
      event.preventDefault();
      wc.toggleDevTools();
    }
  });
}

function buildMacMenu() {
  return Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        ...(IS_DEV ? [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }] : []),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ]);
}

function createWindow() {
  const state = restoreWindowState();
  const win = new BrowserWindow({
    title: TITLE,
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? BACKGROUND.dark : BACKGROUND.light,
    autoHideMenuBar: true,
    icon: process.platform === 'linux' && fs.existsSync(ICON) ? ICON : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
      spellcheck: false,
      devTools: IS_DEV,
    },
  });
  mainWindow = win;
  const normalBounds = win.getBounds();
  if (state.isMaximized) win.maximize();
  if (state.isFullScreen) win.setFullScreen(true);

  win.once('ready-to-show', () => win.show());
  win.on('page-title-updated', (event) => event.preventDefault());
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  trackWindowState(win, normalBounds);
  handleShortcuts(win);
  // Windows logging off or shutting down ends apps quickly.
  win.on('session-end', flushStorage);
  // The renderer crashed or was killed: reload rather than leave a dead window.
  win.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit' && !win.isDestroyed()) win.webContents.reload();
  });

  void win.loadURL(START_URL);
  return win;
}

function flushStorage() {
  if (app.isReady()) session.defaultSession.flushStorageData();
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

if (!app.requestSingleInstanceLock()) {
  // Another copy is already running: it gets focused (see 'second-instance') and this one exits.
  app.quit();
} else {
  app.on('second-instance', focusMainWindow);
  // The game has no text input. Turning the spellchecker off as soon as the session exists also
  // stops Chromium downloading a Hunspell dictionary from Google at startup (Linux): the game
  // never needs the network.
  app.on('session-created', (ses) => {
    ses.setSpellCheckerEnabled(false);
    ses.setSpellCheckerLanguages([]);
  });
  app.on('web-contents-created', (_event, contents) => hardenWebContents(contents));
  app.on('window-all-closed', () => app.quit());

  app.whenReady().then(() => {
    if (!fs.existsSync(path.join(WEB_ROOT, 'index.html'))) {
      dialog.showErrorBox(TITLE, `The game files are missing:\n${WEB_ROOT}\n\nRun "npm run build:web" in immortal-snail/desktop first.`);
      app.quit();
      return;
    }

    Menu.setApplicationMenu(IS_MAC ? buildMacMenu() : null);

    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler(() => false);
    protocol.handle(APP_SCHEME, createAppProtocolHandler(WEB_ROOT));

    setInterval(flushStorage, FLUSH_STORAGE_MS);
    app.on('before-quit', flushStorage);
    powerMonitor.on('shutdown', flushStorage);

    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}
