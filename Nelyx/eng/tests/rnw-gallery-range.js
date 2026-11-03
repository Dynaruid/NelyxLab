// SPDX-License-Identifier: BSD-3-Clause
import { FrameDiagnostics } from '@nelyx/core/ui/frame';
import { TextLayoutCache } from '@nelyx/core/hosting/text-layout-cache';

export function installGalleryRange(
  application,
  observation,
  { diagnostic = false, manual = false, backingAudit = false } = {},
) {
  const view = application.view,
    controller = view.controller,
    host = globalThis.NelyxWindowsHost;
  diagnostic =
    diagnostic === true || (diagnostic === 'host' && host?.frameDiagnosticsEnabled === true);
  if (!host?.getMonotonicTime || !controller?.frameSubmitted)
    throw Error('Gallery full range requires submitted frame and native QPC observations');
  const api = globalThis.SkiaApi;
  let backingMode;
  const backingSdk = { created: 0, reused: 0, invalid: 0, ownerGeneration: view.owner.generation };
  if (backingAudit) {
    if (api?.nelyxWin32BackingVersion?.() !== 1 || !api.nelyxWin32BackingAuditBegin)
      throw Error('Requested Windows backing capability missing; rebuild the native supplier');
    backingMode = api.nelyxWin32BackingAuditBegin(view.owner.generation) ? 'backing' : 'ts';
    api.nelyxReportInputGeometryStatus(
      JSON.stringify({
        schema: 1,
        kind: 'backing-selection',
        mode: backingMode,
        ownerGeneration: view.owner.generation,
      }),
    );
  }
  for (const id of ['sample-font', 'nelyx-material-icons']) {
    const font = controller.context.assets.get(id);
    if (!font || !controller.context.text.fontFamily(font))
      throw Error('Gallery finite font registration is not ready: ' + id);
  }
  const build = controller.build,
    submitted = controller.frameSubmitted,
    close = application.dispose;
  const pending = new Map();
  let cpu = {},
    sectionCpu = {},
    text = {},
    currentText;
  const native = [],
    surfaces = [],
    frameSamples = new Map(),
    restores = [];
  const backingEvents = [];
  let backingOverflow = 0;
  let activeColumn,
    previousOffset,
    nativeOverflow = 0;
  let surfaceOverflow = 0,
    unmappedSurfaces = 0;
  const previous = view.frameDiagnostics;
  const diagnostics = diagnostic
    ? new FrameDiagnostics({ now: () => performance.now() }, 4096)
    : null;
  if (diagnostics) view.frameDiagnostics = diagnostics;
  if (diagnostic) {
    const wrap = (target, method, label) => {
      const own = Object.getOwnPropertyDescriptor(target, method),
        original = target[method];
      target[method] = function (...args) {
        const begin = performance.now();
        let result;
        try {
          return (result = original.apply(this, args));
        } finally {
          if (currentText) {
            const row = (currentText[label] ??= { calls: 0, wall: 0, max: 0, hits: 0, misses: 0 });
            const wall = performance.now() - begin;
            row.calls++;
            row.wall += wall;
            row.max = Math.max(row.max, wall);
            if (method === 'reuse') {
              if (result) row.hits++;
              else row.misses++;
            }
          }
        }
      };
      restores.push(() => {
        if (own) Object.defineProperty(target, method, own);
        else delete target[method];
      });
    };
    wrap(controller.context.text, 'layout', 'layoutTotal');
    wrap(TextLayoutCache.prototype, 'key', 'descriptionKey');
    wrap(TextLayoutCache.prototype, 'reuse', 'cacheLookupAdmission');
  }
  const drainNative = () => {
    for (const entry of host.drainFrameTrace()) {
      if (backingAudit && entry.stage === 27) {
        if (entry.height !== Number(backingMode === 'backing') || ![1, 2].includes(entry.width))
          backingSdk.invalid++;
        else if (entry.width === 1) backingSdk.created++;
        else backingSdk.reused++;
        if (activeColumn) {
          if (backingEvents.length >= 8192) backingOverflow++;
          else backingEvents.push([entry.nativeTimestamp, entry.width]);
        }
      }
      if (entry.stage === 2 && activeColumn) {
        const sample = frameSamples.get(entry.frameSequence)?.columns[activeColumn];
        if (!sample) unmappedSurfaces++;
        else if (surfaces.length >= 8192) surfaceOverflow++;
        else
          surfaces.push([
            entry.nativeTimestamp,
            entry.frameSequence,
            sample.offset,
            sample.visible,
          ]);
      }
      if (!diagnostic || entry.stage < 22 || entry.stage > 26) continue;
      if (native.length >= 8192) nativeOverflow++;
      else native.push(entry);
    }
  };
  controller.build = function (scene) {
    currentText = diagnostic ? {} : undefined;
    let result, frameText;
    try {
      result = build.call(this, scene);
      frameText = currentText;
    } finally {
      currentText = undefined;
    }
    const sample = observation.capture(
      scene.token.metrics,
      scene.token.sequence,
      host.getMonotonicTime(),
      scene.token.owner.generation,
    );
    frameSamples.set(scene.token.sequence, sample);
    if (frameSamples.size > 128) frameSamples.delete(frameSamples.keys().next().value);
    pending.set(scene.token.sequence, { sample, frameText });
    if (pending.size > 3) pending.delete(pending.keys().next().value);
    return result;
  };
  controller.frameSubmitted = function (token) {
    const result = submitted.call(this, token);
    const entry = pending.get(token.sequence),
      sample = entry?.sample;
    pending.delete(token.sequence);
    if (sample) observation.submitted(sample);
    drainNative();
    if (diagnostics) {
      const drained = diagnostics.drain();
      const column = sample?.columns[activeColumn];
      const moving =
        column && previousOffset !== undefined && column.offset > previousOffset + 0.001;
      if (column) previousOffset = column.offset;
      if (moving) {
        for (const metric of drained.samples.filter((x) => x.frame === token.sequence)) {
          const add = (rows) => {
            const row = (rows[metric.stage] ??= { calls: 0, wall: 0, max: 0, count: 0 });
            row.calls++;
            row.wall += metric.duration;
            row.max = Math.max(row.max, metric.duration);
            row.count += metric.count;
          };
          add(cpu);
          for (const id of column.visible) add((sectionCpu[id] ??= {}));
        }
        for (const [label, value] of Object.entries(entry.frameText ?? {})) {
          const row = (text[label] ??= { calls: 0, wall: 0, max: 0, hits: 0, misses: 0 });
          row.calls += value.calls;
          row.wall += value.wall;
          row.max = Math.max(row.max, value.max);
          row.hits += value.hits;
          row.misses += value.misses;
        }
      }
      cpu.overwritten = (cpu.overwritten ?? 0) + drained.overwritten;
      cpu.invalid = (cpu.invalid ?? 0) + drained.invalid;
    }
    return result;
  };
  const command = observation.command;
  observation.command = function (name) {
    if (name === 'primary' || name === 'secondary') {
      drainNative();
      activeColumn = name;
      previousOffset = undefined;
      cpu = {};
      sectionCpu = {};
      text = {};
      native.length = 0;
      nativeOverflow = 0;
      surfaces.length = 0;
      surfaceOverflow = 0;
      unmappedSurfaces = 0;
      backingEvents.length = 0;
      backingOverflow = 0;
    }
    const result = command.call(this, name);
    if (name === 'finish') {
      drainNative();
      const snapshot = JSON.parse(observation.label),
        producer = {};
      for (const metric of native) {
        const wall = metric.width / 1000;
        if (
          metric.nativeTimestamp - wall < snapshot.leg.firstMovement ||
          metric.nativeTimestamp > snapshot.leg.bottom
        )
          continue;
        const row = (producer[metric.stage] ??= { calls: 0, wall: 0, max: 0 });
        row.calls++;
        row.wall += wall;
        row.max = Math.max(row.max, wall);
      }
      observation.label = JSON.stringify({
        ...snapshot,
        nativeSurfaces: surfaces,
        surfaceOverflow,
        unmappedSurfaces,
        ...(backingAudit ? { backingEvents, backingOverflow } : {}),
        ...(diagnostic
          ? {
              diagnostic: {
                cpu,
                sectionCpu,
                text,
                producer,
                nativeOverflow,
                textCache: controller.context.text.debugStats,
                scope:
                  'moving submitted frames; producer stages fully inside movement QPC window; stage and section walls overlap and must not be added',
              },
            }
          : {}),
      });
      activeColumn = undefined;
    }
    return result;
  };
  application.dispose = function (...args) {
    if (manual)
      globalThis.SkiaApi.nelyxReportInputGeometryStatus(
        JSON.stringify({
          ...observation.snapshot(),
          kind: 'gallery-range-manual',
          ownerGeneration: view.owner.generation,
          scope: 'manual coverage snapshot; automatic full-range gates and timing were not run',
        }),
      );
    controller.build = build;
    controller.frameSubmitted = submitted;
    for (const restore of restores.reverse()) restore();
    observation.command = command;
    pending.clear();
    frameSamples.clear();
    surfaces.length = 0;
    view.frameDiagnostics = previous;
    observation.dispose();
    application.dispose = close;
    const result = close.apply(this, args);
    if (!backingAudit) return result;
    return Promise.resolve(result).then(() => {
      drainNative();
      api.nelyxReportInputGeometryStatus(
        JSON.stringify({
          schema: 1,
          kind: 'backing-sdk',
          mode: backingMode,
          ...backingSdk,
          closed: true,
          tsFallbacks: 0,
          scope:
            'native producer-result operations observed through the SDK host; baseline and miss both use existing C++ import',
        }),
      );
    });
  };
}
