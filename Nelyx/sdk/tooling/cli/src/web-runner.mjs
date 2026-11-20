// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { appFiles, inspectRunner, prepareRunnerFiles, readApp } from '@nelyx/vite/runner';
import { buildPwa, verifyPwa } from '@nelyx/vite/release';
import { isAppNavigation, mediaType } from '@nelyx/vite/content';
import { localFile } from '@nelyx/tooling-contracts/node-files';
import {
  ensureDirectory,
  publishDirectory,
  removeDirectory,
  withPublicationLock,
} from './publication.mjs';

const route = { format: 'pwa', provider: 'web', host: 'browser' };
export const pwaDirectory = (app) => path.join(app, '.nelyx', 'pwa');
export const hostOs = () =>
  ({ win32: 'windows', darwin: 'macos', linux: 'linux' })[process.platform] ?? process.platform;

function requireViteRunner(runner) {
  for (const name of ['index.html', 'vite.config.ts', 'main.ts']) {
    if (!fs.existsSync(path.join(runner, name)))
      throw new Error(
        `Add ${name} from the PWA starter to ${runner}. Review metro.config.cjs and build.mjs for custom settings to move to vite.config.ts.`,
      );
    localFile(runner, name);
  }
}

export function doctorWeb({ app }) {
  const result = { schema: 'nelyx.doctor/v3', ...route, os: hostOs() };
  try {
    const value = inspectRunner(app);
    requireViteRunner(value.runner);
    appFiles(value, false);
    return {
      ...result,
      app: value.app,
      runner: value.runner,
      cohort: value.cohort,
      warnings: value.warnings,
      ready: true,
      exitCode: 0,
    };
  } catch (error) {
    return { ...result, app, error: error.message, ready: false, exitCode: 1 };
  }
}

export function prepareWeb({ app }) {
  const value = inspectRunner(app);
  requireViteRunner(value.runner);
  prepareRunnerFiles(value);
  return {
    schema: 'nelyx.prepare/v3',
    ...route,
    os: hostOs(),
    app: value.app,
    runner: value.runner,
    cohort: value.cohort,
    warnings: value.warnings,
  };
}

export function buildWebApplication({ app }, signal) {
  app = fs.realpathSync(app);
  return withPublicationLock(app, async () => {
    signal.throwIfAborted();
    const destination = pwaDirectory(app);
    const parent = ensureDirectory(path.dirname(destination));
    const stage = fs.mkdtempSync(path.join(parent, '.pwa-'));
    try {
      requireViteRunner(path.join(app, 'web', 'runner'));
      const release = await buildPwa(app, stage);
      signal.throwIfAborted();
      publishDirectory(stage, destination);
      const { files: _inventory, ...summary } = release;
      return { ...summary, directory: destination, host: 'browser', os: hostOs() };
    } finally {
      removeDirectory(stage, parent);
    }
  });
}

export async function openVite(
  { app, host = '127.0.0.1', port = 8081, advertisedHost, tauri = false, os = hostOs() },
  signal,
) {
  const value = inspectRunner(app);
  const { runner } = value;
  requireViteRunner(runner);
  const { createServer } = await value.vite();
  const event = {
    event: 'nelyx.dev.ready',
    ...route,
    ...(tauri ? { host: 'tauri' } : {}),
    os,
    target: 'web',
    app: value.app,
    runner,
    session: randomUUID(),
  };
  const server = await createServer({
    root: runner,
    configFile: path.join(runner, 'vite.config.ts'),
    server: {
      host,
      port,
      strictPort: true,
      ...(advertisedHost ? { allowedHosts: [advertisedHost] } : {}),
    },
    plugins: [
      {
        name: 'nelyx:dev-session',
        config(config) {
          if (!tauri || !['android', 'ios'].includes(os) || config.server?.ws === false) return;
          // Tauri can serve mobile development modules from the embedded protocol.
          // The HMR socket connects directly to the Vite endpoint, including via adb reverse.
          return {
            server: {
              ws: {
                protocol: config.server?.https ? 'wss' : 'ws',
                host: advertisedHost ?? host,
                clientPort: port,
              },
            },
          };
        },
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.method !== 'GET' || req.url !== '/__nelyx/status') return next();
            res
              .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
              .end(JSON.stringify(event));
          });
        },
      },
    ],
  });
  try {
    await server.listen();
    signal.throwIfAborted();
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') throw new Error('Vite did not bind a TCP port');
    const protocol = server.config.server.https ? 'https' : 'http';
    const url = (hostname) =>
      new URL(
        `${protocol}://${
          hostname.includes(':') && !hostname.startsWith('[') ? '[' + hostname + ']' : hostname
        }:${address.port}/`,
      ).href;
    event.url = url(advertisedHost ?? host);
    process.stderr.write(JSON.stringify(event) + '\n');
    return { server, event, healthUrl: url(host === '0.0.0.0' ? '127.0.0.1' : host) };
  } catch (error) {
    await server.close();
    throw error;
  }
}

