// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { PlatformViewRegistry } from '../dist/hosting/platform-views.js';
import { BoxConstraints } from '../dist/framework/rendering/constraints.js';
import { PlatformViewLayer } from '../dist/framework/rendering/layer.js';
import { platformViewInput } from '../dist/framework/rendering/platform-view-input.js';
import { RenderBox } from '../dist/framework/rendering/object.js';
import { withRenderPaint } from '../dist/framework/rendering/phase.js';
import { PaintingContext } from '../dist/framework/painting/context.js';
import { BuildOwner } from '../dist/framework/widgets/framework.js';
import { PlatformView, RenderPlatformView } from '../dist/framework/widgets/platform-view.js';
import {
  SnapshotController,
  SnapshotWidget,
  SnapshotMode,
  SnapshotPainter,
} from '../dist/framework/widgets/snapshot-widget.js';
import { Canvas } from '../dist/ui/canvas.js';
import { disposeFrame, freezeFrame } from '../dist/ui/frame.js';
import { decodeWebFrame } from '../dist/ui/web-frame-wire.js';
import { SceneBuilder } from '../dist/ui/scene.js';
import {
  partitionPlatformViewScene,
  platformViewDrawCommands,
  encodePlatformViewForeground,
} from '../dist/ui/platform-view-scene.js';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child']);
  process.exit(0);
}

const owner = { id: 'view', generation: 1 };
const other = { id: 'view', generation: 2 };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const first = new PlatformViewRegistry(owner, (error) => {
  throw error;
});
const second = new PlatformViewRegistry(other);
let created = 0;
let retired = 0;
let event;
const updates = [];
const factory = {
  create(request) {
    created++;
    event = request.emit;
    return {
      dispose: () => {
        retired++;
      },
      update: (value) => updates.push(value),
    };
  },
};
first.register('editor', factory);
second.register('editor', factory);
const states = [];
const values = [];
const entry = first.reserve(
  'editor',
  'initial',
  (status) => states.push(status.kind),
  (value) => values.push(value),
);
const independent = second.reserve(
  'editor',
  null,
  () => {},
  () => {},
);
assert.equal(entry.identity.instanceId, independent.identity.instanceId);
assert.notDeepEqual(entry.identity.owner, independent.identity.owner);
const render = new RenderPlatformView(entry, true, () => {});
render.layout(new BoxConstraints());
await flush();
assert.equal(created, 0);
render.layout(BoxConstraints.tight({ width: 0, height: 60 }));
await flush();
assert.equal(created, 1);
assert.equal(render.platformViewId, undefined);
render.layout(BoxConstraints.tight({ width: 80, height: 60 }));
assert.equal(render.platformViewId, entry.identity.instanceId);
entry.start();
await flush();
assert.equal(created, 1);
entry.controller.update('changed');
assert.deepEqual(updates, ['changed']);
first.placementSupport(entry.identity.instanceId, 'group effect');
first.placementSupport(entry.identity.instanceId);
assert.deepEqual(states, ['ready', 'unavailable', 'ready']);
event('live');
first.dispose();
entry.dispose();
event('late');
entry.controller.update('late');
assert.equal(retired, 1);
assert.deepEqual(values, ['live']);
assert.deepEqual(updates, ['changed']);
render.dispose();
second.dispose();

const delayed = new PlatformViewRegistry(owner);
const result = Promise.withResolvers();
let aborted = 0;
delayed.register('slow', {
  create({ signal }) {
    signal.onAbort(() => {
      aborted++;
    });
    return result.promise;
  },
});
const removed = delayed.reserve(
  'slow',
  null,
  () => assert.fail('Late creation published'),
  () => {},
);
removed.start();
await flush();
removed.dispose();
result.resolve({
  dispose: () => {
    retired++;
  },
});
await flush();
assert.equal(aborted, 1);
assert.equal(retired, 2);
delayed.dispose();

