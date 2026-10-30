// SPDX-License-Identifier: BSD-3-Clause
// Shared by the in-VM diagnostic and its Node verifier. No Node or host imports.
const requireValue = (value, message) => {
  if (!value) throw Error(message);
};
const counter = (value) => Number.isSafeInteger(value) && value >= 0;
export function analyseNativeInputWindow(before, after, { pacing }) {
  requireValue(pacing === 'os' || pacing === 'programmatic', 'Unknown diagnostic input pacing');
  requireValue(
    before?.foreground === true && after?.foreground === true,
    'Foreground changed during native measurement',
  );
  for (const key of ['focusChanges', 'keyboardMessages', 'semanticsActions'])
    requireValue(
      counter(before[key]) && counter(after[key]) && before[key] === after[key],
      'Native ' + key + ' changed during measurement',
    );
  requireValue(
    counter(before.lastInputTick) && counter(after.lastInputTick),
    'Desktop input observation unavailable',
  );
  if (pacing === 'programmatic')
    requireValue(
      before.lastInputTick === after.lastInputTick &&
        before.cursorParked === true &&
        after.cursorParked === true,
      'Desktop input or parked cursor changed during programmatic measurement',
    );
  const capture = (state) =>
    Object.fromEntries(
      [
        'foreground',
        'focusChanges',
        'keyboardMessages',
        'semanticsActions',
        'lastInputTick',
        'cursorParked',
      ].map((key) => [key, state[key]]),
    );
  return {
    scope:
      'native foreground, focus, keyboard and UIA action boundary; pointer receipts are separate',
    pacing,
    before: capture(before),
    after: capture(after),
  };
}
export function distribution(values) {
  return timingDistribution(values, false);
}
function timingDistribution(values, signed) {
  requireValue(
    values.every((value) => Number.isFinite(value) && (signed || value >= 0)),
    'Invalid timing sample',
  );
  const sorted = [...values].sort((a, b) => a - b),
    n = sorted.length,
    at = (p) => (n ? sorted[Math.min(n - 1, Math.floor(n * p))] : null);
  return {
    n,
    sum: sorted.reduce((a, b) => a + b, 0),
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: n ? sorted[n - 1] : null,
  };
}
/** Lazy child measurement can change the extent during animateTo. Accept only
 * the requested position or its current extent clamp, never arbitrary progress. */
