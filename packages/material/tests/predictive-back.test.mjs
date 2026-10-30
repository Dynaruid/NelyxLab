import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { Motion } from './zoom-engine-fixture.mjs';
import { comparePredictiveSource } from './predictive-source-compare.mjs';
import { BinaryMessenger } from '@nelyx/core/services/binary-messenger';
import { ServicesBinding } from '@nelyx/core/services/binding';
import { JSONMethodCodec, StandardMethodCodec } from '@nelyx/core/services/message-codecs';
import { MethodCall } from '@nelyx/core/services/message-codec';
import { PredictiveBackEvent, SwipeEdge } from '@nelyx/core/services/predictive-back-event';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { Navigator, NavigatorController, PopScope } from '@nelyx/core/framework/widgets/navigation';
import { PageRouteBuilder } from '@nelyx/core/framework/widgets/pages';
import { PageTransitionsBuilder } from '@nelyx/core/framework/widgets/page-transitions-builder';
import { MediaQuery, Directionality } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox, ColoredBox, Transform } from '@nelyx/core/framework/widgets/basic';
import { AnimatedOpacity } from '@nelyx/core/framework/widgets/implicit-animations';
import { ClipRRect } from '@nelyx/core/framework/widgets/clip';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import {
  PredictiveBackPageTransitionsBuilder,
  PredictiveBackFullscreenPageTransitionsBuilder,
} from '../dist/predictive-back-page-transitions-builder.js';
import {
  PageTransitionsTheme,
  ZoomPageTransitionsBuilder,
  FadeForwardsPageTransitionsBuilder,
} from '../dist/page-transitions-theme.js';
import { CupertinoPageTransitionsBuilder } from '@nelyx/cupertino/route';
import { Theme, ThemeData } from '../dist/theme.js';
import { engineFixture } from './engine-fixture.mjs';
import { Probe, flush } from './zoom-engine-fixture.mjs';
const timeout = 1200000,
  json = new JSONMethodCodec(),
  standard = new StandardMethodCodec(),
  map = (progress = 0, x = 1, y = 80, edge = 0) =>
    new Map([
      ['touchOffset', x === null ? null : [x, y]],
      ['progress', progress],
      ['swipeEdge', edge],
    ]);
