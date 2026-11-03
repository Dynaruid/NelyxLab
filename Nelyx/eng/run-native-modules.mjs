// SPDX-License-Identifier: BSD-3-Clause
// Interactive Testbed only: no input injection, timed trials or automatic close.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { verifyWindowsPackage } from '../sdk/tooling/cli/src/windows-runner.mjs';
import { startWindowsProcess } from '../sdk/tooling/cli/src/windows-process.mjs';
import {
  windowsAppBuildInputs,
  windowsBuildInputs,
} from '../sdk/tooling/cli/src/windows-build-inputs.mjs';
import { refreshSampleWindowsSdk } from './run-sample-windows.mjs';
import { withNativeServiceExperimentFixture } from './tests/native-service-experiment-fixture.mjs';
import { geometryActivationCollector } from './tests/native-service-activation.js';
import { nativeModuleModes, verifyNativeModuleMode } from './tests/native-service-experiment.js';
import { withGalleryRangeFixture } from './tests/gallery-range-fixture.mjs';

export function nativeModuleOption(args) {
  if (args.filter((x) => x === '--full-range').length > 1)
    throw Error('Use --full-range only once');
  args = args.filter((x) => x !== '--full-range');
  if (!args.length) return 'all';
  if (args.length !== 1 || !args[0].startsWith('--module='))
    throw Error(
      'Use --module=all|retained|snapshot|path|paint|composition|semantics|backing|text|layout|frame|ts',
    );
  const mode = args[0].slice('--module='.length);
  if (!nativeModuleModes.includes(mode)) throw Error('Unknown native module: ' + mode);
  return mode;
}