export function nativeScrollTargetState(positions, targets) {
  requireValue(
    Array.isArray(positions) &&
      Array.isArray(targets) &&
      positions.length > 0 &&
      positions.length === targets.length,
    'Invalid scroll targets',
  );
  return positions.map((position, index) => {
    const { offset, minimum, maximum } = position,
      requested = targets[index];
    requireValue(
      [offset, minimum, maximum, requested].every(Number.isFinite) && minimum <= maximum,
      'Invalid scroll extent',
    );
    const effective = Math.max(minimum, Math.min(maximum, requested));
    return {
      offset,
      minimum,
      maximum,
      requested,
      effective,
      reached: Math.abs(offset - effective) < 0.05,
    };
  });
}
export function readHermesGCStats(text) {
  // The pinned Hermes Instrumentation port returns a textual heading followed
  // by a JSON object, rather than a bare JSON document. These are cumulative
  // mutator pause statistics, not a per-collection or per-frame pause trace.
  const marker = 'GC stats:\n',
    at = typeof text === 'string' ? text.lastIndexOf(marker) : -1;
  requireValue(at >= 0, 'Hermes GC statistics were not enabled');
  const stats = JSON.parse(text.slice(at + marker.length));
  requireValue(
    stats.type === 'hermes' && stats.version === 0 && stats.general && stats.specific?.collector,
    'Hermes GC statistics contract differs',
  );
  const result = {
    scope: 'runtime-cumulative-mutator-pauses',
    collector: stats.specific.collector,
  };
  for (const key of ['numCollections', 'totalAllocatedBytes']) {
    const value = stats.general[key];
    requireValue(counter(value), 'Invalid Hermes GC counter');
    result[key] = value;
  }
  for (const key of ['totalGCTime', 'totalGCCPUTime', 'maxGCPause', 'maxGCCPUPause']) {
    const value = stats.general[key];
    requireValue(Number.isFinite(value) && value >= 0, 'Invalid Hermes GC duration');
    result[key + 'Ms'] = value * 1000;
  }
  return result;
}
export function readHermesSamplingProfile(text) {
  requireValue(
    typeof text === 'string' && text.length <= 8 * 1024 * 1024,
    'Invalid sampling trace size',
  );
  const trace = JSON.parse(text),
    frames = trace.stackFrames;
  requireValue(
    Array.isArray(trace.samples) &&
      trace.samples.length <= 50000 &&
      frames &&
      typeof frames === 'object' &&
      !Array.isArray(frames) &&
      Object.keys(frames).length <= 65536,
    'Invalid Hermes sampling trace',
  );
  const groups = new Map(),
    functions = new Map(),
    categories = new Map();
  let observations = 0;
  const group = (id) => {
    const frame = frames[id];
    requireValue(
      frame &&
        typeof frame.name === 'string' &&
        frame.name.length <= 8192 &&
        typeof frame.category === 'string',
      'Invalid sampling frame',
    );
    let g = groups.get(id);
    if (!g) {
      const caller = frames[frame.parent];
      g = {
        frame: id,
        name: frame.name,
        category: frame.category,
        line: frame.line ?? null,
        column: frame.column ?? null,
        funcLine: frame.funcLine ?? null,
        funcColumn: frame.funcColumn ?? null,
        funcVirtAddr: frame.funcVirtAddr ?? null,
        offset: frame.offset ?? null,
        ...(caller
          ? {
              caller: {
                name: caller.name,
                category: caller.category,
                line: caller.line ?? null,
                column: caller.column ?? null,
                funcLine: caller.funcLine ?? null,
                funcColumn: caller.funcColumn ?? null,
              },
            }
          : {}),
        self: 0,
        inclusive: 0,
      };
      groups.set(id, g);
    }
    return g;
  };
  for (const sample of trace.samples) {
    const weight = Number(sample.weight);
    requireValue(
      counter(sample.sf) &&
        sample.sf > 0 &&
        Number.isSafeInteger(weight) &&
        weight > 0 &&
        weight <= 50000,
      'Invalid sampling observation',
    );
    observations += weight;
    let id = String(sample.sf),
      depth = 0;
    const seen = new Set(),
      seenFunctions = new Set();
    while (id !== undefined) {
      requireValue(++depth <= 1024 && !seen.has(id), 'Cyclic sampling stack');
      seen.add(id);
      const g = group(id);
      g.inclusive += weight;
      const name = g.funcLine !== null ? g.name.replace(/:[0-9]+:[0-9]+\)$/, '') + ')' : g.name,
        key = JSON.stringify([g.category, name, g.funcLine, g.funcColumn, g.funcVirtAddr]);
      let fn = functions.get(key);
      if (!fn) {
        fn = {
          name,
          category: g.category,
          funcLine: g.funcLine,
          funcColumn: g.funcColumn,
          funcVirtAddr: g.funcVirtAddr,
          self: 0,
          inclusive: 0,
        };
        functions.set(key, fn);
      }
      if (!seenFunctions.has(key)) {
        seenFunctions.add(key);
        fn.inclusive += weight;
      }
      if (depth === 1) {
        g.self += weight;
        fn.self += weight;
        categories.set(g.category, (categories.get(g.category) ?? 0) + weight);
      }
      const parent = frames[id].parent;
      requireValue(
        parent === undefined || (counter(parent) && parent > 0),
        'Invalid sampling parent',
      );
      id = parent === undefined ? undefined : String(parent);
    }
  }
  requireValue(Number.isSafeInteger(observations), 'Invalid sampling weight total');
  const top = (key) =>
    [...groups.values()]
      .filter((g) => g.category !== 'root' && g[key] > 0)
      .sort((a, b) => b[key] - a[key])
      .slice(0, 30);
  const functionTop = (key) =>
    [...functions.values()]
      .filter((g) => g.category !== 'root' && g[key] > 0)
      .sort((a, b) => b[key] - a[key])
      .slice(0, 30);
  return {
    scope: 'Hermes PC sampling; weights are observations, not CPU milliseconds',
    frequencyHz: 1000,
    samples: trace.samples.length,
    observations,
    categories: Object.fromEntries(categories),
    self: top('self'),
    inclusive: top('inclusive'),
    functionSelf: functionTop('self'),
    functionInclusive: functionTop('inclusive'),
  };
}
function unpack(buffer, stride) {
  requireValue(
    buffer instanceof ArrayBuffer &&
      buffer.byteLength % (stride * 8) === 0 &&
      buffer.byteLength <= 16384 * stride * 8,
    'Invalid native trace buffer',
  );
  const words = new Float64Array(buffer),
    rows = [];
  for (let at = 0; at < words.length; at += stride) {
    const row = Array.from(words.subarray(at, at + stride));
    requireValue(row.every(Number.isFinite), 'Non-finite native receipt');
    rows.push(row);
  }
  return rows;
}
export function analyseNativeFrameTurns(trace, frames, { begin = -Infinity, end = Infinity } = {}) {
  requireValue(
    trace?.schema === 1 &&
      trace.clock === 'qpc-ms' &&
      trace.turnStride === 8 &&
      trace.lostTurns === 0,
    'Native frame turn trace differs or overflowed',
  );
  const turns = unpack(trace.turns, 8);
  let previous = 0,
    previousEnd = 0;
  for (const t of turns) {
    requireValue(
      t.slice(0, 3).every(counter) &&
        t[0] > 0 &&
        t[1] > 0 &&
        counter(t[7]) &&
        t[3] >= 0 &&
        t[4] >= t[3] &&
        t[5] >= t[4] &&
        t[6] >= t[5] &&
        t[4] >= previousEnd,
      'Invalid native frame turn',
    );
    requireValue(
      !previous || t[0] === previous + 1,
      'Native frame turn sequence has a gap or duplicate',
    );
    previous = t[0];
    previousEnd = t[6];
  }
  const eligible = turns.filter((t) => t[4] >= begin && t[6] <= end),
    built = new Set();
  requireValue(
    new Set(eligible.map((t) => t[1])).size <= 1,
    'Viewport changed during native frame turns',
  );
  for (const f of frames) {
    requireValue(
      Number.isFinite(f.begin) && Number.isFinite(f.end) && f.begin <= f.end,
      'Invalid callback clock',
    );
    const turn = eligible.find((t) => f.begin >= t[4] && f.end <= t[5]);
    requireValue(turn, 'A built callback has no complete native checkpoint receipt');
    built.add(turn);
  }
  const selected = [...built];
  return {
    scope: 'compositor-callbacks-and-following-checkpoint-wall; input-dispatch-reported-separately',
    builtCallbacks: frames.length,
    builtTurns: selected.length,
    idleTurns: eligible.length - selected.length,
    wall: distribution(selected.map((t) => t[6] - t[4])),
    checkpoint: distribution(selected.map((t) => t[6] - t[5])),
    queue: distribution(selected.map((t) => t[4] - t[3])),
  };
}
/** Join a host work prediction to its CPU callback and matching surface copy.
 * Missing/unsubmitted frames stay explicit; none of these events prove scanout. */
