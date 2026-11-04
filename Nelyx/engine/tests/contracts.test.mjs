// SPDX-License-Identifier: BSD-3-Clause
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildProfiles, timeout, run } from '../tools/build.mjs';
import { nativeTransport, wasmFactory } from './transports.mjs';
import {
  protocol as p,
  packet,
  body,
  transaction,
  commands as c,
  inputBody,
  response,
  writeHandle,
  EngineClient,
  EngineError,
  resolveEngineV2,
} from '../../runtime/engine-client/index.ts';
import { FrictionSimulation } from '../../src/framework/physics/friction-simulation.ts';

const parent = fs.realpathSync(os.tmpdir());
let directory;
const factories = new Map();
before(
  async () => {
    directory = fs.mkdtempSync(path.join(parent, 'nelyx-engine-v2-'));
    buildProfiles(directory);
    factories.set('native', () => nativeTransport(path.join(directory, 'native')));
    for (const profile of ['single-worker', 'threaded']) {
      const factory = await wasmFactory(path.join(directory, profile));
      factories.set(profile, factory.create);
      factories.set(profile + ':module', factory.module);
    }
  },
  { timeout },
);
after(
  () => {
    if (!directory) return;
    const target = fs.realpathSync(directory);
    assert.equal(path.dirname(target), parent);
    assert.match(path.basename(target), /^nelyx-engine-v2-/);
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
  },
  { timeout },
);
const h = (slot, generation = 1) => ({ slot, generation });
const globalOwner = { session: 1, app: 1, view: 0, generation: 0 };
const owner = { ...globalOwner, view: 1, generation: 1 };
function fixture(transport) {
  let id = 0n,
    epoch = 0n,
    sequence = 0n,
    time = 0,
    metrics = 2n;
  const send = async (opcode, data, options = {}) => {
    const bytes = packet(opcode, options.owner ?? owner, data, options.id ?? 0n);
    return response(await transport.exchange(bytes));
  };
  const commit = async (changes, options = {}) => {
    const bytes = transaction(
      options.owner ?? owner,
      options.id ?? ++id,
      options.base ?? epoch,
      changes,
    );
    const result = response(await transport.exchange(bytes));
    if (result.status === p.statuses.accepted && !options.owner) epoch = result.resultEpoch;
    return { ...result, bytes };
  };
  const step = () =>
    send(
      p.opcodes.contentStep,
      body(8, (v) => v.setUint32(0, p.limits.contentPerStep, true)),
    );
  const tick = (at = (time += 0.01)) => {
    time = at;
    return send(
      p.opcodes.tick,
      body(8, (v) => v.setFloat64(0, at, true)),
    );
  };
  const ready = async () => {
    let state;
    for (let i = 0; i < 20; ++i) {
      state = await step();
      if (state.preparationReady) break;
    }
    assert.equal(state.preparationReady, true, 'Bounded content preparation completes');
    return tick();
  };
  const present = async () => {
    const frame = await send(p.opcodes.takeFrame);
    assert.equal(frame.status, p.statuses.ok);
    await send(
      p.opcodes.releaseFrame,
      body(24, (v) => {
        v.setBigUint64(0, frame.submission, true);
        v.setBigUint64(8, frame.device, true);
      }),
    );
    const publication = await send(
      p.opcodes.publish,
      body(24, (v) => {
        v.setBigUint64(0, frame.submission, true);
        v.setBigUint64(8, frame.device, true);
      }),
    );
    assert.equal(publication.status, p.statuses.ok);
    assert.equal(
      publication.surfaceCommit,
      null,
      'A fake renderer never claims display/GPU completion',
    );
    return frame;
  };
  const input = (phase, dy = 0, options = {}) =>
    send(
      p.opcodes.input,
      inputBody({
        sequence: ++sequence,
        metrics,
        target: h(1),
        stream: 1,
        phase,
        source: 'engineDriven',
        time,
        dy,
        ...options,
      }),
    );
  const resize = async (width, height) => {
    const state = await send(p.opcodes.inspect);
    ++metrics;
    return send(
      p.opcodes.metrics,
      body(40, (v) => {
        v.setBigUint64(0, metrics, true);
        v.setFloat64(8, width, true);
        v.setFloat64(16, height, true);
        v.setFloat64(24, 1, true);
        v.setBigUint64(32, state.lastInput, true);
      }),
    );
  };
  const start = async (
    changes = [
      c.create(h(1), 'scrollViewport'),
      c.properties(h(1), {
        width: 300,
        height: 200,
        maximum: 100000,
      }),
    ],
  ) => {
    assert.equal((await send(p.opcodes.openView)).status, p.statuses.ok);
    await resize(300, 200);
    assert.equal((await commit(changes)).status, p.statuses.accepted);
    await ready();
    await present();
  };
  return {
    send,
    commit,
    step,
    tick,
    ready,
    present,
    input,
    resize,
    start,
    inspect: () => send(p.opcodes.inspect),
    get epoch() {
      return epoch;
    },
    get sequence() {
      return sequence;
    },
  };
}
async function using(profile, work) {
  const transport = factories.get(profile)();
  try {
    await work(fixture(transport), transport);
  } finally {
    await transport.close();
  }
}
function accounting(state) {
  assert.equal(
    state.received,
    state.consumed + state.canceled + state.rejected + BigInt(state.queued),
  );
  assert.ok(state.queued <= p.limits.inputPackets);
  assert.ok(state.holds <= p.limits.frames);
}
for (const profile of ['native', 'single-worker', 'threaded']) {
  test(
    `${profile}: ABI, generations, malformed packets, optional extension and uint64 IDs`,
    { timeout },
    () =>
      using(profile, async (f, transport) => {
        const hello = await f.send(
          p.opcodes.hello,
          body(8, (v) => v.setUint32(0, 15, true)),
          { owner: globalOwner },
        );
        assert.equal(hello.status, p.statuses.ok);
        assert.equal(hello.sharedMemory, profile === 'threaded');
        assert.equal(hello.contentIndependent, false);
        const missing = await f.send(
          p.opcodes.hello,
          body(8, (v) => v.setUint32(0, 1 << 20, true)),
          { owner: globalOwner },
        );
        assert.equal(missing.status, p.statuses.capabilityMissing);
        const valid = packet(p.opcodes.openView, owner);
        for (const mutate of [
          (v) => v.setUint16(4, 3, true),
          (v) => v.setUint32(8, 0, true),
          (v) => v.setUint32(16, 63, true),
          (v) => v.setUint32(36, 1, true),
        ]) {
          const bytes = valid.slice();
          mutate(new DataView(bytes.buffer));
          assert.notEqual(response(await transport.exchange(bytes)).status, p.statuses.ok);
        }
        assert.equal(
          response(await transport.exchange(new Uint8Array(3))).status,
          p.statuses.malformed,
        );
        assert.equal((await f.send(p.opcodes.openView)).status, p.statuses.ok);
        const large = 9_007_199_254_740_993n;
        const result = await f.commit([c.create(h(1), 'box')], { id: large });
        assert.equal(result.status, p.statuses.accepted);
        assert.equal(result.id, large);
        const optional = body(16, (v) => {
          v.setUint16(0, 500, true);
          v.setUint16(2, 1, true);
          v.setUint32(4, 16, true);
        });
        assert.equal((await f.commit([optional], { id: large + 1n })).status, p.statuses.accepted);
        new DataView(optional.buffer).setUint16(2, 0, true);
        assert.equal(
          (await f.commit([optional], { id: large + 2n })).status,
          p.statuses.incompatible,
        );
        assert.equal(
          (await f.send(p.opcodes.inspect, undefined, { owner: { ...owner, app: 2 } })).status,
          p.statuses.staleGeneration,
        );
      }),
  );
  test(`${profile}: final-graph validation and resource rollback are atomic`, { timeout }, () =>
    using(profile, async (f) => {
      await f.start([c.create(h(1), 'stack'), c.create(h(2), 'stack'), c.attach(h(2), h(1))]);
      const before = await f.inspect();
      const cycle = await f.commit([
        c.acquireResource(h(1), new Uint8Array(1024)),
        c.bindResource(h(1), h(1)),
        c.attach(h(1), h(2)),
      ]);
      assert.equal(cycle.status, p.statuses.invalidGraph);
      assert.equal(cycle.document, before.document);
      assert.equal(cycle.resourceBytes, 0n);
      assert.equal(cycle.nodeBlocks, before.nodeBlocks);
      assert.equal(
        (await f.commit([c.detach(h(2)), c.destroy(h(2)), c.create(h(2), 'box')])).status,
        p.statuses.invalidHandle,
      );
      assert.equal((await f.commit([c.move(h(2), h(1))])).status, p.statuses.accepted);
      const nodes = [];
      for (let i = 3; i <= p.limits.depth + 4; ++i) {
        nodes.push(c.create(h(i), 'stack'));
        if (i > 3) nodes.push(c.attach(h(i), h(i - 1)));
      }
      assert.equal((await f.commit(nodes)).status, p.statuses.invalidGraph);
      assert.equal((await f.inspect()).nodeCount, 2);
    }),
  );
  test(
    `${profile}: ACK loss retries, reused IDs and bounded expired result window`,
    { timeout },
    () =>
      using(profile, async (f, transport) => {
        await f.start();
        const accepted = await f.commit([
          c.properties(h(1), { width: 300, height: 200, maximum: 100000 }),
        ]);
        const duplicate = response(await transport.exchange(accepted.bytes));
        assert.equal(duplicate.resultEpoch, accepted.resultEpoch);
        assert.equal(duplicate.document, accepted.document);
        const changed = accepted.bytes.slice();
        new DataView(changed.buffer).setFloat64(p.headerBytes + 16, 10, true);
        assert.equal(response(await transport.exchange(changed)).status, p.statuses.idReused);
        assert.equal(
          (await f.send(p.opcodes.queryResult, undefined, { id: accepted.id })).status,
          p.statuses.accepted,
        );
        await f.send(p.opcodes.acknowledge, undefined, { id: accepted.id });
        assert.equal(
          response(await transport.exchange(accepted.bytes)).status,
          p.statuses.resultExpired,
        );
        const big1 = await f.commit([c.acquireResource(h(1), new Uint8Array(600000))]);
        const big2 = await f.commit([
          c.releaseResource(h(1)),
          c.acquireResource(h(1, 2), new Uint8Array(600000)),
        ]);
        assert.equal(big2.status, p.statuses.accepted);
        assert.equal(
          (await f.send(p.opcodes.queryResult, undefined, { id: big1.id })).status,
          p.statuses.resultExpired,
        );
        assert.ok(big2.reservedBytes <= BigInt(p.limits.sessionBytes));
      }),
  );
  test(`${profile}: preparation freezes its document through continuous commits`, { timeout }, () =>
    using(profile, async (f) => {
      await f.start();
      const changes = [];
      for (let i = 2; i <= 140; ++i) changes.push(c.create(h(i), 'box'));
      const first = await f.commit(changes);
      const attempt = await f.step();
      assert.equal(attempt.preparationReady, false);
      await f.commit([c.properties(h(1), { maximum: 100000 })]);
      const latest = await f.commit([c.properties(h(1), { maximum: 100000 })]);
      const intermediate = await f.ready();
      assert.equal(intermediate.activeDocument, first.document);
      assert.equal(intermediate.document, latest.document);
      const final = await f.ready();
      assert.equal(final.activeDocument, latest.document);
      const events = await f.send(p.opcodes.pollEvents);
      assert.ok(events.events.some((e) => e.kind === p.events.skipped));
      assert.ok(
        events.events.some((e) => e.kind === p.events.activated && e.epoch === first.document),
      );
    }),
  );
  test(
    `${profile}: accepted failure, same-document metrics retry and late attempt result`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start();
        const accepted = await f.commit([c.properties(h(1), { maximum: 100000 })]);
        const attempt = await f.step();
        const failure = await f.send(
          p.opcodes.preparationResult,
          body(24, (v) => {
            v.setBigUint64(0, attempt.preparation, true);
            v.setBigUint64(8, attempt.metrics, true);
            v.setBigUint64(16, attempt.device, true);
          }),
        );
        assert.equal(failure.document, accepted.document);
        assert.ok(failure.activeDocument < failure.document);
        assert.equal((await f.commit([])).status, p.statuses.accepted);
        await f.ready();
        const before = await f.inspect();
        await f.resize(400, 250);
        const old = await f.step();
        await f.resize(420, 260);
        const current = await f.step();
        assert.notEqual(old.preparation, current.preparation);
        const late = await f.send(
          p.opcodes.preparationResult,
          body(24, (v) => {
            v.setBigUint64(0, old.preparation, true);
            v.setBigUint64(8, old.metrics, true);
            v.setBigUint64(16, old.device, true);
          }),
        );
        assert.equal(late.status, p.statuses.stale);
        assert.equal(late.preparation, current.preparation);
        const after = await f.ready();
        assert.equal(after.document, before.document);
        assert.equal(after.activeDocument, before.document);
      }),
  );
  test(
    `${profile}: 256-slot ingress, reserved boundaries, overflow and focus accounting`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start();
        await f.input('begin');
        for (let i = 0; i < p.limits.inputUpdates; ++i) await f.input('update', 1);
        for (let i = 0; i < 31; ++i) await f.input('end');
        assert.equal((await f.inspect()).queued, 256);
        const overflow = await f.input('update', 1);
        accounting(overflow);
        assert.ok(overflow.rejected > 0n);
        assert.ok(overflow.canceled > 0n);
        const state = await f.inspect();
        await f.send(
          p.opcodes.visibility,
          body(16, (v) => {
            v.setUint32(0, 1, true);
            v.setBigUint64(8, state.lastInput, true);
          }),
        );
        const drained = await f.tick();
        accounting(drained);
        assert.equal(drained.queued, 0);
        assert.equal(drained.consumed, 0n);
      }),
  );
  test(
    `${profile}: continuous producers and commits progress while renderer is busy`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start();
        await f.input('begin');
        for (let leg = 0; leg < 8; ++leg) {
          for (let i = 0; i < 40; ++i) await f.input('update', 1);
          await f.commit([c.properties(h(1), { maximum: 100000 })]);
          await f.step();
          const state = await f.tick();
          accounting(state);
          assert.ok(state.queued > 0);
          assert.ok(state.consumed > BigInt(leg * 30));
          const frame = await f.send(p.opcodes.takeFrame);
          assert.equal(frame.status, leg < 2 ? p.statuses.ok : p.statuses.busy);
        }
        const busy = await f.inspect();
        assert.equal(busy.holds, 2);
        assert.ok(busy.activated >= 9n);
        const release = await f.send(
          p.opcodes.releaseFrame,
          body(24, (v) => {
            v.setBigUint64(0, 2n, true);
            v.setBigUint64(8, busy.device, true);
          }),
        );
        assert.equal(release.pendingPublication, 2n);
        await f.send(
          p.opcodes.publish,
          body(24, (v) => {
            v.setBigUint64(0, 2n, true);
            v.setBigUint64(8, busy.device, true);
          }),
        );
        const latest = await f.send(p.opcodes.takeFrame);
        assert.equal(latest.status, p.statuses.ok);
        assert.equal(latest.nodes[0].offset, Number(latest.consumed - 1n));
      }),
  );
  test(
    `${profile}: scene activation preserves scroll and skipped-epoch commands terminate`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start();
        await f.input('begin');
        await f.input('update', 40);
        await f.tick();
        await f.commit([c.properties(h(1), { maximum: 100000 })]);
        await f.step();
        await f.input('update', 80);
        await f.tick();
        assert.equal((await f.inspect()).nodes[0].offset, 120);
        await f.input('end');
        await f.tick();
        const first = await f.commit([]);
        await f.commit([]);
        const command = body(56, (v) => {
          writeHandle(v, 0, h(1));
          v.setBigUint64(8, first.document, true);
          v.setBigUint64(16, 2n, true);
          v.setFloat64(24, 250, true);
          v.setFloat64(40, 2, true);
        });
        assert.equal(
          (await f.send(p.opcodes.scroll, command, { id: 1n })).status,
          p.statuses.pending,
        );
        await f.ready();
        assert.equal((await f.inspect()).nodes[0].offset, 250);
        assert.ok(
          (await f.send(p.opcodes.pollEvents)).events.some(
            (e) => e.kind === p.events.scrollTerminal && e.status === p.statuses.ok,
          ),
        );
        await f.input('begin');
        await f.tick();
        await f.send(p.opcodes.scroll, command, { id: 2n });
        assert.ok(
          (await f.send(p.opcodes.pollEvents)).events.some(
            (e) => e.id === 2n && e.status === p.statuses.busy,
          ),
        );
      }),
  );
  test(
    `${profile}: engine-driven friction matches framework; OS/wheel momentum is not doubled`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start();
        await f.input('begin');
        await f.input('update', 1000);
        await f.tick(1);
        await f.input('end', 0, { velocity: 500 });
        await f.tick(1);
        const reference = new FrictionSimulation(0.135, 1000, 500);
        for (const seconds of [0.01, 0.05, 0.1, 0.2]) {
          await f.tick(1 + seconds);
          const node = (await f.inspect()).nodes[0];
          assert.ok(Math.abs(node.offset - reference.x(seconds)) < 1e-8);
          assert.ok(Math.abs(node.velocity - reference.dx(seconds)) < 1e-8);
        }
        for (const source of ['osResolved', 'wheelUnknown']) {
          await f.input('update', 10, { source, velocity: 900 });
          await f.tick();
          const before = (await f.inspect()).nodes[0].offset;
          await f.tick();
          assert.equal((await f.inspect()).nodes[0].offset, before);
        }
      }),
  );
  test(
    `${profile}: resource leases survive scene/frame retirement and drain on close`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start([
          c.acquireResource(h(1), new Uint8Array(10000)),
          c.create(h(1), 'image'),
          c.bindResource(h(1), h(1)),
        ]);
        const retained = await f.commit([c.bindResource(h(1), null), c.releaseResource(h(1))]);
        assert.ok(retained.resourceBytes > 0n);
        await f.ready();
        assert.ok(
          (await f.inspect()).resourceBytes > 0n,
          'Published front still owns its resource',
        );
        await f.present();
        assert.equal((await f.inspect()).resourceBytes, 0n);
        const closed = await f.send(p.opcodes.closeSession, undefined, { owner: globalOwner });
        assert.equal(closed.reservedBytes, 0n);
        assert.equal(closed.nodeBlocks, 0n);
      }),
  );
  test(
    `${profile}: hidden/zero-size restore, independent view close and stale device credit`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start();
        await f.send(p.opcodes.openView, undefined, { owner: { ...owner, view: 2 } });
        await f.resize(0, 0);
        assert.equal((await f.send(p.opcodes.takeFrame)).status, p.statuses.contentUnavailable);
        const zero = await f.tick();
        assert.equal(zero.wake, false);
        await f.resize(300, 200);
        await f.ready();
        await f.present();
        const frame = await f.send(
          p.opcodes.visibility,
          body(16, (v) => {
            v.setUint32(0, 7, true);
            v.setBigUint64(8, 0n, true);
          }),
        );
        assert.equal(frame.status, p.statuses.ok);
        const taken = await f.send(p.opcodes.takeFrame);
        await f.send(
          p.opcodes.device,
          body(16, (v) => {
            v.setBigUint64(0, 2n, true);
          }),
        );
        const late = await f.send(
          p.opcodes.releaseFrame,
          body(24, (v) => {
            v.setBigUint64(0, taken.submission, true);
            v.setBigUint64(8, 1n, true);
          }),
        );
        assert.equal(late.status, p.statuses.stale);
        assert.equal(late.holds, 0);
        await f.send(p.opcodes.closeView);
        assert.equal((await f.inspect()).closed, true);
        assert.equal(
          (await f.send(p.opcodes.inspect, undefined, { owner: { ...owner, view: 2 } })).closed,
          false,
        );
        assert.equal((await f.send(p.opcodes.openView)).status, p.statuses.staleGeneration);
        assert.equal(
          (await f.send(p.opcodes.openView, undefined, { owner: { ...owner, generation: 2 } }))
            .status,
          p.statuses.ok,
        );
      }),
  );
  test(
    `${profile}: TS client ACK timeout, identical retry, NACK base and close waiters`,
    { timeout },
    () =>
      using(profile, async (_, transport) => {
        let drop = true;
        const port = {
          async exchange(bytes) {
            const result = await transport.exchange(bytes);
            if (
              new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(12, true) ===
                p.opcodes.transaction &&
              drop
            ) {
              drop = false;
              throw new EngineError(p.statuses.timedOut, 'Lost ACK');
            }
            return result;
          },
          close: () => transport.close(),
        };
        const client = await EngineClient.connect(port);
        const view = await client.openView(1);
        await assert.rejects(view.commit([c.create(h(1), 'box')]), /Lost ACK/);
        assert.equal(view.hasPendingTransaction, true);
        const accepted = await view.retryCommit();
        assert.equal(accepted.document, 1n);
        await assert.rejects(
          view.commit([c.create(h(1), 'box')]),
          (error) => error.status === p.statuses.invalidHandle,
        );
        assert.equal(view.documentEpoch, 1n);
        await view.commit([]);
        assert.equal(view.documentEpoch, 2n);
        const waiting = assert.rejects(
          view.awaitActivated(2n),
          (error) => error.status === p.statuses.closed,
        );
        await view.close();
        await waiting;
        await client.close();
      }),
  );
}
for (const profile of ['native', 'single-worker', 'threaded']) {
  test(
    `${profile}: motion terminal once, scene defaults, pause/resume and forced redraw`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start([
          c.create(h(1), 'box'),
          c.properties(h(1), { opacity: 1 }),
          c.motion(h(1), 1n, 0n, 0.2, 0.1),
        ]);
        await f.tick(0.06);
        assert.ok(Math.abs((await f.inspect()).nodes[0].opacity - 0.6) < 1e-9);
        await f.commit([c.properties(h(1), { opacity: 0.9 })]);
        await f.ready();
        const mid = (await f.inspect()).nodes[0].opacity;
        assert.ok(mid < 0.6 && mid > 0.2);
        const visibility = (flags) =>
          f.send(
            p.opcodes.visibility,
            body(16, (v) => v.setUint32(0, flags, true)),
          );
        await visibility(2);
        await f.tick(5);
        await visibility(3);
        await f.ready();
        assert.equal((await f.inspect()).nodes[0].opacity, mid);
        await f.tick(5.2);
        await f.present();
        assert.ok(Math.abs((await f.inspect()).nodes[0].opacity - 0.2) < 1e-9);
        assert.equal((await f.inspect()).wake, false);
        await f.tick(5.3);
        assert.equal((await f.send(p.opcodes.takeFrame)).status, p.statuses.notFound);
        await visibility(7);
        await f.present();
        await f.commit([c.motion(h(1), 2n, 0n, 0.8, 0.1)]);
        await f.ready();
        await f.resize(310, 210);
        await f.ready();
        const events = (await f.send(p.opcodes.pollEvents)).events.filter(
          (e) => e.kind === p.events.motionTerminal,
        );
        assert.equal(events.filter((e) => e.id === 1n).length, 1);
        assert.equal(events.filter((e) => e.id === 2n && e.status === p.statuses.stale).length, 1);
        assert.equal(
          (await f.commit([c.motion(h(1), 2n, 0n, 0.3, 0.1)])).status,
          p.statuses.idReused,
        );
      }),
  );
  test(
    `${profile}: reverse frame completion keeps publication monotonic and retirement idempotent`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start();
        const force = () =>
          f.send(
            p.opcodes.visibility,
            body(16, (v) => v.setUint32(0, 7, true)),
          );
        await force();
        const older = await f.send(p.opcodes.takeFrame);
        await force();
        const newer = await f.send(p.opcodes.takeFrame);
        const release = (frame) =>
          f.send(
            p.opcodes.releaseFrame,
            body(24, (v) => {
              v.setBigUint64(0, frame.submission, true);
              v.setBigUint64(8, frame.device, true);
            }),
          );
        assert.equal((await release(newer)).pendingPublication, newer.submission);
        assert.equal((await release(older)).pendingPublication, newer.submission);
        assert.equal((await release(older)).status, p.statuses.stale);
        assert.equal((await f.inspect()).holds, 1);
        await f.send(
          p.opcodes.publish,
          body(24, (v) => {
            v.setBigUint64(0, newer.submission, true);
            v.setBigUint64(8, newer.device, true);
          }),
        );
        assert.equal((await f.inspect()).holds, 0);
        assert.equal((await f.inspect()).publication, newer.submission);
      }),
  );
  test(
    `${profile}: multi-view ingress shares one budget and closes without stranded packets`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start();
        const other = { ...owner, view: 2 };
        await f.send(p.opcodes.openView, undefined, { owner: other });
        await f.send(
          p.opcodes.metrics,
          body(40, (v) => {
            v.setBigUint64(0, 3n, true);
            v.setFloat64(8, 300, true);
            v.setFloat64(16, 200, true);
            v.setFloat64(24, 1, true);
          }),
          { owner: other },
        );
        await f.input('begin');
        for (let i = 0; i < p.limits.inputUpdates / 2; ++i) await f.input('update', 1);
        const otherInput = (sequence, phase) =>
          f.send(
            p.opcodes.input,
            inputBody({
              sequence,
              metrics: 3n,
              target: h(1),
              stream: 1,
              phase,
              source: 'engineDriven',
              time: 0,
              dy: 1,
            }),
            { owner: other },
          );
        await otherInput(1n, 'begin');
        for (let i = 0; i < p.limits.inputUpdates / 2; ++i)
          await otherInput(BigInt(i + 2), 'update');
        const full = await f.inspect();
        assert.equal(full.sessionUpdates, p.limits.inputUpdates);
        assert.equal(full.sessionQueued, p.limits.inputUpdates + 2);
        const rejected = await f.input('update', 1);
        assert.ok(rejected.rejected > 0n);
        accounting(rejected);
        const live = await f.send(p.opcodes.inspect, undefined, { owner: other });
        assert.equal(live.queued, p.limits.inputUpdates / 2 + 1);
        await f.send(p.opcodes.closeView);
        await f.send(p.opcodes.closeView, undefined, { owner: other });
        assert.equal(
          (await f.send(p.opcodes.inspect, undefined, { owner: globalOwner })).sessionQueued,
          0,
        );
      }),
  );
  test(
    `${profile}: pending command replacement, deletion and activation timeout have terminals`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start();
        const data = body(56, (v) => {
          writeHandle(v, 0, h(1));
          v.setBigUint64(8, 100n, true);
          v.setFloat64(24, 100, true);
          v.setFloat64(40, 0.1, true);
        });
        await f.send(p.opcodes.scroll, data, { id: 1n });
        await f.send(p.opcodes.scroll, data, { id: 2n });
        await f.tick(0.2);
        const events = (await f.send(p.opcodes.pollEvents)).events;
        assert.ok(events.some((e) => e.id === 1n && e.status === p.statuses.superseded));
        assert.ok(events.some((e) => e.id === 2n && e.status === p.statuses.timedOut));
        assert.equal(
          (await f.send(p.opcodes.scroll, data, { id: 2n })).status,
          p.statuses.timedOut,
        );
        await f.send(p.opcodes.scroll, data, { id: 3n });
        await f.commit([c.destroy(h(1))]);
        await f.tick();
        assert.ok(
          (await f.send(p.opcodes.pollEvents)).events.some(
            (e) => e.id === 3n && e.status === p.statuses.canceled,
          ),
        );
      }),
  );
  test(
    `${profile}: numeric tags distinguish constraints/extent from finite coordinates`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start();
        assert.equal(
          (
            await f.commit([
              c.constraints(h(1), { kind: 'unbounded', min: 0 }, { kind: 'expand' }),
              c.properties(h(1), { width: 300, height: 200, extent: 'unbounded' }),
            ])
          ).status,
          p.statuses.accepted,
        );
        await f.ready();
        const invalid = c.properties(h(1), {});
        new DataView(invalid.buffer).setFloat64(16, Infinity, true);
        assert.equal((await f.commit([invalid])).status, p.statuses.invalidValue);
        const malformed = c.constraints(
          h(1),
          { kind: 'finite', min: 0, max: 10 },
          { kind: 'unbounded' },
        );
        new DataView(malformed.buffer).setUint32(16, 99, true);
        assert.equal((await f.commit([malformed])).status, p.statuses.invalidValue);
      }),
  );
  test(
    `${profile}: real ACK timer and transferred input buffers preserve retry/query state`,
    { timeout },
    () =>
      using(profile, async (_, transport) => {
        let delay = true;
        const port = {
          async exchange(bytes) {
            const copy = structuredClone(bytes, { transfer: [bytes.buffer] });
            const result = await transport.exchange(copy);
            if (delay && new DataView(copy.buffer).getUint16(12, true) === p.opcodes.transaction) {
              delay = false;
              await new Promise((resolve) => setTimeout(resolve, 80));
            }
            return result;
          },
          close: () => transport.close(),
        };
        const client = await EngineClient.connect(port, { timeoutMs: 30 });
        try {
          const view = await client.openView(1);
          await assert.rejects(
            view.commit([c.create(h(1), 'box')]),
            (error) => error.status === p.statuses.timedOut,
          );
          assert.equal((await view.queryCommitResult()).status, p.statuses.accepted);
          assert.equal(view.documentEpoch, 1n);
          await view.commit([
            c.constraints(h(1), { kind: 'finite', min: 10, max: 20 }, { kind: 'unbounded' }),
          ]);
          await view.request(
            p.opcodes.metrics,
            body(40, (v) => {
              v.setBigUint64(0, 2n, true);
              v.setFloat64(8, 100, true);
              v.setFloat64(16, 100, true);
              v.setFloat64(24, 1, true);
            }),
          );
          await view.request(
            p.opcodes.contentStep,
            body(8, (v) => v.setUint32(0, 64, true)),
          );
          await assert.rejects(
            view.awaitActivated(2n),
            (error) => error.status === p.statuses.failed,
          );
        } finally {
          await client.close();
        }
      }),
  );
}
for (const profile of ['native', 'single-worker', 'threaded']) {
  test(
    `${profile}: close preserves provider holds until release and the client reports busy`,
    { timeout },
    () =>
      using(profile, async (f, transport) => {
        await f.start([
          c.acquireResource(h(1), new Uint8Array(10000)),
          c.create(h(1), 'image'),
          c.bindResource(h(1), h(1)),
        ]);
        await f.send(
          p.opcodes.visibility,
          body(16, (v) => v.setUint32(0, 7, true)),
        );
        const frame = await f.send(p.opcodes.takeFrame);
        await f.commit([c.bindResource(h(1), null), c.releaseResource(h(1))]);
        const client = await EngineClient.connect(transport);
        await assert.rejects(client.close(), (error) => error.status === p.statuses.busy);
        const held = await f.inspect();
        assert.equal(held.closed, true);
        assert.equal(held.holds, 1);
        assert.ok(held.resourceBytes > 0n);
        const released = await client.send(
          packet(
            p.opcodes.releaseFrame,
            owner,
            body(24, (v) => {
              v.setBigUint64(0, frame.submission, true);
              v.setBigUint64(8, frame.device, true);
            }),
          ),
        );
        assert.equal(released.status, p.statuses.ok);
        assert.equal(released.holds, 0);
        assert.equal(released.resourceBytes, 0n);
        const done = await f.send(p.opcodes.closeSession, undefined, { owner: globalOwner });
        assert.equal(done.reservedBytes, 0n);
        await client.close();
      }),
  );
}
for (const profile of ['native', 'single-worker', 'threaded']) {
  test(
    `${profile}: standalone wheel resumes after control fences and waits for matching publication`,
    { timeout },
    () =>
      using(profile, async (f) => {
        await f.start();
        await f.input('update', 5, { source: 'wheelUnknown' });
        await f.tick();
        assert.equal((await f.inspect()).nodes[0].offset, 5);
        const flags = (value) =>
          f.send(
            p.opcodes.visibility,
            body(16, (v) => {
              v.setUint32(0, value, true);
              v.setBigUint64(8, f.sequence, true);
            }),
          );
        await flags(1);
        await flags(3);
        await f.input('update', 5, { source: 'osResolved' });
        await f.tick();
        assert.equal((await f.inspect()).nodes[0].offset, 10);
        await f.resize(310, 210);
        await f.ready();
        await f.input('update', 5, { source: 'wheelUnknown' });
        await f.tick();
        const unmatched = await f.inspect();
        assert.equal(unmatched.nodes[0].offset, 10);
        assert.equal(unmatched.canceled, 1n);
        await f.present();
        await f.input('update', 5, { source: 'wheelUnknown' });
        await f.tick();
        assert.equal((await f.inspect()).nodes[0].offset, 15);
        accounting(await f.inspect());
      }),
  );
}
test(
  'public C ABI accepts a C consumer and releases outputs after session destruction',
  { timeout },
  () => {
    run(
      path.join(
        directory,
        'native/nelyx_engine_abi_test' + (process.platform === 'win32' ? '.exe' : ''),
      ),
      [],
    );
  },
);
test(
  'codec rejects non-finite scalars/unsafe IDs and resolver refuses mismatched host',
  { timeout },
  () => {
    assert.throws(() => c.properties(h(1), { width: Infinity }), RangeError);
    assert.throws(() => transaction(owner, Number.MAX_SAFE_INTEGER + 1, 0n, []), /BigInt/);
    assert.throws(() =>
      c.constraints(h(1), { kind: 'finite', min: 3, max: 1 }, { kind: 'unbounded' }),
    );
    const identity = { engine: 'v2', abiMajor: p.abiMajor, schema: p.schema };
    assert.equal(resolveEngineV2(identity, identity), '@nelyx/core/v2');
    assert.throws(() => resolveEngineV2(identity, { ...identity, schema: 0 }), /identity differs/);
  },
);
test('Wasm returns copied packets across memory growth for each profile', { timeout }, async () => {
  for (const profile of ['single-worker', 'threaded']) {
    const module = factories.get(profile + ':module');
    const transport = factories.get(profile)();
    try {
      const bytes = await transport.exchange(
        packet(
          p.opcodes.hello,
          globalOwner,
          body(8, () => {}),
        ),
      );
      const saved = bytes.slice();
      const heap = module.HEAPU8.buffer;
      const allocation = module._malloc(40 * 1024 * 1024);
      assert.ok(allocation);
      assert.ok(module.HEAPU8.buffer.byteLength > heap.byteLength || module.HEAPU8.buffer !== heap);
      module.HEAPU8.fill(7, allocation, allocation + 1024);
      module._free(allocation);
      assert.deepEqual(bytes, saved);
      assert.notEqual(bytes.buffer, module.HEAPU8.buffer);
    } finally {
      await transport.close();
    }
  }
});
