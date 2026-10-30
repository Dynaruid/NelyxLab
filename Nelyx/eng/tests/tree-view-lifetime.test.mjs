// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { TreeView, TreeNode, TreeController } from '@nelyx/core/framework/widgets/tree-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { ValueKey } from '@nelyx/core/foundation/key';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { fixture } from '../../../packages/material/tests/root-fixture.mjs';
const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });

test(
  'public tree expansion and keyed reorder retain user State, refresh dependencies and retire stale row callbacks',
  { timeout },
  async () => {
    const f = fixture(),
      controller = new TreeController(),
      scroll = new ScrollController(),
      live = new Map(),
      details = new Map();
    let created = 0,
      disposed = 0;
    class Row extends StatefulWidget {
      constructor(value) {
        super(new ValueKey(value.node.id));
        this.details = value;
      }
      createState() {
        return new RowState();
      }
    }
    class RowState extends State {
      count = 0;
      initState() {
        super.initState();
        this.id = this.widget.details.node.id;
        assert(!live.has(this.id));
        live.set(this.id, this);
        created++;
      }
      build() {
        return new Semantics({
          container: true,
          transportId: 'tree-row-' + this.id,
          label: this.id + ':' + this.count + ':' + Directionality.of(this.context),
          child: new SizedBox(100, 32),
        });
      }
      dispose() {
        assert.equal(live.get(this.id), this);
        live.delete(this.id);
        disposed++;
        super.dispose();
      }
    }
    const childB = new TreeNode({ id: 'B', value: 'child B' }),
      childC = new TreeNode({ id: 'C', value: 'child C' }),
      rootA = new TreeNode({ id: 'A', value: 'root A', children: [childB, childC] }),
      rootD = new TreeNode({ id: 'D', value: 'root D' });
    const tree = (nodes, direction = 'ltr') =>
      new Directionality(
        direction,
        new TreeView({
          nodes,
          controller,
          scrollController: scroll,
          rowExtent: 32,
          cacheExtent: 0,
          rowBuilder: (_context, value) => {
            details.set(value.node.id, value);
            return new Row(value);
          },
        }),
      );
    try {
      f.set(tree([rootA, rootD]));
      assert.equal(controller.isAttached, true);
      assert.deepEqual([...live.keys()].sort(), ['A', 'D']);
      assert.equal(controller.visibleIndexOf('B'), null);
      const a = live.get('A'),
        d = live.get('D');
      a.setState(() => (a.count = 7));
      details.get('A').toggle();
      f.frame();
      assert.deepEqual([...live.keys()].sort(), ['A', 'B', 'C', 'D']);
      assert.equal(details.get('B').depth, 1);
      assert.equal(controller.visibleIndexOf('B'), 1);
      const b = live.get('B'),
        c = live.get('C'),
        stale = details.get('A').toggle;
      f.set(tree([rootD, rootA], 'rtl'));
      assert.equal(live.get('A'), a);
      assert.equal(live.get('D'), d);
      assert.equal(live.get('B'), b);
      assert.equal(live.get('C'), c);
      assert.equal(controller.visibleIndexOf('A'), 1);
      assert(f.root.nodes.some((node) => node.id === 'tree-row-A' && node.name === 'A:7:rtl'));
      stale();
      f.frame();
      assert.equal(
        controller.isExpanded('A'),
        true,
        'A callback from the previous tree revision must not toggle the new one',
      );
      details.get('A').toggle();
      f.frame();
      assert.deepEqual([...live.keys()].sort(), ['A', 'D']);
      assert.equal(live.get('A'), a);
      assert.equal(controller.visibleIndexOf('B'), null);
      details.get('A').toggle();
      f.frame();
      assert.equal(live.get('A'), a);
      assert.notEqual(live.get('B'), b);
      assert.equal(controller.visibleIndexOf('B'), 2);
      const reveal = controller.reveal('B');
      f.frame();
      assert.deepEqual(await reveal, { status: 'completed' });
      const afterClose = details.get('A').toggle;
      f.set(new SizedBox(1, 1));
      assert.equal(controller.isAttached, false);
      afterClose();
      f.frame();
      assert.equal(live.size, 0);
      assert.equal(created, disposed);
    } finally {
      f.close();
      controller.dispose();
      scroll.dispose();
    }
  },
);
