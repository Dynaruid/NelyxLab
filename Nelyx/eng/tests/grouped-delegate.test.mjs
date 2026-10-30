// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { SliverChildGroupedDelegate } from '@nelyx/core/framework/widgets/scroll-delegate';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { Directionality, MediaQuery, Localizations } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SectionExtentIndex } from '@nelyx/core/framework/rendering/section-extent-index';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { Key, ValueKey } from '@nelyx/core/foundation/key';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { fixture } from '../../../packages/material/tests/root-fixture.mjs';
const timeout = 1_200_000,
  key = (value) => new ValueKey(value),
  options = {
    addAutomaticKeepAlives: false,
    addRepaintBoundaries: false,
    addSemanticIndexes: false,
  };
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });

test(
  'public grouped consumers build only visible descriptors and namespace equal item keys by logical group',
  { timeout },
  () => {
    const f = fixture(),
      scroll = new ScrollController(),
      built = [];
    const delegate = new SliverChildGroupedDelegate(
      Array.from({ length: 100 }, (_, g) => ({
        key: key('group-' + g),
        children: Array.from({ length: 10 }, (_, i) => ({
          key: key(i),
          builder: () => {
            built.push(g * 10 + i);
            return new SizedBox(240, 40);
          },
        })),
      })),
      options,
    );
    try {
      assert.equal(delegate.estimatedChildCount, 1000);
      assert.equal(delegate.firstIndexOfGroup(key('group-70')), 700);
      assert.equal(delegate.indexOfChild(key('group-70'), key(2)), 702);
      f.set(
        new Directionality(
          'ltr',
          ListView.custom({
            childrenDelegate: delegate,
            itemExtent: 40,
            cacheExtent: 0,
            padding: EdgeInsets.zero,
            controller: scroll,
            primary: false,
          }),
        ),
      );
      assert.deepEqual(built, [0, 1, 2, 3]);
      scroll.jumpTo(28000);
      f.frame();
      assert.deepEqual(built.slice(4), [700, 701, 702, 703]);
      assert.equal(built.length, 8);
    } finally {
      f.close();
      scroll.dispose();
    }
  },
);

test(
  'group reorder and item insertion keep exact State identities and retire deleted children once',
  { timeout },
  () => {
    const f = fixture(),
      states = new Map(),
      disposed = [];
    class Row extends StatefulWidget {
      constructor(id) {
        super();
        this.id = id;
      }
      createState() {
        return new RowState();
      }
    }
    class RowState extends State {
      initState() {
        super.initState();
        assert(!states.has(this.widget.id));
        states.set(this.widget.id, this);
      }
      build() {
        return new SizedBox(240, 40);
      }
      dispose() {
        disposed.push(this.widget.id);
        super.dispose();
      }
    }
    const make = (groups) =>
      new SliverChildGroupedDelegate(
        groups.map(([group, items]) => ({
          key: key(group),
          children: items.map((item) => ({
            key: key(item),
            builder: () => new Row(group + '/' + item),
          })),
        })),
        options,
      );
    const tree = (delegate) =>
      new Directionality(
        'ltr',
        ListView.custom({
          childrenDelegate: delegate,
          itemExtent: 40,
          cacheExtent: 0,
          padding: EdgeInsets.zero,
          primary: false,
        }),
      );
    try {
      f.set(
        tree(
          make([
            ['a', [0, 1]],
            ['b', [0, 1]],
          ]),
        ),
      );
      const original = new Map(states);
      f.set(
        tree(
          make([
            ['b', [1, 0]],
            ['a', [1, 0]],
          ]),
        ),
      );
      for (const [id, state] of original) assert.equal(states.get(id), state);
      assert.deepEqual(disposed, []);
      f.set(
        tree(
          make([
            ['b', [1, 0]],
            ['a', [1]],
            ['c', [0]],
          ]),
        ),
      );
      assert.deepEqual(disposed, ['a/0']);
      for (const id of ['b/0', 'b/1', 'a/1']) assert.equal(states.get(id), original.get(id));
      assert(states.has('c/0'));
    } finally {
      f.close();
    }
    assert.equal(disposed.length, 5);
    assert.equal(new Set(disposed).size, 5);
  },
);