export async function runNativeModules({ root, mode, fullRange = false }) {
  fullRange ||= ['all', 'backing', 'text', 'layout', 'frame'].includes(mode);
  if (!nativeModuleModes.includes(mode)) throw Error('Unknown native module: ' + mode);
  const app = path.join(root, 'sample/nelyx-testbed-app-2'),
    runner = path.join(app, 'windows/runner'),
    abort = new AbortController(),
    stop = () => abort.abort(),
    run = (command, args, options = {}) =>
      execute(command, args, { ...options, timeout: 1_200_000, signal: abort.signal });
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  let child;
  try {
    await refreshSampleWindowsSdk({ root, app }, { run });
    const cli = path.join(runner, 'node_modules/@nelyx/cli/src/main.mjs');
    await run(
      process.execPath,
      [
        cli,
        'prepare',
        '--app',
        '../..',
        '--target',
        'windows',
        '--engine',
        'hermes',
        '--hermes-mode',
        'bytecode',
        '--native-inputs',
        path.join(root, '.nelyx/windows-rnw-native/supplier/inputs.json'),
      ],
      { cwd: runner },
    );
    let expectedAppInputs;
    const expectedSdkInputs = windowsBuildInputs(runner);
    await (fullRange ? withGalleryRangeFixture : withNativeServiceExperimentFixture)(
      runner,
      () => {
        expectedAppInputs = windowsAppBuildInputs(app);
        return run(
          process.execPath,
          [
            cli,
            'build',
            '--app',
            '../..',
            '--target',
            'windows',
            '--engine',
            'hermes',
            '--hermes-mode',
            'bytecode',
            '--hermes-profile',
            'optimized',
            '--configuration',
            'Release',
          ],
          { cwd: runner },
        );
      },
      { manualMode: mode },
    );
    abort.signal.throwIfAborted();
    const locator = JSON.parse(
        fs.readFileSync(path.join(app, '.nelyx/windows/last-package.json'), 'utf8'),
      ),
      checked = verifyWindowsPackage(locator.directory),
      manifest = checked.manifest,
      hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (
      hash(path.join(checked.directory, 'nelyx-package.json')) !== locator.manifestSha256 ||
      manifest.configuration !== 'Release' ||
      manifest.hermesExecutionMode !== 'bytecode' ||
      manifest.hermesCompilerProfile !== 'optimized' ||
      manifest.appInputsSha256 !== expectedAppInputs ||
      manifest.sdkInputsSha256 !== expectedSdkInputs ||
      manifest.nativeInputsSha256 !==
        JSON.parse(fs.readFileSync(path.join(app, '.nelyx/windows/native-inputs.json'), 'utf8'))
          .sha256
    )
      throw Error('Interactive module package identity/profile differs');
    console.log(
      'NATIVE_MODULE_PACKAGE',
      JSON.stringify({
        mode,
        manifest: locator.manifestSha256,
        exe: hash(path.join(checked.directory, manifest.executable)),
        native: manifest.nativeInputsSha256,
        sdk: manifest.sdkInputsSha256,
        app: manifest.appInputsSha256,
      }),
    );
    console.log(
      'Native module mode: ' +
        mode +
        '. Use the window yourself; close it to see actual native work and TS fallback counts.',
    );
    if (mode === 'all')
      console.log(
        'Selected: retained input geometry, Path + Paint/clip, Scene composition, Semantics geometry, Flex layout, text transactions, frame segments, Windows backing reuse.',
      );
    if (fullRange)
      console.log(
        'Full range manual observation: keep All components and the same window/theme. Visit every section in BOTH columns, return BOTH to the top, then scroll each column from top to bottom. Closing prints coverage only; use measure:windows-full-range for the automatic gate and timed legs.',
      );
    const collector = geometryActivationCollector();
    let tail = '';
    child = startWindowsProcess(path.join(checked.directory, manifest.executable), [], {
      cwd: checked.directory,
      env: {
        ...process.env,
        NELYX_NATIVE_SERVICE_EXPERIMENT: mode,
        NELYX_WINDOWS_BACKING_REUSE: mode === 'backing' || mode === 'all' ? '1' : '0',
        NELYX_NATIVE_SERVICE_MANUAL: '1',
        NELYX_WINDOWS_FRAME_DIAGNOSTICS: '',
        NELYX_TRACKPAD_DIAGNOSTICS: '',
        NELYX_WINDOWS_INPUT_TRACE: '',
        NELYX_WINDOWS_INPUT_TRACE_FULL: '',
      },
      onOutput(data, stream) {
        collector.observe(data, stream);
        tail = (tail + data).slice(-65536);
        (stream === 'stderr' ? process.stderr : process.stdout).write(data);
      },
    });
    const closeOnAbort = () => {
      void child.stop();
    };
    abort.signal.addEventListener('abort', closeOnAbort, { once: true });
    if (abort.signal.aborted) closeOnAbort();
    let close;
    try {
      close = await child.completed;
    } finally {
      abort.signal.removeEventListener('abort', closeOnAbort);
    }
    if (
      close.exitCode !== 0 ||
      close.forced ||
      /REACT_ERROR|close-failed|text-input-failed|Could not create UploadInstance|allocator stage=/.test(
        tail,
      )
    )
      throw Error('Interactive Testbed did not close cleanly: ' + JSON.stringify(close));
    if (hash(path.join(checked.directory, 'nelyx-package.json')) !== locator.manifestSha256)
      throw Error('Interactive package changed while the window was open');
    const lines = collector.finish();
    const evidence = verifyNativeModuleMode(lines, { mode, fullRange });
    console.log(
      'NATIVE_MODULE_RESULT',
      JSON.stringify({
        mode,
        close,
        ...evidence,
        scope:
          'manual input; independent native counts; notObserved means no proven native work; no FPS/physical-input acceptance',
      }),
    );
    if (abort.signal.aborted) process.exitCode = 130;
    else if (Object.values(evidence.modules).includes('fallbackOnly')) process.exitCode = 2;
    return evidence;
  } finally {
    await child?.stop();
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runNativeModules({
      root: path.resolve(import.meta.dirname, '../..'),
      mode: nativeModuleOption(process.argv.slice(2)),
      fullRange: process.argv.includes('--full-range'),
    });
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
