// SPDX-License-Identifier: BSD-3-Clause
// One temporary source fixture and bounded fresh owners. Reports stay in RAM;
// withRnwFrameFixture restores App.tsx and removes its directory on every exit.
import path from 'node:path';
import { spawn } from 'node:child_process';
import { runRnwFrameProbe } from './run-rnw-frame-probe.mjs';

const root = path.resolve(import.meta.dirname, '../..'),
  mode = process.argv[2] ?? 'legacy',
  cycle = process.argv.includes('--cycle'),
  fullInput = mode === 'combined' || process.argv.includes('--full-input'),
  rounds = Number(process.argv.find((arg) => arg.startsWith('--rounds='))?.slice(9) ?? 1),
  trials = Number(process.argv.find((arg) => arg.startsWith('--trials='))?.slice(9) ?? 1);
if (!['legacy', 'path', 'paint', 'composition', 'semantics', 'combined'].includes(mode))
  throw Error('Choose one explicit scene candidate');
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 3 || (!cycle && rounds !== 1))
  throw Error('Choose one to three owned Gallery/mixed/Gallery rounds');
const probeOptions = {
  inputGeometry: false,
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
  try {
    if (cycle) await sampleMemory('opened');
    for (let round = 1; round <= rounds; round++) {
      const phase = (name) => (rounds === 1 ? name : name + '-' + round);
      await scroll(phase('gallery-before'));
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
try {
  await runRnwFrameProbe(root, {
    probeOptions,
    trials,
    reuseManifestSha256: process.argv.find((arg) => arg.startsWith('--reuse='))?.slice(8),
    onStarted(started) {
      motion.clear();
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
        last?.inputGeometry?.available ||
        allCandidates.some(
          (stage) => !required.includes(stage) && last?.cumulativeWorkCounts?.[stage]?.total > 0,
        )
      )
        throw Error('Diagnostic snapshot enabled a candidate outside the selected mode');
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
      trial: owned.trial,
      normalClose,
      retainedMotion: rows.length,
      lifetimeSamples: lifetimes.length,
      lifetimeFirst,
      lifetimeLast: lifetimes.at(-1),
      picturePeak,
      nativeMetadataLast: last?.nativeMetadata,
      memory,
      memoryScope:
        'Windows current-process GPU performance counters are raw checkpoints, not allocation accounting or resident-byte proof; process memory is separate from Picture/metadata costs',
      checks: summary,
      work: last?.cumulativeWorkCounts,
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
}
