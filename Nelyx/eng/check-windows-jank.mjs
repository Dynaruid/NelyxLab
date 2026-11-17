import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { displayedMotion } from './windows-jank-metrics.ts';
import { buildNativeHost } from './build-native-hermes.mjs';
import {
  buildNativeApplication,
  verifyNativePackage,
} from '../sdk/tooling/cli/src/windows-native-runner.mjs';
import { buildNativeJscProbe } from './native-jsc-probe-build.mjs';
import { nativePackageEnvironment } from '../sdk/tooling/cli/src/windows-native-host.mjs';
import { windowsBuildInputs } from '../sdk/tooling/cli/src/windows-build-inputs.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const scenario = argument('--scenario', 'calendar'),
  runs = Number(argument('--runs', '3')),
  appName = argument('--app', 'demo'),
  hermesMode = argument('--hermes-mode', 'bytecode'),
  engine = argument('--engine', 'hermes'),
  jscMode = argument('--jsc-mode', 'interpreter');
const runtimeMode = engine === 'jsc' ? 'source' : hermesMode;
const runtimeIdentity = {
  engine,
  mode: runtimeMode,
  ...(engine === 'jsc' ? { jscMode } : { hermesMode }),
};
const hostExecutable = engine === 'jsc' ? 'NelyxJscHost.exe' : 'NelyxHermesHost.exe';
const app = path.join(
  root,
  appName === 'testbed' ? 'sample/nelyx-testbed-app-2' : 'sample/nelyx-demo-app',
);
const scrollScenario = ['gallery', 'list'].includes(scenario);
const screenEnabled =
  !process.argv.includes('--no-screen') && ['calendar', 'gallery', 'list'].includes(scenario);
if (
  !['calendar', 'gallery', 'boundaries', 'testbed', 'list'].includes(scenario) ||
  (scenario === 'list' && appName !== 'testbed') ||
  !['demo', 'testbed'].includes(appName) ||
  !['bytecode', 'static-aot'].includes(hermesMode) ||
  !['hermes', 'jsc'].includes(engine) ||
  !['interpreter', 'jit'].includes(jscMode) ||
  (engine === 'jsc' && hermesMode !== 'bytecode') ||
  !Number.isInteger(runs) ||
  runs < 1 ||
  runs > 30
)
  throw Error('Choose a supported scenario, bytecode/static-aot and runs in 1..30');
