// SPDX-License-Identifier: BSD-3-Clause
// Copied into one temporary fixture in the existing RNW runner. Prototype
// wrapping is diagnostic overhead, never a cpu baseline or normal app path.
import { FrameDiagnostics } from '@nelyx/core/ui/frame';
import { GraphiteRenderer } from '@nelyx/skia-native/renderer';
import {
  createInputGeometryService,
  createRetainedInputGeometryService,
} from '@nelyx/skia-native/input-geometry';
import { createSceneCompositionService } from '@nelyx/skia-native/scene-composition';
import { createSemanticsGeometryService } from '@nelyx/skia-native/semantics-geometry';
import { verifyRnwSceneApi } from './rnw-scene-api.js';
import { verifyRetainedGeometryApi } from './rnw-retained-geometry-api.js';
import { RnwFrameRecords } from './rnw-frame-records.js';
import { readNativeRecordingStats } from './native-frame-metrics.js';
import { RnwWorkProbe } from './rnw-work-probe.js';
import { RenderObject, RenderBox } from '@nelyx/core/framework/rendering/object';
import { RenderSliver } from '@nelyx/core/framework/rendering/sliver';
import { RenderViewportBase } from '@nelyx/core/framework/rendering/viewport';
import { Element, InheritedElement } from '@nelyx/core/framework/widgets/framework';
import { SliverMultiBoxAdaptorElement } from '@nelyx/core/framework/widgets/sliver';

