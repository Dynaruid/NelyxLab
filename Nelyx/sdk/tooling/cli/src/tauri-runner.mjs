// SPDX-License-Identifier: BSD-3-Clause
import { cleanSkiaOverrides, foregroundBuildEnv, foregroundSupply } from './native-skia-supply.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter, once } from 'node:events';
import { stripVTControlCharacters } from 'node:util';
import { localFile, sha256 } from '@nelyx/tooling-contracts/node-files';
import { inspectRunner, readApp, readJson, writeJson } from '@nelyx/vite/runner';
import { verifyFrontend } from '@nelyx/vite/release';
import { backendHash } from '@nelyx/tooling-contracts/backend-supply';
import { doctorFrontend, openVite, prepareFrontend, publishFrontend } from './web-runner.mjs';
import {
  backendBuildMessage,
  backendContract,
  cargoBuildEnvironment,
  cargoCache,
  useCargoLock,
} from './backend-project.mjs';
import {
  applyMobileInputs,
  configureMobileCallback,
  generateTauriHost,
  hostPath,
  inspectTauriBackend,
  mobileDirectory,
  tauriFrontend,
} from './tauri-host.mjs';
import { backendWatcher } from './backend-watch.mjs';
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
  androidDeviceArchitecture,
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
  appleSignature,
  inspectApk,
  reportedArtifacts,
  stageArtifact,
  validateExecutable,
} from './tauri-artifacts.mjs';
import { buildStage, readBuildState } from './build-cache.mjs';
import {
  debugPackageKey,
  verifyNativePackage,
  windowsPackageKey,
} from './native-package-cache.mjs';

const route = { provider: 'web', format: 'tauri', target: 'tauri', host: 'tauri' };
const timeout = 1_200_000;
const outputPath = (app, { platform, architecture }, apkOnly) =>
  path.join(app, '.nelyx', 'tauri', `${platform}-${architecture}${apkOnly ? '-debug' : ''}`);

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
      'Initialize the Tauri mobile project with nelyx prepare --target tauri --platform ' +
        platform,
    );
  return project;
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
  let output = '';
  function lineOutput(line) {
    output = (output + line + '\n').slice(-8192);
    observe?.(line);
  }
  const env = {
    ...process.env,
    CARGO_TARGET_DIR: cache,
    TAURI_APP_PATH: host.directory,
    TAURI_FRONTEND_PATH: app,
    ...vars,
  };
  if (host.nativeForegroundTarget) {
    cleanSkiaOverrides(env);
    Object.assign(
      env,
      await foregroundBuildEnv(
        path.join(path.dirname(cache), 'skia-supply'),
        host.nativeForegroundTarget,
        bounded,
      ),
    );
  }
  const child = startOwnedCommand(process.execPath, [cli.entry, ...args], {
    cwd: app,
    signal: bounded,
    env,
    onStderrLine: lineOutput,
    onStdoutLine: lineOutput,
  });
  const result = await child.completed;
  bounded.throwIfAborted();
  if (result.error || result.exitCode !== 0)
    throw Object.assign(
      new Error(`Tauri ${args[0]} failed: ${result.error ?? result.exitCode ?? result.signal}`),
      { output },
    );
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
  check('frontend', () => {
    const result = doctorFrontend(app, 'tauri');
    if (!result.ready) throw new Error(result.error);
    return { runner: result.runner, cohort: result.cohort };
  });
  let target;
  check('platform', () => (target = platformTarget(platform, options.architecture)));
  check('tauriCli', () => inspectTauriCli(app));
  check('backend', () =>
    backendContract(inspectTauriBackend(readApp(app), { requireLock: false })),
  );
  if (target) {
    check('rust', () => inspectRust(app, target.rust));
    check('toolchain', () => inspectPlatform(target));
  }
  const ready = Object.values(checks).every(({ ok }) => ok);
  return {
    schema: 'nelyx.doctor/v4',
    ...route,
    app,
    os: platform,
    architecture: target?.architecture,
    checks,
    ready,
    exitCode: ready ? 0 : 1,
  };
}

