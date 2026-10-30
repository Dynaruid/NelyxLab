// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { SectionExtentIndex } from '@nelyx/core/framework/rendering/section-extent-index';
import { RenderSliverSectionList } from '@nelyx/core/framework/rendering/sliver-section-list';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { Directionality, MediaQuery, Localizations } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { AutomaticKeepAliveClientMixin } from '@nelyx/core/framework/widgets/automatic-keep-alive';
import { ValueKey } from '@nelyx/core/foundation/key';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { Axis } from '@nelyx/core/framework/painting/basic-types';
import { fixture } from '../../../packages/material/tests/root-fixture.mjs';
const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });

test(
  'section estimates preserve measured prefixes, zero extents and two exact metric configurations',
  { timeout },
  () => {
    const index = new SectionExtentIndex(4, { estimatedExtent: 50 }),
      a = {},
      b = {};
    assert.equal(index.totalExtent, 200);
    index._configure(240, a);
    index._measure(0, 20);
    index._measure(1, 0);
    index._measure(2, 80);
    assert.deepEqual(
      [0, 1, 2, 3, 4].map((n) => index.prefix(n)),
      [0, 20, 20, 100, 150],
    );
    assert.deepEqual(
      [-1, 0, 19, 20, 99, 100, 999].map((n) => index.indexAtOffset(n)),
      [0, 0, 0, 2, 2, 3, 3],
    );
    index._configure(480, b);
    assert.equal(index.measurement(2), 'invalidated');
    index._measure(2, 40);
    assert.equal(index.totalExtent, 110);
    index._configure(240, a);
    assert.equal(index.totalExtent, 150);
    assert.equal(index.measurement(2), 'measured');
    index.invalidate(2);
    assert.equal(index.measurement(2), 'invalidated');
    index._configure(480, b);
    assert.equal(index.measurement(2), 'invalidated');
    index._configure(390, {});
    assert.equal(index.cachedConfigurations, 2);
    assert.equal(index.numericStorageBytes, 152);
    for (const run of [
      () => new SectionExtentIndex(4097),
      () => new SectionExtentIndex(1, { estimatedExtent: 0 }),
      () => index.requestItem(4),
      () => index.requestItem(0, { offset: -1 }),
      () => index.prefix(5),
      () => index._measure(0, Infinity),
    ])
      assert.throws(run);
    const empty = new SectionExtentIndex(0);
    assert.equal(empty.totalExtent, 0);
    assert.equal(empty.indexAtOffset(20), 0);
    assert.throws(() => empty.requestItem(0));
  },
);

test(
  'fractional section prefix boundaries map back to their exact item without an epsilon or adjacent anchor',
  { timeout },
  () => {
    const positions = [1, 2, 31, 127, 255, 511, 699, 700, 701, 998, 999],
      index = new SectionExtentIndex(1000, { estimatedExtent: 31.072 });
    assert.deepEqual(
      positions.map((i) => index.indexAtOffset(index.prefix(i))),
      positions,
    );
    index._configure(240, null);
    for (let i = 0; i < 1000; i++) index._measure(i, 31.072 + (i % 7) * 0.1);
    assert.deepEqual(
      positions.map((i) => index.indexAtOffset(index.prefix(i))),
      positions,
    );
  },
);

function setup({
  count = 1000,
  cacheExtent = 0,
  index = new SectionExtentIndex(count),
  height = (_i, width) => (width < 300 ? 70 : 40),
} = {}) {
  const f = fixture(),
    controller = new ScrollController(),
    built = new Set();
  let revision = {};
  const tree = () =>
    new Directionality(
      'ltr',
      ListView.builder({
        controller,
        primary: false,
        extentIndex: index,
        metricRevision: revision,
        itemCount: count,
        cacheExtent,
        padding: EdgeInsets.zero,
        itemBuilder: (_context, i) => {
          built.add(i);
          return new LayoutBuilder(
            (_context, box) =>
              new Semantics({
                container: true,
                transportId: 'section-' + i,
                label: 'Section ' + i,
                textDirection: 'ltr',
                child: new SizedBox(null, height(i, box.maxWidth)),
              }),
          );
        },
      }),
    );
  const render = () => {
    const pending = [f.root.pipeline.root];
    while (pending.length) {
      const node = pending.pop();
      if (node instanceof RenderSliverSectionList) return node;
      pending.push(...node.children);
    }
    throw Error('Missing actual section renderer');
  };
  return {
    ...f,
    controller,
    index,
    built,
    tree,
    render,
    newRevision() {
      revision = {};
    },
    close() {
      f.close();
      controller.dispose();
    },
  };
}

