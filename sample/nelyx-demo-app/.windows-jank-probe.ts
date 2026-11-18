import { main as application } from './src/index.ts';
import { FrameDiagnostics } from '@nelyx/core/ui/frame';
import type { FrameDiagnosticSample } from '@nelyx/core/ui/frame';
import type { ViewControllerContext } from '@nelyx/core/hosting/runtime';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { Element } from '@nelyx/core/framework/widgets/framework';
import type { ScrollPosition } from '@nelyx/core/framework/widgets/scroll-position';
import type { PointerEvent } from '@nelyx/core/ui/input';
import { _MonthPickerState } from './windows/runner/node_modules/@nelyx/material/dist/generated/date/calendar_date_picker.generated.js';
import { NativeTextLayoutService } from '@nelyx/skia-native/text';
import { ScrollableState } from '@nelyx/core/framework/widgets/scrollable';
import { Axis } from '@nelyx/core/framework/painting/basic-types';
const { motionMetrics, distribution, samplingSummary } = (() => {
// Measurement helpers shared by the current Source diagnostic entries.
// All timestamps are QPC milliseconds; surface completion is not display time.
interface MotionEvent {
  readonly id: number;
  readonly stamp: number;
}
interface MotionFrame {
  readonly frame: number;
  readonly input: number;
  readonly pixels: number;
  readonly moving: boolean;
}
interface MotionMeasurement {
  readonly events: readonly MotionEvent[];
  readonly frames: readonly MotionFrame[];
  readonly surfaces: readonly number[];
  readonly startPixels: number;
  readonly endPixels: number;
}
interface ScreenObservation {
  readonly Started: number;
  readonly Ended: number;
  readonly Invalid: number;
  readonly Changes: readonly (readonly [number, number])[];
  readonly MaximumIntervalMs: number;
  readonly MaximumCaptureMs: number;
}
const round = (n: number): number => Math.round(n * 1000) / 1000;
function distribution(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: round(sorted[Math.floor((sorted.length - 1) * 0.5)] ?? 0),
    p95: round(sorted[Math.ceil((sorted.length - 1) * 0.95)] ?? 0),
    p99: round(sorted[Math.ceil((sorted.length - 1) * 0.99)] ?? 0),
    max: round(sorted.at(-1) ?? 0),
  };
}
function stalls(gaps: readonly number[], threshold: number, seconds: number, inclusive = true) {
  const selected = gaps.filter((gap) => (inclusive ? gap >= threshold : gap > threshold));
  return {
    count: selected.length,
    perSecond: round(selected.length / seconds),
    totalMs: round(selected.reduce((sum, gap) => sum + gap, 0)),
    maxMs: round(Math.max(0, ...selected)),
  };
}
function motionMetrics({
  events,
  frames,
  surfaces,
  startPixels,
  endPixels,
}: MotionMeasurement) {
  if (!events.length || !frames.length || surfaces.length % 11)
    throw Error('Incomplete motion measurement');
  const start = events[0]!.stamp,
    lastEvent = events.at(-1)!;
  // Include the final input acknowledgement and the final moving/changed frame.
  // Polling for quiet and collecting diagnostics afterwards are outside this window.
  let lastMotion: MotionFrame | undefined,
    previous = startPixels;
  for (const frame of frames) {
    if (frame.moving || Math.abs(frame.pixels - previous) > 1e-6) lastMotion = frame;
    previous = frame.pixels;
  }
  const acknowledged = frames.find(
    (frame) => frame.input >= lastEvent.id && Math.abs(frame.pixels - endPixels) < 1e-6,
  );
  if (!acknowledged || !lastMotion) throw Error('Final motion/input frame was not observed');
  const finalFrame = Math.max(acknowledged.frame, lastMotion.frame);
  const sources = new Map(frames.map((frame) => [frame.frame, frame]));
  const completed = [],
    seen = new Set<string>();
  let end: number | undefined;
  for (let index = 0; index < surfaces.length; index += 11) {
    const frame = surfaces[index + 4],
      at = surfaces[index + 10];
    const identity = surfaces.slice(index + 1, index + 5).join(':');
    if (seen.has(identity)) continue;
    seen.add(identity);
    if (frame > finalFrame || at < start || !sources.has(frame)) continue;
    completed.push({ frame, at, pixels: sources.get(frame)!.pixels });
    if (frame === finalFrame) end = at;
  }
  if (end === undefined || !(end > start) || end < lastEvent.stamp)
    throw Error('Final motion surface did not complete');
  completed.sort((a, b) => a.at - b.at);
  const seconds = (end - start) / 1000,
    intervals = [],
    progress = [];
  let frameAt = start,
    progressAt = start,
    pixels = startPixels;
  for (const frame of completed) {
    if (frame.at > end) continue;
    intervals.push(frame.at - frameAt);
    frameAt = frame.at;
    if (Math.abs(frame.pixels - pixels) > 1e-6) {
      progress.push(frame.at - progressAt);
      progressAt = frame.at;
      pixels = frame.pixels;
    }
  }
  // A missing final update must not disappear from either gap's denominator.
  if (frameAt < end) intervals.push(end - frameAt);
  if (progressAt < end) progress.push(end - progressAt);
  return {
    boundary: 'native-surface-copy-fence',
    start,
    end,
    finalFrame,
    durationMs: round(end - start),
    completedFrames: completed.filter((frame) => frame.at <= end).length,
    averageFps: round(completed.filter((frame) => frame.at <= end).length / seconds),
    frameIntervals: distribution(intervals),
    framesOver50ms: stalls(intervals, 50, seconds, false),
    framesAtLeast100ms: stalls(intervals, 100, seconds),
    progressIntervals: distribution(progress),
    progressAtLeast100ms: stalls(progress, 100, seconds),
    displayedFps: 'notVerified',
    framePositions: frames.map((frame) => [frame.frame, frame.pixels] as const),
    startPixels,
    endPixels,
    exclusions: 'quiet polling and diagnostic collection after final motion/input surface',
  };
}
function displayedMotion(
  motion: ReturnType<typeof motionMetrics>,
  screen: ScreenObservation,
) {
  if (!(screen.Started <= motion.start) || screen.Invalid || !screen.Changes.length)
    throw Error('Screen observation coverage or tag integrity differs');
  const positions = new Map(motion.framePositions),
    seen = new Set<number>(),
    frames = [];
  let end: number | undefined;
  for (const [at, frame] of screen.Changes) {
    if (at < motion.start || !positions.has(frame)) continue;
    if (seen.has(frame)) throw Error('Displayed frame sequence went backwards');
    seen.add(frame);
    frames.push({ at, frame, pixels: positions.get(frame)! });
    if (frame >= motion.finalFrame && Math.abs(positions.get(frame)! - motion.endPixels) < 1e-6) {
      end = at;
      break;
    }
  }
  if (end === undefined || !(end > motion.start) || screen.Ended < end)
    throw Error('Final displayed motion frame was not observed');
  const seconds = (end - motion.start) / 1000,
    intervals = [],
    progress = [];
  let frameAt = motion.start,
    progressAt = motion.start,
    pixels = motion.startPixels;
  for (const frame of frames) {
    intervals.push(frame.at - frameAt);
    frameAt = frame.at;
    if (Math.abs(frame.pixels - pixels) > 1e-6) {
      progress.push(frame.at - progressAt);
      progressAt = frame.at;
      pixels = frame.pixels;
    }
  }
  if (progressAt < end) progress.push(end - progressAt);
  return {
    boundary: 'composed-desktop-frame-tag-observation',
    durationMs: round(end - motion.start),
    observedFrames: frames.length,
    averageFpsLowerBound: round(frames.length / seconds),
    frameIntervals: distribution(intervals),
    framesOver50ms: stalls(intervals, 50, seconds, false),
    framesAtLeast100ms: stalls(intervals, 100, seconds),
    progressAtLeast100ms: stalls(progress, 100, seconds),
    maximumObservationIntervalMs: round(screen.MaximumIntervalMs),
    maximumCaptureMs: round(screen.MaximumCaptureMs),
    scanout: 'notVerified',
  };
}
// Optional sampling is a separate diagnostic run, never a performance sample.
function samplingSummary(text: string) {
  const data = JSON.parse(text) as {
      readonly samples?: readonly { readonly sf?: number | string }[];
      readonly stackFrames: Readonly<
        Record<string, { readonly name: string; readonly parent?: number | string }>
      >;
    },
    leaf = new Map<string, number>(),
    inclusive = new Map<string, number>();
  for (const sample of data.samples ?? []) {
    let id = sample.sf,
      first = true;
    const names = new Set<string>();
    for (let depth = 0; id !== undefined && depth < 512; depth++) {
      const node = data.stackFrames[id];
      if (!node) throw Error('Missing sampled stack frame');
      const name = node.name.split('(')[0];
      if (first) leaf.set(name, (leaf.get(name) ?? 0) + 1);
      if (!names.has(name)) inclusive.set(name, (inclusive.get(name) ?? 0) + 1);
      names.add(name);
      first = false;
      id = node.parent;
    }
  }
  const top = (values: ReadonlyMap<string, number>) =>
    [...values].sort((a, b) => b[1] - a[1]).slice(0, 24);
  return { samples: data.samples?.length ?? 0, leaf: top(leaf), inclusive: top(inclusive) };
}

return { motionMetrics, distribution, samplingSummary };
})();
interface DiagnosticHost {
  now(): number;
  log(message: string): void;
  fail(message: string): void;
  takeFrameTrace(): {
    readonly lostInputs: number;
    readonly lostSurfaces: number;
    readonly lostTurns: number;
    readonly inputs: ArrayBuffer;
    readonly surfaces: ArrayBuffer;
  };
  readonly cpuProfile?: {
    (operation: 'begin'): void;
    (operation: 'end'): string;
  };
}
const host = (globalThis as unknown as { NelyxNativeHost: DiagnosticHost }).NelyxNativeHost;
const preparationEnabled = false;
const diagnosticEnabled = false;
const summary = distribution;
const diagnostics = new FrameDiagnostics({ now: () => host.now() }, 16384);
const plans = [
  { name: 'forward-100ms-60hz', count: 6, direction: 1 },
  { name: 'forward-50ms-60hz', count: 6, direction: 1 },
  { name: 'reverse-50ms-60hz', count: 12, direction: -1 },
];
type CalendarPosition = ScrollPosition & { readonly page: number };
type Phase = (typeof plans)[number] & {
  readonly preparationAtBegin: FrameworkRoot['buildOwner']['preparationStats'];
  readonly started: number;
  readonly start: ReturnType<typeof month>;
  readonly startPage: number;
  readonly startPixels: number;
  down: number;
  up: number;
  finishing: boolean;
};
let root: FrameworkRoot,
  position: CalendarPosition,
  monthState: _MonthPickerState,
  phase: Phase | undefined,
  planIndex = 0;
