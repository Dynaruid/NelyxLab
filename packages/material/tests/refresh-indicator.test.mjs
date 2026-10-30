// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RefreshIndicator,
  RefreshIndicatorState,
  RefreshIndicatorStatus,
  RefreshIndicatorTriggerMode,
} from '@nelyx/material/refresh-indicator';
import { Theme } from '@nelyx/material/theme';
import { ThemeData } from '@nelyx/material/theme-data';
import { MaterialLocalizations } from '@nelyx/material/material-localizations';
import { RefreshProgressIndicator } from '@nelyx/material/progress-indicator';
import { CupertinoActivityIndicator } from '@nelyx/cupertino/activity-indicator';
import {
  ScrollStartNotification,
  ScrollUpdateNotification,
  OverscrollNotification,
  ScrollEndNotification,
  defaultScrollNotificationPredicate,
} from '@nelyx/core/framework/widgets/scroll-notification';
import { OverscrollIndicatorNotification } from '@nelyx/core/framework/widgets/overscroll-indicator';
import { FixedScrollMetrics } from '@nelyx/core/framework/widgets/scroll-metrics';
import { AxisDirection } from '@nelyx/core/framework/painting/basic-types';
import { DragStartDetails, DragUpdateDetails } from '@nelyx/core/framework/gestures/drag-details';
import { Offset } from '@nelyx/core/ui/offset';
import { Color } from '@nelyx/core/ui/color';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import '@nelyx/core/foundation/key';
import { TickerCanceled } from '@nelyx/core/framework/animation/ticker-future';
import { Builder, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Directionality, Localizations } from '@nelyx/core/framework/widgets/app-data';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import {
  AlwaysScrollableScrollPhysics,
  ClampingScrollPhysics,
} from '@nelyx/core/framework/widgets/scroll-physics';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { fixture } from './root-fixture.mjs';
import { engineFixture } from './engine-fixture.mjs';
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
const timeout = 1200000,
  original = JSON.parse(
    fs.readFileSync(new URL('./fixtures/refresh-indicator-source.json', import.meta.url)),
  ).result,
  labels = JSON.parse(
    fs.readFileSync(new URL('./fixtures/refresh-localizations-source.json', import.meta.url)),
  ).labels;
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const metrics = (axisDirection = AxisDirection.down, pixels = 0) =>
  new FixedScrollMetrics({
    minScrollExtent: 0,
    maxScrollExtent: 100,
    pixels,
    viewportDimension: 400,
    axisDirection,
    devicePixelRatio: 1,
  });
const snap = (s) => ({
  status: s.status,
  position: s.position.value,
  value: s.value.value,
  scale: s.scale.value,
  alpha: s.valueColor.value.alpha,
  atTop: s.indicatorAtTop,
});
function equalSnap(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (typeof value === 'number')
      assert(
        Math.abs(actual[key] - value) <= Number.EPSILON * 8,
        key + ': ' + actual[key] + ' != ' + value,
      );
    else assert.equal(actual[key], value, key);
  }
}
const mounted = (f, options = {}) => {
  let context;
  const key = options.key ?? new GlobalKey('refresh', RefreshIndicatorState),
    child = new Builder((c) => {
      context = c;
      return new SizedBox(1, 1);
    });
  f.set(RefreshIndicator.noSpinner({ key, child, onRefresh: async () => {}, ...options }));
  return {
    key,
    child,
    get context() {
      return context;
    },
    get state() {
      return key.currentState;
    },
    dispatch(n) {
      n.dispatch(context);
      f.frame();
    },
  };
};

