// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { GraphiteRenderer } from '@nelyx/skia-native/renderer';
import { RnwFrameRecords, summarizeScrollRange } from './rnw-frame-records.js';
import { RnwWorkProbe } from './rnw-work-probe.js';
import { installRnwFrameProbe } from './rnw-frame-probe.js';
import { withRnwFrameFixture, runRnwFrameProbe } from '../run-rnw-frame-probe.mjs';

const timeout = 1_200_000;
test(
  'full-range evidence rejects lazy extent growth, shrinkage and missing endpoints',
  { timeout },
  () => {
    const rows = Array.from({ length: 12 }, (_, i) => [1, i === 0 ? 0 : 100, 0, 100]);
    assert.equal(summarizeScrollRange(rows, 100).endpoints, true);
    const shrunk = rows.map((row) => [...row]);
    shrunk[0][3] = 146;
    const cold = summarizeScrollRange(shrunk, 146);
    assert.equal(cold.extentChanged, true);
    assert.equal(cold.finalExtent, 100);
    assert.equal(cold.endpoints, false);
    const grown = rows.map((row) => [...row]);
    grown.at(-1)[3] = 146;
    assert.equal(summarizeScrollRange(grown, 100).extentChanged, true);
    assert.equal(
      summarizeScrollRange(
        rows.map((row) => [row[0], Math.min(row[1], 99), row[2], row[3]]),
        100,
      ).endpoints,
      false,
    );
    assert.equal(summarizeScrollRange(rows.slice(0, 2), 100).endpoints, false);
    assert.equal(summarizeScrollRange([], 100).endpoints, false);
  },
);
test(
  'RNW reconciliation labels observe arguments without retaining child arrays',
  { timeout },
  () => {
    const target = {
        reconcile(previous, widgets) {
          return widgets;
        },
      },
      probe = new RnwWorkProbe(() => 0),
      widgets = [{ key: null }, { key: null }];
    probe.wrap(
      target,
      'reconcile',
      'reconcile',
      (_element, [previous, next]) => `${previous.length}:${next.length}`,
    );
    try {
      probe.begin();
      assert.equal(target.reconcile([], widgets), widgets);
      const group = probe.finish().reconcile;
      assert.deepEqual(group.names, { '0:2': [1, 0, 0, 0] });
      assert.equal(group.count, 1);
    } finally {
      probe.dispose();
    }
  },
);
test(
  'RNW work clock and label failures preserve the original return or exception',
  { timeout },
  () => {
    const failure = Error('runtime failure');
    for (const badClock of [false, true]) {
      const target = {
        run(fail) {
          if (fail) throw failure;
          return 7;
        },
      };
      const probe = new RnwWorkProbe(() => {
        if (badClock) throw Error('clock');
        return 0;
      });
      probe.wrap(target, 'run', 'layout', () => {
        throw Error('label');
      });
      try {
        probe.begin();
        assert.equal(target.run(false), 7);
        assert.throws(
          () => target.run(true),
          (error) => error === failure,
        );
        probe.finish();
        assert.equal(probe.errors, 2);
      } finally {
        probe.dispose();
      }
    }
  },
);
test(
  'RNW work attribution subtracts only same-category nesting and restores inherited methods',
  { timeout },
  () => {
    let time = 0;
    const probe = new RnwWorkProbe(() => time);
    const inner = {
      run() {
        time += 3;
        return 7;
      },
    };
    const inherited = {
      run() {
        time += 2;
        const result = inner.run();
        time += 5;
        return result;
      },
    };
    const outer = Object.create(inherited);
    probe.wrap(inner, 'run', 'layout', () => 'inner');
    probe.wrap(outer, 'run', 'layout', () => 'outer');
    try {
      outer.run();
      assert.equal(probe.finish(), null);
      probe.begin();
      assert.equal(outer.run(), 7);
      const rows = probe.finish().layout;
      assert.equal(rows.total, 10);
      assert.deepEqual(rows.names.inner, [1, 3, 3, 3]);
      assert.deepEqual(rows.names.outer, [1, 10, 7, 10]);
      probe.begin();
      for (let i = 0; i < 30; i++) {
        const target = {
          run() {
            time++;
          },
        };
        probe.wrap(target, 'run', 'layout', () => `name${i}`);
        target.run();
      }
      const bounded = probe.finish().layout;
      assert.equal(bounded.count, 30);
      assert.equal(Object.keys(bounded.names).length, 4);
      assert.equal(bounded.omittedNames, 20);
    } finally {
      probe.dispose();
    }
    assert(!Object.hasOwn(outer, 'run'));
    assert.equal(outer.run, inherited.run);
  },
);

