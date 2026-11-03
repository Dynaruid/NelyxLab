// SPDX-License-Identifier: BSD-3-Clause
// Compare delivery modes in the same native/SDK supply. Only the explicit
// continuous variant changes App props; neither variant installs source probes.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { refreshSampleWindowsSdk } from './run-sample-windows.mjs';

const root = path.resolve(import.meta.dirname, '../..'),
  app = path.join(root, 'sample/nelyx-testbed-app-2'),
  runner = path.join(app, 'windows/runner'),
  appFile = path.join(runner, 'App.tsx'),
  trials = process.argv.find((arg) => arg.startsWith('--trials='))?.slice(9) ?? '3';
if (!['1', '2', '3'].includes(trials)) throw Error('Choose --trials=1..3');
let active,
  cancelled = false;
const stop = () => {
  cancelled = true;
  if (!active || active.exitCode !== null) return;
  const killer = spawn('taskkill.exe', ['/PID', String(active.pid), '/T', '/F'], {
    windowsHide: true,
    stdio: 'ignore',
  });
  killer.once('error', () => active?.kill());
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
async function run(args, cwd, report = false) {
  if (cancelled) throw Error('Surface status comparison cancelled');
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    active = child;
    let output = '',
      carry = '';
    child.stdout.on('data', (data) => {
      output = (output + data).slice(-2 * 1024 * 1024);
      if (!report) return;
      carry += data;
      let end;
      while ((end = carry.indexOf('\n')) >= 0) {
        const line = carry.slice(0, end).replace(/\r$/, '');
        carry = carry.slice(end + 1);
        if (line.startsWith('CADENCE_')) console.log(line);
      }
    });
    child.stderr.on('data', (data) => {
      output = (output + data).slice(-2 * 1024 * 1024);
    });
    const timer = setTimeout(stop, 1_200_000);
    child.once('error', (error) => {
      clearTimeout(timer);
      active = undefined;
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      active = undefined;
      if (code !== 0 || cancelled)
        reject(
          Error(
            `Surface status child exited ${code}\n${output
              .split(/\r?\n/)
              .filter((line) => line.length < 600)
              .slice(-25)
              .join('\n')}`,
          ),
        );
      else resolve();
    });
  });
}
const original = fs.readFileSync(appFile),
  newline = original.includes('\r\n') ? '\r\n' : '\n',
  marker = '        windowViewport' + newline;
if (
  original.toString().split(marker).length !== 2 ||
  original.includes('rnw-frame-probe') ||
  original.includes('windowsSurfaceStatusMode')
)
  throw Error('Surface status comparison requires the unchanged ordinary App');
const patched = Buffer.from(
  original
    .toString()
    .replace(marker, marker + '        windowsSurfaceStatusMode="continuous"' + newline),
);
let ordinary = false;
try {
  await refreshSampleWindowsSdk({ root, app });
  const cli = path.join(runner, 'node_modules/@nelyx/cli/src/main.mjs'),
    build = () =>
      run(
        [
          cli,
          'build',
          '--app',
          app,
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
        runner,
      );
  let variantFailure;
  const restoreApp = () => {
    const current = fs.readFileSync(appFile);
    if (!current.equals(patched) && !current.equals(original))
      throw Error('App changed during comparison; refusing to overwrite user edits');
    fs.writeFileSync(appFile, original);
  };
  try {
    fs.writeFileSync(appFile, patched);
    console.log('SURFACE_STATUS_VARIANT continuous');
    await build();
    await run(
      [path.join(import.meta.dirname, 'run-rnw-cadence.mjs'), `--trials=${trials}`],
      root,
      true,
    );
  } catch (error) {
    variantFailure = error;
  } finally {
    try {
      restoreApp();
    } catch (error) {
      variantFailure = variantFailure
        ? new AggregateError(
            [variantFailure, error],
            'Surface status comparison and App restoration failed',
          )
        : error;
    }
  }
  if (variantFailure) throw variantFailure;
  console.log('SURFACE_STATUS_VARIANT lifecycle');
  await build();
  ordinary = true;
  await run(
    [path.join(import.meta.dirname, 'run-rnw-cadence.mjs'), `--trials=${trials}`],
    root,
    true,
  );
} finally {
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
  if (!ordinary)
    console.error(
      'Surface status comparison did not finish the ordinary package rebuild; run the ordinary Windows command before product qualification.',
    );
}
