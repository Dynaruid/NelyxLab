// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { AppSession } from '@nelyx/core/hosting/runtime';
import { widgetApplication } from '@nelyx/core/framework/widgets/root';
import { Builder, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { ChangeNotifier } from '@nelyx/core/foundation/notifier';
import { PaintingContext } from '@nelyx/core/framework/painting/context';
import { OffsetLayer, PictureLayer, LayerHandle } from '@nelyx/core/framework/rendering/layer';
import { fixture as cpuFixture } from '../../../packages/material/tests/root-fixture.mjs';
const timeout = 1_200_000;
class Painter extends CustomPainter {
  paints = 0;
  color = 0xff123456;
  constructor(signal) {
    super({ repaint: signal });
  }
  paint(canvas) {
    this.paints++;
    canvas.rect({ x: 0, y: 0, width: 10, height: 10 }, this.color);
  }
  shouldRepaint() {
    return false;
  }
}
function fixture({ boundary = false } = {}) {
  const callbacks = new Set(),
    submissions = [],
    errors = [],
    signal = new ChangeNotifier(),
    painter = new Painter(signal);
  let now = 0,
    busy = false;
  const clock = {
      request(callback) {
        callbacks.add(callback);
        return {
          dispose() {
            callbacks.delete(callback);
          },
        };
      },
    },
    primitive = new CustomPaint(new SizedBox(20, 20), { painter }),
    paint = boundary ? new RepaintBoundary(primitive) : primitive;
  let child = new Semantics(paint, { id: 'visual', role: 'button', name: 'Before' });
  const renderer = {
    capabilities: { notifications: 'unavailable', present: 'unobserved' },
    updateMetrics() {},
    canBuildFrame() {
      return !busy;
    },
    submit(frame, lease) {
      if (busy) return { status: 'rejected', reason: 'busy' };
      lease.transfer();
      submissions.push({
        token: frame.token,
        colors: frame.commands.filter((c) => c.op === 'rect').map((c) => c.color),
        transforms: frame.commands.filter((c) => c.op === 'transform').map((c) => c.matrix),
      });
      lease.returnBy('renderer');
      return { status: 'accepted', submission: submissions.length };
    },
    dispose() {
      return Promise.resolve();
    },
  };
  const session = new AppSession(
    widgetApplication({ id: 'visual', createRoot: () => new Builder(() => child) }),
    clock,
  );
  const view = session.attach({
    id: 'visual',
    generation: 1,
    metrics: {
      logicalWidth: 240,
      logicalHeight: 160,
      physicalWidth: 240,
      physicalHeight: 160,
      scale: 1,
      viewportGeneration: 1,
      rendererGeneration: 1,
      nativeContextGeneration: 1,
      nativeSurfaceGeneration: 1,
    },
    renderer,
    ownership: 'owned',
    onError: (error) => errors.push(error),
    services: {
      assets: new Map(),
      clock: { now: () => now },
      text: {
        createParagraph() {
          throw Error('No text backend in visual commit regression');
        },
      },
      editing: { capability: 'unavailable' },
      semantics: { capability: 'unavailable' },
    },
  });
  const tick = () => {
    now += 16;
    const batch = [...callbacks];
    callbacks.clear();
    for (const cb of batch) cb();
    assert.deepEqual(errors, []);
  };
  return {
    view,
    root: view.controller,
    session,
    painter,
    signal,
    paint,
    submissions,
    tick,
    callbacks,
    set busy(value) {
      busy = value;
    },
    set(value) {
      child = value;
      view.controller.root.markNeedsBuild();
    },
    request() {
      view.requestFrame();
      tick();
    },
    async close() {
      await session.dispose();
      signal.dispose();
      assert.equal(callbacks.size, 0);
    },
  };
}

test(
  'requested stationary and semantics-only frames keep drawing and accessibility live',
  { timeout },
  async () => {
    const f = fixture();
    try {
      f.request();
      assert.equal(f.painter.paints, 1);
      assert.equal(f.submissions.length, 1);
      for (let i = 0; i < 3; i++) f.request();
      assert.equal(f.painter.paints, 4);
      assert.equal(f.submissions.length, 4);
      f.set(new Semantics(f.paint, { id: 'visual', role: 'button', name: 'After' }));
      f.tick();
      assert.equal(f.root.nodes.find((n) => n.id === 'visual').name, 'After');
      assert.equal(f.painter.paints, 5);
      assert.equal(f.submissions.length, 5);
      f.painter.color = 0xff654321;
      f.signal.notifyListeners();
      f.tick();
      assert.equal(f.painter.paints, 6);
      assert.equal(f.submissions.length, 6);
      assert.deepEqual(f.submissions.at(-1).colors, [0xff654321]);
    } finally {
      await f.close();
    }
  },
);

test(
  'unobserved admission cannot suppress a later explicit redraw of the same scene',
  { timeout },
  async () => {
    const f = fixture();
    try {
      f.request();
      const first = f.submissions.at(-1);
      // Native may discard an admitted recording; admission is no pixel receipt.
      // A later redraw must reach the renderer even with unchanged paint inputs.
      f.request();
      assert.equal(f.submissions.length, 2);
      assert(f.submissions.at(-1).token.sequence > first.token.sequence);
    } finally {
      await f.close();
    }
  },
);

test(
  'persistent frame callbacks keep changing pixels without a layout or Widget update',
  { timeout },
  async () => {
    const f = fixture();
    let frame = 0;
    f.root.scheduler.addPersistentFrameCallback(() => {
      f.painter.color = 0xff123400 + ++frame;
    });
    try {
      for (let i = 0; i < 8; i++) {
        f.request();
        assert.equal(f.submissions.length, i + 1);
        assert.deepEqual(f.submissions.at(-1).colors, [0xff123400 + i + 1]);
      }
    } finally {
      await f.close();
    }
  },
);

test(
  'a busy or forced rebuild cannot mark an unsubmitted visual revision as accepted',
  { timeout },
  async () => {
    const f = fixture();
    try {
      f.busy = true;
      f.request();
      assert.equal(f.submissions.length, 0);
      assert.equal(f.painter.paints, 1);
      f.view.requestForcedFrame();
      f.tick();
      assert.equal(f.submissions.length, 0);
      f.busy = false;
      f.request();
      assert.equal(
        f.submissions.length,
        2,
        'Submit the current prepared frame, then honor the new redraw',
      );
      assert.deepEqual(
        f.submissions.map((frame) => frame.token.sequence),
        [2, 3],
      );
      assert.equal(f.painter.paints, 3);
      f.busy = true;
      f.painter.color = 0xffabcdef;
      f.signal.notifyListeners();
      f.tick();
      f.view.requestForcedFrame();
      f.tick();
      assert.equal(f.submissions.length, 2);
      f.busy = false;
      f.request();
      assert.equal(f.submissions.length, 4);
      assert.deepEqual(f.submissions.at(-1).colors, [0xffabcdef]);
      f.request();
      assert.equal(f.submissions.length, 5);
    } finally {
      await f.close();
    }
  },
);

test(
  'prepared widget frames remain eligible only until paint, build, layout or input changes',
  { timeout },
  async () => {
    const f = fixture({ boundary: true });
    let lastToken;
    try {
      f.busy = true;
      f.request();
      const current = () => {
        lastToken = f.view.pending.frame.token;
        assert(f.root.canSubmitPreparedFrame(lastToken));
      };
      current();
      f.view.requestFrame();
      assert(
        f.root.canSubmitPreparedFrame(lastToken),
        'A future tick does not change already prepared pixels',
      );
      f.painter.color = 0xffabcdef;
      f.signal.notifyListeners();
      assert.equal(
        f.root.canSubmitPreparedFrame(lastToken),
        false,
        'Nested paint invalidation revokes the snapshot',
      );
      f.view.requestForcedFrame();
      f.tick();
      current();
      f.root.root.markNeedsBuild();
      assert.equal(f.root.canSubmitPreparedFrame(lastToken), false);
      f.view.requestForcedFrame();
      f.tick();
      current();
      f.root.pipeline.root.markNeedsLayout();
      assert.equal(f.root.canSubmitPreparedFrame(lastToken), false);
      f.view.requestForcedFrame();
      f.tick();
      current();
      const previous = lastToken.sequence;
      f.view.dispatchPointer({
        kind: 'hover',
        pointer: 1,
        device: 'mouse',
        buttons: 0,
        x: 230,
        y: 150,
        timestamp: 100,
        viewportGeneration: 1,
      });
      f.busy = false;
      f.request();
      assert.equal(
        f.submissions.length,
        1,
        'New input replaces the prepared scene before native submission',
      );
      assert(f.submissions[0].token.sequence > previous);
      assert.deepEqual(f.submissions[0].colors, [0xffabcdef]);
    } finally {
      await f.close();
    }
    assert.equal(f.root.canSubmitPreparedFrame(lastToken), false);
  },
);

test(
  'a current prepared widget frame overlaps queued motion while contact boundaries replace it',
  { timeout },
  async () => {
    for (const kind of ['wheel', 'down']) {
      const f = fixture();
      try {
        f.busy = true;
        f.request();
        const pointer = f.root.pointer;
        f.root.pointer = function (event) {
          pointer.call(this, event);
          f.painter.color = 0xffabcdef;
          f.signal.notifyListeners();
        };
        f.view.queuePointer({
          kind,
          pointer: 1,
          device: 'mouse',
          buttons: kind === 'down' ? 1 : 0,
          x: 230,
          y: 150,
          timestamp: 100,
          viewportGeneration: 1,
          ...(kind === 'wheel' ? { deltaX: 0, deltaY: 8 } : {}),
        });
        f.busy = false;
        f.tick();
        assert.deepEqual(
          f.submissions.map((frame) => frame.token.inputSequence),
          kind === 'wheel' ? [0, 1] : [1],
        );
        assert.equal(
          f.painter.paints,
          2,
          'Preparing the next tick never paints the preceding snapshot again',
        );
        assert.deepEqual(f.submissions.at(-1).colors, [0xffabcdef]);
      } finally {
        await f.close();
      }
    }
  },
);

test(
  'first-frame deferral keeps a built scene unsubmitted until its owner allows the first frame',
  { timeout },
  async () => {
    const f = fixture();
    try {
      f.root.scheduler.deferFirstFrame();
      f.request();
      assert.equal(f.submissions.length, 0);
      assert.equal(f.painter.paints, 1);
      f.root.scheduler.allowFirstFrame();
      f.tick();
      assert.equal(f.submissions.length, 1);
      assert.equal(f.painter.paints, 2);
    } finally {
      await f.close();
    }
  },
);

test(
  'paint-time invalidation survives both the View and a nested repaint boundary commit',
  { timeout },
  async () => {
    for (const boundary of [false, true]) {
      const f = fixture({ boundary }),
        paint = f.painter.paint;
      f.painter.paint = function (canvas) {
        paint.call(this, canvas);
        if (this.paints === 1) {
          this.color = 0xffabcdef;
          f.signal.notifyListeners();
        }
      };
      try {
        f.request();
        assert.deepEqual(f.submissions[0].colors, [0xff123456]);
        f.tick();
        assert.equal(f.painter.paints, 2);
        assert.deepEqual(f.submissions.at(-1).colors, [0xffabcdef]);
        f.request();
        assert.equal(f.submissions.length, 3);
      } finally {
        await f.close();
      }
    }
  },
);

test(
  'a retained boundary layer-only transform reaches every requested native frame',
  { timeout },
  async () => {
    const f = fixture({ boundary: true }),
      layer = new OffsetLayer(),
      hold = new LayerHandle(layer),
      picture = PaintingContext._recordPicture((c) =>
        c.rect({ x: 0, y: 0, width: 5, height: 5 }, 0xffabcdef),
      ),
      leaf = new PictureLayer({ x: 0, y: 0, width: 5, height: 5 });
    leaf.picture = picture;
    layer.append(leaf);
    const paint = f.painter.paint;
    f.painter.paint = function (canvas) {
      paint.call(this, canvas);
      canvas.addLayer(layer);
    };
    try {
      f.request();
      layer.offset = { x: 11, y: 13 };
      f.request();
      assert.equal(f.submissions.length, 2);
      assert.equal(f.painter.paints, 1);
      assert(
        f.submissions
          .at(-1)
          .transforms.some((m) =>
            m.length === 6 ? m[4] === 11 && m[5] === 13 : m[12] === 11 && m[13] === 13,
          ),
      );
      f.request();
      assert.equal(f.submissions.length, 3);
    } finally {
      await f.close();
      hold.dispose();
      assert(picture.debugDisposed);
    }
  },
);

test(
  'new viewport, DPI, backing, renderer and show scopes each prepare and submit their own exact frame',
  { timeout },
  async () => {
    const f = fixture();
    try {
      f.request();
      let accepted = 1;
      for (const change of [
        { logicalWidth: 300, physicalWidth: 300 },
        { scale: 2, physicalWidth: 600, physicalHeight: 320 },
        { nativeSurfaceGeneration: 2 },
        { rendererGeneration: 2 },
      ]) {
        f.view.updateMetrics({
          ...f.view.currentMetrics,
          ...change,
          viewportGeneration: f.view.currentMetrics.viewportGeneration + 1,
        });
        f.tick();
        assert.equal(f.submissions.length, ++accepted);
        f.request();
        assert.equal(f.submissions.length, ++accepted);
      }
      f.view.setVisible(false);
      f.view.setVisible(true);
      f.tick();
      assert.equal(f.submissions.length, ++accepted);
      f.request();
      assert.equal(f.submissions.length, ++accepted);
    } finally {
      await f.close();
    }
  },
);

test('each new viewport and backing epoch redraws its own exact scene', { timeout }, async () => {
  const f = fixture();
  try {
    f.request();
    let accepted = 1;
    for (const change of [
      { viewportGeneration: 2 },
      { viewportGeneration: 3, nativeSurfaceGeneration: 2 },
      { viewportGeneration: 4, nativeSurfaceGeneration: 1 },
    ]) {
      f.view.updateMetrics({ ...f.view.currentMetrics, ...change });
      f.tick();
      assert.equal(f.submissions.length, ++accepted);
      assert.equal(f.painter.paints, accepted);
      assert.equal(
        f.submissions.at(-1).token.metrics.viewportGeneration,
        change.viewportGeneration,
      );
      assert.equal(
        f.submissions.at(-1).token.metrics.nativeSurfaceGeneration,
        f.view.currentMetrics.nativeSurfaceGeneration,
      );
      f.request();
      assert.equal(f.submissions.length, ++accepted);
    }
  } finally {
    await f.close();
  }
});

test(
  'post-frame command edits are submitted and the next redraw records the current scene',
  { timeout },
  async () => {
    const f = fixture(),
      compose = PaintingContext.prototype.compose;
    let recording;
    PaintingContext.prototype.compose = function (...args) {
      recording = this;
      return compose.apply(this, args);
    };
    try {
      f.request();
      f.root.scheduler.addPostFrameCallback(() =>
        recording.commands.push({
          op: 'rect',
          rect: { x: 0, y: 0, width: 1, height: 1 },
          color: 0xfffedcba,
        }),
      );
      f.request();
      assert.deepEqual(f.submissions.at(-1).colors, [0xff123456, 0xfffedcba]);
      assert.equal(f.submissions.length, 2);
      f.request();
      assert.deepEqual(f.submissions.at(-1).colors, [0xff123456]);
      assert.equal(f.submissions.length, 3);
      assert.equal(f.painter.paints, 3);
    } finally {
      PaintingContext.prototype.compose = compose;
      await f.close();
    }
  },
);

test('a failed frame capture cannot suppress painting the retry', { timeout }, () => {
  const f = cpuFixture(),
    signal = new ChangeNotifier(),
    painter = new Painter(signal),
    compose = PaintingContext.prototype.compose;
  let recording;
  PaintingContext.prototype.compose = function (...args) {
    recording = this;
    return compose.apply(this, args);
  };
  try {
    f.set(new CustomPaint(new SizedBox(20, 20), { painter }));
    f.root.scheduler.addPostFrameCallback(() => recording.commands.push({ op: 'save' }));
    assert.throws(
      () => f.frame(),
      (error) => error.code === 'unbalanced-save',
    );
    assert.equal(painter.paints, 2);
    f.frame();
    assert.equal(painter.paints, 3);
  } finally {
    PaintingContext.prototype.compose = compose;
    f.close();
    signal.dispose();
  }
});