let samples: FrameDiagnosticSample[] = [],
  frames: {
    frame: number;
    input: number;
    at: number;
    end: number;
    cpu: number;
    pixels: number;
    moving: boolean;
    page: number;
  }[] = [],
  events: { id: number; kind: PointerEvent['kind']; stamp: number; at: number }[] = [],
  changes: (ReturnType<typeof month> & { at: number; page: number })[] = [],
  offsets: [number, number, number][] = [],
  gestureMoves: { pageAtDown: number; pageAtUp: number; dragPixels: number }[] = [],
  activeGesture: { pixels: number; page: number } | undefined;
let observedMonth = '',
  lastInput = 0;
const monthKey = '_dart_e3418b5381fd4ff8_currentMonth';
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
function errorText(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}
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
  let found: CalendarPosition | undefined, state: _MonthPickerState | undefined;
  const visit = (element: Element) => {
    const value = element.stateObject;
    if (value instanceof _MonthPickerState) state = value;
    if (value instanceof ScrollableState && value.widget.axis === Axis.horizontal) {
      const candidate = value.position;
      if (
        'page' in candidate &&
        typeof candidate.page === 'number' &&
        candidate.viewportDimension > 100
      ) {
        if (found) throw Error('Multiple visible page positions in calendar diagnostic');
        found = candidate as CalendarPosition;
      }
    }
    for (const child of element.children) visit(child);
  };
  const tree: unknown = Reflect.get(root, 'root');
  if (!tree) return;
  if (!(tree instanceof Element)) throw Error('Source diagnostic root is not an Element');
  visit(tree);
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
    preparationAtBegin: root.buildOwner.preparationStats,
    ...plans[planIndex],
    started: host.now(),
    start: month(),
    startPage: position.page,
    startPixels: position.pixels,
    down: 0,
    up: 0,
    finishing: false,
  };
  host.log('FAST_PHASE_BEGIN ' + JSON.stringify(phase));
  if (host.cpuProfile) host.cpuProfile('begin');
}
async function finish() {
  const active = phase;
  if (!active) throw Error('Calendar phase is unavailable');
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
    latency: number[] = [],
    queue: number[] = [],
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
  if (!frames.length) throw Error('No calendar frames were observed');
  const progress: number[] = [],
    firstMove = moves[0]?.stamp ?? active.started,
    lastUp = events.filter((e) => e.kind === 'up').at(-1)?.stamp ?? host.now();
  let publishedPixel = frames[0]!.pixels,
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
  const stages: Record<string, ReturnType<typeof summary>> = {};
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
    motion: motionMetrics({
      events,
      frames,
      surfaces,
      startPixels: active.startPixels,
      endPixels: position.pixels,
    }),
    inputQueue: summary(queue),
    inputToSurface: summary(latency),
    missingMoveSurfaces: moves.length - latency.length,
    publishedProgressGaps: summary(progress),
    progressGapsOver100ms: progress.filter((n) => n >= 100).length,
    stages,
    settled: true,
    preparationAtBegin: active.preparationAtBegin,
    preparation: root.buildOwner.preparationStats,
    lastInput,
    lastPublishedInput: surfaces.length ? surfaces.at(-6) : 0,
  };
  phase = undefined;
  planIndex++;
  if (host.cpuProfile)
    host.log(
      'FAST_CPU_PROFILE ' +
        JSON.stringify({ name: active.name, ...samplingSummary(host.cpuProfile('end')) }),
    );
  host.log('FAST_PHASE_RESULT ' + JSON.stringify(result));
  if (planIndex === plans.length) host.log('FAST_ALL_DONE');
}
export function main() {
  const result = application(undefined, { calendarPreparation: preparationEnabled }),
    create = result.definition.createView;
  if (!create) throw Error('Application has no Source view factory');
  return {
    ...result,
    definition: {
      ...result.definition,
      createView(context: ViewControllerContext) {
        const created = create(context);
        if (!(created instanceof FrameworkRoot))
          throw Error('Application did not create a FrameworkRoot');
        root = created;
        const build = root.build.bind(root),
          pointer = root.pointer.bind(root),
          dispose = root.dispose.bind(root);
        const sampling = setInterval(() => {
          try {
            drain();
          } catch (error) {
            host.fail(errorText(error));
          }
        }, 80);
        root.build = (scene) => {
          const at = host.now(),
            result = build(diagnosticEnabled ? { ...scene, frameDiagnostics: diagnostics } : scene);
          locate();
          observeMonth();
          if (phase) {
            if (frames.length >= 2048) throw Error('Calendar frame sample budget exceeded');
            frames.push({
              frame: scene.token.sequence,
              input: scene.token.inputSequence ?? 0,
              at,
              end: host.now(),
              cpu: host.now() - at,
              pixels: position.pixels,
              moving: position.isScrollingNotifier.value,
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
            const id = event.inputSequence;
            if (id === undefined) throw Error('Native touch has no input sequence');
            lastInput = id;
            if (events.length >= 4096) throw Error('Calendar input sample budget exceeded');
            events.push({
              id,
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
              void finish().catch((error: unknown) => host.fail(errorText(error)));
            }
          }
        };
        root.dispose = () => {
          clearInterval(sampling);
          try {
            if (!(context.text instanceof NativeTextLayoutService))
              throw Error('Native text diagnostics service unavailable');
            host.log(
              'FAST_NATIVE_TEXT ' +
                JSON.stringify(context.text.nativeParagraphTransactionExecution()),
            );
          } finally {
            try {
              dispose();
            } finally {
              host.log(
                'FAST_PREPARATION ' +
                  JSON.stringify({
                    ...root.buildOwner.preparationStats,
                    resources: context.resources.accountedTotals,
                  }),
              );
            }
          }
        };
        return root;
      },
    },
  };
}