test(
  'RefreshIndicator public defaults/constructors and all116 source accessibility labels are supplied',
  { timeout },
  () => {
    const child = new SizedBox(),
      callback = async () => {},
      plain = new RefreshIndicator({ child, onRefresh: callback }),
      adaptive = RefreshIndicator.adaptive({ child, onRefresh: callback }),
      noSpinner = RefreshIndicator.noSpinner({ child, onRefresh: callback, onStatusChange() {} });
    for (const w of [plain, adaptive]) {
      for (const [key, value] of Object.entries(original.defaults)) assert.equal(w[key], value);
      assert.equal(w.child, child);
      assert.equal(w.onRefresh, callback);
      assert.equal(w.notificationPredicate, defaultScrollNotificationPredicate);
      assert.equal(w.onStatusChange, null);
      assert.equal(w.triggerMode, RefreshIndicatorTriggerMode.onEdge);
      assert(Object.isFrozen(w));
    }
    for (const create of [
      (options) => new RefreshIndicator(options),
      RefreshIndicator.adaptive,
      RefreshIndicator.noSpinner,
    ]) {
      const reads = { child: 0, callback: 0 };
      class Options {
        get child() {
          reads.child++;
          return child;
        }
        get onRefresh() {
          reads.callback++;
          return callback;
        }
      }
      const inherited = create(new Options());
      assert.equal(inherited.child, child);
      assert.equal(inherited.onRefresh, callback);
      assert.deepEqual(reads, { child: 1, callback: 1 });
    }
    assert.equal(noSpinner.strokeWidth, 0);
    assert.equal(noSpinner.displacement, 0);
    assert.equal(noSpinner.color, null);
    assert.equal(typeof noSpinner.onStatusChange, 'function');
    assert.deepEqual(Object.values(RefreshIndicatorStatus), [
      'drag',
      'armed',
      'snap',
      'refresh',
      'done',
      'canceled',
    ]);
    assert.throws(() => new RefreshIndicator({ child, onRefresh: callback, elevation: -1 }));
    for (const [locale, label] of Object.entries(labels))
      assert.equal(new MaterialLocalizations(locale).refreshIndicatorSemanticLabel, label, locale);
    assert.equal(new MaterialLocalizations('ko-KR').refreshIndicatorSemanticLabel, '새로고침');
  },
);
test(
  'unchanged source drag/armed-cancel/commit/ballistic recipes match real notification routing and canonical controller ticks',
  { timeout },
  async () => {
    for (const row of original.cases) {
      const f = fixture(),
        trace = [],
        work = deferred();
      let calls = 0;
      try {
        const m = mounted(f, {
          onStatusChange: (value) => trace.push(value),
          onRefresh: () => {
            calls++;
            return work.promise;
          },
        });
        m.dispatch(
          new ScrollStartNotification({
            metrics: metrics(),
            context: m.context,
            dragDetails: new DragStartDetails(),
          }),
        );
        const glow = new OverscrollIndicatorNotification({ leading: true });
        m.dispatch(glow);
        assert.equal(glow.accepted, row.glowAccepted);
        m.dispatch(
          new OverscrollNotification({
            metrics: metrics(),
            context: m.context,
            overscroll: -row.distance,
          }),
        );
        equalSnap(snap(m.state), row.afterDrag);
        if (row.name === 'ballistic')
          m.dispatch(
            new ScrollUpdateNotification({
              metrics: metrics(),
              context: m.context,
              scrollDelta: 0,
            }),
          );
        else m.dispatch(new ScrollEndNotification({ metrics: metrics(), context: m.context }));
        await flush();
        f.frame();
        equalSnap(snap(m.state), row.afterEnd);
        assert.equal(calls, row.beforeSnapCalls);
        f.advance(row.afterEnd.status === 'snap' ? 151 : 201);
        await flush();
        f.frame();
        equalSnap(snap(m.state), row.afterAnimation);
        if (m.state.status === RefreshIndicatorStatus.refresh) {
          work.resolve();
          await flush();
          f.frame();
          f.advance(201);
          await flush();
          f.frame();
        }
        equalSnap(snap(m.state), row.final);
        assert.deepEqual(trace, row.trace);
        assert.equal(calls, row.calls);
        f.set(new SizedBox());
        assert.equal(f.root.scheduler.transientCallbackCount, 0);
      } finally {
        f.close();
      }
    }
  },
);
test(
  'source admission excludes programmatic/depth/horizontal/away scrolls and supports anywhere edge updates',
  { timeout },
  () => {
    const f = fixture();
    try {
      for (const row of original.admission) {
        const trace = [],
          m = mounted(f, {
            key: new GlobalKey('refresh-case', RefreshIndicatorState),
            triggerMode: RefreshIndicatorTriggerMode[row.mode],
            onStatusChange: (value) => trace.push(value),
          });
        let notification;
        const direction = row.kind === 'horizontal' ? AxisDirection.right : AxisDirection.down,
          pixels = row.kind === 'away' ? 10 : 0;
        if (row.kind === 'updateAtEdge')
          notification = new ScrollUpdateNotification({
            metrics: metrics(direction, pixels),
            context: m.context,
            dragDetails: new DragUpdateDetails({ globalPosition: Offset.zero }),
            scrollDelta: 0,
          });
        else {
          notification = new ScrollStartNotification({
            metrics: metrics(direction, pixels),
            context: m.context,
            dragDetails: row.kind === 'programmatic' ? null : new DragStartDetails(),
          });
          if (row.kind === 'depth') notification._setDepth(1);
        }
        m.dispatch(notification);
        equalSnap(snap(m.state), row.state);
        assert.deepEqual(trace, row.trace);
        f.set(new SizedBox());
      }
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
    }
  },
);
test(
  'public show deduplicates, completes at app completion and supplies source callback/top policy',
  { timeout },
  async () => {
    const f = fixture(),
      work = deferred(),
      trace = [];
    let calls = 0;
    try {
      const m = mounted(f, {
          onStatusChange: (value) => trace.push(value),
          onRefresh: () => {
            calls++;
            return work.promise;
          },
        }),
        first = m.state.show({ atTop: false }),
        second = m.state.show();
      assert.equal(first === second, original.show.sameFuture);
      equalSnap(snap(m.state), original.show.before);
      f.frame();
      f.advance(151);
      await flush();
      f.frame();
      equalSnap(snap(m.state), original.show.during);
      work.resolve();
      await first;
      await flush();
      f.frame();
      f.advance(201);
      await flush();
      f.frame();
      equalSnap(snap(m.state), original.show.final);
      assert.deepEqual(trace, original.show.trace);
      assert.equal(calls, 1);
      f.set(new SizedBox());
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
    }
  },
);
test(
  'snap disposal cancels unadmitted work; admitted app completion/error detaches the View and retires both tickers',
  { timeout },
  async () => {
    const f = fixture();
    let calls = 0;
    try {
      let m = mounted(f, {
          onRefresh: async () => {
            calls++;
          },
        }),
        future = m.state.show(),
        cancelled = assert.rejects(future, TickerCanceled);
      f.set(new SizedBox());
      await cancelled;
      await flush();
      assert.equal(calls, 0);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
      const work = deferred();
      m = mounted(f, {
        onRefresh: () => {
          calls++;
          return work.promise;
        },
      });
      future = m.state.show();
      const rejected = assert.rejects(future, /app failure/);
      f.frame();
      f.advance(151);
      await flush();
      assert.equal(calls, 1);
      f.set(new SizedBox());
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
      work.reject(new Error('app failure'));
      await rejected;
      await flush();
      f.frame();
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
    }
  },
);
test(
  'failed public refresh dismisses and callback replacement during snap uses the current widget',
  { timeout },
  async () => {
    const f = fixture(),
      trace = [],
      error = new Error('refresh rejected');
    let oldCalls = 0,
      newCalls = 0;
    try {
      const m = mounted(f, {
          onStatusChange: (value) => trace.push(value),
          onRefresh: async () => {
            oldCalls++;
          },
        }),
        future = m.state.show(),
        rejected = assert.rejects(future, (e) => e === error);
      f.set(
        RefreshIndicator.noSpinner({
          key: m.key,
          child: m.child,
          onStatusChange: (value) => trace.push(value),
          onRefresh: async () => {
            newCalls++;
            throw error;
          },
        }),
      );
      f.frame();
      f.advance(151);
      await flush();
      await rejected;
      await flush();
      f.frame();
      assert.equal(oldCalls, 0);
      assert.equal(newCalls, 1);
      assert.equal(m.state.status, RefreshIndicatorStatus.done);
      f.advance(201);
      await flush();
      f.frame();
      assert.equal(m.state.status, null);
      assert.deepEqual(trace, ['snap', 'done']);
      f.set(new SizedBox());
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
    }
  },
);
test(
  'actual touch dragging on ListView arms one Material refresh and releases real scroll/ticker owners',
  { timeout },
  async () => {
    const f = fixture(),
      controller = new ScrollController(),
      work = deferred(),
      trace = [];
    let calls = 0;
    const key = new GlobalKey('pointer-refresh', RefreshIndicatorState);
    try {
      f.set(
        new Directionality(
          'ltr',
          RefreshIndicator.noSpinner({
            key,
            onRefresh: () => {
              calls++;
              return work.promise;
            },
            onStatusChange: (value) => trace.push(value),
            child: new ListView({
              controller,
              physics: new AlwaysScrollableScrollPhysics({ parent: new ClampingScrollPhysics() }),
              children: [new SizedBox(240, 500)],
            }),
          }),
        ),
      );
      const pointer = (kind, y) => {
        f.root.pointer({
          kind,
          x: 100,
          y,
          pointer: 1,
          device: 'touch',
          buttons: kind === 'up' ? 0 : 1,
          timestamp: 0,
          viewportGeneration: 1,
        });
        f.frame();
      };
      pointer('down', 20);
      pointer('move', 70);
      pointer('move', 140);
      pointer('up', 140);
      assert(trace.includes('armed'), JSON.stringify(trace));
      assert.equal(calls, 0);
      f.advance(151);
      await flush();
      f.frame();
      assert.equal(calls, 1);
      work.resolve();
      await flush();
      f.frame();
      f.advance(201);
      await flush();
      f.frame();
      assert.equal(key.currentState.status, null);
      assert.deepEqual(trace, ['drag', 'armed', 'snap', 'done']);
      f.set(new SizedBox());
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
      controller.dispose();
    }
  },
);
test(
  'Material and adaptive spinner branches use actual owned painters and localized progress semantics',
  { timeout },
  async () => {
    const f = await engineFixture();
    try {
      for (const [platform, adaptive] of [
        ['windows', false],
        ['iOS', true],
      ]) {
        const key = new GlobalKey('paint-refresh', RefreshIndicatorState),
          work = deferred();
        const widget = (
          adaptive ? RefreshIndicator.adaptive : (options) => new RefreshIndicator(options)
        )({
          key,
          color: new Color(0xff123456),
          onRefresh: () => work.promise,
          child: new SizedBox(240, 160),
        });
        f.set(
          new Theme(
            new ThemeData({ platform }),
            new Localizations('ko', {}, 'en', new Directionality('ltr', widget)),
          ),
        );
        const future = key.currentState.show();
        f.frame();
        f.advance(151);
        await flush();
        const commands = f.frame();
        const types = [];
        const visit = (e) => {
          types.push(e.widget);
          e.visitChildren(visit);
        };
        visit(f.root.root);
        assert.equal(
          types.some((w) => w instanceof CupertinoActivityIndicator),
          adaptive,
        );
        assert.equal(
          types.some((w) => w instanceof RefreshProgressIndicator),
          !adaptive,
        );
        if (!adaptive) {
          assert(f.root.nodes.some((n) => n.name === '새로고침'));
          assert(commands.some((c) => c.op === 'drawPath'));
        } else assert(commands.some((c) => c.op === 'drawRRect'));
        work.resolve();
        await future;
        await flush();
        f.frame();
        f.advance(201);
        await flush();
        f.set(new SizedBox());
        assert.equal(f.root.scheduler.transientCallbackCount, 0);
      }
    } finally {
      await f.close();
    }
  },
);
test(
  'source alpha-dependent arming and clamped overscroll geometry agree across28 independently executed recipes',
  { timeout },
  async () => {
    const f = await engineFixture();
    try {
      for (const row of original.colorCases) {
        let context;
        const key = new GlobalKey('alpha-refresh', RefreshIndicatorState),
          child = new Builder((c) => {
            context = c;
            return new SizedBox(240, 160);
          });
        f.set(
          new Directionality(
            'ltr',
            new RefreshIndicator({
              key,
              child,
              color: new Color(((row.alpha << 24) | 0x123456) >>> 0),
              onRefresh: async () => {},
            }),
          ),
        );
        new ScrollStartNotification({
          metrics: metrics(),
          context,
          dragDetails: new DragStartDetails(),
        }).dispatch(context);
        new ScrollUpdateNotification({
          metrics: metrics(),
          context,
          dragDetails: new DragUpdateDetails({ globalPosition: Offset.zero }),
          scrollDelta: -row.distance,
        }).dispatch(context);
        f.frame();
        equalSnap(snap(key.currentState), row.state);
        f.set(new SizedBox());
        assert.equal(f.root.scheduler.transientCallbackCount, 0);
      }
    } finally {
      await f.close();
    }
  },
);
