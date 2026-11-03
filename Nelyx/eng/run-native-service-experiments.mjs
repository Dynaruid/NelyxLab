// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { verifyWindowsPackage } from '../sdk/tooling/cli/src/windows-runner.mjs';
import { startWindowsProcess } from '../sdk/tooling/cli/src/windows-process.mjs';
import { refreshSampleWindowsSdk } from './run-sample-windows.mjs';
import { withNativeServiceExperimentFixture } from './tests/native-service-experiment-fixture.mjs';
import { geometryActivationCollector } from './tests/native-service-activation.js';
import {
  experimentModes,
  verifyNativeServiceExperiment,
} from './tests/native-service-experiment.js';
const root = path.resolve(import.meta.dirname, '../..'),
  app = path.join(root, 'sample/nelyx-testbed-app-2'),
  runner = path.join(app, 'windows/runner'),
  option = (name, fallback) =>
    process.argv.find((x) => x.startsWith('--' + name + '='))?.slice(name.length + 3) ?? fallback,
  modes = option('modes', experimentModes.join(',')).split(','),
  trials = Number(option('trials', '3')),
  reuse = option('reuse', ''),
  functional = process.argv.includes('--functional');
if (
  !Number.isInteger(trials) ||
  trials < 1 ||
  trials > 3 ||
  new Set(modes).size !== modes.length ||
  modes.some((x) => !experimentModes.includes(x)) ||
  (reuse && !/^[a-f0-9]{64}$/.test(reuse))
)
  throw Error(
    'Choose --trials=1..3 --modes=ts,snapshot,path,paint,composition,semantics and an exact --reuse hash',
  );
const abort = new AbortController(),
  stop = () => abort.abort();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const run = (command, args, options = {}) =>
  execute(command, args, { ...options, timeout: 1_200_000, signal: abort.signal });
