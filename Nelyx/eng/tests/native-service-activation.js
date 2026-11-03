// SPDX-License-Identifier: BSD-3-Clause
// Validate independent native commit counts against the SDK fallback report.
// Availability and an explicitly selected option never prove execution.
export function geometryActivationCollector() {
  const lines = [],
    buffers = new Map();
  let invalid = false;
  const retain = (line) => {
    if (
      !/NELYX_INPUT_GEOMETRY_STATUS |NELYX_RETAINED_GEOMETRY_NATIVE |NELYX_NATIVE_SERVICE_USAGE |NELYX_NATIVE_SERVICE_BINS /.test(
        line,
      )
    )
      return;
    if (line.length > 5000 || lines.length >= 128) {
      invalid = true;
      return;
    }
    lines.push(line);
  };
  return {
    observe(chunk, stream = 'stdout') {
      let value = (buffers.get(stream) ?? '') + chunk,
        end;
      while ((end = value.indexOf('\n')) >= 0) {
        retain(value.slice(0, end).replace(/\r$/, ''));
        value = value.slice(end + 1);
      }
      if (value.length > 65536) {
        invalid = true;
        value = '';
      }
      buffers.set(stream, value);
    },
    finish() {
      for (const value of buffers.values()) retain(value);
      buffers.clear();
      if (invalid) throw Error('Native activation observations overflowed or were truncated');
      return lines.slice();
    },
  };
}
export function verifyGeometryActivation(
  lines,
  { mode, requireEditors = false, minimumCoverage = 0.95 },
) {
  if (!['ts', 'retained'].includes(mode)) throw Error('Choose an explicit input geometry mode');
  if (!Number.isFinite(minimumCoverage) || minimumCoverage < 0 || minimumCoverage > 1)
    throw Error('Invalid native coverage requirement');
  if (
    !Array.isArray(lines) ||
    lines.length > 128 ||
    lines.some((line) => typeof line !== 'string' || line.length > 5000)
  )
    throw Error('Invalid or truncated native service activation observations');
  const read = (prefix) =>
      lines
        .filter((line) => line.includes(prefix))
        .map((line) => JSON.parse(line.slice(line.indexOf(prefix) + prefix.length).trim())),
    native = read('NELYX_RETAINED_GEOMETRY_NATIVE '),
    status = read('NELYX_INPUT_GEOMETRY_STATUS '),
    requests = status.filter((row) => row.kind === 'request'),
    reports = status.filter((row) => row.kind === 'execution');
  if (
    status.some((row) => ['experiment', 'manual', 'manual-selection'].includes(row.kind)) ||
    read('NELYX_NATIVE_SERVICE_USAGE ').length ||
    read('NELYX_NATIVE_SERVICE_BINS ').length
  )
    throw Error('Native experiment requires its dedicated activation and timing verifier');
  if (requests.length !== 1) throw Error('Native engine has no unique requested-mode report');
  const requested = requests[0];
  const requestFields = new Set([
    'schema',
    'kind',
    'ownerGeneration',
    'inputGeometry',
    'sceneComposition',
    'semanticsGeometry',
    'sceneBatch',
  ]);
  if (
    Object.keys(requested).some((name) => !requestFields.has(name)) ||
    !Number.isSafeInteger(requested.ownerGeneration) ||
    requested.ownerGeneration < 0 ||
    requested.schema !== 1 ||
    requested.inputGeometry !== mode ||
    requested.sceneBatch !== 'none' ||
    requested.sceneComposition !== false ||
    requested.semanticsGeometry !== false
  )
    throw Error(
      'Native engine unexpectedly enabled a C++ candidate outside the selected comparison mode',
    );
  if (mode === 'ts') {
    if (native.length || reports.length)
      throw Error('TS comparison unexpectedly enabled a retained C++ service');
    return { mode: 'ts', requested: false, executed: false };
  }
  if (reports.length !== 1)
    throw Error('Requested retained C++ mode has no unique SDK execution/fallback report');
  const report = reports[0],
    valid = (x) => Number.isSafeInteger(x) && x >= 0;
  if (
    report.schema !== 1 ||
    report.mode !== 'retained' ||
    report.ownerGeneration !== requested.ownerGeneration ||
    report.closed !== true ||
    ![
      report.ownerGeneration,
      report.sessionsCreated,
      report.committedFrames,
      report.fallbackFrames,
    ].every(valid) ||
    !report.fallbackReasons ||
    Object.values(report.fallbackReasons).some((x) => !valid(x)) ||
    Object.values(report.fallbackReasons).reduce((sum, x) => sum + x, 0) !==
      report.fallbackFrames ||
    report.sessionsCreated !== native.length
  )
    throw Error('Malformed retained C++ execution/fallback report');
  const sessions = new Set();
  let commits = 0,
    queries = 0;
  for (const row of native) {
    if (
      row.schema !== 1 ||
      !valid(row.session) ||
      row.session < 1 ||
      sessions.has(row.session) ||
      row.ownerGeneration !== report.ownerGeneration ||
      ![row.prepares, row.commits, row.editorQueries, row.retainedBytes].every(valid) ||
      row.commits > row.prepares ||
      row.retainedBytes !== 0 ||
      row.closed !== true
    )
      throw Error('Native retained C++ commits or retirement were not verified');
    sessions.add(row.session);
    commits += row.commits;
    queries += row.editorQueries;
  }
  if (commits !== report.committedFrames) throw Error('SDK/native C++ commit counts disagree');
  const eligible = commits + report.fallbackFrames,
    coverage = eligible ? commits / eligible : null;
  if (requireEditors && (!queries || !commits || coverage < minimumCoverage))
    throw Error(
      'Requested C++ geometry did not execute sufficient real editor work: ' +
        JSON.stringify({ commits, queries, coverage, fallbackReasons: report.fallbackReasons }),
    );
  return {
    mode: 'retained',
    requested: true,
    executed: queries > 0,
    nativeCommits: commits,
    editorQueries: queries,
    fallbackFrames: report.fallbackFrames,
    fallbackReasons: report.fallbackReasons,
    coverage,
    closed: true,
  };
}
