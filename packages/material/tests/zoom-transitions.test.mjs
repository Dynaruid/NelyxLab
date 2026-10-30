import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compareZoomSourceEnvironment, snapshotPolicies } from './zoom-source-compare.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import 'node:crypto';
import { ZoomPageTransitionsBuilder } from '../dist/page-transitions-theme.js';
import { ZoomPageTransitionsBuilder as AggregateZoom } from '../dist/widgets.js';
import { configureZoomTransitionProfile } from '../dist/internal/route/zoom-profile.js';
import { PageRouteBuilder } from '@nelyx/core/framework/widgets/pages';
import { Navigator, NavigatorController } from '@nelyx/core/framework/widgets/navigation';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import '@nelyx/core/framework/widgets/snapshot-widget';
import '@nelyx/core/framework/widgets/framework';
import '@nelyx/core/framework/widgets/app-data';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { Color } from '@nelyx/core/ui/color';
import { Paint } from '@nelyx/core/ui/paint';
import { Size } from '@nelyx/core/ui/size';
import { Image } from '@nelyx/core/ui/image';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { Offset } from '@nelyx/core/ui/offset';
import { Matrix4 } from '@nelyx/core/math/matrix4';
import { PaintingContext } from '@nelyx/core/framework/painting/context';
import '@nelyx/core/hosting/rasterization';
import { Theme } from '../dist/theme.js';
import { ThemeData } from '../dist/theme-data.js';
import './engine-fixture.mjs';
import { Motion, Probe, ownedFixture, wrap, snapshots, flush } from './zoom-engine-fixture.mjs';
const timeout = 1200000;
test(
  'Zoom builder supplies three source options and canonical durations, delegated policy, route-level snapshot selection and aggregate API',
  { timeout },
  async () => {
    assert.equal(AggregateZoom, ZoomPageTransitionsBuilder);
    const b = new ZoomPageTransitionsBuilder();
    assert.equal(b.transitionDuration, 300);
    assert.equal(b.reverseTransitionDuration, 300);
    assert.equal(b.allowSnapshotting, true);
    assert.equal(b.allowEnterRouteSnapshotting, true);
    assert.equal(b.backgroundColor, null);
    assert.equal(typeof b.delegatedTransition, 'function');
    assert.notEqual(b.delegatedTransition, b.delegatedTransition);
    const f = await ownedFixture(),
      a = new Motion(0.2, AnimationStatus.forward),
      s = new Motion(),
      route = new PageRouteBuilder({ pageBuilder: () => new SizedBox(), allowSnapshotting: false });
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
    try {
      const w = b.buildTransitions(route, {}, a, s, new SizedBox());
      assert.throws(() => configureZoomTransitionProfile({ forceDisableSnapshotting: true }));
      f.set(wrap(w));
      a.set(0.3, AnimationStatus.forward);
      f.frame();
      assert(snapshots(f).length > 0);
      assert(snapshots(f).every((w) => !w.controller.allowSnapshotting));
      assert.equal(f.captures.length, 0);
    } finally {
      await f.close();
      route.dispose();
    }
    assert.equal(a.values.length, 0);
    assert.equal(a.statuses.length, 0);
    assert.equal(s.values.length, 0);
    assert.equal(s.statuses.length, 0);
  },
);
test(
  'actual native policy captures on source value notifications while web policy always paints live; child State/listeners retire',
  { timeout },
  async () => {
    for (const kind of ['native', 'web']) {
      FoundationPlatform.configure({ kind, operatingSystem: 'windows' });
      const f = await ownedFixture(),
        a = new Motion(0.2, AnimationStatus.forward),
        s = new Motion(),
        counts = { created: 0, disposed: 0 },
        route = new PageRouteBuilder({ pageBuilder: () => new SizedBox() }),
        b = new ZoomPageTransitionsBuilder({ backgroundColor: new Color(0xff123456) });
      try {
        f.set(wrap(b.buildTransitions(route, {}, a, s, new Probe(counts))));
        assert.equal(f.captures.length, 0);
        a.set(0.3, AnimationStatus.forward);
        f.frame();
        assert.equal(f.captures.length > 0, kind === 'native');
        assert.equal(f.liveImages > 0, kind === 'native');
        a.set(1, AnimationStatus.completed);
        f.frame();
        assert.equal(f.liveImages, 0);
        assert.equal(counts.created, 1);
      } finally {
        await f.close();
        route.dispose();
      }
      assert.equal(counts.created, counts.disposed);
      for (const motion of [a, s]) {
        assert.equal(motion.values.length, 0);
        assert.equal(motion.statuses.length, 0);
      }
    }
  },
);
test(
  'source enter-snapshot disable leaves primary live and still permits a later outgoing secondary snapshot',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
    const f = await ownedFixture(),
      a = new Motion(0.2, AnimationStatus.forward),
      s = new Motion(),
      route = new PageRouteBuilder({ pageBuilder: () => new SizedBox() }),
      b = new ZoomPageTransitionsBuilder({
        allowEnterRouteSnapshotting: false,
        backgroundColor: new Color(0xff345678),
      });
    try {
      f.set(wrap(b.buildTransitions(route, {}, a, s, new SizedBox())));
      a.set(0.3, AnimationStatus.forward);
      f.frame();
      assert.equal(f.captures.length, 0);
      a.set(1, AnimationStatus.completed);
      s.set(0.2, AnimationStatus.forward);
      f.frame();
      s.set(0.3, AnimationStatus.forward);
      f.frame();
      assert(f.captures.length > 0);
    } finally {
      await f.close();
      route.dispose();
    }
    for (const motion of [a, s]) {
      assert.equal(motion.values.length, 0);
      assert.equal(motion.statuses.length, 0);
    }
  },
);
test(
  'source background and same-status Animation replacement retain painter/proxy until terminal handoff on the same child State',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
    const f = await ownedFixture(),
      a = new Motion(0.2, AnimationStatus.forward),
      next = new Motion(0.4, AnimationStatus.forward),
      s = new Motion(),
      counts = { created: 0, disposed: 0 },
      route = new PageRouteBuilder({ pageBuilder: () => new SizedBox() }),
      firstColor = new Color(0xff123456),
      secondColor = new Color(0xffabcdef),
      build = (animation, color) =>
        new ZoomPageTransitionsBuilder({ backgroundColor: color }).buildTransitions(
          route,
          {},
          animation,
          s,
          new Probe(counts),
        );
    try {
      f.set(wrap(build(a, firstColor)));
      const painters = snapshots(f).map((w) => w.painter);
      assert(painters.some((p) => p.backgroundColor === firstColor));
      f.set(wrap(build(a, secondColor)));
      assert(painters.every((p) => snapshots(f).some((w) => w.painter === p)));
      assert(snapshots(f).some((w) => w.painter.backgroundColor === firstColor));
      f.set(wrap(build(next, secondColor)));
      assert(a.values.length > 0);
      assert(next.statuses.length > 0);
      assert(painters.every((p) => snapshots(f).some((w) => w.painter === p)));
      next.set(0.6, AnimationStatus.forward);
      f.frame();
      assert(a.values.length > 0);
      next.set(1, AnimationStatus.completed);
      f.frame();
      assert.equal(a.values.length, 0);
      assert.equal(a.statuses.length, 0);
      assert(snapshots(f).some((w) => w.painter.backgroundColor === firstColor));
      assert.equal(counts.created, 1);
    } finally {
      await f.close();
      route.dispose();
    }
    assert.equal(counts.created, counts.disposed);
    for (const motion of [a, next, s]) {
      assert.equal(motion.values.length, 0);
      assert.equal(motion.statuses.length, 0);
    }
  },
);
test(
  'actual Navigator Zoom push/pop keeps pages, captures owned CPU images and drains reverse completion, State and ticker owners',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
    const f = await ownedFixture(),
      c = new NavigatorController(),
      counts = { created: 0, disposed: 0 },
      builder = new ZoomPageTransitionsBuilder({ backgroundColor: new Color(0xff506070) }),
      page = (color) => {
        let r;
        return (r = new PageRouteBuilder({
          pageBuilder: () => new Probe(counts, color),
          transitionDuration: builder.transitionDuration,
          reverseTransitionDuration: builder.reverseTransitionDuration,
          transitionsBuilder: (context, a, s, child) =>
            builder.buildTransitions(r, context, a, s, child),
        }));
      },
      a = page(0xff00ff00),
      b = page(0xffff0000);
    try {
      f.set(wrap(new Navigator(c, a)));
      const result = c.push(b);
      f.frame();
      f.advance(150);
      assert(f.captures.length > 0);
      f.advance(151);
      await flush();
      f.frame();
      assert.equal(f.liveImages, 0);
      assert.equal(counts.created, 2);
      assert(c.pop(7));
      f.frame();
      f.advance(150);
      f.advance(151);
      await flush();
      f.frame();
      assert.equal(await result, 7);
      assert.equal(await b.completed, 7);
      assert.equal(b.animation === null, true);
      assert.equal(counts.disposed, 1);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      await f.close();
      c.dispose();
    }
    assert.equal(counts.created, counts.disposed);
  },
);
test(
  'actual Theme supplies Zoom background surface through the canonical inherited lookup',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await ownedFixture(),
      a = new Motion(0.3, AnimationStatus.forward),
      s = new Motion(),
      route = new PageRouteBuilder({ pageBuilder: () => new SizedBox() }),
      theme = ThemeData.dark();
    try {
      f.set(
        new Theme(
          theme,
          wrap(new ZoomPageTransitionsBuilder().buildTransitions(route, {}, a, s, new SizedBox())),
        ),
      );
      assert(
        snapshots(f).some(
          (w) => w.painter.backgroundColor?.toARGB32() === theme.colorScheme.surface,
        ),
      );
    } finally {
      await f.close();
      route.dispose();
    }
  },
);
test(
  'Core pushTransform preserves source offset conjugation, layer reuse, callback position and direct paint save/restore',
  { timeout },
  () => {
    const matrix = Matrix4.diagonal3Values(2, 3, 1),
      offset = new Offset(5, 7),
      context = new PaintingContext(),
      points = [];
    const paint = (context, p) => {
      points.push([p.x, p.y]);
      const fill = new Paint();
      fill.color = 0xff123456;
      context.drawRect({ x: p.x, y: p.y, width: 3, height: 4 }, fill);
    };
    try {
      const layer = context.pushTransform(true, offset, matrix, paint);
      assert.deepEqual([layer.transform[12], layer.transform[13]], [-5, -14]);
      assert.equal(context.pushTransform(true, offset, matrix, paint, { oldLayer: layer }), layer);
      assert.equal(context.pushTransform(false, offset, matrix, paint), null);
      assert.deepEqual(points, [
        [5, 7],
        [5, 7],
        [5, 7],
      ]);
      assert.equal(
        context.commands.filter((r) => r.op === 'save').length,
        context.commands.filter((r) => r.op === 'restore').length,
      );
    } finally {
      context.dispose();
    }
  },
);
test(
  'explicit source benchmark flag selects the no-cache branch and leaves delegated snapshot policy independent',
  { timeout },
  () => {
    const script =
      "import assert from 'node:assert/strict';import {configureZoomTransitionProfile} from '@nelyx/material/internal/route/zoom-profile';configureZoomTransitionProfile({forceDisableSnapshotting:true});const {ZoomPageTransitionsBuilder}=await import('@nelyx/material/page-transitions-theme');const {PageRouteBuilder}=await import('@nelyx/core/framework/widgets/pages');const {SizedBox}=await import('@nelyx/core/framework/widgets/basic');const {kAlwaysCompleteAnimation,kAlwaysDismissedAnimation}=await import('@nelyx/core/framework/animation/animations');const {Color}=await import('@nelyx/core/ui/color');const builder=new ZoomPageTransitionsBuilder({backgroundColor:new Color(0xff123456)}),route=new PageRouteBuilder({pageBuilder:()=>new SizedBox()});assert.equal(builder.buildTransitions(route,{},kAlwaysCompleteAnimation,kAlwaysDismissedAnimation,new SizedBox()).constructor.name,'ZoomPageTransitionNoCache');assert.equal(builder.delegatedTransition({},kAlwaysCompleteAnimation,kAlwaysDismissedAnimation,false,null).constructor.name,'DualTransitionBuilder');assert.throws(()=>configureZoomTransitionProfile({forceDisableSnapshotting:false}));route.dispose();";
    const result = cp.spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      windowsHide: true,
      timeout,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  },
);