function waitForServer(server, signal) {
  return new Promise((resolve, reject) => {
    const close = () => finish();
    const error = (error) => finish(error);
    const abort = () => finish(signal.reason);
    function finish(failure) {
      signal.removeEventListener('abort', abort);
      server.off('error', error);
      server.off('close', close);
      if (failure) reject(failure);
      else resolve();
    }
    signal.addEventListener('abort', abort, { once: true });
    server.once('error', error);
    server.once('close', close);
    if (signal.aborted) abort();
  });
}

export async function devWeb(options, signal) {
  const { server, event } = await openVite(options, signal);
  try {
    await waitForServer(server.httpServer, signal);
    return { ...event, exitCode: 0 };
  } finally {
    await server.close();
  }
}

export async function runWeb(
  { app, directory, port = 4173, host = '127.0.0.1', base = '/' },
  signal,
) {
  const value = readApp(app);
  directory = path.resolve(directory ?? pwaDirectory(value.app));
  let release = verifyPwa(directory, value);
  let names = new Set(release.files.map(({ path }) => path));
  if (!/^\/(?:[\w-]+\/)*$/.test(base))
    throw new Error('--base requires / or a path such as /demo/');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405).end();
    if (base !== '/' && url.pathname === base.slice(0, -1))
      return res.writeHead(308, { Location: base + url.search }).end();
    if (!url.pathname.startsWith(base)) return res.writeHead(404).end();
    try {
      const manifest = JSON.parse(fs.readFileSync(localFile(directory, 'build.json'), 'utf8'));
      if (manifest.buildId !== release.buildId) {
        release = verifyPwa(directory, value);
        names = new Set(release.files.map(({ path }) => path));
      }
      const request = decodeURIComponent(url.pathname.slice(base.length));
      const navigation =
        req.headers['sec-fetch-mode'] === 'navigate' || req.headers.accept?.includes('text/html');
      const file =
        request === ''
          ? 'index.html'
          : request === 'build.json' || names.has(request)
            ? request
            : navigation && isAppNavigation(request)
              ? 'index.html'
              : null;
      if (!file) return res.writeHead(404).end();
      let bytes = fs.readFileSync(localFile(directory, file));
      if (file === 'index.html' && request !== '' && request !== 'index.html')
        bytes = Buffer.from(bytes.toString().replace('<!--nelyx-base-->', `<base href="${base}">`));
      res
        .writeHead(200, {
          'Content-Type': mediaType(file),
          'Content-Length': bytes.length,
          'Cache-Control': file.startsWith('chunks/')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        })
        .end(req.method === 'HEAD' ? undefined : bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, resolve);
    });
    const address = server.address();
    const url = `http://${host.includes(':') ? '[' + host + ']' : host}:${address.port}${base}`;
    const result = {
      schema: 'nelyx.run/v3',
      ...route,
      os: hostOs(),
      url,
      directory,
      buildId: release.buildId,
    };
    process.stderr.write(JSON.stringify({ event: 'nelyx.preview.ready', ...result }) + '\n');
    await waitForServer(server, signal);
    return { ...result, exitCode: 0 };
  } finally {
    if (server.listening)
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
  }
}