test(
  'RNW work observations preserve thrown errors and independent category nesting',
  { timeout },
  () => {
    let time = 0;
    const probe = new RnwWorkProbe(() => time),
      failure = Error('original failure');
    const inner = {
      run() {
        time += 3;
        throw failure;
      },
    };
    const outer = {
      run() {
        time += 2;
        inner.run();
      },
    };
    probe.wrap(inner, 'run', 'text', () => 'inner');
    probe.wrap(outer, 'run', 'layout', () => 'outer');
    try {
      probe.begin();
      assert.throws(
        () => outer.run(),
        (error) => error === failure,
      );
      const rows = probe.finish();
      assert.equal(rows.layout.total, 5);
      assert.equal(rows.text.total, 3);
      assert.equal(rows.layout.names.outer[2], 5);
    } finally {
      probe.dispose();
    }
  },
);
const identity = {
  view: 'fixture',
  owner: 1,
  viewport: 2,
  renderer: 3,
  context: 4,
  surface: 5,
  frame: 6,
  input: 7,
};
const sample = (other = {}) => ({
  ...identity,
  stage: 'paint',
  begin: 10,
  end: 12,
  duration: 2,
  count: 3,
  bytes: 4,
  ...other,
});
const native = (other = {}) => ({
  ownerGeneration: 1,
  viewportGeneration: 2,
  contextGeneration: 4,
  surfaceGeneration: 5,
  frameSequence: 6,
  inputSequence: 7,
  stage: 0,
  nativeTimestamp: 1010,
  submission: 8,
  view: 9,
  width: 100,
  height: 80,
  inputTimestamp: 9,
  tick: 10,
  clockUncertainty: 0.1,
  ...other,
});
test(
  'source windows exclude preparation, unfinished frames and work crossing the input deadline',
  { timeout },
  () => {
    const records = new RnwFrameRecords();
    for (const [frame, begin, end, duration] of [
      [6, 900, 950, 50],
      [7, 1000, 1015, 2],
      [8, 1100, 1150, 4],
      [9, 1190, 1250, 90],
      [10, 1200, undefined, 200],
    ]) {
      records.source(sample({ frame, duration, end: 10 + duration }));
      records.source(sample({ frame, stage: 'paint-visits', count: frame - 5 }));
      records.native(native({ frameSequence: frame, submission: frame, nativeTimestamp: begin }));
      if (end !== undefined)
        records.native(
          native({ frameSequence: frame, submission: frame, stage: 2, nativeTimestamp: end }),
        );
    }
    const window = records.report(null, { begin: 1000, end: 1200 });
    assert.equal(window.retainedFrames, 2);
    assert.equal(window.retainedMeans.paint, 3);
    assert.equal(window.retainedWorkCounts['paint-visits'].n, 2);
    assert.equal(window.retainedWorkCounts['paint-visits'].p50, 3);
    assert.equal(window.surfaceInterval.n, 1);
    assert.equal(window.surfaceInterval.max, 135);
    assert.equal(window.sourceWindow.frames, 2);
    assert.equal(window.cumulativeWorkCounts['paint-visits'].total, 15);
    assert.deepEqual(window.nativeOutcomeCounts, [5, 0, 4, 0, 0, 0]);
    assert.equal(records.report().retainedFrames, 5);
    assert.equal(records.report().retainedMeans.paint, 36.5);
    for (const bounds of [
      { begin: 2, end: 1 },
      { begin: NaN, end: 1 },
      { begin: 1, end: Infinity },
    ])
      assert.throws(() => records.report(null, bounds), /Invalid native source observation/);
  },
);
test(
  'RNW callback cadence keeps source callback work separate from intervening work',
  { timeout },
  () => {
    const records = new RnwFrameRecords();
    for (const [frame, begin] of [
      [6, 100],
      [7, 113],
    ]) {
      const row = records.source(sample({ frame }));
      row.callback = { id: frame, begin, end: begin + 8, wall: 8 };
      row.timing = { tick: 102, frameStart: 100, queueDelay: 3 };
      records.native(native({ frameSequence: frame }));
      records.native(native({ frameSequence: frame, stage: 2, nativeTimestamp: 1040 }));
    }
    const report = records.report({ offsetToJs: -1000, uncertainty: 0.1 });
    assert.equal(report.retainedMeans['owned-callback'], 8);
    assert.equal(report.retainedMeans['source-callback-interval'], 13);
    assert.equal(report.retainedMeans['source-callback-between'], 5);
    assert.equal(report.retainedMeans['clock-wake-lateness'], 2);
    assert.equal(report.retainedMeans['clock-dispatch-queue'], 3);
    assert.equal(report.retainedMeans['recent-input-callback-interval'], 13);
    const stale = records.source(sample({ frame: 8 }));
    stale.callback = { id: 8, begin: 1000, end: 1008, wall: 8 };
    records.native(native({ frameSequence: 8, nativeTimestamp: 2000 }));
    records.native(native({ frameSequence: 8, stage: 2, nativeTimestamp: 2001 }));
    const after = records.report({ offsetToJs: -1000, uncertainty: 0.1 });
    assert.equal(after.retainedDistributions['owned-callback'].n, 3);
    assert.equal(after.retainedDistributions['recent-input-callback'].n, 2);
  },
);

