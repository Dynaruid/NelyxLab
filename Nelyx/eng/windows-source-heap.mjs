// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const uint64 = (value) => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value))
    throw Error('Heap counter is not an exact unsigned decimal');
  const result = BigInt(value);
  if (result > 0xffffffffffffffffn) throw Error('Heap counter exceeds uint64');
  return result;
};
const count = (value) => {
  if (!Number.isSafeInteger(value) || value < 0) throw Error('Heap observation count is invalid');
  return value;
};
const tolerance = (at) => Math.max(1e-8, Math.abs(at) * Number.EPSILON * 4);
const summaries = (rows) => ({
  intervals: rows.length,
  elapsedMs: rows.reduce((total, row) => total + row.elapsedMs, 0),
  allocatedBytes: rows.reduce((total, row) => total + BigInt(row.allocatedBytes), 0n).toString(),
  collections: rows.reduce((total, row) => total + BigInt(row.collections), 0n).toString(),
  maximumIntervalBytes: rows
    .reduce((maximum, row) => {
      const value = BigInt(row.allocatedBytes);
      return value > maximum ? value : maximum;
    }, 0n)
    .toString(),
});

/** Exact cumulative counter differences on one App owner. Source is a nested
 * scope and Scene includes async continuations: categories must not be added
 * together or interpreted as CPU time, object counts or live retained bytes. */
