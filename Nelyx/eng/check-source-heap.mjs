// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { windowsCompilerEnvironment } from '../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { sourceHeap } from './windows-source-heap.mjs';

const parent = fs.realpathSync('.nelyx'),
  temporary = fs.mkdtempSync(path.join(parent, 'source-heap-'));
const deadline = Date.now() + 1_200_000;
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: temporary,
    encoding: 'utf8',
    windowsHide: true,
    timeout: Math.max(1, deadline - Date.now()),
    ...options,
  });
  if (result.error || result.status)
    throw Error(String(result.error ?? result.stdout + result.stderr));
  return result.stdout;
};
try {
  run(
    'cl.exe',
    [
      '/nologo',
      '/std:c++20',
      '/EHsc',
      '/MD',
      '/O2',
      path.resolve('Nelyx/eng/check-source-heap-clock.cpp'),
      '/Fe:' + path.join(temporary, 'check.exe'),
    ],
    { env: windowsCompilerEnvironment() },
  );
  const native = run(path.join(temporary, 'check.exe'), []),
    line = native.split(/\r?\n/).find((value) => value.startsWith('HEAP_CLOCK_SAMPLE '));
  assert(line, 'Native heap clock output missing');
  const heap = JSON.parse(line.slice('HEAP_CLOCK_SAMPLE '.length));
  assert.equal(heap.points.length, 3);
  assert.equal(heap.through, 7);
  assert.equal(heap.invalid, 3);
  assert.equal(heap.failed, 1);
  assert.equal(heap.points[2][2], '18446744073709551615');
  const app = {
    domain: 'qpc-milliseconds',
    samplesOverwritten: 0,
    samples: [
      {
        pass: 1,
        input: 'wide',
        buildStarted: 101,
        buildMs: 4,
        captureStarted: 105,
        captureMs: 1,
        sceneStarted: 0,
        sceneMs: 0,
        projection: { created: 1 },
      },
    ],
    sourcePreparation: {
      clockDomain: 'qpc-milliseconds',
      samplesOverwritten: 0,
      samples: [
        {
          sequence: 1,
          kind: 'retained-box',
          started: 105,
          elapsedMs: 1,
          target: { input: 'wide' },
          capturePass: 1,
          result: 'built',
        },
      ],
    },
  };
  const joined = sourceHeap({ heap, app });
  assert.deepEqual(joined.stages.build, {
    intervals: 1,
    elapsedMs: 4,
    allocatedBytes: '10',
    collections: '1',
    maximumIntervalBytes: '10',
  });
  assert.equal(joined.stages.capture.allocatedBytes, '0');
  assert.equal(joined.stages.capture.collections, '1');
  assert.equal(joined.largestIntervals.build[0].heapAllocatedChange, '-17');
  assert.equal(joined.largestIntervals.build[0].heapCapacityChange, '-90');
  assert.equal(joined.largestIntervals.source[0].externalBytesChange, '1');
  assert.equal(joined.stages.scene.intervals, 0);
  assert.equal(joined.missing.scene['missing-or-invalid-boundary'], 1);
  assert.equal(joined.performanceAccepted, false);
  assert.equal(joined.categoriesOverlap, true);
  const copy = (value) => structuredClone(value),
    fixture = () => ({ heap: copy(heap), app: copy(app) });
  let f = fixture();
  f.app.elementProfile = {
    schema: 'nelyx.app.source-element-profile/v1',
    domain: 'qpc-milliseconds',
    scope: 'flushed-dirty-element-rebuild',
    sampling: 'first-two-per-constructor-and-empty-or-populated-children',
    capacity: 512,
    typeCapacity: 128,
    calls: 2,
    unclassified: 0,
    limited: 0,
    failures: 1,
    types: [{ id: 1, name: 'SameName', calls: 2, empty: 1, populated: 1 }],
    samples: [
      { sequence: 1, type: 1, childrenBefore: 0, started: 101, elapsedMs: 4, complete: true },
      { sequence: 2, type: 1, childrenBefore: 1, started: 0, elapsedMs: 0, complete: false },
    ],
  };
  const elementFixture = copy(f),
    elementJoined = sourceHeap(f);
  assert.equal(elementJoined.stages.element.allocatedBytes, '10');
  assert.equal(elementJoined.largestIntervals.element[0].widget, 'SameName');
  assert.equal(elementJoined.missing.element.incomplete, 1);
  assert.equal(elementJoined.elementProfile.types[0].matched.intervals, 1);
  f = copy(elementFixture);
  f.app.elementProfile.samples[1].sequence = 1;
  assert.throws(() => sourceHeap(f), /classification/);
  f = copy(elementFixture);
  f.app.elementProfile.types[0].empty = 2;
  assert.throws(() => sourceHeap(f), /accounting/);
  f = copy(elementFixture);
  f.app.elementProfile.samples = Array(513).fill(f.app.elementProfile.samples[0]);
  assert.throws(() => sourceHeap(f), /retained bound/);
  f = fixture();
  f.heap.domain = 'app-performance-milliseconds';
  assert.throws(() => sourceHeap(f), /domain/);
  f = fixture();
  f.app.domain = 'app-performance-milliseconds';
  assert.equal(sourceHeap(f).missing.build['clock-domain-mismatch'], 1);
  f = fixture();
  f.app.samples[0].buildStarted = 1;
  assert.equal(sourceHeap(f).outsideProfile.build, 1);
  f = fixture();
  f.app.samples[0].buildStarted = 99;
  assert.equal(sourceHeap(f).missing.build['crosses-profile-boundary'], 1);
  f = fixture();
  f.app.samples[0].buildStarted = 102;
  assert.equal(sourceHeap(f).missing.build['missing-clock-point'], 1);
  f = fixture();
  f.heap.points[0][1] = 101;
  f.heap.points.splice(1, 0, copy(f.heap.points[0]));
  f.heap.through++;
  assert.equal(sourceHeap(f).missing.build['ambiguous-clock'], 1);
  f = fixture();
  f.app.samples[0].buildStarted += Number.EPSILON * 101;
  const rounded = sourceHeap(f);
  assert.equal(rounded.stages.build.intervals, 1);
  assert(rounded.largestIntervals.build[0].maximumClockErrorMs > 0);
  f = fixture();
  f.heap.points[1][2] = '1';
  assert.throws(() => sourceHeap(f), /monotonic/);
  f = fixture();
  f.heap.points[0][2] = '9007199254740993.0';
  assert.throws(() => sourceHeap(f), /decimal/);
  f = fixture();
  f.heap.points[2][2] = '18446744073709551616';
  assert.throws(() => sourceHeap(f), /uint64/);
  f = fixture();
  f.heap.points[0][1] = 108;
  assert.throws(() => sourceHeap(f), /native window/);
  f = fixture();
  f.heap.through++;
  assert.throws(() => sourceHeap(f), /accounting/);
  f = fixture();
  f.app.samples = Array(129).fill(f.app.samples[0]);
  assert.throws(() => sourceHeap(f), /retained bound/);
  const stdin = JSON.stringify({ heap, app }),
    cli = run(process.execPath, [path.resolve('Nelyx/eng/windows-source-heap.mjs')], {
      input: stdin,
    });
  assert.deepEqual(JSON.parse(cli), joined);
  const tool = path.resolve('Nelyx/eng/windows-source-heap.mjs'),
    withBom = run(process.execPath, [tool], { input: '\uFEFF' + stdin });
  assert.deepEqual(JSON.parse(withBom), joined);
  assert.deepEqual(
    JSON.parse(run(process.execPath, [tool], { input: '\uFEFF\uFEFF' + stdin })),
    joined,
  );
  if (process.platform === 'win32') {
    const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
    const pipeline = run(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '$OutputEncoding=[Text.UTF8Encoding]::new($true);' +
          '[Console]::In.ReadToEnd() | & ' +
          quote(process.execPath) +
          ' ' +
          quote(tool) +
          ';exit $LASTEXITCODE',
      ],
      { input: stdin },
    );
    assert.deepEqual(JSON.parse(pipeline), joined);
  }
  const invalid = spawnSync(process.execPath, [tool], {
    input: '{' + ' '.repeat(65536),
    encoding: 'utf8',
    windowsHide: true,
    timeout: Math.max(1, deadline - Date.now()),
  });
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, '');
  assert(invalid.stderr.startsWith('App heap join: ') && invalid.stderr.length < 500);
  console.log(native.split(/\r?\n/).find((value) => value.startsWith('Heap clock:')));
  console.log(
    'Source heap join: exact/rounded/ambiguous/missing clocks, domains/windows, failures, wide counters, GC deltas, nested scope, BOM/Windows pipeline and bounded CLI errors PASS.',
  );
} finally {
  /* oxlint-disable no-unsafe-finally -- Do not remove a substituted cleanup target. */
  if (fs.realpathSync(temporary) !== temporary || path.dirname(temporary) !== parent)
    throw Error('Heap fixture cleanup owner changed');
  /* oxlint-enable no-unsafe-finally */
  fs.rmSync(temporary, { recursive: true, force: true });
}
