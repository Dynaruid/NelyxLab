// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { State, StatefulWidget, StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import { KeepAlive } from '@nelyx/core/framework/widgets/sliver';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { GlobalKey, createFrameworkAnchorKey } from '@nelyx/core/framework/widgets/global-key';
import {
  Notification,
  NotificationListener,
} from '@nelyx/core/framework/widgets/notification-listener';
import { SectionExtentIndex } from '@nelyx/core/framework/rendering/section-extent-index';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { SizedBox, Row, Column, Expanded } from '@nelyx/core/framework/widgets/basic';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { ValueKey } from '@nelyx/core/foundation/key';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { ResourceAccounting } from '@nelyx/core/hosting/resources';
import { TextLayoutBudget } from '@nelyx/core/hosting/text-layout-budget';
import { fixture } from '../../../packages/material/tests/root-fixture.mjs';
const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });

test(
  'dormant rows detach, silence tickers and rebuild fresh builder output on actual State reactivation',
  { timeout },
  () => {
    const f = fixture(),
      scroll = new ScrollController(),
      live = new Map(),
      built = [],
      notices = [];
    let label = 'first',
      ticks = 0,
      created = 0,
      disposed = 0,
      cache;
    class Notice extends Notification {}
    class Item extends StatefulWidget {
      constructor(index, text) {
        super(new ValueKey(index));
        this.index = index;
        this.text = text;
      }
      createState() {
        return new ItemState();
      }
    }
    class ItemState extends SingleTickerProviderStateMixin {
      value = 0;
      activations = 0;
      deactivations = 0;
      updates = 0;
      initState() {
        super.initState();
        this.id = this.widget.index;
        live.set(this.id, this);
        created++;
        if (this.id === 0) {
          this.ticker = this.createTicker(() => {
            ticks++;
          });
          this.ticker.start();
        }
      }
      activate() {
        super.activate();
        this.activations++;
      }
      deactivate() {
        this.deactivations++;
        super.deactivate();
      }
      didUpdateWidget(old) {
        super.didUpdateWidget(old);
        this.updates++;
      }
      build() {
        this.lastDirection = Directionality.of(this.context);
        return new Semantics({
          container: true,
          transportId: 'dormant-' + this.id,
          label: this.widget.text + ':' + this.value,
          textDirection: this.lastDirection,
          child: new SizedBox(100, 80),
        });
      }
      dispose() {
        this.ticker?.dispose();
        assert(live.delete(this.id));
        disposed++;
        super.dispose();
      }
    }
    const list = ListView.builder({
        controller: scroll,
        primary: false,
        itemExtent: 80,
        itemCount: 100,
        cacheExtent: 0,
        padding: EdgeInsets.zero,
        childPolicy: { mode: 'dormant', capacity: 8 },
        itemBuilder: (_context, index) => {
          built.push(index);
          return new Item(index, label);
        },
      }),
      widget = (direction = 'ltr', tag = 'first') =>
        new NotificationListener({
          notificationType: Notice,
          onNotification: () => {
            notices.push(tag);
            return false;
          },
          child: new Directionality(direction, list),
        });
    try {
      f.set(widget());
      const original = live.get(0),
        render = original.context.findRenderObject();
      f.advance(16);
      assert(ticks > 0);
      new Notice().dispatch(original.context);
      assert.deepEqual(notices, ['first']);
      scroll.jumpTo(80);
      f.frame();
      cache = f.root.buildOwner.maybeDormantChildren;
      assert.equal(cache.debugStats.children, 1);
      assert.equal(original.context.active, false);
      assert.equal(original.mounted, true);
      assert.equal(render.attached, false);
      assert(!f.root.nodes.some((node) => node.id === 'dormant-0'));
      const stopped = ticks;
      original.setState(() => (original.value = 7));
      label = 'latest';
      new Notice().dispatch(original.context);
      assert.deepEqual(notices, ['first']);
      f.set(widget('rtl', 'latest'));
      f.advance(100);
      assert.equal(ticks, stopped, 'A dormant framework ticker cannot call an inactive context');
      scroll.jumpTo(0);
      f.frame();
      assert.equal(live.get(0), original);
      assert.equal(original.context.active, true);
      assert.equal(original.activations, 1);
      assert.equal(original.deactivations, 1);
      assert(original.updates > 0);
      assert.equal(original.lastDirection, 'rtl');
      assert.equal(
        built.filter((index) => index === 0).length,
        2,
        'Reentry invokes the public builder again',
      );
      assert(f.root.nodes.some((node) => node.id === 'dormant-0' && node.name === 'latest:7'));
      assert.equal(cache.debugStats.hits, 1);
      new Notice().dispatch(original.context);
      assert.deepEqual(notices, ['first', 'latest']);
      f.advance(16);
      assert(ticks > stopped);
    } finally {
      f.close();
      scroll.dispose();
    }
    assert.equal(live.size, 0);
    assert.equal(created, disposed);
    assert.equal(cache.debugStats.children, 0);
    assert.equal(cache.debugStats.elements, 0);
  },
);

