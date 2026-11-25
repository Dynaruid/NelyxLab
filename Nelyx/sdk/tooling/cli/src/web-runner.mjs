// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { appFiles, inspectRunner, prepareRunnerFiles, readApp } from '@nelyx/vite/runner';
import { buildFrontend, verifyFrontend } from '@nelyx/vite/release';
import { crossOriginIsolationHeaders, frontendSession } from '@nelyx/vite/frontend-session';
import { backendHash } from '@nelyx/tooling-contracts/backend-supply';
import {
  backendContract,
  backendBuildMessage,
  compileWasm,
  inspectBackend,
  inspectWasmTools,
  prepareWasm,
} from './backend-project.mjs';
import { backendWatcher } from './backend-watch.mjs';
import { frontendInputs } from './frontend-inputs.mjs';
import { buildStage, readBuildState, writeBuildState } from './build-cache.mjs';
import { isAppNavigation, mediaType } from '@nelyx/vite/content';
import { localFile } from '@nelyx/tooling-contracts/node-files';
import {
  ensureDirectory,
  publishDirectory,
  removeDirectory,
  withPublicationLock,
} from './publication.mjs';

const route = { provider: 'web', host: 'browser', target: 'web' };
export const webDirectory = (app) => path.join(app, '.nelyx', 'web');
export const hostOs = () =>
  ({ win32: 'windows', darwin: 'macos', linux: 'linux' })[process.platform] ?? process.platform;

export function doctorFrontend(app, target) {
  const result = { schema: 'nelyx.doctor/v4', target };
  try {
    const value = inspectRunner(app);
    if (!value.config.targets[target])
      throw new Error('Declare targets.' + target + ' in package.json');
    appFiles(value, false, target);
    return {
      ...result,
      app: value.app,
      runner: value.runner,
      cohort: value.cohort,
      ready: true,
      exitCode: 0,
    };
  } catch (error) {
    return { ...result, app, error: error.message, ready: false, exitCode: 1 };
  }
}

export function doctorWeb({ app }) {
  const result = { ...doctorFrontend(app, 'web'), ...route, os: hostOs() };
  if (!result.ready) return result;
  try {
    const backend = inspectBackend(readApp(app), 'web', { requireLock: false });
    return {
      ...result,
      backend: backendContract(backend),
      ...(backend.appCrate ? { tools: inspectWasmTools(app) } : {}),
    };
  } catch (error) {
    return { ...result, ready: false, error: error.message, exitCode: 1 };
  }
}

export function prepareFrontend(app, target) {
  const value = inspectRunner(app);
  if (!value.config.targets[target])
    throw new Error('Declare targets.' + target + ' in package.json');
  prepareRunnerFiles(value, target);
  return {
    schema: 'nelyx.prepare/v4',
    target,
    app: value.app,
    runner: value.runner,
    cohort: value.cohort,
  };
}

export function prepareWeb({ app, updateLock }, signal) {
  app = fs.realpathSync(app);
  return withPublicationLock(app, async () => {
    const result = prepareFrontend(app, 'web');
    const value = readApp(app);
    const backend = inspectBackend(value, 'web', { requireLock: false });
    await prepareWasm(value, backend, updateLock, signal);
    return {
      ...result,
      ...route,
      os: hostOs(),
      backend: backendContract(inspectBackend(value, 'web')),
    };
  });
}

export async function publishFrontend(value, target, project, destination, verifyInputs, signal) {
  signal.throwIfAborted();
  const started = performance.now();
  const contract = backendContract(project);
  const stateFile = path.join(value.app, '.nelyx', 'frontend-' + target + '-inputs.json');
  const previous = readBuildState(stateFile);
  const inputs = frontendInputs(value, target, project, contract);
  const summary = ({ files: _inventory, ...rest }) => ({ ...rest, directory: destination });
  let reason = inputs ? 'frontend inputs changed' : 'Vite inputs cannot be tracked';
  if (previous?.key && inputs?.key(previous.dependencies) === previous.key) {
    try {
      const release = verifyFrontend(destination, inspectRunner(value.app), target, contract);
      if (release.buildId !== previous.buildId) throw Error('Unexpected release build ID');
      buildStage('vite', started, {
        target,
        calls: 0,
        buildId: release.buildId,
        reason: 'verified release reused',
      });
      return summary(release);
    } catch {
      reason = 'frontend output is missing or changed';
    }
  }
  const parent = ensureDirectory(path.dirname(destination));
  const stage = fs.mkdtempSync(path.join(parent, '.frontend-'));
  try {
    let dependencies;
    const release = await buildFrontend(value.app, stage, target, project, contract, (entries) => {
      dependencies = inputs?.ownedDependencies(entries);
    });
    signal.throwIfAborted();
    const current = readApp(value.app);
    if (
      backendHash(current) !== backendHash(value) ||
      backendHash(backendContract(verifyInputs(current))) !== backendHash(contract)
    )
      throw new Error('App inputs changed during the frontend build');
    if (
      inputs &&
      frontendInputs(current, target, project, contract, inputs.environment)?.primary !==
        inputs.primary
    )
      throw new Error('Vite input files or environment changed during the frontend build');
    publishDirectory(stage, destination);
    const key = inputs?.key(dependencies);
    if (key) writeBuildState(stateFile, { key, dependencies, buildId: release.buildId });
    else if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
    buildStage('vite', started, {
      target,
      calls: 1,
      buildId: release.buildId,
      previousBuildId: previous?.buildId,
      reason: inputs && !dependencies ? 'Vite used inputs outside the app' : reason,
    });
    return summary(release);
  } finally {
    removeDirectory(stage, parent);
  }
}

