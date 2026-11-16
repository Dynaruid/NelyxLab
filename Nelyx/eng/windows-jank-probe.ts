import { main as application } from './src/index.ts';
import { FrameDiagnostics } from './windows/runner/node_modules/@nelyx/core/dist/ui/frame-diagnostics.js';
import { ScrollableState } from '@nelyx/core/framework/widgets/scrollable';
import { Axis } from '@nelyx/core/framework/painting/basic-types';
const host = globalThis.NelyxNativeHost;
const diagnostics = new FrameDiagnostics({ now: () => host.now() }, 16384);
const plans = [
  { name: 'forward-100ms-60hz', count: 6, direction: 1 },
  { name: 'forward-50ms-60hz', count: 6, direction: 1 },
  { name: 'reverse-50ms-60hz', count: 12, direction: -1 },
];
let root,
  position,
  monthState,
  phase,
  planIndex = 0;
let samples = [],
  frames = [],
  events = [],
  changes = [],
  offsets = [],
  gestureMoves = [],
  activeGesture;
let observedMonth = '',
  lastInput = 0;
const monthKey = '_dart_e3418b5381fd4ff8_currentMonth';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function month() {
  const value = monthState[monthKey];
  return {
    year: value.year,
    month: value.month,
    label: monthState.widget.calendarDelegate.formatMonthYear(
      value,
      monthState._dart_e3418b5381fd4ff8_localizations,
    ),
  };
}
function observeMonth() {
  if (!monthState) return;
  const value = month(),
    key = value.year + '-' + value.month;
  if (key !== observedMonth) {
    observedMonth = key;
    if (phase) changes.push({ at: host.now(), ...value, page: position.page });
  }
}
function drain() {
  const data = diagnostics.drain();
  if (data.invalid || data.overwritten) throw Error('Calendar diagnostic samples lost');
  if (phase) {
    if (samples.length + data.samples.length > 32768)
      throw Error('Calendar phase sample budget exceeded');
    samples.push(...data.samples);
  }
}
function locate() {
  if (position) return;
  let found, state;
  const visit = (element) => {
    if (element.state && monthKey in element.state) state = element.state;
    if (element.state instanceof ScrollableState && element.state.widget.axis === Axis.horizontal) {
      const candidate = element.state.position;
      if ('page' in candidate && candidate.viewportDimension > 100) {
        if (found) throw Error('Multiple visible page positions in calendar diagnostic');
        found = candidate;
      }
    }
    for (const child of element.children) visit(child);
  };
  visit(root.root);
  if (!found || !state) return;
  position = found;
  monthState = state;
  position.addListener(() => {
    if (phase) {
      if (offsets.length >= 4096) throw Error('Calendar offset sample budget exceeded');
      offsets.push([host.now(), position.pixels, position.page]);
    }
    observeMonth();
  });
  observeMonth();
  host.log(
    'FAST_CALENDAR_READY ' +
      JSON.stringify({
        month: month(),
        page: position.page,
        pixels: position.pixels,
        viewport: position.viewportDimension,
      }),
  );
}
function summary(values) {
  const sorted = [...values].sort((a, b) => a - b),
    round = (n) => Math.round(n * 1000) / 1000;
  return {
    n: sorted.length,
    p50: round(sorted[Math.floor((sorted.length - 1) * 0.5)] ?? 0),
    p95: round(sorted[Math.ceil((sorted.length - 1) * 0.95)] ?? 0),
    max: round(sorted.at(-1) ?? 0),
  };
}
function begin() {
  if (planIndex >= plans.length) throw Error('Unexpected extra calendar gesture');
  diagnostics.drain();
  host.takeFrameTrace();
  samples = [];
  frames = [];
  events = [];
  changes = [];
  offsets = [];
  gestureMoves = [];
  activeGesture = undefined;
  phase = {
    ...plans[planIndex],
    started: host.now(),
    start: month(),
    startPage: position.page,
    down: 0,
    up: 0,
    finishing: false,
  };
  host.log('FAST_PHASE_BEGIN ' + JSON.stringify(phase));
}
async function finish() {
  const active = phase;
  let stableAt = host.now(),
    previous = position.pixels,
    settled = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    await pause(100);
    if (Math.abs(position.pixels - previous) > 1e-6) {
      stableAt = host.now();
      previous = position.pixels;
    }
    if (
      !position.isScrollingNotifier.value &&
      Math.abs(position.page - Math.round(position.page)) < 1e-6 &&
      host.now() - stableAt >= 150
    ) {
      settled = true;
      break;
    }
  }
  if (!settled) throw Error('Calendar did not settle within 3 seconds');
  await pause(150);
  drain();
  observeMonth();
  const trace = host.takeFrameTrace();
  if (trace.lostInputs || trace.lostSurfaces || trace.lostTurns)
    throw Error('Calendar native trace observations lost');
  const inputs = Array.from(new Float64Array(trace.inputs)),
    surfaces = Array.from(new Float64Array(trace.surfaces));
  const own = new Set(events.map((e) => e.id)),
    moves = events.filter((e) => e.kind === 'move'),
    latency = [],
    queue = [],
    sources = new Map(frames.map((f) => [f.frame, f]));
  let accepted = 0,
    rejected = 0;
  for (let i = 0; i < inputs.length; i += 10) {
    if (!own.has(inputs[i])) continue;
    if (inputs[i + 9]) accepted++;
    else rejected++;
    if (inputs[i + 3] !== 2) continue;
    queue.push(inputs[i + 5] - inputs[i + 4]);
    for (let j = 0; j < surfaces.length; j += 11)
      if (surfaces[j + 5] >= inputs[i + 1]) {
        latency.push(surfaces[j + 10] - inputs[i + 4]);
        break;
      }
  }
  const progress = [],
    firstMove = moves[0]?.stamp ?? active.started,
    lastUp = events.filter((e) => e.kind === 'up').at(-1)?.stamp ?? host.now();
  let publishedPixel = frames[0]?.pixels,
    progressAt = firstMove;
  for (let j = 0; j < surfaces.length; j += 11) {
    const f = sources.get(surfaces[j + 4]);
    if (!f || Math.abs(f.pixels - publishedPixel) < 1e-6) continue;
    const at = surfaces[j + 10];
    if (progressAt <= lastUp && at >= firstMove) progress.push(at - progressAt);
    progressAt = at;
    publishedPixel = f.pixels;
  }
  const end = month(),
    first = monthState.widget.firstDate;
  const expected = (end.year - first.year) * 12 + end.month - first.month;
  if (Math.abs(position.page - expected) > 1e-6)
    throw Error('Calendar displayed month and settled page differ');
  const stages = {};
  for (const key of ['build', 'layout', 'paint', 'compose', 'semantics'])
    stages[key] = summary(samples.filter((s) => s.stage === key).map((s) => s.duration));
  const result = {
    name: active.name,
    gestures: { down: active.down, up: active.up },
    gestureMoves,
    inputEvents: events.length,
    accepted,
    rejected,
    start: active.start,
    end,
    startPage: active.startPage,
    endPage: position.page,
    pageDelta: position.page - active.startPage,
    monthTransitions: changes.map(({ year, month, page }) => ({ year, month, page })),
    frames: summary(frames.map((f) => f.cpu)),
    inputQueue: summary(queue),
    inputToSurface: summary(latency),
    missingMoveSurfaces: moves.length - latency.length,
    publishedProgressGaps: summary(progress),
    progressGapsOver100ms: progress.filter((n) => n >= 100).length,
    stages,
    settled: true,
    lastInput,
    lastPublishedInput: surfaces.length ? surfaces.at(-6) : 0,
  };
  phase = undefined;
  planIndex++;
  host.log('FAST_PHASE_RESULT ' + JSON.stringify(result));
  if (planIndex === plans.length) host.log('FAST_ALL_DONE');
}
export function main() {
  const result = application(),
    create = result.definition.createView;
  return {
    ...result,
    definition: {
      ...result.definition,
      createView(context) {
        root = create(context);
        const build = root.build.bind(root),
          pointer = root.pointer.bind(root),
          dispose = root.dispose.bind(root);
        const sampling = setInterval(() => {
          try {
            drain();
          } catch (error) {
            host.fail(String(error.stack ?? error));
          }
        }, 80);
        root.build = (scene) => {
          const at = host.now(),
            result = build({ ...scene, frameDiagnostics: diagnostics });
          locate();
          observeMonth();
          if (phase) {
            if (frames.length >= 2048) throw Error('Calendar frame sample budget exceeded');
            frames.push({
              frame: scene.token.sequence,
              input: scene.token.inputSequence,
              at,
              end: host.now(),
              cpu: host.now() - at,
              pixels: position.pixels,
              page: position.page,
            });
          }
          return result;
        };
        root.pointer = (event) => {
          const touch = event.device === 'touch';
          if (touch && event.kind === 'down' && !phase) begin();
          if (touch && phase && event.kind === 'down')
            activeGesture = { pixels: position.pixels, page: position.page };
          if (touch && phase) {
            lastInput = event.inputSequence;
            if (events.length >= 4096) throw Error('Calendar input sample budget exceeded');
            events.push({
              id: event.inputSequence,
              kind: event.kind,
              stamp: event.timestamp,
              at: host.now(),
            });
            if (event.kind === 'down') phase.down++;
          }
          pointer(event);
          observeMonth();
          if (touch && phase && event.kind === 'up' && activeGesture) {
            gestureMoves.push({
              pageAtDown: activeGesture.page,
              pageAtUp: position.page,
              dragPixels: position.pixels - activeGesture.pixels,
            });
            activeGesture = undefined;
          }
          if (touch && phase && event.kind === 'up') {
            phase.up++;
            if (phase.up === phase.count && !phase.finishing) {
              phase.finishing = true;
              void finish().catch((error) => host.fail(String(error.stack ?? error)));
            }
          }
        };
        root.dispose = () => {
          clearInterval(sampling);
          host.log(
            'FAST_NATIVE_TEXT ' +
              JSON.stringify(context.text.nativeParagraphTransactionExecution?.()),
          );
          dispose();
        };
        return root;
      },
    },
  };
}
