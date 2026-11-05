// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  EngineClient,
  WidgetHost,
  ListView,
  ListViewState,
  GlobalKey,
  Box,
} from '../../runtime/engine-client/index.ts';
export function listContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: native lazy windows preserve a visible key through variable-height anchor changes`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'scrollViewport'),
            c.properties(h(1), { width: 200, height: 100 }),
            c.layout(h(1)),
            c.create(h(2), 'sliver'),
            c.layout(h(2), { direction: 'vertical' }),
            c.list(h(2), { generation: 1n, count: 100, begin: 0, end: 4, estimate: 50 }),
            c.attach(h(2), h(1)),
            ...[40, 60, 50, 70].flatMap((height, i) => [
              c.create(h(3 + i), 'box'),
              c.properties(h(3 + i), { width: 200, height }),
              c.layout(h(3 + i)),
              c.listItem(h(3 + i), { index: i, key: BigInt(i + 1) }),
              c.attach(h(3 + i), h(2), i),
            ]),
          ]);
          let snapshot = await f.send(p.opcodes.layoutSnapshot),
            list = snapshot.nodes.find((n) => n.node.slot === 2).list;
          assert.equal(list.total, 5020);
          assert.equal(list.items[2].offset, 100);
          await f.input('update', 100, { source: 'wheelUnknown' });
          await f.tick();
          await f.present();
          await f.commit([
            c.detach(h(3)),
            c.destroy(h(3)),
            c.create(h(7), 'box'),
            c.properties(h(7), { width: 200, height: 80 }),
            c.layout(h(7)),
            c.listItem(h(7), { index: 4, key: 5n }),
            c.attach(h(7), h(2), 3),
            c.properties(h(4), { width: 200, height: 90 }),
            c.list(h(2), { generation: 1n, count: 100, begin: 1, end: 5, estimate: 50 }),
          ]);
          await f.input('update', 10, { source: 'wheelUnknown' });
          await f.tick();
          await f.ready();
          snapshot = await f.send(p.opcodes.layoutSnapshot);
          assert.equal(snapshot.nodes.find((n) => n.node.slot === 1).offset, 140);
          list = snapshot.nodes.find((n) => n.node.slot === 2).list;
          assert.equal(
            list.items.find((r) => r.key === 3n).offset - 140,
            -10,
            'The anchor includes input received during preparation',
          );
          assert.ok(list.demandEnd > 5);
          await f.commit([c.paint(h(4), 0xff123456)]);
          await f.ready();
          assert.equal(
            (await f.inspect()).nodes.find((n) => n.node.slot === 1).offset,
            140,
            'An anchor correction applies once',
          );
          const accepted = (await f.inspect()).activeDocument;
          await f.input('update', -10, { source: 'wheelUnknown' });
          await f.tick();
          await f.present();
          await f.commit([c.properties(h(4), { width: 200, height: 100 })]);
          await f.ready();
          assert.equal(
            (await f.inspect()).nodes.find((n) => n.node.slot === 1).offset,
            140,
            'At an exact row boundary, the visible row anchors instead of the row above',
          );
          const beforeFailure = (await f.inspect()).activeDocument;
          await f.commit([
            c.list(h(2), { generation: 1n, count: 100, begin: 1, end: 8, estimate: 50 }),
          ]);
          for (let i = 0; i < 10; ++i) await f.step();
          await f.tick();
          assert.ok(beforeFailure > accepted);
          assert.equal((await f.inspect()).activeDocument, beforeFailure);
          assert.equal((await f.inspect()).failedDocument, f.epoch);
        }),
    );
    test(
      `${profile}: deleting the anchor uses a surviving key and an empty list resets coverage`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'scrollViewport'),
            c.properties(h(1), { width: 200, height: 100 }),
            c.layout(h(1)),
            c.create(h(2), 'sliver'),
            c.layout(h(2), { direction: 'vertical' }),
            c.list(h(2), { generation: 1n, count: 100, begin: 0, end: 4, estimate: 50 }),
            c.attach(h(2), h(1)),
            ...[0, 1, 2, 3].flatMap((i) => [
              c.create(h(i + 3), 'box'),
              c.properties(h(i + 3), { width: 200, height: 50 }),
              c.layout(h(i + 3)),
              c.listItem(h(i + 3), { index: i, key: BigInt(i + 1) }),
              c.attach(h(i + 3), h(2), i),
            ]),
          ]);
          await f.input('update', 75, { source: 'wheelUnknown' });
          await f.tick();
          await f.present();
          await f.commit([
            c.detach(h(4)),
            c.destroy(h(4)),
            c.listItem(h(5), { index: 1, key: 3n }),
            c.listItem(h(6), { index: 2, key: 4n }),
            c.list(h(2), { generation: 2n, count: 99, begin: 0, end: 3, estimate: 50 }),
          ]);
          await f.ready();
          assert.equal(
            (await f.inspect()).nodes.find((n) => n.node.slot === 1).offset,
            25,
            'A surviving row keeps its screen position',
          );
          await f.commit([
            c.listItem(h(3), { index: 0, key: 100n }),
            c.listItem(h(5), { index: 1, key: 101n }),
            c.listItem(h(6), { index: 2, key: 102n }),
            c.list(h(2), { generation: 3n, count: 99, begin: 0, end: 3, estimate: 50 }),
          ]);
          await f.ready();
          assert.equal(
            (await f.inspect()).nodes.find((n) => n.node.slot === 1).offset,
            25,
            'Replacing all keys has a bounded index fallback',
          );
          await f.commit([
            ...[3, 5, 6].flatMap((i) => [c.detach(h(i)), c.destroy(h(i))]),
            c.list(h(2), { generation: 4n, count: 0, begin: 0, end: 0, estimate: 50 }),
          ]);
          await f.ready();
          assert.equal((await f.inspect()).nodes.find((n) => n.node.slot === 1).offset, 0);
        }),
    );
    test(
      `${profile}: the real lazy Widget builder is bounded and closes aborted work`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            key = new GlobalKey();
          const built = [];
          const host = new WidgetHost(view, { pollEvents: false });
          await f.resize(200, 100);
          await host.mount(
            new ListView(
              {
                generation: 1n,
                itemCount: 10000,
                estimatedExtent: 40,
                cacheItems: 24,
                itemKey: (i) => `item-${i}`,
                itemBuilder: (i) => {
                  built.push(i);
                  return new Box([], { properties: { height: 40 + (i % 3) * 5, width: 200 } });
                },
              },
              { key, properties: { width: 200, height: 100 } },
            ),
          );
          await f.ready();
          await f.present();
          assert.ok(key.currentState instanceof ListViewState);
          assert.ok(built.length < 25);
          assert.ok(Math.max(...built) < 25);
          for (let i = 0; i < 4; ++i) {
            await f.input('update', 150, { source: 'wheelUnknown', target: h(0, 0), x: 50, y: 50 });
            await f.tick();
            if ((await f.inspect()).holds < 2) await f.present();
            await host.pollEvents();
            await host.flush();
            const current = await f.inspect();
            if (current.document > current.activeDocument) await f.ready();
          }
          assert.ok(key.currentState.counters.built > 8);
          assert.ok(key.currentState.counters.peakItems <= 24);
          assert.ok((await f.inspect()).nodeCount < 80);
          await host.close();
          await client.close();
        }),
    );
    test(
      `${profile}: lazy generation changes abort async work and reject late results`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            key = new GlobalKey();
          const host = new WidgetHost(view, { pollEvents: false }),
            pending = [];
          const make = (generation) =>
            new ListView(
              {
                generation,
                itemCount: 100,
                estimatedExtent: 40,
                cacheItems: 12,
                itemKey: (i) => i,
                placeholder: () => new Box([], { properties: { height: 40 } }),
                itemBuilder: (i, signal) =>
                  new Promise((resolve) => pending.push({ generation, i, signal, resolve })),
              },
              { key, properties: { width: 200, height: 100 } },
            );
          await f.resize(200, 100);
          await host.mount(make(1n));
          await f.ready();
          await f.present();
          assert.equal(pending.length, 4, 'At most four async builders execute');
          await host.update(make(2n));
          await new Promise((resolve) => setTimeout(resolve, 0));
          assert.ok(pending.filter((p) => p.generation === 1n).every((p) => p.signal.aborted));
          for (const p of pending.filter((p) => p.generation === 1n))
            p.resolve(new Box([], { properties: { height: 999 } }));
          await new Promise((resolve) => setTimeout(resolve, 0));
          const second = pending.filter((p) => p.generation === 2n);
          assert.equal(second.length, 4);
          for (const p of second) p.resolve(new Box([], { properties: { height: 40 } }));
          await new Promise((resolve) => setTimeout(resolve, 0));
          await host.flush();
          await f.ready();
          const snapshot = await view.layoutSnapshot();
          assert.equal(snapshot.nodes.find((n) => n.list).list.generation, 2n);
          assert.ok(snapshot.nodes.find((n) => n.list).list.items.every((i) => i.extent === 40));
          await host.close();
          assert.ok(pending.every((p) => p.signal.aborted));
          await client.close();
        }),
    );
  }
}
