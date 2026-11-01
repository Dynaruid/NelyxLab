// SPDX-License-Identifier: BSD-3-Clause
// Bounded scalar joins for the opt-in, actual RNW diagnostic fixture.
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const key = (v) => [v.owner, v.viewport, v.context, v.surface, v.frame, v.input].join(':');
const validIdentity = (v) =>
  ['owner', 'viewport', 'context', 'surface', 'frame', 'input'].every((name) => integer(v[name]));

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
      (!Object.hasOwn(row.source, sample.stage) && Object.keys(row.source).length >= 48) ||
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
      entry.stage > 5 ||
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
    this.nativeOutcomeCounts[entry.stage]++;
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
      },
      sourceSamples: this.sourceSamples,
      nativeSamples: this.nativeSamples,
      nativeOutcomeCounts: [...this.nativeOutcomeCounts],
      joinedFrames: this.joined,
      retainedFrames: this.rows.size,
      evictedFrames: this.evicted,
      invalid: this.invalid,
      slowFrames: this.slow,
      latestFrame: this.latest ?? null,
      detailPriority:
        'maximum source-stage wall, owned callback wall, snap wall or submitted-to-surface interval; overlaps and waiting are not added',
      callbackScope:
        'maximum observed owned callback among this frame source contributions; not a sum across frames/callbacks',
      callbackWorkScope:
        'fixture wrappers; categories overlap; total excludes nested calls of the same category; top 4 constructor.name labels may be minified and collide, columns calls/inclusiveWall/selfWall/maxWall; not GC attribution',
      nativeSlotColumns: ['context', 'reserved', 'recordings', 'queued', 'consuming'],
      gpuExecution: 'unobserved; submitted-to-producer includes queue and work',
      individualGcPause: 'unobserved',
      physicalInputAccepted: 'notVerified',
      displayed: 'unobserved',
      performanceAccepted: false,
    };
  }
}