function helper(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-File',
        path.join(import.meta.dirname, 'tests/windows-continuous-scroll.ps1'),
        ...args,
      ],
      { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    const consume = (data) => {
      output = (output + data).slice(-512 * 1024);
    };
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    const kill = () => {
        const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        killer.once('error', () => child.kill());
      },
      timer = setTimeout(kill, 1_200_000),
      cleanup = () => {
        clearTimeout(timer);
        abort.signal.removeEventListener('abort', kill);
      };
    abort.signal.addEventListener('abort', kill, { once: true });
    child.once('error', (error) => {
      cleanup();
      reject(error);
    });
    child.once('close', (code) => {
      cleanup();
      if (code !== 0 || abort.signal.aborted) {
        reject(
          Error('Native experiment wheel helper failed: ' + code + '\n' + output.slice(-6000)),
        );
        return;
      }
      const line = output.split(/\r?\n/).find((x) => x.startsWith('CONTINUOUS_SCROLL '));
      try {
        if (!line) throw Error('Missing scroll report');
        resolve(JSON.parse(line.slice(18)));
      } catch (error) {
        reject(error);
      }
    });
  });
}
try {
  if (!reuse) {
    await refreshSampleWindowsSdk({ root, app }, { run });
    await withNativeServiceExperimentFixture(runner, async () => {
      const cli = path.join(runner, 'node_modules/@nelyx/cli/src/main.mjs');
      await run(
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
          '--native-inputs',
          path.join(root, '.nelyx/windows-rnw-native/supplier/inputs.json'),
        ],
        { cwd: runner },
      );
    });
  }
  const locator = JSON.parse(
      fs.readFileSync(path.join(app, '.nelyx/windows/last-package.json'), 'utf8'),
    ),
    checked = verifyWindowsPackage(locator.directory),
    manifest = checked.manifest,
    hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    manifestFile = path.join(checked.directory, 'nelyx-package.json'),
    executable = path.join(checked.directory, manifest.executable);
  if (
    hash(manifestFile) !== locator.manifestSha256 ||
    (reuse && reuse !== locator.manifestSha256) ||
    manifest.hermesExecutionMode !== 'bytecode' ||
    manifest.hermesCompilerProfile !== 'optimized' ||
    manifest.configuration !== 'Release'
  )
    throw Error('Native experiment package identity/mode differs');
  console.log(
    'NATIVE_EXPERIMENT_PACKAGE',
    JSON.stringify({
      manifest: locator.manifestSha256,
      exe: hash(executable),
      bytecode: hash(path.join(checked.directory, manifest.bundle)),
      native: manifest.nativeInputsSha256,
      sdk: manifest.sdkInputsSha256,
      app: manifest.appInputsSha256,
    }),
  );
  const results = [];
  for (let trial = 1; trial <= trials; trial++)
    for (const mode of trial === 2
      ? modes.slice().reverse()
      : trial === 3
        ? [
            ...modes.slice(Math.floor(modes.length / 2)),
            ...modes.slice(0, Math.floor(modes.length / 2)),
          ]
        : modes) {
      abort.signal.throwIfAborted();
      if (hash(manifestFile) !== locator.manifestSha256)
        throw Error('Native experiment package changed');
      const collector = geometryActivationCollector();
      let output = '';
      const child = startWindowsProcess(executable, [], {
        cwd: checked.directory,
        env: {
          ...process.env,
          NELYX_NATIVE_SERVICE_EXPERIMENT: mode,
          NELYX_NATIVE_SERVICE_MANUAL: '',
          NELYX_TRACKPAD_DIAGNOSTICS: '',
          NELYX_WINDOWS_FRAME_DIAGNOSTICS: '',
          NELYX_WINDOWS_INPUT_TRACE: '1',
          NELYX_WINDOWS_INPUT_TRACE_FULL: '',
        },
        onOutput: (data, stream) => {
          collector.observe(data, stream);
          output = (output + data).slice(-2 * 1024 * 1024);
        },
      });
      try {
        const common = [
            '-Executable',
            executable,
            '-TargetProcessId',
            String(child.pid),
            '-Maximized',
            '-CadenceOnly',
          ],
          gallery = await helper([
            ...common,
            '-Page',
            'material',
            '-BothColumns',
            '-MouseMotion',
            '-InputDurationMs',
            '5000',
          ]),
          mixed = await helper([
            ...common,
            '-Page',
            'mixed',
            '-FocusEditor',
            '-InputDurationMs',
            '10000',
          ]);
        const close = await child.stop();
        if (
          close.exitCode !== 0 ||
          close.forced ||
          /REACT_ERROR|close-failed|text-input-failed|Could not create UploadInstance|allocator stage=/.test(
            output,
          )
        )
          throw Error(
            'Native experiment did not close cleanly: ' +
              JSON.stringify(close) +
              '\n' +
              output.slice(-4000),
          );
        const checks = [
          ...gallery.checks.map((x) => ({ ...x, scene: 'gallery' })),
          ...mixed.checks.map((x) => ({ ...x, scene: 'mixed' })),
        ];
        if (
          checks.length !== 6 ||
          checks.some((x) => x.physicalWidth !== 2560 || x.physicalHeight !== 1459 || x.dpi !== 192)
        )
          throw Error('Experiment window/DPI differs');
        const evidence = verifyNativeServiceExperiment(collector.finish(), {
            mode,
            checks,
            requireTimedWork: false,
            requireNativeWork: false,
          }),
          row = {
            mode,
            trial,
            close,
            evidence: { ...evidence, timed: undefined },
            checks: checks.map((x, i) => ({
              scene: x.scene,
              fraction: x.inputXFraction,
              direction: x.direction,
              surfaceFPS: x.surfaceFPS,
              nativeBeginMs: x.nativeBeginMs,
              nativeEndMs: x.nativeEndMs,
              native: evidence.timed[i],
            })),
            qualification:
              mode === 'ts'
                ? 'TS_CONTROL'
                : evidence.nativeDuringEveryLeg
                  ? 'NATIVE_WORK_DURING_REQUIRED_LEGS'
                  : 'FAIL_NO_NATIVE_WORK_IN_SOME_LEGS',
          };
        results.push(row);
        console.log('NATIVE_EXPERIMENT_TRIAL', JSON.stringify(row));
      } finally {
        await child.stop();
      }
    }
  for (const mode of modes)
    for (const [scene, fraction] of [
      ['gallery', 0.4],
      ['gallery', 2 / 3],
      ['mixed', 2 / 3],
    ]) {
      const rows = results
        .filter((x) => x.mode === mode)
        .flatMap((x) => x.checks)
        .filter((x) => x.scene === scene && Math.abs(x.fraction - fraction) < 0.001);
      console.log(
        'NATIVE_EXPERIMENT_SUMMARY',
        JSON.stringify({
          mode,
          scene,
          fraction,
          samples: rows.length,
          meanSurfaceFPS: rows.reduce((a, x) => a + x.surfaceFPS, 0) / rows.length,
          minimumLegSurfaceFPS: Math.min(...rows.map((x) => x.surfaceFPS)),
          legsWithNativeWork: rows.filter((x) => x.native.nativeWork).length,
          qualification:
            mode === 'ts'
              ? 'TS_CONTROL'
              : rows.every((x) => !x.native.expectedWork)
                ? 'CONTROL_NO_EDITORS'
                : rows.every((x) => x.native.nativeWork)
                  ? 'NATIVE_WORK_DURING_INPUT'
                  : 'FAIL_NO_NATIVE_WORK_IN_SOME_LEGS',
          scope:
            'one startup selector build; service counters and native QPC buckets; no source frame probe/GDI capture; same Gallery then Mixed flow; not scanout acceptance',
        }),
      );
    }
  const functionalFailures = [];
  if (functional)
    for (const mode of modes.filter((x) => x !== 'ts')) {
      console.log('NATIVE_EXPERIMENT_INPUT_BEGIN', mode);
      try {
        await run(
          process.execPath,
          [
            '--test',
            '--test-timeout=1200000',
            path.join(import.meta.dirname, 'tests/windows-mixed-input.test.mjs'),
          ],
          {
            cwd: root,
            env: {
              ...process.env,
              NELYX_WINDOWS_MIXED_TRIALS: '1',
              NELYX_NATIVE_SERVICE_EXPERIMENT: mode,
              NELYX_NATIVE_SERVICE_MANUAL: '',
              NELYX_WINDOWS_MIXED_EXPERIMENT: mode,
            },
          },
        );
      } catch (error) {
        if (abort.signal.aborted) throw error;
        functionalFailures.push(mode);
        console.log(
          'NATIVE_EXPERIMENT_INPUT_FAILURE',
          JSON.stringify({ mode, message: String(error).slice(-5000) }),
        );
      }
    }
  const missingTimedWork = [
    ...new Set(
      results
        .filter((row) => row.mode !== 'ts' && !row.evidence.nativeDuringEveryLeg)
        .map((row) => row.mode),
    ),
  ];
  console.log(
    'NATIVE_EXPERIMENT_RESULT',
    JSON.stringify({
      completed: true,
      owners: results.length,
      missingTimedWork,
      functionalFailures,
    }),
  );
  if (missingTimedWork.length || functionalFailures.length) process.exitCode = 2;
} finally {
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