test(
  'dormant rows share View limits and invalidate on delegate changes while GlobalKeys keep ordinary retirement',
  { timeout },
  () => {
    const f = fixture(),
      controllers = [new ScrollController(), new ScrollController()],
      live = new Map(),
      global = new GlobalKey('dormant-excluded');
    let cache,
      created = 0,
      disposed = 0;
    class Item extends StatefulWidget {
      constructor(column, index) {
        super(column === 0 && index === 0 ? global : new ValueKey(column + ':' + index));
        this.column = column;
        this.index = index;
      }
      createState() {
        return new ItemState();
      }
    }
    class ItemState extends State {
      initState() {
        super.initState();
        this.id = this.widget.column + ':' + this.widget.index;
        live.set(this.id, this);
        created++;
      }
      build() {
        return new SizedBox(100, 80);
      }
      dispose() {
        assert(live.delete(this.id));
        disposed++;
        super.dispose();
      }
    }
    const make = (column) =>
      ListView.builder({
        controller: controllers[column],
        primary: false,
        itemExtent: 80,
        itemCount: 1000,
        cacheExtent: 0,
        padding: EdgeInsets.zero,
        childPolicy: { mode: 'dormant', capacity: 32 },
        itemBuilder: (_context, index) => new Item(column, index),
      });
    const tree = () =>
      new Directionality('ltr', new Row([new Expanded(make(0)), new Expanded(make(1))]));
    try {
      f.set(tree());
      const excluded = global.currentElement;
      controllers[0].jumpTo(80);
      f.frame();
      assert(excluded.debugIsDefunct);
      assert.equal(global.currentElement, undefined);
      for (const index of [8, 16, 24, 32, 40, 48, 56, 64, 72]) {
        for (const controller of controllers) controller.jumpTo(index * 80);
        f.frame();
        cache = f.root.buildOwner.maybeDormantChildren;
        assert(cache.debugStats.children <= 32);
        assert(cache.debugStats.elements <= 4096);
      }
      assert(cache.debugStats.evictions > 0);
      assert(cache.debugStats.children > 0);
      f.set(tree());
      assert.equal(
        cache.debugStats.children,
        0,
        'A new delegate invalidates dormant content before a later reuse',
      );
    } finally {
      f.close();
      for (const controller of controllers) controller.dispose();
    }
    assert.equal(live.size, 0);
    assert.equal(created, disposed);
    assert.equal(cache.debugStats.children, 0);
  },
);

