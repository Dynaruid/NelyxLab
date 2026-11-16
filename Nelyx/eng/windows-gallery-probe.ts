// Diagnostic entry template. All movement comes from Win32 input, never jumpTo.
import { main as application } from './src/index.ts';
import { FrameDiagnostics } from './windows/runner/node_modules/@nelyx/core/dist/ui/frame-diagnostics.js';
const host = globalThis.NelyxNativeHost;
const diagnostics = new FrameDiagnostics({ now: () => host.now() }, 16384);
const plans = ['cold-down', 'return-up', 'warm-down'];
const wheelSamples = 50; // 50 x 24 Win32 units = the previous 10 x 120 total.
let root,
  component,
  position,
  resources,
  phase,
  planIndex = 0,
  frames = [],
  samples = [],
  events = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
function drain() {
  const data = diagnostics.drain();
  if (data.invalid || data.overwritten) throw Error('Gallery samples lost');
  if (phase) {
    if (samples.length + data.samples.length > 32768) throw Error('Gallery sample budget');
    samples.push(...data.samples);
  }
}
function locate() {
  if (position) return;
  const visit = (element) => {
    if (element.state?.firstScroll?.hasClients && element.state?.secondScroll)
      component = element.state;
    for (const child of element.children) visit(child);
  };
  visit(root.root);
  if (!component) return;
  position = component.firstScroll.position;
  host.log(
    'GALLERY_READY ' + JSON.stringify({ pixels: position.pixels, max: position.maxScrollExtent }),
  );
}
async function finish() {
  let settled = false,
    previous = position.pixels;
  for (let attempt = 0; attempt < 30; attempt++) {
    await pause(100);
    if (!position.isScrollingNotifier.value && Math.abs(position.pixels - previous) < 1e-6) {
      settled = true;
      break;
    }
    previous = position.pixels;
  }
  if (!settled) throw Error('Gallery did not settle');
  await pause(150);
  drain();
  const trace = host.takeFrameTrace();
  if (
    trace.lostInputs ||
    trace.lostSurfaces ||
    trace.lostTurns ||
    trace.inputStride !== 10 ||
    trace.surfaceStride !== 11
  )
    throw Error('Invalid gallery trace');
  const inputs = Array.from(new Float64Array(trace.inputs)),
    surfaces = Array.from(new Float64Array(trace.surfaces));
  const own = new Set(events.map((e) => e.id)),
    latency = [],
    queue = [];
  let accepted = 0,
    delta = 0;
  for (let i = 0; i < inputs.length; i += 10) {
    if (!own.has(inputs[i]) || inputs[i + 3] !== 4) continue;
    if (!inputs[i + 9]) throw Error('Gallery wheel rejected');
    accepted++;
    delta += inputs[i + 8];
    queue.push(inputs[i + 5] - inputs[i + 4]);
    for (let j = 0; j < surfaces.length; j += 11)
      if (surfaces[j + 5] >= inputs[i + 1]) {
        latency.push(surfaces[j + 10] - inputs[i + 4]);
        break;
      }
  }
  if (
    accepted !== wheelSamples ||
    latency.length !== wheelSamples ||
    Math.abs(Math.abs(delta) - 480) > 1e-6 ||
    Math.abs(delta - events.reduce((n, e) => n + e.delta, 0)) > 1e-6
  )
    throw Error('Gallery wheel accounting mismatch');
  const direction = planIndex === 1 ? -1 : 1;
  if ((position.pixels - phase.start) * direction <= 0)
    throw Error('Gallery did not move in the injected direction');
  const stages = {};
  for (const stage of ['build', 'layout', 'paint', 'compose', 'semantics', 'composition-match'])
    stages[stage] = summary(samples.filter((s) => s.stage === stage).map((s) => s.duration));
  const result = {
    name: plans[planIndex],
    accepted,
    delta,
    start: phase.start,
    end: position.pixels,
    frames: summary(frames.map((f) => f.cpu)),
    inputQueue: summary(queue),
    inputToSurface: summary(latency),
    stages,
    resources: resources.accountedTotals,
  };
  phase = undefined;
  planIndex++;
  host.log('GALLERY_PHASE_RESULT ' + JSON.stringify(result));
  if (planIndex === plans.length) host.log('GALLERY_ALL_DONE');
}
export function main() {
  const result = application(),
    create = result.definition.createView;
  return {
    ...result,
    definition: {
      ...result.definition,
      createView(context) {
        resources = context.resources;
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
            value = build({ ...scene, frameDiagnostics: diagnostics });
          locate();
          if (phase) {
            if (frames.length >= 2048) throw Error('Gallery frame budget');
            frames.push({ cpu: host.now() - at });
          }
          return value;
        };
        root.pointer = (event) => {
          if (event.kind === 'wheel' && planIndex < plans.length) {
            if (!position) throw Error('Gallery scroll owner unavailable');
            if (!phase) {
              diagnostics.drain();
              host.takeFrameTrace();
              frames = [];
              samples = [];
              events = [];
              phase = { start: position.pixels };
            }
            if (events.length >= wheelSamples) throw Error('Extra gallery wheel packet');
            events.push({ id: event.inputSequence, delta: event.deltaY });
          }
          pointer(event);
          if (
            event.kind === 'wheel' &&
            events.length === wheelSamples &&
            phase &&
            !phase.finishing
          ) {
            phase.finishing = true;
            void finish().catch((error) => host.fail(String(error.stack ?? error)));
          }
        };
        root.dispose = () => {
          clearInterval(sampling);
          const value = component?.filled.text;
          if (planIndex === plans.length && value !== 'Jank 한글 😀')
            throw Error('Edited value was lost across scroll/theme/resize');
          if (planIndex === plans.length)
            host.log(
              'GALLERY_EDITOR_FINAL ' +
                JSON.stringify({ text: value, selection: component.filled.selection }),
            );
          dispose();
        };
        return root;
      },
    },
  };
}
