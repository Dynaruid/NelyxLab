// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  keyBody,
  eventValue,
  body,
} from '../../runtime/engine-client/index.ts';
export function gestureContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: native pointer controls retain value, press, hover and keyboard state without App work`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { width: 200, height: 80 }),
            c.control(h(1), { kind: 'toggle', value: 0 }),
            c.semantics(h(1), {
              role: 'checkbox',
              label: 'native switch',
              flags: p.semanticsFlags.focusable,
              actions: p.semanticsActions.activate | p.semanticsActions.focus,
            }),
          ]);
          const baseline = await f.inspect();
          await f.input('begin', 0, { pointer: true, x: 50, y: 30 });
          await f.tick();
          assert.equal((await f.inspect()).nodes[0].control.pressed, true);
          await f.present();
          await f.input('end', 0, { pointer: true, x: 50, y: 30 });
          await f.tick();
          let frame = await f.present();
          assert.equal(frame.nodes[0].control.value, 1);
          assert.equal(frame.nodes[0].control.pressed, false);
          assert.ok(frame.nodes[0].semantics.flags & p.semanticsFlags.checked);
          assert.equal(
            (await f.send(p.opcodes.key, keyBody(frame.submission, 32))).status,
            p.statuses.ok,
          );
          await f.tick();
          frame = await f.present();
          assert.equal(frame.nodes[0].control.value, 0);
          await f.input('update', 0, { pointer: true, hover: true, x: 50, y: 30 });
          await f.tick();
          assert.equal((await f.inspect()).nodes[0].control.hovered, true);
          assert.equal((await f.inspect()).transactionWork, baseline.transactionWork);
          assert.ok((await f.inspect()).gestureWork > 0n);
          assert.ok((await f.inspect()).controlWork > 0n);
          await f.commit([c.control(h(1), { kind: 'slider', value: 0, step: 0.25 })]);
          await f.ready();
          await f.present();
          await f.input('begin', 0, { pointer: true, x: 6, y: 30 });
          await f.tick();
          await f.input('update', 0, { pointer: true, x: 194, y: 30 });
          await f.tick();
          await f.input('end', 0, { pointer: true, x: 194, y: 30 });
          await f.tick();
          frame = await f.present();
          assert.equal(frame.nodes[0].control.value, 1);
          await f.send(p.opcodes.key, keyBody(frame.submission, 37));
          await f.tick();
          frame = await f.present();
          assert.equal(frame.nodes[0].control.value, 0.75);
        }),
    );
    test(
      `${profile}: long press, double tap, pinch and cancellation are bounded native recognizers`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { width: 300, height: 200 }),
            c.gesture(
              h(1),
              p.gestures.tap | p.gestures.longPress | p.gestures.doubleTap | p.gestures.pinch,
            ),
          ]);
          await f.input('begin', 0, { pointer: true, x: 20, y: 20 });
          await f.tick(1);
          assert.equal((await f.inspect()).nextDeadline, 1.5);
          await f.tick(1.51);
          let events = (await f.send(p.opcodes.pollInteractionEvents)).events;
          assert.ok(
            events.some(
              (e) => e.kind === p.events.gesture && e.status === p.gestureKinds.longPress,
            ),
          );
          await f.input('end', 0, { pointer: true, x: 20, y: 20 });
          await f.tick();
          for (let i = 0; i < 2; ++i) {
            await f.input('begin', 0, { pointer: true, x: 20, y: 20 });
            await f.tick();
            await f.input('end', 0, { pointer: true, x: 20, y: 20 });
            await f.tick();
          }
          events = (await f.send(p.opcodes.pollInteractionEvents)).events;
          assert.equal(
            events.filter(
              (e) => e.kind === p.events.gesture && e.status === p.gestureKinds.doubleTap,
            ).length,
            1,
          );
          await f.input('begin', 0, { pointer: true, x: 20, y: 20, stream: 1 });
          await f.tick();
          await f.input('begin', 0, { pointer: true, x: 100, y: 20, stream: 2 });
          await f.tick();
          await f.input('update', 0, { pointer: true, x: 180, y: 20, stream: 2 });
          await f.tick();
          events = (await f.send(p.opcodes.pollInteractionEvents)).events;
          assert.ok(
            events.some(
              (e) => e.status === p.gestureKinds.pinchUpdate && eventValue(e.detail) === 2,
            ),
          );
          await f.send(
            p.opcodes.visibility,
            body(16, (v) => v.setBigUint64(8, f.sequence, true)),
          );
          assert.equal((await f.inspect()).nextDeadline, null);
          assert.equal((await f.inspect()).nodes[0].control, null);
        }),
    );
    test(
      `${profile}: a published modal fences native input, focus and actions behind it`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { width: 200, height: 100 }),
            c.semantics(h(1), {
              role: 'button',
              label: 'behind',
              flags: p.semanticsFlags.focusable,
              actions: p.semanticsActions.focus | p.semanticsActions.activate,
            }),
          ]);
          await f.commit([
            c.create(h(2), 'box'),
            c.properties(h(2), { width: 200, height: 100 }),
            c.eventPolicy(h(2), 4),
            c.gesture(h(2), p.gestures.tap),
          ]);
          await f.ready();
          const frame = await f.present();
          await f.send(p.opcodes.key, keyBody(frame.submission, 9));
          assert.equal((await f.inspect()).focus, null);
          const snapshot = await f.send(p.opcodes.semanticsSnapshot);
          assert.ok(
            snapshot.nodes.find((n) => n.node.slot === 1).semantics.flags & p.semanticsFlags.hidden,
          );
          await f.input('begin', 0, { pointer: true, x: 20, y: 20 });
          await f.tick();
          await f.input('end', 0, { pointer: true, x: 20, y: 20 });
          await f.tick();
          const events = (await f.send(p.opcodes.pollInteractionEvents)).events;
          assert.equal(
            events.filter((e) => e.kind === p.events.semanticAction && e.node.slot === 1).length,
            0,
          );
        }),
    );
  }
}
