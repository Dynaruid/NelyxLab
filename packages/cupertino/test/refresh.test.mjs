// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { GestureBinding } from '@nelyx/core/framework/gestures/binding';
import {
  PointerDownEvent,
  PointerMoveEvent,
  PointerUpEvent,
} from '@nelyx/core/framework/gestures/events';
import { HitTestEntry } from '@nelyx/core/framework/gestures/hit-test';
import { PointerDeviceKind } from '@nelyx/core/ui/pointer';
import { PipelineOwner } from '@nelyx/core/framework/rendering/object';
import { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { BuildOwner } from '@nelyx/core/framework/widgets/framework';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import {
  AlwaysScrollableScrollPhysics,
  BouncingScrollPhysics,
  ClampingScrollPhysics,
} from '@nelyx/core/framework/widgets/scroll-physics';
import { CustomScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { SliverFixedExtentList } from '@nelyx/core/framework/widgets/sliver';
import { Offset } from '@nelyx/core/ui/offset';
import {
  registerTickerScheduler,
  unregisterTickerScheduler,
} from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import {
  CupertinoSliverRefreshControl as Refresh,
  RefreshIndicatorMode as Mode,
} from '@nelyx/cupertino/refresh';
import { CupertinoSliverRefreshControl as AggregateRefresh } from '@nelyx/cupertino/widgets';

const timeout = 1_200_000;
const always = new AlwaysScrollableScrollPhysics();
const bouncing = new BouncingScrollPhysics({ parent: always });
const dims = { width: 360, height: 400 };

async function exercise(options, verify, { physics = bouncing, rows = 1 } = {}) {
  const media = {
    ...dims,
    scale: 1,
    textScale: 1,
    safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
    keyboardInset: 0,
  };
  let now = 0;
  const clock = { now: () => now };
  const scheduler = new FrameScheduler(clock, () => {});
  const owner = new BuildOwner(
    { clock, scheduler, readMetrics: () => media, readStatus: () => 'open' },
    async () => {},
    (callback) => scheduler.addPostFrame(callback),
  );
  const pipeline = new PipelineOwner({ accessibilityEnabled: false });
  const gestures = new GestureBinding({
    devicePixelRatioForView: () => 1,
    gestureArena: owner.gestures,
    scheduler,
    hitTestInView: (result, position) => {
      const entries = [];
      pipeline.rootNode.hitTest(position, entries);
      for (const entry of entries) {
        if (result.addCapturedLegacyEntry(entry)) continue;
        result.pushTransform(entry.transform);
        const source = entry.createSourceEntry?.() ?? new HitTestEntry(entry.target);
        result.add(source);
        entry.onSourceEntry?.(source);
        result.popTransform();
      }
    },
  });
  const lease = owner.bindGestureBinding(gestures);
  const controller = new ScrollController();
  const refresh = new Refresh(options);
  const markers = [];
  const list = SliverFixedExtentList.builder({
    itemBuilder: (_context, index) => (markers[index] ??= new SizedBox(undefined, 36)),
    itemExtent: 36,
    itemCount: rows,
  });
  const root = new MediaQuery(
    media,
    new Directionality(
      'ltr',
      new CustomScrollView({ primary: false, controller, physics, slivers: [refresh, list] }),
    ),
  ).createElement();
  const errors = [];
  const previousError = FlutterError.onError;
  FlutterError.onError = ({ exception }) => errors.push(exception);
  const flush = (elapsed = 16, postFrame = true) => {
    now += elapsed;
    scheduler.handleBeginFrame(now);
    owner.flushBuild();
    pipeline.flushLayout(dims);
    if (postFrame) scheduler.handleDrawFrame();
  };
  let pointer = 0;
  let y = 0;
  const event = (Event, delta = 0) =>
    gestures.handlePointerEvent(
      new Event({
        kind: PointerDeviceKind.touch,
        position: new Offset(100, y),
        delta: new Offset(0, delta),
        timeStamp: now,
        pointer,
      }),
    );
  const descendants = function* (element) {
    yield element;
    for (const child of element.children) yield* descendants(child);
  };
  const render = (widget) =>
    [...descendants(root)].find((e) => e.widget === widget).renderObjects[0];
  const unmount = () => {
    if (!root.mounted) return;
    pipeline.rootNode = null;
    root.unmount();
  };
  const platform = FoundationPlatform.hostEnvironment;
  const buildMode = FoundationBuildMode.mode;
  registerTickerScheduler(owner, scheduler);
  try {
    FoundationBuildMode.mode = 'debug';
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    root.mount(undefined, owner);
    owner.flushBuild();
    pipeline.rootNode = root.renderObjects[0];
    flush();
    assert.deepEqual(errors, []);
    await verify({
      controller,
      errors,
      flush,
      draw: () => scheduler.handleDrawFrame(),
      unmount,
      contentTop: () => render(markers[0]).localToGlobal(Offset.zero).y,
      geometry: () => render(refresh).geometry,
      down: () => {
        pointer++;
        y = 30;
        event(PointerDownEvent);
        y += 24;
        event(PointerMoveEvent, 24);
        flush();
      },
      move: (delta, postFrame = true) => {
        y += delta;
        event(PointerMoveEvent, delta);
        flush(16, postFrame);
      },
      up: () => {
        flush(160);
        event(PointerUpEvent);
        flush();
      },
      settle: () => {
        for (let i = 0; i < 10; i++) flush(160);
      },
    });
    assert.deepEqual(errors, []);
  } finally {
    unmount();
    controller.dispose();
    unregisterTickerScheduler(owner);
    lease.dispose();
    gestures.dispose();
    FlutterError.onError = previousError;
    FoundationPlatform.configure(platform);
    FoundationBuildMode.mode = buildMode;
  }
}

test('exports the sliver and validates trigger and retained extents', { timeout }, () => {
  assert.equal(AggregateRefresh, Refresh);
  assert.throws(() => new Refresh({ refreshTriggerPullDistance: 0 }), /positive trigger/);
  assert.throws(() => new Refresh({ refreshIndicatorExtent: 101 }), /trigger distance/);
  assert.throws(() => new Refresh({ refreshIndicatorExtent: NaN }), /trigger distance/);
  assert.doesNotThrow(() => new Refresh({ refreshIndicatorExtent: 0 }));
});

test(
  'real drag arms post-layout, holds a short list without jumping, retracts and re-arms',
  { timeout },
  async () => {
    const observed = [];
    let task;
    let calls = 0;
    await exercise(
      {
        onRefresh: () => {
          calls++;
          task = Promise.withResolvers();
          return task.promise;
        },
        builder: (context, mode, pulled, trigger, extent) => {
          assert.equal(Refresh.state(context), mode);
          assert.equal(trigger, 100);
          assert.equal(extent, 60);
          observed.push({ mode, pulled });
          return Refresh.buildRefreshIndicator(context, mode, pulled, trigger, extent);
        },
      },
      async (view) => {
        assert.equal(observed.length, 0);
        view.down();
        view.move(45);
        assert.equal(observed.at(-1).mode, Mode.drag);
        assert.equal(view.geometry().scrollExtent, 0);
        view.up();
        view.settle();
        assert.equal(view.controller.offset, 0);
        assert.equal(calls, 0);

        view.down();
        view.move(45);
        view.move(220, false);
        assert.equal(observed.at(-1).mode, Mode.armed);
        assert.equal(calls, 0);
        const before = view.contentTop();
        view.draw();
        assert.equal(calls, 1);
        view.flush();
        assert.equal(view.contentTop(), before);
        assert.equal(view.geometry().scrollExtent, 60);
        view.up();
        view.settle();
        assert.equal(view.controller.offset, 0);
        assert.equal(view.contentTop(), 60);
        assert.deepEqual(observed.at(-1), { mode: Mode.refresh, pulled: 60 });

        view.down();
        view.move(220);
        view.up();
        view.settle();
        assert.equal(calls, 1);
        task.resolve();
        await task.promise;
        view.flush();
        assert.equal(observed.at(-1).mode, Mode.done);
        assert.equal(view.contentTop(), 60);
        assert.equal(view.geometry().scrollExtent, 0);
        view.down();
        view.move(220);
        assert.equal(calls, 1);
        view.up();
        view.settle();
        assert.equal(view.contentTop(), 0);

        view.down();
        view.move(200);
        assert.equal(calls, 2);
        view.up();
        view.unmount();
        task.resolve();
        await task.promise;
        assert.equal(view.controller.hasClients, false);
      },
    );
  },
);

test(
  'clamping never arms; an invisible bouncing indicator still refreshes and handles rejection',
  { timeout },
  async () => {
    let calls = 0;
    await exercise(
      {
        builder: null,
        onRefresh: async () => {
          calls++;
        },
      },
      (view) => {
        view.down();
        view.move(200);
        view.up();
        view.settle();
        assert.equal(calls, 0);
        assert.equal(view.geometry().paintExtent, 0);
      },
      { physics: new ClampingScrollPhysics({ parent: always }) },
    );

    const failure = new Error('refresh failed');
    const task = Promise.withResolvers();
    await exercise(
      {
        builder: null,
        onRefresh: () => {
          calls++;
          return task.promise;
        },
      },
      async (view) => {
        view.down();
        view.move(200);
        assert.equal(calls, 1);
        assert.equal(view.geometry().paintExtent, 0);
        view.up();
        view.settle();
        assert.equal(view.geometry().layoutExtent, 60);
        task.reject(failure);
        await task.promise.catch(() => {});
        assert.deepEqual(view.errors.splice(0), [failure]);
        view.flush();
        view.settle();
        assert.equal(view.geometry().scrollExtent, 0);
        assert.equal(view.controller.offset, 0);
      },
    );
  },
);

test(
  'finishing a refresh while scrolled into a longer list preserves the visible content',
  { timeout },
  async () => {
    const task = Promise.withResolvers();
    await exercise(
      { onRefresh: () => task.promise },
      async (view) => {
        view.down();
        view.move(200);
        view.up();
        view.settle();
        view.down();
        view.move(-150);
        view.up();
        view.settle();
        assert.equal(view.geometry().scrollExtent, 60);
        assert.equal(view.geometry().paintExtent, 0);
        const offset = view.controller.offset;
        const top = view.contentTop();
        assert.ok(offset > 60);
        task.resolve();
        await task.promise;
        view.flush();
        assert.equal(view.controller.offset, offset - 60);
        assert.equal(view.contentTop(), top);
        assert.equal(view.geometry().scrollExtent, 0);
      },
      { rows: 100 },
    );
  },
);

test('no callback shows armed then done without reserving space', { timeout }, async () => {
  const modes = [];
  await exercise(
    {
      builder: (_context, mode) => {
        modes.push(mode);
        return new SizedBox(0, 0);
      },
    },
    (view) => {
      view.down();
      view.move(200);
      assert.equal(modes.at(-1), Mode.armed);
      view.flush();
      assert.equal(modes.at(-1), Mode.done);
      assert.equal(view.geometry().scrollExtent, 0);
      view.up();
      view.settle();
      assert.equal(view.controller.offset, 0);
    },
  );
});

test(
  'unmount between layout and post-frame suppresses an armed callback',
  { timeout },
  async () => {
    let calls = 0;
    let mode;
    await exercise(
      {
        onRefresh: async () => {
          calls++;
        },
        builder: (_context, next) => {
          mode = next;
          return new SizedBox(0, 0);
        },
      },
      (view) => {
        view.down();
        view.move(200, false);
        assert.equal(mode, Mode.armed);
        view.unmount();
        view.draw();
        assert.equal(calls, 0);
      },
    );
  },
);