test(
  'pressure retires dormant owners but an admitted frame retains its independent resource charge',
  { timeout },
  () => {
    const f = fixture(),
      scroll = new ScrollController(),
      registry = f.root.context.resources,
      accounting = new ResourceAccounting(registry),
      live = new Map();
    let lease,
      cache,
      retired = 0;
    class Item extends StatefulWidget {
      constructor(index) {
        super(new ValueKey(index));
        this.index = index;
      }
      createState() {
        return new ItemState();
      }
    }
    class ItemState extends State {
      initState() {
        super.initState();
        this.id = this.widget.index;
        live.set(this.id, this);
        this.resource = { id: 'dormant-resource-' + this.id, generation: 1 };
        registry.register({ ...this.resource, kind: 'paragraph' }, () => retired++, {
          owner: accounting,
          identity: {},
          cost: { units: 5, bytes: 40 },
        });
      }
      build() {
        return new SizedBox(100, 80);
      }
      dispose() {
        registry.releaseProducer(this.resource);
        assert(live.delete(this.id));
        super.dispose();
      }
    }
    try {
      f.set(
        new Directionality(
          'ltr',
          ListView.builder({
            controller: scroll,
            primary: false,
            itemExtent: 80,
            itemCount: 100,
            cacheExtent: 0,
            padding: EdgeInsets.zero,
            childPolicy: { mode: 'dormant', capacity: 8 },
            itemBuilder: (_context, index) => new Item(index),
          }),
        ),
      );
      const resource = live.get(0).resource;
      lease = registry.acquire([resource]);
      scroll.jumpTo(80);
      f.frame();
      cache = f.root.buildOwner.maybeDormantChildren;
      assert.equal(cache.debugStats.children, 1);
      assert.equal(registry.initialProducerCount(resource), 1);
      assert.equal(registry.reclaimOptionalResources(), true);
      assert.equal(cache.debugStats.children, 0);
      assert(!live.has(0));
      assert.equal(registry.initialProducerCount(resource), 0);
      assert.equal(registry.isRetained(resource), true);
      assert.equal(registry.retainedReferenceCount(resource), 1);
      assert.equal(accounting.totals.resident, live.size + 1);
      assert.equal(accounting.totals.producers, live.size);
      assert.equal(retired, 0);
      lease.returnBy('caller');
      lease = undefined;
      assert.equal(registry.isRetained(resource), false);
      assert.equal(retired, 1);
      scroll.jumpTo(0);
      f.frame();
      assert(live.has(0));
    } finally {
      lease?.returnBy('caller');
      f.close();
      scroll.dispose();
    }
    assert.equal(live.size, 0);
    assert.equal(registry.accountedTotals.resident, 0);
  },
);

test(
  'dormant eviction cleans remaining roots after a falsey dispose failure and the View remains usable',
  { timeout },
  () => {
    const f = fixture(),
      scroll = new ScrollController(),
      live = new Set();
    let armed = false,
      cache;
    class Item extends StatefulWidget {
      constructor(index) {
        super(new ValueKey(index));
        this.index = index;
      }
      createState() {
        return new ItemState();
      }
    }
    class ItemState extends State {
      initState() {
        super.initState();
        this.id = this.widget.index;
        live.add(this.id);
      }
      build() {
        return new SizedBox(100, 80);
      }
      dispose() {
        live.delete(this.id);
        super.dispose();
        if (armed && this.id === 0) throw undefined;
      }
    }
    try {
      f.set(
        new Directionality(
          'ltr',
          ListView.builder({
            controller: scroll,
            primary: false,
            itemExtent: 80,
            itemCount: 100,
            cacheExtent: 0,
            padding: EdgeInsets.zero,
            childPolicy: { mode: 'dormant', capacity: 8 },
            itemBuilder: (_context, index) => new Item(index),
          }),
        ),
      );
      scroll.jumpTo(160);
      f.frame();
      cache = f.root.buildOwner.maybeDormantChildren;
      assert.equal(cache.debugStats.children, 2);
      armed = true;
      const leaves = (error) =>
        error instanceof AggregateError ? error.errors.flatMap(leaves) : [error];
      assert.throws(
        () => f.root.context.resources.reclaimOptionalResources(),
        (error) =>
          error instanceof AggregateError &&
          leaves(error).length === 1 &&
          leaves(error)[0] === undefined,
      );
      assert.equal(cache.debugStats.children, 0);
      assert(!live.has(0) && !live.has(1));
      armed = false;
      scroll.jumpTo(0);
      f.frame();
      assert(live.has(0) && live.has(1));
    } finally {
      armed = false;
      f.close();
      scroll.dispose();
    }
    assert.equal(live.size, 0);
  },
);

