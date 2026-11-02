// SPDX-License-Identifier: BSD-3-Clause
// One current supplier/package at a time. Candidate defaults live only in this
// guarded source edit; finally restores the complete original SDK and product.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { verifyWindowsPackage } from '../sdk/tooling/cli/src/windows-runner.mjs';
import { verifyWindowsRuntime } from '../sdk/tooling/cli/src/windows-process.mjs';
const root = path.resolve(import.meta.dirname, '../..'),
  app = path.join(root, 'sample/nelyx-testbed-app-2'),
  runner = path.join(app, 'windows/runner');
const source = path.join(root, 'Nelyx/sdk/src/runtime/native-engine.ts'),
  original = fs.readFileSync(source),
  modes = (process.argv[2] ?? 'legacy,path,paint,composition,semantics').split(','),
  firstTrial = Number(process.argv[3] ?? 1);
if (
  modes.some((mode) => !['legacy', 'path', 'paint', 'composition', 'semantics'].includes(mode)) ||
  new Set(modes).size !== modes.length ||
  !Number.isInteger(firstTrial) ||
  firstTrial < 1 ||
  firstTrial > 3
)
  throw Error('Choose distinct scene candidate modes');
let active = original,
  child;
const stop = () => {
  if (child && child.exitCode === null)
    spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
async function run(program, args, extra = {}) {
  let output = '';
  return await new Promise((resolve, reject) => {
    const owned = spawn(program, args, {
      cwd: root,
      env: { ...process.env, ...extra },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child = owned;
    const consume = (chunk) => {
      output += chunk.toString();
      if (output.length > 8 * 1024 * 1024) output = output.slice(-8 * 1024 * 1024);
    };
    owned.stdout.on('data', consume);
    owned.stderr.on('data', consume);
    const timer = setTimeout(() => {
      if (child === owned) stop();
    }, 1_200_000);
    owned.once('error', (error) => {
      clearTimeout(timer);
      child = undefined;
      reject(error);
    });
    owned.once('close', (code) => {
      clearTimeout(timer);
      child = undefined;
      if (code !== 0) reject(Error(`${program} exited ${code}\n${output.slice(-7000)}`));
      else resolve(output);
    });
  });
}
const npm = (args) => run('cmd.exe', ['/d', '/c', 'npm.cmd', ...args]);
async function build() {
  await npm(['run', 'build', '--workspace', '@nelyx/sdk']);
  await run(process.execPath, [path.join(root, 'Nelyx/eng/prepare-sample.mjs'), 'windows'], {
    NELYX_PREPARE_PACKAGES: 'sdk',
  });
  await npm([
    '--prefix',
    runner,
    'install',
    '--ignore-scripts',
    '--workspaces=false',
    '--no-audit',
    '--no-fund',
  ]);
  await npm([
    '--prefix',
    runner,
    'run',
    'build',
    '--',
    '--engine',
    'hermes',
    '--hermes-mode',
    'bytecode',
    '--hermes-profile',
    'optimized',
    '--configuration',
    'Release',
  ]);
}
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function product() {
  const locator = JSON.parse(
      fs.readFileSync(path.join(app, '.nelyx/windows/last-package.json'), 'utf8'),
    ),
    p = verifyWindowsPackage(locator.directory);
  verifyWindowsRuntime(p.directory);
  return {
    p,
    identity: {
      manifest: locator.manifestSha256,
      exe: hash(path.join(p.directory, p.manifest.executable)),
      bundle: hash(path.join(p.directory, p.manifest.bundle)),
      native: p.manifest.nativeInputsSha256,
      sdk: p.manifest.sdkInputsSha256,
      source: hash(source),
    },
  };
}
try {
  for (const mode of modes) {
    if (!fs.readFileSync(source).equals(active))
      throw Error('Native engine source changed during candidate work');
    let changed = original.toString();
    if (mode === 'path' || mode === 'paint')
      changed = changed.replaceAll('options.sceneBatch', `(options.sceneBatch ?? '${mode}')`);
    if (mode === 'composition')
      changed = changed.replaceAll(
        'options.sceneComposition',
        '(options.sceneComposition ?? true)',
      );
    if (mode === 'semantics')
      changed = changed.replaceAll(
        'options.semanticsGeometry',
        '(options.semanticsGeometry ?? true)',
      );
    active = Buffer.from(changed);
    fs.writeFileSync(source, active);
    console.log(JSON.stringify({ event: 'scene-candidate-build', mode }));
    await build();
    const { p, identity } = product();
    console.log(JSON.stringify({ event: 'scene-candidate-product', mode, identity }));
    for (let trial = mode === modes[0] ? firstTrial : 1; trial <= 3; trial++)
      for (const page of ['mixed', 'material']) {
        console.log(JSON.stringify({ event: 'scene-candidate-measure', mode, trial, page }));
        const args = [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          path.join(root, 'Nelyx/eng/tests/windows-continuous-scroll.ps1'),
          '-Executable',
          path.join(p.directory, p.manifest.executable),
          '-Page',
          page,
          '-Maximized',
          '-CadenceOnly',
          ...(page === 'mixed'
            ? ['-FocusEditor', '-InputDurationMs', '10000']
            : ['-MouseMotion', '-InputDurationMs', '5000', '-BothColumns']),
        ];
        let output;
        try {
          output = await run('powershell.exe', args);
        } catch (error) {
          const row = String(error)
            .split(/\r?\n/)
            .find((line) => line.startsWith('CONTINUOUS_FAILURE '));
          const failure = row ? JSON.parse(row.slice('CONTINUOUS_FAILURE '.length)) : undefined;
          if (!failure?.alive || failure.foreground || !/foreground/i.test(failure.message))
            throw error;
          console.log(
            JSON.stringify({
              event: 'scene-candidate-foreground-retry',
              mode,
              trial,
              page,
              failure,
            }),
          );
          // One fresh process, only after proven input ownership loss. Native
          // errors, missing surface progress and bad exit never select a retry.
          output = await run('powershell.exe', args);
        }
        const line = output.split(/\r?\n/).find((row) => row.startsWith('CONTINUOUS_SCROLL '));
        if (!line) throw Error('Missing native surface observation');
        const observed = JSON.parse(line.slice('CONTINUOUS_SCROLL '.length));
        console.log(
          JSON.stringify({
            event: 'scene-candidate-result',
            mode,
            trial,
            page,
            identity,
            checks: observed.checks.map(
              ({
                direction,
                inputXFraction,
                packets,
                surfaceUpdates,
                surfaceDurationMs,
                surfaceFPS,
                physicalWidth,
                physicalHeight,
                dpi,
              }) => ({
                direction,
                inputXFraction,
                packets,
                surfaceUpdates,
                surfaceDurationMs,
                surfaceFPS,
                physicalWidth,
                physicalHeight,
                dpi,
              }),
            ),
            exitCode: observed.exitCode,
            scope: 'probe-free normal product; packet-defined OS wheel; scanout unobserved',
          }),
        );
      }
  }
} finally {
  /* oxlint-disable no-unsafe-finally -- Never overwrite a concurrent source edit. */
  try {
    if (!fs.readFileSync(source).equals(active) && !fs.readFileSync(source).equals(original))
      throw Error('Native engine source changed; restore withheld');
    fs.writeFileSync(source, original);
    console.log(JSON.stringify({ event: 'scene-candidate-restore' }));
    await build();
    console.log(
      JSON.stringify({ event: 'scene-candidate-restored', identity: product().identity }),
    );
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
  /* oxlint-enable no-unsafe-finally */
}
