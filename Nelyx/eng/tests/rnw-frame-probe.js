// SPDX-License-Identifier: BSD-3-Clause
// Copied into one temporary fixture in the existing RNW runner. Prototype
// wrapping is diagnostic overhead, never a cpu baseline or normal app path.
import { FrameDiagnostics } from '@nelyx/core/ui/frame';
import { GraphiteRenderer } from '@nelyx/skia-native/renderer';
import { RnwFrameRecords } from './rnw-frame-records.js';
import { readNativeRecordingStats } from './native-frame-metrics.js';
import { RnwWorkProbe } from './rnw-work-probe.js';
import { RenderObject, RenderBox } from '@nelyx/core/framework/rendering/object';
import { RenderSliver } from '@nelyx/core/framework/rendering/sliver';
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
    records = new RnwFrameRecords(),
    clock = application.services.clock,
    request = clock.request,
    submit = GraphiteRenderer.prototype.submit,
    close = application.dispose,
    previous = view.frameDiagnostics;
  const work = new RnwWorkProbe(now);
  try {
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
  };
  const emit = () => {
    try {
      drain();
      const before = now(),
        native = api.getMonotonicTime(),
        after = now();
      const report = records.report({
        offsetToJs: (before + after) / 2 - native,
        uncertainty: (after - before) / 2,
      });
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
  const dispose = () => {
    if (!live) return;
    live = false;
    (options.clearInterval ?? clearInterval)(timer);
    emit();
    work.dispose();
    if (clock.request === wrappedRequest) clock.request = request;
    if (GraphiteRenderer.prototype.submit === wrappedSubmit)
      GraphiteRenderer.prototype.submit = submit;
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