test(
  'RNW producer worker timing separates queues from work without counting outcomes twice',
  { timeout },
  () => {
    const records = new RnwFrameRecords();
    records.source(sample());
    for (const [stage, nativeTimestamp] of [
      [0, 1010],
      [20, 1012],
      [21, 1017],
      [1, 1020],
      [2, 1021],
    ])
      records.native(native({ stage, nativeTimestamp }));
    records.native(native({ stage: 20, frameSequence: 99, nativeTimestamp: 900 }));
    for (let stage = 22; stage <= 26; stage++)
      records.native(
        native({ stage, nativeTimestamp: 1017, width: (stage - 20) * 1000, height: 0 }),
      );
    const report = records.report({ offsetToJs: -1000, uncertainty: 0.1 });
    for (const [name, expected] of [
      ['submitted-to-worker', 2],
      ['native-producer-worker', 5],
      ['worker-to-ui-producer', 3],
    ])
      assert.deepEqual(report.retainedDistributions[name], {
        n: 1,
        p50: expected,
        p95: expected,
        max: expected,
      });
    assert.deepEqual(report.nativeOutcomeCounts, [1, 1, 1, 0, 0, 0]);
    for (const [index, name] of [
      'producer-import',
      'producer-replay-submit',
      'producer-completion-wait',
      'producer-finish',
      'producer-context',
    ].entries())
      assert.deepEqual(report.retainedDistributions[name], {
        n: 1,
        p50: index + 2,
        p95: index + 2,
        max: index + 2,
      });
    assert.equal(report.invalid, 0);
    assert.equal(report.gpuExecution, 'unobserved; submitted-to-producer includes queue and work');
  },
);
test(
  'surface intervals require consecutive native submissions and do not count an overwritten sample as a stall',
  { timeout },
  () => {
    const records = new RnwFrameRecords();
    for (const [frame, submission, at] of [
      [6, 1, 1000],
      [7, 2, 1016],
      [8, 8, 1200],
      [9, 9, 1260],
    ]) {
      records.source(sample({ frame }));
      records.native(native({ frameSequence: frame, submission, nativeTimestamp: at - 1 }));
      records.native(native({ frameSequence: frame, submission, stage: 2, nativeTimestamp: at }));
    }
    const report = records.report().surfaceInterval;
    assert.equal(report.n, 2);
    assert.equal(report.p50, 60);
    assert.equal(report.p95, 60);
    assert.equal(report.p99, 60);
    assert.equal(report.max, 60);
    assert.equal(report.above33_3ms, 1);
    assert.equal(report.above50ms, 1);
    assert.equal(report.skippedPairs, 1);
  },
);