const types = new PlatformViewRegistry(owner);
const mounted = [];
const disposed = [];
for (const viewType of ['editor', 'button']) {
  types.register(viewType, {
    create(request) {
      mounted.push(request);
      return { dispose: () => disposed.push(request.instanceId) };
    },
  });
}
const widgets = new BuildOwner({ owner, platformViews: types }, () => {});
const element = new PlatformView({ viewType: 'editor', creationParams: 'initial' }).createElement();
const size = BoxConstraints.tight({ width: 64, height: 48 });
element.mount(undefined, widgets);
widgets.flushBuild();
element.findRenderObject().layout(size);
await flush();
widgets.flushBuild();
element.update(new PlatformView({ viewType: 'editor', creationParams: 'ignored' }));
widgets.flushBuild();
element.findRenderObject().layout(size);
await flush();
assert.equal(mounted.length, 1);
assert.equal(mounted[0].creationParams, 'initial');

element.update(new PlatformView({ viewType: 'button' }));
widgets.flushBuild();
element.findRenderObject().layout(size);
await flush();
widgets.flushBuild();
assert.equal(mounted.length, 2);
assert.notEqual(mounted[0].instanceId, mounted[1].instanceId);
assert.deepEqual(disposed, [mounted[0].instanceId]);
element.unmount();
widgets.dispose();
types.dispose();
assert.deepEqual(
  disposed,
  mounted.map(({ instanceId }) => instanceId),
);

const viewport = { x: 0, y: 0, width: 200, height: 150 };
const marker = { instanceId: 1, visible: true, rect: { x: 0, y: 0, width: 80, height: 60 } };
const clear = { op: 'clear', color: 0xff101827 };
const rect = { op: 'rect', rect: { x: 17, y: 17, width: 25, height: 20 }, color: 0x80ff0000 };
const layer = new PlatformViewLayer(marker);
assert.equal(layer.supportsRasterization(), false);

for (const mode of Object.values(SnapshotMode)) {
  const controller = new SnapshotController({ allowSnapshotting: true });
  const child = new (class extends RenderBox {
    performLayout(constraints) {
      return constraints.biggest;
    }
    paint(context) {
      context.addLayer(new PlatformViewLayer(marker));
      context.addCommands([rect]);
    }
  })();
  let live = 0;
  let captures = 0;
  const painter = new (class extends SnapshotPainter {
    paint(context, offset, _size, draw) {
      live++;
      draw(context, offset);
    }
    paintSnapshot() {
      captures++;
    }
    shouldRepaint() {
      return false;
    }
  })();
  const widget = new SnapshotWidget({ child: null, controller, painter, mode });
  const renderSnapshot = widget.createRenderObject({
    dependOn: () => ({ data: { scale: 1 } }),
    services: {
      rasterizer: {
        rasterizeSync(capture) {
          assert.equal(capture.frame.commands.filter(({ op }) => op === 'rect').length, 1);
          return { dispose() {} };
        },
      },
    },
  });
  renderSnapshot.setChildren([child]);
  renderSnapshot.layout(size);
  const context = new PaintingContext(null, null, true);
  const paint = () => withRenderPaint(() => renderSnapshot.paint(context));
  try {
    if (mode === SnapshotMode.normal) assert.throws(paint, /contains a PlatformView/);
    else {
      paint();
      assert.deepEqual([live, captures], mode === SnapshotMode.permissive ? [1, 0] : [0, 1]);
    }
  } finally {
    context.dispose();
    renderSnapshot.setChildren([]);
    child.dispose();
    renderSnapshot.dispose();
    painter.dispose();
    controller.dispose();
  }
}

