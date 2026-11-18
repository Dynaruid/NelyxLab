// SPDX-License-Identifier: BSD-3-Clause
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

// Function definition sites survive the consumer bundle's directory prefix.
// Count a category once per non-GC stack, including native callees.
const costSites = {
  layoutMembership: /\/rendering\/object\.[jt]s:\d+ layoutMutationAllowed$/,
  renderSynchronization:
    /\/widgets\/framework\.[jt]s:\d+ (?:markRenderTreeSyncDirty|_scheduleRenderChildren|flushRenderTree|_commitRenderChildren)$/,
  calendarBuild: /\/generated\/date\/calendar_date_picker\.generated\.[jt]s:\d+ build$/,
  fieldProtection: /\/ui\/value-math\.[jt]s:\d+ protect$/,
  integerChecks: /\/ui\/value-math\.[jt]s:\d+ checkedInteger$/,
  typeWitness: /\/foundation\/dart-type-witness\.[jt]s:\d+ /,
};

// Diagnostic upper bounds, not estimates of removable time. Include all Dart
// collections (even other domains), callbacks and GC in their own buckets. A
// sample is counted once per candidate regardless of nesting. No raw trace is
// written, and the VM's builtin is never called descriptor-conversion time.
export function representationSamplingProfile(trace, frames, sourceMap) {
  const map = new TraceMap(sourceMap),
    nodes = new Map(),
    observed = new Set();
  if (!Array.isArray(trace.samples) || !trace.stackFrames || !Array.isArray(frames))
    throw Error('Representation profile is incomplete');
  let previousEnd = -Infinity;
  const values = frames.map((frame) => {
    const {
      sequence,
      begin,
      end,
      cpuMs,
      newDays,
      rebuiltDays,
      native,
      property,
      semanticsConflict,
    } = frame;
    if (semanticsConflict) {
      const counts = [
        'groups',
        'outerGroups',
        'nestedGroups',
        'mergeUpGroups',
        'siblingGroups',
        'failed',
      ];
      const times = ['outerMs', 'mergeUpMs', 'siblingMs', 'maxMs'];
      if (
        !counts.every(
          (key) => Number.isSafeInteger(semanticsConflict[key]) && semanticsConflict[key] >= 0,
        ) ||
        !times.every(
          (key) => Number.isFinite(semanticsConflict[key]) && semanticsConflict[key] >= 0,
        ) ||
        semanticsConflict.groups !==
          semanticsConflict.outerGroups + semanticsConflict.nestedGroups ||
        semanticsConflict.groups !==
          semanticsConflict.mergeUpGroups + semanticsConflict.siblingGroups ||
        semanticsConflict.failed > semanticsConflict.groups ||
        Math.abs(
          semanticsConflict.outerMs - semanticsConflict.mergeUpMs - semanticsConflict.siblingMs,
        ) > 0.001 ||
        semanticsConflict.maxMs > semanticsConflict.outerMs + 0.001 ||
        semanticsConflict.outerMs > end - begin + 0.001
      )
        throw Error('Semantics conflict frame accounting differs');
    }
    if (
      !Number.isSafeInteger(sequence) ||
      observed.has(sequence) ||
      ![begin, end, cpuMs, newDays, rebuiltDays].every(Number.isFinite) ||
      begin < previousEnd ||
      end < begin ||
      cpuMs < 0 ||
      cpuMs > end - begin + 20 ||
      ![newDays, rebuiltDays].every((count) => Number.isSafeInteger(count) && count >= 0) ||
      (native !== undefined &&
        (!Array.isArray(native) ||
          native.length !== 4 ||
          !native.every((value) => Number.isFinite(value) && value >= 0) ||
          native[1] > native[0] ||
          native[2] + native[3] > end - begin + 0.001)) ||
      (property !== undefined &&
        (!Array.isArray(property) ||
          property.length !== 7 ||
          !property.every((value) => Number.isFinite(value) && value >= 0) ||
          ![0, 1, 4, 5].every((index) => Number.isSafeInteger(property[index])) ||
          property[1] > property[0] ||
          property[5] > property[4] ||
          property[2] > property[6] ||
          property[6] + property[3] > end - begin + 0.01))
    )
      throw Error('Representation frame clocks or sequence differ');
    observed.add(sequence);
    previousEnd = end;
    return {
      sequence,
      elapsedMs: end - begin,
      cpuMs,
      newDays,
      rebuiltDays,
      samples: 0,
      ...Object.fromEntries(Object.keys(costSites).map((key) => [key, 0])),
      lifecycle: { create: 0, update: 0, retire: 0, other: 0 },
      collectionUpper: 0,
      policy: 0,
      definePropertiesUpper: 0,
      gc: 0,
      unmapped: 0,
      begin,
      end,
      ...(native ? { native } : {}),
      ...(property ? { property } : {}),
      ...(semanticsConflict ? { semanticsConflict } : {}),
    };
  });
  function node(id) {
    if (nodes.has(id)) return nodes.get(id);
    const entry = trace.stackFrames[id];
    if (!entry) throw Error('Missing representation sampled stack');
    let source = null;
    let definition = null;
    if (entry.category === 'JavaScript' && entry.line !== undefined) {
      const line = Number(entry.line),
        column = Number(entry.column);
      if (!Number.isInteger(line) || line < 1 || !Number.isInteger(column) || column < 1)
        throw Error('Invalid sampled source location');
      source = originalPositionFor(map, { line, column: column - 1 }).source;
      definition = originalPositionFor(map, {
        line: Number(entry.funcLine ?? entry.line),
        column: Number(entry.funcColumn ?? entry.column) - 1,
      });
    }
    const normalized = source?.replaceAll('\\', '/');
    const value = {
      ...entry,
      source: normalized,
      site:
        entry.category === 'JavaScript'
          ? `${(definition?.source ?? normalized ?? '[unmapped]').replaceAll('\\', '/').replace(/^.*\/node_modules\//, '')}:${definition?.line ?? '?'} ${entry.name.split('(')[0] || '<anonymous>'}`
          : entry.name.split('(')[0],
    };
    value.costs = Object.entries(costSites)
      .filter(([, pattern]) => pattern.test(value.site))
      .map(([key]) => key);
    nodes.set(id, value);
    return value;
  }
  const bySource = new Map();
  const attribution = new Map();
  const increment = (counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1);
  let outsideFrames = 0,
    previousStamp = -Infinity,
    index = 0;
  for (const sample of trace.samples) {
    const at = Number(sample.ts) / 1000;
    if (!Number.isFinite(at) || at < previousStamp)
      throw Error('Representation sample clock differs');
    previousStamp = at;
    while (index < values.length && at >= values[index].end) index++;
    const frame = values[index];
    if (!frame || at < frame.begin) {
      outsideFrames++;
      continue;
    }
    let id = sample.sf,
      collection = false,
      policy = false,
      descriptor = false,
      gc = false,
      unmapped = false;
    const visited = new Set(),
      sources = new Set(),
      branches = new Set();
    const costs = new Set();
    let lifecycle;
    let nearestJs, nativeLeaf;
    for (let depth = 0; id !== undefined; depth++) {
      if (depth >= 512 || visited.has(id)) throw Error('Representation stack is cyclic or deep');
      visited.add(id);
      const entry = node(id);
      const name = entry.name.split('(')[0];
      if (entry.category === 'JavaScript') {
        nearestJs ??= entry.site;
        branches.add(entry.site);
        for (const cost of entry.costs) costs.add(cost);
        // Nearest lifecycle boundary wins in mixed frames. Methods which do
        // work for several phases (e.g. rebuild) inherit their caller's phase.
        if (!lifecycle && /\/widgets\/(?:framework|sliver)\.[jt]s:\d+ /.test(entry.site)) {
          if (/^(?:unmount|deactivate|removeChild)$/.test(name)) lifecycle = 'retire';
          else if (/^(?:mount|inflateWidget|createChild)$/.test(name)) lifecycle = 'create';
          else if (/^(?:update|updateChildAt)$/.test(name)) lifecycle = 'update';
        }
        if (!entry.source) unmapped = true;
        else sources.add(entry.source);
        collection ||=
          /\/(?:foundation\/dart-collections|widgets\/widget-state-constraint-source-adapter)\.[jt]s$/.test(
            entry.source ?? '',
          );
        policy ||= /\/widget-state-constraint-source-adapter\.[jt]s$/.test(entry.source ?? '');
      }
      if (depth === 0 && entry.category === 'Native') nativeLeaf = name;
      descriptor ||= /^\[Native\] (?:objectDefineProperties|Object\.defineProperties)$/.test(name);
      gc ||= entry.category === 'Metadata' && /GC|garbage/i.test(name);
      id = entry.parent;
    }
    frame.samples++;
    // Suspended GC has a saved JS parent. Never attribute it to that parent.
    frame.gc += Number(gc);
    if (!gc) {
      for (const cost of costs) frame[cost]++;
      frame.lifecycle[lifecycle ?? 'other']++;
      frame.collectionUpper += Number(collection);
      frame.policy += Number(policy);
      frame.definePropertiesUpper += Number(descriptor);
    }
    frame.unmapped += Number(unmapped);
    if (frame.elapsedMs > 33.33)
      for (const source of sources) bySource.set(source, (bySource.get(source) ?? 0) + 1);
    if (!gc) {
      let counts = attribution.get(frame.sequence);
      if (!counts)
        attribution.set(
          frame.sequence,
          (counts = { self: new Map(), branches: new Map(), native: new Map() }),
        );
      increment(counts.self, nearestJs ?? '[no JavaScript frame]');
      for (const site of branches) increment(counts.branches, site);
      if (nativeLeaf) increment(counts.native, nativeLeaf);
    }
  }
  function summarize(selected) {
    const result = { frames: selected.length };
    for (const key of [
      'elapsedMs',
      'cpuMs',
      'newDays',
      'rebuiltDays',
      'samples',
      ...Object.keys(costSites),
      'collectionUpper',
      'policy',
      'definePropertiesUpper',
      'gc',
      'unmapped',
    ])
      result[key] = selected.reduce((total, frame) => total + frame[key], 0);
    result.collectionUpperShare = result.samples ? result.collectionUpper / result.samples : null;
    result.lifecycle = Object.fromEntries(
      ['create', 'update', 'retire', 'other'].map((key) => [
        key,
        selected.reduce((sum, frame) => sum + frame.lifecycle[key], 0),
      ]),
    );
    result.definePropertiesUpperShare = result.samples
      ? result.definePropertiesUpper / result.samples
      : null;
    if (selected.some((frame) => frame.native)) {
      if (selected.some((frame) => !frame.native)) throw Error('Mixed native descriptor coverage');
      const total = selected.reduce(
        (sum, frame) => sum.map((value, index) => value + frame.native[index]),
        [0, 0, 0, 0],
      );
      result.nativeDefineProperties = {
        calls: total[0],
        failed: total[1],
        conversionUpperMs: total[2],
        applicationUpperMs: total[3],
        conversionUpperOfCpu: result.cpuMs ? total[2] / result.cpuMs : null,
        wholeCallUpperOfCpu: result.cpuMs ? (total[2] + total[3]) / result.cpuMs : null,
      };
    }
    if (selected.some((frame) => frame.property)) {
      if (selected.some((frame) => !frame.property)) throw Error('Mixed native property coverage');
      const total = selected.reduce(
        (sum, frame) => sum.map((value, index) => value + frame.property[index]),
        [0, 0, 0, 0, 0, 0, 0],
      );
      result.nativeNamedProperty = {
        lookups: total[0],
        eligibleAccessorLookups: total[1],
        eligibleResolutionUpperMs: total[2],
        getterGatewayOutsideLoopUpperMs: total[3],
        getterCalls: total[4],
        interpretedGetterCalls: total[5],
        allResolutionUpperMs: total[6],
        eligibleResolutionUpperOfCpu: result.cpuMs ? total[2] / result.cpuMs : null,
        getterGatewayOutsideLoopUpperOfCpu: result.cpuMs ? total[3] / result.cpuMs : null,
        combinedUpperOfCpu: result.cpuMs ? (total[2] + total[3]) / result.cpuMs : null,
      };
    }
    if (selected.some((frame) => frame.semanticsConflict)) {
      if (selected.some((frame) => !frame.semanticsConflict))
        throw Error('Mixed semantics conflict coverage');
      const total = {};
      for (const key of [
        'groups',
        'outerGroups',
        'nestedGroups',
        'mergeUpGroups',
        'siblingGroups',
        'failed',
        'outerMs',
        'mergeUpMs',
        'siblingMs',
      ])
        total[key] = selected.reduce((sum, frame) => sum + frame.semanticsConflict[key], 0);
      total.maxMs = Math.max(0, ...selected.map((frame) => frame.semanticsConflict.maxMs));
      total.outerUpperOfCpu = result.cpuMs ? total.outerMs / result.cpuMs : null;
      result.semanticsConflicts = {
        scope:
          'all-groups-outer-union-wall-upper-includes-callbacks-and-diagnostic-cost-not-admission-qualified',
        ...total,
      };
    }
    return result;
  }
  const long = values.filter((frame) => frame.elapsedMs > 33.33);
  function hotspots(selected) {
    const merged = { self: new Map(), branches: new Map(), native: new Map() };
    for (const frame of selected) {
      const counts = attribution.get(frame.sequence);
      if (!counts) continue;
      for (const kind of Object.keys(merged))
        for (const [site, count] of counts[kind])
          merged[kind].set(site, (merged[kind].get(site) ?? 0) + count);
    }
    return Object.fromEntries(
      Object.entries(merged).map(([kind, counts]) => [
        kind,
        [...counts].sort((a, b) => b[1] - a[1]).slice(0, 24),
      ]),
    );
  }
  return {
    scope: 'diagnostic-sampled-inclusive-upper-bounds-not-removable-native-time',
    clock: 'Hermes-steady-microseconds/frame-steady-ms/runtime-thread-GetThreadTimes-ms',
    descriptorConversion: values.some((frame) => frame.native)
      ? 'native-conversion-and-application-inclusive-upper-bounds'
      : 'notSeparated',
    gate: 'notAcceptedFromSamplingAlone',
    outsideFrames,
    all: summarize(values),
    long: summarize(long),
    newMonth: summarize(long.filter((frame) => frame.newDays > 0)),
    existingMonth: summarize(long.filter((frame) => frame.newDays === 0)),
    hotspots: {
      scope: 'sample-counts-nearest-JS-includes-native-callees-GC-excluded-branches-not-additive',
      long: hotspots(long),
      newMonth: hotspots(long.filter((frame) => frame.newDays > 0)),
      existingMonth: hotspots(long.filter((frame) => frame.newDays === 0)),
    },
    sources: [...bySource].sort((a, b) => b[1] - a[1]).slice(0, 12),
    frames: long.map(({ begin: _begin, end: _end, ...frame }) => frame),
  };
}
