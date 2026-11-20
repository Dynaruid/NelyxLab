// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { stripVTControlCharacters } from 'node:util';
import { localFile, sha256 } from '@nelyx/tooling-contracts/node-files';
import { readApp, readJson, writeJson } from '@nelyx/vite/runner';
import { verifyPwa } from '@nelyx/vite/release';
import { doctorWeb, openVite, prepareWeb, pwaDirectory } from './web-runner.mjs';
import { capture, execute, startOwnedCommand } from './commands.mjs';
import {
  ensureDirectory,
  ownedDirectory,
  publishDirectory,
  removeDirectory,
  withPublicationLock,
} from './publication.mjs';
import {
  androidDevDevice,
  androidTools,
  inspectPlatform,
  inspectRust,
  inspectTauriCli,
  iosDevSimulator,
  mobile,
  platformTarget,
  reversePort,
  selectAndroidDevice,
} from './tauri-platforms.mjs';
import {
  androidBuildTool,
  appleSignature,
  reportedArtifacts,
  stageArtifact,
  validateExecutable,
} from './tauri-artifacts.mjs';

const hostTemplate = path.resolve(import.meta.dirname, '../templates/tauri');
const route = { provider: 'web', format: 'pwa', host: 'tauri' };
const timeout = 1_200_000;
const hostPath = (app) => path.join(app, 'src-tauri');
const outputPath = (app, { platform, architecture }) =>
  path.join(app, '.nelyx', 'tauri', `${platform}-${architecture}`);
const mobileDirectory = (host, platform) =>
  path.join(host.directory, 'gen', platform === 'ios' ? 'apple' : platform);

function readHost(app, platform) {
  const directory = hostPath(app);
  if (!fs.existsSync(directory)) throw new Error('Run nelyx prepare --platform ' + platform);
  ownedDirectory(directory);
  for (const file of ['Cargo.toml', 'Cargo.lock', 'build.rs']) localFile(directory, file);
  const base = readJson(localFile(directory, 'tauri.conf.json'));
  const override = `tauri.${platform}.conf.json`;
  const custom = fs.existsSync(path.join(directory, override))
    ? readJson(localFile(directory, override))
    : {};
  const identifier = Object.hasOwn(custom, 'identifier') ? custom.identifier : base.identifier;
  if (typeof identifier !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(identifier))
    throw new Error('A Tauri identifier is required in ' + directory);
  const build = { ...base.build, ...custom.build };
  const security = { ...base.app?.security, ...custom.app?.security };
  return { directory, identifier, build, security };
}

function requireMobileProject(host, platform) {
  localFile(host.directory, 'src/lib.rs');
  const project = mobileDirectory(host, platform);
  const ready =
    fs.existsSync(project) &&
    (platform === 'android'
      ? fs.existsSync(path.join(project, 'gradlew'))
      : fs.readdirSync(project).some((file) => file.endsWith('.xcodeproj')));
  if (!ready)
    throw new Error(
      'Initialize the Tauri mobile project with nelyx prepare --platform ' + platform,
    );
  return project;
}