export function analyseNativeFrameDeadlines(trace, frames) {
  requireValue(
    trace?.schema === 1 &&
      trace.clock === 'qpc-ms' &&
      trace.surfaceStride === 11 &&
      trace.lostSurfaces === 0 &&
      Array.isArray(frames) &&
      frames.length <= 16384,
    'Invalid deadline trace',
  );
  const copied = new Map();
  for (const row of unpack(trace.surfaces, 11)) {
    requireValue(
      counter(row[4]) && row[4] > 0 && row[10] >= 0,
      'Invalid deadline surface identity',
    );
    if (!copied.has(row[4])) copied.set(row[4], row[10]);
  }
  const seen = new Set(),
    readySlack = [],
    surfaceSlack = [],
    intervals = [],
    sources = {};
  let eligible = 0,
    missingCopy = 0,
    readyMisses = 0,
    surfaceMisses = 0;
  for (const frame of frames) {
    requireValue(
      counter(frame.sequence) &&
        frame.sequence > 0 &&
        !seen.has(frame.sequence) &&
        Number.isFinite(frame.end),
      'Invalid or duplicate deadline frame',
    );
    seen.add(frame.sequence);
    const timing = frame.timing;
    const source = timing?.timingSource ?? 'unobserved';
    requireValue(
      ['dwm-predicted', 'timer-fallback', 'unobserved'].includes(source),
      'Invalid deadline source',
    );
    sources[source] = (sources[source] ?? 0) + 1;
    if (Number.isFinite(timing?.refreshInterval)) intervals.push(timing.refreshInterval);
    if (timing?.observedDeadline === undefined) continue;
    requireValue(
      source === 'dwm-predicted' &&
        Number.isFinite(timing.observedDeadline) &&
        Number.isFinite(timing.dispatch) &&
        Number.isFinite(timing.clockUncertainty) &&
        timing.clockUncertainty >= 0 &&
        timing.observedDeadline > timing.dispatch,
      'Invalid host deadline',
    );
    eligible++;
    readySlack.push(timing.observedDeadline - frame.end);
    if (frame.end - timing.clockUncertainty > timing.observedDeadline) readyMisses++;
    const at = copied.get(frame.sequence);
    if (at === undefined) missingCopy++;
    else {
      surfaceSlack.push(timing.observedDeadline - at);
      if (at - timing.clockUncertainty > timing.observedDeadline) surfaceMisses++;
    }
  }
  return {
    scope: 'host-work-prediction-to-callback-and-matching-surface-copy',
    built: frames.length,
    eligible,
    withoutPrediction: frames.length - eligible,
    missingCopy,
    sources,
    refreshInterval: distribution(intervals),
    readySlack: timingDistribution(readySlack, true),
    surfaceSlack: timingDistribution(surfaceSlack, true),
    readyMisses,
    surfaceMisses,
    missRule: 'event minus clock uncertainty is later than target; missing copies are separate',
    displayed: 'unobserved',
    performanceAccepted: false,
  };
}
export function analyseNativeFrameTrace(
  trace,
  { begin = -Infinity, end = Infinity, coreBaseline = 0, changedCoreSequences } = {},
) {
  requireValue(
    trace?.schema === 1 &&
      trace.clock === 'qpc-ms' &&
      trace.completion === 'surface-copy-fence-observed' &&
      trace.displayed === 'unobserved' &&
      trace.inputStride === 10 &&
      trace.surfaceStride === 11,
    'Native trace contract differs',
  );
  requireValue(
    counter(trace.lostInputs) &&
      counter(trace.lostSurfaces) &&
      !trace.lostInputs &&
      !trace.lostSurfaces,
    'Native receipt overflow invalidates the sample',
  );
  requireValue(begin < end && counter(coreBaseline), 'Invalid phase boundary');
  const rawInputs = unpack(trace.inputs, 10),
    rawSurfaces = unpack(trace.surfaces, 11);
  let nativePrevious = 0,
    corePrevious;
  for (const p of rawInputs) {
    requireValue(
      p.slice(0, 4).every(counter) && p[0] > 0 && p[3] <= 10 && (p[9] === 0 || p[9] === 1),
      'Invalid native input identity',
    );
    requireValue(
      !nativePrevious || p[0] === nativePrevious + 1,
      'Native input sequence has a gap or duplicate',
    );
    nativePrevious = p[0];
    requireValue(p[4] >= 0 && p[5] >= p[4] && p[6] >= p[5], 'Native input clock is reversed');
    if (p[9]) {
      requireValue(
        p[1] > 0 && (corePrevious === undefined || p[1] === corePrevious + 1),
        'Accepted Core sequence has a gap or duplicate',
      );
      corePrevious = p[1];
    } else requireValue(p[1] === 0, 'Rejected input acquired a Core identity');
  }
  let surfacePrevious = 0;
  for (const f of rawSurfaces) {
    requireValue(
      f.slice(0, 10).every(counter) &&
        f[0] > 0 &&
        f[1] > 0 &&
        f[2] > 0 &&
        f[3] > 0 &&
        f[4] > 0 &&
        f[6] > 0 &&
        f[7] > 0 &&
        f[8] > 0 &&
        f[9] > 0 &&
        f[10] >= 0,
      'Invalid native surface identity',
    );
    requireValue(
      !surfacePrevious || f[0] === surfacePrevious + 1,
      'Surface sequence has a gap or duplicate',
    );
    surfacePrevious = f[0];
  }
  const inputs = rawInputs.filter((p) => p[4] >= begin && p[4] <= end),
    surfaces = rawSurfaces.filter((f) => f[10] >= begin && f[10] <= end),
    accepted = inputs.filter((p) => p[9] === 1),
    rejected = inputs.length - accepted.length;
  const viewports = new Set([...inputs.map((p) => p[2]), ...surfaces.map((f) => f[3])]);
  requireValue(viewports.size <= 1, 'Viewport changed inside the sample');
  for (const index of [1, 2, 7, 8, 9])
    requireValue(
      new Set(surfaces.map((f) => f[index])).size <= 1,
      'Owner, context or surface dimensions changed inside the sample',
    );
  const maximumCore = Math.max(coreBaseline, ...accepted.map((p) => p[1]));
  requireValue(
    surfaces.every((f) => f[5] <= maximumCore),
    'Surface contains untracked Core input',
  );
  const changed = changedCoreSequences === undefined ? null : new Set(changedCoreSequences);
  if (changed)
    for (const core of changed)
      requireValue(
        accepted.some((p) => p[1] === core && p[3] === 4),
        'Offset change has no accepted native wheel receipt',
      );
  const eligible = accepted.filter((p) => p[3] === 4 && (!changed || changed.has(p[1]))),
    mapped = new Set(),
    oldest = [],
    latest = [];
  let covered = coreBaseline;
  for (const f of surfaces) {
    requireValue(f[5] >= covered, 'Surface input identity moved backwards');
    covered = f[5];
    const batch = eligible.filter((p) => p[1] <= f[5] && !mapped.has(p[1]));
    if (!batch.length) continue;
    const first = Math.min(...batch.map((p) => p[4])),
      last = Math.max(...batch.map((p) => p[4]));
    requireValue(f[10] >= last, 'Surface precedes its contributing input');
    oldest.push(f[10] - first);
    latest.push(f[10] - last);
    for (const p of batch) mapped.add(p[1]);
  }
  const wheel = inputs.filter((p) => p[3] === 4),
    deliveredWheel = wheel.filter((p) => p[9] === 1),
    sum = (rows) => rows.reduce((value, p) => value + p[8], 0),
    absolute = (rows) => rows.reduce((value, p) => value + Math.abs(p[8]), 0);
  return {
    schema: 1,
    displayed: 'unobserved',
    performanceAccepted: false,
    receiptIntegrity: rejected === 0 && mapped.size === eligible.length,
    input: {
      received: inputs.length,
      accepted: accepted.length,
      rejected,
      firstNative: inputs[0]?.[0] ?? null,
      lastNative: inputs.at(-1)?.[0] ?? null,
      receivedWheelY: sum(wheel),
      receivedAbsoluteWheelY: absolute(wheel),
      acceptedWheelY: sum(deliveredWheel),
      acceptedAbsoluteWheelY: absolute(deliveredWheel),
      queue: distribution(inputs.map((p) => p[5] - p[4])),
      dispatch: distribution(inputs.map((p) => p[6] - p[5])),
    },
    surface: {
      n: surfaces.length,
      uniqueContentFrames: new Set(surfaces.map((f) => f[4])).size,
      viewport: surfaces[0]?.[3] ?? null,
      generation: surfaces[0]?.[7] ?? null,
      width: surfaces[0]?.[8] ?? null,
      height: surfaces[0]?.[9] ?? null,
    },
    inputToSurface: {
      scope: changed ? 'offset-changing-native-wheel' : 'native-wheel-offset-change-unverified',
      eligible: eligible.length,
      mapped: mapped.size,
      pending: eligible.length - mapped.size,
      oldest: distribution(oldest),
      latest: distribution(latest),
    },
  };
}
/** Surface cadence only inside declared continuous motion. Quiet/recontact
 * gaps and intervals crossing a motion boundary are excluded explicitly. */
