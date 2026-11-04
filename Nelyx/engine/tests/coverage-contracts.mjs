// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  body,
  writeHandle,
} from '../../runtime/engine-client/index.ts';
export function coverageContracts({ using, timeout, h }) {
  const initial = () => [
    c.create(h(1), 'scrollViewport'),
    c.properties(h(1), { width: 300, height: 200, maximum: 1000 }),
    c.coverage(h(1), 1n, { minimum: 0, maximum: 60 }),
  ];
  const current = async (f, slot = 1) =>
    (await f.inspect()).nodes.find((n) => n.node.slot === slot);
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: coverage bounds deferred demand and drops it on reversal and gesture end`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start(initial());
          await f.input('begin');
          await f.input('update', 300);
          await f.tick();
          let n = await current(f);
          assert.equal(n.offset, 60);
          assert.equal(n.requestedOffset, 260);
          assert.equal(n.deferred, true);
          await f.input('update', 300);
          await f.tick();
          n = await current(f);
          assert.equal(n.requestedOffset, 260);
          assert.equal((await f.inspect()).coverageRequests, 1n);
          await f.input('update', -20);
          await f.tick();
          n = await current(f);
          assert.equal(n.offset, 40);
          assert.equal(n.requestedOffset, 40);
          assert.equal(n.deferred, false);
          await f.input('update', 300);
          await f.tick();
          await f.input('end', 0, { velocity: 800 });
          await f.tick();
          const end = await current(f);
          assert.equal(end.deferred, false);
          await f.commit([c.coverage(h(1), 2n, { minimum: 0, maximum: 800 })]);
          await f.ready();
          await f.tick();
          assert.equal((await current(f)).offset, end.offset);
          assert.equal((await current(f)).velocity, 0);
        }),
    );
    test(
      `${profile}: coverage arrival catches up only in the live gesture at a bounded speed`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start(initial());
          await f.input('begin');
          await f.input('update', 300);
          await f.tick();
          const before = (await current(f)).offset;
          await f.commit([c.coverage(h(1), 2n, { minimum: 0, maximum: 500 })]);
          await f.ready();
          let n = await current(f);
          assert.ok(n.offset > before);
          assert.ok(n.offset - before <= 40);
          assert.equal(n.requestedOffset, 260);
          const at = n.offset;
          await f.tick();
          n = await current(f);
          assert.ok(n.offset > at);
          assert.ok(n.offset - at <= 40);
          await f.input('cancel');
          await f.tick();
          const canceled = (await current(f)).offset;
          await f.tick();
          assert.equal((await current(f)).offset, canceled);
        }),
    );
    test(
      `${profile}: missing coverage never hands input to an ancestor or accumulates wheel debt`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'scrollViewport'),
            c.properties(h(1), { width: 300, height: 200, maximum: 1000 }),
            c.create(h(2), 'scrollViewport'),
            c.properties(h(2), { width: 300, height: 150, maximum: 500, chaining: true }),
            c.attach(h(2), h(1)),
            c.coverage(h(2), 1n, { minimum: 0, maximum: 50 }),
          ]);
          await f.input('update', 1000, { source: 'wheelUnknown', target: h(2) });
          await f.tick();
          assert.equal((await current(f, 2)).offset, 50);
          assert.equal((await current(f)).offset, 0);
          assert.equal((await current(f, 2)).deferred, false);
          assert.equal((await f.inspect()).coverageHandoffs, 0n);
          await f.commit([c.coverage(h(2), 2n, { minimum: 0, maximum: 500 })]);
          await f.ready();
          assert.equal((await current(f, 2)).offset, 50);
          await f.input('update', 1000, { source: 'wheelUnknown', target: h(2) });
          await f.tick();
          assert.equal((await current(f, 2)).offset, 500);
          assert.equal((await current(f)).offset, 550);
          assert.equal((await f.inspect()).coverageHandoffs, 1n);
        }),
    );
    test(
      `${profile}: unavailable programmatic destinations and invalid activation have explicit terminals`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start(initial());
          await f.send(
            p.opcodes.scroll,
            body(56, (v) => {
              writeHandle(v, 0, h(1));
              v.setFloat64(24, 400, true);
              v.setFloat64(40, 1, true);
            }),
            { id: 1n },
          );
          await f.tick();
          const events = (await f.send(p.opcodes.pollEvents)).events;
          assert.ok(
            events.some(
              (e) =>
                e.kind === p.events.scrollTerminal && e.status === p.statuses.contentUnavailable,
            ),
          );
          assert.ok(events.some((e) => e.kind === p.events.needChildren));
          assert.equal((await current(f)).offset, 0);
          await f.input('update', 50, { source: 'wheelUnknown' });
          await f.tick();
          const prior = await f.inspect();
          await f.commit([c.coverage(h(1), 2n, { minimum: 0, maximum: 10 })]);
          await f.step();
          await f.tick();
          let state = await f.inspect();
          assert.equal(state.activeDocument, prior.activeDocument);
          assert.equal(state.failedDocument, state.document);
          assert.equal((await current(f)).offset, 50);
          await f.commit([c.coverage(h(1), 3n, { minimum: 0, maximum: 600 })]);
          await f.ready();
          state = await f.inspect();
          assert.equal(state.activeDocument, state.document);
          const rejected = await f.commit([
            c.paint(h(1), 0xffff0000),
            c.coverage(h(1), 2n, { minimum: 0, maximum: 60 }),
          ]);
          assert.equal(rejected.status, p.statuses.stale);
          assert.equal((await current(f)).color, 0);
        }),
    );
  }
}