test(
  'first far seek creates only destination children and paints actual measured sizes',
  { timeout },
  () => {
    const f = setup();
    f.index.requestItem(700, { offset: 17 });
    try {
      f.set(f.tree());
      assert(f.built.size <= 4);
      assert([...f.built].every((i) => i >= 700 && i <= 703));
      assert.deepEqual(f.index.anchor, { index: 700, offset: 17 });
      assert.deepEqual(f.root.nodes.find((n) => n.id === 'section-700').bounds, {
        x: 0,
        y: 0,
        width: 240,
        height: 53,
      });
      assert.equal(f.index.measurement(0), 'unmeasured');
      assert.equal(f.render().childCount, 3);
      f.index.requestItem(10);
      f.frame();
      assert(f.root.nodes.some((n) => n.id === 'section-10'));
      assert(!f.root.nodes.some((n) => n.id === 'section-700'));
      assert(f.built.size <= 7);
      assert(f.render().children.length <= 4);
    } finally {
      f.close();
    }
  },
);

test(
  'backward section entry preserves overlapping State and far backward seeks build only the destination',
  { timeout },
  () => {
    const f = fixture(),
      index = new SectionExtentIndex(1000, { estimatedExtent: 60 }),
      controller = new ScrollController(),
      states = new Map(),
      built = [],
      disposed = [];
    class Row extends StatefulWidget {
      constructor(i) {
        super(new ValueKey(i));
        this.i = i;
      }
      createState() {
        return new RowState();
      }
    }
    class RowState extends State {
      initState() {
        super.initState();
        states.set(this.widget.i, this);
      }
      build() {
        return new Semantics({
          container: true,
          transportId: 'overlap-' + this.widget.i,
          label: 'Section',
          textDirection: 'ltr',
          child: new SizedBox(null, 60),
        });
      }
      dispose() {
        disposed.push(this.widget.i);
        super.dispose();
      }
    }
    const tree = new Directionality(
      'ltr',
      ListView.builder({
        controller,
        extentIndex: index,
        itemCount: 1000,
        cacheExtent: 0,
        padding: EdgeInsets.zero,
        itemBuilder: (_context, i) => {
          built.push(i);
          return new Row(i);
        },
      }),
    );
    try {
      index.requestItem(10, { offset: 10 });
      f.set(tree);
      assert.deepEqual(built, [10, 11, 12]);
      const previous = [10, 11, 12].map((i) => states.get(i));
      built.length = 0;
      index.requestItem(9, { offset: 50 });
      f.frame();
      assert.deepEqual(built, [9]);
      [10, 11, 12].forEach((i, n) => assert.equal(states.get(i), previous[n]));
      assert.deepEqual(disposed, []);
      assert.deepEqual(f.root.nodes.find((node) => node.id === 'overlap-9').bounds, {
        x: 0,
        y: 0,
        width: 240,
        height: 10,
      });
      assert.deepEqual(f.root.nodes.find((node) => node.id === 'overlap-12').bounds, {
        x: 0,
        y: 130,
        width: 240,
        height: 30,
      });
      built.length = 0;
      index.requestItem(10, { offset: 10 });
      f.frame();
      assert.deepEqual(built, []);
      [10, 11, 12].forEach((i, n) => assert.equal(states.get(i), previous[n]));
      assert.deepEqual(disposed, [9]);
      index.requestItem(1);
      f.frame();
      assert.deepEqual(built, [1, 2, 3]);
      assert.deepEqual(
        disposed.slice().sort((a, b) => a - b),
        [9, 10, 11, 12],
      );
      assert.deepEqual(index.anchor, { index: 1, offset: 0 });
    } finally {
      f.close();
      controller.dispose();
    }
  },
);

