// SPDX-License-Identifier: BSD-3-Clause
// One temporary source fixture and bounded fresh owners. Reports stay in RAM;
// withRnwFrameFixture restores App.tsx and removes its directory on every exit.
import path from 'node:path';
import { spawn } from 'node:child_process';
import { runRnwFrameProbe } from './run-rnw-frame-probe.mjs';
import { refreshSampleWindowsSdk } from './run-sample-windows.mjs';
import { summarizeScrollRange } from './tests/rnw-frame-records.js';

const root = path.resolve(import.meta.dirname, '../..'),
  mode = process.argv[2] ?? 'legacy',
  cycle = process.argv.includes('--cycle'),
  fullInput = mode === 'combined' || process.argv.includes('--full-input'),
  rounds = Number(process.argv.find((arg) => arg.startsWith('--rounds='))?.slice(9) ?? 1),
  trials = Number(process.argv.find((arg) => arg.startsWith('--trials='))?.slice(9) ?? 1);
const ranges = process.argv.includes('--ranges');
if (ranges && !cycle) throw Error('--ranges requires an owned Gallery/mixed cycle');
if (!['legacy', 'retained', 'path', 'paint', 'composition', 'semantics', 'combined'].includes(mode))
  throw Error('Choose one explicit scene candidate');
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 3 || (!cycle && rounds !== 1))
  throw Error('Choose one to three owned Gallery/mixed/Gallery rounds');
const probeOptions = {
  inputGeometry: mode === 'retained' ? 'retained' : false,
  scrolls: true,
  ...(mode === 'path' || mode === 'paint' ? { sceneBatch: mode } : {}),
  ...(mode === 'composition' || mode === 'combined' ? { sceneComposition: true } : {}),
  ...(mode === 'semantics' || mode === 'combined' ? { semanticsGeometry: true } : {}),
  ...(mode === 'combined' ? { sceneBatch: 'all' } : {}),
};
function powershell(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', ...args], {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const consume = (data) => {
      output = (output + data.toString()).slice(-2 * 1024 * 1024);
    };
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    const timer = setTimeout(() => child.kill(), 1_200_000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code !== 0)
        reject(Error('Owned diagnostic helper exited ' + code + '\n' + output.slice(-8000)));
      else resolve(output);
    });
  });
}
function readReport(output, prefix) {
  const line = output.split(/\r?\n/).find((line) => line.startsWith(prefix));
  if (!line) throw Error('Missing diagnostic ' + prefix);
  return JSON.parse(line.slice(prefix.length));
}
const motion = new Map();
const directScrolls = new Map();
const rangeEvidence = [];
const sceneSources = Object.create(null);
const lifetimes = [];
let owned,
  lifetimeFirst,
  picturePeak,
  driving,
  helperFailure,
  last,
  trace,
  checks = [],
  memory = [];