if (!process.argv.includes('--child')) {
  const deadline = Date.now() + 1_200_000;
  const batch = fs.mkdtempSync(path.join(root, '.tmp/jank-batch-'));
  const summary = path.join(batch, 'current.json'),
    results = [];
  try {
    for (let run = 1; run <= runs; run++) {
      console.log(
        'JANK_RUN ' +
          JSON.stringify({
            scenario,
            ...runtimeIdentity,
            run,
            runs,
          }),
      );
      await execute(
        'pwsh.exe',
        [
          '-NoProfile',
          '-File',
          path.join(root, 'Nelyx/eng/check-windows-jank.ps1'),
          '-RunOnce',
          '-Scenario',
          scenario,
          '-App',
          appName,
          '-HermesMode',
          hermesMode,
          '-Engine',
          engine,
          '-JscMode',
          jscMode,
          '-SummaryPath',
          summary,
          ...(!screenEnabled ? ['-NoScreen'] : []),
          ...(hermesMode === 'static-aot' ? ['-CompilerCache', path.join(batch, 'compiler')] : []),
        ],
        { cwd: root, timeout: Math.max(1, deadline - Date.now()) },
      );
      results.push(JSON.parse(fs.readFileSync(summary, 'utf8')));
    }
    console.log(
      'JANK_BATCH_RESULT ' +
        JSON.stringify({ scenario, app: appName, ...runtimeIdentity, runs: results }),
    );
    // Keep a small final comparison visible when a terminal truncates the
    // detailed per-input reports. Neither output is retained on disk.
    console.log(
      'JANK_COMPARISON_SUMMARY ' +
        JSON.stringify({
          scenario,
          app: appName,
          ...runtimeIdentity,
          runs: results.map((result) => ({
            identity: {
              ...result.identity,
              nativeAcceptance: result.identity.nativeAcceptance
                ? {
                    typePolicyAccepted: result.identity.nativeAcceptance.typePolicyAccepted,
                    wholeAppNativeAot: result.identity.nativeAcceptance.wholeAppNativeAot,
                    unclassified: result.identity.nativeAcceptance.unclassified,
                    unresolved: result.identity.nativeAcceptance.unresolved,
                  }
                : undefined,
            },
            measurementView: result.measurementView,
            performanceSample: result.performanceSample,
            displayed: result.displayed.map((phase) => ({
              name: phase.name,
              averageFpsLowerBound: phase.averageFpsLowerBound,
              frameIntervals: phase.frameIntervals,
              progressAtLeast100ms: phase.progressAtLeast100ms,
            })),
            phases: [...result.phases, ...result.galleryPhases].map((phase) => ({
              name: phase.name,
              pageDelta: phase.pageDelta,
              gestures: phase.gestures,
              accepted: phase.accepted,
              inputQueue: phase.inputQueue,
              inputToSurface: phase.inputToSurface,
              motion: phase.motion
                ? {
                    averageFps: phase.motion.averageFps,
                    frameIntervals: phase.motion.frameIntervals,
                    progressAtLeast100ms: phase.motion.progressAtLeast100ms,
                  }
                : undefined,
            })),
            exit: result.exit,
          })),
        }),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    removeOwned(batch, path.join(root, '.tmp'));
  }
  process.exit(process.exitCode ?? 0);
}
const summaryFile = argument('--summary-file', '');
const compilerCache = argument('--compiler-cache', '');
if (
  summaryFile &&
  (path.basename(summaryFile) !== 'current.json' ||
    !path.basename(path.dirname(summaryFile)).startsWith('jank-batch-') ||
    path.dirname(path.dirname(path.resolve(summaryFile))) !== path.join(root, '.tmp') ||
    fs.lstatSync(path.dirname(summaryFile)).isSymbolicLink() ||
    (fs.existsSync(summaryFile) && fs.lstatSync(summaryFile).isSymbolicLink()))
)
  throw Error('Summary path is outside this execution');
// One batch may reuse its current native object files. No compiler cache or
// diagnostic package survives the parent's finally, including failed runs.
if (
  compilerCache &&
  (hermesMode !== 'static-aot' ||
    path.basename(compilerCache) !== 'compiler' ||
    !path.basename(path.dirname(compilerCache)).startsWith('jank-batch-') ||
    path.dirname(path.dirname(path.resolve(compilerCache))) !== path.join(root, '.tmp') ||
    fs.lstatSync(path.dirname(compilerCache)).isSymbolicLink() ||
    (fs.existsSync(compilerCache) && fs.lstatSync(compilerCache).isSymbolicLink()))
)
  throw Error('Compiler cache is outside this execution');
const entry = path.join(app, '.windows-jank-probe.ts');
const output = path.join(app, '.nelyx/native-windows/windows-jank-probe');
const session = fs.mkdtempSync(path.join(root, '.tmp/calendar-fast-session-'));
const capture = path.join(session, 'calendar.png');
const controller = new AbortController(),
  children = new Set(),
  phases = [],
  drivers = [],
  snapshots = [];
const plans = [
  { Count: 6, MoveMs: 12, GapMs: 24, Direction: 1 },
  { Count: 6, MoveMs: 6, GapMs: 16, Direction: 1 },
  { Count: 12, MoveMs: 6, GapMs: 16, Direction: -1 },
];
const wheels = [
  // Same +/-1200 total delta, spread over ~817ms instead of ten 90ms notches.
  { Count: 50, Delta: -24, InputHz: 60 },
  { Count: 50, Delta: 24, InputHz: 60 },
  { Count: 50, Delta: -24, InputHz: 60 },
];
const galleryPhases = [];
const listSnapshots = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let native,
  nativeExit,
  failure,
  queue = Promise.resolve(),
  begun = false,
  finished = false,
  exitReceipt,
  boundaryResult,
  galleryReady = false,
  editorFinal = false,
  ownsEntry = false,
  ownsOutput = false;
let screenChild, screenExit, screenData, markerCost, identity;
let displayed = [];
let currentView, measurementView;
const screenStop = path.join(session, 'screen.stop'),
  screenReady = path.join(session, 'screen.ready'),
  screenOutput = path.join(session, 'screen.json');
async function startScreen() {
  measurementView = currentView;
  if (!screenEnabled) return;
  screenChild = spawn(
    'pwsh.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      path.join(root, 'Nelyx/eng/windows-jank-screen.ps1'),
      '-Package',
      output,
      '-HostExecutable',
      hostExecutable,
      '-StopPath',
      screenStop,
      '-ReadyPath',
      screenReady,
      '-OutputPath',
      screenOutput,
    ],
    { cwd: root, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  children.add(screenChild);
  let error = '';
  screenChild.stderr.on('data', (chunk) => {
    error = (error + chunk).slice(-4096);
  });
  screenExit = new Promise((resolve, reject) => {
    screenChild.once('error', reject);
    screenChild.once('close', (code) => {
      children.delete(screenChild);
      resolve({ code, error });
    });
  });
  for (let attempt = 0; attempt < 30 && !fs.existsSync(screenReady); attempt++) {
    if (screenChild.exitCode !== null) throw Error('Screen observer failed: ' + error);
    await pause(100);
  }
  if (!fs.existsSync(screenReady)) throw Error('Screen observer did not become ready');
}
async function stopScreen() {
  if (!screenEnabled || screenData) return;
  fs.writeFileSync(screenStop, 'stop');
  const stopped = await screenExit;
  if (stopped.code !== 0) throw Error('Screen observer failed: ' + stopped.error);
  screenData = JSON.parse(fs.readFileSync(screenOutput, 'utf8'));
  displayed = [...phases, ...galleryPhases].map((phase) => ({
    name: phase.name,
    ...displayedMotion(phase.motion, screenData),
  }));
  console.log(
    'JANK_DISPLAY_RESULT ' +
      JSON.stringify({
        captures: screenData.Captures,
        invalid: screenData.Invalid,
        phases: displayed,
      }),
  );
}
const timeout = setTimeout(() => {
  failure ??= Error('20 minute calendar validation timeout');
  controller.abort(failure);
  for (const child of children) child.kill();
}, 1_200_000);
const abort = () => {
  failure ??= Error('Calendar validation interrupted');
  controller.abort(failure);
  for (const child of children) child.kill();
};
process.once('SIGINT', abort);
process.once('SIGTERM', abort);
function lines(stream, handler) {
  let text = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    text += chunk;
    if (text.length > 65536) throw Error('Native line budget exceeded');
    let at;
    while ((at = text.indexOf('\n')) >= 0) {
      const line = text.slice(0, at).trim();
      text = text.slice(at + 1);
      if (line) handler(line);
    }
  });
  stream.on('end', () => {
    if (text.trim()) handler(text.trim());
  });
}
async function ui(action, options = {}) {
  if (controller.signal.aborted) throw controller.signal.reason;
  const args = [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(root, 'Nelyx/eng/windows-jank-input.ps1'),
    '-Package',
    output,
    '-HostExecutable',
    hostExecutable,
    '-Action',
    action,
  ];
  for (const [key, value] of Object.entries(options)) args.push('-' + key, String(value));
  const child = spawn('pwsh.exe', args, {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    signal: controller.signal,
  });
  children.add(child);
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    if (stdout.length > 32768) child.kill();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
    if (stderr.length > 32768) child.kill();
  });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  children.delete(child);
  if (code !== 0)
    throw Error('PowerShell ' + action + ' failed (' + code + '): ' + stderr + ' ' + stdout);
  for (const line of stdout.trim().split(/\r?\n/)) {
    if (!line) continue;
    if (line.startsWith('FAST_UI_SWIPES ') || line.startsWith('GALLERY_UI_WHEEL ')) {
      const driver = JSON.parse(line.slice(line.indexOf(' ') + 1));
      const timing = driver.Timing;
      if (
        !timing?.CadenceValid ||
        timing.Hz !== 60 ||
        timing.Injected !== timing.ScheduledMs.length ||
        timing.MaxLatenessMs > timing.PeriodMs / 4 ||
        timing.MaxIntervalErrorMs > timing.PeriodMs / 4
      )
        throw Error('Invalid 60Hz input pacing: ' + JSON.stringify(timing));
      drivers.push(driver);
      console.log(
        line.slice(0, line.indexOf(' ')) +
          ' ' +
          JSON.stringify({
            count: driver.Count,
            totalDelta: driver.TotalDelta,
            movesPerGesture: driver.MovesPerGesture,
            scheduledMoveMs: driver.ScheduledMoveMs,
            effectiveHz: timing.EffectiveHz,
            injected: timing.Injected,
            maxLatenessMs: timing.MaxLatenessMs,
            maxIntervalErrorMs: timing.MaxIntervalErrorMs,
          }),
      );
    } else console.log(line);
    if (line.startsWith('FAST_UI_SNAPSHOT ')) snapshots.push(JSON.parse(line.slice(17)));
    if (line.startsWith('LIST_UI_SNAPSHOT ')) listSnapshots.push(JSON.parse(line.slice(17)));
  }
}
function enqueue(task) {
  queue = queue
    .then(async () => {
      if (failure) throw failure;
      await task();
    })
    .catch((error) => {
      failure ??= error;
      console.error('FAST_VALIDATION_ERROR ' + String(error.stack ?? error));
      native?.kill();
    });
}
function publicMotion(motion) {
  if (!motion) return motion;
  const { framePositions: _positions, ...summary } = motion;
  return summary;
}
function onLine(line) {
  if (line.startsWith('NELYX_NATIVE_VIEW '))
    currentView = JSON.parse(line.slice('NELYX_NATIVE_VIEW '.length));
  if (line.startsWith('NELYX_NATIVE_SCREEN_MARKER '))
    markerCost = JSON.parse(line.slice('NELYX_NATIVE_SCREEN_MARKER '.length));
  if (
    line.startsWith('FAST_') ||
    line.startsWith('NATIVE_BOUNDARY_') ||
    line.startsWith('GALLERY_') ||
    line.startsWith('NELYX_NATIVE_EXIT') ||
    line.startsWith('NELYX_NATIVE_SCREEN_MARKER') ||
    line.startsWith('NELYX_NATIVE_VIEW ') ||
    line.includes('ERROR')
  )
    if (line.startsWith('FAST_PHASE_RESULT ') || line.startsWith('GALLERY_PHASE_RESULT ')) {
      const at = line.indexOf(' '),
        result = JSON.parse(line.slice(at + 1));
      console.log(
        line.slice(0, at) +
          ' ' +
          JSON.stringify({ ...result, motion: publicMotion(result.motion) }),
      );
    } else console.log(line);
  if (line.startsWith('NATIVE_BOUNDARY_PASS ')) boundaryResult = JSON.parse(line.slice(21));
  if (line.startsWith('GALLERY_READY ')) galleryReady = true;
  if (line.startsWith('GALLERY_EDITOR_FINAL ')) editorFinal = true;
  if (line.startsWith('NELYX_NATIVE_FIRST_FRAME') && !begun) {
    begun = true;
    enqueue(async () => {
      if (scenario === 'boundaries') {
        if (!boundaryResult) throw Error('Native boundary checks did not complete');
        finished = true;
        await ui('Close');
      } else if (scenario === 'testbed') {
        await ui('SetupTestbed');
        finished = true;
        await ui('Close');
      } else {
        await ui(
          scenario === 'list' ? 'SetupList' : scenario === 'gallery' ? 'SetupGallery' : 'Setup',
        );
        await startScreen();
        if (scrollScenario) {
          if (!galleryReady) throw Error('Gallery owner unavailable');
          await ui('Wheel', wheels[0]);
        }
      }
    });
  }
  if (line.startsWith('GALLERY_PHASE_RESULT ')) {
    const result = JSON.parse(line.slice('GALLERY_PHASE_RESULT '.length)),
      index = galleryPhases.length;
    galleryPhases.push(result);
    enqueue(async () => {
      if (
        index >= 3 ||
        result.accepted !== wheels[index].Count ||
        result.inputToSurface.n !== wheels[index].Count ||
        Math.abs(Math.abs(result.delta) - 480) > 1e-6 ||
        Math.sign(result.end - result.start) !== (index === 1 ? -1 : 1)
      )
        throw Error('Gallery input/progress validation failed');
      if (scenario === 'list') await ui('SnapshotList');
      if (index < 2) await ui('Wheel', wheels[index + 1]);
    });
  }
  if (line === 'GALLERY_ALL_DONE' && !finished) {
    finished = true;
    enqueue(async () => {
      await stopScreen();
      await ui('Capture', { CapturePath: capture });
      console.log('FAST_SCREENSHOT ' + capture);
      if (process.env.NELYX_JANK_REVIEW === '1') await pause(15000);
      if (scenario === 'gallery') await ui('Editor');
      await ui('Close');
    });
  }
  if (line.startsWith('FAST_CALENDAR_READY ')) enqueue(() => ui('Swipe', plans[0]));
  if (line.startsWith('FAST_PHASE_RESULT ')) {
    const result = JSON.parse(line.slice(18)),
      index = phases.length;
    phases.push(result);
    enqueue(async () => {
      if (
        index >= 3 ||
        result.gestures.down !== plans[index].Count ||
        result.gestures.up !== plans[index].Count ||
        result.rejected !== 0 ||
        !result.settled ||
        result.missingMoveSurfaces !== 0 ||
        result.pageDelta * plans[index].Direction <= 0 ||
        result.gestureMoves.some((g) => g.dragPixels * plans[index].Direction < 100)
      )
        throw Error('Calendar phase validation failed');
      await ui('Snapshot', { ExpectedMonth: result.end.label, CapturePath: capture });
      if (index < 2) await ui('Swipe', plans[index + 1]);
    });
  }
  if (line === 'FAST_ALL_DONE' && !finished) {
    finished = true;
    enqueue(async () => {
      console.log('FAST_SCREENSHOT ' + capture);
      await stopScreen();
      await pause(process.env.NELYX_JANK_REVIEW === '1' ? 45000 : 500);
      await ui('Close');
    });
  }
  if (line.startsWith('NELYX_NATIVE_EXIT ')) exitReceipt = JSON.parse(line.slice(18));
  if (line.includes('NELYX_NATIVE_JS_ERROR')) failure ??= Error(line);
}
function removeOwned(target, parent) {
  if (!fs.existsSync(target)) return;
  const actual = fs.realpathSync(target),
    base = fs.realpathSync(parent),
    relative = path.relative(base, actual);
  if (
    !relative ||
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    fs.lstatSync(target).isSymbolicLink()
  )
    throw Error('Cleanup path outside owned parent: ' + target);
  fs.rmSync(target, { recursive: fs.statSync(target).isDirectory(), force: true });
}
try {
  if (fs.existsSync(entry) || fs.existsSync(output))
    throw Error('Owned calendar diagnostic target already exists');
  const template =
    scenario === 'boundaries'
      ? 'windows-native-boundaries.ts'
      : scrollScenario
        ? 'windows-gallery-probe.ts'
        : 'windows-jank-probe.ts';
  if (scenario === 'testbed')
    fs.writeFileSync(entry, "export { main } from './src/index.ts';\n", { flag: 'wx' });
  else {
    const module = fs
      .readFileSync(path.join(root, 'Nelyx/eng/windows-jank-metrics.ts'), 'utf8')
      .replace(/^export /gm, '');
    const names =
      template === 'windows-jank-probe.ts'
        ? 'motionMetrics, distribution, samplingSummary'
        : 'motionMetrics, distribution';
    const metrics =
      'const { ' + names + ' } = (() => {\n' + module + '\nreturn { ' + names + ' };\n})();';
    let source = fs
      .readFileSync(path.join(root, 'Nelyx/eng', template), 'utf8')
      .replace(
        '// @jank-metrics: inlined by the runner inside the isolated consumer boundary.',
        metrics,
      )
      .replace(
        'const listScenario = false; // @jank-testbed',
        `const listScenario = ${scenario === 'list'};`,
      )
      .replace(
        '// @jank-list-fixture',
        scenario === 'list'
          ? fs.readFileSync(path.join(root, 'Nelyx/eng/windows-variable-list.ts'), 'utf8')
          : 'function restoreVariableList() {}',
      );
    if (process.env.NELYX_JANK_BUILD_PROFILE === '1') {
      if (scenario !== 'calendar') throw Error('Build profile currently requires calendar');
      if (engine !== 'hermes' || hermesMode !== 'bytecode')
        throw Error('Build observer profile currently requires bytecode');
      source =
        fs.readFileSync(path.join(root, 'Nelyx/eng/windows-jank-framework-profile.ts'), 'utf8') +
        '\n' +
        fs.readFileSync(path.join(root, 'Nelyx/eng/windows-jank-child-profile.ts'), 'utf8') +
        '\n' +
        fs.readFileSync(path.join(root, 'Nelyx/eng/windows-jank-build-profile.ts'), 'utf8') +
        '\nlet builderProfile;\n' +
        source
          .replace(
            'root = created;',
            'root = created; builderProfile = installBuildProfile(root, host, () => phase !== undefined);',
          )
          .replace(
            '  diagnostics.drain();\n  host.takeFrameTrace();',
            '  builderProfile.reset();\n  diagnostics.drain();\n  host.takeFrameTrace();',
          )
          .replace(
            '  phase = undefined;',
            '  builderProfile.log(phase.name, root.context.text.debugStats, Object.fromEntries(["semantics-flush", "semantics-snapshot", "semantics-freeze", "mouse-tracking", "post-frame"].map(key => [key, summary(samples.filter(s => s.stage === key).map(s => s.duration))])));\n  phase = undefined;',
          )
          .replace('            dispose();', '            builderProfile.dispose(); dispose();');
    }
    if (process.env.NELYX_NATIVE_GC_STATS === '1') {
      if (engine !== 'hermes') throw Error('GC phase profile requires Hermes');
      if (scenario !== 'calendar') throw Error('GC phase profile currently requires calendar');
      source =
        fs.readFileSync(path.join(root, 'Nelyx/eng/windows-jank-heap-profile.ts'), 'utf8') +
        '\nlet phaseHeap: ReturnType<typeof heapProfileSnapshot> | undefined;\n' +
        source
          .replace(
            '  now(): number;',
            '  heapInfo(): { heap: Record<string, number>; gcStatsEnabled: boolean; gc?: string };\n  now(): number;',
          )
          .replace(
            'function begin() {',
            'function begin() {\n  phaseHeap = heapProfileSnapshot(host);',
          )
          .replace(
            '  phase = undefined;',
            '  host.log("FAST_HEAP_PROFILE " + JSON.stringify({ name: active.name, before: phaseHeap, after: heapProfileSnapshot(host) }));\n  phaseHeap = undefined;\n  phase = undefined;',
          );
    }
    fs.writeFileSync(entry, source, { flag: 'wx' });
  }
  ownsEntry = true;
  ownsOutput = true;
  console.log('FAST_BUILD_HOST');
  const host =
    engine === 'hermes' ? await buildNativeHost({ app, signal: controller.signal }) : undefined;
  console.log('FAST_BUILD_BUNDLE');
  const built =
    engine === 'jsc'
      ? await buildNativeJscProbe({
          app,
          output,
          diagnosticEntry: entry,
          mode: jscMode,
          signal: controller.signal,
        })
      : await buildNativeApplication({
          app,
          mode: hermesMode,
          hostBuild: host,
          diagnosticEntry: entry,
          output,
          ...(compilerCache ? { cacheDirectory: compilerCache } : {}),
          signal: controller.signal,
        });
  const checked = verifyNativePackage(built.directory);
  if (built.mode !== runtimeMode || checked.manifest.mode !== runtimeMode)
    throw Error('Built native execution mode differs from the requested mode');
  const { runner, roots } = nativePackageEnvironment(app);
  const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  identity = {
    ...runtimeIdentity,
    rendererSha256: hash(path.join(app, '.nelyx/native-windows/host/nelyx_host_skia.lib')),
    baseHostSourceSha256: hash(path.join(roots['@nelyx/sdk'], 'native/windows-hermes/main.cpp')),
    installedSdkInputsSha256: windowsBuildInputs(runner),
    revision: checked.manifest.revision,
    toolchainSha256: checked.manifest.toolchainSha256,
    compilerPolicy: checked.manifest.compilerPolicy,
    applicationSourceSha256: checked.manifest.files.find((file) => file.path === 'app.js').sha256,
    ...(checked.manifest.acceptance
      ? {
          nativeCompilerPolicy: checked.manifest.nativePlan.compilerPolicy,
          typedSourceSha256: checked.manifest.nativePlan.typedSourceSha256,
          nativeAcceptance: checked.manifest.acceptance,
        }
      : {}),
    bundleSha256: crypto.createHash('sha256').update(fs.readFileSync(built.bundle)).digest('hex'),
    hostSourceSha256: checked.manifest.sourceSha256 ?? checked.manifest.hostSourceSha256,
    diagnosticEntrySha256: checked.manifest.diagnosticEntrySha256,
  };
  console.log(
    'FAST_IDENTITY ' +
      JSON.stringify({
        qualification: checked.manifest.qualification,
        ...identity,
      }),
  );
  native = spawn(built.executable, [built.bundle, built.assetRoot, runtimeMode, '180000'], {
    cwd: built.directory,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NELYX_NATIVE_DIAGNOSTICS: '1',
      NELYX_NATIVE_FRAME_TRACE: '1',
      NELYX_NATIVE_SCREEN_MARKER: screenEnabled ? '1' : '0',
    },
  });
  children.add(native);
  nativeExit = new Promise((resolve, reject) => {
    native.once('error', reject);
    native.once('close', (code, signal) => {
      children.delete(native);
      resolve({ code, signal });
    });
  });
  lines(native.stdout, onLine);
  lines(native.stderr, onLine);
  const exited = await nativeExit;
  await queue;
  if (failure) throw failure;
  if (scenario === 'calendar') {
    for (let i = 0; i < phases.length; i++) {
      if (
        phases[i].inputEvents !== drivers[i]?.Timing.Injected ||
        phases[i].accepted !== drivers[i]?.Timing.Injected
      )
        throw Error('Injected and received touch sample counts differ');
    }
  }
  if (
    exited.code !== 0 ||
    !finished ||
    (scenario === 'calendar' &&
      (phases.length !== 3 || drivers.length !== 3 || snapshots.length !== 3)) ||
    (scrollScenario &&
      (galleryPhases.length !== 3 ||
        drivers.length !== 3 ||
        (scenario === 'gallery' && !editorFinal))) ||
    exitReceipt?.exitCode !== 0 ||
    exitReceipt.mode !== runtimeMode ||
    exitReceipt.inputRejected !== 0 ||
    exitReceipt.inputReceived !== exitReceipt.inputDelivered ||
    exitReceipt.inputDelivered !== exitReceipt.inputAccepted ||
    exitReceipt.wheelReceivedY !== exitReceipt.wheelDeliveredY
  )
    throw Error(
      'Incomplete input validation: ' +
        JSON.stringify({
          exited,
          finished,
          phases: phases.length,
          drivers: drivers.length,
          snapshots: snapshots.length,
          exitReceipt,
        }),
    );
  if (scenario === 'list') {
    const ids = listSnapshots.map((snapshot) => snapshot.Items.join(','));
    if (ids.length !== 4 || ids[0] === ids[1] || ids[0] !== ids[2] || ids[1] !== ids[3])
      throw Error('Variable list UIA cold/return/warm membership differs');
    console.log('LIST_UI_PASS ' + JSON.stringify({ snapshots: listSnapshots }));
  }
  const report = {
    identity,
    measurementView,
    displayed,
    markerCost,
    performanceSample:
      process.env.NELYX_NATIVE_CPU_PROFILE !== '1' &&
      process.env.NELYX_JANK_BUILD_PROFILE !== '1' &&
      process.env.NELYX_NATIVE_GC_STATS !== '1',
    inputPacing: drivers.map((d, index) => ({
      waitStrategy: d.Timing.WaitStrategy,
      hz: d.Timing.Hz,
      effectiveHz: d.Timing.EffectiveHz,
      injected: d.Timing.Injected,
      maxLatenessMs: d.Timing.MaxLatenessMs,
      maxIntervalErrorMs: d.Timing.MaxIntervalErrorMs,
      firstAttemptQpcMs: d.Timing.AttemptQpcMs[0],
      firstNativeReceiptQpcMs: [...phases, ...galleryPhases][index]?.motion.start,
      firstAttemptToNativeMs:
        [...phases, ...galleryPhases][index]?.motion.start - d.Timing.AttemptQpcMs[0],
    })),
    phases: phases.map((p) => ({
      name: p.name,
      start: p.start.label,
      end: p.end.label,
      pageDelta: p.pageDelta,
      gestures: p.gestures,
      accepted: p.accepted,
      inputQueue: p.inputQueue,
      inputToSurface: p.inputToSurface,
      publishedProgressGaps: p.publishedProgressGaps,
      progressGapsOver100ms: p.progressGapsOver100ms,
      motion: publicMotion(p.motion),
    })),
    galleryPhases: galleryPhases.map((p) => ({
      name: p.name,
      motion: publicMotion(p.motion),
      inputQueue: p.inputQueue,
      inputToSurface: p.inputToSurface,
      resources: p.resources,
    })),
    exit: exitReceipt,
  };
  console.log('FAST_VALIDATION_PASS ' + JSON.stringify(report));
  if (summaryFile) fs.writeFileSync(summaryFile, JSON.stringify(report));
} catch (error) {
  console.error(String(error.stack ?? error));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  controller.abort();
  for (const child of children) child.kill();
  if (nativeExit) await Promise.race([nativeExit.catch(() => {}), pause(10000)]);
  if (screenExit) await screenExit.catch(() => {});
  if (ownsEntry) removeOwned(entry, app);
  if (ownsOutput) removeOwned(output, path.join(app, '.nelyx/native-windows'));
  removeOwned(session, path.join(root, '.tmp'));
  console.log('FAST_CLEANUP_DONE');
  process.removeListener('SIGINT', abort);
  process.removeListener('SIGTERM', abort);
}
