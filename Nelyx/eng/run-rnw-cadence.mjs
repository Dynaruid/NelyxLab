// SPDX-License-Identifier: BSD-3-Clause
// Ordinary packaged app, fresh owners, bounded RAM output, no source fixture.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { verifyWindowsPackage } from '../sdk/tooling/cli/src/windows-runner.mjs';
import { verifyWindowsRuntime } from '../sdk/tooling/cli/src/windows-process.mjs';
import { verifyGeometryActivation } from './tests/native-service-activation.js';
import { runGalleryRangeCadence } from './run-gallery-range.mjs';

if (process.argv.includes('--full-range')) {
  await runGalleryRangeCadence();
} else {
  const root = path.resolve(import.meta.dirname, '../..'),
    option = (name, fallback) =>
      process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback,
    trials = Number(option('trials', '3')),
    scene = option('scene', 'all'),
    inputGeometry = option('input-geometry', 'ts');
  if (!['ts', 'retained'].includes(inputGeometry))
    throw Error('Choose --input-geometry=ts|retained');
  if (inputGeometry === 'retained' && scene === 'gallery')
    throw Error(
      'A retained C++ comparison requires Mixed editor work; use --scene=all for Gallery controls',
    );
  if (
    !Number.isInteger(trials) ||
    trials < 1 ||
    trials > 3 ||
    !['all', 'mixed', 'gallery'].includes(scene)
  )
    throw Error('Choose --trials=1..3 and --scene=all|mixed|gallery');
  const locatorFile = path.join(
      root,
      'sample/nelyx-testbed-app-2/.nelyx/windows/last-package.json',
    ),
    locator = JSON.parse(fs.readFileSync(locatorFile, 'utf8')),
    checked = verifyWindowsPackage(locator.directory),
    manifestFile = path.join(checked.directory, 'nelyx-package.json'),
    hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  verifyWindowsRuntime(checked.directory);
  if (
    hash(manifestFile) !== locator.manifestSha256 ||
    checked.manifest.hermesExecutionMode !== 'bytecode' ||
    checked.manifest.hermesCompilerProfile !== 'optimized' ||
    checked.manifest.configuration !== 'Release'
  )
    throw Error('Cadence requires the current verified optimized Release bytecode package');
  console.log(
    'CADENCE_PACKAGE',
    JSON.stringify({
      manifest: locator.manifestSha256,
      executable: hash(path.join(checked.directory, checked.manifest.executable)),
      bytecode: hash(path.join(checked.directory, checked.manifest.bundle)),
      native: checked.manifest.nativeInputsSha256,
      sdk: checked.manifest.sdkInputsSha256,
    }),
  );
  const results = [];
  for (let trial = 1; trial <= trials; trial++) {
    for (const page of scene === 'all' ? ['mixed', 'gallery'] : [scene]) {
      if (hash(manifestFile) !== locator.manifestSha256)
        throw Error('Cadence package changed between owners');
      const args = [
        '-NoProfile',
        '-File',
        path.join(import.meta.dirname, 'tests/windows-continuous-scroll.ps1'),
        '-Executable',
        path.join(checked.directory, checked.manifest.executable),
        '-Page',
        page === 'gallery' ? 'material' : 'mixed',
        '-Maximized',
        '-CadenceOnly',
        '-InputDurationMs',
        page === 'mixed' ? '10000' : '5000',
        ...(page === 'mixed' ? ['-FocusEditor'] : ['-MouseMotion', '-BothColumns']),
      ];
      const output = await new Promise((resolve, reject) => {
        const child = spawn('powershell.exe', args, {
          cwd: root,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, NELYX_WINDOWS_INPUT_TRACE_FULL: '' },
        });
        let output = '';
        const consume = (data) => {
          output = (output + data).slice(-2 * 1024 * 1024);
        };
        child.stdout.on('data', consume);
        child.stderr.on('data', consume);
        let interrupted = false;
        const stop = () => {
          interrupted = true;
          if (child.exitCode !== null) return;
          const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
            windowsHide: true,
            stdio: 'ignore',
          });
          killer.once('error', () => child.kill());
        };
        process.on('SIGINT', stop);
        process.on('SIGTERM', stop);
        const cleanup = () => {
          clearTimeout(timer);
          process.removeListener('SIGINT', stop);
          process.removeListener('SIGTERM', stop);
        };
        const timer = setTimeout(stop, 1_200_000);
        child.once('error', (error) => {
          cleanup();
          reject(error);
        });
        child.once('close', (code) => {
          cleanup();
          if (code !== 0 || interrupted)
            reject(Error(`Cadence ${page}/${trial} exited ${code}\n${output.slice(-8000)}`));
          else resolve(output);
        });
      });
      const line = output.split(/\r?\n/).find((line) => line.startsWith('CONTINUOUS_SCROLL '));
      if (!line) throw Error('Missing ordinary cadence report');
      const report = JSON.parse(line.slice('CONTINUOUS_SCROLL '.length));
      report.inputGeometryActivation = verifyGeometryActivation(
        report.nativeInputGeometryEvidence ?? [],
        { mode: inputGeometry, requireEditors: page === 'mixed' },
      );
      if (
        report.exitCode !== 0 ||
        report.desktopPixels !== 'unobserved' ||
        report.checks.some(
          (row) => row.physicalWidth !== 2560 || row.physicalHeight !== 1459 || row.dpi !== 192,
        )
      )
        throw Error('Cadence environment or normal close differs from the fixed comparison');
      results.push({ trial, page, report });
      console.log('CADENCE_TRIAL', JSON.stringify({ ...report, trial, scene: page }));
    }
  }
  for (const [page, fraction] of [
    ['mixed', 2 / 3],
    ['gallery', 0.4],
    ['gallery', 2 / 3],
  ]) {
    const rows = results
      .filter((row) => row.page === page)
      .flatMap((row) => row.report.checks)
      .filter((row) => Math.abs(row.inputXFraction - fraction) < 0.001);
    if (rows.length)
      console.log(
        'CADENCE_SUMMARY',
        JSON.stringify({
          page,
          inputGeometry,
          geometryScope:
            inputGeometry === 'retained'
              ? page === 'mixed'
                ? 'verified native editor execution'
                : 'Gallery control; no editor work required'
              : 'verified TS input geometry',
          inputXFraction: fraction,
          samples: rows.length,
          meanSurfaceFPS: rows.reduce((sum, row) => sum + row.surfaceFPS, 0) / rows.length,
          minimumLegSurfaceFPS: Math.min(...rows.map((row) => row.surfaceFPS)),
          scope:
            'packet-defined reversals in ordinary fresh owners; full-range, visual, physical-input and scanout qualification are separate',
        }),
      );
  }
}