function cargoCache(app) {
  const base =
    process.platform === 'win32'
      ? process.env.LOCALAPPDATA
      : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library/Caches')
        : (process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache'));
  if (!base || !path.isAbsolute(base))
    throw new Error('Configure an absolute local Cargo cache directory');
  const hash = createHash('sha256')
    .update(process.platform === 'win32' ? app.toLowerCase() : app)
    .digest('hex')
    .slice(0, 32);
  const cache = path.join(base, 'Nelyx', 'tauri', hash, 'target');
  if (!path.relative(app, cache).startsWith('..') && !path.isAbsolute(path.relative(app, cache)))
    throw new Error('Tauri Cargo cache must be outside the app: ' + cache);
  return ensureDirectory(cache);
}

async function tauriCommand(
  app,
  host,
  cli,
  cache,
  args,
  signal,
  { observe, vars, limit = true } = {},
) {
  const bounded = limit ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : signal;
  const child = startOwnedCommand(process.execPath, [cli.entry, ...args], {
    cwd: app,
    signal: bounded,
    isolateWindows: true,
    env: {
      ...process.env,
      CARGO_TARGET_DIR: cache,
      TAURI_APP_PATH: host.directory,
      TAURI_FRONTEND_PATH: app,
      ...vars,
    },
    onStderrLine: observe,
  });
  const result = await child.completed;
  bounded.throwIfAborted();
  if (result.error || result.exitCode !== 0)
    throw new Error(`Tauri ${args[0]} failed: ${result.error ?? result.exitCode ?? result.signal}`);
}

async function doctor(options) {
  const { app, platform } = options;
  const checks = {};
  function check(name, fn) {
    try {
      checks[name] = { ok: true, ...fn() };
    } catch (error) {
      checks[name] = { ok: false, error: error.message };
    }
  }
  check('pwaRunner', () => {
    const result = doctorWeb(options);
    if (!result.ready) throw new Error(result.error);
    return { runner: result.runner, cohort: result.cohort, warnings: result.warnings };
  });
  let target;
  check('platform', () => (target = platformTarget(platform, options.architecture)));
  check('tauriCli', () => inspectTauriCli(app));
  check('hostSource', () => {
    const host = readHost(app, platform);
    if (mobile(platform)) requireMobileProject(host, platform);
    return { directory: host.directory, identifier: host.identifier };
  });
  if (target) {
    check('rust', () => inspectRust(app, target.rust));
    check('toolchain', () => inspectPlatform(target));
  }
  const ready = Object.values(checks).every(({ ok }) => ok);
  return {
    schema: 'nelyx.doctor/v3',
    ...route,
    app,
    os: platform,
    architecture: target?.architecture,
    checks,
    ready,
    exitCode: ready ? 0 : 1,
  };
}

async function prepare(value, target, signal) {
  const { app, config, version } = value;
  const { platform } = target;
  const cli = inspectTauriCli(app);
  inspectRust(app, target.rust);
  inspectPlatform(target);
  const frontend = prepareWeb({ app });
  const directory = hostPath(app);
  let created = false;
  if (!fs.existsSync(directory)) {
    const stage = fs.mkdtempSync(path.join(app, '.src-tauri-'));
    try {
      fs.cpSync(hostTemplate, stage, { recursive: true });
      fs.renameSync(path.join(stage, 'gitignore.template'), path.join(stage, '.gitignore'));
      const file = path.join(stage, 'tauri.conf.json');
      const native = readJson(file);
      const { name, displayName = name } = config;
      native.productName = displayName.replace(/[<>:"/\\|?*]/g, ' ').trim() || name;
      native.identifier = 'dev.nelyx.' + name.toLowerCase() + '.tauri';
      native.version = version;
      native.app.windows[0].title = displayName + ' · Tauri';
      writeJson(file, native);
      signal.throwIfAborted();
      fs.renameSync(stage, directory);
      created = true;
    } finally {
      removeDirectory(stage, app);
    }
  }
  const host = readHost(app, platform);
  let initialized = false;
  if (mobile(platform)) {
    if (!fs.existsSync(path.join(host.directory, 'src/lib.rs'))) {
      throw new Error(
        `Add the common Tauri lib.rs and Cargo library stanza to ${directory} before initializing ${platform}. Existing host source was preserved.`,
      );
    }
    const project = mobileDirectory(host, platform);
    if (!fs.existsSync(project)) {
      try {
        await tauriCommand(
          app,
          host,
          cli,
          cargoCache(app),
          [platform, 'init', '--ci', '--skip-targets-install'],
          signal,
          {
            // Tauri records the package-manager invocation in Gradle and Xcode.
            // Resolve the app's installed CLI via npx regardless of the caller's npm script.
            vars: {
              npm_execpath: 'npx-cli.js',
              npm_config_user_agent: undefined,
              PNPM_PACKAGE_NAME: undefined,
            },
          },
        );
        requireMobileProject(host, platform);
        initialized = true;
      } catch (error) {
        removeDirectory(project, path.dirname(project));
        throw error;
      }
    } else {
      requireMobileProject(host, platform);
    }
  }
  return {
    ...frontend,
    ...route,
    os: platform,
    architecture: target.architecture,
    hostSource: host.directory,
    identifier: host.identifier,
    created,
    initialized,
  };
}

function requireHookFree(host, commands) {
  for (const name of commands) {
    if (host.build[name])
      throw new Error(
        `Remove build.${name} from the Tauri config; Nelyx owns the Vite session and PWA build`,
      );
  }
}

async function withIpaApplication(file, parent, signal, use) {
  const temporary = fs.mkdtempSync(path.join(parent, '.ipa-'));
  try {
    await execute('ditto', ['-x', '-k', file, temporary], { signal, timeout });
    const payload = localFile(temporary, 'Payload');
    const bundle = fs.readdirSync(payload).find((name) => name.endsWith('.app'));
    if (!bundle) throw new Error('IPA has no application bundle');
    return await use(localFile(payload, bundle));
  } finally {
    removeDirectory(temporary, parent);
  }
}

async function pack(value, target, options, signal) {
  const { app, config, version } = value;
  const { platform, architecture, cli: cliTarget, rust } = target;
  const host = readHost(app, platform);
  requireHookFree(host, ['beforeBuildCommand', 'beforeBundleCommand']);
  const frontend = path.resolve(options.directory ?? pwaDirectory(app));
  const release = verifyPwa(frontend, value);
  const cli = inspectTauriCli(app);
  inspectRust(app, rust);
  const tools = inspectPlatform(target);
  const cache = cargoCache(app);
  const destination = outputPath(app, target);
  const parent = ensureDirectory(path.dirname(destination));
  const stage = fs.mkdtempSync(path.join(parent, '.pack-'));
  const configOverride = { version, build: { frontendDist: path.toNamespacedPath(frontend) } };
  const buildArgs = [
    '--target',
    cliTarget,
    '--config',
    JSON.stringify(configOverride),
    '--',
    '--locked',
    '--target-dir',
    cache,
  ];
  const artifacts = [];
  async function command(args) {
    const lines = [];
    await tauriCommand(app, host, cli, cache, args, signal, {
      observe(line) {
        const text = stripVTControlCharacters(line).trim();
        if (path.isAbsolute(text) || /Built application at:|Bundling .* \(/.test(text))
          lines.push(text);
      },
    });
    return lines;
  }
  const add = (file, format) => artifacts.push(stageArtifact(stage, file, format, tools));
  try {
    if (platform === 'android') {
      const project = requireMobileProject(host, platform);
      const apk = await command(['android', 'build', '--ci', '--debug', '--apk', ...buildArgs]);
      add(reportedArtifacts(apk, project, '.apk'), 'apk');
      const aab = await command(['android', 'build', '--ci', '--aab', ...buildArgs]);
      add(reportedArtifacts(aab, project, '.aab'), 'aab');
    } else if (platform === 'ios') {
      const project = requireMobileProject(host, platform);
      const sim = architecture.endsWith('-sim');
      const files = await command([
        'ios',
        'build',
        '--ci',
        ...(sim ? ['--no-sign'] : ['--export-method', options.exportMethod ?? 'debugging']),
        ...buildArgs,
      ]);
      add(reportedArtifacts(files, project, sim ? '.app' : '.ipa'), sim ? 'app' : 'ipa');
      if (!sim) {
        const artifact = artifacts[0];
        artifact.signature = await withIpaApplication(
          path.join(stage, artifact.file),
          stage,
          signal,
          appleSignature,
        );
      }
    } else {
      configOverride.bundle = { active: true };
      buildArgs[3] = JSON.stringify(configOverride);
      const bundles = { windows: 'nsis', linux: 'deb', macos: 'app,dmg' }[platform];
      const results = await command(['build', '--ci', '--bundles', bundles, ...buildArgs]);
      const output = path.join(cache, rust, 'release');
      if (platform !== 'macos') {
        const binary = reportedArtifacts(
          results.filter((line) => line.includes('Built application at:')),
          output,
          platform === 'windows' ? '.exe' : '',
        );
        validateExecutable(binary, platform);
        add(binary, platform === 'windows' ? 'exe' : 'binary');
      }
      const format = { windows: 'nsis', linux: 'deb', macos: 'dmg' }[platform];
      add(
        reportedArtifacts(
          results,
          path.join(output, 'bundle', format),
          platform === 'windows' ? '.exe' : '.' + format,
        ),
        format,
      );
      if (platform === 'macos')
        add(reportedArtifacts(results, path.join(output, 'bundle', 'macos'), '.app'), 'app');
    }
    signal.throwIfAborted();
    if (verifyPwa(frontend, value).buildId !== release.buildId)
      throw new Error('PWA changed during Tauri packaging; publish a stable input and retry');
    const metadata = {
      schema: 'nelyx.tauri-package/v1',
      ...route,
      os: platform,
      architecture,
      appId: config.pwa.id,
      version,
      identifier: host.identifier,
      buildId: release.buildId,
      artifacts,
    };
    writeJson(path.join(stage, 'package.json'), metadata);
    publishDirectory(stage, destination);
    return {
      ...metadata,
      directory: destination,
      artifacts: artifacts.map((item) => ({ ...item, file: path.join(destination, item.file) })),
    };
  } finally {
    removeDirectory(stage, parent);
  }
}

async function run(value, target, options, signal) {
  const { app, config } = value;
  const { platform, architecture } = target;
  const directory = outputPath(app, target);
  if (!fs.existsSync(directory))
    throw new Error(`Run nelyx pack --platform ${platform} --architecture ${architecture} first`);
  ownedDirectory(directory);
  const result = readJson(localFile(directory, 'package.json'));
  if (
    result.schema !== 'nelyx.tauri-package/v1' ||
    result.os !== platform ||
    result.architecture !== architecture ||
    result.appId !== config.pwa.id
  )
    throw new Error('The published Tauri package differs from the requested app or platform');
  function artifact(format) {
    const item = result.artifacts.find((item) => item.format === format);
    if (!item) throw new Error('Missing packaged ' + format);
    const file = localFile(directory, item.file);
    if (item.sha256 && sha256(file) !== item.sha256)
      throw new Error('Packaged artifact changed: ' + file);
    return file;
  }
  const args = options.arguments;
  if (platform === 'windows' || platform === 'linux' || platform === 'macos') {
    const file = artifact({ windows: 'exe', linux: 'binary', macos: 'app' }[platform]);
    if (platform !== 'macos') validateExecutable(file, platform);
    const [command, ...parameters] =
      platform === 'macos'
        ? ['open', '-W', '-n', file, ...(args.length ? ['--args', ...args] : [])]
        : [file, ...args];
    const child = startOwnedCommand(command, parameters, {
      signal,
      cwd: app,
      isolateWindows: true,
      windowsHide: false,
    });
    const done = await child.completed;
    signal.throwIfAborted();
    if (done.error) throw new Error(done.error);
    return {
      ...route,
      os: platform,
      architecture,
      executable: file,
      buildId: result.buildId,
      exitCode: done.exitCode ?? 1,
    };
  }
  let device = options.device;
  if (platform === 'android') {
    const tools = androidTools();
    const apk = artifact('apk');
    const [tool, ...parameters] = androidBuildTool(tools, 'aapt');
    const packageName = /^package: name='([\w.]+)'/m.exec(
      capture(tool, [...parameters, 'dump', 'badging', apk]),
    )?.[1];
    if (!packageName) throw new Error('APK application identifier is missing');
    const adb = (args) => execute(tools.adb, ['-s', device, ...args], { signal, timeout });
    await adb(['install', '-r', apk]);
    await adb([
      'shell',
      'monkey',
      '-p',
      packageName,
      '-c',
      'android.intent.category.LAUNCHER',
      '1',
    ]);
  } else if (architecture.endsWith('-sim')) {
    device ??= 'booted';
    await execute('xcrun', ['simctl', 'install', device, artifact('app')], { signal, timeout });
    await execute('xcrun', ['simctl', 'launch', device, result.identifier], { signal, timeout });
  } else {
    if (!device) throw new Error('Choose an iOS device with --device <identifier>');
    const parent = ensureDirectory(path.join(app, '.nelyx'));
    await withIpaApplication(artifact('ipa'), parent, signal, async (bundle) => {
      await execute(
        'xcrun',
        ['devicectl', 'device', 'install', 'app', '--device', device, bundle],
        { signal, timeout },
      );
      await execute(
        'xcrun',
        ['devicectl', 'device', 'process', 'launch', '--device', device, result.identifier],
        { signal, timeout },
      );
    });
  }
  return { ...route, os: platform, architecture, device, buildId: result.buildId, exitCode: 0 };
}

async function dev(value, target, options, signal) {
  const { app } = value;
  const { platform, rust, architecture } = target;
  const host = readHost(app, platform);
  requireHookFree(host, ['beforeDevCommand']);
  const cli = inspectTauriCli(app);
  const tools = inspectPlatform(target);
  const isMobile = mobile(platform);
  if (isMobile) requireMobileProject(host, platform);
  const android = platform === 'android';
  const device = options.device;
  const physicalIos = platform === 'ios' && !architecture.endsWith('-sim');
  const devDevice = android
    ? androidDevDevice(tools.adb, device)
    : platform === 'ios' && !physicalIos
      ? iosDevSimulator(device)
      : device;
  const advertisedHost = physicalIos ? (options.host ?? process.env.TAURI_DEV_HOST) : undefined;
  if (physicalIos && (!device || !advertisedHost)) {
    throw new Error(
      'iOS device dev requires --device and a device-reachable --host or TAURI_DEV_HOST with trusted HTTPS',
    );
  }
  const configured = new URL(host.build.devUrl ?? 'http://127.0.0.1:1420/');
  const port =
    options.port ?? Number(configured.port || (configured.protocol === 'https:' ? '443' : '80'));
  const serverLifetime = new AbortController();
  const devSignal = AbortSignal.any([signal, serverLifetime.signal]);
  const session = await openVite(
    {
      app,
      port,
      host: advertisedHost ? '0.0.0.0' : '127.0.0.1',
      advertisedHost,
      tauri: true,
      os: platform,
    },
    devSignal,
  );
  function abortDev(reason) {
    serverLifetime.abort(reason);
  }
  const onClose = () => abortDev(new Error('Vite stopped'));
  session.server.httpServer.once('close', onClose);
  session.server.httpServer.once('error', abortDev);
  let unmap;
  try {
    const url = new URL(session.event.url);
    if (physicalIos && url.protocol !== 'https:')
      throw new Error('Enable trusted HTTPS in the iOS Vite configuration');
    const status = await fetch(new URL('__nelyx/status', physicalIos ? url : session.healthUrl), {
      redirect: 'error',
      signal: AbortSignal.any([devSignal, AbortSignal.timeout(10_000)]),
    });
    const event = await status.json();
    if (
      !status.ok ||
      ['provider', 'target', 'session', 'app', 'runner', 'url', 'host'].some(
        (key) => event[key] !== session.event[key],
      )
    )
      throw new Error('Vite readiness mismatch at ' + url.href);
    if (android) unmap = await reversePort(tools.adb, device, port, devSignal);
    const ws = (url.protocol === 'https:' ? 'wss://' : 'ws://') + url.host;
    const current = host.security.devCsp ?? host.security.csp ?? {};
    const devCsp =
      typeof current === 'string'
        ? /(?:^|;)\s*connect-src\b/.test(current)
          ? current.replace(/((?:^|;)\s*connect-src\b[^;]*)/, '$1 ' + ws)
          : current + "; connect-src 'self' " + ws
        : {
            ...current,
            'connect-src': (current['connect-src'] ?? "'self' ipc:") + ' ' + ws,
          };
    const override = JSON.stringify({ build: { devUrl: url.href }, app: { security: { devCsp } } });
    const args = isMobile
      ? [platform, 'dev', '--no-dev-server', ...(android ? ['--host', '127.0.0.1'] : [])]
      : ['dev', '--target', rust];
    const cache = cargoCache(app);
    await tauriCommand(
      app,
      host,
      cli,
      cache,
      [
        ...args,
        '--exit-on-panic',
        '--no-dev-server-wait',
        '--config',
        override,
        ...(devDevice ? [devDevice] : []),
        '--',
        '--locked',
        '--target-dir',
        cache,
      ],
      devSignal,
      {
        limit: false,
        vars: {
          ...(advertisedHost ? { TAURI_DEV_HOST: advertisedHost } : {}),
          ...(android ? { ANDROID_SERIAL: device } : {}),
        },
      },
    );
    return {
      ...session.event,
      ...route,
      os: platform,
      architecture,
      ...(device ? { device } : {}),
      exitCode: 0,
    };
  } finally {
    session.server.httpServer.off('close', onClose);
    session.server.httpServer.off('error', abortDev);
    try {
      unmap?.();
    } finally {
      await session.server.close();
    }
  }
}

export async function tauriOperation(operation, options, signal) {
  const app = fs.realpathSync(options.app);
  if (operation === 'doctor') return doctor({ ...options, app });
  const value = readApp(app);
  let { architecture, platform } = options;
  if (platform === 'android' && ['dev', 'run'].includes(operation)) {
    const { adb } = androidTools();
    const device = selectAndroidDevice(adb, options.device);
    const abi = capture(adb, ['-s', device, 'shell', 'getprop', 'ro.product.cpu.abi']).trim();
    const deviceArch = { x86_64: 'x64', 'arm64-v8a': 'arm64' }[abi];
    if (!deviceArch || (architecture && architecture !== deviceArch))
      throw new Error(`Device ${device} reports ${abi}; choose ${deviceArch ?? 'a 64-bit device'}`);
    architecture = deviceArch;
    options = { ...options, device };
  }
  const target = platformTarget(platform, architecture);
  if (operation === 'run') return run(value, target, options, signal);
  const build = () =>
    withPublicationLock(hostPath(app), () => {
      if (operation === 'prepare') return prepare(value, target, signal);
      if (operation === 'dev') return dev(value, target, options, signal);
      return pack(value, target, options, signal);
    });
  if (operation !== 'pack') return build();
  return withPublicationLock(app, async () => {
    const frontend = path.resolve(options.directory ?? pwaDirectory(app));
    const parent = path.dirname(frontend);
    const sourceApp = path.dirname(parent);
    if (
      path.basename(frontend) === 'pwa' &&
      path.basename(parent) === '.nelyx' &&
      path.relative(app, sourceApp)
    )
      return withPublicationLock(sourceApp, build);
    return build();
  });
}