test(
  'cache measurements and width or metric changes preserve the visible section anchor',
  { timeout },
  () => {
    let scale = 1;
    const f = setup({
      cacheExtent: 120,
      height: (i, width) => (width < 300 ? 60 + (i % 3) * 10 : 30 + (i % 3) * 5) * scale,
    });
    f.index.requestItem(700, { offset: 17 });
    try {
      f.set(f.tree());
      assert(f.built.size < 12);
      assert.deepEqual(f.index.anchor, { index: 700, offset: 17 });
      const metrics = f.root.context.readMetrics();
      Object.assign(metrics, { logicalWidth: 480, physicalWidth: 480, viewportGeneration: 2 });
      f.frame();
      assert.deepEqual(f.index.anchor, { index: 700, offset: 17 });
      assert.equal(f.root.nodes.find((n) => n.id === 'section-700').bounds.height, 18);
      scale = 2;
      f.newRevision();
      f.set(f.tree());
      assert.deepEqual(f.index.anchor, { index: 700, offset: 17 });
      assert.equal(f.root.nodes.find((n) => n.id === 'section-700').bounds.height, 53);
      assert(f.built.size <= 24);
      assert([...f.built].every((i) => i >= 696 && i <= 720));
      Object.assign(metrics, { logicalWidth: 240, physicalWidth: 240, viewportGeneration: 3 });
      f.frame();
      assert.deepEqual(f.index.anchor, { index: 700, offset: 17 });
      assert.equal(f.index.cachedConfigurations, 2);
    } finally {
      f.close();
    }
  },
);

test(
  'far seeks keep selected State offscreen and retire it when keep-alive is released',
  { timeout },
  () => {
    const f = fixture(),
      index = new SectionExtentIndex(1000),
      controller = new ScrollController(),
      states = new Map(),
      disposed = [];
    let retain = true;
    class Row extends StatefulWidget {
      constructor(i) {
        super();
        this.i = i;
      }
      createState() {
        return new RowState();
      }
    }
    class RowState extends AutomaticKeepAliveClientMixin {
      get wantKeepAlive() {
        return this.widget.i === 700 && retain;
      }
      initState() {
        super.initState();
        states.set(this.widget.i, this);
      }
      build(context) {
        super.build(context);
        return new Semantics({
          container: true,
          transportId: 'state-' + this.widget.i,
          label: 'State',
          textDirection: 'ltr',
          child: new SizedBox(null, 60),
        });
      }
      dispose() {
        disposed.push(this.widget.i);
        super.dispose();
      }
    }
    const tree = () =>
      new Directionality(
        'ltr',
        ListView.builder({
          controller,
          extentIndex: index,
          itemCount: 1000,
          cacheExtent: 0,
          padding: EdgeInsets.zero,
          itemBuilder: (_context, i) => new Row(i),
        }),
      );
    try {
      index.requestItem(700);
      f.set(tree());
      const original = states.get(700);
      assert(original);
      index.requestItem(0);
      f.frame();
      assert(!f.root.nodes.some((n) => n.id === 'state-700'));
      assert(!disposed.includes(700));
      index.requestItem(700);
      f.frame();
      assert.equal(states.get(700), original);
      index.requestItem(0);
      f.frame();
      retain = false;
      original.updateKeepAlive();
      f.frame();
      assert(disposed.includes(700));
      index.requestItem(700);
      f.frame();
      assert.notEqual(states.get(700), original);
    } finally {
      f.close();
      controller.dispose();
    }
  },
);