async function nativeHost(value, target, project, cli, signal, options = {}) {
  const { app } = value;
  const { platform } = target;
  const created = !fs.existsSync(path.join(hostPath(app), 'Cargo.toml'));
  const host = generateTauriHost(value, project, platform, options.frontendBuildId);
  if (
    (host.windowsPlatformViews ||
      host.androidPlatformViews ||
      host.linuxPlatformViews ||
      host.applePlatformViews) &&
    foregroundSupply.targets[target.rust]
  )
    host.nativeForegroundTarget = target.rust;
  await useCargoLock(project, host.directory, app, signal, options);
  let initialized = false;
  if (mobile(platform)) {
    const start = performance.now();
    const directory = mobileDirectory(host, platform);
    const parent = ensureDirectory(path.join(host.directory, 'gen'));
    const marker = path.join(parent, '.nelyx-' + platform + '.json');
    const current = readBuildState(marker);
    const desired = {
      schema: 2,
      identifier: host.identifier,
      productName: host.productName,
      cli: cli.version,
    };
    const canMigrate =
      current?.schema === undefined &&
      current?.inputs === backendHash([]) &&
      current.identifier === desired.identifier &&
      current.cli === desired.cli;
    if (
      !fs.existsSync(directory) ||
      (!canMigrate && Object.keys(desired).some((key) => current?.[key] !== desired[key]))
    ) {
      let backup;
      if (fs.existsSync(directory)) {
        ownedDirectory(directory);
        backup = path.join(parent, '.mobile-' + randomUUID());
        fs.renameSync(directory, backup);
      }
      try {
        await tauriCommand(
          app,
          host,
          cli,
          cargoCache(app, 'tauri'),
          [platform, 'init', '--ci', '--skip-targets-install'],
          signal,
          {
            vars: {
              npm_execpath: 'npx-cli.js',
              npm_config_user_agent: undefined,
              PNPM_PACKAGE_NAME: undefined,
            },
          },
        );
        requireMobileProject(host, platform);
        applyMobileInputs(app, host, platform, marker, desired);
        configureMobileCallback(host, platform);
        initialized = true;
      } catch (error) {
        removeDirectory(directory, parent);
        if (backup) fs.renameSync(backup, directory);
        if (current) writeJson(marker, current);
        else if (fs.existsSync(marker)) fs.unlinkSync(marker);
        throw error;
      }
      if (backup) removeDirectory(backup, parent);
    } else {
      requireMobileProject(host, platform);
      applyMobileInputs(app, host, platform, marker, desired, current);
      configureMobileCallback(host, platform);
    }
    buildStage('mobile-project', start, {
      platform,
      initialized,
      reason: initialized
        ? 'missing project or template identity changed'
        : 'generated project and overlays reused',
    });
  }
  return { ...host, created, initialized };
}

