// SPDX-License-Identifier: BSD-3-Clause
const statusPrefix = 'NELYX_INPUT_GEOMETRY_STATUS ';
const fail = (message) => {
  throw Error('Windows backing audit: ' + message);
};
const read = (lines, prefix) =>
  lines
    .filter((line) => line.includes(prefix))
    .map((line) => JSON.parse(line.slice(line.indexOf(prefix) + prefix.length)));
export function withoutBackingEvidence(lines) {
  return lines.filter(
    (line) =>
      !line.includes('NELYX_WIN32_BACKING_') &&
      !(
        line.includes(statusPrefix) &&
        ['backing-selection', 'backing-sdk'].includes(
          JSON.parse(line.slice(line.indexOf(statusPrefix) + statusPrefix.length)).kind,
        )
      ),
  );
}
export function verifyBackingExperiment(lines, { mode, checks = [], requireTimedWork = true }) {
  if (
    !['ts', 'backing'].includes(mode) ||
    !Array.isArray(lines) ||
    lines.length > 128 ||
    lines.some((line) => typeof line !== 'string' || line.length > 5000)
  )
    fail('invalid observations');
  const statuses = read(lines, statusPrefix),
    selections = statuses.filter((row) => row.kind === 'backing-selection'),
    reports = statuses.filter((row) => row.kind === 'backing-sdk'),
    headers = read(lines, 'NELYX_WIN32_BACKING_USAGE '),
    chunks = read(lines, 'NELYX_WIN32_BACKING_BINS '),
    valid = (x) => Number.isSafeInteger(x) && x >= 0;
  if (selections.length !== 1 || reports.length !== 1 || headers.length !== 1)
    fail('missing/duplicate selection, SDK or native report');
  const selection = selections[0],
    sdk = reports[0],
    native = headers[0];
  if (
    [selection, sdk, native].some(
      (row) =>
        row.schema !== 1 || row.mode !== mode || row.ownerGeneration !== selection.ownerGeneration,
    ) ||
    !valid(selection.ownerGeneration) ||
    !selection.ownerGeneration ||
    sdk.closed !== true ||
    native.closed !== true ||
    sdk.invalid !== 0 ||
    sdk.tsFallbacks !== 0 ||
    native.overflow !== false ||
    ![
      'created',
      'reused',
      'destroyed',
      'initialObjects',
      'initialBytes',
      'liveObjects',
      'liveBytes',
      'peakObjects',
      'peakBytes',
      'binCount',
    ].every((key) => valid(native[key])) ||
    native.liveObjects !== 0 ||
    native.liveBytes !== 0 ||
    native.peakObjects > 3 ||
    native.peakBytes > 64 * 1024 * 1024 ||
    native.initialObjects + native.created !== native.destroyed ||
    sdk.created !== native.created ||
    sdk.reused !== native.reused ||
    (mode === 'ts' && native.reused !== 0) ||
    !Number.isFinite(native.beganQpcMs) ||
    !Number.isFinite(native.endedQpcMs) ||
    native.endedQpcMs <= native.beganQpcMs
  )
    fail('mode/owner/count/retirement mismatch');
  const rows = [],
    sums = [0, 0, 0];
  for (const [index, chunk] of chunks.entries()) {
    if (
      chunk.schema !== 1 ||
      chunk.index !== index ||
      !Array.isArray(chunk.rows) ||
      !chunk.rows.length ||
      chunk.rows.length > 16
    )
      fail('invalid native QPC chunks');
    for (const row of chunk.rows) {
      if (
        !Array.isArray(row) ||
        row.length !== 4 ||
        !row.every(valid) ||
        (rows.length && row[0] <= rows.at(-1)[0]) ||
        row[0] < Math.floor(native.beganQpcMs / 1000) ||
        row[0] > Math.floor(native.endedQpcMs / 1000)
      )
        fail('invalid native QPC bucket');
      rows.push(row);
      for (let i = 0; i < 3; i++) sums[i] += row[i + 1];
    }
  }
  if (
    rows.length !== native.binCount ||
    sums[0] !== native.created ||
    sums[1] !== native.reused ||
    sums[2] !== native.destroyed
  )
    fail('QPC buckets do not cover native totals');
  const timed = checks.map((check) => {
    const begin = check.nativeSurface?.firstMovementMs,
      end = check.nativeSurface?.bottomMs;
    if (
      !Number.isFinite(begin) ||
      !Number.isFinite(end) ||
      begin < check.nativeBeginMs ||
      end > check.nativeEndMs ||
      begin < native.beganQpcMs ||
      end > native.endedQpcMs ||
      end <= begin ||
      check.observation.backingOverflow !== 0 ||
      !Array.isArray(check.observation.backingEvents)
    )
      fail('missing movement-window observations');
    const included = rows.filter((row) => row[0] * 1000 >= begin && (row[0] + 1) * 1000 <= end),
      completed = check.observation.backingEvents.filter((row) => row[0] >= begin && row[0] <= end),
      created = included.reduce((sum, row) => sum + row[1], 0),
      reused = included.reduce((sum, row) => sum + row[2], 0),
      sdkReuses = completed.filter((row) => row[1] === 2).length,
      work =
        mode === 'backing'
          ? included.length > 0 && reused > 0 && sdkReuses > 0
          : included.length > 0 && created > 0;
    if (requireTimedWork && !work)
      fail('no proven import/reuse during the complete movement window');
    return {
      column: check.column,
      completeSeconds: included.length,
      created,
      reused,
      sdkCompletedReuses: sdkReuses,
      nativeWork: work,
    };
  });
  return {
    mode,
    created: native.created,
    reused: native.reused,
    destroyed: native.destroyed,
    peakObjects: native.peakObjects,
    peakBytes: native.peakBytes,
    closed: true,
    nativeDuringEveryLeg: timed.length ? timed.every((row) => row.nativeWork) : null,
    timed,
    scope:
      'independent native import/reuse QPC buckets and SDK producer-result totals; live backing zero after checked drain; not GPU-time or physical-display acceptance',
  };
}