const originalZoom = JSON.parse(
  fs.readFileSync(new URL('./fixtures/zoom-transitions-source.json', import.meta.url)),
);
test(
  'unchanged original VM defaults and source retained proxy/painter decisions match the actual Core tree',
  { timeout },
  async () => {
    const original = originalZoom.environments.find((e) => e.name === 'web');
    for (const row of original.defaults) {
      const b = new ZoomPageTransitionsBuilder({
        allowSnapshotting: row.allow,
        allowEnterRouteSnapshotting: row.enter,
        backgroundColor: row.background === null ? null : new Color(row.background),
      });
      assert.deepEqual(
        {
          custom: row.custom,
          allow: b.allowSnapshotting,
          enter: b.allowEnterRouteSnapshotting,
          background: b.backgroundColor?.toARGB32() ?? null,
          duration: b.transitionDuration,
          reverseDuration: b.reverseTransitionDuration,
        },
        row,
      );
    }
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await ownedFixture(),
      a = new Motion(0.2, AnimationStatus.forward),
      next = new Motion(0.4, AnimationStatus.forward),
      s = new Motion(),
      route = new PageRouteBuilder({ pageBuilder: () => new SizedBox() }),
      build = (animation, color) =>
        new ZoomPageTransitionsBuilder({ backgroundColor: new Color(color) }).buildTransitions(
          route,
          {},
          animation,
          s,
          new SizedBox(),
        );
    try {
      f.set(wrap(build(a, 0xff123456)));
      assert.deepEqual(snapshotPolicies(f), original.replacement.initial);
      f.set(wrap(build(a, 0xffabcdef)));
      assert.deepEqual(snapshotPolicies(f), original.replacement.colorOnly);
      f.set(wrap(build(next, 0xffabcdef)));
      assert.equal(a.values.length > 0, original.replacement.sameStatus.oldValues > 0);
      assert.equal(a.statuses.length > 0, original.replacement.sameStatus.oldStatuses > 0);
      assert.deepEqual(snapshotPolicies(f), original.replacement.sameStatus.snapshots);
      next.set(1, AnimationStatus.completed);
      f.set(wrap(build(next, 0xffabcdef)));
      assert.equal(a.values.length, original.replacement.terminal.oldValues);
      assert.equal(a.statuses.length, original.replacement.terminal.oldStatuses);
      assert.deepEqual(snapshotPolicies(f), original.replacement.terminal.snapshots);
    } finally {
      await f.close();
      route.dispose();
    }
    assert.deepEqual(
      {
        oldValues: a.values.length,
        oldStatuses: a.statuses.length,
        nextValues: next.values.length,
        nextStatuses: next.statuses.length,
        secondaryValues: s.values.length,
        secondaryStatuses: s.statuses.length,
      },
      original.replacement.afterDispose,
    );
  },
);
test(
  'unchanged original native/web recipes and persistent snapshot/interruption traces match all actual canonical CPU pixels',
  { timeout },
  async () => {
    const results = [];
    for (const name of ['native', 'web'])
      results.push(
        await compareZoomSourceEnvironment(originalZoom.environments.find((e) => e.name === name)),
      );
    assert.equal(
      results.reduce((n, r) => n + r.rows, 0),
      320,
    );
    assert.equal(
      results.reduce((n, r) => n + r.traces, 0),
      80,
    );
    assert.equal(
      results.reduce((n, r) => n + r.delegatedRows, 0),
      128,
    );
    assert.equal(
      results.reduce((n, r) => n + r.delegatedTraces, 0),
      160,
    );
    assert.equal(
      results.reduce((n, r) => n + r.fullPixelsCompared, 0),
      26419200,
    );
  },
);
test(
  'unchanged original benchmark no-cache recipes and interruption traces match actual filtered Core CPU paint in a separate realm',
  { timeout },
  () => {
    const result = cp.spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./zoom-profile-source.mjs', import.meta.url))],
      { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024 },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const proof = JSON.parse(result.stdout.trim());
    assert.equal(proof.rows, 160);
    assert.equal(proof.traces, 40);
    assert.equal(proof.delegatedRows, 64);
    assert.equal(proof.delegatedTraces, 80);
    assert.equal(proof.fullPixelsCompared, 13209600);
    assert.equal(proof.captures, 0);
  },
);

