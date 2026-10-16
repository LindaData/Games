/**
 * Build-time glue for the web version (logic in src/pwa/precache.ts, tested there):
 *  - fills index.html's %SITE_…% placeholders from src/site.json (name, URL, description, colours),
 *  - serves (dev) and writes (build) manifest.webmanifest and links it from index.html,
 *  - after a build, writes sw.js: the offline service worker with every built file listed and a
 *    version hash of their contents (src/pwa/sw-template.js).
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { fillHtml, htmlTokens, precacheList, serviceWorkerSource, webManifest } from './src/pwa/precache';
import { SITE } from './src/site';

const MANIFEST = 'manifest.webmanifest';
const SW_TEMPLATE = 'src/pwa/sw-template.js';

function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    return statSync(full).isDirectory() ? listFiles(full, rel) : [rel];
  });
}

export function sitePlugin(): Plugin[] {
  let config: ResolvedConfig;
  const manifestJson = () => `${JSON.stringify(webManifest(SITE), null, 2)}\n`;
  return [
    {
      name: 'snailmate-site',
      configResolved(c) {
        config = c;
      },
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => fillHtml(html, htmlTokens(SITE)),
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] !== `${config.base}${MANIFEST}`) return next();
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          res.end(manifestJson());
        });
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: MANIFEST, source: manifestJson() });
      },
      writeBundle(options) {
        const outDir = options.dir ?? config.build.outDir;
        const files = precacheList(listFiles(outDir));
        const hash = createHash('sha256');
        for (const f of files) hash.update(`${f}\0`).update(readFileSync(path.join(outDir, f === './' ? 'index.html' : f)));
        const version = hash.digest('hex').slice(0, 12);
        writeFileSync(path.join(outDir, 'sw.js'), serviceWorkerSource(readFileSync(path.resolve(config.root, SW_TEMPLATE), 'utf8'), files, version));
        config.logger.info(`  sw.js: ${files.length} files precached, version ${version}`);
      },
    },
    {
      // Added after Vite has processed index.html's own links (the manifest is not a source file).
      name: 'snailmate-site:manifest-link',
      transformIndexHtml: () => [{ tag: 'link', attrs: { rel: 'manifest', href: `${config.base}${MANIFEST}` }, injectTo: 'head' }],
    },
  ];
}
