// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { refreshSampleWindowsSdk } from './run-sample-windows.mjs';

/** Patch only the existing runner, holding its original source in RAM. */
export async function withRnwFrameFixture(
  runner,
  work,
  { detailedWork = true, probeOptions } = {},
) {
  runner = fs.realpathSync(runner);
  const appFile = path.join(runner, 'App.tsx'),
    original = fs.readFileSync(appFile),
    marker = 'onReady={() => {}}';
  if (original.toString().split(marker).length !== 2)
    throw Error('RNW fixture requires the unchanged, empty sample onReady hook');
  const directory = fs.mkdtempSync(path.join(runner, '.rnw-frame-probe-'));
  const imported = `import { installRnwFrameProbe } from './${path.basename(directory)}/rnw-frame-probe.js';\n`,
    patched = Buffer.from(
      imported +
        original
          .toString()
          .replace(
            marker,
            probeOptions
              ? `onReady={(application) => { installRnwFrameProbe(application, ${JSON.stringify({ work: detailedWork, ...probeOptions })}); }}`
              : detailedWork
                ? 'onReady={(application) => { installRnwFrameProbe(application); }}'
                : 'onReady={(application) => { installRnwFrameProbe(application, {work: false}); }}',
          ),
    );
  try {
    for (const name of [
      'rnw-frame-probe.js',
      'rnw-frame-records.js',
      'native-frame-metrics.js',
      'rnw-work-probe.js',
      'rnw-scene-api.js',
      'rnw-retained-geometry-api.js',
    ])
      fs.copyFileSync(path.join(import.meta.dirname, 'tests', name), path.join(directory, name));
    fs.writeFileSync(appFile, patched);
    return await work({ directory, appFile });
  } finally {
    /* oxlint-disable no-unsafe-finally -- Refuse rollback or deletion if source edits or directory ownership changed. */
    const current = fs.readFileSync(appFile);
    if (!current.equals(patched) && !current.equals(original))
      throw Error(
        'App.tsx changed during the diagnostic; source and fixture retained to avoid overwriting edits',
      );
    fs.writeFileSync(appFile, original);
    if (
      path.dirname(fs.realpathSync(directory)) !== runner ||
      fs.lstatSync(directory).isSymbolicLink()
    )
      throw Error('RNW fixture cleanup ownership changed');
    fs.rmSync(directory, { recursive: true, force: true });
    /* oxlint-enable no-unsafe-finally */
  }
}

