// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { SizedBox, Builder } from '@nelyx/core/framework/widgets/basic';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { captureSceneFrame, disposeFrame, captureMetrics } from '@nelyx/core/ui/frame';

/** Real Core build/layout/paint/hit/semantics/input tree; primitive-only, no raster backend. */
export function fixture({
  paths,
  binaryMessenger,
  platformServices,
  semanticsUpdateInterval,
  accessibilityEnabled,
  viewId = 'w12-structure-root',
} = {}) {
  let now = 0,
    sequence = 0,
    child = new SizedBox(1, 1),
    lastFrame = null;
  const owner = { id: viewId, generation: 1 };
  const metrics = {
    logicalWidth: 240,
    logicalHeight: 160,
    physicalWidth: 240,
    physicalHeight: 160,
    scale: 1,
    viewportGeneration: 1,
    rendererGeneration: 1,
    nativeContextGeneration: null,
    nativeSurfaceGeneration: null,
  };
  const resources = new ResourceRegistry();
  const errors = [];
  const context = {
    owner,
    resources,
    assets: new Map(),
    clock: { now: () => now },
    requestFrame() {},
    readMetrics: () => metrics,
    readStatus: () => 'open',
    reportError: (error) => errors.push(error),
    ...(binaryMessenger ? { binaryMessenger } : {}),
    ...(platformServices ? { platformServices } : {}),
    text: {
      createParagraph() {
        throw new Error('This primitive Root regression must not require a text backend');
      },
    },
    editing: { capability: 'unavailable' },
    semantics: { capability: 'unavailable' },
    ...(paths ? { paths } : {}),
  };
  const root = new FrameworkRoot(context, {
    semanticsUpdateInterval,
    accessibilityEnabled,
    createRoot: () => new Builder(() => child),
  });
  const assertNoErrors = () =>
    assert.equal(
      errors.length,
      0,
      errors.map((error) => String(error.exception ?? error)).join('\n'),
    );
  // This CPU consumer retains the latest recording through replay, then releases it.
  const frame = ({ timing, canRunOptionalWork } = {}) => {
    if (lastFrame) disposeFrame(lastFrame);
    const token = {
      owner,
      metrics: captureMetrics(metrics),
      sequence: ++sequence,
      ...(timing ? { timing } : {}),
    };
    lastFrame = captureSceneFrame(
      token,
      root.build({ token, resources, ...(canRunOptionalWork ? { canRunOptionalWork } : {}) }),
    );
    assertNoErrors();
    return lastFrame.commands;
  };
  const set = (value) => {
    child = value;
    root.root?.markNeedsBuild();
    return frame();
  };
  const pointer = (kind, x, y) =>
    root.pointer({
      kind,
      x,
      y,
      pointer: 1,
      device: 'mouse',
      buttons: kind === 'up' ? 0 : 1,
      timestamp: now,
      viewportGeneration: 1,
    });
  return {
    root,
    frame,
    set,
    elapse: (ms) => {
      now += ms;
    },
    advance: (ms) => {
      now += ms;
      return frame();
    },
    tap(id) {
      const node = root.nodes.find((node) => node.id === id);
      assert(node, 'Expected live semantic control ' + id);
      const { x, y, width, height } = node.bounds;
      pointer('down', x + width / 2, y + height / 2);
      frame();
      pointer('up', x + width / 2, y + height / 2);
      frame();
    },
    close() {
      if (lastFrame) disposeFrame(lastFrame);
      lastFrame = null;
      root.dispose();
      resources.dispose();
      assertNoErrors();
    },
  };
}
