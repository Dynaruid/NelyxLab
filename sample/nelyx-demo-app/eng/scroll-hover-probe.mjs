// SPDX-License-Identifier: BSD-3-Clause
// Windows diagnostic entry. The regular Demo root, input and paint paths stay in use.
import { main as demo } from '../src/index.ts';
import { FrameDiagnostics } from '@nelyx/core/ui/frame';
import { Paragraph } from '@nelyx/core/ui/paragraph';
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { RenderMouseRegion } from '@nelyx/core/framework/rendering/mouse-region';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { Element } from '@nelyx/core/framework/widgets/framework';
import { SliverMultiBoxAdaptorElement } from '@nelyx/core/framework/widgets/sliver';
import { ScrollPositionWithSingleContext } from '@nelyx/core/framework/widgets/scroll-position-with-single-context';
import { ButtonStyleButton } from '@nelyx/material/button-style-button';
import { GraphiteRenderer } from '@nelyx/skia-native/renderer';

const ids = new Set([
  'slider-value',
  'range-value',
  'range-custom',
  'field-filled',
  'field-outlined',
]);
const stages = new Set([
  'animation',
  'build',
  'layout',
  'optional-work',
  'compositing',
  'paint',
  'compose',
  'composition-match',
  'input-geometry',
  'semantics',
  'semantics-flush',
  'semantics-snapshot',
  'semantics-freeze',
  'mouse-tracking',
  'post-frame',
  'capture',
  'geometry-publish',
  'semantics-publish',
  'boundary-recordings',
]);
const compositionCounters = new Set([
  'compose',
  'boundary-reuses',
  'composition-visits',
  'composition-reuses',
  'composition-scope-misses',
  'composition-structure-misses',
  'composition-transform-updates',
  'paint-commands',
]);
const widgetId = (element) => element.widget?.options?.id;

