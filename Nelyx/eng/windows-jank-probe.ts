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
// @jank-metrics: inlined by the runner inside the isolated consumer boundary.
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
const preparationEnabled = false; // @page-preparation
const diagnosticEnabled = false; // @page-diagnostic
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
  logMotionPhase(line => host.log(line), 'FAST_PHASE_RESULT ', result);
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