test(
  'retaking an internal anchor extracts its live Element before disposing the dormant remainder',
  { timeout },
  () => {
    const f = fixture(),
      scroll = new ScrollController(),
      key = createFrameworkAnchorKey('retaken anchor'),
      live = new Set();
    let outside = false,
      cache,
      original;
    class Item extends StatefulWidget {
      constructor(index) {
        super(new ValueKey(index));
        this.index = index;
      }
      createState() {
        return new ItemState();
      }
    }
    class ItemState extends State {
      initState() {
        super.initState();
        this.id = this.widget.index;
        live.add(this.id);
      }
      build() {
        return new SizedBox(
          100,
          80,
          this.id === 0 && !outside ? new SizedBox(20, 20, undefined, key) : undefined,
        );
      }
      dispose() {
        live.delete(this.id);
        super.dispose();
      }
    }
    const list = ListView.builder({
        controller: scroll,
        primary: false,
        itemExtent: 80,
        itemCount: 100,
        cacheExtent: 0,
        padding: EdgeInsets.zero,
        childPolicy: { mode: 'dormant', capacity: 8 },
        itemBuilder: (_context, index) => new Item(index),
      }),
      tree = () =>
        new Directionality(
          'ltr',
          new Column([
            new Expanded(list),
            new SizedBox(
              null,
              outside ? 40 : 0,
              outside ? new SizedBox(20, 20, undefined, key) : undefined,
            ),
          ]),
        );
    try {
      f.set(tree());
      original = key.currentElement;
      scroll.jumpTo(80);
      f.frame();
      cache = f.root.buildOwner.maybeDormantChildren;
      assert.equal(cache.debugStats.children, 1);
      assert.equal(original.active, false);
      outside = true;
      f.set(tree());
      assert.equal(key.currentElement, original);
      assert.equal(original.active, true);
      assert.equal(original.debugIsDefunct, false);
      assert(
        !live.has(0),
        'The stale remainder cannot retain a second route to the extracted anchor',
      );
      assert.equal(cache.debugStats.children, 0);
    } finally {
      f.close();
      scroll.dispose();
    }
    assert.equal(key.currentElement, undefined);
    assert.equal(live.size, 0);
  },
);

test(
  'indexed dormant sections preserve their anchor and a failed activation retires the transferred root before retry',
  { timeout },
  () => {
    const f = fixture(),
      scroll = new ScrollController(),
      index = new SectionExtentIndex(100, { estimatedExtent: 80 }),
      live = new Map();
    let fail = false,
      old,
      cache;
    class Item extends StatefulWidget {
      constructor(i) {
        super(new ValueKey(i));
        this.i = i;
      }
      createState() {
        return new ItemState();
      }
    }
    class ItemState extends State {
      initState() {
        super.initState();
        this.id = this.widget.i;
        live.set(this.id, this);
      }
      activate() {
        super.activate();
        if (fail && this.id === 0) throw Error('dormant activation failed');
      }
      build() {
        return new SizedBox(100, 80);
      }
      dispose() {
        assert(live.delete(this.id));
        super.dispose();
      }
    }
    try {
      f.set(
        new Directionality(
          'rtl',
          ListView.builder({
            controller: scroll,
            primary: false,
            extentIndex: index,
            itemCount: 100,
            cacheExtent: 0,
            padding: EdgeInsets.zero,
            childPolicy: { mode: 'dormant', capacity: 8 },
            itemBuilder: (_context, i) => new Item(i),
          }),
        ),
      );
      old = live.get(0);
      index.requestItem(2, { offset: 13 });
      f.frame();
      cache = f.root.buildOwner.maybeDormantChildren;
      assert(cache.debugStats.children > 0);
      assert.deepEqual(index.anchor, { index: 2, offset: 13 });
      fail = true;
      index.requestItem(0, { offset: 0 });
      assert.throws(() => f.frame(), /dormant activation failed/);
      assert.equal(old.mounted, false);
      assert(!live.has(0));
      fail = false;
      f.frame();
      assert(live.has(0));
      assert.notEqual(live.get(0), old);
      assert.deepEqual(index.anchor, { index: 0, offset: 0 });
    } finally {
      fail = false;
      f.close();
      scroll.dispose();
    }
    assert.equal(live.size, 0);
    assert.equal(cache.debugStats.children, 0);
  },
);

