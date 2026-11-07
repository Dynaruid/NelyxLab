// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const timeout = 1_200_000;
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = (root, prefix = '') =>
  fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) throw Error('Android project contains a symbolic link');
    const name = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? files(path.join(root, entry.name), name) : [name];
  });
function execute(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  if (result.error || result.status !== 0)
    throw Error(
      'Android command failed: ' + command + '\n' + (result.error ?? result.stdout + result.stderr),
    );
  return result.stdout.trim();
}
function removeBuild(directory, cache) {
  if (
    path.dirname(directory) !== cache ||
    !path.basename(directory).startsWith('build-') ||
    fs.lstatSync(directory).isSymbolicLink()
  )
    throw Error('Unexpected Android build cleanup');
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
}
function sdkRoot(directory, pins) {
  const root = path.resolve(
    directory ??
      process.env.ANDROID_HOME ??
      process.env.ANDROID_SDK_ROOT ??
      path.join(os.homedir(), 'AppData/Local/Android/Sdk'),
  );
  for (const name of [
    `platforms/android-${pins.compileSdk}/android.jar`,
    `build-tools/${pins.buildTools}/source.properties`,
  ])
    if (!fs.existsSync(path.join(root, name)))
      throw Error('Pinned Android toolchain is missing: ' + name);
  const adb = path.join(root, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  if (!fs.existsSync(adb)) throw Error('Android platform-tools are missing');
  return { root, adb };
}
export function doctorEngineV2Android(supply, { androidSdk } = {}) {
  const pins = supply.manifest.toolchains;
  if (
    pins?.minSdk !== 26 ||
    pins?.compileSdk !== 36 ||
    pins?.gradle !== '8.14.3' ||
    pins?.jdkMajor !== 21
  )
    throw Error('Android host toolchain contract differs');
  const native = sdkRoot(androidSdk, pins);
  const java = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : 'java';
  const probe = spawnSync(java, ['-version'], { encoding: 'utf8', timeout, windowsHide: true });
  if (probe.error || probe.status !== 0 || !/^.*version "21[."]/m.test(probe.stderr + probe.stdout))
    throw Error('Android standalone builds require JDK 21');
  if (/GraalVM/.test(probe.stderr + probe.stdout))
    throw Error(
      'Android jlink is incompatible with this GraalVM JDK; set JAVA_HOME to a HotSpot JDK 21 installation',
    );
  return { ...native, java, pins };
}
export function buildEngineV2AndroidApk({
  app,
  supply,
  staged,
  settings,
  architecture,
  androidSdk,
  instrumentation = false,
  development = false,
}) {
  const native = doctorEngineV2Android(supply, { androidSdk });
  const abi = architecture ?? settings.android?.architecture ?? 'arm64-v8a';
  if (
    !['arm64-v8a', 'x86_64'].includes(abi) ||
    !supply.manifest.profiles.android.abis.includes(abi)
  )
    throw Error('Requested Android ABI is not supplied: ' + abi);
  const applicationId = settings.android?.applicationId ?? 'dev.nelyx.engine';
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(applicationId))
    throw Error('Invalid Android application ID');
  const cache = path.join(app, '.nelyx/v2-android');
  fs.mkdirSync(cache, { recursive: true });
  const task = fs.mkdtempSync(path.join(cache, 'build-')),
    project = path.join(task, 'project'),
    assets = path.join(task, 'assets');
  const copy = (source, name) => {
    const target = path.join(assets, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  };
  try {
    fs.cpSync(path.join(supply.root, 'project'), project, { recursive: true, dereference: false });
    const require = createRequire(import.meta.url),
      compilerRoot = path.dirname(require.resolve('hermes-compiler/package.json'));
    if (JSON.parse(fs.readFileSync(path.join(compilerRoot, 'package.json'))).version !== '0.14.1')
      throw Error('Android Hermes compiler cohort differs');
    const platform =
      process.platform === 'win32'
        ? 'win64-bin'
        : process.platform === 'darwin'
          ? 'osx-bin'
          : 'linux64-bin';
    const compiler = path.join(
      compilerRoot,
      'hermesc',
      platform,
      process.platform === 'win32' ? 'hermesc.exe' : 'hermesc',
    );
    const version = execute(compiler, ['-version']);
    if (!/HBC bytecode version: 96\b/.test(version))
      throw Error('Android Hermes bytecode ABI differs');
    const babel = require('@babel/core'),
      classes = require.resolve('@babel/plugin-transform-classes');
    const javascript = path.join(staged, 'application/app.js');
    const lowered = babel.transformSync(fs.readFileSync(javascript, 'utf8'), {
      filename: 'application/app.js',
      configFile: false,
      babelrc: false,
      comments: false,
      compact: true,
      plugins: [classes],
    });
    if (!lowered?.code) throw Error('Android class lowering produced no application');
    fs.writeFileSync(javascript, lowered.code + '\n');
    const compilerFlags = ['-Og', '-emit-async-break-check', '-emit-binary'];
    execute(compiler, [
      ...compilerFlags,
      '-out',
      path.join(staged, 'application/app.hbc'),
      path.join(staged, 'application/app.js'),
    ]);
    for (const name of files(path.join(staged, 'application')))
      copy(path.join(staged, 'application', name), 'application/' + name);
    for (const file of supply.manifest.files.filter((file) => file.path.startsWith('assets/')))
      copy(path.join(supply.root, file.path), 'engine/' + file.path);
    fs.writeFileSync(
      path.join(assets, 'nelyx-bundle.json'),
      JSON.stringify(
        {
          sourceSha256: supply.manifest.sourceSha256,
          abi,
          files: files(assets)
            .sort()
            .map((name) => ({ path: name, sha256: hash(path.join(assets, name)) })),
        },
        null,
        2,
      ) + '\n',
    );
    const output = path.join(cache, abi);
    execute(
      native.java,
      [
        '-classpath',
        path.join(project, 'gradle/wrapper/gradle-wrapper.jar'),
        'org.gradle.wrapper.GradleWrapperMain',
        '--no-daemon',
        '--console=plain',
        '-p',
        project,
        '-PnelyxSupply=' + supply.root,
        '-PnelyxBundle=' + assets,
        '-PnelyxAbi=' + abi,
        '-PnelyxBuild=' + output,
        '-PnelyxApplicationId=' + applicationId,
        '-PnelyxDevelopment=' + development,
        ':app:assembleRelease',
        ...(instrumentation ? [':app:assembleReleaseAndroidTest'] : []),
      ],
      {
        cwd: project,
        env: { ...process.env, ANDROID_HOME: native.root, ANDROID_SDK_ROOT: native.root },
      },
    );
    const apk = path.join(output, 'outputs/apk/release/app-release.apk');
    const aapt = path.join(
      native.root,
      'build-tools',
      native.pins.buildTools,
      process.platform === 'win32' ? 'aapt.exe' : 'aapt',
    );
    const badging = execute(aapt, ['dump', 'badging', apk]);
    if (
      !badging.includes(`package: name='${applicationId}'`) ||
      !badging.includes(`native-code: '${abi}'`) ||
      !badging.includes("launchable-activity: name='dev.nelyx.engine.MainActivity'")
    )
      throw Error('Android APK identity/ABI/activity differs');
    fs.mkdirSync(path.join(staged, 'android'));
    fs.copyFileSync(apk, path.join(staged, 'android/application.apk'));
    if (instrumentation)
      fs.copyFileSync(
        path.join(output, 'outputs/apk/androidTest/release/app-release-androidTest.apk'),
        path.join(staged, 'android/instrumentation.apk'),
      );
    return {
      architecture: abi,
      applicationId,
      development,
      activity: 'dev.nelyx.engine.MainActivity',
      profile: abi === 'x86_64' ? 'emulator-vulkan' : 'hardware-vulkan',
      minSdk: native.pins.minSdk,
      javascript: {
        format: 'hermes-bytecode',
        version: 96,
        classes: 'babel',
        babelVersion: babel.version,
        compilerSha256: hash(compiler),
        flags: compilerFlags,
      },
    };
  } finally {
    removeBuild(task, cache);
  }
}
function androidConnection(bundle, { device, androidSdk } = {}) {
  const native = sdkRoot(androidSdk, bundle.supply.manifest.toolchains);
  const ready = execute(native.adb, ['devices'])
    .split(/\r?\n/)
    .flatMap((line) => /^([^\s]+)\s+device$/.exec(line)?.[1] ?? []);
  if (device === undefined) {
    if (ready.length !== 1) throw Error('Select exactly one ready Android device with --device');
    device = ready[0];
  }
  if (!ready.includes(device)) throw Error('Selected Android device is unavailable');
  return {
    native,
    device,
    call: (args) => execute(native.adb, ['-s', device, ...args], { timeout: 30000 }),
  };
}
const records = (output, prefix) =>
  output
    .split(/\r?\n/)
    .filter((line) => line.startsWith(prefix + ' '))
    .map((line) => JSON.parse(line.slice(prefix.length + 1)));
