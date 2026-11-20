// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';
import { isAppNavigation } from './content.mjs';

function installWorker({ appId, revision, files }) {
  const scope = new URL(self.registration.scope);
  const prefix =
    'nelyx:pwa:' + encodeURIComponent(appId) + ':' + encodeURIComponent(scope.href) + ':';
  const cacheName = prefix + revision;
  const assets = new Map(files.map((file) => [new URL(file.path, scope).pathname, file]));
  const urlOf = (file) => new URL(file, scope).href;
  self.addEventListener('install', (event) => {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(cacheName);
        try {
          for (let start = 0; start < files.length; start += 6) {
            const batch = files.slice(start, start + 6);
            const results = await Promise.allSettled(
              batch.map(async (file) => {
                const url = urlOf(file.path);
                const response = await fetch(url, { cache: 'reload', redirect: 'error' });
                if (!response.ok) throw new Error('Cannot precache ' + file.path);
                const bytes = await response.clone().arrayBuffer();
                const actual = Array.from(
                  new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
                  (value) => value.toString(16).padStart(2, '0'),
                ).join('');
                if (bytes.byteLength !== file.bytes || actual !== file.sha256)
                  throw new Error('PWA precache integrity mismatch: ' + file.path);
                await cache.put(url, response);
              }),
            );
            const failure = results.find((result) => result.status === 'rejected');
            if (failure) throw failure.reason;
          }
        } catch (error) {
          await caches.delete(cacheName);
          throw error;
        }
      })(),
    );
  });
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith(prefix) && key !== cacheName)
            .map((key) => caches.delete(key)),
        );
        await self.clients.claim();
      })(),
    );
  });
  self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
    const relative = url.pathname.slice(scope.pathname.length);
    if (/%(?:2f|5c)/i.test(relative)) return;
    if (request.mode === 'navigate' && isAppNavigation(relative)) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(cacheName);
          const page = await cache.match(urlOf('index.html'));
          if (!page) return fetch(request);
          if (relative === '' || relative === 'index.html') return page;
          const base = scope.pathname
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
          const html = (await page.text()).replace(
            '<!--nelyx-base-->',
            '<base href="' + base + '">',
          );
          return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        })(),
      );
      return;
    }
    if (url.search || !assets.has(url.pathname)) return;
    event.respondWith(
      (async () => {
        const cache = await caches.open(cacheName);
        return (await cache.match(url.href)) ?? Response.error();
      })(),
    );
  });
}

export function serviceWorker(appId, files) {
  const source = isAppNavigation.toString() + '\n' + installWorker.toString();
  const revision = createHash('sha256').update(source).update(JSON.stringify(files)).digest('hex');
  return source + '\ninstallWorker(' + JSON.stringify({ appId, revision, files }) + ');\n';
}