async function prepare(value, target, options, signal) {
  const { app } = value;
  const { platform, architecture } = target;
  const cli = inspectTauriCli(app);
  inspectRust(app, target.rust);
  inspectPlatform(target);
  const frontend = prepareFrontend(app, 'tauri');
  const project = inspectTauriBackend(value, { requireLock: false });
  const host = await nativeHost(value, target, project, cli, signal, {
    prepare: true,
    update: options.updateLock,
  });
  return {
    ...frontend,
    ...route,
    os: platform,
    architecture,
    backend: backendContract(inspectTauriBackend(value)),
    hostSource: host.directory,
    identifier: host.identifier,
    created: host.created,
    initialized: host.initialized,
  };
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
  const started = performance.now();
  const { app, name, version } = value;
  const { platform, architecture, cli: cliTarget, rust } = target;
  const { apkOnly } = options;
  const frontend = path.resolve(options.directory ?? tauriFrontend(app));
  const project = inspectTauriBackend(value);
  const contract = backendContract(project);
  const release = verifyFrontend(frontend, inspectRunner(app), 'tauri', contract);
  const cli = inspectTauriCli(app);
  const compiler = inspectRust(app, rust);
  const tools = inspectPlatform(target);
  const host = await nativeHost(value, target, project, cli, signal, {
    frontendBuildId: release.buildId,
  });
  const cache = cargoCache(app, 'tauri');
  const destination = outputPath(app, target, apkOnly);
  const configOverride = {
    version,
    ...(!mobile(platform) ? { bundle: { active: true } } : {}),
    ...(path.relative(tauriFrontend(app), frontend)
      ? { build: { frontendDist: path.toNamespacedPath(frontend) } }
      : {}),
  };
  const cacheKey = () => {
    if (project.appCrate?.customBuild) return;
    if (platform === 'windows')
      return windowsPackageKey(
        app,
        tools,
        target,
        release,
        contract,
        cli,
        compiler,
        configOverride,
      );
    if (apkOnly)
      return debugPackageKey(
        app,
        mobileDirectory(host, platform),
        tools,
        target,
        release,
        contract,
        cli,
        compiler,
        configOverride,
      );
  };
  const before = cacheKey();
  const cached = verifyNativePackage(destination, before, release, target, host.identifier, tools);
  const summary = (metadata) => ({
    ...metadata,
    directory: destination,
    artifacts: metadata.artifacts.map((item) => ({
      ...item,
      file: path.join(destination, item.file),
    })),
  });
  if (cached) {
    buildStage('tauri-package', started, {
      platform,
      architecture,
      frontendBuildId: release.buildId,
      calls: 0,
      releaseAabCalls: 0,
      artifacts: cached.artifacts.map(({ format, sha256 }) => ({ format, sha256 })),
      reason: apkOnly ? 'verified Debug APK reused' : 'verified Windows packages reused',
    });
    return summary(cached);
  }
  const parent = ensureDirectory(path.dirname(destination));
  const stage = fs.mkdtempSync(path.join(parent, '.pack-'));
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
  async function command(args, format = platform) {
    const start = performance.now();
    const lines = [];
    let upToDate = 0,
      fromCache = 0,
      configurationCache = false;
    await tauriCommand(app, host, cli, cache, args, signal, {
      observe(line) {
        const text = stripVTControlCharacters(line).trim();
        if (text.endsWith(' UP-TO-DATE')) upToDate++;
        if (text.endsWith(' FROM-CACHE')) fromCache++;
        if (/Reusing configuration cache|Configuration cache entry reused/i.test(text))
          configurationCache = true;
        if (path.isAbsolute(text) || /Built application at:|Bundling .* \(/.test(text))
          lines.push(text);
      },
    });
    buildStage(platform === 'android' ? 'gradle' : 'os-bundle', start, {
      platform,
      architecture,
      format,
      calls: 1,
      ...(platform === 'android' ? { upToDate, fromCache, configurationCache } : {}),
    });
    return lines;
  }
  const add = (file, format) => artifacts.push(stageArtifact(stage, file, format, tools));
  try {
    if (platform === 'android') {
      const project = requireMobileProject(host, platform);
      if (!fs.existsSync(path.join(app, 'platform', 'android', 'project'))) {
        // Incremental ZIP updates can leave large gaps after replacing the native library.
        const debugApk = 'app/build/outputs/apk/universal/debug/app-universal-debug.apk';
        if (fs.existsSync(path.join(project, debugApk)))
          fs.unlinkSync(localFile(project, debugApk));
      }
      const apkLog = await command(
        ['android', 'build', '--ci', '--debug', '--apk', ...buildArgs],
        'debug-apk',
      );
      const apk = reportedArtifacts(apkLog, project, '.apk');
      add(apk, 'apk');
      Object.assign(artifacts[0], inspectApk(apk, tools, architecture, host.identifier));
      if (!apkOnly) {
        const aab = await command(
          ['android', 'build', '--ci', '--aab', ...buildArgs],
          'release-aab',
        );
        add(reportedArtifacts(aab, project, '.aab'), 'aab');
      }
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
    const current = inspectRunner(app);
    const fresh = backendContract(inspectTauriBackend(current));
    if (
      backendHash(contract) !== backendHash(fresh) ||
      verifyFrontend(frontend, current, 'tauri', fresh).buildId !== release.buildId
    )
      throw new Error('Frontend or backend changed during Tauri packaging');
    const after = cacheKey();
    const reuseKey = after && (before === undefined || before === after) ? after : undefined;
    const metadata = {
      schema: 'nelyx.tauri-package/v2',
      ...route,
      os: platform,
      architecture,
      rustTarget: rust,
      appId: name,
      version,
      identifier: host.identifier,
      frontendBuildId: release.buildId,
      backend: contract,
      tools: { tauriCli: cli.version, ...compiler },
      compilation: {
        target: cliTarget,
        cargo: ['--locked', '--target-dir'],
        environment: cargoBuildEnvironment(),
        profiles:
          platform === 'android'
            ? apkOnly
              ? ['debug-apk']
              : ['debug-apk', 'release-aab']
            : ['release'],
        ...(reuseKey ? { reuseKey } : {}),
        ...(platform === 'ios' ? { exportMethod: options.exportMethod ?? 'debugging' } : {}),
      },
      artifacts,
    };
    writeJson(path.join(stage, 'package.json'), metadata);
    publishDirectory(stage, destination);
    buildStage('tauri-package', started, {
      platform,
      architecture,
      frontendBuildId: release.buildId,
      calls: 1,
      artifacts: artifacts.map(({ format, sha256 }) => ({ format, sha256 })),
      releaseAabCalls: platform === 'android' && !apkOnly ? 1 : 0,
      reason:
        apkOnly && !after
          ? 'Debug packaging inputs are not fully tracked'
          : 'package inputs or output changed',
    });
    return summary(metadata);
  } finally {
    removeDirectory(stage, parent);
  }
}

async function run(value, target, options, signal) {
  const { app, config, name } = value;
  const { platform, architecture } = target;
  const directory = outputPath(app, target, options.apkOnly);
  if (!fs.existsSync(directory))
    throw new Error(
      `Run nelyx build --target tauri --platform ${platform} --architecture ${architecture}${options.apkOnly ? ' --apk-only' : ''} first`,
    );
  ownedDirectory(directory);
  const result = readJson(localFile(directory, 'package.json'));
  if (
    result.schema !== 'nelyx.tauri-package/v2' ||
    result.os !== platform ||
    result.architecture !== architecture ||
    result.appId !== name ||
    result.identifier !== config.targets.tauri.identifier
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
      frontendBuildId: result.frontendBuildId,
      exitCode: done.exitCode ?? 1,
    };
  }
  let device = options.device;
  let installedSha256;
  if (platform === 'android') {
    const tools = androidTools();
    const apk = artifact('apk');
    const { packageName } = inspectApk(apk, tools, architecture, result.identifier);
    const adb = (args) => execute(tools.adb, ['-s', device, ...args], { signal, timeout });
    await adb(['install', '-r', apk]);
    if (options.apkOnly) {
      const installed = capture(tools.adb, ['-s', device, 'shell', 'pm', 'path', packageName])
        .split(/\r?\n/)
        .find((line) => /^package:\/[^\s]+\/base\.apk$/.test(line));
      if (!installed) throw Error('Installed Android base APK is missing for ' + packageName);
      installedSha256 = capture(tools.adb, [
        '-s',
        device,
        'shell',
        'sha256sum',
        installed.slice('package:'.length),
      ])
        .trim()
        .split(/\s+/)[0];
      if (installedSha256 !== sha256(apk))
        throw Error('Installed Android APK does not match the build');
    }
    if (!options.noLaunch)
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
    if (!options.noLaunch)
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
      if (!options.noLaunch)
        await execute(
          'xcrun',
          ['devicectl', 'device', 'process', 'launch', '--device', device, result.identifier],
          { signal, timeout },
        );
    });
  }
  return {
    ...route,
    os: platform,
    architecture,
    ...(installedSha256 ? { installedSha256 } : {}),
    device,
    frontendBuildId: result.frontendBuildId,
    exitCode: 0,
  };
}

