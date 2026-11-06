// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  response,
  packet,
} from '../../runtime/engine-client/index.ts';

export function layerContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: layer links compose native anchors across transformed branches and follow prepared scroll without App work`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          await f.start([
            c.create(h(1), 'stack'),
            c.properties(h(1), { width: 300, height: 200 }),
            c.create(h(2), 'scrollViewport'),
            c.attach(h(2), h(1)),
            c.properties(h(2), { x: 20, y: 10, width: 100, height: 120, maximum: 100 }),
            c.create(h(3), 'box'),
            c.attach(h(3), h(2)),
            c.properties(h(3), { x: 5, y: 30, width: 80, height: 40 }),
            c.layerLink(h(3), { kind: 'leader' }),
            c.create(h(4), 'transform'),
            c.attach(h(4), h(1), 1),
            c.properties(h(4), { width: 50, height: 50 }),
            c.graphics(h(4), { transform: [2, 0, 0, 2, 180, 20] }),
            c.create(h(5), 'box'),
            c.attach(h(5), h(4)),
            c.properties(h(5), { x: 7, y: 9, width: 20, height: 10 }),
            c.layerLink(h(5), {
              kind: 'follower',
              leader: h(3),
              offset: { x: 5, y: 7 },
              leaderAnchor: { x: 1, y: 1 },
              followerAnchor: { x: 0, y: 0 },
            }),
            c.create(h(6), 'box'),
            c.attach(h(6), h(5)),
            c.properties(h(6), { width: 20, height: 10 }),
            c.paint(h(6), 0xff123456),
            c.eventPolicy(
              h(6),
              p.eventPolicies.canonicalGestures |
                p.eventPolicies.canonicalHitTest |
                p.eventPolicies.hitTestSelf,
            ),
            c.gesture(h(6), p.gestures.tap),
            c.semantics(h(6), {
              role: 'button',
              label: 'Linked button',
              actions: p.semanticsActions.activate,
            }),
          ]);
          let frame = await f.send(p.opcodes.semanticsSnapshot);
          assert.ok(frame.capabilities & p.capabilities.layerLinks);
          const child = (s) => s.nodes.find((n) => n.node.slot === 6);
          assert.deepEqual(child(frame).matrix, [1, 0, 0, 1, 100, 82]);
          const composition = (state, slot = 5) =>
            state.nodes.find((n) => n.node.slot === slot).layerComposition;
          assert.deepEqual(composition(frame), {
            kind: 'follower',
            leader: h(3),
            linked: true,
            showWhenUnlinked: true,
            transform: [0.5, 0, 0, 0.5, -47, 22],
            linkedOffset: { x: 75, y: 42 },
          });
          assert.deepEqual(composition(frame, 3), {
            kind: 'leader',
            leader: h(0, 0),
            linked: false,
            showWhenUnlinked: false,
            transform: null,
            linkedOffset: { x: 0, y: 0 },
          });
          assert.equal(
            (await f.inspect()).nodes.find((n) => n.node.slot === 5).layerComposition,
            null,
            'Acceptance is not composition',
          );
          const encoded = await transport.exchange(
            packet(p.opcodes.semanticsSnapshot, { session: 1, app: 1, view: 1, generation: 1 }),
          );
          const findBlob = (bytes) => {
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
              b = p.headerBytes;
            let cursor =
              b +
              p.stateBytes +
              view.getUint32(b + p.stateFields.nodeCount, true) * p.nodeBytes +
              view.getUint32(b + p.stateFields.eventCount, true) * p.eventBytes;
            for (let i = 0; i < view.getUint32(b + p.stateFields.blobCount, true); i++) {
              const length = view.getUint32(cursor + 16, true);
              if (
                view.getUint32(cursor, true) === p.layerCompositionBlob &&
                view.getUint32(cursor + 8, true) === 5
              )
                return cursor + 24;
              cursor += 24 + Math.ceil(length / 8) * 8;
            }
            throw Error('Missing native layer observation');
          };
          for (const mutate of [
            (v) => v.setUint32(0, 3, true),
            (v) => v.setUint32(4, 4, true),
            (v) => v.setUint32(4, 2, true),
            (v) => v.setFloat64(16, NaN, true),
            (v) => v.setUint32(12, 0, true),
          ]) {
            const bad = encoded.slice(),
              at = findBlob(bad);
            mutate(new DataView(bad.buffer, bad.byteOffset + at, p.layerCompositionBytes));
            assert.throws(() => response(bad), /layer composition|scalar/i);
          }
          const commands = frame.transactionWork,
            publication = frame.publication;
          await f.input('update', 30, { target: h(2), x: 30, y: 40, source: 'wheelUnknown' });
          await f.tick();
          await f.present();
          frame = await f.send(p.opcodes.semanticsSnapshot);
          assert.deepEqual(child(frame).matrix, [1, 0, 0, 1, 100, 52]);
          assert.deepEqual(composition(frame).transform, [0.5, 0, 0, 0.5, -47, 7]);
          assert.equal(
            frame.transactionWork,
            commands,
            'Core scroll updates linked geometry without App transactions',
          );
          const pointer = async (phase, x, y, publication = 0n) => {
            const r = await f.input(phase, 0, {
              pointer: true,
              kind: 'mouse',
              buttons: phase === 'end' ? 0 : 1,
              x,
              y,
              publication,
            });
            await f.tick();
            return r;
          };
          assert.equal(
            (await pointer('begin', 105, 85, publication)).status,
            p.statuses.ok,
            'Prepared scrolling preserves the exact frame observed at collection',
          );
          assert.equal((await pointer('end', 105, 85, publication)).status, p.statuses.ok);
          assert.equal((await pointer('begin', 105, 55)).status, p.statuses.ok);
          assert.equal((await pointer('end', 105, 55)).status, p.statuses.ok);
          assert.equal(
            (await f.send(p.opcodes.pollInteractionEvents)).events.filter(
              (e) => e.status === p.gestureKinds.tap,
            ).length,
            2,
          );
          const previous = frame.publication;
          await f.commit([c.properties(h(3), { x: 15, y: 30, width: 80, height: 40 })]);
          assert.deepEqual(
            composition(await f.send(p.opcodes.semanticsSnapshot)).transform,
            [0.5, 0, 0, 0.5, -47, 7],
            'A pending layout cannot advance last composition',
          );
          await f.ready();
          await f.present();
          assert.equal(
            (await pointer('begin', 105, 55, previous)).status,
            p.statuses.stale,
            'A new document cannot reuse the old linked target geometry',
          );
          await f.commit([
            c.graphics(h(4), { transform: [1, 0, 0, 1, 1e12 - 100, 0] }),
            c.properties(h(5), { x: 1e12, y: 9, width: 20, height: 10 }),
          ]);
          await f.ready();
          await f.present();
          frame = await f.send(p.opcodes.semanticsSnapshot);
          assert.deepEqual(child(frame).matrix, [1, 0, 0, 1, 110, 52]);
          assert.deepEqual(
            composition(frame).transform,
            [1, 0, 0, 1, -1999999999790, 43],
            'A finite relative observation may exceed global world bounds without rejecting a valid linked scene',
          );
          await f.send(p.opcodes.closeView);
          const closed = await f.send(p.opcodes.closeSession, new Uint8Array(), {
            owner: { session: 1, app: 1, view: 0, generation: 0 },
          });
          assert.equal(closed.reservedBytes, 0n);
        }),
    );
    test(
      `${profile}: unlinked visibility and invalid layer graphs preserve atomic documents and drain ownership`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          await f.start([
            c.create(h(1), 'stack'),
            c.properties(h(1), { width: 300, height: 200 }),
            c.create(h(2), 'box'),
            c.attach(h(2), h(1)),
            c.properties(h(2), { x: 10, y: 20, width: 80, height: 40 }),
            c.layerLink(h(2), { kind: 'leader' }),
            c.create(h(3), 'box'),
            c.attach(h(3), h(1), 1),
            c.properties(h(3), { x: 150, y: 50, width: 20, height: 10 }),
            c.layerLink(h(3), { kind: 'follower', showWhenUnlinked: false }),
            c.create(h(4), 'box'),
            c.attach(h(4), h(3)),
            c.properties(h(4), { width: 20, height: 10, opacity: 0 }),
            c.eventPolicy(
              h(4),
              p.eventPolicies.canonicalHitTest |
                p.eventPolicies.hitTestSelf |
                p.eventPolicies.canonicalGestures,
            ),
            c.gesture(h(4), p.gestures.tap | p.gestures.panX),
            c.semantics(h(4), { role: 'button', label: 'Follower' }),
          ]);
          let frame = await f.send(p.opcodes.semanticsSnapshot);
          assert.equal(
            !!(frame.nodes.find((n) => n.node.slot === 4).flags & 16),
            false,
            'Hidden unlinked subtree stays hidden even with canonical zero-opacity hits',
          );
          await f.commit([
            c.layerLink(h(3), {
              kind: 'follower',
              showWhenUnlinked: true,
              offset: { x: 90, y: 90 },
            }),
          ]);
          await f.ready();
          await f.present();
          frame = await f.send(p.opcodes.semanticsSnapshot);
          assert.deepEqual(
            frame.nodes.find((n) => n.node.slot === 4).matrix,
            [1, 0, 0, 1, 150, 50],
            'Unlinked placement uses layout rather than the linked offset',
          );
          assert.ok(frame.nodes.find((n) => n.node.slot === 4).flags & 16);
          await f.commit([c.layerLink(h(3), { kind: 'follower', leader: h(2) })]);
          await f.ready();
          await f.present();
          await f.input('begin', 0, { pointer: true, kind: 'mouse', buttons: 1, x: 15, y: 25 });
          await f.tick();
          await f.send(p.opcodes.pollInteractionEvents);
          await f.commit([c.layerLink(h(3), { kind: 'follower', showWhenUnlinked: false })]);
          await f.ready();
          await f.present();
          const canceled = (await f.send(p.opcodes.pollInteractionEvents)).events;
          assert.equal(
            canceled.filter(
              (e) => e.kind === p.events.gesture && e.status === p.gestureKinds.cancel,
            ).length,
            1,
            'Unlink retires held pointer capture once',
          );
          assert.equal((await f.inspect()).nodes.find((n) => n.node.slot === 4).flags & 4, 0);
          await f.commit([c.layerLink(h(3), { kind: 'follower', leader: h(2) })]);
          await f.ready();
          await f.present();
          assert.equal(
            (await f.send(p.opcodes.pollInteractionEvents)).events.filter(
              (e) => e.kind === p.events.gesture && e.status === p.gestureKinds.cancel,
            ).length,
            0,
          );
          const baseline = await f.inspect();
          const nan = c.layerLink(h(3), { kind: 'follower', leader: h(2) });
          new DataView(nan.buffer, nan.byteOffset + 16).setFloat64(16, NaN, true);
          for (const [commands, status] of [
            [[c.layerLink(h(2))], p.statuses.invalidGraph],
            [[c.layerLink(h(3), { kind: 'follower', leader: h(2, 2) })], p.statuses.invalidHandle],
            [[c.layerLink(h(3), { kind: 'follower', leader: h(3) })], p.statuses.invalidGraph],
            [[c.move(h(3), h(1), 0)], p.statuses.invalidGraph],
            [[nan], p.statuses.invalidValue],
          ]) {
            const rejected = await f.commit([c.paint(h(4), 0xffabcdef), ...commands]);
            assert.equal(rejected.status, status);
            const state = await f.inspect();
            assert.equal(state.document, baseline.document);
            assert.equal(
              state.nodes.find((n) => n.node.slot === 4).color,
              baseline.nodes.find((n) => n.node.slot === 4).color,
            );
            assert.equal(response(await transport.exchange(rejected.bytes)).status, status);
            assert.equal((await f.inspect()).reservedBytes, state.reservedBytes);
          }
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
