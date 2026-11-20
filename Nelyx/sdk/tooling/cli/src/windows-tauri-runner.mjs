// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { stripVTControlCharacters } from 'node:util';
import { readApplication } from './application.mjs';
import { startOwnedCommand } from './commands.mjs';
import { localFile, sha256 } from './files.mjs';
import { buildWebInto, prepareWeb } from './web-runner.mjs';
import {
  inspectMsvc,
  inspectRust,
  inspectTauriCli,
  inspectWebView2,
  tauriWindowsTarget,
} from './windows-tauri-prerequisites.mjs';

const route = { target: 'windows', host: 'tauri', frontendTarget: 'web', profile: 'ganesh-webgl2' };
const hostTemplate = path.resolve(import.meta.dirname, '../templates/windows-tauri');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const exePath = (app) => path.join(app, '.nelyx/tauri/windows-x64/nelyx-tauri.exe');
const samePath = (actual, expected) =>
  typeof actual === 'string' && path.isAbsolute(actual) && path.relative(expected, actual) === '';

function assertDirectory(directory) {
  const entry = fs.lstatSync(directory);
  if (
    !entry.isDirectory() ||
    entry.isSymbolicLink() ||
    !samePath(fs.realpathSync(directory), directory)
  )
    throw new Error(`Tauri requires a real directory: ${directory}`);
}

function ensureDirectory(directory) {
  let ancestor = directory;
  while (!fs.lstatSync(ancestor, { throwIfNoEntry: false })) ancestor = path.dirname(ancestor);
  assertDirectory(ancestor);
  fs.mkdirSync(directory, { recursive: true });
  assertDirectory(directory);
}

function removeStage(stage, parent) {
  if (path.dirname(stage) !== parent)
    throw new Error(`Unexpected Tauri staging location: ${stage}`);
  if (!fs.lstatSync(stage, { throwIfNoEntry: false })) return;
  assertDirectory(stage);
  fs.rmSync(stage, { recursive: true, force: true, maxRetries: 5 });
}

async function inspectWebApplication(app) {
  const runner = path.join(app, 'web', 'runner');
  try {
    const value = await readApplication(app, 'web', { prepareAssets: false });
    const installed = value
      .load('@nelyx/metro/web-config')
      .inspectWebRunnerCohort({ runnerRoot: value.runner });
    if (
      value.profile.id !== route.profile ||
      installed.react !== value.cohort.react ||
      installed.reactNativeWeb !== value.cohort.frameworkVersion
    )
      throw new Error(`Web runner must supply the configured ${route.profile} cohort`);
    return value;
  } catch (error) {
    throw new Error(
      `Web runner setup in ${runner}: ${error.message}. Configure targets.web, supply --target web and run npm.cmd ci --workspaces=false in the runner.`,
      { cause: error },
    );
  }
}

function devUrl(raw, file, port) {
  const url = typeof raw === 'string' ? URL.parse(raw) : null;
  if (
    !url ||
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.href !== `${url.origin}/` ||
    url.port === '0'
  )
    throw new Error(`${file} build.devUrl requires a loopback HTTP root (127.0.0.1 or localhost)`);
  if (port !== undefined) url.port = String(port);
  return url;
}

function readHost(directory) {
  if (!fs.lstatSync(directory, { throwIfNoEntry: false }))
    throw new Error(
      `Tauri host missing: ${directory}. Run nelyx prepare --target windows --host tauri for this app.`,
    );
  assertDirectory(directory);
  for (const entry of ['Cargo.toml', 'Cargo.lock', 'build.rs', 'tauri.conf.json']) {
    if (!fs.statSync(localFile(directory, entry)).isFile())
      throw new Error(`Tauri host file required: ${path.join(directory, entry)}`);
  }
  const file = path.join(directory, 'tauri.conf.json');
  const config = readJson(file);
  const windowsFile = path.join(directory, 'tauri.windows.conf.json');
  const windows = fs.existsSync(windowsFile)
    ? readJson(localFile(directory, 'tauri.windows.conf.json'))
    : {};
  const identifier = Object.hasOwn(windows, 'identifier') ? windows.identifier : config.identifier;
  if (typeof identifier !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(identifier))
    throw new Error(`Tauri identifier required: ${file}`);
  const url = Object.hasOwn(windows.build ?? {}, 'devUrl')
    ? devUrl(windows.build.devUrl, windowsFile)
    : devUrl(config.build?.devUrl, file);
  return { directory, file, identifier, devUrl: url.href };
}