async function dev(value, target, options, signal) {
  const { app } = value;
  const { platform, rust, architecture } = target;
  const cli = inspectTauriCli(app);
  inspectRust(app, rust);
  const tools = inspectPlatform(target);
  function developmentProject(input) {
    const project = inspectTauriBackend(input);
    return { ...project, developmentBuildId: backendHash(backendContract(project)) };
  }
  const project = developmentProject(value);
  const host = await nativeHost(value, target, project, cli, signal, {
    frontendBuildId: project.developmentBuildId,
  });
  const isMobile = mobile(platform);
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
  const session = await openVite(
    {
      app,
      port,
      host: advertisedHost ? '0.0.0.0' : '127.0.0.1',
      advertisedHost,
      target: 'tauri',
      backend: project,
      os: platform,
      // The mobile asset protocol already adds these headers when it proxies Vite.
      crossOriginIsolated: !isMobile && value.config.crossOriginIsolated,
    },
    signal,
  );
  const devSignal = AbortSignal.any([signal, session.closed]);
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
    if (android) {
      unmap = await reversePort(tools.adb, device, port, devSignal);
      process.stderr.write(
        JSON.stringify({
          event: 'nelyx.dev.android.transport',
          session: session.event.session,
          device,
          architecture,
          reverse: `tcp:${port}`,
        }) + '\n',
      );
    }
    const ws = (url.protocol === 'https:' ? 'wss://' : 'ws://') + url.host;
    function configOverride(host) {
      const current = host.security.devCsp ?? host.security.csp ?? {};
      const devCsp =
        typeof current === 'string'
          ? /(?:^|;)\s*connect-src\b/.test(current)
            ? current.replace(/((?:^|;)\s*connect-src\b[^;]*)/, '$1 ' + ws)
            : current + "; connect-src 'self' " + ws
          : { ...current, 'connect-src': (current['connect-src'] ?? "'self' ipc:") + ' ' + ws };
      return JSON.stringify({ build: { devUrl: url.href }, app: { security: { devCsp } } });
    }
    const args = isMobile
      ? [platform, 'dev', '--no-dev-server', ...(android ? ['--host', '127.0.0.1'] : [])]
      : ['dev', '--target', rust];
    const cache = cargoCache(app, 'tauri');
    const changes = new EventEmitter();
    let latest = project.developmentBuildId;
    let queued = { value, project, host };
    let running;
    let draining;
    let failed = false;
    function report(error) {
      session.frontend.report(new Error(backendBuildMessage(error, platform)));
    }
    const watch = backendWatcher(() => {
      try {
        const value = readApp(app);
        const project = developmentProject(value);
        watch.update(project.watch);
        if (project.developmentBuildId === latest) {
          if (!failed) session.frontend.clearError();
          return;
        }
        latest = project.developmentBuildId;
        queued = { value, project };
        changes.emit('change');
        session.frontend.backendStatus({
          state: 'pending',
          sourceId: project.identity.sourceId,
          buildId: latest,
        });
        const current = running;
        if (current && !draining) {
          draining = Promise.resolve(session.frontend.drain('Tauri host inputs changed')).finally(
            () => {
              current.abort(new Error('Tauri host inputs changed'));
              draining = undefined;
            },
          );
        }
      } catch (error) {
        report(error);
      }
    }, report);
    try {
      watch.update(project.watch);
      for (;;) {
        devSignal.throwIfAborted();
        if (!queued) {
          await once(changes, 'change', { signal: devSignal });
          continue;
        }
        const attempt = queued;
        queued = undefined;
        const current = new AbortController();
        failed = false;
        session.frontend.clearError();
        try {
          const host =
            attempt.host ??
            (await nativeHost(attempt.value, target, attempt.project, cli, devSignal, {
              frontendBuildId: attempt.project.developmentBuildId,
            }));
          if (queued) continue;
          session.frontend.updateBackend(attempt.project, false);
          running = current;
          await tauriCommand(
            app,
            host,
            cli,
            cache,
            [
              ...args,
              '--no-watch',
              '--exit-on-panic',
              '--no-dev-server-wait',
              '--config',
              configOverride(host),
              ...(devDevice ? [devDevice] : []),
              '--',
              '--locked',
              '--target-dir',
              cache,
            ],
            AbortSignal.any([devSignal, current.signal]),
            {
              limit: false,
              vars: {
                ...(advertisedHost ? { TAURI_DEV_HOST: advertisedHost } : {}),
                ...(android ? { ANDROID_SERIAL: device } : {}),
              },
            },
          );
          if (!queued) break;
        } catch (error) {
          devSignal.throwIfAborted();
          if (!queued && !current.signal.aborted) {
            failed = true;
            report(error);
          }
        } finally {
          await draining;
          running = undefined;
        }
      }
    } finally {
      watch.close();
    }
    return {
      ...session.event,
      ...route,
      os: platform,
      architecture,
      ...(device ? { device } : {}),
      exitCode: 0,
    };
  } finally {
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
  if (!value.config.targets.tauri) throw new Error('Declare targets.tauri in package.json');
  if (options.frontendOnly)
    return withPublicationLock(app, () =>
      publishFrontend(
        value,
        'tauri',
        inspectTauriBackend(value),
        tauriFrontend(app),
        inspectTauriBackend,
        signal,
      ),
    );
  let { architecture, platform } = options;
  if (platform === 'android' && ['dev', 'run'].includes(operation)) {
    const { adb } = androidTools();
    const device = selectAndroidDevice(adb, options.device);
    architecture = androidDeviceArchitecture(adb, device, architecture);
    options = { ...options, device };
  }
  const target = platformTarget(platform, architecture);
  if (operation === 'run') return run(value, target, options, signal);
  const hostLock = (action) => withPublicationLock(hostPath(app), action);
  if (operation === 'dev') return hostLock(() => dev(value, target, options, signal));
  return withPublicationLock(app, () =>
    hostLock(async () => {
      if (operation === 'prepare') return prepare(value, target, options, signal);
      if (operation === 'build') {
        await publishFrontend(
          value,
          'tauri',
          inspectTauriBackend(value),
          tauriFrontend(app),
          inspectTauriBackend,
          signal,
        );
      }
      return pack(value, target, options, signal);
    }),
  );
}