export function buildWebApplication({ app }, signal) {
  app = fs.realpathSync(app);
  return withPublicationLock(app, async () => {
    const value = readApp(app);
    const backend = (value) => inspectBackend(value, 'web');
    const project = await compileWasm(value, backend(value), signal);
    const summary = await publishFrontend(
      value,
      'web',
      project,
      webDirectory(app),
      backend,
      signal,
    );
    return { ...summary, ...route, os: hostOs() };
  });
}

export async function openVite(
  {
    app,
    host = '127.0.0.1',
    port = 8081,
    advertisedHost,
    target = 'web',
    os = hostOs(),
    backend,
    crossOriginIsolated,
  },
  signal,
) {
  const value = inspectRunner(app);
  const { runner } = value;
  const serverClosed = new AbortController();
  const frontend = frontendSession(value, target, backend, {
    dev: true,
    onClosed: () => serverClosed.abort(),
  });
  const { createServer } = await value.vite();
  const event = {
    event: 'nelyx.dev.ready',
    ...route,
    ...(target === 'tauri' ? { host: 'tauri' } : {}),
    os,
    target,
    format: target === 'web' && value.config.targets.web.pwa ? 'pwa' : target,
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
      ...((crossOriginIsolated ?? value.config.crossOriginIsolated)
        ? { headers: crossOriginIsolationHeaders }
        : {}),
      ...(advertisedHost ? { allowedHosts: [advertisedHost] } : {}),
    },
    plugins: [
      ...frontend.plugins,
      {
        name: 'nelyx:dev-session',
        config(config) {
          if (target !== 'tauri' || !['android', 'ios'].includes(os) || config.server?.ws === false)
            return;
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
          server.httpServer?.once('error', (error) => serverClosed.abort(error));
          server.middlewares.use((req, res, next) => {
            if (req.method !== 'GET' || req.url !== '/__nelyx/status') return next();
            res
              .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
              .end(JSON.stringify({ ...event, hmr: frontend.developmentStatus() }));
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
    return {
      server,
      event,
      frontend,
      closed: serverClosed.signal,
      healthUrl: url(host === '0.0.0.0' ? '127.0.0.1' : host),
    };
  } catch (error) {
    await server.close();
    throw error;
  }
}

export async function devWeb(options, signal) {
  const app = fs.realpathSync(options.app);
  let project = await withPublicationLock(app, () => {
    const value = readApp(app);
    return compileWasm(value, inspectBackend(value, 'web'), signal);
  });
  const { server, event, frontend, closed } = await openVite(
    { ...options, app, backend: project },
    signal,
  );
  const controller = new AbortController();
  const lifetime = AbortSignal.any([signal, closed, controller.signal]);
  let pending;
  let requested = 0;
  const report = (error) => {
    if (lifetime.aborted) return;
    frontend.report(new Error(backendBuildMessage(error, 'web')));
  };
  async function rebuild() {
    let revision;
    do {
      revision = requested;
      try {
        lifetime.throwIfAborted();
        const update = await withPublicationLock(app, async () => {
          const value = readApp(app);
          const next = inspectBackend(value, 'web');
          watcher.update(next.watch);
          if (backendHash(backendContract(next)) === backendHash(backendContract(project))) return;
          return compileWasm(value, next, lifetime);
        });
        lifetime.throwIfAborted();
        if (revision !== requested) continue;
        if (update) {
          project = update;
          frontend.updateBackend(project);
        } else frontend.clearError();
      } catch (error) {
        if (revision === requested) report(error);
      }
    } while (!lifetime.aborted && revision !== requested);
  }
  const watcher = backendWatcher(() => {
    requested++;
    pending ??= rebuild().finally(() => {
      pending = undefined;
    });
  }, report);
  try {
    watcher.update(project.watch);
    if (!lifetime.aborted) await once(lifetime, 'abort');
    signal.throwIfAborted();
    if (closed.reason instanceof Error && closed.reason.name !== 'AbortError')
      closed.throwIfAborted();
    return { ...event, exitCode: 0 };
  } finally {
    watcher.close();
    controller.abort();
    await pending;
    await server.close();
  }
}

export async function runWeb(
  { app, directory, port = 4173, host = '127.0.0.1', base = '/', crossOriginIsolated },
  signal,
) {
  const value = readApp(app);
  const headers =
    (crossOriginIsolated ?? value.config.crossOriginIsolated) ? crossOriginIsolationHeaders : {};
  directory = path.resolve(directory ?? webDirectory(value.app));
  let release = verifyFrontend(directory, value, 'web');
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
        release = verifyFrontend(directory, value, 'web');
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
          ...headers,
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
      schema: 'nelyx.run/v4',
      ...route,
      format: release.format,
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
