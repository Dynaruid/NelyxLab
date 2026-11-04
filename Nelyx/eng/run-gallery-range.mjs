// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { verifyWindowsPackage } from '../sdk/tooling/cli/src/windows-runner.mjs';
import { verifyWindowsRuntime } from '../sdk/tooling/cli/src/windows-process.mjs';
import {
  windowsAppBuildInputs,
  windowsBuildInputs,
} from '../sdk/tooling/cli/src/windows-build-inputs.mjs';
import { refreshSampleWindowsSdk } from './run-sample-windows.mjs';
import { withGalleryRangeFixture } from './tests/gallery-range-fixture.mjs';
import {
  galleryColumns,
  verifyGalleryWarmup,
  verifyGalleryLeg,
  summarizeGallerySurfaces,
} from './tests/gallery-range-contract.js';
import { verifyGeometryActivation } from './tests/native-service-activation.js';
import {
  fullRangeModes,
  verifyNativeServiceExperiment,
} from './tests/native-service-experiment.js';
import { verifyBackingExperiment, withoutBackingEvidence } from './tests/backing-experiment.js';
import { engineModes, verifyNativeEngineExperiment } from './tests/native-engine-experiment.js';
import { scrollModes, verifyNativeScrollActivation } from './tests/native-scroll-activation.js';