const logcat = (call, pid) => call(['logcat', '-d', '--pid=' + pid, '-v', 'raw', '-s', 'NelyxV2']);
export function runEngineV2Android(bundle, options = {}) {
  const { native, device } = androidConnection(bundle, options);
  const selected = bundle.manifest.android;
  const abis = execute(native.adb, [
    '-s',
    device,
    'shell',
    'getprop',
    'ro.product.cpu.abilist',
  ]).split(',');
  if (!abis.includes(selected.architecture))
    throw Error('Installed APK ABI does not match the selected Android device');
  if (
    selected.profile === 'emulator-vulkan' &&
    execute(native.adb, ['-s', device, 'shell', 'getprop', 'ro.kernel.qemu']) !== '1'
  )
    throw Error('The software-capable profile is restricted to the Android emulator');
  const install = execute(native.adb, [
    '-s',
    device,
    'install',
    '-r',
    path.join(bundle.root, 'android/application.apk'),
  ]);
  if (!/\bSuccess\b/.test(install)) throw Error('Android installation was not confirmed');
  const launched = execute(native.adb, [
    '-s',
    device,
    'shell',
    'am',
    'start',
    '-W',
    '-n',
    `${selected.applicationId}/${selected.activity}`,
    ...(selected.profile === 'emulator-vulkan' ? ['--ez', 'nelyxEmulator', 'true'] : []),
  ]);
  if (!/Status: ok/.test(launched))
    throw Error('Android activity launch was not confirmed: ' + launched);
  const deadline = Date.now() + 30000;
  let receipt, frame, instance, pid;
  while (Date.now() < deadline) {
    pid = execute(native.adb, ['-s', device, 'shell', 'pidof', selected.applicationId]).split(
      /\s+/,
    )[0];
    if (!/^\d+$/.test(pid)) throw Error('Android application exited before publishing a frame');
    const output = execute(native.adb, [
      '-s',
      device,
      'logcat',
      '-d',
      '--pid=' + pid,
      '-v',
      'raw',
      '-s',
      'NelyxV2',
    ]);
    instance = records(output, 'V2_ANDROID_HOST').at(-1);
    const failure = records(output, 'V2_ANDROID_FAILURE').findLast(
      (value) => value.host === instance?.host,
    );
    if ((failure && !failure.recoverable) || output.includes('Android startup failed'))
      throw Error('Android host startup failed:\n' + output);
    receipt = records(output, 'V2_ANDROID_READY').findLast(
      (value) => value.host === instance?.host,
    )?.receipt;
    frame = records(output, 'V2_ANDROID_FIRST_FRAME').findLast(
      (value) => value.host === instance?.host,
    );
    if (failure) {
      receipt = undefined;
      frame = undefined;
    }
    if (
      receipt &&
      frame &&
      output.includes('V2_ANDROID_IDENTITY ' + bundle.manifest.supplySourceSha256)
    )
      break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  if (!receipt || !frame)
    throw Error(
      'Android application did not acknowledge its C++ work and first frame within 30 seconds',
    );
  const execution = receipt;
  if (
    !execution.execution?.observed ||
    execution.execution.rejectedFallbacks !== 0 ||
    execution.commands < 1 ||
    String(execution.commands) !== execution.engineWork ||
    frame.sourceSha256 !== bundle.manifest.supplySourceSha256
  )
    throw Error('Android C++/SDK execution or frame identity differs');
  return {
    engine: 'v2',
    target: 'android',
    device,
    pid,
    host: instance.host,
    applicationId: selected.applicationId,
    architecture: selected.architecture,
    installed: true,
    launched: true,
    nativeCommands: execution.commands,
    rejectedFallbacks: 0,
    firstFrame: true,
    scanout: 'unobserved',
    exitCode: 0,
  };
}
/** Require a correlated in-app drain before replacing an owned development APK. */
export function stopEngineV2Android(bundle, options, running) {
  if (!bundle.manifest.android.development)
    throw Error('Android generation control requires a development build');
  const { call } = androidConnection(bundle, { ...options, device: running.device });
  const selected = bundle.manifest.android,
    pid = call(['shell', 'pidof', selected.applicationId]).split(/\s+/)[0];
  if (pid !== running.pid)
    throw Error('Android development process generation changed before drain');
  const before = logcat(call, pid),
    instance = records(before, 'V2_ANDROID_HOST').at(-1);
  if (!instance || instance.sourceSha256 !== bundle.manifest.supplySourceSha256)
    throw Error('Android development host identity differs');
  const ticket = randomUUID();
  call([
    'shell',
    'am',
    'start',
    '-W',
    '--activity-single-top',
    '--activity-clear-top',
    '-n',
    `${selected.applicationId}/${selected.activity}`,
    '--es',
    'nelyxControl',
    'close',
    '--es',
    'nelyxTicket',
    ticket,
    '--el',
    'nelyxHost',
    String(instance.host),
  ]);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const value = records(logcat(call, pid), 'V2_ANDROID_CONTROL').find(
      (item) => item.ticket === ticket && item.host === instance.host,
    );
    if (value) {
      const closed = value.closed;
      if (
        !closed?.closed ||
        closed.status !== 0 ||
        closed.memoryTotal !== 0 ||
        closed.reservedBytes !== 0 ||
        !closed.workersJoined ||
        !closed.appDisposed ||
        (closed.failed && !closed.recoverable)
      )
        throw Error('Android development generation failed to drain: ' + JSON.stringify(closed));
      return { pid, host: instance.host, closed };
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
  throw Error('Android development generation drain timeout');
}