export function installRnwFrameProbe(application, options = {}) {
  const api = options.api ?? globalThis.NelyxWindowsHost;
  if (!api?.frameDiagnosticsEnabled) return undefined;
  if (
    typeof api.writeFrameDiagnostics !== 'function' ||
    typeof api.drainFrameTrace !== 'function' ||
    typeof api.getMonotonicTime !== 'function'
  )
    throw Error('RNW frame diagnostics require the rebuilt native host');
  const now = options.now ?? (() => performance.now()),
    view = application.view,
    diagnostics = new FrameDiagnostics({ now }, 4096),
    records = new RnwFrameRecords(options.scrolls ? 1024 : 256),
    clock = application.services.clock,
    request = clock.request,
    submit = GraphiteRenderer.prototype.submit,
    poll = GraphiteRenderer.prototype.pollNotifications,
    close = application.dispose,
    previous = view.frameDiagnostics;
  const work = new RnwWorkProbe(now);
  const pollWork = {
    calls: 0,
    empty: 0,
    results: 0,
    insideOwned: 0,
    insideWall: 0,
    outsideWall: 0,
  };
  let nativeCallFailures = 0,
    nativeCallMethods = 0;
  const nativeCallTotals = Object.create(null),
    scenePackets = { legacy: 0, numeric: 0, paths: 0, paints: 0, clips: 0, bytes: 0 };
  const contextPrototypes = new WeakSet();
  const watchNative = (target, methods, label) => {
    for (const method of methods)
      try {
        work.wrap(target, method, 'jsi', (_target, args) => {
          const name = label + '.' + method;
          nativeCallTotals[name] = (nativeCallTotals[name] ?? 0) + 1;
          if (method === 'nelyxReplayDisplayList') {
            const words = new Float64Array(args[0]);
            scenePackets.bytes += words.byteLength;
            if (words[1] === 2) {
              scenePackets.numeric++;
              scenePackets.paths += words[5];
              scenePackets.paints += words[6];
              for (
                let at = words[7], command = 0;
                at < words.length && command < 65536;
                command++, at += 2 + words[at + 1]
              )
                if (words[at] === 23 || words[at] === 24) scenePackets.clips++;
            } else scenePackets.legacy++;
          }
          return name;
        });
        nativeCallMethods++;
      } catch {
        nativeCallFailures++;
      }
  };
  const scrollIds = new WeakMap();
  let nextScroll = 0;
  const scrolls = () => {
    const root = view.controller?.root?.renderObjects?.[0],
      stack = root ? [{ node: root, painted: true }] : [],
      values = [];
    let visited = 0;
    while (stack.length && visited++ < 8192) {
      const { node, painted } = stack.pop();
      if (node instanceof RenderViewportBase) {
        let id = scrollIds.get(node);
        if (id === undefined) {
          id = ++nextScroll;
          scrollIds.set(node, id);
        }
        const offset = node.offset;
        const center = node.localToGlobal({ x: node.size.width / 2, y: node.size.height / 2 });
        values.push([
          id,
          offset.pixels,
          Number.isFinite(offset.minScrollExtent) ? offset.minScrollExtent : null,
          Number.isFinite(offset.maxScrollExtent) ? offset.maxScrollExtent : null,
          center.x,
          node.size.width,
          painted ? 1 : 0,
        ]);
      }
      for (const child of node.children)
        stack.push({ node: child, painted: painted && node.paintsChild(child) });
    }
    return { values, truncated: stack.length > 0 };
  };
  // Exercise the real installed JSI capability, independently of which
  // conservative render paths are eligible in this diagnostic's current page.
  // The candidate is withdrawn from the normal native engine. This explicit
  // diagnostic owns its numeric service and optional Core injection instead.
  const suppliedGeometry = application.services.inputGeometry;
  const inputGeometry =
    suppliedGeometry ??
    (globalThis.SkiaApi && options.inputGeometry !== false
      ? (options.inputGeometry === 'retained'
          ? createRetainedInputGeometryService
          : createInputGeometryService)(globalThis.SkiaApi, view.owner, () => {})
      : undefined);
  const context = view.controller?.context;
  const previousGeometry = context?.inputGeometry;
  const extraServices = [];
  const nativeServices = [];
  const sceneResources = options.sceneBatch ? view.options?.renderer?.resources : undefined;
  const previousBatch = sceneResources?.sceneBatch;
  let sceneApi;
  if (context && inputGeometry) context.inputGeometry = inputGeometry;
  const closeGeometry = () => {
    if (sceneResources && sceneResources.sceneBatch === options.sceneBatch) {
      if (previousBatch === undefined) delete sceneResources.sceneBatch;
      else sceneResources.sceneBatch = previousBatch;
    }
    for (const { name, previous, service } of extraServices) {
      if (context[name] === service) {
        if (previous === undefined) delete context[name];
        else context[name] = previous;
      }
      if (service !== previous) service.dispose();
    }
    if (context && inputGeometry && context.inputGeometry === inputGeometry) {
      if (previousGeometry === undefined) delete context.inputGeometry;
      else context.inputGeometry = previousGeometry;
    }
    if (inputGeometry !== suppliedGeometry) inputGeometry?.dispose();
  };
  const inputGeometryApi = {
    available: !!inputGeometry,
    productionEnabled: !!suppliedGeometry,
    // A direct one-editor API smoke is independent of real-page coverage.
    apiSmokeExecuted: false,
    ...(options.inputGeometry === 'retained'
      ? {
          retainedApi: verifyRetainedGeometryApi(
            globalThis.SkiaApi,
            view.owner,
            view.currentMetrics,
          ),
        }
      : {}),
  };
  try {
    if (options.sceneBatch) {
      if (!sceneResources) throw Error('Scene batch diagnostic requires owned native resources');
      // The renderer and retained Picture compiler share this resource owner.
      // Keep the candidate through the whole callback, then restore on close.
      sceneResources.sceneBatch = options.sceneBatch;
    }
    if (options.nativeCalls) {
      const skia = globalThis.SkiaApi,
        temporary = [];
      try {
        const paint = skia.Paint(),
          rect = skia.XYWHRect(0, 0, 1, 1),
          factory = skia.PathBuilder,
          builder = factory.Make(),
          recorder = skia.PictureRecorder();
        temporary.push(paint, rect, builder, recorder);
        const recorderPrototype = Object.getPrototypeOf(recorder);
        contextPrototypes.add(recorderPrototype);
        watchNative(recorderPrototype, ['nelyxReplayDisplayList'], 'scene');
        watchNative(
          Object.getPrototypeOf(paint),
          [
            'setColor',
            'setAntiAlias',
            'setStyle',
            'setStrokeWidth',
            'setStrokeMiter',
            'setStrokeCap',
            'setStrokeJoin',
            'setBlendMode',
            'dispose',
          ],
          'paint',
        );
        watchNative(Object.getPrototypeOf(rect), ['setLTRB', 'dispose'], 'rect');
        watchNative(Object.getPrototypeOf(factory), ['Make'], 'path-factory');
        watchNative(
          Object.getPrototypeOf(builder),
          [
            'setFillType',
            'moveTo',
            'rMoveTo',
            'lineTo',
            'rLineTo',
            'quadTo',
            'rQuadTo',
            'cubicTo',
            'rCubicTo',
            'conicTo',
            'rConicTo',
            'close',
            'addRect',
            'addOval',
            'addRRect',
            'build',
            'dispose',
          ],
          'path',
        );
        watchNative(
          skia,
          ['Paint', 'XYWHRect', 'RRectXY', 'Color', 'nelyxScenePacketVersion', 'nelyxMakePath'],
          'api',
        );
      } finally {
        for (const value of temporary.reverse()) value.dispose();
      }
    }
    for (const [name, enabled, create] of [
      ['sceneComposition', options.sceneComposition, createSceneCompositionService],
      ['semanticsGeometry', options.semanticsGeometry, createSemanticsGeometryService],
    ])
      if (enabled && context) {
        const api = globalThis.SkiaApi,
          prefix = name === 'sceneComposition' ? 'nelyxSceneComposition' : 'nelyxSemanticsGeometry',
          // Retain only the existing numeric session for its close/stats check.
          // No canvas, recording, image or GPU resource is added to this owner.
          observedApi = {
            [prefix + 'Version']: () => api[prefix + 'Version'](),
            [prefix + 'Session'](...args) {
              if (nativeServices.length >= 2)
                throw Error('Numeric observation owner limit exceeded');
              const native = api[prefix + 'Session'](...args);
              nativeServices.push({ name, native });
              return native;
            },
          };
        const previous = context[name],
          service = previous ?? create(observedApi, view.owner, () => {});
        if (!service) throw Error('Missing numeric ' + name + ' capability');
        context[name] = service;
        extraServices.push({ name, previous, service });
      }
    if (options.sceneApi) sceneApi = verifyRnwSceneApi(globalThis.SkiaApi);
    if (inputGeometry) {
      const metrics = view.currentMetrics;
      const frame = { owner: view.owner, metrics },
        batch = inputGeometry.begin?.(frame),
        node = batch ? batch.node({}, -1, [1, 0, 0, 1, 0, 0], null) : 0,
        editors = [
          {
            node,
            core: {
              coordinates: 'editable-local',
              epoch: 1,
              width: 1,
              height: 1,
              caret: { x: 0, y: 0, width: 0.25, height: 1 },
              caretBaseline: { x: 0, y: 1 },
              selectionRects: [],
            },
          },
        ],
        candidate = batch?.prepare(editors),
        result = candidate
          ? candidate.projections
          : inputGeometry.project(
              frame,
              [{ parent: -1, local: [1, 0, 0, 1, 0, 0], clip: null }],
              editors,
            );
      candidate?.discard();
      if (
        result.length !== 1 ||
        (metrics.logicalWidth > 0 &&
          metrics.logicalHeight > 0 &&
          (!result[0] || result[0].transform.length !== 16 || result[0].bounds.x !== 0))
      )
        throw Error('RNW installed input geometry API returned a different projection');
      inputGeometryApi.apiSmokeExecuted = true;
    }
  } catch (error) {
    closeGeometry();
    throw error;
  }
  const geometrySupport = () => {
    const root = view.controller?.root?.renderObjects?.[0],
      pending = root ? [root] : [],
      issues = new Set();
    const children = Object.getOwnPropertyDescriptor(RenderObject.prototype, 'children')?.get;
    let nodes = 0,
      providers = 0,
      cold = 0;
    while (pending.length && nodes < 512) {
      const node = pending.pop();
      if (node.inputGeometrySubtreeWork === 0) continue;
      nodes++;
      if (node.inputGeometryProvider) {
        providers++;
        if (!node.localEditingGeometry) cold++;
      }
      for (const name of RenderObject.inputGeometryHookNames ?? []) {
        let current = node,
          descriptor;
        while (current && !descriptor) {
          descriptor = Object.getOwnPropertyDescriptor(current, name);
          current = Object.getPrototypeOf(current);
        }
        if (
          descriptor &&
          !RenderObject.inputGeometryHooks?.get(name)?.has(descriptor.get ?? descriptor.value) &&
          issues.size < 16
        )
          issues.add(node.constructor.name + '.' + name);
      }
      if (children) pending.push(...children.call(node));
    }
    return {
      ...inputGeometryApi,
      nodes,
      providers,
      cold,
      unsupported: [...issues],
      truncated: pending.length > 0,
    };
  };
  try {
    if (options.pointerWork) {
      const controller = view.controller;
      work.wrap(controller, 'pointer', 'pointer-total', () => 'transport');
      work.wrap(controller, 'pointerHitTest', 'pointer-hit', () =>
        work.active?.stack.get('pointer-total') ? 'input' : 'post-frame',
      );
      work.wrap(
        controller.gestureBinding,
        'enqueuePointerEvent',
        'pointer-binding',
        () => 'binding',
      );
      work.wrap(controller.gestureBinding, 'dispatchEvent', 'pointer-handlers', () => 'dispatch');
    }
    if (options.work !== false) {
      for (const prototype of [RenderObject.prototype, RenderBox.prototype, RenderSliver.prototype])
        work.wrap(prototype, 'performLayoutInScope', 'wet-layout');
      work.wrap(RenderBox.prototype, 'query', 'measurement');
      work.wrap(
        Element.prototype,
        'rebuild',
        'element-rebuild',
        (element) => element.widget.constructor.name,
      );
      work.wrap(
        Element.prototype,
        'reconcile',
        'element-reconcile',
        (_element, [previous, widgets]) =>
          `${previous.length ? 'update' : 'create'}-${
            widgets.length <= 1
              ? 'single'
              : widgets.some((widget) => widget.key)
                ? 'keyed'
                : 'unkeyed'
          }`,
      );
      for (const method of ['mount', 'unmount'])
        work.wrap(Element.prototype, method, `element-${method}`);
      work.wrap(Element.prototype, 'getElementForInheritedWidgetOfExactType', 'dependency-lookup');
      work.wrap(Element.prototype, 'dependOnInheritedElement', 'dependency-register');
      work.wrap(InheritedElement.prototype, 'removeDependent', 'dependency-remove');
      work.wrap(InheritedElement.prototype, 'notifyClients', 'dependency-notify');
      work.wrap(SliverMultiBoxAdaptorElement.prototype, 'createChild', 'sliver-create');
      if (application.text)
        work.wrap(application.text, 'layout', 'text-layout', () => 'text-service');
    }
  } catch (error) {
    work.dispose();
    closeGeometry();
    throw error;
  }
  let live = true,
    reportAt = now(),
    callbackId = 0,
    activeCallback,
    errors = 0,
    timer,
    overwritten = 0,
    invalidSource = 0;
  const directScrolls = [];
  let directScrollAt = -Infinity,
    sourceReportedAt = 0;
  view.frameDiagnostics = diagnostics;
  const drain = () => {
    const source = diagnostics.drain();
    overwritten += source.overwritten;
    invalidSource += source.invalid;
    for (const sample of source.samples) {
      if (activeCallback && sample.stage === 'input-dispatch') {
        activeCallback.inputEvents++;
        activeCallback.inputWall += sample.duration;
      }
      const row = records.source(sample);
      if (row && activeCallback && (!row.callback || activeCallback.wall > row.callback.wall))
        row.callback = activeCallback;
    }
    for (const entry of api.drainFrameTrace())
      if (entry.stage <= 5 || (entry.stage >= 20 && entry.stage <= 26)) records.native(entry);
    if (options.scrolls && now() - directScrollAt >= 100 && view.currentMetrics) {
      directScrollAt = now();
      directScrolls.push({
        nativeMs: api.getMonotonicTime(),
        owner: view.owner.generation,
        viewport: view.currentMetrics.viewportGeneration,
        surface: view.currentMetrics.nativeSurfaceGeneration,
        scrolls: scrolls(),
      });
      if (directScrolls.length > 16) directScrolls.shift();
    }
  };
  const emit = () => {
    try {
      drain();
      const before = now(),
        native = api.getMonotonicTime(),
        after = now();
      const report = records.report(
        {
          offsetToJs: (before + after) / 2 - native,
          uncertainty: (after - before) / 2,
        },
        options.sourceWindows ? { begin: sourceReportedAt, end: native } : undefined,
      );
      sourceReportedAt = native;
      report.inputGeometry = geometrySupport();
      if (inputGeometry?.stats) report.retainedInputGeometry = inputGeometry.stats();
      if (inputGeometry?.execution)
        report.retainedInputGeometryExecution = inputGeometry.execution();
      if (options.scrolls) report.directScrolls = directScrolls.slice();
      report.retirementPoll = {
        ...pollWork,
        scope:
          'poll calls inside owned callback overlap its wall; outside includes native-delivered retirement callbacks and other callers; an empty poll alone does not prove unnecessary scheduling',
      };
      report.nativeMetadata = nativeServices.map(({ name, native }) => {
        const stats = Array.from(new Float64Array(native.stats()));
        if (stats.length !== 6 || stats.some((value) => !Number.isSafeInteger(value) || value < 0))
          throw Error('Invalid numeric metadata lifetime observations');
        return {
          name,
          stats,
          columns: [
            'committedNodes',
            'stagedNodes',
            'committedBytes',
            'stagedBytes',
            'peakBytes',
            'closed',
          ],
        };
      });
      if (options.scrolls) {
        const status = api.getStatus?.() ?? {};
        report.lifetimes = {
          nativeMs: native,
          logicalWidth: view.currentMetrics?.logicalWidth,
          scale: view.currentMetrics?.scale,
          pictures: context?.pictures?.debugStats,
          accounted: context?.resources?.accountedTotals,
          nativeSlots: report.latestFrame?.slots,
          runtime: Object.fromEntries(
            [
              'compositionPhase',
              'uiConsumers',
              'registeredViews',
              'gpuCreatedOnJs',
              'pendingAsync',
              'pendingFrames',
              'surfaceStatusCounters',
            ]
              .filter((name) => status[name] !== undefined)
              .map((name) => [name, status[name]]),
          ),
          scope:
            'Picture estimated costs and registered accounting sidecars; native slots are recording lifetimes, not GPU resident bytes',
        };
      }
      if (sceneApi) report.sceneApi = sceneApi;
      if (options.nativeCalls)
        report.nativeCalls = {
          methods: nativeCallMethods,
          unsupported: nativeCallFailures,
          calls: { ...nativeCallTotals },
          scenePackets: { ...scenePackets },
          scope: 'observed selected Path/Paint/Rect/packet API calls inside owned callbacks',
        };
      if (options.scrolls)
        report.motionSamples = [...records.rows.values()]
          .filter((row) => row.identity.frame > 0 && row.callback?.scrolls)
          .slice(-128)
          .map((row) => ({
            identity: row.identity,
            scrolls: row.callback.scrolls,
            begin: row.callback.begin,
            end: row.callback.end,
            nativeMs: row.native[2]?.[0] ?? row.native[0]?.[0],
            nativeView: row.native[2]?.[2] ?? row.native[0]?.[2],
            nativeSubmission: row.native[2]?.[1],
          }));
      report.scope =
        'actual RNW; owned View callback wall excludes native dispatch/poll and following JS checkpoint; a preexisting callback may be unobserved; opt-in wrappers and native thread observations';
      report.errors = errors + work.errors;
      report.observationClosed = !live;
      report.overwrittenSource = overwritten;
      report.invalidSource = invalidSource;
      try {
        report.heap = Object.fromEntries(
          Object.entries(globalThis.HermesInternal?.getInstrumentedStats?.() ?? {}).filter(
            ([name, value]) =>
              [
                'hermes_totalAllocatedBytes',
                'hermes_numCollections',
                'hermes_yg_gcTime',
                'hermes_full_gcTime',
              ].includes(name) && Number.isFinite(value),
          ),
        );
      } catch {
        report.heap = { observed: false };
      }
      let output = JSON.stringify(report);
      if (output.length > 60000) {
        report.slowFrames = report.slowFrames.slice(0, 3);
        output = JSON.stringify(report);
      }
      // The native report port has a fixed byte budget. Keep a bounded recent
      // motion suffix when detailed stage/slow-frame records need more space;
      // expose omissions instead of losing every subsequent report to overflow.
      while (output.length > 60000 && report.motionSamples?.length > 1) {
        const keep = Math.floor(report.motionSamples.length / 2);
        report.omittedMotionSamples =
          (report.omittedMotionSamples ?? 0) + report.motionSamples.length - keep;
        report.motionSamples = report.motionSamples.slice(-keep);
        output = JSON.stringify(report);
      }
      api.writeFrameDiagnostics(output);
    } catch {
      errors++;
    }
  };
  const wrappedRequest = function (callback) {
    return request.call(this, (...args) => {
      if (!live) return callback(...args);
      const began = now();
      work.begin();
      try {
        return callback(...args);
      } finally {
        try {
          const ended = now();
          activeCallback = {
            id: ++callbackId,
            begin: began,
            end: ended,
            wall: ended - began,
            inputEvents: 0,
            inputWall: 0,
            work: work.finish(),
            ...(options.scrolls ? { scrolls: scrolls() } : {}),
          };
          drain();
          const observed = activeCallback;
          activeCallback = undefined;
          // Measure the following checkpoint separately. This includes native
          // polling and queued jobs, not isolated React or GC CPU time.
          if (typeof globalThis.queueMicrotask === 'function') {
            const checkpoint = now();
            globalThis.queueMicrotask(() => {
              if (!live) return;
              try {
                observed.checkpointDelay = now() - checkpoint;
              } catch {
                errors++;
              }
            });
          }
        } catch {
          work.finish();
          activeCallback = undefined;
          errors++;
        }
      }
    });
  };
  const wrappedSubmit = function (...args) {
    const token = args[0].token;
    if (
      !live ||
      token.owner.id !== view.owner.id ||
      token.owner.generation !== view.owner.generation
    )
      return submit.apply(this, args);
    const old = this.frameDiagnostics;
    if (options.nativeCalls) {
      const target = this.context(),
        prototype = Object.getPrototypeOf(target);
      if (!contextPrototypes.has(prototype)) {
        contextPrototypes.add(prototype);
        watchNative(prototype, ['nelyxReplayDisplayList'], 'scene');
      }
    }
    this.frameDiagnostics = diagnostics;
    try {
      const result = submit.apply(this, args);
      if (result.status === 'accepted')
        try {
          const row = records.row({
            owner: token.owner.generation,
            viewport: token.metrics.viewportGeneration,
            context: token.metrics.nativeContextGeneration,
            surface: token.metrics.nativeSurfaceGeneration,
            frame: token.sequence,
            input: token.inputSequence ?? 0,
          });
          if (row) {
            const context = this.context();
            row.recording = readNativeRecordingStats(context.nelyxRecordingDiagnostics());
            row.timing = Object.fromEntries(
              [
                'tick',
                'dispatch',
                'queueDelay',
                'clockUncertainty',
                'observedDeadline',
                'frameStart',
                'frameTarget',
                'refreshInterval',
                'timingRevision',
              ]
                .filter((name) => Number.isFinite(token.timing?.[name]))
                .map((name) => [name, token.timing[name]]),
            );
            if (['dwm-predicted', 'timer-fallback'].includes(token.timing?.timingSource))
              row.timing.timingSource = token.timing.timingSource;
            const slots = context.nelyxStats();
            if (
              Array.isArray(slots) &&
              slots.length === 5 &&
              slots.every((v) => Number.isSafeInteger(v) && v >= 0)
            )
              row.slots = slots;
          }
        } catch {
          errors++;
        }
      return result;
    } finally {
      this.frameDiagnostics = old;
    }
  };
  clock.request = wrappedRequest;
  GraphiteRenderer.prototype.submit = wrappedSubmit;
  const wrappedPoll = function (...args) {
    const start = work.timestamp(),
      inside = work.active !== null;
    try {
      const result = poll.apply(this, args);
      pollWork.empty += result === 0 ? 1 : 0;
      pollWork.results += result;
      return result;
    } finally {
      const wall = work.timestamp() - start;
      pollWork.calls++;
      pollWork.insideOwned += inside ? 1 : 0;
      if (Number.isFinite(wall) && wall >= 0) {
        if (inside) pollWork.insideWall += wall;
        else pollWork.outsideWall += wall;
      } else errors++;
    }
  };
  GraphiteRenderer.prototype.pollNotifications = wrappedPoll;
  const dispose = () => {
    if (!live) return;
    live = false;
    (options.clearInterval ?? clearInterval)(timer);
    closeGeometry();
    emit();
    nativeServices.length = 0;
    work.dispose();
    if (clock.request === wrappedRequest) clock.request = request;
    if (GraphiteRenderer.prototype.submit === wrappedSubmit)
      GraphiteRenderer.prototype.submit = submit;
    if (GraphiteRenderer.prototype.pollNotifications === wrappedPoll)
      GraphiteRenderer.prototype.pollNotifications = poll;
    if (view.frameDiagnostics === diagnostics) view.frameDiagnostics = previous;
    if (application.dispose === wrappedClose) application.dispose = close;
  };
  const wrappedClose = function (...args) {
    dispose();
    return close.apply(this, args);
  };
  application.dispose = wrappedClose;
  try {
    timer = (options.setInterval ?? setInterval)(() => {
      if (!live) return;
      try {
        drain();
      } catch {
        errors++;
      }
      if (now() - reportAt >= 2000) {
        reportAt = now();
        emit();
      }
    }, 250);
    api.writeFrameDiagnostics(
      JSON.stringify({
        type: 'rnw-frame-probe-ready',
        schema: 1,
        owner: view.owner,
        performanceAccepted: false,
      }),
    );
  } catch (error) {
    dispose();
    throw error;
  }
  return { dispose, records };
}
