// SPDX-License-Identifier: BSD-3-Clause
// Bounded same-bundle comparison. Only JS/HBC/manifest are temporarily replaced;
// the original current bundle is restored in finally. No SDK/profile is copied.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { transformSync } from 'esbuild';
import { verifyEngineV2Application } from '../sdk/tooling/cli/src/engine-v2-runner.mjs';
import {
  windowsHermesSyntax,
  windowsHermesPolicy,
} from '../sdk/tooling/cli/src/windows-hermes-policy.mjs';
import { windowsHermesSyntaxPolicy } from '../sdk/tooling/cli/src/windows-hermes-syntax.mjs';
import { windowsNativeHermesCohort } from '@nelyx/sdk/runtime/cohorts';

const root = path.resolve(import.meta.dirname, '../..');
const app = path.join(root, 'sample/nelyx-demo-app/engine-v2');
const application = verifyEngineV2Application(path.join(app, 'dist/v2-windows'), 'windows');
const js = path.join(application.root, 'application/app.js'),
  hbc = path.join(application.root, 'application/app.hbc');
const manifestFile = path.join(application.root, 'app-manifest.json');
const saved = new Map([js, hbc, manifestFile].map((file) => [file, fs.readFileSync(file)]));
const source = saved.get(js).toString('utf8');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const deadline = Date.now() + 1_200_000;
const modes = process.argv.includes('--fields-only')
  ? ['lowered/direct', 'native/direct']
  : process.argv.includes('--projection-only')
    ? ['native/reference', 'native/direct']
    : ['lowered/direct', 'native/direct', 'lowered/reference', 'native/reference'];
async function run(command, args, observe = () => {}) {
  const left = deadline - Date.now();
  if (left <= 0) throw Error('Source comparison exceeded 20 minutes');
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let expired = false;
    const lines = [];
    const timer = setTimeout(() => {
      expired = true;
      if (child.pid)
        spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
          windowsHide: true,
          stdio: 'ignore',
          timeout: 10000,
        });
    }, left);
    const receive = (line) => {
      lines.push(line);
      if (lines.length > 32) lines.shift();
      observe(line);
    };
    for (const stream of [child.stdout, child.stderr])
      createInterface({ input: stream }).on('line', receive);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && !expired) resolve();
      else reject(Error(command + ' ' + (expired ? 'timed out' : code) + '\n' + lines.join('\n')));
    });
  });
}
try {
  for (const mode of modes) {
    const [fields, projection] = mode.split('/');
    let input = source;
    if (projection === 'reference') {
      const marker = 'this.options.diagnosticProjection !== "reference"';
      assert.equal(input.split(marker).length, 2, 'Reference projection hook must be unique');
      input = input.replace(marker, 'false');
    }
    const code = transformSync(input, {
      target: 'es2015',
      format: 'iife',
      supported:
        fields === 'native'
          ? windowsHermesSyntaxPolicy(windowsNativeHermesCohort()).supported
          : windowsHermesSyntax,
    }).code;
    console.log(
      'SOURCE_COMPARISON_BEGIN ' +
        JSON.stringify({
          mode,
          baseJsSha256: sha(saved.get(js)),
          instanceFieldHelpers: (code.match(/__publicField\d*\(this,/g) ?? []).length,
        }),
    );
    fs.writeFileSync(js, code);
    await run(path.join(application.supply.root, 'windows-app-sdk/hermesc.exe'), [
      ...windowsHermesPolicy('optimized', windowsNativeHermesCohort()).flags,
      '-Xes6-block-scoping',
      '-emit-binary',
      '-emit-async-break-check',
      '-g1',
      '-out=' + hbc,
      js,
    ]);
    const manifest = JSON.parse(saved.get(manifestFile));
    manifest.bytecode.sourceSha256 = sha(fs.readFileSync(js));
    manifest.diagnosticComparison = {
      mode,
      baseJsSha256: sha(saved.get(js)),
      generatedSource: 'current',
    };
    for (const file of manifest.files)
      if (file.path === 'application/app.js' || file.path === 'application/app.hbc')
        file.sha256 = sha(fs.readFileSync(path.join(application.root, file.path)));
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
    const result = { mode };
    await run(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(root, 'Nelyx/eng/check-windows-scroll.ps1'),
        '-App',
        app,
        '-Scenario',
        'Calendar',
        '-RapidMonths',
        '12',
        '-PrecisionHz',
        '60',
        '-GestureSpeed',
        '3',
        '-YearMode',
      ],
      (line) => {
        const match =
          /^WINDOWS_SCROLL_(MOVEMENT|RESULT|APP|SOURCE|CLEANUP|IDENTITY|SEMANTICS) (\{.*\})$/.exec(
            line,
          );
        if (match) {
          const value = JSON.parse(match[2]);
          if (match[1] === 'MOVEMENT') (result.movement ??= []).push(value);
          else result[match[1].toLowerCase()] = value;
        }
      },
    );
    assert.equal(result.result?.functional, 'PASS');
    console.log('SOURCE_COMPARISON_RESULT ' + JSON.stringify(result));
  }
} finally {
  for (const [file, bytes] of saved) fs.writeFileSync(file, bytes);
  verifyEngineV2Application(application.root, 'windows');
  console.log('SOURCE_COMPARISON_RESTORED ' + sha(fs.readFileSync(js)));
}
