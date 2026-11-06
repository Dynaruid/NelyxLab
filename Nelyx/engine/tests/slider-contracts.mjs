// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  semanticActionBody,
  response,
} from '../../runtime/engine-client/index.ts';

export function sliderContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: linear native geometry, preferred size and a moving hit-only region preserve capture`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const shape = {
            kind: 'rrect',
            radii: Array(8).fill(0),
            strokeWidth: 0,
            strokeAlign: -1,
            strokeColor: 0,
          };
          const paint = (position = 0.5) => [
            {
              kind: 'shape',
              color: 0xff123456,
              shape,
              geometry: { kind: 'linear', rect: [position, 0.5, 0, 0, -10, -10, 20, 20] },
            },
            {
              kind: 'hitRegion',
              color: 0,
              shape,
              geometry: { kind: 'linear', rect: [position, 0, 0, 1, -22, 0, 44, 0] },
            },
          ];
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { width: 160, height: 60 }),
            c.layout(h(1), {
              preferredSize: true,
              expandPreferredWidth: true,
              childConstraints: 'inherit',
            }),
            c.nativePaint(h(1), paint()),
            c.create(h(2), 'box'),
            c.attach(h(2), h(1)),
            c.layout(h(2), { childConstraints: 'inherit' }),
            c.eventPolicy(
              h(2),
              p.eventPolicies.canonicalGestures |
                p.eventPolicies.canonicalHitTest |
                p.eventPolicies.hitTestSelf,
            ),
            c.gesture(h(2), p.gestures.tap | p.gestures.panX),
          ]);
          let frame = await f.send(p.opcodes.semanticsSnapshot);
          assert.ok(frame.capabilities & p.capabilities.canonicalSlider);
          assert.deepEqual([frame.nodes[0].width, frame.nodes[0].height], [300, 60]);
          const fill = frame.nodes[0].nativePaint[0];
          assert.deepEqual(
            [fill.width, fill.height, fill.transform[4], fill.transform[5]],
            [20, 20, 140, 20],
          );
          const pointer = async (phase, x, publication = 0n) => {
            const result = await f.input(phase, 0, {
              pointer: true,
              kind: 'mouse',
              buttons: phase === 'end' ? 0 : 1,
              x,
              y: 30,
              publication,
            });
            assert.equal(result.status, p.statuses.ok);
            await f.tick();
          };
          await pointer('begin', 20);
          await pointer('update', 30);
          await pointer('update', 40);
          await pointer('end', 20);
          assert.equal(
            (await f.send(p.opcodes.pollInteractionEvents)).events.filter(
              (e) => e.kind === p.events.gesture,
            ).length,
            0,
          );
          await pointer('begin', 150);
          await pointer('end', 150);
          assert.equal(
            (await f.send(p.opcodes.pollInteractionEvents)).events.filter(
              (e) => e.status === p.gestureKinds.tap,
            ).length,
            1,
          );
          const collected = frame.publication;
          await pointer('begin', 150, collected);
          await pointer('update', 182, collected);
          await f.commit([c.nativePaint(h(1), paint(0.75))]);
          await f.ready();
          await f.present();
          await pointer('update', 205, collected);
          await pointer('end', 205, collected);
          const events = (await f.send(p.opcodes.pollInteractionEvents)).events;
          assert.ok(
            events.some(
              (e) => e.kind === p.events.gesture && e.status === p.gestureKinds.panUpdate,
            ),
          );
          assert.equal(
            events.filter((e) => e.kind === p.events.gesture && e.status === p.gestureKinds.panEnd)
              .length,
            1,
          );
          assert.equal(
            (await f.inspect()).rejected,
            0n,
            'A changing thumb admission region does not cancel its captured drag',
          );
          const before = await f.inspect();
          for (const mutate of [
            (v) => v.setFloat64(336, NaN, true),
            (v) => v.setFloat64(336, 1e7, true),
            (v) => v.setFloat64(264, 1, true),
          ]) {
            const bad = c.nativePaint(h(1), paint());
            mutate(
              new DataView(
                bad.buffer,
                bad.byteOffset + 16 + p.nativePaintHeaderBytes,
                p.nativePaintBytes,
              ),
            );
            const rejected = await f.commit([c.paint(h(1), 0xffabcdef), bad]);
            assert.equal(rejected.status, p.statuses.invalidValue);
            const after = await f.inspect();
            assert.equal(after.document, before.document);
            assert.equal(after.nodes[0].color, before.nodes[0].color);
            assert.equal(
              response(await transport.exchange(rejected.bytes)).status,
              p.statuses.invalidValue,
            );
            assert.equal((await f.inspect()).reservedBytes, after.reservedBytes);
          }
          await f.commit([c.semantics(h(2), { role: 'slider', flags: p.semanticsFlags.disabled })]);
          await f.ready();
          await f.present();
          await pointer('begin', 225);
          for (const x of [230, 240, 250, 260]) await pointer('update', x);
          await pointer('end', 260);
          assert.equal(
            (await f.send(p.opcodes.pollInteractionEvents)).events.filter(
              (e) => e.kind === p.events.gesture,
            ).length,
            0,
          );
          const ignored = await f.inspect();
          assert.equal(
            ignored.rejected,
            0n,
            'Disabled pointer samples are inert without poisoning admission',
          );
          assert.equal(
            ignored.received,
            ignored.consumed + ignored.canceled + ignored.rejected + BigInt(ignored.queued),
          );
          await f.commit([c.semantics(h(2), { role: 'slider' })]);
          await f.ready();
          await f.present();
          await pointer('begin', 225);
          await pointer('end', 225);
          assert.equal(
            (await f.send(p.opcodes.pollInteractionEvents)).events.filter(
              (e) => e.status === p.gestureKinds.tap,
            ).length,
            1,
          );
          await f.send(p.opcodes.closeView);
          assert.equal(
            (
              await f.send(p.opcodes.closeSession, new Uint8Array(), {
                owner: { session: 1, app: 1, view: 0, generation: 0 },
              })
            ).reservedBytes,
            0n,
          );
        }),
    );
    test(
      `${profile}: source semantic range publishes formatted values and requests App changes without native control state`,
      { timeout },
      () =>
        using(profile, async (f) => {
          const semantics = {
            role: 'slider',
            label: '조절 😀',
            value: '중간 50%',
            increasedValue: '높음',
            decreasedValue: '낮음',
            actions: p.semanticsActions.setValue | p.semanticsActions.increment,
            range: {
              minimum: 10,
              maximum: 30,
              value: 20,
              smallChange: 5,
              largeChange: 10,
              readOnly: false,
            },
          };
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { width: 160, height: 48 }),
            c.semantics(h(1), semantics),
          ]);
          const frame = await f.send(p.opcodes.semanticsSnapshot),
            node = frame.nodes[0];
          assert.equal(node.control, null);
          assert.equal(node.semantics.value, semantics.value);
          assert.equal(node.semantics.increasedValue, '높음');
          assert.equal(node.semantics.decreasedValue, '낮음');
          assert.deepEqual(node.semantics.range, semantics.range);
          assert.equal(
            (
              await f.send(
                p.opcodes.semanticsAction,
                semanticActionBody(h(1), frame.publication, 'setValue', 0n, 23),
              )
            ).status,
            p.statuses.ok,
          );
          const changed = await f.send(p.opcodes.pollInteractionEvents),
            event = changed.events.find((e) => e.kind === p.events.semanticAction);
          assert.equal(event.detail, BigInt(p.semanticsActions.setValue));
          assert.equal(event.x, 23);
          assert.equal(
            (await f.send(p.opcodes.semanticsSnapshot)).nodes[0].semantics.range.value,
            20,
          );
          assert.equal(changed.controlWork, 0n);
          assert.equal(
            (
              await f.send(
                p.opcodes.semanticsAction,
                semanticActionBody(h(1), frame.publication, 'setValue', 0n, 31),
              )
            ).status,
            p.statuses.invalidValue,
          );
          const before = await f.inspect();
          for (const [mutate, status] of [
            [(v) => v.setFloat64(32, 31, true), p.statuses.invalidValue],
            [(v) => v.setFloat64(48, NaN, true), p.statuses.invalidValue],
            [(v) => v.setUint32(24, 2, true), p.statuses.invalidValue],
            [(v) => v.setUint32(28, 1, true), p.statuses.malformed],
            [(v) => v.setUint8(p.semanticsBytes, 0xc0), p.statuses.invalidValue],
          ]) {
            const bad = c.semantics(h(1), semantics);
            mutate(new DataView(bad.buffer, bad.byteOffset + 16, bad.byteLength - 16));
            assert.equal((await f.commit([c.paint(h(1), 0xffabcdef), bad])).status, status);
            assert.equal((await f.inspect()).document, before.document);
          }
          assert.equal(
            (
              await f.commit([
                c.semantics(h(1), {
                  ...semantics,
                  actions: 0,
                  range: { ...semantics.range, readOnly: true },
                }),
              ])
            ).status,
            p.statuses.accepted,
          );
          await f.ready();
          await f.present();
          const readOnly = await f.send(p.opcodes.semanticsSnapshot);
          assert.equal(readOnly.nodes[0].semantics.range.readOnly, true);
          assert.equal(
            (
              await f.send(
                p.opcodes.semanticsAction,
                semanticActionBody(h(1), readOnly.publication, 'setValue', 0n, 20),
              )
            ).status,
            p.statuses.capabilityMissing,
          );
          await f.send(p.opcodes.closeView);
          assert.equal(
            (
              await f.send(p.opcodes.closeSession, new Uint8Array(), {
                owner: { session: 1, app: 1, view: 0, generation: 0 },
              })
            ).reservedBytes,
            0n,
          );
        }),
    );
  }
}