test(
  'RNW scalar joins require the same owner, viewport, context, surface, frame and input',
  { timeout },
  () => {
    const records = new RnwFrameRecords();
    records.source(sample());
    for (const name of [
      'ownerGeneration',
      'viewportGeneration',
      'contextGeneration',
      'surfaceGeneration',
      'frameSequence',
      'inputSequence',
    ])
      records.native(native({ [name]: 99 }));
    assert.equal(records.joined, 0);
    records.native(native());
    records.native(native({ stage: 2, nativeTimestamp: 1015 }));
    records.native(native({ stage: 3, nativeTimestamp: 1018 }));
    const report = records.report({ offsetToJs: -1000, uncertainty: 0.1 });
    assert.equal(report.joinedFrames, 1);
    const joined = report.slowFrames.find((row) => row.joined);
    assert.deepEqual(joined.source.paint, [10, 12, 2, 1, 3, 4]);
    assert.equal(joined.native[2][0] - joined.native[0][0], 5);
    assert.equal(report.performanceAccepted, false);
    assert.equal(report.displayed, 'unobserved');
    assert.deepEqual(report.nativeOutcomeCounts, [7, 0, 1, 1, 0, 0]);
    assert.deepEqual(report.retainedDistributions.paint, { n: 1, p50: 2, p95: 2, max: 2 });
    assert.deepEqual(report.retainedWorkCounts.paint, { n: 1, p50: 3, p95: 3, max: 3 });
    assert.deepEqual(report.retainedDistributions['submitted-to-surface'], {
      n: 1,
      p50: 5,
      p95: 5,
      max: 5,
    });
  },
);

test(
  'RNW work totals remain bounded and retain earlier composition hits after idle frame eviction',
  { timeout },
  () => {
    const records = new RnwFrameRecords(1);
    records.source(sample({ stage: 'composition-updates', count: 2 }));
    records.source(sample({ frame: 7, stage: 'composition-updates', count: 0 }));
    records.source(sample({ frame: 8, stage: 'external-work', count: 99 }));
    const report = records.report({});
    assert.equal(report.retainedFrames, 1);
    assert.deepEqual(report.cumulativeWorkCounts, {
      'composition-updates': { samples: 2, nonzero: 1, total: 2, max: 2 },
    });
    records.source(sample({ frame: 9, stage: 'composition-updates', count: 1 }));
    assert.equal(
      report.cumulativeWorkCounts['composition-updates'].total,
      2,
      'Published totals are independent snapshots',
    );
  },
);

test(
  'RNW input work remains part of one callback even when several frame rows share that callback',
  { timeout },
  () => {
    const records = new RnwFrameRecords(),
      callback = {
        id: 1,
        wall: 12,
        inputWall: 5,
        inputEvents: 2,
        work: {
          'pointer-hit': { count: 2, total: 3, names: { input: [2, 3, 3, 2] } },
        },
      };
    for (const frame of [6, 7]) {
      const row = records.source(sample({ frame }));
      row.callback = callback;
      records.native(native({ frameSequence: frame }));
      records.native(native({ frameSequence: frame, stage: 2, nativeTimestamp: 1015 }));
    }
    const report = records.report(null);
    assert.deepEqual(report.retainedDistributions['owned-callback'], {
      n: 1,
      p50: 12,
      p95: 12,
      max: 12,
    });
    assert.deepEqual(report.retainedDistributions['owned-input-dispatch'], {
      n: 1,
      p50: 5,
      p95: 5,
      max: 5,
    });
    assert.deepEqual(report.retainedDistributions['owned-callback-outside-input'], {
      n: 1,
      p50: 7,
      p95: 7,
      max: 7,
    });
    const work = report.retainedCallbackWork['pointer-hit'];
    assert.equal(work.callbacks, 1);
    assert.equal(work.count, 2);
    assert.equal(work.total, 3);
    assert.deepEqual(work.names.input, [2, 3, 3, 2]);
    assert.equal(
      Object.keys(records.report(null, { begin: 1016, end: 1020 }).retainedCallbackWork).length,
      0,
    );
  },
);