test(
  'section index ownership rejects concurrent renderers and releases on disposal',
  { timeout },
  () => {
    const index = new SectionExtentIndex(2),
      a = setup({ count: 2, index }),
      b = setup({ count: 2, index });
    try {
      a.set(a.tree());
      assert.throws(() => b.set(b.tree()), /cannot be shared/);
      a.frame();
    } finally {
      a.close();
      try {
        b.close();
      } catch (error) {
        assert.match(String(error), /cannot be shared/);
      }
    }
    const c = setup({ count: 2, index });
    try {
      c.set(c.tree());
      assert.equal(c.index.anchor.index, 0);
    } finally {
      c.close();
    }
  },
);

test(
  'size-only MediaQuery changes remeasure sections without rebuilding the retained delegate children',
  { timeout },
  () => {
    const f = fixture(),
      index = new SectionExtentIndex(1000),
      controller = new ScrollController(),
      built = [];
    const child = new Directionality(
      'ltr',
      ListView.builder({
        controller,
        extentIndex: index,
        itemCount: 1000,
        cacheExtent: 0,
        padding: EdgeInsets.zero,
        itemBuilder: (_context, i) => {
          built.push(i);
          return new Semantics({
            container: true,
            transportId: 'resize-section-' + i,
            label: 'Section',
            textDirection: 'ltr',
            child: new SizedBox(null, 60),
          });
        },
      }),
    );
    const tree = (width, { scale = 1, textScale = 1, boldText = false } = {}) =>
      new MediaQuery(
        {
          width,
          height: 160,
          scale,
          textScale,
          boldText,
          safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
          keyboardInset: 0,
        },
        child,
      );
    try {
      f.set(tree(240));
      built.length = 0;
      for (const width of [260, 280, 300]) {
        Object.assign(f.root.context.readMetrics(), {
          logicalWidth: width,
          physicalWidth: width,
          viewportGeneration: width,
        });
        f.set(tree(width));
        assert.deepEqual(
          built,
          [],
          'Viewport changes must not invoke the unchanged section builder',
        );
        assert.equal(f.root.nodes.find((n) => n.id === 'resize-section-0').bounds.width, width);
      }
      for (const options of [
        { scale: 2 },
        { scale: 2, textScale: 1.5 },
        { scale: 2, textScale: 1.5, boldText: true },
      ]) {
        f.set(tree(300, options));
        assert(built.length > 0, 'Typography changes must still refresh the section environment');
        built.length = 0;
      }
    } finally {
      f.close();
      controller.dispose();
    }
  },
);

test(
  'inherited scale, locale and direction invalidate offscreen estimates without creating those sections',
  { timeout },
  () => {
    const f = fixture(),
      index = new SectionExtentIndex(1000),
      controller = new ScrollController(),
      built = new Set();
    const tree = (scale, locale, direction, deviceScale = 1) =>
      new MediaQuery(
        {
          width: 240,
          height: 160,
          scale: deviceScale,
          textScale: scale,
          safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
          keyboardInset: 0,
        },
        new Localizations(
          locale,
          {},
          'en',
          new Directionality(
            direction,
            ListView.builder({
              controller,
              extentIndex: index,
              itemCount: 1000,
              cacheExtent: 0,
              padding: EdgeInsets.zero,
              itemBuilder: (context, i) => {
                built.add(i);
                return new Semantics({
                  container: true,
                  transportId: 'environment-' + i,
                  label: 'Environment',
                  textDirection: direction,
                  child: new SizedBox(null, 70 * MediaQuery.of(context).textScale),
                });
              },
            }),
          ),
        ),
      );
    try {
      index.requestItem(10);
      f.set(tree(1, 'en', 'ltr'));
      index.requestItem(100);
      f.frame();
      assert.equal(index.measurement(10), 'measured');
      built.clear();
      f.set(tree(2, 'ar', 'rtl'));
      assert.equal(index.measurement(10), 'invalidated');
      assert(!built.has(10));
      assert.deepEqual(index.anchor, { index: 100, offset: 0 });
      assert.equal(f.root.nodes.find((n) => n.id === 'environment-100').bounds.height, 140);
      index.requestItem(10);
      f.frame();
      assert.equal(index.measurement(10), 'measured');
      assert.equal(index.cachedConfigurations, 2);
      f.set(tree(2, 'ar', 'rtl', 2));
      assert.equal(index.measurement(100), 'invalidated');
      assert.equal(index.measurement(10), 'measured');
    } finally {
      f.close();
      controller.dispose();
    }
  },
);

