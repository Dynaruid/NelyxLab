// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SafeArea, SliverSafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { MediaQuery, Directionality, mediaFromView } from '@nelyx/core/framework/widgets/app-data';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import {
  Padding,
  SliverPadding,
  Builder,
  SizedBox,
  ColoredBox,
  SliverToBoxAdapter,
} from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget, StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import { CustomScrollView, ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { ScrollBehavior } from '@nelyx/core/framework/widgets/scroll-configuration';
import { ValueKey } from '@nelyx/core/foundation/key';
import { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { fixture } from './root-fixture.mjs';
import { engineFixture } from './engine-fixture.mjs';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
import { MaterialApp } from '@nelyx/material/app';
import { Material } from '@nelyx/material/material';
import { ListTile } from '@nelyx/material/list-tile';
import { AssetBundle } from '@nelyx/core/services/asset-bundle';
import { DefaultAssetBundle } from '@nelyx/core/framework/widgets/default-asset-bundle';
const timeout = 1200000,
  original = JSON.parse(
    fs.readFileSync(new URL('./fixtures/safe-area-source.json', import.meta.url)),
  ).result,
  edges = (value) => [value.left, value.top, value.right, value.bottom],
  makeEdges = (values) => new EdgeInsets(...values);
const media = (
  safeArea = { left: 10, top: 20, right: 30, bottom: 40 },
  keyboardInset = 0,
  extra = {},
) => ({ width: 240, height: 160, scale: 1, textScale: 1, safeArea, keyboardInset, ...extra });
const plainScroll = new ScrollBehavior().copyWith({ scrollbars: false, overscroll: false });
test(
  'ListTile media projection updates its child without rebuilding unchanged tile content',
  { timeout },
  async () => {
    const f = await engineFixture(),
      seen = [];
    let builds = 0;
    class ProbeTile extends ListTile {
      build(context) {
        builds++;
        return super.build(context);
      }
    }
    const title = new Builder((context) => {
      const data = MediaQuery.of(context);
      seen.push({
        width: data.width,
        left: data.safeArea.left,
        right: data.safeArea.right,
        bottom: data.safeArea.bottom,
        textScale: data.textScale,
        viewLeft: data.viewPadding.left,
        keyboard: data.keyboardInset,
      });
      return new SizedBox(20, 10);
    });
    const bundle = new (class extends AssetBundle {
        async load() {
          throw Error('This tile has no image assets');
        }
      })(),
      child = new DefaultAssetBundle(
        bundle,
        new MaterialApp(new Material({ child: new ProbeTile({ title }) })),
      );
    let data = media({ left: 12, top: 20, right: 32, bottom: 40 }, 0, {
      viewPadding: new EdgeInsets(99, 20, 88, 40),
      textScale: 1.5,
    });
    try {
      f.set(new MediaQuery(data, child));
      const initial = builds;
      assert.deepEqual(seen.at(-1), {
        width: 240,
        left: 0,
        right: 0,
        bottom: 40,
        textScale: 1.5,
        viewLeft: 99,
        keyboard: 0,
      });
      data = { ...data, width: 320 };
      f.set(new MediaQuery(data, child));
      assert.equal(seen.at(-1).width, 320);
      assert.equal(
        builds,
        initial,
        'The tile must not subscribe to a full media copy just to project safe-area values',
      );
      data = {
        ...data,
        safeArea: { left: 18, top: 20, right: 38, bottom: 44 },
        keyboardInset: 22,
        textScale: 2,
      };
      f.set(new MediaQuery(data, child));
      assert.deepEqual(seen.at(-1), {
        width: 320,
        left: 0,
        right: 0,
        bottom: 44,
        textScale: 2,
        viewLeft: 99,
        keyboard: 22,
      });
      assert.equal(builds, initial);
    } finally {
      await f.close();
    }
  },
);
function recipe(widget, data, leaf) {
  const scope = widget instanceof Padding ? widget.childWidgets[0] : widget.child;
  return {
    outer: edges(widget.padding),
    childPadding: edges(scope.data.padding),
    childViewPadding: edges(scope.data.viewPadding),
    childViewInsets: edges(scope.data.viewInsets),
    tokenSame: scope.data.token === data.token,
    dataSame: scope.data === data,
    leafSame: scope.child === leaf,
  };
}

test(
  'unchanged SafeArea/SliverSafeArea and MediaQuery removal agree with48 original flag/minimum/keyboard recipes',
  { timeout },
  () => {
    const f = fixture(),
      leaf = new SizedBox(1, 1);
    try {
      for (const row of original.rows) {
        const data = media(
            {
              left: row.inputViewPadding[0],
              top: row.inputViewPadding[1],
              right: row.inputViewPadding[2],
              bottom: row.inputViewPadding[3],
            },
            row.inputViewInsets[3],
            {
              padding: makeEdges(row.inputPadding),
              viewPadding: makeEdges(row.inputViewPadding),
              viewInsets: makeEdges(row.inputViewInsets),
              token: {},
            },
          ),
          sides = {
            left: row.left,
            top: row.top,
            right: row.right,
            bottom: row.bottom,
            minimum: makeEdges(row.minimum),
          };
        f.set(
          new MediaQuery(
            data,
            new Builder((context) => {
              const box = new SafeArea({
                  ...sides,
                  maintainBottomViewPadding: row.maintain,
                  child: leaf,
                }).build(context),
                sliver = new SliverSafeArea({ ...sides, sliver: leaf }).build(context);
              assert(box instanceof Padding);
              assert(sliver instanceof SliverPadding);
              assert.deepEqual(recipe(box, data, leaf), row.box);
              assert.deepEqual(recipe(sliver, data, leaf), row.sliver);
              return new SizedBox(1, 1);
            }),
          ),
        );
      }
    } finally {
      f.close();
    }
  },
);
test(
  'public safe-area defaults/key/child/diagnostics retain canonical StatelessWidget and required MediaQuery',
  { timeout },
  () => {
    const child = new SizedBox(),
      key = new ValueKey('safe'),
      box = new SafeArea({ key, child });
    assert(box instanceof StatelessWidget);
    assert.deepEqual(
      {
        key: box.key.value,
        childSame: box.child === child,
        minimumSame: box.minimum === EdgeInsets.zero,
        maintain: box.maintainBottomViewPadding,
        sides: [box.left, box.top, box.right, box.bottom],
      },
      original.public,
    );
    const old = FoundationBuildMode.mode;
    FoundationBuildMode.mode = 'debug';
    try {
      for (const widget of [box, new SliverSafeArea({ sliver: child })]) {
        const p = new DiagnosticPropertiesBuilder();
        widget.debugFillProperties(p);
        assert.deepEqual(
          p.properties.map((p) => ({ name: p.name, value: p.value, ifTrue: p.ifTrue })),
          original.diagnostics,
        );
      }
    } finally {
      FoundationBuildMode.mode = old;
    }
    const f = fixture();
    try {
      f.set(
        new Builder((context) => {
          assert.throws(() => box.build(context));
          assert.throws(() => new SliverSafeArea({ sliver: child }).build(context));
          assert.equal(MediaQuery.maybePaddingOf(context), null);
          return new SizedBox(1, 1);
        }),
      );
    } finally {
      f.close();
    }
  },
);
test(
  'nested actual box SafeAreas avoid double padding and preserve State through keyboard/view-padding changes',
  { timeout },
  async () => {
    const f = await engineFixture(),
      surface = f.ck.MakeSurface(240, 160),
      counts = { created: 0, disposed: 0 },
      read = [];
    class Probe extends StatefulWidget {
      createState() {
        counts.created++;
        return new (class extends State {
          build(context) {
            read.push({
              padding: edges(MediaQuery.paddingOf(context)),
              view: edges(MediaQuery.viewPaddingOf(context)),
              insets: edges(MediaQuery.viewInsetsOf(context)),
            });
            return new ColoredBox({ color: 0xffff0000, child: new SizedBox() });
          }
          dispose() {
            counts.disposed++;
            super.dispose();
          }
        })();
      }
    }
    const child = new Probe(),
      wrap = (keyboard, maintain) =>
        new MediaQuery(
          media(undefined, keyboard),
          new SafeArea({ maintainBottomViewPadding: maintain, child: new SafeArea({ child }) }),
        );
    const pixel = (x, y) => {
      const image = surface.makeImageSnapshot();
      try {
        return Array.from(
          image.readPixels(x, y, {
            width: 1,
            height: 1,
            colorType: f.ck.ColorType.RGBA_8888,
            alphaType: f.ck.AlphaType.Unpremul,
            colorSpace: f.ck.ColorSpace.SRGB,
          }),
        );
      } finally {
        image.delete();
      }
    };
    const paint = () => {
      surface.getCanvas().clear(f.ck.WHITE);
      f.library.replay(surface.getCanvas(), { commands: f.frame() });
      surface.flush();
    };
    try {
      f.set(wrap(0, false));
      paint();
      assert.deepEqual(pixel(9, 21), [16, 24, 39, 255]);
      assert.deepEqual(pixel(10, 20), [255, 0, 0, 255]);
      assert.deepEqual(pixel(209, 119), [255, 0, 0, 255]);
      assert.deepEqual(pixel(210, 120), [16, 24, 39, 255]);
      assert.deepEqual(read.at(-1).padding, [0, 0, 0, 0]);
      f.set(wrap(100, false));
      paint();
      assert.deepEqual(pixel(100, 159), [255, 0, 0, 255]);
      assert.deepEqual(read.at(-1).insets, [0, 0, 0, 100]);
      f.set(wrap(100, true));
      paint();
      assert.deepEqual(pixel(100, 119), [255, 0, 0, 255]);
      assert.deepEqual(pixel(100, 120), [16, 24, 39, 255]);
      assert.equal(counts.created, 1);
      f.set(new SizedBox());
      assert.equal(counts.disposed, 1);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      surface.delete();
      await f.close();
    }
  },
);
test(
  'nested SliverSafeArea uses actual viewport geometry and retains keyed State/scroll offset across inset updates',
  { timeout },
  () => {
    const f = fixture(),
      controller = new ScrollController(),
      read = [],
      counts = { created: 0, disposed: 0 };
    class Probe extends StatefulWidget {
      createState() {
        counts.created++;
        return new (class extends State {
          build(context) {
            read.push(edges(MediaQuery.paddingOf(context)));
            return new ColoredBox({ color: 0xff123456, child: new SizedBox(240, 400) });
          }
          dispose() {
            counts.disposed++;
            super.dispose();
          }
        })();
      }
    }
    const probe = new Probe(),
      wrap = (left) =>
        new Directionality(
          'ltr',
          new MediaQuery(
            media({ left, top: 20, right: 30, bottom: 40 }),
            new CustomScrollView({
              controller,
              scrollBehavior: plainScroll,
              slivers: [
                new SliverSafeArea({
                  sliver: new SliverSafeArea({ sliver: new SliverToBoxAdapter({ child: probe }) }),
                }),
              ],
            }),
          ),
        );
    try {
      f.set(wrap(10));
      assert.equal(controller.position.maxScrollExtent, 300);
      assert.deepEqual(read.at(-1), [0, 0, 0, 0]);
      controller.jumpTo(50);
      f.frame();
      assert.equal(controller.position.pixels, 50);
      f.set(wrap(20));
      assert.equal(controller.position.pixels, 50);
      assert.equal(controller.position.maxScrollExtent, 300);
      assert.equal(counts.created, 1);
      f.set(new SizedBox());
      assert.equal(counts.disposed, 1);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
      controller.dispose();
    }
  },
);
test(
  'BoxScrollView consumes only main-axis source padding and retains viewPadding behind its child scope',
  { timeout },
  () => {
    const f = fixture(),
      controller = new ScrollController(),
      read = [];
    const probe = new Builder((context) => {
      read.push({
        padding: edges(MediaQuery.paddingOf(context)),
        view: edges(MediaQuery.viewPaddingOf(context)),
      });
      return new SizedBox(240, 400);
    });
    try {
      f.set(
        new Directionality(
          'ltr',
          new MediaQuery(
            media(),
            new ListView({ controller, scrollBehavior: plainScroll, children: [probe] }),
          ),
        ),
      );
      assert.deepEqual(read.at(-1), { padding: [10, 0, 30, 0], view: [10, 20, 30, 40] });
      f.set(
        new Directionality(
          'ltr',
          new MediaQuery(
            media(),
            new SafeArea({
              child: new ListView({ controller, scrollBehavior: plainScroll, children: [probe] }),
            }),
          ),
        ),
      );
      assert.deepEqual(read.at(-1), { padding: [0, 0, 0, 0], view: [0, 0, 0, 0] });
      f.set(new SizedBox());
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
      controller.dispose();
    }
  },
);
test(
  'MediaQuery notices private-field inset values and projects host view padding/keyboard occlusion without losing State',
  { timeout },
  () => {
    const f = fixture(),
      seen = [],
      counts = { created: 0, disposed: 0 };
    class Probe extends StatefulWidget {
      createState() {
        counts.created++;
        return new (class extends State {
          build(context) {
            seen.push(edges(MediaQuery.paddingOf(context)));
            return new SizedBox(1, 1);
          }
          dispose() {
            counts.disposed++;
            super.dispose();
          }
        })();
      }
    }
    const probe = new Probe();
    try {
      const a = media(undefined, 0, { padding: new EdgeInsets(1, 2, 3, 4) });
      f.set(new MediaQuery(a, probe));
      const builds = seen.length;
      f.set(new MediaQuery({ ...a, padding: new EdgeInsets(1, 2, 3, 4) }, probe));
      assert.equal(seen.length, builds);
      f.set(new MediaQuery({ ...a, padding: new EdgeInsets(1, 2, 3, 9) }, probe));
      assert.equal(seen.length, builds + 1);
      assert.deepEqual(seen.at(-1), [1, 2, 3, 9]);
      assert.equal(counts.created, 1);
      f.set(new SizedBox());
      assert.equal(counts.disposed, 1);
      const read = f.root.context.readMetrics;
      f.root.context.readMetrics = () => ({
        ...read(),
        environment: {
          safeArea: { left: 10, top: 20, right: 30, bottom: 40 },
          safeAreaSource: 'native',
          keyboardInset: 100,
          keyboardSource: 'native-ime',
          textScale: 1,
          textScaleSource: 'native',
        },
      });
      f.set(
        new Builder(
          (context) =>
            new MediaQuery(
              mediaFromView(context),
              new Builder((childContext) => {
                assert.deepEqual(edges(MediaQuery.paddingOf(childContext)), [10, 20, 30, 0]);
                assert.deepEqual(edges(MediaQuery.viewPaddingOf(childContext)), [10, 20, 30, 40]);
                assert.deepEqual(edges(MediaQuery.viewInsetsOf(childContext)), [0, 0, 0, 100]);
                return new SizedBox(1, 1);
              }),
            ),
        ),
      );
    } finally {
      f.close();
    }
  },
);