/** Finite platform replies, with real product channel codecs/dispatch and ServicesBinding. */
class Platform extends BinaryMessenger {
  handlers = new Map();
  outgoing = [];
  send(channel, message) {
    const codec = ['flutter/keyboard', 'flutter/backgesture'].includes(channel) ? standard : json,
      call = codec.decodeMethodCall(message);
    this.outgoing.push({ channel, method: call.method, arguments: call.arguments });
    const result =
      channel === 'nelyx/environment'
        ? new Map([
            ['revision', 0],
            ['locales', null],
            ['localeSource', 'unavailable'],
            ['brightness', 'light'],
            ['textScale', 1],
            ['lifecycle', 'resumed'],
            [
              'capabilities',
              new Map([
                ['clipboardRead', 'unavailable'],
                ['clipboardWrite', 'unavailable'],
                ['navigation', 'available'],
              ]),
            ],
          ])
        : channel === 'flutter/keyboard'
          ? new Map()
          : null;
    return Promise.resolve(codec.encodeSuccessEnvelope(result));
  }
  setMessageHandler(channel, handler) {
    if (handler) this.handlers.set(channel, handler);
    else this.handlers.delete(channel);
  }
  async handlePlatformMessage(channel, message, callback) {
    callback?.((await this.handlers.get(channel)?.(message)) ?? null);
  }
  async gesture(method, argumentsValue = null) {
    let reply;
    await this.handlePlatformMessage(
      'flutter/backgesture',
      standard.encodeMethodCall(new MethodCall(method, argumentsValue)),
      (value) => {
        reply = value;
      },
    );
    return standard.decodeEnvelope(reply);
  }
}
const widgets = (f, Ctor) => {
  const out = [];
  const visit = (e) => {
    if (e.widget instanceof Ctor) out.push(e.widget);
    e.visitChildren(visit);
  };
  if (f.root.root) visit(f.root.root);
  return out;
};
async function app(builder, extra = {}) {
  FoundationPlatform.configure({ kind: 'web', operatingSystem: 'android' });
  const platform = new Platform(),
    services = new ServicesBinding(platform);
  await services.ready;
  const f = await engineFixture({ platformServices: services }),
    controller = new NavigatorController(),
    counts = { created: 0, disposed: 0 };
  let themePlatform = 'android';
  const theme = extra.theme ?? null,
    media = {
      width: 240,
      height: 640,
      scale: 1,
      textScale: 1,
      safeArea: { top: 0, left: 0, right: 0, bottom: 0 },
      keyboardInset: 0,
      ...extra.media,
    };
  const wrap = () =>
    new Directionality(
      'ltr',
      new MediaQuery(
        media,
        new Theme(
          new ThemeData({ platform: themePlatform }),
          new Navigator(controller, new PageRouteBuilder({ pageBuilder: () => new SizedBox() })),
        ),
      ),
    );
  const make = (color) => {
    let route;
    route = new PageRouteBuilder({
      pageBuilder: () => new Probe(counts, color),
      transitionDuration: builder.transitionDuration,
      reverseTransitionDuration: builder.reverseTransitionDuration,
      transitionsBuilder: (context, a, s, child) =>
        (theme ?? builder).buildTransitions(route, context, a, s, child),
    });
    return route;
  };
  f.set(wrap());
  const first = make(0xff00ff00);
  controller.push(first);
  f.frame();
  f.advance(1);
  f.advance(builder.transitionDuration + 1);
  await flush();
  f.frame();
  const route = make(0xffff0000);
  controller.push(route);
  f.frame();
  f.advance(1);
  f.advance(builder.transitionDuration + 1);
  await flush();
  f.frame();
  assert(route.popGestureEnabled);
  return {
    ...f,
    platform,
    services,
    controller,
    route,
    first,
    counts,
    async gesture(method, args = null) {
      const r = await platform.gesture(method, args);
      f.frame();
      return r;
    },
    changePlatform(value) {
      themePlatform = value;
      f.set(wrap());
    },
    async close() {
      f.set(new SizedBox());
      await flush();
      assert.equal(controller.userGestureInProgress, false);
      controller.dispose();
      await f.close();
      services.dispose();
      assert.equal(platform.handlers.size, 0);
      assert.equal(counts.created, counts.disposed);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    },
  };
}

