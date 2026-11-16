// Measurement helpers shared by the current Source diagnostic entries.
// All timestamps are QPC milliseconds; surface completion is not display time.
export interface MotionEvent {
  readonly id: number;
  readonly stamp: number;
}
export interface MotionFrame {
  readonly frame: number;
  readonly input: number;
  readonly pixels: number;
  readonly moving: boolean;
}
export interface MotionMeasurement {
  readonly events: readonly MotionEvent[];
  readonly frames: readonly MotionFrame[];
  readonly surfaces: readonly number[];
  readonly startPixels: number;
  readonly endPixels: number;
}
export interface ScreenObservation {
  readonly Started: number;
  readonly Ended: number;
  readonly Invalid: number;
  readonly Changes: readonly (readonly [number, number])[];
  readonly MaximumIntervalMs: number;
  readonly MaximumCaptureMs: number;
}
const round = (n: number): number => Math.round(n * 1000) / 1000;
export function distribution(values: readonly number[]) {
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
export function motionMetrics({
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
export function displayedMotion(
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
export function samplingSummary(text: string) {
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
