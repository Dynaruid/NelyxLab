// SPDX-License-Identifier: BSD-3-Clause
// Startup selection and bounded service accounting only. No FrameDiagnostics,
// render hooks, direct API smoke, clocks, or periodic source observations.
import { createInputGeometryService } from '@nelyx/skia-native/input-geometry';
import { createSceneCompositionService } from '@nelyx/skia-native/scene-composition';
import { createSemanticsGeometryService } from '@nelyx/skia-native/semantics-geometry';

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
    !['ts', 'snapshot', 'retained', 'path', 'paint', 'composition', 'semantics', 'all'].includes(
      mode,
    )
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
  let closed = false;
  application.dispose = function (...args) {
    if (!closed) {
      closed = true;
      for (const { name, service } of services) {
        delete context[name];
        service.dispose();
      }
      if (previousBatch === undefined) delete resources.sceneBatch;
      else resources.sceneBatch = previousBatch;
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
