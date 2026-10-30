import assert from 'node:assert/strict';
import { ZoomPageTransitionsBuilder } from '../dist/page-transitions-theme.js';
import { PageRouteBuilder } from '@nelyx/core/framework/widgets/pages';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { ColoredBox, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Color } from '@nelyx/core/ui/color';
import { Motion, ownedFixture, wrap, snapshots } from './zoom-engine-fixture.mjs';
import {
  paintOriginalZoom,
  readSourcePixels,
  equalSourcePixels,
} from './zoom-source-reference.mjs';
export function snapshotPolicies(f) {
  return snapshots(f).map((w) => ({
    allow: w.controller.allowSnapshotting,
    mode: w.mode,
    autoresize: w.autoresize,
    painter: {
      ZoomEnterTransitionPainter: '_ZoomEnterTransitionPainter',
      ZoomExitTransitionPainter: '_ZoomExitTransitionPainter',
    }[w.painter.constructor.name],
    background: w.painter.backgroundColor?.toARGB32() ?? null,
  }));
}
export async function compareZoomSourceEnvironment(environment) {
  FoundationPlatform.configure({
    kind: environment.web ? 'web' : 'native',
    operatingSystem: 'windows',
  });
  const f = await ownedFixture(),
    actual = f.ck.MakeSurface(240, 160),
    reference = f.ck.MakeSurface(240, 160),
    route = new PageRouteBuilder({ pageBuilder: () => new SizedBox() }),
    leaf = new ColoredBox({ color: 0xffff0000, child: SizedBox.expand() });
  assert(actual && reference);
  let pixels = 0,
    rows = 0,
    traces = 0;
  const compare = (row, label) => {
    actual.getCanvas().clear(f.ck.WHITE);
    f.library.replay(actual.getCanvas(), { commands: f.frame() });
    reference.getCanvas().clear(f.ck.WHITE);
    paintOriginalZoom(f.ck, reference.getCanvas(), row.commands);
    equalSourcePixels(readSourcePixels(f.ck, actual), readSourcePixels(f.ck, reference), label);
    assert.deepEqual(snapshotPolicies(f), row.snapshots, label);
    pixels += 240 * 160;
  };
  try {
    for (const row of environment.rows) {
      const a = new Motion(
          row.primary,
          row.reverse ? AnimationStatus.reverse : AnimationStatus.forward,
        ),
        s = new Motion(
          row.secondary,
          row.secondary === 0 ? AnimationStatus.dismissed : AnimationStatus.forward,
        ),
        builder = new ZoomPageTransitionsBuilder({
          allowSnapshotting: row.allow,
          allowEnterRouteSnapshotting: row.enter,
          backgroundColor: new Color(0xff123456),
        });
      f.set(
        wrap(
          new ColoredBox({
            color: 0xffffffff,
            child: builder.buildTransitions(route, {}, a, s, leaf),
          }),
        ),
      );
      compare(row, {
        environment: environment.name,
        ...row,
        commands: undefined,
        snapshots: undefined,
      });
      rows++;
      f.set(new SizedBox());
      assert.equal(f.liveImages, 0);
      for (const m of [a, s]) {
        assert.equal(m.values.length, 0);
        assert.equal(m.statuses.length, 0);
      }
    }
    for (const allow of [false, true])
      for (const enter of [false, true]) {
        const a = new Motion(),
          s = new Motion(),
          builder = new ZoomPageTransitionsBuilder({
            allowSnapshotting: allow,
            allowEnterRouteSnapshotting: enter,
            backgroundColor: new Color(0xff123456),
          });
        for (const row of environment.traces.filter(
          (r) => r.allow === allow && r.enter === enter,
        )) {
          a.set(row.primary, AnimationStatus[row.status]);
          f.set(
            wrap(
              new ColoredBox({
                color: 0xffffffff,
                child: builder.buildTransitions(route, {}, a, s, leaf),
              }),
            ),
          );
          compare(row, {
            environment: environment.name,
            trace: traces,
            primary: row.primary,
            status: row.status,
            allow,
            enter,
          });
          traces++;
        }
        f.set(new SizedBox());
        assert.equal(f.liveImages, 0);
        for (const m of [a, s]) {
          assert.equal(m.values.length, 0);
          assert.equal(m.statuses.length, 0);
        }
      }
    let delegatedRows = 0,
      delegatedTraces = 0;
    for (const row of environment.delegatedRows) {
      const a = new Motion(1, AnimationStatus.completed),
        s = new Motion(row.secondary, AnimationStatus[row.status]),
        builder = new ZoomPageTransitionsBuilder({
          allowSnapshotting: row.allow,
          allowEnterRouteSnapshotting: row.enter,
          backgroundColor: new Color(0xff123456),
        });
      const w = builder.delegatedTransition({}, a, s, row.callerAllow, row.nullChild ? null : leaf);
      assert(w);
      f.set(wrap(new ColoredBox({ color: 0xffffffff, child: w })));
      compare(row, {
        environment: environment.name,
        delegated: delegatedRows,
        secondary: row.secondary,
        allow: row.allow,
        enter: row.enter,
        callerAllow: row.callerAllow,
        nullChild: row.nullChild,
      });
      delegatedRows++;
      f.set(new SizedBox());
      assert.equal(f.liveImages, 0);
      for (const m of [a, s]) {
        assert.equal(m.values.length, 0);
        assert.equal(m.statuses.length, 0);
      }
    }
    for (const allow of [false, true])
      for (const enter of [false, true])
        for (const callerAllow of [false, true])
          for (const nullChild of [false, true]) {
            const a = new Motion(1, AnimationStatus.completed),
              s = new Motion(),
              builder = new ZoomPageTransitionsBuilder({
                allowSnapshotting: allow,
                allowEnterRouteSnapshotting: enter,
                backgroundColor: new Color(0xff123456),
              });
            for (const row of environment.delegatedTraces.filter(
              (r) =>
                r.allow === allow &&
                r.enter === enter &&
                r.callerAllow === callerAllow &&
                r.nullChild === nullChild,
            )) {
              s.set(row.secondary, AnimationStatus[row.status]);
              const w = builder.delegatedTransition({}, a, s, callerAllow, nullChild ? null : leaf);
              assert(w);
              f.set(wrap(new ColoredBox({ color: 0xffffffff, child: w })));
              compare(row, {
                environment: environment.name,
                delegatedTrace: delegatedTraces,
                secondary: row.secondary,
                status: row.status,
                allow,
                enter,
                callerAllow,
                nullChild,
              });
              delegatedTraces++;
            }
            f.set(new SizedBox());
            assert.equal(f.liveImages, 0);
            for (const m of [a, s]) {
              assert.equal(m.values.length, 0);
              assert.equal(m.statuses.length, 0);
            }
          }
    return {
      environment: environment.name,
      rows,
      traces,
      delegatedRows,
      delegatedTraces,
      fullPixelsCompared: pixels,
      captures: f.captures.length,
    };
  } finally {
    actual.delete();
    reference.delete();
    route.dispose();
    await f.close();
  }
}