test(
  'long zero-height runs retire nonvisible children within the standard owner budget',
  { timeout },
  () => {
    const f = setup({ count: 1000, height: (i) => (i < 700 ? 0 : 60) });
    try {
      f.set(f.tree());
      assert(f.root.nodes.some((n) => n.id === 'section-700'));
      assert(f.render().children.length < 128);
      assert.equal(f.index.prefix(700), 0);
    } finally {
      f.close();
    }
  },
);

test(
  'queued delegate/count replacement uses the new index after the canonical child build scope flush',
  { timeout },
  () => {
    const f = fixture(),
      controller = new ScrollController();
    const tree = (index) =>
      new Directionality(
        'ltr',
        ListView.builder({
          controller,
          extentIndex: index,
          itemCount: index.count,
          cacheExtent: 0,
          padding: EdgeInsets.zero,
          itemBuilder: (_context, i) =>
            new Semantics({
              container: true,
              transportId: 'replacement-' + i,
              label: 'Replacement',
              textDirection: 'ltr',
              child: new SizedBox(null, 60),
            }),
        }),
      );
    try {
      f.set(tree(new SectionExtentIndex(10)));
      const next = new SectionExtentIndex(3);
      next.requestItem(1);
      f.set(tree(next));
      assert.deepEqual(next.anchor, { index: 1, offset: 0 });
      assert(f.root.nodes.some((n) => n.id === 'replacement-1'));
      f.set(tree(new SectionExtentIndex(0)));
      assert(!f.root.nodes.some((n) => n.id.startsWith('replacement-')));
    } finally {
      f.close();
      controller.dispose();
    }
  },
);

test('keyed membership insertion fills gaps between existing active children', { timeout }, () => {
  const f = fixture(),
    controller = new ScrollController(),
    keys = new Map([0, 1, 2, 3].map((i) => [i, new ValueKey(i)]));
  const tree = (items) =>
    new Directionality(
      'ltr',
      ListView.builder({
        controller,
        extentIndex: new SectionExtentIndex(items.length),
        itemCount: items.length,
        cacheExtent: 0,
        padding: EdgeInsets.zero,
        findChildIndexCallback: (key) => {
          const at = items.findIndex((i) => keys.get(i) === key);
          return at < 0 ? null : at;
        },
        itemBuilder: (_context, index) => {
          const i = items[index];
          return new Semantics({
            key: keys.get(i),
            container: true,
            transportId: 'membership-' + i,
            label: 'Membership',
            textDirection: 'ltr',
            child: new SizedBox(null, 60),
          });
        },
      }),
    );
  try {
    f.set(tree([0, 2]));
    f.set(tree([0, 1, 2, 3]));
    assert.deepEqual(
      f.root.nodes.filter((n) => n.id.startsWith('membership-')).map((n) => n.id),
      ['membership-0', 'membership-1', 'membership-2'],
    );
  } finally {
    f.close();
    controller.dispose();
  }
});

test(
  'a keyed insertion at the new leading cache slot materializes that slot before its retained successor',
  { timeout },
  () => {
    const f = fixture(),
      controller = new ScrollController(),
      keys = new Map([0, 1, 2, 3].map((i) => [i, new ValueKey(i)]));
    const tree = (items, index) =>
      new Directionality(
        'ltr',
        ListView.builder({
          controller,
          extentIndex: index,
          itemCount: items.length,
          cacheExtent: 0,
          padding: EdgeInsets.zero,
          findChildIndexCallback: (key) => {
            const at = items.findIndex((i) => keys.get(i) === key);
            return at < 0 ? null : at;
          },
          itemBuilder: (_context, at) =>
            new Semantics({
              key: keys.get(items[at]),
              container: true,
              transportId: 'leading-' + items[at],
              label: 'Leading',
              textDirection: 'ltr',
              child: new SizedBox(null, 60),
            }),
        }),
      );
    try {
      f.set(tree([0, 2, 3], new SectionExtentIndex(3, { estimatedExtent: 60 })));
      const index = new SectionExtentIndex(4, { estimatedExtent: 60 });
      index.requestItem(1);
      f.set(tree([0, 1, 2, 3], index));
      assert.deepEqual(
        f.root.nodes.filter((n) => n.id.startsWith('leading-')).map((n) => n.id),
        ['leading-1', 'leading-2', 'leading-3'],
      );
      assert.deepEqual(index.anchor, { index: 1, offset: 0 });
    } finally {
      f.close();
      controller.dispose();
    }
  },
);