const initial = new SceneBuilder();
const retained = initial.pushOffset(8, 10);
const firstClip = initial.pushClipRect({ x: 12, y: 0, width: 100, height: 48 });
const secondClip = initial.pushClipRect({ x: 0, y: 14, width: 56, height: 60 });
layer.addToScene(initial);
initial._appendCanvasCommands([rect]);
initial.pop();
initial.pop();
initial.pop();
const capture = (builder) => {
  const canvas = new Canvas();
  canvas.addCommands([clear]);
  const markers = builder._buildInto(canvas);
  try {
    const parts = partitionPlatformViewScene(canvas.commands, markers, viewport);
    const drawing = parts.flatMap((part) =>
      'draw' in part ? [platformViewDrawCommands(canvas.commands, part.draw)] : [],
    );
    return { parts, drawing };
  } finally {
    canvas.dispose();
  }
};
const original = capture(initial);
assert.deepEqual(
  original.parts.map((part) => ('draw' in part ? 'draw' : 'view')),
  ['draw', 'view', 'draw'],
);
assert.deepEqual(original.parts[1].view.bounds, { x: 8, y: 10, width: 80, height: 60 });
assert.deepEqual(original.parts[1].view.clip, { x: 20, y: 24, width: 44, height: 34 });
assert.equal(original.drawing[0][0].color, clear.color);
assert.equal(original.drawing[1][0].color, 0);
assert.equal(original.drawing[1].filter(({ op }) => op === 'clipRect').length, 2);
assert.equal(
  original.drawing[1].filter(({ op }) => op === 'save').length,
  original.drawing[1].filter(({ op }) => op === 'restore').length,
);

const moved = new SceneBuilder(null, {
  compose(source) {
    assert.equal(source, undefined);
    return [];
  },
  commit() {},
  discard() {},
});
const outer = moved.pushOffset(2, -4);
moved.addRetained(retained);
moved.pop();
const next = capture(moved);
assert.deepEqual(next.parts[1].view.bounds, { x: 10, y: 6, width: 80, height: 60 });
assert.deepEqual(next.parts[1].view.clip, { x: 22, y: 20, width: 44, height: 34 });

const forced = new SceneBuilder();
forced.addRetained(retained);
const snapshot = forced.build();
const output = new Canvas();
snapshot._draw(output);
assert.equal(output.commands.filter(({ op }) => op === 'rect').length, 1);
output.dispose();
snapshot.dispose();

const group = new SceneBuilder();
const opacity = group.pushOpacity(128);
group.addRetained(retained);
group.pop();
const unsupported = capture(group);
assert.equal(unsupported.drawing.length, 1);
assert.equal(unsupported.parts[1].view.visible, false);
assert.match(unsupported.parts[1].view.unsupportedReason, /layer or filter/);
const disjoint = new SceneBuilder();
disjoint.addPlatformView(marker);
disjoint._appendCanvasCommands([{ ...rect, rect: { ...rect.rect, x: 100 } }]);
assert.equal(capture(disjoint).drawing.length, 1);

const modal = new SceneBuilder();
modal.addPlatformView(marker);
modal.addPlatformView({ barrier: viewport });
modal.addPlatformView({ ...marker, instanceId: 2 });
const blocked = capture(modal);
const inputRoot = new RenderBox();
assert.deepEqual(
  platformViewInput(inputRoot, blocked.parts, viewport, () => []),
  [{ instanceId: 1, rect: marker.rect }],
);
inputRoot.dispose();

const token = {
  owner: { id: 'native-test', generation: 0x1_0000_0001 },
  sequence: 0x1_0000_0002,
  metrics: {
    logicalWidth: 200,
    logicalHeight: 150,
    physicalWidth: 250,
    physicalHeight: 188,
    scale: 1.25,
    viewportGeneration: 1,
    rendererGeneration: 1,
    nativeContextGeneration: 1,
    nativeSurfaceGeneration: 1,
  },
};
const nested = { op: 'drawPicture', resource: { id: 'nested', generation: 1 } };
const source = freezeFrame(token, [clear, nested]);
const foreground = { start: 1, end: 2, prefix: [], restoreCount: 0 };
const packet = encodePlatformViewForeground(source, foreground, () => [rect]);
const decoded = decodeWebFrame(packet, token.owner, () => {
  assert.fail('The native shape packet retained a resource reference');
});
assert.equal(decoded.token.sequence, token.sequence);
assert.deepEqual(decoded.commands, [
  { op: 'clear', color: 0 },
  { op: 'save' },
  rect,
  { op: 'restore' },
]);
assert.throws(() => encodePlatformViewForeground(source, foreground, () => [nested]), /nesting/);
disposeFrame(source);
disposeFrame(decoded);
for (const disposable of [opacity, outer, retained, firstClip, secondClip, layer])
  disposable.dispose();
console.log(
  'Platform view reservations, stale events, retained scopes, fallback and pixel-only snapshots passed.',
);
