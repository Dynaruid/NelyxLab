// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readApplication } from './application.mjs';
import { patchAppleRuntime } from './apple-runtime.mjs';
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
import { localFile } from './files.mjs';
import { copyHermesMap, verifyHermesMap } from './source-maps.mjs';
function host() {
  if (process.platform !== 'darwin')
    throw new Error(
      'Apple native build/run requires macOS/Xcode; doctor/prepare are available for source checks',
    );
}
async function application(app, target) {
  if (!['ios', 'macos'].includes(target)) throw new Error('Apple target must be ios or macos');
  const value = await readApplication(app, target),
    installed = value
      .load('@nelyx/metro/runner-config')
      .inspectRunnerCohort({ target, runnerRoot: value.runner, appRoot: value.app });
  if (
    value.profile.status !== 'implemented' ||
    installed.react !== value.cohort.react ||
    installed.reactNative !== value.cohort.reactNative
  )
    throw new Error('Apple configured cohort differs from its installation');
  value.load('@nelyx/metro/assets').verifyAppAssets(value.app, value.config.assets);
  return value;
}
export async function doctorApple({ app, target }) {
  const value = await application(app, target);
  return {
    schema: 'nelyx.doctor/v3',
    target,
    runner: value.runner,
    cohort: value.cohort,
    profile: value.profile.id,
    implementation: value.profile.status,
    qualification: value.profile.qualification,
    host: process.platform,
    adapters: {
      prepare: true,
      build: process.platform === 'darwin',
      run: process.platform === 'darwin',
      pack: process.platform === 'darwin',
      dev: true,
    },
    development: {
      server: true,
      launch: process.platform === 'darwin',
      nativeExecution: 'notVerified',
    },
    nativeExecution: 'notVerified',
  };
}
export async function prepareApple({ app, target }) {
  const value = await application(app, target);
  fs.writeFileSync(
    path.join(value.runner, 'app-config.json'),
    JSON.stringify(
      {
        name: value.config.name,
        target,
        assets: value.config.assets,
        profile: value.profile.id,
        cohort: value.cohort,
      },
      null,
      2,
    ) + '\n',
  );
  return {
    schema: 'nelyx.prepare/v3',
    target,
    app: value.app,
    runner: value.runner,
    patch: patchAppleRuntime({ target, runner: value.runner }),
    qualification: 'notVerified',
  };
}
export function verifyApplePackage(directory, target) {
  const verified = verifyRunnerPackage(directory, target),
    details = verified.manifest.details;
  if (
    !['ios', 'macos'].includes(target) ||
    !details ||
    details.runtimeProtocol !== 3 ||
    details.sdk !== (target === 'ios' ? 'iphonesimulator' : 'macosx') ||
    !/^([A-Za-z0-9-]+\.)+[A-Za-z0-9-]+$/.test(details.bundleIdentifier)
  )
    throw new Error('Invalid Apple bundle metadata');
  const entry = verified.manifest.entry,
    prefix = target === 'ios' ? entry + '/' : entry + '/Contents/',
    info = prefix + 'Info.plist',
    bundle = prefix + (target === 'ios' ? '' : 'Resources/') + 'main.jsbundle',
    executable = prefix + (target === 'ios' ? '' : 'MacOS/') + details.executable;
  if (typeof details.executable !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(details.executable))
    throw new Error('Invalid Apple executable');
  for (const name of [info, bundle, executable])
    if (!verified.manifest.files.some((record) => record.path === name && record.type === 'file'))
      throw new Error('Incomplete Apple bundle: ' + name);
  const hbc = fs.readFileSync(localFile(verified.directory, bundle));
  if (
    hbc.length < 12 ||
    hbc.readBigUInt64LE(0) !== 0x1f1903c103bc1fc6n ||
    hbc.readUInt32LE(8) !== verified.manifest.cohort.bytecodeVersion
  )
    throw new Error('Apple bundle Hermes bytecode differs from its native cohort');
  verifyHermesMap(verified.directory, verified.manifest.files);
  return verified;
}
export async function buildApple({ app, target, output, configuration = 'Release' }) {
  host();
  if (configuration !== 'Release')
    throw new Error(
      'Apple file-bundle packages require Release; native Debug/Metro dev adapter is separate',
    );
  const value = await application(app, target);
  await prepareApple({ app: value.app, target });
  const directory = freshPackageDirectory(value.app, target, output),
    derived = path.join(value.app, '.nelyx', target, 'xcode', Date.now() + '-' + randomUUID());
  await execute(
    process.execPath,
    [
      path.join(value.runner, 'native.mjs'),
      'build',
      '--configuration',
      'Release',
      '--derived-data',
      derived,
    ],
    {
      cwd: value.runner,
      env: { ...process.env, SOURCEMAP_FILE: path.join(derived, 'application.js.map') },
    },
  );
  const product = path.join(
      derived,
      'Build/Products',
      target === 'ios' ? 'Release-iphonesimulator' : 'Release',
      value.config.name + '.app',
    ),
    info = path.join(product, target === 'ios' ? 'Info.plist' : 'Contents/Info.plist'),
    metadata = JSON.parse(capture('/usr/bin/plutil', ['-convert', 'json', '-o', '-', info]));
  const entry = path.basename(product);
  fs.cpSync(product, path.join(directory, entry), { recursive: true, verbatimSymlinks: true });
  copyHermesMap(path.join(derived, 'application.js.map'), directory);
  copyRunnerNotices(value, directory);
  publishRunnerPackage({
    directory,
    target,
    application: value,
    entry,
    details: {
      sdk: target === 'ios' ? 'iphonesimulator' : 'macosx',
      bundleIdentifier: metadata.CFBundleIdentifier,
      executable: metadata.CFBundleExecutable,
      runtimeProtocol: 3,
      signing: 'notVerified',
      noticeQualification: 'PARTIAL',
    },
  });
  const verified = verifyApplePackage(directory, target);
  rememberPackage(value.app, target, directory);
  return {
    schema: 'nelyx.build/v3',
    target,
    directory,
    files: verified.files,
    bytes: verified.bytes,
    signing: 'notVerified',
    qualification: 'notVerified',
  };
}
export async function runApple({
  app,
  target,
  directory,
  device = 'booted',
  arguments: args = [],
}) {
  host();
  const selected = packageFor(app, target, directory),
    verified = verifyApplePackage(selected.directory, target),
    bundle = path.join(verified.directory, verified.manifest.entry);
  if (target === 'macos')
    await execute(
      '/usr/bin/open',
      ['-W', '-n', bundle, ...(args.length ? ['--args', ...args] : [])],
      { timeout: 86400000 },
    );
  else {
    if (device !== 'booted' && !/^[A-Fa-f0-9-]{36}$/.test(device))
      throw new Error('Choose a booted iOS simulator or explicit simulator UUID');
    await execute('/usr/bin/xcrun', ['simctl', 'install', device, bundle], { timeout: 180000 });
    await execute(
      '/usr/bin/xcrun',
      ['simctl', 'launch', device, verified.manifest.details.bundleIdentifier, ...args],
      { timeout: 180000 },
    );
  }
  return {
    schema: 'nelyx.run/v3',
    target,
    exitCode: 0,
    qualification: 'notVerified',
    scope:
      target === 'ios'
        ? 'Simulator install and launch command acknowledged; native lifecycle qualification separate'
        : 'Native application open/wait command completed; native lifecycle qualification separate',
  };
}
export function packApple(options) {
  host();
  const selected = packageFor(options.app, options.target, options.directory);
  verifyApplePackage(selected.directory, options.target);
  return packRunner({ ...options, directory: selected.directory });
}