export async function runRnwFrameProbe(
  root,
  {
    signal,
    detailedWork = true,
    probeOptions,
    onObservation,
    onStarted,
    onResult,
    trials = 1,
    reuseManifestSha256,
    nativeInputs,
  } = {},
) {
  if (!Number.isInteger(trials) || trials < 1 || trials > 3)
    throw Error('RNW diagnostic requires one to three fresh owners');
  if (reuseManifestSha256 !== undefined && !/^[a-f0-9]{64}$/.test(reuseManifestSha256))
    throw Error('Reusing a diagnostic requires its exact current manifest SHA-256');
  if (reuseManifestSha256 && nativeInputs)
    throw Error('A reused package cannot also select different native build inputs');
  root = fs.realpathSync(root);
  const app = path.join(root, 'sample/nelyx-testbed-app-2'),
    runner = path.join(app, 'windows/runner'),
    cli = path.join(runner, 'node_modules/@nelyx/cli'),
    bin = path.resolve(
      cli,
      JSON.parse(fs.readFileSync(path.join(cli, 'package.json'), 'utf8')).bin.nelyx,
    );
  let latest,
    reports = 0,
    invalidReports = 0,
    activeChild,
    aborted = false,
    trial = 0;
  const shutdown = { bindingsClosed: false, acknowledged: false, nativeDrained: false };
  const runtimeFailures = [];
  const stop = () => {
    aborted = true;
    const child = activeChild;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === 'win32') {
      // This exact child is the owned launcher; terminate its descendants too
      // on cancellation/deadline. A forced stop never qualifies as clean close.
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.once('error', () => child.kill());
    } else child.kill();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  signal?.addEventListener('abort', stop, { once: true });
  const rounded = (value) =>
    JSON.stringify(value, (_name, v) =>
      typeof v === 'number' && Number.isFinite(v) && !Number.isInteger(v)
        ? Math.round(v * 10000) / 10000
        : v,
    );
  const compactFrame = (row) =>
    row
      ? {
          ...row,
          source: Object.fromEntries(
            Object.entries(row.source).map(([stage, value]) => [
              stage,
              {
                begin: value[0],
                end: value[1],
                duration: value[2],
                samples: value[3],
                count: value[4],
                bytes: value[5],
              },
            ]),
          ),
        }
      : null;
  const run = (args, diagnose = false) =>
    new Promise((resolve, reject) => {
      if (aborted) {
        reject(Error('RNW diagnostic aborted'));
        return;
      }
      const child = spawn(process.execPath, [bin, ...args], {
        cwd: runner,
        windowsHide: true,
        env: {
          ...process.env,
          ...(diagnose
            ? {
                NELYX_WINDOWS_FRAME_DIAGNOSTICS: '1',
                NELYX_WINDOWS_INPUT_TRACE: '1',
                NELYX_WINDOWS_INPUT_TRACE_FULL: '1',
                NELYX_TRACKPAD_DIAGNOSTICS: '1',
              }
            : {}),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      activeChild = child;
      const tail = [];
      const consume = () => {
        let carry = '',
          skip = false;
        return (data) => {
          carry += data.toString();
          let end;
          while ((end = carry.indexOf('\n')) >= 0) {
            const line = carry.slice(0, end).replace(/\r$/, '');
            carry = carry.slice(end + 1);
            if (skip) {
              skip = false;
              continue;
            }
            if (diagnose && line.startsWith('{"event":"nelyx.native-started",'))
              onStarted?.({ ...JSON.parse(line), trial });
            if (diagnose && line.includes('closed views=0 consumers=0 gpuDrained=1 inputRetired=1'))
              shutdown.nativeDrained = true;
            if (
              diagnose &&
              /REACT_ERROR|close-failed|text-input-failed|Failed to allocate|Windows Graphite replay rejected/.test(
                line,
              )
            ) {
              runtimeFailures.push(line.slice(0, 1800));
              if (runtimeFailures.length > 8) runtimeFailures.shift();
              console.log('NELYX_RNW_RUNTIME_FAILURE ' + line.slice(0, 1800));
            }
            const at = line.indexOf(' cpu-frame ');
            if (line.startsWith('NELYX_WINDOWS_FRAME ')) {
              if (line.endsWith(' bindings-close-end')) shutdown.bindingsClosed = true;
              if (line.endsWith(' shutdown-js-ack')) shutdown.acknowledged = true;
            }
            if (at >= 0) {
              try {
                const row = JSON.parse(line.slice(at + ' cpu-frame '.length));
                if (row.type === 'rnw-frame-probe') {
                  latest = row;
                  reports++;
                  onObservation?.(row);
                  console.log(
                    JSON.stringify({
                      event: 'rnw-frame-observation',
                      reports,
                      joinedFrames: row.joinedFrames,
                      sourceSamples: row.sourceSamples,
                      nativeSamples: row.nativeSamples,
                      errors: row.errors,
                      inputGeometry: row.inputGeometry,
                      slow: row.slowFrames?.slice(0, 2).map((f) => ({
                        identity: f.identity,
                        callbackWall: f.callback?.wall,
                        snap: f.recording?.snapWallMs,
                      })),
                    }),
                  );
                } else console.log(JSON.stringify(row));
              } catch {
                invalidReports++;
                console.log('Invalid RNW diagnostic report');
              }
            } else if (
              line.length < 500 &&
              /nelyx\.|native-started|PASS|error|error:|오류|build\/v2|run\/v2|exitCode|코드를 생성|Checking|Building|→/i.test(
                line,
              )
            )
              console.log(line);
            if (at < 0 && line.length < 4000) {
              tail.push(line.slice(0, 1000));
              if (tail.length > 12) tail.shift();
            }
          }
          if (carry.length > 524288) {
            carry = '';
            skip = true;
          }
        };
      };
      child.stdout.on('data', consume());
      child.stderr.on('data', consume());
      const timeout = setTimeout(stop, 1_200_000);
      child.once('error', (error) => {
        clearTimeout(timeout);
        activeChild = undefined;
        reject(error);
      });
      child.once('close', (code, signal) => {
        clearTimeout(timeout);
        activeChild = undefined;
        if (code !== 0 || aborted)
          reject(
            Error(
              `RNW diagnostic child exited ${code}/${signal}${aborted ? ' after cancellation/deadline' : ''}\n${runtimeFailures.join('\n')}\n${tail.join('\n')}`,
            ),
          );
        else resolve();
      });
    });
  try {
    if (signal?.aborted) throw Error('RNW diagnostic aborted before launch');
    const observePackage = async () => {
      if (!reuseManifestSha256)
        await run([
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
          ...(nativeInputs ? ['--native-inputs', path.resolve(nativeInputs)] : []),
        ]);
      const locator = JSON.parse(
          fs.readFileSync(path.join(app, '.nelyx/windows/last-package.json'), 'utf8'),
        ),
        manifestFile = path.join(locator.directory, 'nelyx-package.json'),
        manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')),
        hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (
        (reuseManifestSha256 && hash(manifestFile) !== reuseManifestSha256) ||
        manifest.hermesExecutionMode !== 'bytecode' ||
        manifest.hermesCompilerProfile !== 'optimized' ||
        manifest.configuration !== 'Release'
      )
        throw Error('RNW diagnostic requires Hermes bytecode / optimized / Release');
      console.log(
        'NELYX_RNW_FRAME_PACKAGE ' +
          JSON.stringify({
            manifestSha256: hash(manifestFile),
            exeSha256: hash(path.join(locator.directory, manifest.executable)),
            bundleSha256: hash(path.join(locator.directory, manifest.bundle)),
            nativeInputsSha256: manifest.nativeInputsSha256,
            sdkInputsSha256: manifest.sdkInputsSha256,
            appInputsSha256: manifest.appInputsSha256,
          }),
      );
      for (trial = 1; trial <= trials; trial++) {
        if (hash(manifestFile) !== locator.manifestSha256)
          throw Error('Selected RNW diagnostic package changed between owners');
        latest = undefined;
        reports = invalidReports = 0;
        shutdown.bindingsClosed = shutdown.acknowledged = shutdown.nativeDrained = false;
        runtimeFailures.length = 0;
        await run(
          ['run', '--app', '../..', '--target', 'windows', '--package', locator.directory],
          true,
        );
        if (
          !latest ||
          !latest.joinedFrames ||
          latest.errors ||
          latest.invalid ||
          latest.invalidSource ||
          latest.overwrittenSource ||
          !latest.observationClosed ||
          latest.nativeOutcomeCounts?.[5] ||
          invalidReports ||
          !shutdown.bindingsClosed ||
          !shutdown.acknowledged ||
          !shutdown.nativeDrained ||
          runtimeFailures.length
        )
          throw Error(
            'RNW frame probe did not produce valid joined observations: ' +
              JSON.stringify({
                joined: latest?.joinedFrames,
                errors: latest?.errors,
                invalid: latest?.invalid,
                overwritten: latest?.overwrittenSource,
                closed: latest?.observationClosed,
                failedFrames: latest?.nativeOutcomeCounts?.[5],
                invalidReports,
                shutdown,
                runtimeFailures,
              }),
          );
        const result = {
          ...latest,
          slowFrames: latest.slowFrames.slice(0, 3).map(compactFrame),
          latestFrame: compactFrame(latest.latestFrame),
          reports,
          trial,
          shutdown: { ...shutdown },
          normalClose: true,
        };
        await onResult?.(result);
        console.log('NELYX_RNW_FRAME_RESULT ' + rounded({ ...result, motionSamples: undefined }));
      }
    };
    if (reuseManifestSha256) await observePackage();
    else await withRnwFrameFixture(runner, observePackage, { detailedWork, probeOptions });
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    signal?.removeEventListener('abort', stop);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, '../..');
  await refreshSampleWindowsSdk({ root, app: path.join(root, 'sample/nelyx-testbed-app-2') });
  await runRnwFrameProbe(root);
}
