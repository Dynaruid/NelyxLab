// SPDX-License-Identifier: BSD-3-Clause
// Startup selection and bounded service accounting only. No FrameDiagnostics,
// render hooks, direct API smoke, clocks, or periodic source observations.
import { createInputGeometryService } from '@nelyx/skia-native/input-geometry';
import { createSceneCompositionService } from '@nelyx/skia-native/scene-composition';
import { createSemanticsGeometryService } from '@nelyx/skia-native/semantics-geometry';
import { createFlexLayoutService } from '@nelyx/skia-native/flex-layout';

export function installNativeServiceExperiment(application, options = {}) {
  const api = globalThis.SkiaApi,
    view = application.view,
    context = view.controller.context,
    manual = options.manual === true,
    retained = manual && ['all', 'retained'].includes(options.expectedMode);
  if (!api?.nelyxNativeServiceAuditBegin || !api.nelyxNativeServiceAuditEnd)
    throw Error('Rebuild native supplier with independent native service counters');
  if (
    view.frameDiagnostics ||
    (retained ? context.inputGeometry?.execution?.().mode !== 'retained' : context.inputGeometry) ||
    context.sceneComposition ||
    context.semanticsGeometry
  )
    throw Error('Native experiment requires an otherwise uninstrumented TS owner');
  const mode = api.nelyxNativeServiceAuditBegin(view.owner.generation),
    sdk = {
      schema: 1,
      mode,
      ownerGeneration: view.owner.generation,
      snapshotCalls: 0,
      snapshotEditors: 0,
      inputFallbacks: 0,
      inputFallbackReasons: {},
      composePrepares: 0,
      composeCommits: 0,
      composeFallbacks: 0,
      semanticsCalls: 0,
      semanticsQueries: 0,
      semanticsFallbacks: 0,
      closed: false,
    },
    services = [],
    resources = view.options.renderer.resources,
    previousBatch = resources.sceneBatch;
  if (manual && mode !== options.expectedMode)
    throw Error('Native module selection differs from the requested manual mode');
  if (previousBatch !== undefined) throw Error('Unexpected pre-enabled native scene batch');
  const ensure = () => {
    if (sdk.closed) throw Error('Native experiment owner closed');
  };
  const install = (name, service) => {
    if (!service) throw Error('Requested native experiment capability missing: ' + mode);
    services.push({ name, service });
    context[name] = service;
    return service;
  };
  const engineReaders = new Map(),
    engineCleanups = [];
  if (mode === 'text' || mode === 'all') {
    if (
      !context.text.setNativeParagraphTransactions ||
      !context.text.nativeParagraphTransactionExecution
    )
      throw Error('Requested native text transaction SDK capability missing');
    context.text.setNativeParagraphTransactions(true);
    engineReaders.set('text', () => context.text.nativeParagraphTransactionExecution());
    engineCleanups.push(() => context.text.setNativeParagraphTransactions(false));
  }
  if (mode === 'layout' || mode === 'all') {
    const pipeline = view.controller.pipeline;
    if (!pipeline || pipeline.flexLayout)
      throw Error('Native Flex requires an otherwise TS layout pipeline');
    const service = createFlexLayoutService(api, ensure);
    pipeline.flexLayout = service;
    engineReaders.set('layout', () => service.execution());
    engineCleanups.push(() => {
      delete pipeline.flexLayout;
      service.dispose();
    });
  }
  if (mode === 'frame' || mode === 'all') {
    const renderer = view.options.renderer;
    if (!renderer.setNativeFrameSegments || !renderer.nativeFrameSegmentExecution)
      throw Error('Requested native frame segment SDK capability missing');
    renderer.setNativeFrameSegments(true);
    engineReaders.set('frame', () => renderer.nativeFrameSegmentExecution());
  }
  if (mode === 'snapshot') {
    const service = install('inputGeometry', createInputGeometryService(api, view.owner, ensure)),
      project = service.project;
    service.project = function (frame, nodes, editors) {
      const result = project.call(this, frame, nodes, editors);
      sdk.snapshotCalls++;
      sdk.snapshotEditors += editors.length;
      return result;
    };
    service.noteFallback = (reason) => {
      sdk.inputFallbacks++;
      sdk.inputFallbackReasons[reason] = (sdk.inputFallbackReasons[reason] ?? 0) + 1;
    };
  }
  if (mode === 'composition' || mode === 'all') {
    const service = install(
        'sceneComposition',
        createSceneCompositionService(api, view.owner, ensure),
      ),
      begin = service.begin;
    service.begin = function (token, diagnostics) {
      const batch = begin.call(this, token, diagnostics),
        compose = batch.compose,
        commit = batch.commit,
        discard = batch.discard;
      let prepared = false;
      batch.compose = function (root) {
        const result = compose.call(this, root);
        prepared = result !== undefined;
        if (prepared) sdk.composePrepares++;
        else sdk.composeFallbacks++;
        return result;
      };
      batch.commit = function () {
        const result = commit.call(this);
        if (prepared) {
          sdk.composeCommits++;
          prepared = false;
        }
        return result;
      };
      batch.discard = function () {
        const result = discard.call(this);
        prepared = false;
        return result;
      };
      return batch;
    };
  }
  if (mode === 'semantics' || mode === 'all') {
    const service = install(
        'semanticsGeometry',
        createSemanticsGeometryService(api, view.owner, ensure),
      ),
      project = service.project;
    service.project = function (token, queries, diagnostics) {
      const result = project.call(this, token, queries, diagnostics);
      sdk.semanticsCalls++;
      sdk.semanticsQueries += queries.length;
      return result;
    };
    service.noteFallback = () => {
      sdk.semanticsFallbacks++;
    };
  }
  if (mode === 'path' || mode === 'paint' || mode === 'all') {
    if (api.nelyxScenePacketVersion?.() !== 2) throw Error('Native scene2 capability missing');
    resources.sceneBatch = mode;
  }
  if (
    ![
      'ts',
      'snapshot',
      'retained',
      'path',
      'paint',
      'composition',
      'semantics',
      'all',
      'backing',
      'text',
      'layout',
      'frame',
    ].includes(mode)
  )
    throw Error('Unknown native experiment mode');
  if (!manual && (mode === 'all' || mode === 'retained'))
    throw Error('Combined/retained modules require manual mode');
  if (manual)
    api.nelyxReportInputGeometryStatus(
      JSON.stringify({
        schema: 1,
        kind: 'manual-selection',
        mode,
        ownerGeneration: view.owner.generation,
      }),
    );
  const close = application.dispose;
  let closed = false,
    engineClosing;
  const retireServices = () => {
    for (const { name, service } of services.splice(0)) {
      delete context[name];
      service.dispose();
    }
    if (previousBatch === undefined) delete resources.sceneBatch;
    else resources.sceneBatch = previousBatch;
  };
  application.dispose = function (...args) {
    if (engineReaders.size) {
      if (engineClosing) return engineClosing;
      const finish = (success) => {
        const parts = [...engineReaders].map(([name, read]) => [name, read()]);
        if (mode === 'all') {
          const fallbackReasons = {};
          let tsFallbacks = 0;
          sdk.engine = { selected: [...engineReaders.keys()].sort() };
          for (const [name, part] of parts) {
            const { fallbackReasons: reasons, tsFallbacks: count = 0, ...work } = part;
            Object.assign(sdk.engine, work);
            tsFallbacks += count;
            for (const [reason, value] of Object.entries(reasons))
              fallbackReasons[name + ':' + reason] = value;
          }
          Object.assign(sdk.engine, { tsFallbacks, fallbackReasons });
        } else sdk.engine = { ...parts[0][1] };
        sdk.engine.closed =
          success && parts.every(([name, part]) => name !== 'frame' || part.closed === true);
        for (const cleanup of engineCleanups.splice(0).reverse()) cleanup();
        sdk.closed = success;
        api.nelyxReportInputGeometryStatus(
          JSON.stringify({ ...sdk, kind: manual ? 'manual' : 'experiment' }),
        );
        api.nelyxNativeServiceAuditEnd();
        application.dispose = close;
      };
      let result;
      try {
        retireServices();
        result = close.apply(this, args);
      } catch (error) {
        finish(false);
        throw error;
      }
      engineClosing = Promise.resolve(result).then(
        () => {
          finish(true);
        },
        (error) => {
          finish(false);
          throw error;
        },
      );
      return engineClosing;
    }
    if (!closed) {
      closed = true;
      retireServices();
      sdk.closed = true;
      api.nelyxReportInputGeometryStatus(
        JSON.stringify({ ...sdk, kind: manual ? 'manual' : 'experiment' }),
      );
      api.nelyxNativeServiceAuditEnd();
      application.dispose = close;
    }
    return close.apply(this, args);
  };
  return mode;
}