async function drive(started) {
  if (owned) throw Error('Diagnostic launched more than one native owner');
  if (
    !Number.isSafeInteger(started.pid) ||
    started.pid <= 0 ||
    !path.isAbsolute(started.executable)
  )
    throw Error('Diagnostic native owner identity is invalid');
  owned = started;
  const sampleMemory = async (phase) => {
    const value = JSON.parse(
      await powershell([
        '-Command',
        `$taskOwner=Get-Process -Id ${started.pid} -ErrorAction Stop; $taskGpu=@(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUProcessMemory | Where-Object Name -like 'pid_${started.pid}_*'); [ordered]@{phase='${phase}';pid=$taskOwner.Id;qpcMs=[Diagnostics.Stopwatch]::GetTimestamp()*1000.0/[Diagnostics.Stopwatch]::Frequency;privateBytes=$taskOwner.PrivateMemorySize64;workingSetBytes=$taskOwner.WorkingSet64;gpuObserved=$taskGpu.Count -gt 0;gpuCommitted=($taskGpu|Measure-Object TotalCommitted -Sum).Sum;gpuDedicated=($taskGpu|Measure-Object DedicatedUsage -Sum).Sum;gpuShared=($taskGpu|Measure-Object SharedUsage -Sum).Sum}|ConvertTo-Json -Compress`,
      ]),
    );
    memory.push(value);
  };
  const scroll = async (phase) => {
    const output = await powershell([
      '-File',
      path.join(import.meta.dirname, 'tests/windows-continuous-scroll.ps1'),
      '-Executable',
      started.executable,
      '-TargetProcessId',
      String(started.pid),
      '-Page',
      'material',
      '-WindowTransitions',
      '-Maximized',
      '-MouseMotion',
      '-InputDurationMs',
      '5000',
      '-InputXFraction',
      '0.667',
      ...(process.argv.includes('--unprimed') ? ['-Unprimed'] : []),
    ]);
    const report = readReport(output, 'CONTINUOUS_SCROLL ');
    checks.push(...report.checks.map((check) => ({ ...check, phase })));
  };
  const sweep = async (page, fraction, legMs, existing = false) => {
    if (page === 'mixed') {
      const frame = last?.latestFrame?.identity.frame;
      const prepared = await powershell([
        '-File',
        path.join(import.meta.dirname, 'tests/windows-continuous-scroll.ps1'),
        '-Executable',
        started.executable,
        '-TargetProcessId',
        String(started.pid),
        '-Page',
        'mixed',
        '-Maximized',
        '-CadenceOnly',
        '-FocusEditor',
        '-PrepareOnly',
      ]);
      const preparedAt = readReport(prepared, 'CONTINUOUS_PREPARED ').nativeMs;
      if (!Number.isFinite(preparedAt)) throw Error('Missing mixed preparation clock');
      const deadline = Date.now() + 10000;
      while (
        (last?.latestFrame?.identity.frame === frame ||
          last?.inputGeometry?.providers < 12 ||
          (last?.lifetimes?.nativeMs ?? 0) < preparedAt + 250 ||
          ([...directScrolls.values()].at(-1)?.nativeMs ?? 0) < preparedAt) &&
        Date.now() < deadline
      )
        await new Promise((resolve) => setTimeout(resolve, 50));
      if (([...directScrolls.values()].at(-1)?.nativeMs ?? 0) < preparedAt)
        throw Error('Missing fresh post-focus mixed extent observation');
      existing = true;
    }
    const width = last?.lifetimes?.logicalWidth;
    const latest =
      [...directScrolls.values()].at(-1)?.scrolls?.values ??
      [...motion.values()].at(-1)?.scrolls?.values ??
      [];
    const viewport = latest.find(
      (value) =>
        value[6] === 1 &&
        value[3] > 0 &&
        width * fraction >= value[4] - value[5] / 2 &&
        width * fraction <= value[4] + value[5] / 2,
    );
    if (!viewport || !Number.isFinite(width))
      throw Error(
        'Full-range sweep requires an observed painted viewport at the actual input column',
      );
    const extent = viewport[3];
    const output = await powershell([
      '-File',
      path.join(import.meta.dirname, 'tests/windows-continuous-scroll.ps1'),
      '-Executable',
      started.executable,
      '-TargetProcessId',
      String(started.pid),
      '-Page',
      page,
      '-Maximized',
      '-CadenceOnly',
      '-InputXFraction',
      String(fraction),
      '-InputDurationMs',
      String(legMs === 4000 ? 12000 : 6000),
      '-RangeExtent',
      String(extent),
      '-RangeLegDurationMs',
      String(legMs),
      '-RangeExtraExtent',
      '0',
      ...(existing ? ['-ExistingPage'] : []),
      ...(page === 'mixed' ? ['-ReturnToGallery'] : []),
    ]);
    const report = readReport(output, 'CONTINUOUS_SCROLL '),
      begin = Math.min(...report.checks.map((row) => row.nativeBeginMs)),
      timedEnd = Math.max(...report.checks.map((row) => row.nativeBeginMs + row.surfaceDurationMs));
    // Reports arrive every two seconds. The sender completing does not mean
    // its final offsets have been delivered to this observer yet. Await that
    // receipt OUTSIDE input timing, including stable post-input observations.
    const deadline = Date.now() + 10000;
    while ((last?.lifetimes?.nativeMs ?? 0) < timedEnd + 900 && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 50));
    if ((last?.lifetimes?.nativeMs ?? 0) < timedEnd + 900)
      throw Error('Missing fresh post-input source endpoint observation');
    const end = last.lifetimes.nativeMs;
    const callbackValues = [...motion.values()]
      .filter((row) => row.nativeMs >= begin && row.nativeMs <= end)
      .flatMap((row) => row.scrolls.values.filter((value) => value[0] === viewport[0]));
    const values = [...directScrolls.values()]
      .filter((row) => row.nativeMs >= begin && row.nativeMs <= end)
      .flatMap((row) => row.scrolls.values.filter((value) => value[0] === viewport[0]));
    const observed = {
      page,
      fraction,
      legMs,
      extent,
      endpointAllowance: 0,
      ...summarizeScrollRange(values, extent),
      callbackSamples: callbackValues.length,
      scope:
        'live TS offsets sampled at most 10Hz during input and post-input settling; native QPC/owner/backing attached; callback-associated offsets are separate and can lag capture; not ordinary FPS or display receipt',
    };
    rangeEvidence.push(observed);
    console.log('MOTION_RANGE', JSON.stringify(observed));
    if (observed.extentChanged) {
      console.log('MOTION_RANGE_COLD_EXTENT', JSON.stringify(observed));
    }
    return observed;
  };
  try {
    if (cycle) await sampleMemory('opened');
    for (let round = 1; round <= rounds; round++) {
      const phase = (name) => (rounds === 1 ? name : name + '-' + round);
      await scroll(phase('gallery-before'));
      if (ranges) {
        for (const [fraction, leg] of [
          [0.4, 4000],
          [2 / 3, 1500],
        ]) {
          const observed = await sweep('material', fraction, leg);
          // Only a measured lazy-extent change permits one explicit warm
          // sweep. A stable-extent endpoint failure remains visible as failure.
          if (observed.extentChanged) await sweep('material', fraction, leg);
        }
      }
      if (cycle) {
        await sampleMemory(phase('gallery-before'));
        const output = await powershell([
          '-File',
          path.join(import.meta.dirname, 'tests/windows-mixed-input.ps1'),
          '-AppPid',
          String(started.pid),
          ...(fullInput ? [] : ['-ActionsOnly']),
          '-KoreanIme',
        ]);
        const input = readReport(output, 'MIXED_INPUT ');
        if (input.fields !== 12 || input.buttons !== 36 || input.ime.status !== 'PASS-scoped')
          throw Error('Candidate cycle did not exercise actual mixed input');
        if (fullInput && input.checks.filter((row) => row.osKeyWithoutRefocus).length !== 3)
          throw Error(
            'Candidate cycle did not retain editor input through three full-range wheel returns',
          );
        console.log('MOTION_CYCLE_INPUT', JSON.stringify(input));
        if (ranges) for (const leg of [4000, 1500]) await sweep('mixed', 2 / 3, leg);
        await sampleMemory(phase('mixed-returned'));
        await scroll(phase('gallery-after'));
        await sampleMemory(phase('gallery-after'));
      }
    }
    trace = JSON.parse(
      await powershell([
        '-File',
        path.join(import.meta.dirname, 'windows-input-trace.ps1'),
        '-TargetProcessId',
        String(started.pid),
        '-Raw',
      ]),
    );
  } finally {
    await powershell([
      '-Command',
      `$owned=Get-Process -Id ${started.pid} -ErrorAction SilentlyContinue; if($owned){[void]$owned.CloseMainWindow()}`,
    ]);
  }
}
let probeFailure;
if (!process.argv.some((arg) => arg.startsWith('--reuse=')))
  await refreshSampleWindowsSdk({ root, app: path.join(root, 'sample/nelyx-testbed-app-2') });