test(
  'descriptor admission preserves custom Key equality and rejects duplicate namespaces or unbounded expansion',
  { timeout },
  () => {
    class FoldedKey extends Key {
      constructor(value) {
        super();
        this.value = value.toLowerCase();
      }
      equals(other) {
        return other instanceof FoldedKey && other.value === this.value;
      }
      get hashCode() {
        return this.value;
      }
    }
    const item = () => ({ key: key('same'), builder: () => new SizedBox(1, 1) });
    assert.throws(
      () =>
        new SliverChildGroupedDelegate([
          { key: key('a'), children: [] },
          { key: key('a'), children: [] },
        ]),
    );
    assert.throws(
      () => new SliverChildGroupedDelegate([{ key: key('a'), children: [item(), item()] }]),
    );
    assert.throws(
      () =>
        new SliverChildGroupedDelegate([
          { key: new FoldedKey('A'), children: [] },
          { key: new FoldedKey('a'), children: [] },
        ]),
    );
    assert.throws(
      () =>
        new SliverChildGroupedDelegate([
          {
            key: key('a'),
            children: [
              { ...item(), key: new FoldedKey('A') },
              { ...item(), key: new FoldedKey('a') },
            ],
          },
        ]),
    );
    assert.throws(
      () =>
        new SliverChildGroupedDelegate([
          {
            key: key('a'),
            children: Array.from({ length: 4097 }, (_, i) => ({ ...item(), key: key(i) })),
          },
        ]),
    );
    const empty = new SliverChildGroupedDelegate([{ key: key('empty'), children: [] }]);
    assert.equal(empty.estimatedChildCount, 0);
    assert.equal(empty.firstIndexOfGroup(key('empty')), 0);
    assert.equal(empty.indexOfChild(key('empty'), key(0)), null);
  },
);

test(
  'grouped indexed consumers preserve keyed State and logical anchors across bounded reuse, environment and group moves',
  { timeout },
  () => {
    const f = fixture(),
      scroll = new ScrollController(),
      live = new Map(),
      created = [];
    class Item extends StatefulWidget {
      constructor(id) {
        super();
        this.id = id;
      }
      createState() {
        return new ItemState();
      }
    }
    class ItemState extends State {
      initState() {
        super.initState();
        this.id = this.widget.id;
        assert(!live.has(this.id));
        live.set(this.id, this);
        created.push(this.id);
      }
      build(context) {
        return new Semantics({
          container: true,
          transportId: 'grouped-' + this.id,
          label: this.id,
          textDirection: Directionality.of(context),
          child: new SizedBox(null, 80 * MediaQuery.of(context).textScale),
        });
      }
      dispose() {
        assert(live.delete(this.id));
        super.dispose();
      }
    }
    const groups = Array.from({ length: 100 }, (_, group) => group),
      make = (order) =>
        new SliverChildGroupedDelegate(
          order.map((group) => ({
            key: key(group),
            children: Array.from({ length: 10 }, (_, item) => ({
              key: key(item),
              builder: () => new Item(group + '/' + item),
            })),
          })),
          options,
        );
    const tree = (delegate, index, scale = 1) =>
      new MediaQuery(
        {
          width: 480,
          height: 160,
          scale: 1,
          textScale: scale,
          safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
          keyboardInset: 0,
        },
        new Localizations(
          scale === 1 ? 'en' : 'ar',
          {},
          'en',
          new Directionality(
            scale === 1 ? 'ltr' : 'rtl',
            ListView.custom({
              childrenDelegate: delegate,
              extentIndex: index,
              controller: scroll,
              primary: false,
              padding: EdgeInsets.zero,
              childPolicy: { mode: 'bounded' },
            }),
          ),
        ),
      );
    let budget;
    try {
      const delegate = make(groups),
        index = new SectionExtentIndex(1000, { estimatedExtent: 80 });
      index.requestItem(delegate.indexOfChild(key(70), key(2)), { offset: 7 });
      f.set(tree(delegate, index));
      budget = f.root.buildOwner.maybeViewWorkBudget;
      const original = live.get('70/2');
      assert(original);
      assert(created.every((id) => id.startsWith('70/')));
      assert.deepEqual(index.anchor, { index: 702, offset: 7 });
      index.requestItem(delegate.indexOfChild(key(70), key(1)));
      f.frame();
      assert.equal(live.get('70/2'), original);
      assert.deepEqual(index.anchor, { index: 701, offset: 0 });
      const metrics = f.root.context.readMetrics();
      Object.assign(metrics, { logicalWidth: 480, physicalWidth: 480, viewportGeneration: 2 });
      f.set(tree(delegate, index, 2));
      assert.deepEqual(index.anchor, { index: 701, offset: 0 });
      assert.equal(live.get('70/2'), original);
      assert.deepEqual(f.root.nodes.find((node) => node.id === 'grouped-70/1').bounds, {
        x: 0,
        y: 0,
        width: 480,
        height: 160,
      });
      const moved = make([70, ...groups.filter((group) => group !== 70)]),
        replacement = new SectionExtentIndex(1000, { estimatedExtent: 80 });
      replacement.requestItem(moved.indexOfChild(key(70), key(1)));
      f.set(tree(moved, replacement, 2));
      assert.deepEqual(replacement.anchor, { index: 1, offset: 0 });
      assert.equal(live.get('70/2'), original);
      assert(
        created.every((id) => id.startsWith('70/')),
        'Descriptor movement must not build the intervening groups',
      );
      assert(budget.debugStats.optionalChildren <= 8);
      assert(budget.debugStats.optionalElements <= 2048);
    } finally {
      f.close();
      scroll.dispose();
    }
    assert.equal(live.size, 0);
    assert.equal(budget.debugStats.trackedElements, 0);
  },
);