test(
  'an external FocusNode request materializes its distant section before gaining focus',
  { timeout },
  async () => {
    const f = fixture(),
      index = new SectionExtentIndex(1000),
      controller = new ScrollController(),
      focus = new FocusNode();
    const tree = new Directionality(
      'ltr',
      ListView.builder({
        controller,
        extentIndex: index,
        itemCount: 1000,
        cacheExtent: 0,
        padding: EdgeInsets.zero,
        itemBuilder: (_context, i) =>
          i === 700
            ? new Focus(new SizedBox(null, 60), { focusNode: focus })
            : new SizedBox(null, 60),
      }),
    );
    try {
      f.set(tree);
      assert.equal(focus.context, null);
      index.requestItem(700);
      focus.requestFocus();
      f.frame();
      await Promise.resolve();
      f.frame();
      assert(focus.hasPrimaryFocus);
      assert(focus.rect.top >= 0 && focus.rect.bottom <= 160);
    } finally {
      f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'horizontal indexed sections honor reversal and RTL and cache the scroll axis separately',
  { timeout },
  () => {
    const index = new SectionExtentIndex(2);
    index._configure(240, null);
    index._measure(0, 70);
    index._configure(240, null, null, Axis.horizontal);
    assert.equal(index.measurement(0), 'invalidated');
    index._measure(0, 40);
    index._configure(240, null);
    assert.equal(index.prefix(1), 70);
    for (const [direction, reverse, x] of [
      ['ltr', false, 0],
      ['ltr', true, 180],
      ['rtl', false, 180],
      ['rtl', true, 0],
    ]) {
      const f = fixture(),
        extentIndex = new SectionExtentIndex(1000),
        controller = new ScrollController();
      extentIndex.requestItem(700);
      try {
        f.set(
          new Directionality(
            direction,
            ListView.builder({
              controller,
              scrollDirection: Axis.horizontal,
              reverse,
              extentIndex,
              itemCount: 1000,
              cacheExtent: 0,
              padding: EdgeInsets.zero,
              itemBuilder: (_context, i) =>
                new Semantics({
                  container: true,
                  transportId: 'horizontal-' + i,
                  label: 'Horizontal',
                  textDirection: direction,
                  child: new SizedBox(60, null),
                }),
            }),
          ),
        );
        assert.deepEqual(f.root.nodes.find((n) => n.id === 'horizontal-700').bounds, {
          x,
          y: 0,
          width: 60,
          height: 160,
        });
      } finally {
        f.close();
        controller.dispose();
      }
    }
  },
);

test(
  'a detached section owner releases its index before a keyed replacement mounts in the same frame',
  { timeout },
  () => {
    const f = fixture(),
      index = new SectionExtentIndex(3),
      first = new ScrollController(),
      second = new ScrollController();
    const tree = (key, controller) =>
      new Directionality(
        'ltr',
        ListView.builder({
          key: new ValueKey(key),
          controller,
          extentIndex: index,
          itemCount: 3,
          cacheExtent: 0,
          padding: EdgeInsets.zero,
          itemBuilder: () => new SizedBox(null, 60),
        }),
      );
    try {
      f.set(tree('first', first));
      f.set(tree('second', second));
      assert(second.hasClients);
      assert.equal(index.anchor.index, 0);
    } finally {
      f.close();
      first.dispose();
      second.dispose();
    }
  },
);