try {
  await runRnwFrameProbe(root, {
    probeOptions,
    trials,
    reuseManifestSha256: process.argv.find((arg) => arg.startsWith('--reuse='))?.slice(8),
    nativeInputs: process.argv.find((arg) => arg.startsWith('--native-inputs='))?.slice(16),
    onStarted(started) {
      motion.clear();
      directScrolls.clear();
      rangeEvidence.length = 0;
      for (const key of Object.keys(sceneSources)) delete sceneSources[key];
      lifetimes.length = 0;
      lifetimeFirst = undefined;
      picturePeak = { live: 0, cached: 0, estimatedBytes: 0 };
      owned = last = trace = helperFailure = undefined;
      checks = [];
      memory = [];
      driving = drive(started).catch((error) => {
        helperFailure = error;
      });
    },
    onObservation(report) {
      last = report;
      for (const row of report.directScrolls ?? []) {
        directScrolls.set(row.nativeMs, row);
        if (directScrolls.size > 512) directScrolls.delete(directScrolls.keys().next().value);
      }
      const scene = report.inputGeometry?.providers >= 12 ? 'mixed' : 'gallery';
      sceneSources[scene] = {
        means: report.retainedMeans,
        distributions: report.retainedDistributions,
        counts: report.retainedWorkCounts,
        callbackWork: report.retainedCallbackWork,
        retainedInputGeometry: report.retainedInputGeometry,
        retainedInputGeometryExecution: report.retainedInputGeometryExecution,
        nativeMs: report.lifetimes?.nativeMs,
        scope:
          'latest retained source-instrumented window classified by registered providers; contains cold and warm frames, never ordinary FPS',
      };
      if (report.lifetimes) {
        lifetimeFirst ??= report.lifetimes;
        const pictures = report.lifetimes.pictures;
        picturePeak.live = Math.max(picturePeak.live, pictures?.live ?? 0);
        picturePeak.cached = Math.max(picturePeak.cached, pictures?.cached ?? 0);
        picturePeak.estimatedBytes = Math.max(picturePeak.estimatedBytes, pictures?.bytes ?? 0);
        lifetimes.push(report.lifetimes);
        if (lifetimes.length > 64) lifetimes.shift();
      }
      for (const row of report.motionSamples ?? []) {
        const key = [
          row.identity.owner,
          row.identity.surface,
          row.identity.frame,
          row.identity.input,
        ].join(':');
        motion.set(key, row);
        if (motion.size > 2048) motion.delete(motion.keys().next().value);
      }
    },
    async onResult() {
      await driving;
      if (helperFailure) throw helperFailure;
      const required = {
        legacy: [],
        retained: ['input-geometry-jsi', 'input-geometry-retained-nodes'],
        path: ['scene-path-native'],
        paint: ['scene-clip-native', 'scene-paint-native'],
        composition: ['scene-compose-native'],
        semantics: ['semantics-geometry-native'],
        combined: [
          'scene-path-native',
          'scene-clip-native',
          'scene-paint-native',
          'scene-compose-native',
          'semantics-geometry-native',
        ],
      }[mode];
      if (required.some((stage) => !(last?.cumulativeWorkCounts?.[stage]?.total > 0)))
        throw Error(
          'Selected native candidate did not execute its required work: ' + required.join(','),
        );
      const allCandidates = [
        'scene-path-native',
        'scene-clip-native',
        'scene-paint-native',
        'scene-compose-native',
        'semantics-geometry-native',
      ];
      if (
        (mode !== 'retained' && last?.inputGeometry?.available) ||
        allCandidates.some(
          (stage) => !required.includes(stage) && last?.cumulativeWorkCounts?.[stage]?.total > 0,
        )
      )
        throw Error('Diagnostic snapshot enabled a candidate outside the selected mode');
      if (
        mode === 'retained' &&
        (!last?.inputGeometry?.apiSmokeExecuted ||
          last?.retainedInputGeometry?.[5] !== 1 ||
          last?.retainedInputGeometry?.slice(0, 5).some((value) => value !== 0))
      )
        throw Error('Retained geometry did not execute and close its numeric owner');
      const numeric =
        mode === 'combined'
          ? ['sceneComposition', 'semanticsGeometry']
          : mode === 'composition'
            ? ['sceneComposition']
            : mode === 'semantics'
              ? ['semanticsGeometry']
              : [];
      if (
        numeric.some(
          (name) =>
            !last?.nativeMetadata?.some(
              (row) =>
                row.name === name &&
                row.stats[5] === 1 &&
                row.stats.slice(0, 4).every((value) => value === 0),
            ),
        )
      )
        throw Error('Numeric candidate did not release its actual native metadata on close');
      summarize(true);
    },
  });
} catch (error) {
  probeFailure = error;
} finally {
  await driving;
}
if (probeFailure) {
  if (owned && checks.length) summarize(false);
  throw probeFailure;
}
if (helperFailure) throw helperFailure;
function summarize(normalClose) {
  if (!owned || !checks.length) throw Error('Diagnostic did not drive its native owner');
  const rows = [...motion.values()].filter((row) => Number.isFinite(row.nativeMs));
  const summary = checks.map((check) => ({
    phase: check.phase,
    direction: check.direction,
    packets: check.packets,
    primingPackets: check.primingPackets,
    primingDurationMs: check.primingDurationMs,
    inputPrecondition: check.inputPrecondition,
    maximumGapMs: check.maximumGapMs,
    maximumAllRegionsGapMs: check.maximumAllRegionsGapMs,
    maximumSurfaceGapMs: check.maximumSurfaceGapMs,
    surfaceInterval: (() => {
      const moving = rows
          .filter(
            (row) =>
              row.nativeMs >= check.nativeBeginMs &&
              row.nativeMs <= check.nativeBeginMs + check.surfaceDurationMs,
          )
          .sort((a, b) => a.nativeMs - b.nativeMs),
        intervals = [];
      let skippedPairs = 0,
        samePositionPairs = 0;
      for (let i = 1; i < moving.length; i++) {
        const before = moving[i - 1],
          after = moving[i];
        if (
          before.nativeView !== after.nativeView ||
          before.identity.surface !== after.identity.surface ||
          after.nativeSubmission !== before.nativeSubmission + 1
        ) {
          skippedPairs++;
          continue;
        }
        intervals.push(after.nativeMs - before.nativeMs);
        if (JSON.stringify(before.scrolls.values) === JSON.stringify(after.scrolls.values))
          samePositionPairs++;
      }
      intervals.sort((a, b) => a - b);
      return {
        n: intervals.length,
        p50: intervals[Math.floor(intervals.length * 0.5)] ?? null,
        p95: intervals[Math.floor(intervals.length * 0.95)] ?? null,
        p99: intervals[Math.floor(intervals.length * 0.99)] ?? null,
        max: intervals.at(-1) ?? null,
        above33_3ms: intervals.filter((v) => v > 33.3).length,
        above50ms: intervals.filter((v) => v > 50).length,
        skippedPairs,
        samePositionPairs,
        scope:
          'native QPC in this timed input window; only consecutive native submission ids; stationary/endpoint pairs counted separately, omitted joins excluded; source probe and desktop capture enabled',
      };
    })(),
    gaps: (check.primaryGaps ?? []).map((gap) => {
      const matching = rows.filter(
        (row) =>
          row.nativeView === gap.View &&
          row.identity.surface === gap.Surface &&
          row.nativeMs >= gap.NativeBeginMs &&
          row.nativeMs <= gap.NativeEndMs,
      );
      const offsets = new Map();
      for (const row of matching)
        for (const [id, pixels, min, max] of row.scrolls.values) {
          let values = offsets.get(id);
          if (!values)
            offsets.set(
              id,
              (values = {
                first: pixels,
                last: pixels,
                minPixels: pixels,
                maxPixels: pixels,
                min,
                max,
                changes: 0,
                samples: 0,
                atClamp: 0,
              }),
            );
          if (values.last !== pixels) values.changes++;
          values.last = pixels;
          values.minPixels = Math.min(values.minPixels, pixels);
          values.maxPixels = Math.max(values.maxPixels, pixels);
          values.samples++;
          if (pixels === min || pixels === max) values.atClamp++;
        }
      return { ...gap, matchingFrames: matching.length, offsets: Object.fromEntries(offsets) };
    }),
  }));
  console.log(
    'MOTION_JOINED',
    JSON.stringify({
      mode,
      cycle,
      fullInput,
      rounds,
      rangeEvidence,
      sceneSources,
      trial: owned.trial,
      normalClose,
      retainedMotion: rows.length,
      lifetimeSamples: lifetimes.length,
      lifetimeFirst,
      lifetimeLast: lifetimes.at(-1),
      picturePeak,
      nativeMetadataLast: last?.nativeMetadata,
      retainedInputGeometryLast: last?.retainedInputGeometry,
      retainedInputGeometryExecution: last?.retainedInputGeometryExecution,
      memory,
      memoryScope:
        'Windows current-process GPU performance counters are raw checkpoints, not allocation accounting or resident-byte proof; process memory is separate from Picture/metadata costs',
      checks: summary,
      work: last?.cumulativeWorkCounts,
      sourceMeans: last?.retainedMeans,
      sourceWork: last?.retainedWorkCounts,
      surfaceInterval: last?.surfaceInterval,
      retirementPoll: last?.retirementPoll,
      nativeFailures: trace?.entries
        ?.filter((row) =>
          ['sdk-drop', 'core-drop', 'wheel-surface-drop', 'frame-failed'].includes(row.stage),
        )
        .slice(-12),
      scope:
        'source-instrumented diagnostics joined by native view/surface/QPC; not normal FPS or scanout acceptance',
    }),
  );
  if (checks.some((check) => check.maximumGapMs > 350 || check.changesDuringInput < 10))
    process.exitCode = 2;
  if (ranges) {
    const latest = new Map(
      rangeEvidence.map((row) => [[row.page, row.fraction, row.legMs].join(':'), row]),
    );
    if (latest.size !== 4 || [...latest.values()].some((row) => !row.endpoints))
      process.exitCode = 2;
  }
}