async function doctor(app) {
  const checks = {};
  const hostDirectory = path.join(app, 'src-tauri');
  async function check(name, inspect) {
    try {
      checks[name] = { ok: true, ...(await inspect()) };
    } catch (error) {
      checks[name] = { ok: false, error: error.message };
    }
  }
  await check('webRunner', async () => {
    const value = await inspectWebApplication(app);
    value.load('@nelyx/metro/assets').verifyAppAssets(value.app, value.config.assets);
    return { runner: value.runner, cohort: value.cohort };
  });
  await check('hostSource', () => readHost(hostDirectory));
  await check('tauriCli', () => inspectTauriCli(app));
  await check('rust', () => inspectRust(checks.hostSource.ok ? hostDirectory : app));
  await check('msvc', inspectMsvc);
  await check('webview2', inspectWebView2);
  const ready = Object.values(checks).every((result) => result.ok);
  return {
    schema: 'nelyx.doctor/v3',
    ...route,
    app,
    runner: path.join(app, 'web', 'runner'),
    executable: exePath(app),
    adapters: { prepare: true, build: true, run: true, dev: true, pack: false },
    checks,
    ready,
    exitCode: ready ? 0 : 1,
  };
}

async function prepare(app) {
  const value = await inspectWebApplication(app);
  const directory = path.join(app, 'src-tauri');
  const existing = fs.lstatSync(directory, { throwIfNoEntry: false }) && readHost(directory);
  const prepared = await prepareWeb({ app });
  if (existing) return { ...prepared, ...route, hostSource: existing, created: false };

  const stage = fs.mkdtempSync(path.join(app, '.src-tauri-'));
  let created = false;
  try {
    fs.cpSync(hostTemplate, stage, { recursive: true });
    fs.renameSync(path.join(stage, 'gitignore.template'), path.join(stage, '.gitignore'));
    const file = path.join(stage, 'tauri.conf.json');
    const config = readJson(file);
    const { name, displayName = name } = value.config;
    config.productName = displayName.replace(/[<>:"/\\|?*]/g, ' ').trim() || name;
    config.identifier = `dev.nelyx.${name.toLowerCase()}.tauri`;
    config.version = readJson(path.join(app, 'package.json')).version ?? config.version;
    config.app.windows[0].title = `${displayName} · Tauri`;
    fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
    readHost(stage);
    try {
      fs.renameSync(stage, directory);
      created = true;
    } catch (error) {
      if (!['EEXIST', 'EPERM', 'ENOTEMPTY'].includes(error.code) || !fs.existsSync(directory))
        throw error;
    }
    return { ...prepared, ...route, hostSource: readHost(directory), created };
  } finally {
    removeStage(stage, app);
  }
}

function cacheFor(app) {
  const local = process.env.LOCALAPPDATA;
  if (!local || !path.isAbsolute(local))
    throw new Error('Windows Tauri requires an absolute LOCALAPPDATA for its Cargo cache');
  const hash = createHash('sha256').update(app.toLowerCase()).digest('hex').slice(0, 32);
  const directory = path.join(fs.realpathSync(local), 'Nelyx', 'tauri', hash);
  const relative = path.relative(app, directory);
  if (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))
    throw new Error(`Tauri cache must be outside the Web app's Metro watch root: ${directory}`);
  ensureDirectory(directory);
  const target = path.join(directory, 'target');
  ensureDirectory(target);
  return { directory, target, hash };
}

async function lockBuild(cache) {
  // Windows releases the per-app pipe even if the CLI process is terminated.
  const name = `\\\\.\\pipe\\nelyx-tauri-build-${cache.hash}`;
  const server = net.createServer((socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(name, resolve);
  }).catch((error) => {
    if (error.code === 'EADDRINUSE')
      throw new Error(`A Tauri build is already active for this app (${cache.directory})`);
    throw error;
  });
  return () =>
    new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function verifyWebOutput(value, directory, build) {
  if (!Array.isArray(build.files)) throw new Error('Missing Web build file inventory');
  const hashes = new Map();
  for (const record of build.files) {
    const file = localFile(directory, record.path);
    const key = record.path.toLowerCase();
    if (hashes.has(key) || !fs.statSync(file).isFile() || sha256(file) !== record.sha256)
      throw new Error(`Invalid Web build file or hash: ${record.path}`);
    hashes.set(key, record.sha256);
  }
  const runtimeNames = ['canvaskit.js', 'canvaskit.wasm'];
  for (const name of [
    'index.html',
    'application.js',
    'application.js.map',
    'runtime/native-manifest.json',
    ...runtimeNames.map((name) => `runtime/${name}`),
  ]) {
    if (!hashes.has(name)) throw new Error(`Missing build.json record: ${name}`);
  }
  const runtime = readJson(localFile(directory, 'runtime/native-manifest.json'));
  if (
    runtime.schema !== 'nelyx.canvaskit/v1' ||
    !Array.isArray(runtime.files) ||
    runtime.files.length !== runtimeNames.length ||
    !runtimeNames.every((name) =>
      runtime.files.some(
        (record) =>
          record.id === name &&
          record.path === name &&
          record.sha256 === hashes.get(`runtime/${name}`),
      ),
    )
  )
    throw new Error('CanvasKit JS/Wasm manifest does not match build.json');

  const config = readJson(localFile(value.runner, 'app-config.json'));
  value.load('@nelyx/metro/assets').verifyAppAssets(directory, config.assets);
  for (const name of [
    'canvaskit-BSD-3-Clause.txt',
    'react-refresh-MIT.txt',
    'metro-runtime-MIT.txt',
    'eventemitter3-NOTICE.txt',
    'Nelyx-core-BSD-3-Clause.md',
    'Nelyx-sdk-BSD-3-Clause.md',
    'Nelyx-skia-web-LICENSE.md',
  ]) {
    const file = fs.statSync(localFile(directory, `licenses/${name}`));
    if (!file.isFile() || file.size === 0) throw new Error(`Invalid Web license: ${name}`);
  }
}

function verifyExe(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const dos = Buffer.alloc(64);
    const pe = Buffer.alloc(26);
    if (
      fs.readSync(fd, dos, 0, dos.length, 0) !== dos.length ||
      dos.toString('ascii', 0, 2) !== 'MZ' ||
      fs.readSync(fd, pe, 0, pe.length, dos.readUInt32LE(60)) !== pe.length ||
      pe.readUInt32LE(0) !== 0x4550 ||
      pe.readUInt16LE(4) !== 0x8664 ||
      (pe.readUInt16LE(22) & 0x2002) !== 0x0002 ||
      pe.readUInt16LE(24) !== 0x20b
    )
      throw new Error(`Windows x64 executable required: ${file}`);
    return fs.fstatSync(fd).size;
  } finally {
    fs.closeSync(fd);
  }
}

function publishExe(source, destination) {
  const directory = path.dirname(destination);
  const bytes = verifyExe(source);
  ensureDirectory(directory);
  const temp = path.join(directory, `nelyx-tauri-${randomUUID()}.tmp`);
  try {
    fs.copyFileSync(source, temp, fs.constants.COPYFILE_EXCL);
    try {
      fs.renameSync(temp, destination);
    } catch (error) {
      throw new Error(
        `Could not publish ${destination}. Close any running copy and retry. ${error.message}`,
        {
          cause: error,
        },
      );
    }
    return bytes;
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

function startTauri(app, host, cli, cache, args, signal, onStderrLine) {
  return startOwnedCommand(process.execPath, [cli.entry, ...args], {
    cwd: app,
    env: {
      ...process.env,
      CARGO_TARGET_DIR: cache.target,
      TAURI_APP_PATH: host.directory,
      TAURI_FRONTEND_PATH: app,
    },
    onStderrLine,
    signal,
    isolateWindows: true,
  });
}

function exitCode(result, label, signal) {
  signal.throwIfAborted();
  if (result.error) throw new Error(`${label} could not start: ${result.error}`);
  return result.exitCode ?? 1;
}

async function build(app, signal) {
  const host = readHost(path.join(app, 'src-tauri'));
  const cli = inspectTauriCli(app);
  const value = await inspectWebApplication(app);
  const cache = cacheFor(app);
  const unlock = await lockBuild(cache);
  try {
    signal.throwIfAborted();
    const directory = fs.mkdtempSync(path.join(cache.directory, 'web-'));
    try {
      const staticBuild = await buildWebInto(value.runner, directory, {
        signal,
        isolateWindows: true,
      });
      try {
        verifyWebOutput(value, directory, staticBuild);
      } catch (error) {
        throw new Error(`Invalid Tauri Web input in ${directory}: ${error.message}`, {
          cause: error,
        });
      }
      // Tauri tries a URL before a directory. A drive letter can parse as a URL scheme.
      const config = JSON.stringify({ build: { frontendDist: path.toNamespacedPath(directory) } });
      let binary;
      const release = startTauri(
        app,
        host,
        cli,
        cache,
        [
          'build',
          '--no-bundle',
          '--target',
          tauriWindowsTarget,
          '--config',
          config,
          '--',
          '--locked',
        ],
        signal,
        (line) => {
          const reported = /^\s*Built application at:\s+(.+\.exe)\s*$/i.exec(
            stripVTControlCharacters(line),
          )?.[1];
          if (reported) binary = reported;
        },
      );
      const code = exitCode(await release.completed, 'Tauri build', signal);
      if (code !== 0) throw new Error(`Tauri build exited ${code}`);
      const releaseDirectory = path.join(cache.target, tauriWindowsTarget, 'release');
      assertDirectory(releaseDirectory);
      if (!binary || !samePath(path.dirname(binary), releaseDirectory))
        throw new Error(`Tauri build did not report its executable in ${releaseDirectory}`);
      const executable = exePath(app);
      const bytes = publishExe(localFile(releaseDirectory, path.basename(binary)), executable);
      return { schema: 'nelyx.build/v3', ...route, app, runner: value.runner, executable, bytes };
    } finally {
      removeStage(directory, cache.directory);
    }
  } finally {
    await unlock();
  }
}

async function run(app, args, signal) {
  const executable = exePath(app);
  if (!fs.existsSync(executable))
    throw new Error(
      `Tauri release EXE missing: ${executable}. Run nelyx build --target windows --host tauri for this app.`,
    );
  assertDirectory(path.dirname(executable));
  verifyExe(localFile(path.dirname(executable), path.basename(executable)));
  inspectWebView2();
  const child = startOwnedCommand(executable, args, {
    cwd: app,
    signal,
    isolateWindows: true,
    windowsHide: false,
  });
  return {
    schema: 'nelyx.run/v3',
    ...route,
    app,
    executable,
    exitCode: exitCode(await child.completed, 'Tauri release EXE', signal),
  };
}

async function dev(app, port, signal) {
  const host = readHost(path.join(app, 'src-tauri'));
  const cli = inspectTauriCli(app);
  const value = await inspectWebApplication(app);
  inspectWebView2();
  const cache = cacheFor(app);
  const url = devUrl(host.devUrl, host.file, port);
  const ready = Promise.withResolvers();
  const metro = startOwnedCommand(
    process.execPath,
    [
      path.join(import.meta.dirname, 'main.mjs'),
      'dev',
      '--app',
      app,
      '--target',
      'web',
      '--host',
      url.hostname,
      '--port',
      url.port || '80',
    ],
    {
      cwd: value.runner,
      signal,
      isolateWindows: true,
      onStderrLine(line) {
        if (!line.includes('nelyx.dev.ready')) return;
        try {
          const event = JSON.parse(line);
          if (event.event === 'nelyx.dev.ready') ready.resolve(event);
        } catch {
          // Other Metro messages share stderr.
        }
      },
    },
  );
  const metroEnded = metro.completed.then((result) => {
    const code = exitCode(result, 'Metro', signal);
    throw Object.assign(new Error(`Metro stopped at ${url.href} (exit ${code})`), {
      exitCode: code || 1,
    });
  });
  const timeout = setTimeout(
    () => ready.reject(new Error(`Metro readiness timed out: ${url.href}`)),
    1_200_000,
  );
  let window;
  try {
    const event = await Promise.race([ready.promise, metroEnded]);
    clearTimeout(timeout);
    signal.throwIfAborted();
    if (
      event.target !== 'web' ||
      URL.parse(event.url)?.href !== url.href ||
      !samePath(event.runner, value.runner)
    )
      throw new Error(`Metro readiness mismatch for ${url.href} (${value.runner})`);

    const statusUrl = new URL('/__nelyx/status', url);
    const response = await Promise.race([
      fetch(statusUrl, {
        redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      }),
      metroEnded,
    ]);
    if (!response.ok)
      throw new Error(`Metro status at ${statusUrl} returned HTTP ${response.status}`);
    const status = await response.json();
    if (
      status.target !== 'web' ||
      !samePath(status.app, app) ||
      !samePath(status.runner, value.runner)
    )
      throw new Error(`Metro status mismatch for ${url.href} (${app})`);

    const config = JSON.stringify({ build: { devUrl: url.href } });
    window = startTauri(
      app,
      host,
      cli,
      cache,
      [
        'dev',
        '--target',
        tauriWindowsTarget,
        '--exit-on-panic',
        '--config',
        config,
        '--',
        '--locked',
      ],
      signal,
    );
    const code = exitCode(await Promise.race([window.completed, metroEnded]), 'Tauri dev', signal);
    return {
      schema: 'nelyx.dev/v2',
      ...route,
      app,
      runner: value.runner,
      url: url.href,
      exitCode: code,
    };
  } finally {
    clearTimeout(timeout);
    await Promise.all([metro.stop(), window?.stop()]);
  }
}

export async function tauriWindowsOperation(operation, { app, port, arguments: args }) {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error('Tauri host requires Windows x64 and x64 Node.js');
  app = fs.realpathSync(app);
  if (operation === 'doctor') return doctor(app);
  if (operation === 'prepare') return prepare(app);
  const controller = new AbortController();
  const signals = ['SIGINT', 'SIGTERM', 'SIGBREAK'];
  const cancel = () =>
    controller.abort(Object.assign(new Error('Tauri command interrupted'), { exitCode: 130 }));
  for (const name of signals) process.on(name, cancel);
  try {
    if (operation === 'build') return await build(app, controller.signal);
    if (operation === 'run') return await run(app, args, controller.signal);
    return await dev(app, port, controller.signal);
  } catch (error) {
    controller.signal.throwIfAborted();
    throw error;
  } finally {
    for (const name of signals) process.off(name, cancel);
  }
}