test(
  'source predictive event map/value/button semantics preserve progress, swipe edge and nullable touch',
  { timeout },
  () => {
    const a = PredictiveBackEvent.fromMap(map(0.2, 12, 34, 1)),
      b = PredictiveBackEvent.fromMap(map(0.2, 12, 34, 1));
    assert(a.equals(b));
    assert.equal(a.hashCode, b.hashCode);
    assert.equal(a.swipeEdge, SwipeEdge.right);
    assert(a.touchOffset.equals(new Offset(12, 34)));
    assert(!a.isButtonEvent);
    assert(PredictiveBackEvent.fromMap(map(0, 0, 0)).isButtonEvent);
    assert(PredictiveBackEvent.fromMap(map(1, null)).isButtonEvent);
    assert(!PredictiveBackEvent.fromMap(map(0.1, 0, 0)).isButtonEvent);
    for (const bad of [map(-0.1), map(1.1), map(NaN), map(0.2, 1, 2, 2), new Map()])
      assert.throws(() => PredictiveBackEvent.fromMap(bad));
  },
);
test(
  'actual service backgesture channel enrolls only accepting observers, removes borrowed listeners and falls back to pop',
  { timeout },
  async () => {
    const p = new Platform(),
      s = new ServicesBinding(p);
    await s.ready;
    const calls = [];
    const no = s.addObserver({
        handleStartBackGesture: () => {
          calls.push('no');
          return false;
        },
        handleCommitBackGesture: () => calls.push('bad'),
        didPopRoute: () => {
          calls.push('pop');
          return true;
        },
      }),
      yes = s.addObserver({
        handleStartBackGesture: (e) => {
          calls.push(e.progress);
          return true;
        },
        handleUpdateBackGestureProgress: (e) => calls.push(e.progress),
        handleCancelBackGesture: () => calls.push('cancel'),
        handleCommitBackGesture: () => calls.push('commit'),
      });
    try {
      assert.equal(await p.gesture('startBackGesture', map(0.1)), true);
      await p.gesture('updateBackGestureProgress', map(0.4));
      await p.gesture('cancelBackGesture');
      assert.deepEqual(calls, ['no', 0.1, 0.4, 'cancel']);
      yes.dispose();
      await p.gesture('updateBackGestureProgress', map(0.5));
      await p.gesture('commitBackGesture');
      assert.equal(calls.at(-1), 'pop');
      assert.equal(await p.gesture('startBackGesture', map()), false);
      await p.gesture('commitBackGesture');
      assert.equal(calls.at(-1), 'pop');
      await assert.rejects(() => p.gesture('startBackGesture', map(2)));
    } finally {
      yes.dispose();
      no.dispose();
      s.dispose();
    }
    assert.equal(p.handlers.size, 0);
  },
);
test(
  'shared predictive route seeks actual primary/secondary, cancels with State preserved then commits pop and retires',
  { timeout },
  async () => {
    const f = await app(
      new PredictiveBackPageTransitionsBuilder({ fallbackColor: new Color(0xff123456) }),
    );
    try {
      assert.equal(await f.gesture('startBackGesture', map(0, 0, 0)), false);
      assert.equal(f.controller.userGestureInProgress, false);
      assert.equal(await f.gesture('startBackGesture', map(0.1, 1, 80)), true);
      assert.equal(f.route.animation.value, 0.9);
      assert.equal(f.first.secondaryAnimation.value, 0.9);
      assert(f.controller.userGestureInProgress);
      await f.gesture('updateBackGestureProgress', map(0.4, 90, 300));
      assert.equal(f.route.animation.value, 0.6);
      assert(widgets(f, Transform).some((w) => w.transform[0] === 0.96));
      await f.gesture('cancelBackGesture');
      assert(f.controller.userGestureInProgress);
      f.advance(1);
      f.advance(451);
      await flush();
      f.frame();
      assert.equal(f.route.animation.value, 1);
      assert.equal(f.controller.userGestureInProgress, false);
      assert.equal(f.counts.disposed, 0);
      assert.equal(await f.gesture('startBackGesture', map(0.15)), true);
      await f.gesture('updateBackGestureProgress', map(0.5));
      await f.gesture('commitBackGesture');
      assert.equal(f.controller.routes.length, 2);
      assert.equal(f.route.animation.value, 1);
      assert(f.controller.userGestureInProgress);
      assert.equal(await f.route.popped, null);
      f.advance(1);
      f.advance(451);
      await flush();
      f.frame();
      assert.equal(await f.route.completed, null);
      assert.equal(f.route.animation, null);
      assert.equal(f.controller.userGestureInProgress, false);
      assert.equal(f.counts.disposed, 1);
    } finally {
      await f.close();
    }
  },
);
test(
  'shared source vertical drag and swipe edge feed canonical transforms and borrowed display corner radii',
  { timeout },
  async () => {
    for (const edge of [0, 1]) {
      const radius = BorderRadius.circular(19),
        f = await app(new PredictiveBackPageTransitionsBuilder(), {
          media: { width: 400, displayCornerRadii: radius },
        });
      try {
        await f.gesture('startBackGesture', map(0.05, 1, 80, edge));
        await f.gesture('updateBackGestureProgress', map(0.5, 50, 500, edge));
        const transforms = widgets(f, Transform),
          translated = transforms.find((w) => w.transform[12] !== 0 || w.transform[13] !== 0);
        assert(translated);
        assert.equal(Math.sign(translated.transform[12]), edge === 0 ? 1 : -1);
        assert(translated.transform[13] > 0 && translated.transform[13] <= 24);
        assert(widgets(f, ClipRRect).some((w) => w.borderRadius === radius));
        await f.gesture('cancelBackGesture');
        f.advance(1);
        f.advance(451);
        await flush();
        f.frame();
      } finally {
        await f.close();
      }
    }
  },
);
test(
  'fullscreen predictive threshold owns its100ms fade and cancellation restores exact route State',
  { timeout },
  async () => {
    const f = await app(new PredictiveBackFullscreenPageTransitionsBuilder());
    try {
      await f.gesture('startBackGesture', map(0.1));
      await f.gesture('updateBackGestureProgress', map(0.4));
      const fade = () =>
        widgets(f, AnimatedOpacity)
          .filter((w) => w.duration === 100)
          .at(-1);
      assert(fade());
      assert.equal(fade().opacity, 0);
      assert(widgets(f, Transform).some((w) => w.transform[0] === 1));
      f.advance(1);
      f.advance(101);
      await f.gesture('updateBackGestureProgress', map(0.2));
      assert.equal(fade().opacity, 1);
      await f.gesture('cancelBackGesture');
      f.advance(1);
      f.advance(301);
      await flush();
      f.frame();
      assert.equal(f.controller.userGestureInProgress, false);
      assert.equal(f.route.animation.value, 1);
      assert.equal(f.counts.disposed, 0);
      await f.gesture('startBackGesture', map(0.2));
      await f.gesture('commitBackGesture');
      f.advance(1);
      f.advance(301);
      await flush();
      f.frame();
      assert.equal(f.route.animation, null);
      assert.equal(f.controller.userGestureInProgress, false);
    } finally {
      await f.close();
    }
  },
);
test(
  'source current-route guard ignores progress after another push; route retirement and unmount release gesture ownership',
  { timeout },
  async () => {
    for (const Builder of [
      PredictiveBackPageTransitionsBuilder,
      PredictiveBackFullscreenPageTransitionsBuilder,
    ]) {
      const f = await app(new Builder());
      try {
        await f.gesture('startBackGesture', map(0.2));
        const progress = f.route.animation.value;
        const next = new PageRouteBuilder({ pageBuilder: () => new SizedBox() });
        f.controller.push(next);
        f.frame();
        await f.gesture('updateBackGestureProgress', map(0.8));
        assert.equal(f.route.animation.value, progress);
        await f.gesture('commitBackGesture');
        assert.equal(f.controller.routes.at(-1).route, next);
        assert.equal(f.controller.userGestureInProgress, false);
      } finally {
        await f.close();
      }
    }
  },
);
test(
  'predictive source defaults and fallback variants retain canonical builder/public identity',
  { timeout },
  async () => {
    assert.equal(new PredictiveBackPageTransitionsBuilder().transitionDuration, 450);
    assert.equal(new PredictiveBackPageTransitionsBuilder().reverseTransitionDuration, 450);
    assert.equal(new PredictiveBackFullscreenPageTransitionsBuilder().transitionDuration, 300);
    assert.equal(new PredictiveBackFullscreenPageTransitionsBuilder().delegatedTransition, null);
    const pub = await import('../dist/widgets.js');
    assert.equal(pub.PredictiveBackPageTransitionsBuilder, PredictiveBackPageTransitionsBuilder);
    assert.equal(pub.PageTransitionsTheme, PageTransitionsTheme);
    const theme = new PageTransitionsTheme();
    assert(theme.builders.get('android') instanceof PredictiveBackPageTransitionsBuilder);
    assert(theme.builders.get('iOS') instanceof CupertinoPageTransitionsBuilder);
    assert(theme.builders.get('macOS') instanceof CupertinoPageTransitionsBuilder);
    assert(theme.builders.get('windows') instanceof ZoomPageTransitionsBuilder);
    assert(theme.builders.get('linux') instanceof ZoomPageTransitionsBuilder);
    assert(!theme.builders.has('fuchsia'));
    assert.equal(theme.builders.size, 5);
    assert.equal(theme.builders.set, undefined);
    assert(theme.equals(new PageTransitionsTheme()));
    assert.equal(theme.hashCode, new PageTransitionsTheme().hashCode);
    const copy = new Map([...theme.builders].reverse());
    assert(theme.equals(new PageTransitionsTheme({ builders: copy })));
    assert.equal(theme.hashCode, new PageTransitionsTheme({ builders: copy }).hashCode);
    assert.equal(
      typeof new PageTransitionsTheme({ builders: new Map() }).delegatedTransition('iOS'),
      'function',
    );
    assert.equal(theme.delegatedTransition('android'), null);
  },
);
test(
  'PageTransitionsTheme retains platform selection during actual route gesture and switches after settlement',
  { timeout },
  async () => {
    class Spy extends PageTransitionsBuilder {
      constructor(color, calls) {
        super();
        this.color = color;
        this.calls = calls;
      }
      buildTransitions(route, context, a, s, child) {
        this.calls.push(this.color);
        return new ColoredBox({ color: this.color, child });
      }
    }
    const calls = [],
      android = new Spy(0xff123456, calls),
      windows = new Spy(0xff654321, calls),
      theme = new PageTransitionsTheme({
        builders: new Map([
          ['android', android],
          ['windows', windows],
        ]),
      }),
      f = await app(new FadeForwardsPageTransitionsBuilder(), { theme });
    try {
      f.route.handleStartBackGesture({ progress: 1 });
      f.frame();
      f.changePlatform('windows');
      assert.equal(calls.at(-1), android.color);
      f.route.handleCancelBackGesture();
      f.frame();
      assert.equal(calls.at(-1), windows.color);
      assert.equal(f.controller.userGestureInProgress, false);
    } finally {
      await f.close();
    }
  },
);
test(
  'actual PopScope veto denies predictive enrollment and consumes commit fallback without popping the blocked route',
  { timeout },
  async () => {
    const builder = new PredictiveBackPageTransitionsBuilder(),
      f = await app(builder);
    try {
      let route;
      route = new PageRouteBuilder({
        pageBuilder: () => new PopScope({ canPop: false, child: new SizedBox() }),
        transitionDuration: 450,
        transitionsBuilder: (context, a, s, child) =>
          builder.buildTransitions(route, context, a, s, child),
      });
      f.controller.push(route);
      f.frame();
      f.advance(1);
      f.advance(451);
      await flush();
      f.frame();
      assert.equal(route.popGestureEnabled, false);
      assert.equal(await f.gesture('startBackGesture', map(0.2)), false);
      await f.gesture('commitBackGesture');
      assert.equal(f.controller.routes.at(-1).route, route);
      assert.equal(f.controller.userGestureInProgress, false);
      assert(!f.platform.outgoing.some((c) => c.method === 'SystemNavigator.pop'));
    } finally {
      await f.close();
    }
  },
);
test(
  'unmount during active predictive gesture drains both shared/fullscreen route, service, ticker and child owners',
  { timeout },
  async () => {
    for (const Builder of [
      PredictiveBackPageTransitionsBuilder,
      PredictiveBackFullscreenPageTransitionsBuilder,
    ]) {
      const f = await app(new Builder());
      await f.gesture('startBackGesture', map(0.2));
      await f.gesture('updateBackGestureProgress', map(0.5));
      assert(f.controller.userGestureInProgress);
      await f.close();
      assert.equal(f.route.animation, null);
      assert.equal(f.first.animation, null);
    }
  },
);
const original = JSON.parse(
  fs.readFileSync(new URL('./fixtures/predictive-back-source.json', import.meta.url)),
);
test(
  'unchanged original event and PageTheme default/missing-platform recipes match canonical public objects',
  { timeout },
  async () => {
    for (const row of original.eventCases) {
      const value = PredictiveBackEvent.fromMap(
          new Map([
            ['progress', row.progress],
            ['touchOffset', row.touch],
            ['swipeEdge', row.edge],
          ]),
        ),
        same = PredictiveBackEvent.fromMap(
          new Map([
            ['progress', row.progress],
            ['touchOffset', row.touch],
            ['swipeEdge', row.edge],
          ]),
        );
      assert.equal(value.isButtonEvent, row.button);
      assert.equal(value.equals(same), row.equal);
      assert.equal(value.hashCode === same.hashCode, row.equalHash);
    }
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'android' });
    const f = await engineFixture(),
      a = new Motion(1, AnimationStatus.completed),
      s = new Motion(),
      route = new PageRouteBuilder({ pageBuilder: () => new SizedBox() });
    try {
      for (const row of original.themeCases) {
        const theme = new PageTransitionsTheme(row.empty ? { builders: new Map() } : {}),
          child = theme.buildTransitions(route, {}, a, s, new SizedBox());
        f.set(
          new Directionality(
            'ltr',
            new MediaQuery(
              {
                width: 240,
                height: 640,
                scale: 1,
                textScale: 1,
                safeArea: { top: 0, left: 0, right: 0, bottom: 0 },
                keyboardInset: 0,
              },
              new Theme(new ThemeData({ platform: row.platform }), child),
            ),
          ),
        );
        assert.deepEqual(
          Object.fromEntries([...theme.builders].map(([k, v]) => [k, v.constructor.name])),
          row.defaults,
        );
        assert.equal(theme.delegatedTransition(row.platform) !== null, row.delegated);
        const names = [];
        const visit = (e) => {
          names.push(e.widget.constructor.name);
          e.visitChildren(visit);
        };
        visit(f.root.root);
        const expected = {
          FadeForwardsPageTransitionsBuilder: 'FadeForwardsPageTransition',
          ZoomPageTransitionsBuilder: 'ZoomPageTransition',
          CupertinoPageTransitionsBuilder: 'CupertinoPageTransition',
        }[row.builder];
        assert(names.includes(expected), JSON.stringify({ row, names }));
        f.set(new SizedBox());
      }
    } finally {
      route.dispose();
      await f.close();
    }
    assert.equal(a.values.length, 0);
    assert.equal(a.statuses.length, 0);
    assert.equal(s.values.length, 0);
    assert.equal(s.statuses.length, 0);
  },
);
test(
  'unchanged source binding enrollment/removal/update/cancel/normal-commit cases match actual service channel',
  { timeout },
  async () => {
    for (const row of original.bindingCases) {
      const p = new Platform(),
        s = new ServicesBinding(p);
      await s.ready;
      const calls = [];
      let normalPops = 0;
      const pop = s.addObserver({
        didPopRoute: () => {
          normalPops++;
          return true;
        },
      });
      const observer = (label, accepts) => ({
          handleStartBackGesture: (e) => {
            calls.push([label, 'start', e.progress]);
            return accepts;
          },
          handleUpdateBackGestureProgress: (e) => calls.push([label, 'update', e.progress]),
          handleCommitBackGesture: () => calls.push([label, 'commit']),
          handleCancelBackGesture: () => calls.push([label, 'cancel']),
        }),
        a = s.addObserver(observer('a', false)),
        b = s.addObserver(observer('b', row.accepts));
      try {
        assert.equal(await p.gesture('startBackGesture', map(0.1)), row.accepted);
        await p.gesture('updateBackGestureProgress', map(0.4));
        if (row.remove) b.dispose();
        await p.gesture(row.commit ? 'commitBackGesture' : 'cancelBackGesture');
        assert.deepEqual(calls, row.calls);
        assert.equal(normalPops, row.normalPops);
      } finally {
        a.dispose();
        b.dispose();
        pop.dispose();
        s.dispose();
      }
      assert.equal(p.handlers.size, 0);
    }
  },
);
test(
  'unchanged selected original route gesture methods match current Core over explicit controller/Navigator receivers',
  { timeout },
  () => {
    class Controller extends Motion {
      constructor() {
        super(1);
        this.animating = false;
        this.actions = [];
      }
      get value() {
        return this.current;
      }
      set value(v) {
        this.set(
          v,
          v === 1
            ? AnimationStatus.completed
            : v === 0
              ? AnimationStatus.dismissed
              : AnimationStatus.forward,
        );
        this.animating = false;
      }
      get isAnimating() {
        return this.animating;
      }
      get isCompleted() {
        return this.value === 1;
      }
      get upperBound() {
        return 1;
      }
      forward() {
        this.actions.push('forward');
        this.animating = this.value !== 1;
      }
      reverse({ from = null } = {}) {
        if (from !== null) this.value = from;
        this.actions.push({ reverseFrom: from });
        this.animating = this.value !== 0;
      }
      finish(v) {
        this.animating = false;
        this.current = v;
        const snapshot = [...this.statuses];
        for (const l of snapshot) l(this.state);
      }
    }
    for (const row of original.routeCases) {
      const controller = new Controller(),
        route = new PageRouteBuilder({ pageBuilder: () => new SizedBox() }),
        retire = new Set(),
        nav = {
          starts: 0,
          stops: 0,
          pops: 0,
          isAttached: true,
          gesture: 0,
          get userGestureInProgress() {
            return this.gesture > 0;
          },
          didStartUserGesture() {
            this.starts++;
            this.gesture++;
          },
          didStopUserGesture() {
            this.stops++;
            this.gesture--;
          },
          pop() {
            this.pops++;
            if (controller.value !== 0) controller.reverse();
          },
        },
        flags = { current: true };
      route.transitionPolicy.attach({
        animation: controller,
        secondaryAnimation: new Motion(),
        context: {},
        navigator: nav,
        isCurrent: () => flags.current,
        isActive: () => true,
        isFirst: () => false,
        popGestureInProgress: () => nav.userGestureInProgress,
        canPopGesture: () => true,
        addRetirementListener: (l) => {
          retire.add(l);
          return () => retire.delete(l);
        },
      });
      try {
        route.handleStartBackGesture({ progress: row.progress });
        flags.current = !row.switched;
        route.handleUpdateBackGestureProgress({ progress: Math.min(1, row.progress + 0.1) });
        assert.equal(controller.value, row.sought);
        if (row.commit) route.handleCommitBackGesture();
        else route.handleCancelBackGesture();
        assert.deepEqual(
          {
            value: controller.value,
            animating: controller.isAnimating,
            starts: nav.starts,
            stops: nav.stops,
            pops: nav.pops,
            actions: controller.actions,
          },
          row.before,
        );
        if (controller.isAnimating) controller.finish(row.commit ? 0 : 1);
        assert.deepEqual(
          {
            value: controller.value,
            starts: nav.starts,
            stops: nav.stops,
            pops: nav.pops,
            listeners: controller.statuses.length,
          },
          row.after,
        );
        assert.equal(retire.size, 0);
      } finally {
        route.transitionPolicy.detach();
      }
    }
  },
);
test(
  'unchanged original predictive State/curve/implicit-opacity recipes match1152 actual Core CPU scenes with full pixels',
  { timeout },
  async () => {
    const result = await comparePredictiveSource(original);
    assert.deepEqual(result, { scenes: 1152, fullPixels: 44236800, differences: 0 });
  },
);
test(
  'unchanged PageTheme builder value equality and gesture-platform trace include custom builder values',
  { timeout },
  async () => {
    class ValueBuilder extends PageTransitionsBuilder {
      constructor(name) {
        super();
        this.name = name;
      }
      get hashCode() {
        return this.name === 'same' ? 31 : 67;
      }
      equals(other) {
        return other instanceof ValueBuilder && other.name === this.name;
      }
      buildTransitions(route, context, a, s, child) {
        return new ColoredBox({ color: this.name === 'a' ? 0xff123456 : 0xff654321, child });
      }
    }
    for (const row of original.themeValues) {
      const left = new PageTransitionsTheme({
          builders: new Map([['android', new ValueBuilder(row.left)]]),
        }),
        right = new PageTransitionsTheme({
          builders: new Map([['android', new ValueBuilder(row.right)]]),
        });
      assert.equal(left.equals(right), row.equals);
      assert.equal(left.hashCode === right.hashCode, row.equalHash);
    }
    const theme = new PageTransitionsTheme({
        builders: new Map([
          ['android', new ValueBuilder('a')],
          ['windows', new ValueBuilder('w')],
        ]),
      }),
      route = new (class extends PageRouteBuilder {
        gesture = false;
        get popGestureInProgress() {
          return this.gesture;
        }
      })({ pageBuilder: () => new SizedBox() }),
      f = await engineFixture(),
      a = new Motion(1, AnimationStatus.completed),
      s = new Motion();
    try {
      for (const row of original.themeTrace) {
        route.gesture = row.gesture;
        f.set(
          new Directionality(
            'ltr',
            new MediaQuery(
              {
                width: 240,
                height: 640,
                scale: 1,
                textScale: 1,
                safeArea: { top: 0, left: 0, right: 0, bottom: 0 },
                keyboardInset: 0,
              },
              new Theme(
                new ThemeData({ platform: row.platform }),
                theme.buildTransitions(route, {}, a, s, new SizedBox()),
              ),
            ),
          ),
        );
        const colors = widgets(f, ColoredBox).map((w) => w.color);
        if (row.builder === 'ZoomPageTransitionsBuilder') {
          const names = [];
          const visit = (e) => {
            names.push(e.widget.constructor.name);
            e.visitChildren(visit);
          };
          visit(f.root.root);
          assert(names.includes('ZoomPageTransition'));
        } else assert(colors.includes(row.builder === 'a' ? 0xff123456 : 0xff654321));
      }
    } finally {
      route.dispose();
      await f.close();
    }
    for (const motion of [a, s]) {
      assert.equal(motion.values.length, 0);
      assert.equal(motion.statuses.length, 0);
    }
  },
);
test(
  'eight unchanged source detector admission/phase/event decisions match the actual canonical detector State',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'android' });
    for (const row of original.detectors) {
      const f = await engineFixture(),
        controller = new Motion(1, AnimationStatus.completed),
        secondary = new Motion(),
        actions = [],
        retire = new Set();
      controller.animating = false;
      controller.forward = () => {
        actions.push('forward');
        controller.animating = controller.value !== 1;
      };
      Object.defineProperty(controller, 'isAnimating', { get: () => controller.animating });
      Object.defineProperty(controller, 'value', {
        get: () => controller.current,
        set: (value) => {
          controller.set(
            value,
            value === 1
              ? AnimationStatus.completed
              : value === 0
                ? AnimationStatus.dismissed
                : AnimationStatus.forward,
          );
          controller.animating = false;
        },
      });
      const nav = {
          starts: 0,
          stops: 0,
          gesture: 0,
          isAttached: true,
          get userGestureInProgress() {
            return this.gesture > 0;
          },
          didStartUserGesture() {
            this.starts++;
            this.gesture++;
          },
          didStopUserGesture() {
            this.stops++;
            this.gesture--;
          },
          pop() {
            throw Error('Detector cancel source case must not commit');
          },
        },
        route = new PageRouteBuilder({ pageBuilder: () => new SizedBox() });
      route.transitionPolicy.attach({
        animation: controller,
        secondaryAnimation: secondary,
        context: {},
        navigator: nav,
        isCurrent: () => row.current,
        isActive: () => true,
        isFirst: () => false,
        popGestureInProgress: () => nav.userGestureInProgress,
        canPopGesture: () => row.enabled,
        addRetirementListener: (l) => {
          retire.add(l);
          return () => retire.delete(l);
        },
      });
      try {
        f.set(
          new MediaQuery(
            {
              width: 240,
              height: 640,
              scale: 1,
              textScale: 1,
              safeArea: { top: 0, left: 0, right: 0, bottom: 0 },
              keyboardInset: 0,
            },
            new PredictiveBackPageTransitionsBuilder().buildTransitions(
              route,
              {},
              controller,
              secondary,
              new SizedBox(),
            ),
          ),
        );
        let state;
        const visit = (e) => {
          if (e.widget.constructor.name === 'PredictiveBackGestureDetector') state = e.stateObject;
          e.visitChildren(visit);
        };
        visit(f.root.root);
        assert(state);
        const accepted = state.handleStartBackGesture(
          PredictiveBackEvent.fromMap(map(0, row.button ? 0 : 1, row.button ? 0 : 80)),
        );
        if (accepted) {
          state.handleUpdateBackGestureProgress(PredictiveBackEvent.fromMap(map(0.4)));
          state.handleCancelBackGesture();
        }
        f.frame();
        assert.deepEqual(
          {
            accepted,
            phase: state.phase,
            start: state.startBackEvent?.progress ?? null,
            latest: state.currentBackEvent?.progress ?? null,
            controller: controller.value,
            starts: nav.starts,
            stops: nav.stops,
            actions,
          },
          {
            accepted: row.accepted,
            phase: row.phase,
            start: row.start,
            latest: row.latest,
            controller: row.controller,
            starts: row.starts,
            stops: row.stops,
            actions: row.actions,
          },
        );
      } finally {
        f.set(new SizedBox());
        const snapshot1 = [...retire];
        for (const listener of snapshot1) listener();
        route.transitionPolicy.detach();
        await f.close();
      }
      assert.equal(controller.values.length, 0);
      assert.equal(controller.statuses.length, 0);
      assert.equal(secondary.values.length, 0);
      assert.equal(secondary.statuses.length, 0);
      assert.equal(retire.size, 0);
      assert.equal(nav.gesture, 0);
    }
  },
);
