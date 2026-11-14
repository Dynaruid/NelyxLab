// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { windowsCompilerEnvironment } from '../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { verifyEngineV2Application } from '../sdk/tooling/cli/src/engine-v2-runner.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const bundle = verifyEngineV2Application(
  path.join(root, 'sample/nelyx-demo-app/engine-v2/dist/v2-windows'),
  'windows',
);
if (!bundle.manifest.nativeUnit) throw Error('Build the explicit native App candidate first');
const evidence = JSON.parse(
  fs.readFileSync(path.join(bundle.root, bundle.manifest.nativeUnit.evidence), 'utf8'),
);
const imageSha256 = bundle.manifest.files.find(
  (file) => file.path === bundle.manifest.nativeUnit.entry,
).sha256;
if (evidence.nativePcMap.imageSha256 !== imageSha256)
  throw Error('Native image and function ranges differ');
const source = fs.readFileSync(path.join(bundle.root, 'application/app.js'), 'utf8').split('\n');
const parent = fs.realpathSync(path.join(root, '.nelyx'));
const temporary = fs.mkdtempSync(path.join(parent, 'native-stack-'));
const deadline = Date.now() + 1_170_000;
const timeout = () => Math.max(1, deadline - Date.now());
if (path.dirname(temporary) !== parent) throw Error('Native stack fixture owner differs');
async function observe(executable) {
  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(import.meta.dirname, 'check-windows-scroll.ps1'),
      '-Scenario',
      'Calendar',
      '-RapidMonths',
      '12',
      '-PrecisionHz',
      '60',
      '-GestureSpeed',
      '3',
      '-NativeSampler',
      executable,
    ],
    { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let expired = false,
    parseError,
    observation,
    result;
  const tail = [];
  const stop = () => {
    expired = true;
    if (child.pid)
      spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
        windowsHide: true,
        timeout: 10000,
        stdio: 'ignore',
      });
  };
  const timer = setTimeout(stop, timeout());
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const streams = [child.stdout, child.stderr].map((stream) => {
    const input = createInterface({ input: stream });
    input.on('line', (line) => {
      tail.push(line.slice(0, 500));
      if (tail.length > 16) tail.shift();
      try {
        const stackPrefix = 'WINDOWS_SCROLL_NATIVE_STACK ',
          resultPrefix = 'WINDOWS_SCROLL_RESULT ';
        if (line.startsWith(stackPrefix)) observation = JSON.parse(line.slice(stackPrefix.length));
        if (line.startsWith(resultPrefix)) result = JSON.parse(line.slice(resultPrefix.length));
      } catch (error) {
        parseError = error;
        stop();
      }
    });
    input.on('error', (error) => {
      parseError = error;
      stop();
    });
    return input;
  });
  try {
    const status = await new Promise((resolve) => {
      child.once('error', (error) => resolve({ error }));
      child.once('close', (code) => resolve({ code }));
    });
    if (
      status.error ||
      parseError ||
      status.code !== 0 ||
      expired ||
      !observation ||
      result?.functional !== 'PASS'
    )
      throw Error(
        'Native stack observation failed: ' + JSON.stringify(status) + '\n' + tail.join('\n'),
      );
    return { observation, result };
  } finally {
    clearTimeout(timer);
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    for (const stream of streams) stream.close();
  }
}
try {
  const executable = path.join(temporary, 'sampler.exe');
  await execute(
    'cl.exe',
    [
      '/nologo',
      '/std:c++20',
      '/EHsc',
      '/MD',
      '/O2',
      path.join(import.meta.dirname, 'windows-source-sampler.cpp'),
      '/Fo:' + path.join(temporary, 'sampler.obj'),
      '/Fe:' + executable,
      '/link',
      'dbghelp.lib',
    ],
    { cwd: temporary, env: windowsCompilerEnvironment(), timeout: timeout() },
  );
  const { observation: report, result } = await observe(executable);
  const observation = report.observation;
  if (
    report.imageSha256 !== imageSha256 ||
    observation.domain !== 'qpc-seconds' ||
    observation.failures ||
    observation.resumeFailures ||
    observation.samples.length > 256
  )
    throw Error('Native observation image/clock/lifetime bound differs');
  const groups = [];
  for (const fn of evidence.nativePcMap.functions) {
    let group = groups.at(-1);
    if (group?.rva !== fn.rva) groups.push((group = { rva: fn.rva, functions: [] }));
    group.functions.push(fn);
  }
  const find = (rva) => {
    let low = 0,
      high = groups.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (groups[middle].rva <= rva) low = middle + 1;
      else high = middle;
    }
    return low ? groups[low - 1].functions.filter((fn) => rva < fn.rva + fn.size) : [];
  };
  const nearest = new Map(),
    inclusive = new Map();
  let active = 0,
    withApp = 0,
    appLeaf = 0,
    unmapped = 0,
    ambiguous = 0,
    truncated = 0;
  const count = (map, fn) => {
    let value = map.get(fn.symbol);
    if (!value)
      map.set(
        fn.symbol,
        (value = {
          symbol: fn.symbol,
          position: fn.position,
          source: fn.position ? source[fn.position.line - 1]?.trim().slice(0, 180) : null,
          samples: 0,
        }),
      );
    ++value.samples;
  };
  for (const sample of observation.samples) {
    if (sample.from < report.started || sample.to > report.ended) continue;
    ++active;
    if (sample.truncated) ++truncated;
    if (sample.leafInApp) ++appLeaf;
    if (sample.frames.length) ++withApp;
    const seen = new Set();
    for (let i = 0; i < sample.frames.length; ++i) {
      const functions = find(sample.frames[i]);
      if (!functions.length) ++unmapped;
      else if (functions.length !== 1) ++ambiguous;
      else {
        const fn = functions[0];
        if (i === 0) count(nearest, fn);
        if (!seen.has(fn.symbol)) count(inclusive, fn);
        seen.add(fn.symbol);
      }
    }
  }
  if (active < 16 || withApp < 8) throw Error('Native unwind did not observe enough App frames');
  const top = (map) => [...map.values()].sort((a, b) => b.samples - a.samples).slice(0, 24);
  console.log(
    'WINDOWS_NATIVE_SOURCE_PROFILE ' +
      JSON.stringify({
        diagnosticOnly: true,
        scope: 'one-owned-App-thread-wall-stack-snapshots',
        precision: 'native-function-range',
        pid: observation.pid,
        thread: observation.thread,
        maximumSamples: 256,
        maximumFrames: 48,
        frozenStackByteBound: 512 * 1024,
        sourceSha256: bundle.manifest.bytecode.sourceSha256,
        imageSha256,
        active,
        withApp,
        appLeaf,
        unmapped,
        ambiguous,
        truncated,
        maximumHeldMs: observation.maximumHeldMs,
        totalHeldMs: observation.totalHeldMs,
        nearestAppFrame: top(nearest),
        inclusiveAppFrames: top(inclusive),
        functional: result.functional,
        closed: result.closed,
        performanceAccepted: false,
      }),
  );
} finally {
  /* oxlint-disable no-unsafe-finally -- Preserve an unexpected cleanup target. */
  if (fs.realpathSync(temporary) !== temporary || path.dirname(temporary) !== parent)
    throw Error('Native stack cleanup owner changed');
  /* oxlint-enable no-unsafe-finally */
  fs.rmSync(temporary, { recursive: true, force: true });
}