test(
  '48 original painter recipes preserve exact double helper geometry, alpha, fractional image source and borrowed listener teardown',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await ownedFixture(),
      a = new Motion(0.3, AnimationStatus.forward),
      s = new Motion(),
      route = new PageRouteBuilder({ pageBuilder: () => new SizedBox() }),
      registry = new ResourceRegistry(),
      descriptor = { kind: 'image', id: 'zoom-source-painter-value', generation: 1 };
    registry.register(descriptor, () => {});
    const image = Image.fromResource(registry, descriptor, 47, 27),
      normalize = (v) =>
        typeof v === 'number' && v === 0
          ? 0
          : Array.isArray(v)
            ? v.map(normalize)
            : v && typeof v === 'object'
              ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)]))
              : v,
      nonidentity = (m) => m.some((v, i) => v !== (i % 5 === 0 ? 1 : 0));
    try {
      f.set(
        wrap(
          new ZoomPageTransitionsBuilder({
            backgroundColor: new Color(0xff123456),
          }).buildTransitions(route, {}, a, s, new SizedBox()),
        ),
      );
      const ctors = Object.fromEntries(
        snapshots(f).map((w) => [w.painter.constructor.name, w.painter.constructor]),
      );
      for (const row of originalZoom.environments.find((e) => e.name === 'web').painterCases) {
        const animation = new Motion(
            row.progress,
            row.reverse ? AnimationStatus.reverse : AnimationStatus.forward,
          ),
          scale = new Motion(row.scale, animation.status),
          fade = new Motion(row.fade, animation.status),
          Ctor =
            ctors[
              row.family === 'enter' ? 'ZoomEnterTransitionPainter' : 'ZoomExitTransitionPainter'
            ],
          painter =
            row.family === 'enter'
              ? new Ctor(row.reverse, scale, fade, animation, new Color(0xff123456))
              : new Ctor(row.reverse, scale, fade, animation),
          context = new PaintingContext();
        try {
          if (row.cached)
            painter.paintSnapshot(
              context,
              new Offset(3, 4),
              new Size(31.25, 17.5),
              image,
              new Size(46.875, 26.25),
              1.5,
            );
          else
            painter.paint(context, new Offset(3, 4), new Size(31.25, 17.5), (context, offset) => {
              const paint = new Paint();
              paint.color = 0xffff0000;
              context.drawRect({ x: offset.dx, y: offset.dy, width: 31.25, height: 17.5 }, paint);
            });
          const actualRects = context.commands
              .filter((r) => r.op === 'drawRect')
              .map((r) => ({
                rect: [r.rect.x, r.rect.y, r.rect.width, r.rect.height],
                color: r.paint.color,
              })),
            expectedRects = row.commands
              .filter((r) => r.kind === 'rect')
              .map(({ rect, color }) => ({ rect, color }));
          assert.deepEqual(normalize(actualRects), normalize(expectedRects));
          const actualImages = context.commands
              .filter((r) => r.op === 'drawImageRect')
              .map((r) => ({
                src: [r.src.x, r.src.y, r.src.width, r.src.height],
                dst: [r.dst.x, r.dst.y, r.dst.width, r.dst.height],
                color: r.paint.color,
                quality: r.paint.filterQuality,
              })),
            expectedImages = row.commands
              .filter((r) => r.kind === 'image')
              .map(({ src, dst, color, quality }) => ({ src, dst, color, quality }));
          assert.deepEqual(normalize(actualImages), normalize(expectedImages));
          assert.deepEqual(
            context.commands.filter((r) => r.op === 'saveLayer').map((r) => r.paint.color >>> 24),
            row.commands.filter((r) => r.kind === 'opacity').map((r) => r.alpha),
          );
          const actualMatrices = context.commands
              .filter(
                (r) => r.op === 'transform' && r.matrix.length === 16 && nonidentity(r.matrix),
              )
              .map((r) => r.matrix),
            expectedMatrices = row.commands
              .filter((r) => r.kind === 'transform' && nonidentity(r.matrix))
              .map((r) => r.matrix);
          assert.deepEqual(normalize(actualMatrices), normalize(expectedMatrices));
        } finally {
          context.dispose();
          painter.dispose();
        }
        for (const motion of [animation, scale, fade]) {
          assert.equal(motion.values.length, 0);
          assert.equal(motion.statuses.length, 0);
        }
      }
    } finally {
      image.dispose();
      registry.releaseProducer(descriptor);
      registry.dispose();
      await f.close();
      route.dispose();
    }
  },
);