export async function runGalleryRangeCadence({
  nativeExperiment = false,
  scrollExperiment = false,
} = {}) {
  nativeExperiment ||= scrollExperiment;
  const root = path.resolve(import.meta.dirname, '../..'),
    app = path.join(root, 'sample/nelyx-testbed-app-2'),
    runner = path.join(app, 'windows/runner'),
    option = (name, fallback) =>
      process.argv.find((x) => x.startsWith('--' + name + '='))?.slice(name.length + 3) ?? fallback,
    trials = Number(option('trials', '3')),
    modes = option('modes', 'ts').split(','),
    diagnostic = process.argv.includes('--diagnostic'),
    diagnosticAfter = process.argv.includes('--diagnostic-after'),
    functionalOnly = process.argv.includes('--functional-only'),
    functional = functionalOnly || process.argv.includes('--functional');
  if (
    !Number.isInteger(trials) ||
    trials < 1 ||
    trials > 3 ||
    new Set(modes).size !== modes.length ||
    modes.some(
      (mode) => !(scrollExperiment ? ['ts', ...scrollModes] : fullRangeModes).includes(mode),
    ) ||
    (!nativeExperiment && (modes.length !== 1 || modes[0] !== 'ts')) ||
    option('input-geometry', 'ts') !== 'ts' ||
    !['gallery', 'all'].includes(option('scene', 'gallery')) ||
    option('reuse', '') ||
    (functional && !nativeExperiment) ||
    (functionalOnly && (diagnostic || diagnosticAfter)) ||
    (diagnostic && diagnosticAfter)
  )
    throw Error(
      'Full range: --trials=1..3 --scene=gallery [--diagnostic|--diagnostic-after]; experiments add --modes=ts,backing,text,layout,frame,path,paint,composition,semantics,snapshot [--functional|--functional-only].',
    );
  const catalogSource = stripTypeScriptTypes(
      fs.readFileSync(path.join(app, 'src/catalog.ts'), 'utf8'),
    ),
    catalog = await import(
      'data:text/javascript;base64,' + Buffer.from(catalogSource).toString('base64')
    ),
    expected = galleryColumns(catalog.visibleDemos('all', false)),
    abort = new AbortController(),
    stop = () => abort.abort(),
    hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const run = (cmd, args, options = {}) =>
    execute(cmd, args, { ...options, timeout: 1_200_000, signal: abort.signal });
  const cli = path.join(runner, 'node_modules/@nelyx/cli/src/main.mjs');
  const buildArgs = [
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
  ];
  let built = false;
  const results = [];
  try {
    await refreshSampleWindowsSdk({ root, app }, { run });
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
    let expectedApp;
    await withGalleryRangeFixture(
      runner,
      async () => {
        expectedApp = windowsAppBuildInputs(app);
        built = true;
        await run(process.execPath, buildArgs, { cwd: runner });
      },
      {
        diagnostic: diagnosticAfter ? 'host' : diagnostic,
        nativeServices: nativeExperiment,
        scrollModules: scrollExperiment,
        backingAudit: modes.includes('backing'),
      },
    );
    const locator = JSON.parse(
        fs.readFileSync(path.join(app, '.nelyx/windows/last-package.json'), 'utf8'),
      ),
      checked = verifyWindowsPackage(locator.directory),
      manifest = checked.manifest,
      manifestFile = path.join(checked.directory, 'nelyx-package.json');
    verifyWindowsRuntime(checked.directory);
    if (
      hash(manifestFile) !== locator.manifestSha256 ||
      manifest.appInputsSha256 !== expectedApp ||
      manifest.sdkInputsSha256 !== windowsBuildInputs(runner) ||
      manifest.configuration !== 'Release' ||
      manifest.hermesExecutionMode !== 'bytecode' ||
      manifest.hermesCompilerProfile !== 'optimized' ||
      manifest.nativeInputsSha256 !==
        JSON.parse(fs.readFileSync(path.join(app, '.nelyx/windows/native-inputs.json'), 'utf8'))
          .sha256
    )
      throw Error(
        'Full range source/SDK/native/package identity differs: ' +
          JSON.stringify({
            app: { expected: expectedApp, packaged: manifest.appInputsSha256 },
            sdk: { current: windowsBuildInputs(runner), packaged: manifest.sdkInputsSha256 },
            native: {
              current: JSON.parse(
                fs.readFileSync(path.join(app, '.nelyx/windows/native-inputs.json'), 'utf8'),
              ).sha256,
              packaged: manifest.nativeInputsSha256,
            },
            manifest: hash(manifestFile),
            locator: locator.manifestSha256,
          }),
      );
    console.log(
      'GALLERY_RANGE_PACKAGE',
      JSON.stringify({
        manifest: locator.manifestSha256,
        exe: hash(path.join(checked.directory, manifest.executable)),
        bytecode: hash(path.join(checked.directory, manifest.bundle)),
        app: manifest.appInputsSha256,
        sdk: manifest.sdkInputsSha256,
        native: manifest.nativeInputsSha256,
        diagnostic,
        expected,
      }),
    );
    const owners = Array.from({ length: functionalOnly ? 0 : trials }, (_, i) =>
      (i % 2 ? modes.slice().reverse() : modes).map((mode) => ({
        trial: i + 1,
        mode,
        diagnosticOwner: diagnostic,
      })),
    ).flat();
    if (diagnosticAfter)
      for (const mode of modes)
        owners.push({
          trial: 1,
          mode,
          diagnosticOwner: true,
        });
    for (const { trial, mode, diagnosticOwner } of owners) {
      abort.signal.throwIfAborted();
      if (hash(manifestFile) !== locator.manifestSha256)
        throw Error('Full range package changed between owners');
      console.log(
        'GALLERY_RANGE_BEGIN',
        JSON.stringify({ trial, mode, diagnostic: diagnosticOwner }),
      );
      const output = await new Promise((resolve, reject) => {
        const child = spawn(
          'powershell.exe',
          [
            '-NoProfile',
            '-File',
            path.join(import.meta.dirname, 'tests/windows-continuous-scroll.ps1'),
            '-Executable',
            path.join(checked.directory, manifest.executable),
            '-Page',
            'material',
            '-Maximized',
            '-CadenceOnly',
            '-FullRange',
            ...(diagnosticOwner ? ['-RangeDiagnostics'] : []),
          ],
          {
            cwd: root,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
              ...process.env,
              NELYX_NATIVE_SERVICE_EXPERIMENT: nativeExperiment ? mode : '',
              NELYX_WINDOWS_SCROLL_INPUT: ['scroll', 'scroll-input'].includes(mode) ? '1' : '0',
              NELYX_WINDOWS_BACKING_REUSE: mode === 'backing' ? '1' : '0',
              NELYX_NATIVE_SERVICE_MANUAL: '',
              NELYX_WINDOWS_INPUT_TRACE_FULL: '',
            },
          },
        );
        let output = '',
          interrupted = false;
        const consume = (chunk) => {
          output = (output + chunk).slice(-2 * 1024 * 1024);
        };
        child.stdout.on('data', consume);
        child.stderr.on('data', consume);
        const kill = () => {
            interrupted = true;
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
          if (code !== 0 || interrupted)
            reject(Error('Full range owner failed ' + code + '\n' + output.slice(-20000)));
          else resolve(output);
        });
      });
      const line = output.split(/\r?\n/).find((line) => line.startsWith('CONTINUOUS_SCROLL '));
      if (!line) throw Error('Missing full range report');
      const report = JSON.parse(line.slice(18));
      if (!nativeExperiment)
        verifyGeometryActivation(report.nativeInputGeometryEvidence, {
          mode: 'ts',
          requireEditors: false,
        });
      if (
        report.exitCode !== 0 ||
        report.checks.length !== 2 ||
        report.desktopPixels !== 'unobserved' ||
        report.checks.some(
          (row) => row.physicalWidth !== 2560 || row.physicalHeight !== 1459 || row.dpi !== 192,
        )
      )
        throw Error('Full range window, environment, or close differs');
      const observations = report.galleryWarmup?.observations;
      verifyGalleryWarmup(observations, expected);
      let legs;
      try {
        legs = report.checks.map((row) => ({
          ...row,
          scene: 'gallery',
          coverage: verifyGalleryLeg(row.observation, observations[0], row, expected),
          nativeSurface: summarizeGallerySurfaces(row.observation, row, expected),
        }));
      } catch (error) {
        console.error(
          'GALLERY_RANGE_COVERAGE_FAIL',
          JSON.stringify({
            trial,
            mode,
            message: error.message,
            checks: report.checks.map((row) => {
              const snapshot = row.observation,
                name = snapshot?.leg?.column;
              return {
                column: row.column,
                nativeBeginMs: row.nativeBeginMs,
                nativeEndMs: row.nativeEndMs,
                partialDelivery: row.partialDelivery,
                foregroundLost: row.foregroundLost,
                latePackets: row.latePackets,
                maxPacket: row.maxPacket,
                configuration: snapshot?.configuration,
                expectedConfiguration: observations[0].configuration,
                resourceErrors: snapshot?.resourceErrors,
                leg: snapshot?.leg,
                columnState: snapshot?.columns?.[name],
                warmupColumn: observations[0].columns[name],
                surfaceOverflow: snapshot?.surfaceOverflow,
                unmappedSurfaces: snapshot?.unmappedSurfaces,
                surfaceRows: snapshot?.nativeSurfaces?.length,
              };
            }),
          }),
        );
        throw error;
      }
      const evidence = scrollModes.includes(mode)
        ? verifyNativeScrollActivation(report.nativeServiceEvidence, { mode, checks: legs })
        : nativeExperiment
          ? verifyNativeServiceExperiment(withoutBackingEvidence(report.nativeServiceEvidence), {
              mode,
              checks: legs,
              requireTimedWork: false,
              requireNativeWork: false,
            })
          : undefined;
      const backing = modes.includes('backing')
        ? verifyBackingExperiment(report.backingEvidence, {
            mode: mode === 'backing' ? 'backing' : 'ts',
            checks: legs,
            requireTimedWork: false,
          })
        : undefined;
      const engine = engineModes.includes(mode)
        ? verifyNativeEngineExperiment(report.nativeServiceEvidence, {
            mode,
            checks: legs,
            requireTimedWork: false,
          })
        : undefined;
      const nativeDuringEveryLeg =
        mode === 'backing'
          ? backing?.nativeDuringEveryLeg
          : engine
            ? engine.nativeDuringEveryLeg
            : evidence?.nativeDuringEveryLeg;
      const result = {
        trial,
        mode,
        diagnostic: diagnosticOwner,
        warmup: report.galleryWarmup,
        legs,
        evidence,
        backing,
        engine,
        qualification: diagnosticOwner
          ? 'DIAGNOSTIC_ONLY'
          : mode === 'ts'
            ? backing && !backing.nativeDuringEveryLeg
              ? 'FAIL_NO_NATIVE_WORK_IN_SOME_LEGS'
              : 'TS_FULL_RANGE_CONTROL'
            : nativeDuringEveryLeg
              ? 'NATIVE_WORK_DURING_FULL_RANGE'
              : 'FAIL_NO_NATIVE_WORK_IN_SOME_LEGS',
      };
      results.push(result);
      console.log(
        'GALLERY_RANGE_TRIAL',
        JSON.stringify({
          trial,
          mode,
          diagnostic: diagnosticOwner,
          qualification: result.qualification,
          warmup: {
            passes: result.warmup.passes,
            durationMs: result.warmup.durationMs,
            configuration: observations[0].configuration,
            columns: Object.fromEntries(
              Object.entries(observations[0].columns).map(([name, column]) => [
                name,
                {
                  expected: column.ids,
                  loaded: column.loaded.length,
                  measured: column.measured.length,
                  min: column.min,
                  max: column.max,
                  offset: column.offset,
                  viewport: column.viewport,
                  width: column.width,
                },
              ]),
            ),
          },
          legs: legs.map((row) => ({
            column: row.column,
            nativeBeginMs: row.nativeBeginMs,
            nativeEndMs: row.nativeEndMs,
            packets: row.packets,
            maxPacket: row.maxPacket,
            wheelUnits: row.wheelUnits,
            inputMs: row.surfaceDurationMs,
            surfaceFPS: row.surfaceFPS,
            nativeSurface: row.nativeSurface,
            coverage: row.coverage,
            diagnostic: row.observation.diagnostic,
          })),
          evidence,
          backing,
          engine: result.engine,
        }),
      );
    }
    for (const mode of modes)
      for (const column of ['primary', 'secondary']) {
        const rows = results
          .filter((x) => x.mode === mode && x.diagnostic === diagnostic)
          .flatMap((x) => x.legs)
          .filter((x) => x.column === column);
        if (!rows.length) continue;
        console.log(
          'GALLERY_RANGE_SUMMARY',
          JSON.stringify({
            mode,
            column,
            samples: rows.length,
            meanSurfaceFPS: rows.reduce((sum, row) => sum + row.surfaceFPS, 0) / rows.length,
            minimumSurfaceFPS: Math.min(...rows.map((row) => row.surfaceFPS)),
            scope: diagnostic
              ? 'diagnostic source stages enabled; not a cadence baseline'
              : 'opt-in bounded submitted geometry observations; fully warmed lazy product, surface counter cadence; physical display unobserved',
          }),
        );
      }
    const functionalFailures = [];
    if (functional)
      for (const mode of modes) {
        abort.signal.throwIfAborted();
        if (hash(manifestFile) !== locator.manifestSha256)
          throw Error('Full range package changed before functional owner');
        console.log('GALLERY_RANGE_FUNCTIONAL_BEGIN', JSON.stringify({ mode }));
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
                NELYX_WINDOWS_MIXED_EXPERIMENT: mode,
                NELYX_WINDOWS_MIXED_NATIVE_MODULES: '',
                NELYX_NATIVE_SERVICE_EXPERIMENT: mode,
                NELYX_WINDOWS_SCROLL_INPUT: ['scroll', 'scroll-input'].includes(mode) ? '1' : '0',
                NELYX_NATIVE_SERVICE_MANUAL: '',
                NELYX_WINDOWS_BACKING_REUSE: mode === 'backing' ? '1' : '0',
              },
            },
          );
        } catch (error) {
          functionalFailures.push(error);
          console.error(
            'GALLERY_RANGE_FUNCTIONAL_FAIL',
            JSON.stringify({ mode, message: error.message }),
          );
          continue;
        }
        console.log('GALLERY_RANGE_FUNCTIONAL_PASS', JSON.stringify({ mode }));
      }
    if (functionalFailures.length)
      throw new AggregateError(functionalFailures, 'Gallery/Mixed functional owners failed');
    if (results.some((row) => row.qualification === 'FAIL_NO_NATIVE_WORK_IN_SOME_LEGS'))
      process.exitCode = 2;
  } catch (error) {
    console.error(
      'GALLERY_RANGE_FAILURE',
      JSON.stringify({
        message: String(error.message),
        output: String(error.output ?? '').slice(-2000),
      }),
    );
    throw error;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    // Fixture source has already been restored. Always deliver the ordinary App.
    if (built) {
      console.log('GALLERY_RANGE_RESTORE_NORMAL');
      await execute(process.execPath, buildArgs, { cwd: runner, timeout: 1_200_000 });
      console.log('GALLERY_RANGE_NORMAL_READY', windowsAppBuildInputs(app));
    }
  }
  return results;
}
