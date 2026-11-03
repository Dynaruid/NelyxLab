// SPDX-License-Identifier: BSD-3-Clause
import { verifyGeometryActivation } from './native-service-activation.js';
import { engineModes, verifyNativeEngineExperiment } from './native-engine-experiment.js';
import { withoutBackingEvidence, verifyBackingExperiment } from './backing-experiment.js';
export const experimentModes = ['ts', 'snapshot', 'path', 'paint', 'composition', 'semantics'];
export const fullRangeModes = [...experimentModes, 'backing', 'text', 'layout', 'frame'];
export const nativeModuleModes = ['all', 'retained', ...fullRangeModes];
export const nativeServiceMetrics = [
  'snapshotCalls',
  'snapshotEditors',
  'composePrepares',
  'composeCommits',
  'composeRanges',
  'semanticsCalls',
  'semanticsQueries',
  'numericReplays',
  'numericPaths',
  'numericPaints',
  'numericClips',
];
export function verifyNativeServiceExperiment(lines, options) {
  return verifyNativeServices(lines, options, false);
}
export function verifyNativeModuleMode(lines, { mode, fullRange = false }) {
  const result = verifyNativeServices(
    withoutBackingEvidence(lines),
    { mode, fullRange, requireNativeWork: false },
    true,
  );
  if (engineModes.includes(mode)) {
    result.engine = verifyNativeEngineExperiment(lines, {
      mode,
      manual: true,
      requireTimedWork: false,
    });
    if (mode === 'all') Object.assign(result.modules, result.engine.modules);
    else
      result.modules[mode] = result.engine.observed
        ? 'observed'
        : result.engine.fallback.count
          ? 'fallbackOnly'
          : 'notObserved';
  }
  if (mode === 'all' || mode === 'backing') {
    result.backing = verifyBackingExperiment(lines, { mode: 'backing', requireTimedWork: false });
    result.modules.backing = result.backing.reused > 0 ? 'observed' : 'notObserved';
  }
  return result;
}
function verifyNativeServices(
  lines,
  { mode, checks = [], requireTimedWork = true, requireNativeWork = true, fullRange = false },
  manual,
) {
  if (
    !(manual ? nativeModuleModes : fullRangeModes).includes(mode) ||
    !Array.isArray(lines) ||
    lines.length > 128 ||
    lines.some((line) => typeof line !== 'string' || line.length > 5000)
  )
    throw Error('Invalid native experiment observations');
  const read = (prefix) =>
      lines
        .filter((line) => line.includes(prefix))
        .map((line) => JSON.parse(line.slice(line.indexOf(prefix) + prefix.length).trim())),
    status = read('NELYX_INPUT_GEOMETRY_STATUS '),
    requests = status.filter((x) => x.kind === 'request'),
    reports = status.filter((x) => x.kind === (manual ? 'manual' : 'experiment')),
    selections = status.filter((x) => x.kind === 'manual-selection'),
    galleryRange = status.filter((x) => x.kind === 'gallery-range-manual'),
    headers = read('NELYX_NATIVE_SERVICE_USAGE '),
    chunks = read('NELYX_NATIVE_SERVICE_BINS '),
    retained = manual && ['all', 'retained'].includes(mode),
    valid = (x) => Number.isSafeInteger(x) && x >= 0;
  if (
    status.length !== (manual ? (retained ? 4 : 3) + Number(fullRange) : 2) ||
    galleryRange.length !== Number(manual && fullRange) ||
    (fullRange &&
      (galleryRange[0]?.schema !== 1 ||
        galleryRange[0]?.ownerGeneration !== requests[0]?.ownerGeneration)) ||
    requests.length !== 1 ||
    reports.length !== 1 ||
    headers.length !== 1 ||
    (!retained && read('NELYX_RETAINED_GEOMETRY_NATIVE ').length) ||
    (manual &&
      (selections.length !== 1 ||
        selections[0].schema !== 1 ||
        selections[0].mode !== mode ||
        selections[0].ownerGeneration !== requests[0]?.ownerGeneration))
  )
    throw Error('Missing/duplicate native experiment evidence');
  // The startup selector owns legacy modules. Retained geometry is created by
  // the engine itself, so its real request/execution/session reports must agree.
  const geometry = verifyGeometryActivation(
    [
      ...status
        .filter((row) => row.kind === 'request' || row.kind === 'execution')
        .map((row) => 'NELYX_INPUT_GEOMETRY_STATUS ' + JSON.stringify(row)),
      ...read('NELYX_RETAINED_GEOMETRY_NATIVE ').map(
        (row) => 'NELYX_RETAINED_GEOMETRY_NATIVE ' + JSON.stringify(row),
      ),
    ],
    {
      mode: retained ? 'retained' : 'ts',
      minimumCoverage: 0,
    },
  );
  const sdk = reports[0],
    native = headers[0];
  if (
    sdk.schema !== 1 ||
    native.schema !== 1 ||
    sdk.mode !== mode ||
    native.mode !== mode ||
    sdk.ownerGeneration !== requests[0].ownerGeneration ||
    native.ownerGeneration !== sdk.ownerGeneration ||
    sdk.closed !== true ||
    (native.timing ?? 'qpc-buckets') !== (manual ? 'counters-only' : 'qpc-buckets') ||
    native.overflow !== false ||
    !valid(native.binCount) ||
    !Number.isFinite(native.beganQpcMs) ||
    !Number.isFinite(native.endedQpcMs) ||
    native.endedQpcMs <= native.beganQpcMs ||
    !Array.isArray(native.totals) ||
    native.totals.length !== 11 ||
    !native.totals.every(valid) ||
    !Array.isArray(native.sessions) ||
    native.sessions.length !== 3 ||
    native.sessions.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== 4 ||
        !row.every(valid) ||
        row[0] !== row[1] ||
        row[2] !== 0 ||
        row[3] !== 0,
    )
  )
    throw Error('Malformed/unretired native experiment counters');
  for (const name of [
    'snapshotCalls',
    'snapshotEditors',
    'inputFallbacks',
    'composePrepares',
    'composeCommits',
    'composeFallbacks',
    'semanticsCalls',
    'semanticsQueries',
    'semanticsFallbacks',
  ])
    if (!valid(sdk[name])) throw Error('Malformed SDK experiment counters');
  if (
    !sdk.inputFallbackReasons ||
    Object.values(sdk.inputFallbackReasons).some((x) => !valid(x)) ||
    Object.values(sdk.inputFallbackReasons).reduce((a, b) => a + b, 0) !== sdk.inputFallbacks
  )
    throw Error('Missing fallback accounting');
  for (const [at, name] of [
    [0, 'snapshotCalls'],
    [1, 'snapshotEditors'],
    [2, 'composePrepares'],
    [3, 'composeCommits'],
    [5, 'semanticsCalls'],
    [6, 'semanticsQueries'],
  ])
    if (native.totals[at] !== sdk[name])
      throw Error('SDK/native experiment counts disagree: ' + name);
  const allowed = {
      ts: [],
      snapshot: [0, 1],
      path: [7, 8],
      paint: [7, 9, 10],
      composition: [2, 3, 4],
      semantics: [5, 6],
      retained: [],
      backing: [],
      text: [],
      layout: [],
      frame: [7],
      all: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    }[mode],
    services = mode === 'all' ? [1, 2] : [{ snapshot: 0, composition: 1, semantics: 2 }[mode]];
  if (
    native.totals.some((value, index) => value && !allowed.includes(index)) ||
    native.sessions.some((row, index) => !services.includes(index) && row[0])
  )
    throw Error('A C++ candidate outside the selected mode executed');
  const rows = [],
    sums = Array(11).fill(0);
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    if (
      chunk.schema !== 1 ||
      chunk.index !== index ||
      !Array.isArray(chunk.rows) ||
      !chunk.rows.length ||
      chunk.rows.length > 16
    )
      throw Error('Native timing chunks missing/duplicated/reordered');
    for (const row of chunk.rows) {
      if (
        !Array.isArray(row) ||
        row.length !== 12 ||
        !row.every(valid) ||
        (rows.length && row[0] <= rows.at(-1)[0]) ||
        row[0] < Math.floor(native.beganQpcMs / 1000) ||
        row[0] > Math.floor(native.endedQpcMs / 1000)
      )
        throw Error('Malformed native timing bucket');
      rows.push(row);
      for (let i = 0; i < 11; i++) sums[i] += row[i + 1];
    }
  }
  if (
    manual
      ? native.binCount !== 0 || chunks.length !== 0
      : rows.length !== native.binCount ||
        sums.some((value, index) => value !== native.totals[index])
  )
    throw Error('Native timing buckets do not cover the reported work');
  const relevant = (values) =>
    mode === 'snapshot'
      ? values[1]
      : mode === 'path'
        ? values[8]
        : mode === 'paint'
          ? values[9] + values[10]
          : mode === 'composition'
            ? values[2]
            : mode === 'semantics'
              ? values[6]
              : 0;
  const timed = checks.map((check) => {
    const begin = check.nativeBeginMs,
      end = check.nativeEndMs;
    if (
      !Number.isFinite(begin) ||
      !Number.isFinite(end) ||
      end - begin < 3000 ||
      begin < native.beganQpcMs ||
      end > native.endedQpcMs
    )
      throw Error('Input timing is missing or outside the native owner');
    const included = rows.filter((row) => row[0] * 1000 >= begin && (row[0] + 1) * 1000 <= end),
      counts = Array(11).fill(0);
    for (const row of included) for (let i = 0; i < 11; i++) counts[i] += row[i + 1];
    const activeSeconds = included.filter((row) => relevant(row.slice(1)) > 0).length,
      expectedWork = mode !== 'ts' && !(mode === 'snapshot' && check.scene === 'gallery'),
      result = {
        expectedWork,
        completeSeconds: Math.floor(end / 1000) - Math.ceil(begin / 1000),
        activeSeconds,
        work: Object.fromEntries(nativeServiceMetrics.map((name, index) => [name, counts[index]])),
        nativeWork: relevant(counts) > 0,
      };
    if (requireTimedWork && expectedWork && !result.nativeWork)
      throw Error('No relevant C++ work during timed input');
    return result;
  });
  const totalRelevant = relevant(native.totals);
  if (requireNativeWork && mode !== 'ts' && !totalRelevant)
    throw Error('Requested C++ candidate executed no real work');
  const observed = (work, fallback = 0) =>
    work ? 'observed' : fallback ? 'fallbackOnly' : 'notObserved';
  return {
    mode,
    ...(manual && fullRange ? { galleryRange: galleryRange[0] } : {}),
    ...(manual
      ? {
          inputGeometry: geometry,
          modules: {
            ...(retained
              ? { inputGeometry: observed(geometry.editorQueries, geometry.fallbackFrames) }
              : mode === 'snapshot'
                ? { inputGeometry: observed(sdk.snapshotEditors, sdk.inputFallbacks) }
                : {}),
            ...(['all', 'path'].includes(mode) ? { path: observed(native.totals[8]) } : {}),
            ...(['all', 'paint'].includes(mode)
              ? { paint: observed(native.totals[9]), clip: observed(native.totals[10]) }
              : {}),
            ...(['all', 'composition'].includes(mode)
              ? { composition: observed(sdk.composePrepares, sdk.composeFallbacks) }
              : {}),
            ...(['all', 'semantics'].includes(mode)
              ? { semantics: observed(sdk.semanticsQueries, sdk.semanticsFallbacks) }
              : {}),
          },
        }
      : {}),
    native: Object.fromEntries(
      nativeServiceMetrics.map((name, index) => [name, native.totals[index]]),
    ),
    fallback: {
      input: sdk.inputFallbacks,
      reasons: sdk.inputFallbackReasons,
      composition: sdk.composeFallbacks,
      semantics: sdk.semanticsFallbacks,
    },
    inputCoverage:
      sdk.snapshotCalls + sdk.inputFallbacks
        ? sdk.snapshotCalls / (sdk.snapshotCalls + sdk.inputFallbacks)
        : null,
    semanticsCoverage:
      sdk.semanticsQueries + sdk.semanticsFallbacks
        ? sdk.semanticsQueries / (sdk.semanticsQueries + sdk.semanticsFallbacks)
        : null,
    nativeDuringEveryLeg: timed.some((row) => row.expectedWork)
      ? timed.every((row) => !row.expectedWork || row.nativeWork)
      : null,
    timed,
    closed: true,
  };
}
