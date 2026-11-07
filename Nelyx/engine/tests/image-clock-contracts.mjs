// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EngineClient,
  body,
  commands as c,
  protocol as p,
} from '../../runtime/engine-client/index.ts';
import { AppImageClock } from '../../runtime/engine-client/app-image-clock.ts';
const deadline = (at) => body(8, (data) => data.setFloat64(0, at, true));
export function imageClockContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: Core image deadlines wake once without visual work, preserve future timers across immediate frames and cancel while hidden`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([c.create(h(1), 'box'), c.properties(h(1), { width: 20, height: 20 })]);
          await f.tick(1);
          const before = await f.inspect();
          assert.equal(before.appFrameWork, 0n);
          assert.equal(
            (await f.send(p.opcodes.requestAppFrame, deadline(1.1))).status,
            p.statuses.ok,
          );
          let state = await f.inspect();
          assert.equal(state.nextDeadline, 1.1);
          assert.equal(state.wake, false);
          assert.equal(state.renderWake, false);
          await f.tick(1.099);
          assert.equal((await f.inspect()).appFrameWork, 0n);
          await f.tick(1.1);
          state = await f.inspect();
          assert.equal(state.appFrameWork, 1n);
          assert.equal(state.nextDeadline, null);
          assert.equal(state.layoutWork, before.layoutWork);
          assert.equal(state.transactionWork, before.transactionWork);
          let events = (await f.send(p.opcodes.pollInteractionEvents)).events.filter(
            (event) => event.kind === p.events.appFrame,
          );
          assert.equal(events.length, 1);
          assert.equal(events[0].x, 1.1);
          await f.send(p.opcodes.requestAppFrame, deadline(1.3));
          await f.send(p.opcodes.requestAppFrame);
          await f.tick(1.2);
          state = await f.inspect();
          assert.equal(state.appFrameWork, 2n);
          assert.equal(state.nextDeadline, 1.3);
          await f.present();
          await f.tick(1.3);
          assert.equal((await f.inspect()).appFrameWork, 3n);
          await f.send(p.opcodes.requestAppFrame, deadline(1.5));
          await f.send(p.opcodes.requestAppFrame, deadline(0));
          await f.tick(1.6);
          assert.equal((await f.inspect()).appFrameWork, 3n);
          assert.equal(
            (await f.send(p.opcodes.requestAppFrame, deadline(-1))).status,
            p.statuses.invalidValue,
          );
          await f.send(p.opcodes.requestAppFrame, deadline(1.7));
          const visible = (value) =>
            body(16, (data) => {
              data.setUint32(0, value ? 3 : 0, true);
              data.setBigUint64(8, 0n, true);
            });
          await f.send(p.opcodes.visibility, visible(false));
          await f.tick(1.8);
          state = await f.inspect();
          assert.equal(state.appFrameWork, 3n);
          assert.equal(state.nextDeadline, null);
          await f.send(p.opcodes.visibility, visible(true));
          await f.tick(1.9);
          assert.equal((await f.inspect()).appFrameWork, 4n);
        }),
    );
    test(
      `${profile}: App image clock shares actual Core events, replays absolute deadline ACKs and retires pending callbacks`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          let lose = 1;
          const deadlines = [],
            errors = [];
          const client = await EngineClient.connect({
            async exchange(bytes) {
              const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
                timed =
                  data.getUint16(p.headerFields.opcode, true) === p.opcodes.requestAppFrame &&
                  bytes.length === p.headerBytes + 8;
              if (timed) deadlines.push(data.getFloat64(p.headerBytes, true));
              const result = await transport.exchange(bytes);
              if (timed && lose-- > 0) throw Error('Image deadline ACK lost');
              return result;
            },
            close: () => transport.close(),
          });
          const view = await client.openView(1),
            clock = new AppImageClock(view, (error) => errors.push(error)),
            fired = [];
          try {
            await f.resize(100, 80);
            await f.commit([c.create(h(1), 'box'), c.properties(h(1), { width: 20, height: 20 })]);
            await f.ready();
            await f.present();
            const pump = async () => {
              const result = await view.request(p.opcodes.pollInteractionEvents);
              for (const event of result.events)
                if (event.kind === p.events.appFrame) clock.frame(event.x, event.id);
              return result;
            };
            const reaches = async (expected) => {
              let state;
              for (let i = 0; i < 30; ++i) {
                await Promise.resolve();
                state = await view.request(p.opcodes.inspect);
                if (state.nextDeadline === expected) return state;
              }
              assert.equal(state.nextDeadline, expected);
            };
            const first = clock.scheduleTimer(() => fired.push('first'), 50);
            await Promise.resolve();
            await view.request(p.opcodes.inspect);
            await f.tick(1);
            await pump();
            await reaches(1.05);
            assert.equal(clock.now(), 1000);
            assert.deepEqual(deadlines.slice(0, 2), [1.05, 1.05]);
            clock.scheduleTimer(() => fired.push('second'), 20);
            first.dispose();
            await reaches(1.02);
            await f.tick(1.019);
            await pump();
            assert.deepEqual(fired, []);
            await f.tick(1.02);
            await pump();
            assert.deepEqual(fired, ['second']);
            await reaches(null);
            const callback = () => fired.push('frame');
            clock.requestFrame(callback);
            clock.requestFrame(callback);
            await Promise.resolve();
            await view.request(p.opcodes.inspect);
            await f.tick(1.03);
            const event = await pump();
            assert.deepEqual(fired, ['second', 'frame', 'frame']);
            for (const frame of event.events.filter((value) => value.kind === p.events.appFrame))
              clock.frame(frame.x, frame.id);
            assert.equal(fired.length, 3, 'A replayed Core frame cannot dispatch again');
            clock.scheduleTimer(() => fired.push('closed'), 500);
            await reaches(1.53);
            await clock.close();
            await reaches(null);
            await f.tick(2);
            await pump();
            assert.equal(fired.length, 3);
            assert.equal(clock.execution.pendingTimers, 0);
            assert.deepEqual(errors, []);
            assert.equal(clock.execution.timerCallbacks, 1);
            assert.equal(clock.execution.frameCallbacks, 2);
          } finally {
            await clock.close();
            await client.close();
          }
        }),
    );
  }
}
