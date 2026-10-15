import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { resolveAppPath, mimeType, createAppProtocolHandler, CSP } = require('../src/app-protocol.js');

const root = mkdtempSync(path.join(os.tmpdir(), 'snail-proto-'));
mkdirSync(path.join(root, 'assets'));
writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>x</title>');
writeFileSync(path.join(root, 'assets', 'ai.worker-abc.js'), 'self.onmessage = () => {};');
writeFileSync(path.join(root, 'assets', 'index.css'), 'body{}');
writeFileSync(path.join(root, 'assets', 'snail one.svg'), '<svg/>');

test('maps app://snail URLs inside the root', () => {
  assert.equal(resolveAppPath(root, 'app://snail/index.html'), path.join(root, 'index.html'));
  assert.equal(resolveAppPath(root, 'app://snail/'), path.join(root, 'index.html'));
  assert.equal(resolveAppPath(root, 'app://snail/assets/ai.worker-abc.js?v=1#x'), path.join(root, 'assets', 'ai.worker-abc.js'));
  assert.equal(resolveAppPath(root, 'app://snail/assets/snail%20one.svg'), path.join(root, 'assets', 'snail one.svg'));
});

test('never resolves outside the root', () => {
  const inside = (r) => r === null || r.startsWith(root + path.sep);
  for (const url of [
    'app://snail/../../package.json', // the URL parser already folds ../ and %2e%2e
    'app://snail/%2e%2e/package.json',
    'app://snail/..%2f..%2fpackage.json', // decoded after parsing: path.normalize clamps at /
    'app://snail/..%5c..%5cpackage.json',
    'app://snail/assets/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd',
    'app://snail//etc/passwd',
  ]) {
    assert.ok(inside(resolveAppPath(root, url)), url);
  }
});

test('Windows: backslashes and drive letters cannot escape', () => {
  const winRoot = 'C:\\Games\\Immortal Snail Chess\\resources\\app.asar\\app';
  const resolve = (u) => resolveAppPath(winRoot, u, path.win32);
  assert.equal(resolve('app://snail/assets/a.js'), `${winRoot}\\assets\\a.js`);
  assert.equal(resolve('app://snail/C:%5cWindows%5cwin.ini'), null);
  assert.equal(resolve('app://snail/C:/Windows/win.ini'), null);
  for (const u of ['app://snail/..%5c..%5c..%5cWindows%5cwin.ini', 'app://snail/%5c%5cserver%5cshare%5cx']) {
    const r = resolve(u);
    assert.ok(r === null || r.startsWith(`${winRoot}\\`), u);
  }
});

test('refuses URLs that are not ours or are malformed', () => {
  for (const url of ['app://snail/%00index.html', 'app://snail/%E0%A4%A', 'app://other/index.html', 'file:///etc/passwd', 'https://snail/index.html', 'not a url']) {
    assert.equal(resolveAppPath(root, url), null, url);
  }
});

test('MIME types the game needs', () => {
  assert.match(mimeType('a.js'), /^text\/javascript/);
  assert.match(mimeType('a.mjs'), /^text\/javascript/);
  assert.match(mimeType('a.html'), /^text\/html/);
  assert.match(mimeType('a.CSS'), /^text\/css/);
  assert.equal(mimeType('a.svg'), 'image/svg+xml');
  assert.match(mimeType('a.json'), /^application\/json/);
  assert.equal(mimeType('a.png'), 'image/png');
  assert.equal(mimeType('a.woff2'), 'font/woff2');
  assert.equal(mimeType('a.unknown'), 'application/octet-stream');
});

test('handler serves files with type, CSP and nosniff; 404 otherwise', async () => {
  const handle = createAppProtocolHandler(root);
  const ok = await handle(new Request('app://snail/assets/ai.worker-abc.js'));
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-type'), /^text\/javascript/);
  assert.equal(ok.headers.get('content-security-policy'), CSP);
  assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await ok.text(), 'self.onmessage = () => {};');

  assert.equal((await handle(new Request('app://snail/missing.js'))).status, 404);
  assert.equal((await handle(new Request('app://snail/assets'))).status, 404); // a directory
  assert.equal((await handle(new Request('app://snail/%2e%2e/x'))).status, 404);
  assert.equal((await handle(new Request('app://snail/index.html', { method: 'POST', body: 'x' }))).status, 405);
  const head = await handle(new Request('app://snail/index.html', { method: 'HEAD' }));
  assert.equal(head.status, 200);
});

test('CSP allows only the app itself to run code', () => {
  assert.match(CSP, /default-src 'self'/);
  assert.match(CSP, /script-src 'self'(;|$)/);
  assert.match(CSP, /worker-src 'self'/);
  assert.match(CSP, /object-src 'none'/);
  assert.doesNotMatch(CSP, /unsafe-eval/);
});
