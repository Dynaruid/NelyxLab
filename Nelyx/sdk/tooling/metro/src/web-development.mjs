// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { createConnectMiddleware } from 'metro';
import { verifyAppAssets } from './assets.cjs';
import { readWebRuntime } from './web-runtime.mjs';

/** Own Metro, its watchers/workers, HTTP/HMR sockets and the reload channel. */
export async function serveWebDevelopment({
  config,
  appRoot,
  assets,
  readAssets,
  host = '127.0.0.1',
  port = 8081,
  runtimeDirectory,
}) {
  if (
    !['127.0.0.1', 'localhost'].includes(host) ||
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw new Error('Web development requires a loopback host and port 1..65535');
  const files = new Map(),
    sockets = new Set(),
    subscribers = new Set(),
    session = randomUUID();
  let metro,
    closing = false,
    closed;
  const bundle = '/main.bundle?platform=web&dev=true&hot=true&minify=false&runModule=true';
  const types = {
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
    '.ttf': 'font/ttf',
  };
  const send = (response, status, bytes, type) => {
    response.writeHead(status, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(bytes);
  };
  const html = Buffer.from(
    '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nelyx Web</title><style>html,body{height:100%;margin:0;overflow:hidden;background:#101827}#app{display:flex;flex-direction:column;height:100%;overflow:hidden}</style><div id="app"></div><script>globalThis.__NELYX_WEB_DEVELOPMENT__=' +
      JSON.stringify({ session, bundle, events: '/__nelyx/events' }) +
      ';</script><script src="' +
      bundle.replaceAll('&', '&amp;') +
      '"></script></html>\n',
  );
  const server = http.createServer(async (request, response) => {
    if (closing || !metro) {
      send(response, 503, 'Web development is preparing', 'text/plain');
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      send(response, 400, 'Invalid path', 'text/plain');
      return;
    }
    if (pathname === '/reload') {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        send(response, 405, 'POST required', 'text/plain');
        return;
      }
      if (request.headers.origin && request.headers.origin !== `http://${host}:${port}`) {
        send(response, 403, 'Foreign origin', 'text/plain');
        return;
      }
      for (const subscriber of subscribers) subscriber.write('event: reload\ndata: {}\n\n');
      send(response, 200, 'OK', 'text/plain');
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      send(response, 405, 'GET or HEAD required', 'text/plain');
      return;
    }
    if (pathname === '/__nelyx/events') {
      if (request.method !== 'GET' || subscribers.size >= 64) {
        send(response, 503, 'Development client limit reached', 'text/plain');
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        'Connection': 'keep-alive',
      });
      response.write(': connected\n\n');
      subscribers.add(response);
      response.once('close', () => subscribers.delete(response));
      return;
    }
    if (pathname === '/__nelyx/status') {
      send(
        response,
        200,
        JSON.stringify({
          target: 'web',
          session,
          runner: config.projectRoot,
          app: appRoot,
          bundle,
          clients: subscribers.size,
        }),
        'application/json',
      );
      return;
    }
    if (pathname === '/') {
      send(response, 200, request.method === 'HEAD' ? undefined : html, 'text/html; charset=utf-8');
      return;
    }
    if (pathname.startsWith('/runtime/') || pathname.startsWith('/assets/')) {
      if (pathname.startsWith('/assets/')) {
        try {
          const current = new Map(
            verifyAppAssets(appRoot, readAssets ? await readAssets() : assets).map((asset) => [
              '/' + asset.path.slice(2),
              { file: asset.file, sha256: asset.sha256 },
            ]),
          );
          for (const key of files.keys()) if (key.startsWith('/assets/')) files.delete(key);
          for (const [key, value] of current) files.set(key, value);
        } catch {
          send(response, 409, 'Web asset configuration unavailable or changed', 'text/plain');
          return;
        }
      }
      const record = files.get(pathname);
      if (!record) {
        send(response, 404, 'Unlisted Web asset', 'text/plain');
        return;
      }
      try {
        const bytes = record.bytes ?? fs.readFileSync(record.file);
        if (record.sha256 && createHash('sha256').update(bytes).digest('hex') !== record.sha256)
          throw new Error('Changed asset');
        send(
          response,
          200,
          request.method === 'HEAD' ? undefined : bytes,
          types[path.extname(pathname)] ?? 'application/octet-stream',
        );
      } catch {
        send(response, 409, 'Web asset unavailable or changed', 'text/plain');
      }
      return;
    }
    metro.middleware(request, response, () => send(response, 404, 'Not found', 'text/plain'));
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  const close = () =>
    (closed ??= (async () => {
      closing = true;
      const ended = new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      for (const socket of sockets) socket.destroy();
      await Promise.all([ended, metro?.end()]);
    })());
  // Bind first: an occupied listener never starts Metro or mutates app inputs.
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  try {
    const { manifest, runtime } = readWebRuntime(config, runtimeDirectory);
    for (const { file, bytes } of runtime) files.set('/runtime/' + file.id, { bytes });
    files.set('/runtime/native-manifest.json', { bytes: Buffer.from(JSON.stringify(manifest)) });
    for (const asset of verifyAppAssets(appRoot, assets))
      files.set('/' + asset.path.slice(2), { file: asset.file, sha256: asset.sha256 });
    metro = await createConnectMiddleware(
      {
        ...config,
        server: { ...config.server, port },
        reporter: {
          update(value) {
            process.stderr.write(
              JSON.stringify({ event: 'nelyx.web.metro', type: value.type }) + '\n',
            );
          },
        },
      },
      { waitForBundler: true, watch: true },
    );
    metro.attachHmrServer(server);
    return { url: `http://${host}:${port}/`, runner: config.projectRoot, close };
  } catch (error) {
    await close();
    throw error;
  }
}
