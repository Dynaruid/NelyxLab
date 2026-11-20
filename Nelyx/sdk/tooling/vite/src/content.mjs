// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';

export function mediaType(file) {
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.webmanifest': 'application/manifest+json; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.wasm': 'application/wasm',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.gif': 'image/gif',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.ico': 'image/x-icon',
      '.md': 'text/plain; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8',
    }[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
  );
}

export function isAppNavigation(relative) {
  return (
    relative === '' ||
    relative === 'index.html' ||
    (!/^(?:api|assets|chunks|icons|runtime|licenses|ipc|__nelyx|@vite|@id|@fs|@react-refresh)(?:\/|$)/i.test(
      relative,
    ) &&
      !/[^/]+\.[^/]+\/?$/.test(relative))
  );
}
