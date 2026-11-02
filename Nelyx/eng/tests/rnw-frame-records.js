// SPDX-License-Identifier: BSD-3-Clause
// Bounded scalar joins for the opt-in, actual RNW diagnostic fixture.
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const key = (v) => [v.owner, v.viewport, v.context, v.surface, v.frame, v.input].join(':');
const validIdentity = (v) =>
  ['owner', 'viewport', 'context', 'surface', 'frame', 'input'].every((name) => integer(v[name]));
const countedWork = new Set([
  'paint-visits',
  'boundary-visits',
  'boundary-recordings',
  'boundary-reuses',
  'composition-updates',
  'composition-visits',
  'composition-reuses',
  'composition-scope-misses',
  'composition-structure-misses',
  'scene-paths',
  'scene-path-native',
  'scene-path-verbs',
  'scene-clips',
  'scene-clip-native',
  'scene-paints',
  'scene-paint-native',
  'scene-wrappers',
  'scene-compose-extract',
  'scene-compose-edges',
  'scene-compose-native',
  'scene-compose-state',
  'semantics-geometry-native',
  'semantics-geometry-fallback',
  'semantics-geometry-state',
]);

export class RnwFrameRecords {
  constructor(capacity = 256) {
    if (!integer(capacity) || capacity < 1 || capacity > 1024)
      throw Error('Invalid RNW frame capacity');
    this.capacity = capacity;
    this.rows = new Map();
    this.slow = [];
    this.sourceSamples = 0;
    this.nativeSamples = 0;
    this.nativeOutcomeCounts = [0, 0, 0, 0, 0, 0];
    this.evicted = 0;
    this.invalid = 0;
    this.joined = 0;
    this.workTotals = Object.create(null);
  }
  row(identity) {
    if (!validIdentity(identity)) {
      this.invalid++;
      return undefined;
    }
    const id = key(identity);
    let row = this.rows.get(id);
    if (!row) {
      row = {
        identity: Object.fromEntries(
          ['owner', 'viewport', 'context', 'surface', 'frame', 'input'].map((name) => [
            name,
            identity[name],
          ]),
        ),
        source: Object.create(null),
        native: {},
        callback: null,
        recording: null,
      };
      this.rows.set(id, row);
      if (this.rows.size > this.capacity) {
        this.remember(this.rows.values().next().value);
        this.rows.delete(this.rows.keys().next().value);
        this.evicted++;
      }
    }
    return row;
  }
  source(sample) {
    const row = this.row(sample);
    if (!row) return;
    if (
      typeof sample.stage !== 'string' ||
      sample.stage.length > 40 ||
      (!Object.hasOwn(row.source, sample.stage) && Object.keys(row.source).length >= 64) ||
      ![sample.begin, sample.end, sample.duration, sample.count, sample.bytes].every(
        Number.isFinite,
      ) ||
      sample.end < sample.begin ||
      sample.duration < 0 ||
      sample.count < 0 ||
      sample.bytes < 0
    ) {
      this.invalid++;
      return;
    }
    // Keep identity fields only; callers can never retain a token or scene.
    row.identity = {
      ...row.identity,
      ...(typeof sample.view === 'string' ? { view: sample.view.slice(0, 128) } : {}),
      ...(integer(sample.renderer) ? { renderer: sample.renderer } : {}),
    };
    const old = row.source[sample.stage];
    row.source[sample.stage] = old
      ? [
          Math.min(old[0], sample.begin),
          Math.max(old[1], sample.end),
          old[2] + sample.duration,
          old[3] + 1,
          old[4] + sample.count,
          old[5] + sample.bytes,
        ]
      : [sample.begin, sample.end, sample.duration, 1, sample.count, sample.bytes];
    this.sourceSamples++;
    if (countedWork.has(sample.stage)) {
      const total = (this.workTotals[sample.stage] ??= {
        samples: 0,
        nonzero: 0,
        total: 0,
        max: 0,
      });
      total.samples++;
      total.nonzero += sample.count > 0 ? 1 : 0;
      total.total += sample.count;
      total.max = Math.max(total.max, sample.count);
    }
    this.markJoined(row);
    return row;
  }
  native(entry) {
    const row = this.row({
      owner: entry.ownerGeneration,
      viewport: entry.viewportGeneration,
      context: entry.contextGeneration,
      surface: entry.surfaceGeneration,
      frame: entry.frameSequence,
      input: entry.inputSequence,
    });
    if (!row) return;
    if (
      !integer(entry.stage) ||
      (entry.stage > 5 && (entry.stage < 20 || entry.stage > 26)) ||
      ![
        entry.nativeTimestamp,
        entry.submission,
        entry.view,
        entry.width,
        entry.height,
        entry.inputTimestamp,
        entry.tick,
        entry.clockUncertainty,
      ].every(Number.isFinite)
    ) {
      this.invalid++;
      return;
    }
    row.native[entry.stage] = [
      entry.nativeTimestamp,
      entry.submission,
      entry.view,
      entry.width,
      entry.height,
      entry.inputTimestamp,
      entry.tick,
      entry.clockUncertainty,
    ];
    this.nativeSamples++;
    if (entry.stage <= 5) this.nativeOutcomeCounts[entry.stage]++;
    this.markJoined(row);
    return row;
  }
  markJoined(row) {
    if (!row.joined && Object.keys(row.source).length && row.native[0]) {
      row.joined = true;
      this.joined++;
      if (!this.latest || row.native[0][0] > this.latest.native[0][0]) this.latest = row;
    }
  }
  score(row) {
    const a = row.native[0],
      b = row.native[2];
    return Math.max(
      row.callback?.wall ?? 0,
      row.recording?.snapWallMs ?? 0,
      ...Object.values(row.source).map((v) => v[2]),
      a && b ? b[0] - a[0] : 0,
    );
  }
  remember(row) {
    if (!row) return;
    if (!this.slow.includes(row)) this.slow.push(row);
    this.slow.sort((a, b) => this.score(b) - this.score(a));
    this.slow.length = Math.min(6, this.slow.length);
  }
  report(clock) {
    for (const row of this.rows.values()) this.remember(row);
    const distributions = {},
      means = {},
      workCounts = {},
      callbacks = new Map(),
      movingCallbacks = new Map(),
      values = new Map(),
      counts = new Map();
    const add = (name, value, target = values) => {
      if (Number.isFinite(value) && value >= 0) {
        let rows = target.get(name);
        if (!rows) target.set(name, (rows = []));
        rows.push(value);
      }
    };
    for (const row of this.rows.values()) {
      if (!row.native[0] || !row.native[2]) continue;
      if (row.callback) {
        callbacks.set(row.callback.id, row.callback);
        const age = row.native[0][0] + (clock?.offsetToJs ?? NaN) - row.native[0][5];
        if (row.native[0][5] > 0 && age >= 0 && age <= 100)
          movingCallbacks.set(row.callback.id, row.callback);
      }
      if (row.timing) {
        add('clock-wake-lateness', row.timing.tick - row.timing.frameStart);
        add('clock-dispatch-queue', row.timing.queueDelay);
      }
      for (const [stage, value] of Object.entries(row.source)) {
        add(stage, value[2]);
        add(stage, value[4], counts);
      }
      add('submitted-to-surface', row.native[2][0] - row.native[0][0]);
      if (row.native[1]) {
        add('submitted-to-producer', row.native[1][0] - row.native[0][0]);
        add('producer-to-surface', row.native[2][0] - row.native[1][0]);
      }
      if (row.native[20] && row.native[21] && row.native[1]) {
        add('submitted-to-worker', row.native[20][0] - row.native[0][0]);
        add('native-producer-worker', row.native[21][0] - row.native[20][0]);
        add('worker-to-ui-producer', row.native[1][0] - row.native[21][0]);
      }
      for (const [stage, name] of [
        [22, 'producer-import'],
        [23, 'producer-replay-submit'],
        [24, 'producer-completion-wait'],
        [25, 'producer-finish'],
        [26, 'producer-context'],
      ])
        if (row.native[stage]) add(name, row.native[stage][3] / 1000);
    }
    for (const value of callbacks.values()) {
      add('owned-callback', value.wall);
      add('owned-callback-to-microtask', value.checkpointDelay);
      if (Number.isFinite(value.inputWall)) {
        add('owned-input-dispatch', value.inputWall);
        add('owned-callback-outside-input', Math.max(0, value.wall - value.inputWall));
      }
    }
    const ordered = [...callbacks.values()].sort((a, b) => a.begin - b.begin);
    for (let index = 1; index < ordered.length; index++) {
      add('source-callback-interval', ordered[index].begin - ordered[index - 1].begin);
      add('source-callback-between', ordered[index].begin - ordered[index - 1].end);
    }
    const moving = [...movingCallbacks.values()].sort((a, b) => a.begin - b.begin);
    for (const callback of moving) add('recent-input-callback', callback.wall);
    for (let index = 1; index < moving.length; index++) {
      add('recent-input-callback-interval', moving[index].begin - moving[index - 1].begin);
      add('recent-input-callback-between', moving[index].begin - moving[index - 1].end);
    }
    for (const [source, target] of [
      [values, distributions],
      [counts, workCounts],
    ])
      for (const [name, rows] of source) {
        rows.sort((a, b) => a - b);
        const n = rows.length;
        target[name] = {
          n,
          p50: rows[Math.floor(n * 0.5)],
          p95: rows[Math.floor(n * 0.95)],
          max: rows[n - 1],
        };
        if (target === distributions) means[name] = rows.reduce((sum, value) => sum + value, 0) / n;
      }
    return {
      schema: 1,
      type: 'rnw-frame-probe',
      qualification: 'diagnostic-only',
      sourceClock: 'performance.now',
      nativeClock: 'QPC milliseconds',
      clock,
      sourceColumns: ['firstBegin', 'lastEnd', 'sumDuration', 'samples', 'count', 'bytes'],
      nativeColumns: [
        'timestamp',
        'submission',
        'nativeView',
        'width',
        'height',
        'inputTimestampJs',
        'tickJs',
        'uncertainty',
      ],
      nativeStages: {
        0: 'submitted',
        1: 'producer-complete',
        2: 'surface-updated',
        3: 'retired',
        4: 'superseded',
        5: 'failed',
        20: 'producer-worker-begin',
        21: 'producer-worker-end',
        22: 'producer-import-us',
        23: 'producer-replay-submit-us',
        24: 'producer-completion-wait-us',
        25: 'producer-finish-us',
        26: 'producer-context-us',
      },
      sourceSamples: this.sourceSamples,
      nativeSamples: this.nativeSamples,
      nativeOutcomeCounts: [...this.nativeOutcomeCounts],
      joinedFrames: this.joined,
      retainedFrames: this.rows.size,
      retainedDistributions: distributions,
      retainedMeans: means,
      retainedWorkCounts: workCounts,
      cumulativeWorkCounts: Object.fromEntries(
        Object.entries(this.workTotals).map(([name, value]) => [name, { ...value }]),
      ),
      evictedFrames: this.evicted,
      invalid: this.invalid,
      slowFrames: this.slow,
      latestFrame: this.latest ?? null,
      detailPriority:
        'maximum source-stage wall, owned callback wall, snap wall or submitted-to-surface interval; overlaps and waiting are not added',
      callbackScope:
        'maximum observed owned callback among this frame source contributions; not a sum across frames/callbacks',
      callbackInputScope:
        'input-dispatch is included in owned callback wall; summed once during callback drain, including frame-zero input rows that have no native submission',
      callbackCheckpointScope:
        'owner callback drain to its queued microtask; includes subsequent native polling and queued jobs, not isolated React/GC CPU time',
      callbackCadenceScope:
        'intervals between observed source-contributing callbacks for retained surface-updated frames; between includes other callbacks, discarded work and scheduling, not isolated idle time',
      recentInputCadenceScope:
        'same retained callback observations filtered to submissions within 100ms of their last Core input; gaps can include other work and observation omissions; not a surface FPS measurement',
      callbackWorkScope:
        'fixture wrappers; categories overlap; total excludes nested calls of the same category; top 4 constructor.name labels may be minified and collide, columns calls/inclusiveWall/selfWall/maxWall; not GC attribution',
      nativeSlotColumns: ['context', 'reserved', 'recordings', 'queued', 'consuming'],
      gpuExecution: 'unobserved; submitted-to-producer includes queue and work',
      producerWorkerScope:
        'native producer worker wall includes native driver/waiting; independent GPU execution remains unobserved',
      producerPhaseScope:
        'stages 22..26 encode wall duration in microseconds in width, height=0; import, replay/submit, completion wait, finish and context preparation are not independent GPU timestamps',
      individualGcPause: 'unobserved',
      physicalInputAccepted: 'notVerified',
      displayed: 'unobserved',
      performanceAccepted: false,
    };
  }
}
