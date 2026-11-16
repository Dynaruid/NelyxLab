import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { buildNativeHost } from './build-native-hermes.mjs';
import {
  buildNativeApplication,
  verifyNativePackage,
} from '../sdk/tooling/cli/src/windows-native-runner.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const scenario = argument('--scenario', 'calendar'),
  runs = Number(argument('--runs', '3')),
  appName = argument('--app', 'demo');
const app = path.join(
  root,
  appName === 'testbed' ? 'sample/nelyx-testbed-app-2' : 'sample/nelyx-demo-app',
);
if (
  !['calendar', 'gallery', 'boundaries', 'testbed'].includes(scenario) ||
  !['demo', 'testbed'].includes(appName) ||
  !Number.isInteger(runs) ||
  runs < 1 ||
  runs > 30
)
  throw Error('Choose calendar/gallery/boundaries and runs in 1..30');
if (!process.argv.includes('--child')) {
  const deadline = Date.now() + 1_200_000;
  try {
    for (let run = 1; run <= runs; run++) {
      console.log('JANK_RUN ' + JSON.stringify({ scenario, run, runs }));
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
        ],
        { cwd: root, timeout: Math.max(1, deadline - Date.now()) },
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  process.exit(0);
}
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
function onLine(line) {
  if (
    line.startsWith('FAST_') ||
    line.startsWith('NATIVE_BOUNDARY_') ||
    line.startsWith('GALLERY_') ||
    line.startsWith('NELYX_NATIVE_EXIT') ||
    line.includes('ERROR')
  )
    console.log(line);
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
        await ui(scenario === 'gallery' ? 'SetupGallery' : 'Setup');
        if (scenario === 'gallery') {
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
      if (index < 2) await ui('Wheel', wheels[index + 1]);
    });
  }
  if (line === 'GALLERY_ALL_DONE' && !finished) {
    finished = true;
    enqueue(async () => {
      await ui('Editor');
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
      await pause(500);
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
      : scenario === 'gallery'
        ? 'windows-gallery-probe.ts'
        : 'windows-jank-probe.ts';
  if (scenario === 'testbed')
    fs.writeFileSync(entry, "export { main } from './src/index.ts';\n", { flag: 'wx' });
  else fs.copyFileSync(path.join(root, 'Nelyx/eng', template), entry, fs.constants.COPYFILE_EXCL);
  ownsEntry = true;
  ownsOutput = true;
  console.log('FAST_BUILD_HOST');
  const host = await buildNativeHost({ app, signal: controller.signal });
  console.log('FAST_BUILD_BUNDLE');
  const built = await buildNativeApplication({
    app,
    mode: 'bytecode',
    hostBuild: host,
    diagnosticEntry: entry,
    output,
    signal: controller.signal,
  });
  const checked = verifyNativePackage(built.directory);
  console.log(
    'FAST_IDENTITY ' +
      JSON.stringify({
        qualification: checked.manifest.qualification,
        bundleSha256: crypto
          .createHash('sha256')
          .update(fs.readFileSync(built.bundle))
          .digest('hex'),
        hostSourceSha256: checked.manifest.sourceSha256,
        diagnosticEntrySha256: checked.manifest.diagnosticEntrySha256,
      }),
  );
  native = spawn(built.executable, [built.bundle, built.assetRoot, 'bytecode', '180000'], {
    cwd: built.directory,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NELYX_NATIVE_DIAGNOSTICS: '1', NELYX_NATIVE_FRAME_TRACE: '1' },
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
    (scenario === 'gallery' &&
      (galleryPhases.length !== 3 || drivers.length !== 3 || !editorFinal)) ||
    exitReceipt?.exitCode !== 0 ||
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
  console.log(
    'FAST_VALIDATION_PASS ' +
      JSON.stringify({
        inputPacing: drivers.map((d) => ({
          hz: d.Timing.Hz,
          effectiveHz: d.Timing.EffectiveHz,
          injected: d.Timing.Injected,
          maxLatenessMs: d.Timing.MaxLatenessMs,
          maxIntervalErrorMs: d.Timing.MaxIntervalErrorMs,
        })),
        phases: phases.map((p) => ({
          name: p.name,
          start: p.start.label,
          end: p.end.label,
          pageDelta: p.pageDelta,
          gestures: p.gestures,
          accepted: p.accepted,
          inputToSurface: p.inputToSurface,
          publishedProgressGaps: p.publishedProgressGaps,
          progressGapsOver100ms: p.progressGapsOver100ms,
        })),
        exit: exitReceipt,
      }),
  );
} catch (error) {
  console.error(String(error.stack ?? error));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  controller.abort();
  for (const child of children) child.kill();
  if (nativeExit) await Promise.race([nativeExit.catch(() => {}), pause(10000)]);
  if (ownsEntry) removeOwned(entry, app);
  if (ownsOutput) removeOwned(output, path.join(app, '.nelyx/native-windows'));
  removeOwned(session, path.join(root, '.tmp'));
  console.log('FAST_CLEANUP_DONE');
  process.removeListener('SIGINT', abort);
  process.removeListener('SIGTERM', abort);
}