function find(element, predicate) {
  if (!element) return;
  if (predicate(element)) return element;
  for (const child of element.children) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

export function main() {
  const host = globalThis.NelyxNativeHost;
  if (!host?.takeFrameTrace) throw Error('The scroll probe requires NELYX_NATIVE_FRAME_TRACE=1');
  const result = demo();
  return {
    definition: {
      ...result.definition,
      createView(context) {
        const view = result.definition.createView(context);
        return observe(view, host);
      },
    },
  };
}

function observe(view, host) {
  const frames = [];
  const submissions = [];
  const diagnostics = host.diagnostics ? new FrameDiagnostics({ now: () => host.now() }) : null;
  const observeVm =
    typeof host.cpuProfileClock === 'function' && typeof host.heapInfo === 'function';
  const observeCycles = observeVm && typeof host.cpuProfileCycles === 'function';
  const annotations = new Map();
  const labels = new Map();
  const restore = [];
  const targets = new Map();
  const targetBoxes = new WeakMap();
  let gallery,
    seenViewport,
    lookupDirty = true;
  let hits = [],
    packets = [],
    slots = [],
    widgetBuilds = 0,
    labelLayouts = [];
  let timings = {},
    label = null,
    consumed = [];
  const build = view.build.bind(view);
  const pointer = view.pointer.bind(view);
  const dispose = view.dispose.bind(view);

  function watch(prototype, method, observeCall) {
    const original = prototype[method];
    prototype[method] = function (...args) {
      return observeCall(this, args, () => original.apply(this, args));
    };
    restore.push(() => {
      prototype[method] = original;
    });
  }
  function vmGcCounters() {
    const { heap } = host.heapInfo();
    return [
      heap.hermes_yg_gcTime,
      heap.hermes_full_gcTime,
      heap.hermes_yg_gcCPUTime,
      heap.hermes_full_gcCPUTime,
      heap.hermes_numCollections,
    ];
  }
  function measure(name, run) {
    const began = host.now();
    try {
      return run();
    } finally {
      const sample = (timings[name] ??= { calls: 0, ms: 0 });
      sample.calls++;
      sample.ms += host.now() - began;
    }
  }
  if (diagnostics) {
    watch(GraphiteRenderer.prototype, 'submit', (_renderer, [frame], run) => {
      const token = frame.token;
      const begin = host.now();
      const result = run();
      const end = host.now();
      if (submissions.length >= 16384) throw Error('Scroll probe submission limit exceeded');
      submissions.push({
        frame: token.sequence,
        viewport: token.metrics.viewportGeneration,
        input: token.inputSequence,
        begin,
        end,
        ...result,
      });
      return result;
    });
    watch(Element.prototype, 'rebuild', (element, _args, run) => {
      if (!element.active || !element.dirty) return run();
      widgetBuilds++;
      const id = widgetId(element);
      if (ids.has(id)) return measure('build ' + id, run);
      return element.widget instanceof ButtonStyleButton
        ? measure('build Material buttons', run)
        : run();
    });
    watch(ButtonStyleButton.prototype, 'defaultStyleOf', (_button, _args, run) =>
      measure('button default style', run),
    );
    watch(SliverMultiBoxAdaptorElement.prototype, 'createChild', (element, [index], run) => {
      if (element._childElements.get(index)) return run();
      slots.push(index);
      lookupDirty = true;
      const output = measure('create slot ' + index, run);
      registerTargets(element._childElements.get(index));
      return output;
    });
    watch(RenderBox.prototype, 'layout', (render, _args, run) => {
      const id = targetBoxes.get(render);
      return id ? measure('layout ' + id, run) : run();
    });
    watch(TextPainter.prototype, 'layout', (painter, _args, run) => {
      const id = labels.get(painter);
      if (!id) return run();
      labelLayouts.push(id);
      const previous = label;
      label = id;
      try {
        return run();
      } finally {
        label = previous;
      }
    });
    watch(Paragraph.prototype, 'layoutWithReplacement', (_paragraph, _args, run) =>
      measure(label ? 'label paragraph ' + label : 'paragraph', run),
    );
    watch(
      ScrollPositionWithSingleContext.prototype,
      'applyUserOffset',
      (position, [delta], run) => {
        if (gallery) {
          const id =
            gallery.firstScroll.hasClients && position === gallery.firstScroll.position
              ? 'left'
              : gallery.messageScroll.hasClients && position === gallery.messageScroll.position
                ? 'editor'
                : gallery.secondScroll.hasClients && position === gallery.secondScroll.position
                  ? 'right'
                  : null;
          if (id) consumed.push([id, delta]);
        }
        return run();
      },
    );
  }
  function registerTargets(root) {
    find(root, (element) => {
      const id = widgetId(element);
      if (!ids.has(id) || targets.has(id)) return false;
      targets.set(id, element);
      const region = find(
        element,
        (e) => e.renderObject instanceof RenderMouseRegion,
      )?.renderObject;
      if (region) annotations.set(region, id);
      const outer = element.findRenderObject();
      if (outer instanceof RenderBox) targetBoxes.set(outer, id);
      const render = element.state?.renderer?.();
      if (render?.startLabel) labels.set(render.startLabel, id);
      if (render?.endLabel) labels.set(render.endLabel, id);
      return false;
    });
  }
  function readHits() {
    const next = new Set();
    for (const state of view.mouseTracker.states.values()) {
      for (const annotation of state.annotations.keys()) {
        const id = annotations.get(annotation);
        if (id) next.add(id);
      }
    }
    return [...next];
  }
  function hitTransition(next, source, input) {
    const enter = next.filter((id) => !hits.includes(id));
    const exit = hits.filter((id) => !next.includes(id));
    hits = next;
    if (enter.length || exit.length) packets.push({ source, input, enter, exit });
  }
  view.pointer = (event) => {
    pointer(event);
    if (diagnostics && gallery) {
      hitTransition(readHits(), event.kind, event.inputSequence);
      if ((event.kind === 'hover' && hits.length) || event.kind === 'panZoomStart')
        packets.push({ source: event.kind, input: event.inputSequence, hits });
    }
  };
  view.build = (scene) => {
    const gcBefore = observeVm ? vmGcCounters() : undefined;
    const cpuBefore = observeVm ? host.cpuProfileClock() : undefined;
    const cyclesBefore = observeCycles ? host.cpuProfileCycles() : undefined;
    const begin = host.now();
    const output = build(diagnostics ? { ...scene, frameDiagnostics: diagnostics } : scene);
    const end = host.now();
    const cyclesAfter = observeCycles ? host.cpuProfileCycles() : undefined;
    const cpuAfter = observeVm ? host.cpuProfileClock() : undefined;
    const gcAfter = observeVm ? vmGcCounters() : undefined;
    const { sequence, metrics, inputSequence } = scene.token;
    gallery ??= find(
      view.root,
      (e) => e.state?.firstScroll?.hasClients && e.state?.secondScroll?.hasClients,
    )?.state;
    if (!gallery) return output;
    if (seenViewport !== metrics.viewportGeneration) {
      seenViewport = metrics.viewportGeneration;
      lookupDirty = true;
    }
    const left = gallery.firstScroll.position.pixels;
    const right = gallery.secondScroll.position.pixels;
    if (frames.length >= 8192) throw Error('Scroll probe frame limit exceeded');
    const row = {
      frame: sequence,
      viewport: seenViewport,
      input: inputSequence,
      begin,
      end,
      left,
      right,
    };
    if (cpuBefore && cpuAfter && gcBefore && gcAfter) {
      const [youngGc, fullGc, youngGcCpu, fullGcCpu, collections] = gcAfter.map(
        (value, index) => value - gcBefore[index],
      );
      row.vm = {
        elapsed: cpuAfter[0] - cpuBefore[0],
        cpu: cpuAfter[1] - cpuBefore[1],
        youngGc,
        fullGc,
        youngGcCpu,
        fullGcCpu,
        collections,
      };
      if (cyclesBefore !== undefined && cyclesAfter !== undefined)
        row.vm.cycles = cyclesAfter - cyclesBefore;
      if (Object.values(row.vm).some((value) => !Number.isFinite(value) || value < 0))
        throw Error('Scroll probe lost VM timing counters');
    }
    if (diagnostics) {
      if (lookupDirty) {
        lookupDirty = false;
        annotations.clear();
        labels.clear();
        targets.clear();
        registerTargets(view.root);
      }
      hitTransition(readHits(), 'frame', inputSequence);
      const capture = diagnostics.drain();
      if (capture.overwritten || capture.invalid) throw Error('Scroll probe lost stage samples');
      row.work = Object.fromEntries(
        capture.samples
          .filter((s) => stages.has(s.stage))
          .map((s) => [s.stage, s.stage === 'boundary-recordings' ? s.count : s.duration]),
      );
      row.composition = Object.fromEntries(
        capture.samples
          .filter((s) => compositionCounters.has(s.stage))
          .map((s) => [s.stage === 'compose' ? 'scene-commands' : s.stage, s.count]),
      );
      row.mounted = [...targets].filter(([, element]) => element.active).map(([id]) => id);
      row.hits = hits;
      row.packets = packets;
      row.slots = slots;
      row.widgetBuilds = widgetBuilds;
      row.labelLayouts = labelLayouts;
      row.paintVersion = view.preparedFrame?.paintVersion;
      row.timings = timings;
      row.consumed = consumed;
      row.editor = gallery.messageScroll.hasClients
        ? [gallery.messageScroll.position.pixels, gallery.messageScroll.position.maxScrollExtent]
        : null;
      packets = [];
      slots = [];
      labelLayouts = [];
      widgetBuilds = 0;
      timings = {};
      consumed = [];
    }
    frames.push(row);
    return output;
  };
  view.dispose = () => {
    try {
      const trace = host.takeFrameTrace();
      if (
        trace.lostInputs ||
        trace.lostSurfaces ||
        trace.lostTurns ||
        trace.inputStride !== 10 ||
        trace.surfaceStride !== 11 ||
        trace.turnStride !== 8
      )
        throw Error('Scroll probe lost native timing samples');
      function log(name, rows) {
        for (const row of rows) host.log(`NELYX_SCROLL_${name} ${JSON.stringify(row)}`);
      }
      function unpack(buffer, stride, columns) {
        const data = new Float64Array(buffer);
        const rows = [];
        for (let i = 0; i < data.length; i += stride)
          rows.push(columns.map((index) => data[i + index]));
        return rows;
      }
      log('FRAME', frames);
      // Input sequence, viewport, kind, QPC arrival, delta x/y, admitted.
      // Detailed traces also include native-to-JS dispatch start and end.
      log(
        'INPUT',
        unpack(trace.inputs, 10, diagnostics ? [0, 2, 3, 4, 7, 8, 9, 5, 6] : [0, 2, 3, 4, 7, 8, 9]),
      );
      // Frame sequence, viewport, input sequence, QPC copy-fence completion.
      log('SURFACE', unpack(trace.surfaces, 11, [4, 3, 5, 10]));
      if (diagnostics) {
        log('SUBMIT', submissions);
        // Turn, viewport, latest input, tick, dispatch, callbacks end, checkpoint end, count.
        log('TURN', unpack(trace.turns, 8, [0, 1, 2, 3, 4, 5, 6, 7]));
      }
    } finally {
      for (const off of restore.reverse()) off();
      dispose();
    }
  };
  return view;
}