export function sourceHeap({ heap, app }) {
  if (
    heap?.schema !== 'nelyx.windows.app-heap-clock/v1' ||
    heap.domain !== 'qpc-milliseconds' ||
    heap.capacity !== 2048 ||
    !Number.isFinite(heap.started) ||
    !Number.isFinite(heap.ended) ||
    heap.ended < heap.started ||
    !Number.isFinite(heap.maximumProbeMs) ||
    !Number.isFinite(heap.totalProbeMs) ||
    heap.maximumProbeMs < 0 ||
    heap.totalProbeMs < heap.maximumProbeMs ||
    !Array.isArray(heap.points) ||
    heap.points.length > heap.capacity
  )
    throw Error('Heap clock schema, domain, window or bound differs');
  const through = count(heap.through),
    dropped = count(heap.dropped),
    invalid = count(heap.invalid),
    failed = count(heap.failed);
  if (through !== heap.points.length + dropped + invalid + failed)
    throw Error('Heap clock sample accounting differs');
  const points = heap.points.map((row) => {
    if (
      !Array.isArray(row) ||
      row.length !== 7 ||
      !Number.isFinite(row[0]) ||
      !Number.isFinite(row[1]) ||
      row[0] < heap.started ||
      row[1] < row[0] ||
      row[1] > heap.ended
    )
      throw Error('Heap clock point is outside its native window');
    return { at: row[0], until: row[1], values: row.slice(2).map(uint64) };
  });
  for (let i = 1; i < points.length; ++i) {
    const before = points[i - 1],
      after = points[i];
    if (
      after.at < before.until ||
      after.values[0] < before.values[0] ||
      after.values[1] < before.values[1]
    )
      throw Error('Heap clock or cumulative counters are not monotonic');
  }
  const exact = new Map();
  for (const point of points) exact.set(point.at, exact.has(point.at) ? null : point);
  const endpoint = (at) => {
    if (exact.has(at)) {
      const point = exact.get(at);
      return point ? { point, errorMs: 0 } : { reason: 'ambiguous-clock' };
    }
    const candidates = points.filter((point) => Math.abs(point.at - at) <= tolerance(at));
    return candidates.length === 1
      ? { point: candidates[0], errorMs: Math.abs(candidates[0].at - at) }
      : { reason: candidates.length ? 'ambiguous-clock' : 'missing-clock-point' };
  };
  const rows = { build: [], capture: [], scene: [], source: [], element: [] },
    missing = { build: {}, capture: {}, scene: {}, source: {}, element: {} },
    outside = { build: 0, capture: 0, scene: 0, source: 0, element: 0 };
  const add = (kind, started, elapsedMs, context, domain) => {
    const omit = (reason) => (missing[kind][reason] = (missing[kind][reason] ?? 0) + 1);
    if (domain !== heap.domain) return omit('clock-domain-mismatch');
    if (!Number.isFinite(started) || started <= 0 || !Number.isFinite(elapsedMs) || elapsedMs < 0)
      return omit('missing-or-invalid-boundary');
    if (elapsedMs === 0) return omit('zero-duration');
    const ended = started + elapsedMs;
    if (ended < heap.started || started > heap.ended) {
      ++outside[kind];
      return;
    }
    if (started < heap.started || ended > heap.ended) return omit('crosses-profile-boundary');
    const from = endpoint(started),
      to = endpoint(ended);
    if (from.reason || to.reason) return omit(from.reason ?? to.reason);
    if (to.point.at <= from.point.at) return omit('unresolved-interval');
    const delta = to.point.values.map((value, index) => value - from.point.values[index]);
    rows[kind].push({
      ...context,
      started,
      elapsedMs,
      allocatedBytes: delta[0].toString(),
      collections: delta[1].toString(),
      heapAllocatedChange: delta[2].toString(),
      heapCapacityChange: delta[3].toString(),
      externalBytesChange: delta[4].toString(),
      maximumClockErrorMs: Math.max(from.errorMs, to.errorMs),
      counterWindowMs: {
        minimum: to.point.at - from.point.until,
        maximum: to.point.until - from.point.at,
      },
    });
  };
  if (!Array.isArray(app?.samples) || app.samples.length > 128)
    throw Error('App timing samples exceed their retained bound');
  for (const sample of app.samples)
    for (const kind of ['build', 'capture', 'scene'])
      add(
        kind,
        sample[kind + 'Started'],
        sample[kind + 'Ms'],
        { pass: sample.pass, input: sample.input, created: sample.projection?.created },
        app.domain,
      );
  const source = app.sourcePreparation;
  if (source) {
    if (!Array.isArray(source.samples) || source.samples.length > 128)
      throw Error('Source preparation samples exceed their retained bound');
    for (const sample of source.samples)
      add(
        'source',
        sample.started,
        sample.elapsedMs,
        {
          sequence: sample.sequence,
          kind: sample.kind,
          input: sample.target?.input,
          capturePass: sample.capturePass,
          result: sample.result,
        },
        source.clockDomain,
      );
  }
  const elements = app.elementProfile;
  let elementTypes;
  if (elements) {
    if (
      elements.schema !== 'nelyx.app.source-element-profile/v1' ||
      elements.capacity !== 512 ||
      elements.typeCapacity !== 128 ||
      elements.scope !== 'flushed-dirty-element-rebuild' ||
      elements.sampling !== 'first-two-per-constructor-and-empty-or-populated-children' ||
      !Array.isArray(elements.samples) ||
      elements.samples.length > 512 ||
      !Array.isArray(elements.types) ||
      elements.types.length > 128
    )
      throw Error('Source Element profile schema or retained bound differs');
    for (const key of ['calls', 'unclassified', 'limited', 'failures']) count(elements[key]);
    elementTypes = new Map();
    for (const type of elements.types) {
      if (
        !Number.isSafeInteger(type.id) ||
        type.id < 1 ||
        type.id > 128 ||
        elementTypes.has(type.id) ||
        typeof type.name !== 'string' ||
        type.name.length > 128 ||
        count(type.empty) > 2 ||
        count(type.populated) > 2
      )
        throw Error('Source Element constructor classification differs');
      count(type.calls);
      elementTypes.set(type.id, type);
    }
    const sequences = new Set();
    for (const sample of elements.samples) {
      if (
        !Number.isSafeInteger(sample.sequence) ||
        sample.sequence < 1 ||
        sample.sequence > 512 ||
        sequences.has(sample.sequence) ||
        !elementTypes.has(sample.type) ||
        !Number.isSafeInteger(sample.childrenBefore) ||
        sample.childrenBefore < 0 ||
        typeof sample.complete !== 'boolean'
      )
        throw Error('Source Element sample classification differs');
      sequences.add(sample.sequence);
      if (!sample.complete) {
        missing.element.incomplete = (missing.element.incomplete ?? 0) + 1;
        continue;
      }
      const containing = rows.source.filter(
        (row) =>
          row.started <= sample.started &&
          row.started + row.elapsedMs >= sample.started + sample.elapsedMs,
      );
      add(
        'element',
        sample.started,
        sample.elapsedMs,
        {
          sequence: sample.sequence,
          type: sample.type,
          widget: elementTypes.get(sample.type).name,
          childrenBefore: sample.childrenBefore,
          ...(containing.length === 1 ? { sourceSequence: containing[0].sequence } : {}),
        },
        elements.domain,
      );
    }
    let classified = 0;
    for (const type of elementTypes.values()) {
      const samples = elements.samples.filter((sample) => sample.type === type.id);
      if (
        samples.filter((sample) => sample.childrenBefore === 0).length !== type.empty ||
        samples.filter((sample) => sample.childrenBefore > 0).length !== type.populated ||
        type.calls < samples.length
      )
        throw Error('Source Element sample accounting differs');
      classified += type.calls;
    }
    if (classified + elements.unclassified > elements.calls)
      throw Error('Source Element call accounting differs');
  }
  const top = (values) =>
    values
      .slice()
      .sort((a, b) => {
        const left = BigInt(a.allocatedBytes),
          right = BigInt(b.allocatedBytes);
        return left > right ? -1 : left < right ? 1 : a.started - b.started;
      })
      .slice(0, 12);
  return {
    diagnosticOnly: true,
    domain: heap.domain,
    scope: 'retained-owner-intervals-inside-profile',
    categoriesOverlap: true,
    sceneScope: 'async-owner-allocation',
    collectionScope: 'counter-completions-between-native-read-brackets',
    probeTimingScope: 'stored-points-only',
    observation: {
      started: heap.started,
      ended: heap.ended,
      capacity: heap.capacity,
      through,
      stored: points.length,
      dropped,
      invalid,
      failed,
      maximumProbeMs: heap.maximumProbeMs,
      totalProbeMs: heap.totalProbeMs,
    },
    appSamplesOverwritten: app.samplesOverwritten ?? 0,
    sourceSamplesOverwritten: source?.samplesOverwritten ?? 0,
    ...(elements
      ? {
          elementProfile: {
            scope: elements.scope,
            sampling: elements.sampling,
            calls: elements.calls,
            unclassified: elements.unclassified,
            limited: elements.limited,
            failures: elements.failures,
            retained: elements.samples.length,
            types: [...elementTypes.values()].map((type) => ({
              ...type,
              matched: summaries(rows.element.filter((row) => row.type === type.id)),
            })),
          },
        }
      : {}),
    outsideProfile: outside,
    missing,
    stages: Object.fromEntries(
      Object.entries(rows).map(([kind, values]) => [kind, summaries(values)]),
    ),
    largestIntervals: Object.fromEntries(
      Object.entries(rows).map(([kind, values]) => [kind, top(values)]),
    ),
    performanceAccepted: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const chunks = [],
      buffer = Buffer.alloc(65536);
    let bytes = 0,
      length;
    while ((length = fs.readSync(0, buffer, 0, buffer.length, null))) {
      bytes += length;
      if (bytes > 4 * 1024 * 1024) throw Error('Heap join input exceeds 4 MiB');
      chunks.push(Buffer.from(buffer.subarray(0, length)));
    }
    // Windows PowerShell may emit a BOM for both its text and native stream.
    const input = Buffer.concat(chunks)
      .toString('utf8')
      .replace(/^\uFEFF+/, '');
    console.log(JSON.stringify(sourceHeap(JSON.parse(input))));
  } catch (error) {
    // A failed stdin parse must not echo an entire heap/App diagnostic.
    console.error('App heap join: ' + String(error.message ?? error).slice(0, 300));
    process.exitCode = 1;
  }
}