test(
  'actual paragraph pressure evicts the dormant State synchronously and preserves the held frame',
  { timeout },
  () => {
    const f = fixture(),
      scroll = new ScrollController(),
      registry = f.root.context.resources,
      budget = new TextLayoutBudget(registry),
      live = new Map();
    let frame,
      old,
      resource,
      retired = 0;
    const paragraph = (text) => ({
      text,
      width: 100,
      font: { id: 'font', generation: 1 },
      fontSize: 16,
      locale: 'en',
      direction: 'ltr',
      scale: 1,
    });
    class Item extends StatefulWidget {
      constructor(index) {
        super(new ValueKey(index));
        this.index = index;
      }
      createState() {
        return new ItemState();
      }
    }
    class ItemState extends State {
      initState() {
        super.initState();
        this.id = this.widget.index;
        live.set(this.id, this);
        if (this.id === 0) {
          this.layout = {
            resource: registry.allocateId('dormant-paragraph'),
            input: paragraph('x'.repeat(4096)),
          };
          budget.admit(this.layout.input);
          registry.register(
            { ...this.layout.resource, kind: 'paragraph' },
            () => retired++,
            budget.registration(this.layout),
          );
          for (let i = 1; i < 16; i++) registry.retainInitialProducer(this.layout.resource);
        }
      }
      build() {
        return new SizedBox(100, 80);
      }
      dispose() {
        if (this.layout)
          while (registry.initialProducerCount(this.layout.resource))
            registry.releaseProducer(this.layout.resource);
        assert(live.delete(this.id));
        super.dispose();
      }
    }
    try {
      f.set(
        new Directionality(
          'ltr',
          ListView.builder({
            controller: scroll,
            primary: false,
            itemExtent: 80,
            itemCount: 100,
            cacheExtent: 0,
            padding: EdgeInsets.zero,
            childPolicy: { mode: 'dormant', capacity: 8 },
            itemBuilder: (_context, index) => new Item(index),
          }),
        ),
      );
      old = live.get(0);
      resource = old.layout.resource;
      frame = registry.acquire([resource]);
      scroll.jumpTo(80);
      f.frame();
      assert.equal(old.context.active, false);
      budget.admit(paragraph('new'));
      assert.equal(old.mounted, false);
      assert.equal(f.root.buildOwner.maybeDormantChildren.debugStats.children, 0);
      assert.equal(registry.initialProducerCount(resource), 0);
      assert.equal(registry.retainedReferenceCount(resource), 1);
      assert.equal(registry.accountedTotals.residentUnits, 4096);
      assert.equal(retired, 0);
      frame.returnBy('caller');
      frame = undefined;
      assert.equal(retired, 1);
    } finally {
      frame?.returnBy('caller');
      f.close();
      scroll.dispose();
    }
    assert.equal(live.size, 0);
  },
);

test(
  'explicit keep-alive remains active and oversized atomic rows cannot enter dormant storage',
  { timeout },
  () => {
    for (const large of [false, true]) {
      const f = fixture(),
        scroll = new ScrollController();
      let first,
        disposed = false;
      class Wrapper extends StatelessWidget {
        constructor(child) {
          super();
          this.child = child;
        }
        build() {
          return this.child;
        }
      }
      class Item extends StatefulWidget {
        constructor(index) {
          super(new ValueKey(index));
          this.index = index;
        }
        createState() {
          return new ItemState();
        }
      }
      class ItemState extends State {
        keep = true;
        initState() {
          super.initState();
          if (this.widget.index === 0) first = this;
        }
        build() {
          if (this.widget.index !== 0) return new SizedBox(100, 80);
          if (!large) return new KeepAlive({ keepAlive: this.keep, child: new SizedBox(100, 80) });
          return new Column(
            Array.from({ length: 40 }, () => {
              let child = new SizedBox(1, 0);
              for (let i = 0; i < 110; i++) child = new Wrapper(child);
              return child;
            }),
          );
        }
        dispose() {
          if (this === first) disposed = true;
          super.dispose();
        }
      }
      try {
        f.set(
          new Directionality(
            'ltr',
            ListView.builder({
              controller: scroll,
              primary: false,
              itemExtent: 80,
              itemCount: 100,
              cacheExtent: 0,
              padding: EdgeInsets.zero,
              childPolicy: { mode: 'dormant', capacity: 8 },
              addAutomaticKeepAlives: false,
              addRepaintBoundaries: false,
              addSemanticIndexes: false,
              itemBuilder: (_context, index) => new Item(index),
            }),
          ),
        );
        scroll.jumpTo(80);
        f.frame();
        if (large) {
          assert.equal(disposed, true);
          assert.equal(f.root.buildOwner.maybeDormantChildren.debugStats.children, 0);
        } else {
          assert.equal(first.context.active, true);
          assert.equal(disposed, false);
          first.setState(() => (first.keep = false));
          f.frame();
          assert.equal(first.context.active, false);
          assert.equal(disposed, false);
          assert(f.root.buildOwner.maybeDormantChildren.debugStats.children > 0);
        }
      } finally {
        f.close();
        scroll.dispose();
      }
      assert.equal(disposed, true);
    }
    for (const capacity of [0, 33, 1.5, NaN])
      assert.throws(
        () =>
          ListView.builder({
            itemExtent: 80,
            childPolicy: { mode: 'dormant', capacity },
            itemBuilder: () => new SizedBox(1, 80),
          }),
        /capacity/i,
      );
  },
);
