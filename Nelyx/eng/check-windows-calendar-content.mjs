// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { buildNativeHost } from './build-native-hermes.mjs';
import {
  buildNativeApplication,
  verifyNativePackage,
} from '../sdk/tooling/cli/src/windows-native-runner.mjs';
import { verifyPackageSourceInputs } from './package-source-inputs.mjs';
import { refreshSampleWindowsSdk } from './run-sample-windows.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const app = path.join(root, 'sample/nelyx-demo-app');
await fs.mkdir(path.join(root, '.tmp'), { recursive: true });
const session = await fs.mkdtemp(path.join(root, '.tmp/w8-calendar-'));
const native = path.join(app, '.nelyx/native-windows', path.basename(session));
const entry = path.join(app, '.windows-calendar-content.ts');
const timeout = 1_200_000;
const interrupted = new AbortController();
const interrupt = () => interrupted.abort(new Error('Calendar comparison interrupted'));
const signal = AbortSignal.any([interrupted.signal, AbortSignal.timeout(timeout)]);
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
const run = (command, args, cwd) => execute(command, args, { cwd, timeout, signal });
const flutter = (...args) =>
  run(process.env.ComSpec, ['/d', '/c', 'flutter.bat', ...args], session);
const sha = async (file) =>
  createHash('sha256')
    .update(await fs.readFile(file))
    .digest('hex');
async function observe(exe, args, env = process.env) {
  signal.throwIfAborted();
  const proc = spawn(exe, args, {
    cwd: path.dirname(exe),
    windowsHide: false,
    stdio: 'ignore',
    env,
    signal,
  });
  let launchError;
  proc.once('error', (error) => {
    launchError = error;
  });
  const ended = new Promise((resolve) => proc.once('close', resolve));
  try {
    const result = path.join(session, 'current.json');
    await run(
      'pwsh.exe',
      [
        '-NoProfile',
        '-File',
        path.join(import.meta.dirname, 'windows-calendar-content.ps1'),
        '-ProcessId',
        String(proc.pid),
        '-ResultPath',
        result,
      ],
      root,
    );
    const code = await Promise.race([ended, delay(10000, 'timeout', { ref: false })]);
    assert.equal(code, 0, 'Calendar window exit');
    return JSON.parse(await fs.readFile(result, 'utf8'));
  } finally {
    if (proc.exitCode === null) proc.kill();
    await ended;
    if (launchError) throw launchError;
  }
}
let ownsEntry = false;
try {
  await flutter('create', '--no-pub', '--platforms=windows', '--project-name=w8_calendar', '.');
  await fs.copyFile(
    path.join(import.meta.dirname, 'flutter-calendar-windows.dart'),
    path.join(session, 'lib/main.dart'),
  );
  await fs.copyFile(path.join(app, 'assets/NotoSansKR.ttf'), path.join(session, 'NotoSansKR.ttf'));
  await fs.writeFile(
    path.join(session, 'pubspec.yaml'),
    [
      'name: w8_calendar',
      'environment:',
      "  sdk: '>=3.5.0 <4.0.0'",
      'dependencies:',
      '  flutter:',
      '    sdk: flutter',
      'flutter:',
      '  uses-material-design: true',
      '  fonts:',
      '    - family: NelyxSample',
      '      fonts:',
      '        - asset: NotoSansKR.ttf',
      '',
    ].join('\n'),
  );
  await flutter('pub', 'get', '--offline');
  await flutter('build', 'windows', '--release', '--no-pub');
  const release = path.join(session, 'build/windows/x64/runner/Release/w8_calendar.exe');
  const aot = path.join(path.dirname(release), 'data/app.so');
  console.log('Flutter Windows release AOT', await sha(aot));
  const flutterResult = await observe(release, []);
  await refreshSampleWindowsSdk(
    { root, app },
    {
      run: (command, args, options) => execute(command, args, { ...options, timeout, signal }),
    },
  );
  for (const directory of ['Nelyx', 'packages/material'])
    console.log(verifyPackageSourceInputs(path.join(root, directory)));
  await fs.copyFile(
    path.join(import.meta.dirname, 'calendar-windows-fixture.ts'),
    entry,
    constants.COPYFILE_EXCL,
  );
  ownsEntry = true;
  const hostBuild = await buildNativeHost({ app, signal });
  const built = await buildNativeApplication({
    app,
    mode: 'bytecode',
    entry: path.basename(entry),
    output: native,
    hostBuild,
    signal,
  });
  const { manifest } = verifyNativePackage(native);
  assert.equal(manifest.mode, 'bytecode');
  assert.equal(manifest.diagnosticEntrySha256, undefined);
  console.log(
    'Nelyx direct Hermes legacy',
    manifest.compilerPolicy,
    await sha(built.bundle),
    manifest.sdkInputsSha256,
  );
  const hermesResult = await observe(built.executable, [
    built.bundle,
    built.assetRoot,
    'bytecode',
    '180000',
  ]);
  assert.deepEqual(hermesResult.View, flutterResult.View, 'desktop conditions differ');
  await flutter('build', 'windows', '--profile', '--no-pub');
  const profile = path.join(session, 'build/windows/x64/runner/Profile/w8_calendar.exe');
  const timings = path.join(session, 'timings.jsonl');
  const profileResult = await observe(profile, [], { ...process.env, W8_FLUTTER_TIMINGS: timings });
  assert.deepEqual(profileResult.View, flutterResult.View);
  const frames = (await fs.readFile(timings, 'utf8'))
    .trim()
    .split(/\r?\n/)
    .flatMap((line) => JSON.parse(line));
  for (const phase of profileResult.Phases) {
    const moving = frames.filter(
      ([us]) => us / 1000 >= phase.StartUtcMs && us / 1000 <= phase.EndUtcMs,
    );
    assert(moving.length > 0, 'profile timing window empty');
    console.log(
      'Flutter profile',
      phase.Start,
      phase.End,
      'frames',
      moving.length,
      'max UI/raster ms',
      ...[1, 2].map((index) => Math.max(...moving.map((frame) => frame[index])) / 1000),
    );
  }
} finally {
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
  if (ownsEntry) await fs.unlink(entry);
  for (const [owned, parent] of [
    [native, path.join(app, '.nelyx/native-windows')],
    [session, path.join(root, '.tmp')],
  ]) {
    const resolved = await fs.realpath(owned).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (resolved) {
      assert.equal(path.dirname(resolved), await fs.realpath(parent));
      assert.equal(path.basename(resolved), path.basename(session));
      await fs.rm(owned, { recursive: true, maxRetries: 3 });
    }
  }
}
