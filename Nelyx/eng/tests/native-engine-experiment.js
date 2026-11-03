// SPDX-License-Identifier: BSD-3-Clause
export const engineModes = ['layout', 'text', 'frame', 'all'];
export const engineMetrics = [
  'flexPlans',
  'flexChildren',
  'flexPlacements',
  'textTransactions',
  'textOperations',
  'textBytes',
  'frameSeals',
  'frameAdmissions',
  'frameRetirements',
  'frameBytes',
];
export function verifyNativeEngineExperiment(
  lines,
  { mode, checks = [], manual = false, requireTimedWork = true },
) {
  const fail = (message) => {
      throw Error('Native engine audit: ' + message);
    },
    valid = (value) => Number.isSafeInteger(value) && value >= 0,
    read = (prefix) =>
      lines
        .filter((line) => line.includes(prefix))
        .map((line) => JSON.parse(line.slice(line.indexOf(prefix) + prefix.length)));
  if (
    !engineModes.includes(mode) ||
    !Array.isArray(lines) ||
    lines.length > 128 ||
    lines.some((line) => typeof line !== 'string' || line.length > 5000)
  )
    fail('invalid observations');
  const reports = read('NELYX_INPUT_GEOMETRY_STATUS ').filter(
      (row) => row.kind === (manual ? 'manual' : 'experiment'),
    ),
    headers = read('NELYX_NATIVE_ENGINE_USAGE '),
    chunks = read('NELYX_NATIVE_ENGINE_BINS ');
  if (reports.length !== 1 || headers.length !== 1) fail('missing/duplicate SDK/native report');
  const report = reports[0],
    sdk = report.engine,
    native = headers[0],
    indices =
      mode === 'all'
        ? engineMetrics.map((_, index) => index)
        : mode === 'layout'
          ? [0, 1, 2]
          : mode === 'text'
            ? [3, 4, 5]
            : [6, 7, 8, 9];
  if (
    native.schema !== 1 ||
    (mode === 'all' &&
      (!manual ||
        JSON.stringify(sdk?.selected) !== JSON.stringify(['frame', 'layout', 'text']) ||
        Object.keys(sdk.fallbackReasons ?? {}).some(
          (reason) => !/^(frame|layout|text):.+/.test(reason),
        ))) ||
    report.schema !== 1 ||
    report.mode !== mode ||
    native.mode !== mode ||
    !valid(native.ownerGeneration) ||
    native.ownerGeneration < 1 ||
    native.ownerGeneration !== report.ownerGeneration ||
    report.closed !== true ||
    sdk?.closed !== true ||
    native.closed !== true ||
    native.overflow !== false ||
    native.timing !== (manual ? 'counters-only' : 'qpc-buckets') ||
    !valid(native.binCount) ||
    !Array.isArray(native.totals) ||
    native.totals.length !== engineMetrics.length ||
    !native.totals.every(valid) ||
    native.totals.some((value, index) => value && !indices.includes(index)) ||
    !Number.isFinite(native.beganQpcMs) ||
    !Number.isFinite(native.endedQpcMs) ||
    native.endedQpcMs <= native.beganQpcMs ||
    !valid(sdk.tsFallbacks) ||
    !sdk.fallbackReasons ||
    Object.values(sdk.fallbackReasons).some((value) => !valid(value)) ||
    Object.values(sdk.fallbackReasons).reduce((sum, value) => sum + value, 0) !== sdk.tsFallbacks ||
    !Array.isArray(native.memory) ||
    native.memory.length !== 4 ||
    !native.memory.every(valid) ||
    native.memory[0] !== 0 ||
    native.memory[1] !== 0 ||
    native.memory[2] > 3 ||
    native.memory[3] > 6 * 1024 * 1024
  )
    fail('mode/owner/close/budget/fallback mismatch');
  const compared = indices.filter((index) => index !== 8);
  for (const index of compared)
    if (sdk[engineMetrics[index]] !== native.totals[index])
      fail('SDK/native counts disagree: ' + engineMetrics[index]);
  if (
    (mode === 'frame' || mode === 'all') &&
    (native.totals[6] !== native.totals[7] || native.totals[6] !== native.totals[8])
  )
    fail('unadmitted/unretired frame segment');
  if ((mode === 'layout' || mode === 'all') && native.totals[0] !== native.totals[2])
    fail('incomplete Flex numeric phases');
  const rows = [],
    sums = engineMetrics.map(() => 0);
  for (const [index, chunk] of chunks.entries()) {
    if (
      chunk.schema !== 1 ||
      chunk.index !== index ||
      !Array.isArray(chunk.rows) ||
      !chunk.rows.length ||
      chunk.rows.length > 16
    )
      fail('invalid QPC chunks');
    for (const row of chunk.rows) {
      if (
        !Array.isArray(row) ||
        row.length !== engineMetrics.length + 1 ||
        !row.every(valid) ||
        (rows.length && row[0] <= rows.at(-1)[0]) ||
        row[0] < Math.floor(native.beganQpcMs / 1000) ||
        row[0] > Math.floor(native.endedQpcMs / 1000)
      )
        fail('invalid native QPC bucket');
      rows.push(row);
      sums.forEach((_, at) => {
        sums[at] += row[at + 1];
      });
    }
  }
  if (
    manual
      ? chunks.length !== 0 || native.binCount !== 0
      : rows.length !== native.binCount ||
        sums.some((value, index) => value !== native.totals[index])
  )
    fail('QPC totals differ');
  const metric = mode === 'layout' ? 1 : mode === 'text' ? 3 : 7,
    timed = checks.map((check) => {
      const begin = check.nativeSurface?.firstMovementMs,
        end = check.nativeSurface?.bottomMs;
      if (
        !Number.isFinite(begin) ||
        !Number.isFinite(end) ||
        begin < native.beganQpcMs ||
        end > native.endedQpcMs ||
        end <= begin ||
        begin < check.nativeBeginMs ||
        end > check.nativeEndMs
      )
        fail('missing actual movement window');
      const included = rows.filter((row) => row[0] * 1000 >= begin && (row[0] + 1) * 1000 <= end),
        work = included.reduce((sum, row) => sum + row[metric + 1], 0);
      if (requireTimedWork && (!included.length || !work))
        fail('no native work inside the complete movement QPC buckets');
      return {
        column: check.column,
        completeSeconds: included.length,
        work,
        nativeWork: included.length > 0 && work > 0,
      };
    });
  const modules =
    mode === 'all'
      ? Object.fromEntries(
          [
            ['layout', 1],
            ['text', 3],
            ['frame', 7],
          ].map(([name, metric]) => [
            name,
            native.totals[metric] > 0
              ? 'observed'
              : Object.keys(sdk.fallbackReasons).some(
                    (reason) => reason.startsWith(name + ':') && sdk.fallbackReasons[reason] > 0,
                  )
                ? 'fallbackOnly'
                : 'notObserved',
          ]),
        )
      : undefined;
  return {
    mode,
    native: Object.fromEntries(engineMetrics.map((name, index) => [name, native.totals[index]])),
    fallback: { count: sdk.tsFallbacks, reasons: sdk.fallbackReasons },
    memory: {
      liveObjects: native.memory[0],
      liveBytes: native.memory[1],
      peakObjects: native.memory[2],
      peakBytes: native.memory[3],
    },
    nativeDuringEveryLeg: timed.length ? timed.every((row) => row.nativeWork) : null,
    observed: modules
      ? Object.values(modules).every((value) => value === 'observed')
      : native.totals[metric] > 0,
    ...(modules ? { modules } : {}),
    closed: true,
    timed,
    scope:
      'real C++ numeric/paragraph/frame operations, independent SDK totals, original movement QPC windows; not physical display acceptance',
  };
}
