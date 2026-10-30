// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { readApplication, configureWindowsApplication } from './application.mjs';
import { configureRunner } from './runner-configuration.mjs';
import { prepareApple } from './apple-runner.mjs';
import { configureLinuxApplication, buildLinux, verifyLinuxPackage } from './linux-runner.mjs';
import { buildWindows, verifyWindowsPackage } from './windows-runner.mjs';
import { startWindowsProcess } from './windows-process.mjs';
import { capture, execute, startOwnedCommand } from './commands.mjs';

async function vacant(host, port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
function androidTools(value, androidSdk, device) {
  const sdk = path.resolve(
      androidSdk ?? process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? '',
    ),
    suffix = process.platform === 'win32' ? '.exe' : '';
  const version = fs
    .readFileSync(path.join(value.app, 'android/build.gradle'), 'utf8')
    .match(/buildToolsVersion\s*=\s*"([0-9.]+)"/)?.[1];
  const adb = path.join(sdk, 'platform-tools', 'adb' + suffix),
    aapt = path.join(sdk, 'build-tools', version ?? '', 'aapt' + suffix);
  if (!version || !fs.existsSync(adb) || !fs.existsSync(aapt))
    throw new Error('Android dev requires the selected SDK/build tools');
  const ready = capture(adb, ['devices'])
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts[1] === 'device')
    .map((parts) => parts[0]);
  if (!device) {
    if (ready.length !== 1) throw new Error('Choose one ready Android device with --device');
    device = ready[0];
  }
  if (!/^[A-Za-z0-9_.:-]+$/.test(device) || !ready.includes(device))
    throw new Error('Selected Android device unavailable');
  return { sdk, adb, aapt, device };
}
/** Standard runner-owned RN Metro/HMR/DevTools, distinct from Release file packages. */
export async function devNative({
  app,
  target,
  host = '127.0.0.1',
  port = 8081,
  launch = true,
  androidSdk,
  device,
  architecture,
  nativeInputs,
  hermesSource,
  buildDirectory,
}) {
  if (!['windows', 'linux', 'android', 'ios', 'macos'].includes(target))
    throw new Error('Native RN target required');
  if (
    !['127.0.0.1', 'localhost'].includes(host) ||
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65535 ||
    typeof launch !== 'boolean'
  )
    throw new Error('Native dev requires a loopback host, port 1..65535 and boolean launch');
  if (launch && ['ios', 'macos'].includes(target) && process.platform !== 'darwin')
    throw new Error(
      'Apple dev launch requires macOS/Xcode; --launch false runs source tooling only',
    );
  if (launch && target === 'linux' && (process.platform !== 'linux' || process.arch !== 'x64'))
    throw new Error(
      'Linux dev launch requires Linux x86_64; --launch false runs source tooling only',
    );
  if (launch && target === 'windows' && (process.platform !== 'win32' || process.arch !== 'x64'))
    throw Error('Windows dev launch requires Windows x64; --launch false runs source tooling only');
  if (target === 'linux' && !launch && (nativeInputs || hermesSource || buildDirectory))
    throw new Error('Linux native build options require --launch true');
  if (target === 'windows' && !launch && nativeInputs)
    throw Error('Windows native build options require --launch true');
  const value = await readApplication(app, target);
  if (target === 'windows' && value.cohort.engine === 'v8')
    throw Error('V8 development refresh is not supported; use a bundled Windows build');
  value
    .load('@nelyx/metro/runner-config')
    .inspectRunnerCohort({ target, runnerRoot: value.runner, appRoot: value.app });
  value.load('@nelyx/metro/assets').verifyAppAssets(value.app, value.config.assets);
  const cli = value.load.resolve('@react-native-community/cli/build/bin.js');
  let native;
  if (launch && target === 'android') {
    native = androidTools(value, androidSdk, device);
    architecture ??= value.profile.id === 'emulator-vulkan' ? 'x86_64' : 'arm64-v8a';
    if (
      !['arm64-v8a', 'x86_64'].includes(architecture) ||
      (value.profile.id === 'emulator-vulkan' && architecture !== 'x86_64')
    )
      throw new Error('Invalid Android dev architecture/profile');
  }
  await vacant(host, port); // Never reuse or stop another Metro server.
  if (target === 'android') await configureRunner({ app: value.app, target });
  else if (target === 'linux') await configureLinuxApplication({ app: value.app });
  else if (target === 'windows') configureWindowsApplication(value);
  else await prepareApple({ app: value.app, target });
  const controller = new AbortController(),
    { signal } = controller;
  const interrupted = new Promise((resolve) =>
    signal.addEventListener('abort', () => resolve(), { once: true }),
  );
  const stop = () => controller.abort(new Error('Development session interrupted'));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const metro = startOwnedCommand(
    process.execPath,
    [
      cli,
      'start',
      '--config',
      path.join(value.runner, 'metro.config.cjs'),
      '--host',
      host,
      '--port',
      String(port),
      '--no-interactive',
    ],
    { cwd: value.runner },
  );
  let metroExit,
    reverseCreated = false,
    applicationId,
    launchAcknowledged = false,
    stopped,
    linuxProcess,
    linuxExit,
    linuxStopped;
  // A premature Metro exit aborts in-flight native work, then is reported as failure.
  metro.completed.then((result) => {
    metroExit = result;
    if (!signal.aborted)
      controller.abort(new Error('RN Metro exited before the development session ended'));
  });
  const url = `http://${host}:${port}`,
    event = (value) => process.stderr.write(JSON.stringify(value) + '\n');
  try {
    const deadline = Date.now() + 120000;
    for (;;) {
      signal.throwIfAborted();
      try {
        const response = await fetch(url + '/status', {
          signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]),
        });
        if (response.ok && (await response.text()) === 'packager-status:running') {
          const root = response.headers.get('X-React-Native-Project-Root');
          if (!root || path.resolve(root) !== path.resolve(value.runner))
            throw new Error('Development server belongs to another runner');
          break;
        }
      } catch (error) {
        if (signal.aborted) throw error;
        if (String(error).includes('another runner')) throw error;
      }
      if (Date.now() > deadline) throw new Error('RN Metro readiness timed out');
      await delay(100, undefined, { signal });
    }
    event({
      event: 'nelyx.dev.metro-ready',
      target,
      url,
      runner: value.runner,
      metroPid: metro.pid,
      launch,
    });
    if (native) {
      await execute(
        process.execPath,
        [
          path.join(value.runner, 'build.mjs'),
          '--configuration',
          'Debug',
          '--architecture',
          architecture,
          '--port',
          String(port),
        ],
        {
          cwd: value.runner,
          env: { ...process.env, ANDROID_HOME: native.sdk, ANDROID_SDK_ROOT: native.sdk },
          signal,
        },
      );
      signal.throwIfAborted();
      const apk = path.join(value.app, 'android/app/build/outputs/apk/debug/app-debug.apk'),
        badging = capture(native.aapt, ['dump', 'badging', apk]);
      applicationId = badging.match(/^package: name='([^']+)'/m)?.[1];
      const activity = badging.match(/^launchable-activity: name='([^']+)'/m)?.[1];
      if (!applicationId || !activity) throw new Error('Debug APK launch metadata absent');
      await execute(native.adb, ['-s', native.device, 'install', '-r', apk], {
        timeout: 180000,
        signal,
      });
      signal.throwIfAborted();
      const mapping = 'tcp:' + port,
        existing = capture(native.adb, ['-s', native.device, 'reverse', '--list'])
          .split(/\r?\n/)
          .map((line) => line.trim().split(/\s+/))
          .find((parts) => parts[1] === mapping);
      if (existing && existing[2] !== mapping)
        throw new Error('Android reverse port is already mapped to another host port');
      if (!existing) {
        capture(native.adb, ['-s', native.device, 'reverse', '--no-rebind', mapping, mapping]);
        reverseCreated = true;
      }
      // Own the newly launched dev application, including startup failure cleanup.
      launchAcknowledged = true;
      const result = capture(native.adb, [
        '-s',
        native.device,
        'shell',
        'am',
        'start',
        '-W',
        '-S',
        '-n',
        applicationId + '/' + activity,
      ]);
      if (!/^Status: ok\s*$/m.test(result))
        throw new Error('Android dev launch unconfirmed: ' + result);
      event({
        event: 'nelyx.dev.application-launched',
        target,
        applicationId,
        activity,
        device: native.device,
        architecture,
        apk,
      });
    } else if (launch && target === 'linux') {
      const built = await buildLinux({
        app: value.app,
        nativeInputs,
        hermesSource,
        buildDirectory,
        configuration: 'Debug',
        signal,
      });
      signal.throwIfAborted();
      const checked = verifyLinuxPackage(built.directory);
      if (checked.manifest.configuration !== 'Debug')
        throw Error('Linux development requires the checked Debug package');
      const bundle =
        url + '/main.bundle?platform=linux&dev=true&hot=true&minify=false&runModule=true';
      linuxProcess = startOwnedCommand(
        path.join(checked.directory, checked.manifest.executable),
        [],
        { cwd: checked.directory, env: { ...process.env, NELYX_LINUX_DEV_URL: bundle } },
      );
      linuxProcess.completed.then((result) => {
        linuxExit = result;
        if (!signal.aborted) controller.abort(new Error('Linux development application ended'));
      });
      event({
        event: 'nelyx.dev.application-launched',
        target,
        pid: linuxProcess.pid,
        directory: checked.directory,
        bundle,
        scope:
          'Owned Debug native process requested; rendering/readiness requires separate native evidence',
      });
    } else if (launch && target === 'windows') {
      const built = await buildWindows({
        app: value.app,
        nativeInputs,
        configuration: 'Debug',
        signal,
      });
      signal.throwIfAborted();
      const checked = verifyWindowsPackage(built.directory);
      if (checked.manifest.configuration !== 'Debug')
        throw Error('Windows development requires the checked Debug package');
      linuxProcess = startWindowsProcess(
        path.join(checked.directory, checked.manifest.executable),
        [],
        {
          cwd: checked.directory,
          env: {
            ...process.env,
            NELYX_WINDOWS_DEV_HOST: host,
            NELYX_WINDOWS_DEV_PORT: String(port),
          },
        },
      );
      linuxProcess.completed.then((result) => {
        linuxExit = result;
        if (!signal.aborted) controller.abort(new Error('Windows development application ended'));
      });
      event({
        event: 'nelyx.dev.application-launched',
        target,
        pid: linuxProcess.pid,
        directory: checked.directory,
        host,
        port,
        scope:
          'Owned Debug RNW process requested; rendering/readiness requires separate native evidence',
      });
    } else if (launch) {
      const args = [
        path.join(value.runner, 'native.mjs'),
        'run',
        '--no-packager',
        '--port',
        String(port),
        '--mode',
        'Debug',
        ...(device ? ['--udid', device] : []),
      ];
      await execute(process.execPath, args, { cwd: value.runner, signal });
      event({
        event: 'nelyx.dev.application-launched',
        target,
        scope:
          'RN platform launch command completed; Apple native execution qualification separate',
      });
    }
    signal.throwIfAborted();
    event({ event: 'nelyx.dev.ready', target, url, launch });
    await interrupted;
    if (metroExit) throw new Error('RN Metro exited unexpectedly: ' + JSON.stringify(metroExit));
    if (linuxExit && (linuxExit.error || linuxExit.forced || linuxExit.exitCode !== 0))
      throw Error(target + ' dev application failed: ' + JSON.stringify(linuxExit));
  } catch (error) {
    if (linuxExit && (linuxExit.error || linuxExit.forced || linuxExit.exitCode !== 0))
      throw Error(target + ' dev application failed: ' + JSON.stringify(linuxExit), {
        cause: error,
      });
    if (!signal.aborted || metroExit) throw error;
  } finally {
    try {
      if (linuxProcess) linuxStopped = await linuxProcess.stop();
      if (native && launchAcknowledged)
        capture(native.adb, ['-s', native.device, 'shell', 'am', 'force-stop', applicationId]);
    } finally {
      try {
        if (native && reverseCreated)
          capture(native.adb, ['-s', native.device, 'reverse', '--remove', 'tcp:' + port]);
      } finally {
        stopped = await metro.stop();
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
      }
    }
  }
  return {
    schema: 'nelyx.dev/v1',
    target,
    exitCode:
      linuxStopped && (linuxStopped.error || linuxStopped.forced || linuxStopped.exitCode !== 0)
        ? 1
        : 0,
    runner: value.runner,
    url,
    launch,
    metro: stopped,
    native: linuxStopped,
    device: native?.device,
    reverseCreated,
    scope:
      'Standard RN Metro/HMR/dev middleware session; terminal owned server/build/native child and Android reverse/application cleanup. Windows/Linux normal SDK shutdown versus forced child termination, Fast Refresh and guarded full reload require separate runtime evidence.',
    qualification: 'notVerified',
  };
}