export function analyseNativeMotionIntervals(trace, windows) {
  requireValue(
    trace?.schema === 1 &&
      trace.clock === 'qpc-ms' &&
      trace.surfaceStride === 11 &&
      trace.lostSurfaces === 0,
    'Motion surface trace differs or overflowed',
  );
  requireValue(
    Array.isArray(windows) && windows.length > 0 && windows.length <= 30,
    'Invalid motion windows',
  );
  let previousEnd = -Infinity;
  for (const window of windows) {
    requireValue(
      Number.isFinite(window.begin) &&
        Number.isFinite(window.end) &&
        window.begin < window.end &&
        window.begin >= previousEnd,
      'Invalid or overlapping motion window',
    );
    previousEnd = window.end;
  }
  const surfaces = unpack(trace.surfaces, 11),
    intervals = [];
  for (let index = 1; index < surfaces.length; index++) {
    const before = surfaces[index - 1],
      after = surfaces[index];
    requireValue(
      after[0] === before[0] + 1 && after[10] >= before[10],
      'Motion surface sequence or clock differs',
    );
    if (windows.some((window) => before[10] >= window.begin && after[10] <= window.end)) {
      requireValue(
        [1, 2, 3, 7, 8, 9].every((field) => before[field] === after[field]),
        'Motion surface scope changed',
      );
      intervals.push(after[10] - before[10]);
    }
  }
  return {
    scope: 'surface-updates-within-explicit-motion-windows',
    windows: windows.length,
    intervals: distribution(intervals),
    displayed: 'unobserved',
    performanceAccepted: false,
  };
}
/** Join Core visibility to copied content frames; a built/discarded frame is not surface evidence. */
export function analyseNativeCatalogCoverage(
  trace,
  frames,
  { expectedIds, requireAll = true, begin = -Infinity, end = Infinity },
) {
  requireValue(
    trace?.schema === 1 &&
      trace.clock === 'qpc-ms' &&
      trace.surfaceStride === 11 &&
      trace.lostSurfaces === 0 &&
      trace.completion === 'surface-copy-fence-observed' &&
      trace.displayed === 'unobserved',
    'Catalog surface trace differs or overflowed',
  );
  requireValue(
    Array.isArray(expectedIds) &&
      expectedIds.length > 0 &&
      expectedIds.length <= 256 &&
      expectedIds.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 256) &&
      new Set(expectedIds).size === expectedIds.length,
    'Invalid expected catalog',
  );
  requireValue(
    typeof requireAll === 'boolean' &&
      begin < end &&
      Array.isArray(frames) &&
      frames.length <= 16384,
    'Invalid catalog frame budget',
  );
  const expected = new Set(expectedIds),
    byFrame = new Map(),
    builtSeen = new Set(),
    seen = new Set(),
    matching = new Set();
  for (const frame of frames) {
    requireValue(
      counter(frame.sequence) &&
        frame.sequence > 0 &&
        !byFrame.has(frame.sequence) &&
        Array.isArray(frame.ids) &&
        frame.ids.length <= expected.size &&
        new Set(frame.ids).size === frame.ids.length &&
        frame.ids.every((id) => expected.has(id)),
      'Invalid catalog frame identity',
    );
    byFrame.set(frame.sequence, frame.ids);
    for (const id of frame.ids) builtSeen.add(id);
  }
  let sequence = 0,
    content = 0;
  const surfaces = unpack(trace.surfaces, 11);
  for (const row of surfaces) {
    requireValue(
      row.slice(0, 10).every(counter) &&
        row[0] > sequence &&
        row[4] > 0 &&
        row[4] >= content &&
        row[10] >= 0,
      'Invalid catalog surface identity',
    );
    sequence = row[0];
    content = row[4];
    if (row[10] < begin || row[10] > end) continue;
    const ids = byFrame.get(row[4]);
    if (!ids) continue;
    matching.add(row[4]);
    for (const id of ids) seen.add(id);
  }
  const missing = expectedIds.filter((id) => !seen.has(id));
  requireValue(
    !requireAll || missing.length === 0,
    'Catalog sections did not reach a matching surface: ' + missing.join(','),
  );
  return {
    scope:
      'Core-visible sections joined to matching surface-copy content frames; display unobserved',
    expectedIds: [...expectedIds],
    builtSeenIds: expectedIds.filter((id) => builtSeen.has(id)),
    seenIds: expectedIds.filter((id) => seen.has(id)),
    skippedIds: missing,
    builtFrames: frames.length,
    matchingFrames: matching.size,
  };
}
