// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { readApplication } from './application.mjs';
import { configureRunner } from './runner-configuration.mjs';
import { execute, capture } from './commands.mjs';
import {
  freshPackageDirectory,
  publishRunnerPackage,
  rememberPackage,
  packageFor,
  packRunner,
  verifyRunnerPackage,
  copyRunnerNotices,
} from './runner-package.mjs';
import { inspectAndroidApk } from './android-package.mjs';
import { localFile } from './files.mjs';
import {
  prepareAndroidHermesBuild,
  finishAndroidHermesBuild,
  verifyAndroidHermesDetails,
} from './android-hermes-policy.mjs';
import { copyHermesMap, verifyHermesMap } from './source-maps.mjs';
async function application(app) {
  const value = await readApplication(app, 'android');
  value
    .load('@nelyx/metro/runner-config')
    .inspectRunnerCohort({ target: 'android', runnerRoot: value.runner, appRoot: value.app });
  value.load('@nelyx/metro/assets').verifyAppAssets(value.app, value.config.assets);
  return value;
}
function tools(value, androidSdk) {
  const sdk = path.resolve(
      androidSdk ?? process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? '',
    ),
    gradle = fs.readFileSync(path.join(value.app, 'android/build.gradle'), 'utf8'),
    version = gradle.match(/buildToolsVersion\s*=\s*"([0-9.]+)"/)?.[1];
  if (!version) throw new Error('App-owned Android buildToolsVersion required');
  const suffix = process.platform === 'win32' ? '.exe' : '',
    adb = path.join(sdk, 'platform-tools', 'adb' + suffix),
    aapt = path.join(sdk, 'build-tools', version, 'aapt' + suffix);
  if (!fs.existsSync(adb) || !fs.existsSync(aapt))
    throw new Error(
      'Selected Android SDK/build tools unavailable; provide --android-sdk or ANDROID_HOME',
    );
  return { sdk, adb, aapt, version };
}
export async function doctorAndroid({ app, androidSdk }) {
  const value = await application(app);
  let nativeTools;
  try {
    nativeTools = { result: 'PASS-scoped', ...tools(value, androidSdk) };
  } catch (error) {
    nativeTools = { result: 'notVerified', reason: String(error) };
  }
  return {
    schema: 'nelyx.doctor/v3',
    target: 'android',
    runner: value.runner,
    cohort: value.cohort,
    profile: value.profile.id,
    implementation: value.profile.status,
    qualification: value.profile.qualification,
    nativeTools,
    adapters: {
      prepare: true,
      build: nativeTools.result === 'PASS-scoped',
      run: nativeTools.result === 'PASS-scoped',
      pack: true,
      dev: true,
    },
  };
}
export async function prepareAndroid({ app }) {
  return {
    schema: 'nelyx.prepare/v3',
    target: 'android',
    ...(await configureRunner({ app, target: 'android' })),
  };
}
export function verifyAndroidPackage(directory) {
  const verified = verifyRunnerPackage(directory, 'android'),
    details = verified.manifest.details;
  if (
    !details ||
    !['arm64-v8a', 'x86_64'].includes(details.architecture) ||
    !/^([A-Za-z][A-Za-z0-9_]*\.)+[A-Za-z][A-Za-z0-9_]*$/.test(details.applicationId) ||
    !/^\.?[A-Za-z][A-Za-z0-9_.]*$/.test(details.activity) ||
    details.signing !== 'local development key; production signing notVerified'
  )
    throw new Error('Invalid Android package metadata');
  if (verified.manifest.profile === 'emulator-vulkan' && details.architecture !== 'x86_64')
    throw new Error('Emulator APK architecture mismatch');
  verifyAndroidHermesDetails(
    verified.manifest.cohort,
    details,
    fs.existsSync(path.join(verified.directory, 'hermes-policy.json'))
      ? JSON.parse(fs.readFileSync(localFile(verified.directory, 'hermes-policy.json'), 'utf8'))
      : null,
  );
  const apk = inspectAndroidApk(localFile(verified.directory, verified.manifest.entry), {
    architecture: details.architecture,
    bytecodeVersion: verified.manifest.cohort.bytecodeVersion,
  });
  verifyHermesMap(verified.directory, verified.manifest.files);
  return { ...verified, apk };
}
export async function buildAndroid({
  app,
  output,
  configuration = 'Release',
  architecture,
  androidSdk,
  port = 8081,
}) {
  if (configuration !== 'Release')
    throw new Error(
      'Android file-bundle packages require Release; Debug/Metro dev adapter is separate',
    );
  const value = await application(app),
    native = tools(value, androidSdk);
  architecture ??= value.profile.id === 'emulator-vulkan' ? 'x86_64' : 'arm64-v8a';
  if (
    !['arm64-v8a', 'x86_64'].includes(architecture) ||
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw new Error('Invalid Android architecture/port');
  if (value.profile.id === 'emulator-vulkan' && architecture !== 'x86_64')
    throw new Error('Emulator profile requires x86_64');
  await configureRunner({ app: value.app, target: 'android' });
  const hermesInput = prepareAndroidHermesBuild(value.app, value.cohort);
  const directory = freshPackageDirectory(value.app, 'android', output);
  await execute(
    process.execPath,
    [
      path.join(value.runner, 'build.mjs'),
      '--configuration',
      'Release',
      '--architecture',
      architecture,
      '--port',
      String(port),
    ],
    {
      cwd: value.runner,
      env: { ...process.env, ANDROID_HOME: native.sdk, ANDROID_SDK_ROOT: native.sdk },
    },
  );
  const hermes = finishAndroidHermesBuild(hermesInput);
  const apk = path.join(value.app, 'android/app/build/outputs/apk/release/app-release.apk');
  inspectAndroidApk(apk, { architecture, bytecodeVersion: value.cohort.bytecodeVersion });
  const badging = capture(native.aapt, ['dump', 'badging', apk]),
    applicationId = badging.match(/^package: name='([^']+)'/m)?.[1],
    activity = badging.match(/^launchable-activity: name='([^']+)'/m)?.[1];
  if (!applicationId || !activity) throw new Error('Android package/launch activity absent');
  fs.copyFileSync(apk, path.join(directory, 'application.apk'));
  fs.copyFileSync(hermesInput.report, path.join(directory, 'hermes-policy.json'));
  copyHermesMap(
    path.join(
      value.app,
      'android/app/build/generated/sourcemaps/react/release/index.android.bundle.map',
    ),
    directory,
  );
  copyRunnerNotices(value, directory);
  publishRunnerPackage({
    directory,
    target: 'android',
    application: value,
    entry: 'application.apk',
    details: {
      ...hermes,
      architecture,
      applicationId,
      activity,
      buildToolsVersion: native.version,
      signing: 'local development key; production signing notVerified',
      noticeQualification: 'PARTIAL',
    },
  });
  const verified = verifyAndroidPackage(directory);
  rememberPackage(value.app, 'android', directory);
  return {
    schema: 'nelyx.build/v3',
    target: 'android',
    directory,
    files: verified.files,
    bytes: verified.bytes,
    apk: verified.apk,
    signing: verified.manifest.details.signing,
    qualification: 'notVerified',
  };
}
export async function runAndroid({ app, directory, androidSdk, device }) {
  const value = await application(app),
    native = tools(value, androidSdk),
    selected = packageFor(app, 'android', directory),
    verified = verifyAndroidPackage(selected.directory),
    ready = capture(native.adb, ['devices'])
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
  await execute(
    native.adb,
    ['-s', device, 'install', '-r', localFile(verified.directory, verified.manifest.entry)],
    { timeout: 180000 },
  );
  const details = verified.manifest.details,
    result = capture(native.adb, [
      '-s',
      device,
      'shell',
      'am',
      'start',
      '-W',
      '-n',
      details.applicationId + '/' + details.activity,
    ]);
  if (!/^Status: ok\s*$/m.test(result))
    throw new Error('Android activity launch unconfirmed: ' + result);
  return {
    schema: 'nelyx.run/v3',
    target: 'android',
    exitCode: 0,
    device,
    applicationId: details.applicationId,
    activity: details.activity,
    scope:
      'Verified APK installed and activity launch acknowledged; native rendering/lifetime qualification separate',
    qualification: 'notVerified',
  };
}
export function packAndroid(options) {
  const verified = packageFor(options.app, 'android', options.directory);
  verifyAndroidPackage(verified.directory);
  return packRunner({ ...options, target: 'android', directory: verified.directory });
}