test(
  'RNW records bound frames, stages and slow details and never copy arbitrary objects',
  { timeout },
  () => {
    const records = new RnwFrameRecords(3),
      resource = {
        dispose() {
          throw Error('not owned');
        },
      };
    for (let frame = 1; frame <= 10; frame++) records.source(sample({ frame, resource }));
    assert.equal(records.rows.size, 3);
    assert.equal(records.evicted, 7);
    for (let i = 0; i < 72; i++) records.source(sample({ frame: 10, stage: `stage${i}` }));
    assert(records.invalid > 0);
    records.native(native({ nativeTimestamp: NaN }));
    const report = records.report(null);
    assert(report.slowFrames.length <= 6);
    assert(!JSON.stringify(report).includes('resource'));
    assert([...records.rows.values()].every((row) => Object.keys(row.source).length <= 64));
  },
);

test(
  'RNW fixture restores exact app bytes and removes only its temporary sources on success and failure',
  { timeout },
  async () => {
    const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-rnw-fixture-'))),
      original = Buffer.from('export const App = () => <Surface onReady={() => {}} />;\r\n');
    try {
      fs.writeFileSync(path.join(directory, 'App.tsx'), original);
      for (const fail of [false, true]) {
        const work = withRnwFrameFixture(directory, async ({ directory: fixture, appFile }) => {
          assert.equal(path.dirname(fixture), directory);
          assert(fs.readFileSync(appFile, 'utf8').includes('installRnwFrameProbe(application)'));
          assert(fs.existsSync(path.join(fixture, 'rnw-frame-probe.js')));
          if (fail) throw Error('intentional fixture failure');
        });
        if (fail) await assert.rejects(work, /intentional fixture failure/);
        else await work;
        assert(fs.readFileSync(path.join(directory, 'App.tsx')).equals(original));
        assert.deepEqual(fs.readdirSync(directory), ['App.tsx']);
      }
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);

function fixture() {
  let time = 0,
    interval,
    stopped = false;
  const writes = [],
    entries = [];
  const token = {
    owner: { id: 'fixture', generation: 1 },
    sequence: 6,
    inputSequence: 7,
    metrics: {
      viewportGeneration: 2,
      rendererGeneration: 3,
      nativeContextGeneration: 4,
      nativeSurfaceGeneration: 5,
    },
  };
  const view = {
    owner: token.owner,
    frameDiagnostics: undefined,
    pump() {
      const began = time;
      time += 3;
      this.frameDiagnostics?.record(token, 'paint', began, 2, 40);
    },
  };
  const callbacks = [];
  const clock = {
    request(callback) {
      callbacks.push(callback);
      return { dispose() {} };
    },
  };
  const app = { view, services: { clock }, dispose: () => 'ordinary close' };
  const api = {
    frameDiagnosticsEnabled: true,
    getMonotonicTime: () => time + 1000,
    writeFrameDiagnostics: (value) => writes.push(JSON.parse(value)),
    drainFrameTrace: () => entries.splice(0),
  };
  const options = {
    api,
    now: () => time,
    setInterval: (callback) => {
      interval = callback;
      return 1;
    },
    clearInterval: (id) => {
      assert.equal(id, 1);
      stopped = true;
    },
  };
  return {
    app,
    view,
    token,
    writes,
    entries,
    options,
    queue(callback) {
      clock.request(callback);
    },
    flush() {
      callbacks.shift()();
    },
    frame(duration, stage = 'paint') {
      clock.request(() => {
        const began = time;
        time += duration;
        view.frameDiagnostics?.record(token, stage, began);
      });
      callbacks.shift()();
    },
    tick() {
      clock.request(() => view.pump());
      callbacks.shift()();
    },
    advance() {
      time += 2100;
      interval();
    },
    get stopped() {
      return stopped;
    },
  };
}

test(
  'RNW probe stays disabled without touching the app and restores its hooks before ordinary close',
  { timeout },
  () => {
    assert.equal(
      installRnwFrameProbe(
        {
          get view() {
            throw Error('ordinary app was touched');
          },
        },
        { api: { frameDiagnosticsEnabled: false } },
      ),
      undefined,
    );
    const f = fixture(),
      request = f.app.services.clock.request,
      submit = GraphiteRenderer.prototype.submit;
    const probe = installRnwFrameProbe(f.app, f.options);
    try {
      f.tick();
      f.entries.push(
        native(),
        native({ stage: 2, nativeTimestamp: 1017 }),
        native({ stage: 3, nativeTimestamp: 1018 }),
      );
      f.advance();
      const report = f.writes.at(-1);
      assert.equal(report.joinedFrames, 1);
      assert.equal(report.errors, 0);
      assert.equal(report.slowFrames[0].callback.wall, 3);
      assert.equal(report.clock.offsetToJs, -1000);
      assert.equal(f.app.dispose(), 'ordinary close');
      assert.equal(f.writes.at(-1).observationClosed, true);
      assert.equal(f.app.services.clock.request, request);
      assert.equal(f.view.frameDiagnostics, undefined);
      assert.equal(GraphiteRenderer.prototype.submit, submit);
      assert.equal(f.stopped, true);
    } finally {
      probe.dispose();
    }
  },
);

test(
  'RNW callback observations keep the expensive build callback when submission occurs later',
  { timeout },
  () => {
    const f = fixture(),
      probe = installRnwFrameProbe(f.app, f.options);
    try {
      f.frame(100, 'layout');
      f.frame(2, 'submit');
      f.entries.push(
        native(),
        native({ stage: 2, nativeTimestamp: 1105 }),
        native({ stage: 3, nativeTimestamp: 1106 }),
      );
      f.advance();
      const report = f.writes.at(-1);
      assert.equal(report.slowFrames[0].callback.wall, 100);
      assert.equal(report.slowFrames[0].source.layout[2], 100);
      assert.equal(report.latestFrame.native[3][0], 1106);
    } finally {
      probe.dispose();
    }
  },
);

test(
  'a callback scheduled before RNW probe attachment has unobserved callback wall',
  { timeout },
  () => {
    const f = fixture();
    f.queue(() => f.view.pump());
    const probe = installRnwFrameProbe(f.app, f.options);
    try {
      f.flush();
      f.advance();
      assert.equal(f.writes.at(-1).slowFrames[0].callback, null);
    } finally {
      probe.dispose();
    }
  },
);

test(
  'cancelling the owned RNW build restores the app and removes its temporary fixture',
  { timeout },
  async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-rnw-abort-'))),
      runner = path.join(root, 'sample/nelyx-testbed-app-2/windows/runner'),
      cli = path.join(runner, 'node_modules/@nelyx/cli'),
      original = Buffer.from('export const App = () => <Surface onReady={() => {}} />;\n');
    const controller = new AbortController();
    let timer;
    try {
      fs.mkdirSync(cli, { recursive: true });
      fs.writeFileSync(
        path.join(cli, 'package.json'),
        JSON.stringify({ bin: { nelyx: 'cli.mjs' } }),
      );
      fs.writeFileSync(path.join(cli, 'cli.mjs'), 'setTimeout(() => process.exit(2), 15000);\n');
      fs.writeFileSync(path.join(runner, 'App.tsx'), original);
      const began = Date.now();
      timer = setTimeout(() => controller.abort(), 300);
      await assert.rejects(
        runRnwFrameProbe(root, { signal: controller.signal }),
        /cancellation|aborted/,
      );
      assert(
        Date.now() - began < 10000,
        'Cancellation must stop the owned child before its own timeout',
      );
      assert(fs.readFileSync(path.join(runner, 'App.tsx')).equals(original));
      assert(!fs.readdirSync(runner).some((name) => name.startsWith('.rnw-frame-probe-')));
    } finally {
      clearTimeout(timer);
      controller.abort();
      assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
      assert(!fs.lstatSync(root).isSymbolicLink());
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);

test(
  'failed RNW observation cannot turn an accepted native submission into failure',
  { timeout },
  () => {
    const f = fixture(),
      previous = GraphiteRenderer.prototype.submit;
    GraphiteRenderer.prototype.submit = () => ({ status: 'accepted', submission: 1 });
    const probe = installRnwFrameProbe(f.app, f.options);
    try {
      const renderer = {
        frameDiagnostics: undefined,
        context() {
          throw Error('observation unavailable');
        },
      };
      assert.equal(
        GraphiteRenderer.prototype.submit.call(renderer, { token: f.token }).status,
        'accepted',
      );
      assert.equal(renderer.frameDiagnostics, undefined);
      f.advance();
      assert.equal(f.writes.at(-1).errors, 1);
    } finally {
      probe.dispose();
      GraphiteRenderer.prototype.submit = previous;
    }
  },
);
