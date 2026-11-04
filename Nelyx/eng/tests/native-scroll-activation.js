// SPDX-License-Identifier: BSD-3-Clause
export const scrollModes = [
  'scroll-input',
  'scroll-frame',
  'pointer-targets',
  'section-lifetime',
  'scroll',
];
export function verifyNativeScrollActivation(
  lines,
  { mode, requireNativeWork = false, checks = [] } = {},
) {
  if (![...scrollModes, 'all'].includes(mode)) throw new Error('Invalid scroll mode');
  const read = (prefix) =>
      lines
        .filter((line) => line.includes(prefix))
        .map((line) => JSON.parse(line.slice(line.indexOf(prefix) + prefix.length))),
    report = read('NELYX_INPUT_GEOMETRY_STATUS ').filter((row) =>
      ['manual', 'experiment'].includes(row.kind),
    ),
    usage = read('NELYX_NATIVE_SCROLL_USAGE '),
    hosts = read('NELYX_SCROLL_HOST_USAGE ');
  if (report.length !== 1 || usage.length !== 1 || hosts.length !== 1)
    throw new Error('Missing/duplicate native scroll observations');
  const sdk = report[0].engine?.scroll,
    native = usage[0],
    valid = (n) => Number.isSafeInteger(n) && n >= 0,
    expected = {
      input: ['all', 'scroll', 'scroll-input'].includes(mode),
      frame: ['all', 'scroll', 'scroll-frame'].includes(mode),
      pointer: ['all', 'scroll', 'pointer-targets'].includes(mode),
      section: ['all', 'scroll', 'section-lifetime'].includes(mode),
    };
  if (
    !sdk ||
    sdk.closed !== true ||
    native.schema !== 1 ||
    native.ownerGeneration !== report[0].ownerGeneration ||
    native.mode !== mode ||
    native.overflow !== false ||
    !Number.isFinite(native.beganQpcMs) ||
    !Number.isFinite(native.endedQpcMs) ||
    native.endedQpcMs <= native.beganQpcMs ||
    !['counters-only', 'qpc-buckets'].includes(native.timing) ||
    !Array.isArray(native.totals) ||
    native.totals.length !== 8 ||
    !native.totals.every(valid) ||
    Object.entries(expected).some(([key, value]) => sdk.selected[key] !== value) ||
    !Array.isArray(sdk.host) ||
    sdk.host.length !== 13 ||
    sdk.host[11] ||
    sdk.host[12] ||
    !sdk.host.every(valid) ||
    sdk.host[6] ||
    sdk.host[7] ||
    sdk.host[9] ||
    sdk.host[1] !== sdk.host[3] + sdk.host[10]
  )
    throw new Error('Unretired/malformed native scroll evidence');
  const n = native.totals,
    pointer = sdk.pointer,
    section = sdk.section,
    host = hosts[0];
  if (
    host.schema !== 1 ||
    host.ownerGeneration !== native.ownerGeneration ||
    host.overflow !== false ||
    host.pendingPackets !== 0 ||
    host.pendingBatches !== 0 ||
    host.pendingStaged !== 0 ||
    host.pendingJsPackets !== 0 ||
    host.mailboxOwners !== 0 ||
    !valid(host.retiredPackets) ||
    host.retiredPackets !== sdk.host[10] ||
    host.timing !== native.timing ||
    !Number.isFinite(host.beganQpcMs) ||
    !Number.isFinite(host.endedQpcMs) ||
    host.endedQpcMs <= host.beganQpcMs ||
    !Array.isArray(host.totals) ||
    host.totals.length !== 8 ||
    !host.totals.every(valid) ||
    !valid(host.binCount)
  )
    throw new Error('Missing/unretired host timing evidence');
  function bins(prefix, totals, begin, end) {
    const chunks = read(prefix),
      rows = [],
      sum = Array(8).fill(0);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (
        chunk.schema !== 1 ||
        chunk.index !== i ||
        !Array.isArray(chunk.rows) ||
        !chunk.rows.length ||
        chunk.rows.length > 16
      )
        throw new Error('Invalid scroll timing chunk');
      for (const row of chunk.rows) {
        if (
          !Array.isArray(row) ||
          row.length !== 9 ||
          !row.every(valid) ||
          (rows.length && row[0] <= rows.at(-1)[0]) ||
          row[0] < Math.floor(begin / 1000) ||
          row[0] > Math.floor(end / 1000)
        )
          throw new Error('Invalid scroll QPC bucket');
        rows.push(row);
        for (let lane = 0; lane < 8; lane++) sum[lane] += row[lane + 1];
      }
    }
    if (
      native.timing === 'counters-only'
        ? rows.length !== 0
        : sum.some((count, lane) => count !== totals[lane])
    )
      throw new Error('Incomplete scroll timing evidence');
    return rows;
  }
  const nativeRows = bins('NELYX_NATIVE_SCROLL_BINS ', n, native.beganQpcMs, native.endedQpcMs),
    hostRows = bins('NELYX_SCROLL_HOST_BINS ', host.totals, host.beganQpcMs, host.endedQpcMs);
  if (hostRows.length !== host.binCount) throw new Error('Host QPC bucket count differs');
  if (
    expected.pointer
      ? !pointer ||
        !pointer.closed ||
        pointer.strategy !== 'linear-prefix' ||
        pointer.prefixQueries !== pointer.queries ||
        !valid(pointer.prefixNodes) ||
        pointer.prefixNodes > pointer.visited ||
        pointer.queries !== n[0] ||
        pointer.visited !== n[1] ||
        pointer.bytes - pointer.queries * 96 !== n[2]
      : n.slice(0, 3).some(Boolean)
  )
    throw new Error('SDK/native pointer counts differ');
  if (
    expected.section
      ? !section ||
        section.decisions !== n[3] ||
        section.visited !== n[4] ||
        section.retain !== n[5] ||
        section.evict !== n[6] ||
        section.prepare !== n[7] ||
        section.appliedRetain > section.retain ||
        section.appliedEvict > section.evict ||
        section.appliedPrepare > section.prepare
      : n.slice(3).some(Boolean)
  )
    throw new Error('SDK/native section counts differ');
  if (
    expected.frame &&
    (!sdk.credit ||
      !Object.values(sdk.credit).every(valid) ||
      sdk.credit.wakes > sdk.host[8] ||
      sdk.credit.submissions > sdk.credit.attempts)
  )
    throw new Error('SDK/native credit counts differ');
  const observed = (count, fallbacks = 0) =>
      count ? 'observed' : fallbacks ? 'fallbackOnly' : 'notObserved',
    modules = {
      ...(expected.input
        ? { 'scroll-input': observed(sdk.host[0] && sdk.host[1] && sdk.host[2] && sdk.host[3]) }
        : {}),
      ...(expected.frame
        ? { 'scroll-frame': observed(sdk.host[8] && sdk.credit.submissions) }
        : {}),
      ...(expected.pointer
        ? { 'pointer-targets': observed(n[0] && n[1], pointer.tsFallbacks) }
        : {}),
      ...(expected.section ? { 'section-lifetime': observed(n[3] && section.appliedRetain) } : {}),
    };
  if (requireNativeWork && Object.values(modules).some((value) => value !== 'observed'))
    throw new Error('No relevant native work in selected scroll module');
  const timed = checks.map((check) => {
    const begin = check.nativeBeginMs,
      end = check.nativeEndMs;
    if (
      native.timing !== 'qpc-buckets' ||
      !Number.isFinite(begin) ||
      !Number.isFinite(end) ||
      end - begin < 3000 ||
      begin < Math.max(host.beganQpcMs, native.beganQpcMs) ||
      end > Math.min(host.endedQpcMs, native.endedQpcMs)
    )
      throw new Error('Scroll input interval outside native timing owners');
    const included = (rows) =>
        rows
          .filter((row) => row[0] * 1000 >= begin && (row[0] + 1) * 1000 <= end)
          .reduce((counts, row) => counts.map((n, i) => n + row[i + 1]), Array(8).fill(0)),
      a = included(nativeRows),
      b = included(hostRows),
      observed = {
        ...(expected.input ? { 'scroll-input': !!(b[0] && b[1] && b[2] && b[3]) } : {}),
        ...(expected.frame ? { 'scroll-frame': !!(b[4] && b[6] && b[7]) } : {}),
        ...(expected.pointer ? { 'pointer-targets': !!(a[0] && a[1]) } : {}),
        ...(expected.section ? { 'section-lifetime': !!a[3] } : {}),
      };
    return { native: a, host: b, observed, nativeWork: Object.values(observed).every(Boolean) };
  });
  return {
    modules,
    native: n,
    sdk,
    timing: native.timing,
    timed,
    nativeDuringEveryLeg: timed.length ? timed.every((leg) => leg.nativeWork) : null,
    performanceAccepted: false,
  };
}
