// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  keyBody,
  focusBody,
  eventValue,
  body,
  editBody,
  writeHandle,
  EngineClient,
  WidgetHost,
  Box,
} from '../../runtime/engine-client/index.ts';
export function gestureContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: collected pointer clicks survive same-document preparation and expire at the bounded admission window`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { x: 10, y: 10, width: 40, height: 30 }),
            c.control(h(1), { kind: 'checkbox' }),
            c.create(h(2), 'editable'),
            c.properties(h(2), { x: 120, y: 10, width: 40, height: 30 }),
            c.text(h(2), 'a'),
            c.editor(h(2)),
            c.create(h(3), 'scrollViewport'),
            c.properties(h(3), { width: 100, height: 100, maximum: 100 }),
            c.attach(h(1), h(3)),
          ]);
          const reprepare = async () => {
            const state = await f.send(
              p.opcodes.editSnapshot,
              body(8, (v) => writeHandle(v, 0, h(2))),
            );
            const editing = state.nodes[0].editing;
            assert.equal(
              (
                await f.send(
                  p.opcodes.edit,
                  editBody(h(2), {
                    kind: 'replace',
                    revision: editing.revision,
                    text: editing.text + 'a',
                  }),
                )
              ).status,
              p.statuses.ok,
            );
            await f.ready();
            await f.present();
          };
          const collected = (await f.inspect()).publication;
          await reprepare();
          for (const [phase, hover] of [
            ['update', true],
            ['begin', false],
            ['end', false],
          ]) {
            assert.equal(
              (
                await f.input(phase, 0, {
                  pointer: true,
                  hover,
                  x: 20,
                  y: 20,
                  publication: collected,
                })
              ).status,
              p.statuses.ok,
            );
          }
          // A real fast click may enqueue both boundaries before the first tick
          // has created its capture. Admission must preserve their queue order.
          await f.tick();
          let state = await f.inspect();
          assert.equal(state.nodes.find((n) => n.node.slot === 1).control.value, 1);
          assert.equal(state.controlWork, 1n);
          assert.equal(state.rejected, 0n);
          const beforeScroll = state.publication;
          await f.input('update', 10, { source: 'wheelUnknown', target: h(3) });
          await f.tick();
          await reprepare();
          assert.equal(
            (
              await f.input('begin', 0, {
                pointer: true,
                x: 20,
                y: 20,
                publication: beforeScroll,
              })
            ).status,
            p.statuses.stale,
            'A same-document target still under the point cannot reuse changed local geometry',
          );
          // A target can remain under the point while its local coordinate space changes.
          const old = state.publication;
          await f.commit([c.properties(h(1), { x: 10, y: 10, width: 60, height: 30 })]);
          await f.ready();
          await f.present();
          assert.equal(
            (
              await f.input('begin', 0, {
                pointer: true,
                x: 20,
                y: 20,
                publication: old,
              })
            ).status,
            p.statuses.stale,
          );
          state = await f.inspect();
          assert.equal(state.controlWork, 1n);
          // The same eight-slot admission bound also expires unchanged old targets.
          const expired = state.publication;
          for (let i = 0; i < p.limits.publicationSnapshots; ++i) {
            await reprepare();
          }
          assert.equal(
            (
              await f.input('begin', 0, {
                pointer: true,
                x: 20,
                y: 20,
                publication: expired,
              })
            ).status,
            p.statuses.stale,
          );
          const current = (await f.inspect()).publication;
          for (const phase of ['begin', 'end']) {
            assert.equal(
              (
                await f.input(phase, 0, {
                  pointer: true,
                  x: 20,
                  y: 20,
                  publication: current,
                })
              ).status,
              p.statuses.ok,
            );
            await f.tick();
          }
          assert.equal((await f.inspect()).controlWork, 2n);
        }),
    );
    test(
      `${profile}: stale pointer begins reject changed ancestor transforms and a newly covering control`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { x: 10, width: 100, height: 100 }),
            c.create(h(2), 'box'),
            c.properties(h(2), { width: 40, height: 30 }),
            c.control(h(2), { kind: 'checkbox' }),
            c.attach(h(2), h(1)),
            c.create(h(3), 'box'),
            c.properties(h(3), { x: 150, width: 40, height: 30 }),
            c.control(h(3), { kind: 'checkbox' }),
          ]);
          let old = (await f.inspect()).publication;
          await f.commit([
            c.properties(h(1), { x: 20, width: 100, height: 100 }),
            c.properties(h(2), { x: -10, width: 40, height: 30 }),
          ]);
          await f.ready();
          await f.present();
          assert.equal(
            (
              await f.input('begin', 0, {
                pointer: true,
                x: 20,
                y: 20,
                publication: old,
              })
            ).status,
            p.statuses.stale,
          );
          old = (await f.inspect()).publication;
          await f.commit([c.properties(h(3), { x: 10, width: 40, height: 30 })]);
          await f.ready();
          await f.present();
          assert.equal(
            (
              await f.input('begin', 0, {
                pointer: true,
                x: 20,
                y: 20,
                publication: old,
              })
            ).status,
            p.statuses.stale,
          );
          const state = await f.inspect();
          assert.equal(state.controlWork, 0n);
          assert.equal(state.rejected, 2n);
        }),
    );
    test(
      `${profile}: Widget callbacks consume bounded raw samples and approve native pointer actions`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1);
          const host = new WidgetHost(view, { pollEvents: false }),
            samples = [],
            decisions = [],
            gestures = [];
          await f.resize(100, 100);
          await host.mount(
            new Box([], {
              properties: { width: 100, height: 100 },
              gestures: p.gestures.tap,
              onRawInput: (sample) => samples.push(sample),
              appControlled: (sample) => {
                decisions.push(sample.sequence);
                return true;
              },
              onGesture: (event) => gestures.push(event.kind),
            }),
          );
          await f.ready();
          await f.present();
          for (const phase of ['begin', 'end']) {
            await f.input(phase, 0, { pointer: true, x: 20, y: 20 });
            await f.tick();
            await host.pollEvents();
            await new Promise((resolve) => setTimeout(resolve, 0));
            await f.tick();
          }
          await host.pollEvents();
          assert.equal(decisions.length, 2);
          assert.equal(samples.length, 2);
          assert.deepEqual(gestures, ['tap']);
          assert.ok(samples.every((sample) => sample.publication > 0n));
          await host.close();
          await client.close();
        }),
    );
    test(
      `${profile}: raw observers terminate on a bounded gap while native scrolling continues`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'scrollViewport'),
            c.properties(h(1), { width: 300, height: 200, maximum: 10000 }),
            c.eventPolicy(h(1), 1),
          ]);
          await f.send(
            p.opcodes.subscribeRaw,
            body(8, (v) => v.setBigUint64(0, 1n, true)),
          );
          for (let batch = 0; batch < 3; ++batch) {
            const count = batch < 2 ? 32 : 1;
            for (let i = 0; i < count; ++i) await f.input('update', 1, { source: 'wheelUnknown' });
            await f.tick();
          }
          const raw = await f.send(p.opcodes.pollRaw);
          assert.equal(raw.rawInputs.length, 0);
          assert.equal(raw.events[0].kind, p.events.rawGap);
          assert.equal(raw.events[0].epoch, 1n);
          assert.equal(raw.events[0].detail, 65n);
          assert.equal((await f.inspect()).nodes[0].offset, 65);
          await f.send(
            p.opcodes.subscribeRaw,
            body(8, (v) => v.setBigUint64(0, 2n, true)),
          );
          await f.input('update', -2, {
            source: 'wheelUnknown',
            sample: 0.123,
          });
          await f.tick();
          const sample = (await f.send(p.opcodes.pollRaw)).rawInputs[0];
          assert.equal(sample.subscription, 2n);
          assert.equal(sample.sequence, 66n);
          assert.equal(sample.dy, -2);
          assert.equal(sample.sample, 0.123);
          assert.ok(sample.publication > 0n);
          const state = await f.inspect();
          assert.equal(
            state.received,
            state.consumed + state.canceled + state.rejected + BigInt(state.queued),
          );
        }),
    );
    test(
      `${profile}: app-controlled input has a per-sample deadline and leaves standard streams independent`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'scrollViewport'),
            c.properties(h(1), { width: 100, height: 200, maximum: 1000 }),
            c.eventPolicy(h(1), 2),
            c.create(h(2), 'scrollViewport'),
            c.properties(h(2), {
              x: 100,
              width: 100,
              height: 200,
              maximum: 1000,
            }),
          ]);
          await f.input('update', 20, { source: 'wheelUnknown' });
          await f.tick();
          const request = (await f.send(p.opcodes.pollInteractionEvents)).gestureRequests[0];
          assert.equal(request.dy, 20);
          assert.equal((await f.inspect()).nodes[0].offset, 0);
          await f.input('update', 30, {
            source: 'wheelUnknown',
            target: h(2),
            stream: 2,
          });
          await f.tick();
          assert.equal((await f.inspect()).nodes.find((n) => n.node.slot === 2).offset, 30);
          const reply = (accept) =>
            body(24, (v) => {
              v.setUint32(0, request.stream, true);
              v.setUint32(4, accept ? 1 : 0, true);
              v.setBigUint64(8, request.sequence, true);
            });
          assert.equal((await f.send(p.opcodes.gestureReply, reply(true))).status, p.statuses.ok);
          assert.equal(
            (await f.inspect()).nodes[0].offset,
            0,
            'Approval does not mutate compositor properties on App dispatch',
          );
          await f.tick();
          assert.equal((await f.inspect()).nodes[0].offset, 20);
          assert.equal(
            (await f.send(p.opcodes.gestureReply, reply(true))).status,
            p.statuses.stale,
          );
          await f.input('update', 40, { source: 'wheelUnknown' });
          await f.tick();
          const delayed = (await f.send(p.opcodes.pollInteractionEvents)).gestureRequests[0];
          const state = await f.inspect();
          assert.ok(state.nextDeadline > 0);
          await f.tick(state.nextDeadline + 0.001);
          assert.equal(
            (
              await f.send(
                p.opcodes.gestureReply,
                body(24, (v) => {
                  v.setUint32(0, delayed.stream, true);
                  v.setUint32(4, 1, true);
                  v.setBigUint64(8, delayed.sequence, true);
                }),
              )
            ).status,
            p.statuses.stale,
          );
          assert.equal((await f.inspect()).nodes[0].offset, 20);
          const final = await f.inspect();
          assert.equal(
            final.received,
            final.consumed + final.canceled + final.rejected + BigInt(final.queued),
          );
        }),
    );
    test(
      `${profile}: collected input retains its publication when a newer layout changes hit targets`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'scrollViewport'),
            c.properties(h(1), { width: 100, height: 200, maximum: 1000 }),
            c.create(h(2), 'scrollViewport'),
            c.properties(h(2), {
              x: 100,
              width: 100,
              height: 200,
              maximum: 1000,
            }),
          ]);
          const old = (await f.inspect()).publication;
          await f.commit([
            c.properties(h(1), {
              x: 100,
              width: 100,
              height: 200,
              maximum: 1000,
            }),
            c.properties(h(2), { width: 100, height: 200, maximum: 1000 }),
          ]);
          for (let i = 0; i < p.limits.inputPerTick; ++i)
            await f.input('update', 1, {
              source: 'wheelUnknown',
              target: h(2),
              stream: 2,
              publication: old,
            });
          await f.input('update', 25, {
            source: 'wheelUnknown',
            target: h(0, 0),
            x: 25,
            y: 25,
            publication: old,
          });
          await f.ready();
          await f.present();
          await f.tick();
          const state = await f.inspect();
          assert.equal(state.nodes.find((n) => n.node.slot === 1).offset, 25);
          assert.equal(state.nodes.find((n) => n.node.slot === 2).offset, p.limits.inputPerTick);
          await f.input('update', 100, {
            source: 'wheelUnknown',
            target: h(0, 0),
            x: 25,
            y: 25,
            publication: old,
          });
          assert.equal(
            (await f.inspect()).rejected,
            1n,
            'Retired snapshots are explicitly rejected',
          );
          assert.ok(state.reservedBytes > 0n);
        }),
    );
    test(
      `${profile}: admitted pointer release uses collected geometry after a new layout is published`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { x: 10, y: 10, width: 80, height: 40 }),
            c.control(h(1), { kind: 'button' }),
            c.semantics(h(1), {
              role: 'button',
              label: 'captured',
              actions: p.semanticsActions.activate,
            }),
          ]);
          await f.input('begin', 0, { pointer: true, x: 30, y: 30 });
          await f.tick();
          await f.present();
          const collected = (await f.inspect()).publication;
          await f.commit([c.properties(h(1), { x: 150, y: 10, width: 80, height: 40 })]);
          await f.ready();
          assert.equal(
            (
              await f.input('end', 0, {
                pointer: true,
                x: 30,
                y: 30,
                publication: collected,
              })
            ).status,
            p.statuses.ok,
          );
          await f.present();
          await f.tick();
          const events = (await f.send(p.opcodes.pollInteractionEvents)).events;
          assert.equal(
            events.filter(
              (event) => event.kind === p.events.semanticAction && event.node.slot === 1,
            ).length,
            1,
            'The admitted release must activate the control at the collected position',
          );
          assert.equal((await f.inspect()).controlWork, 1n);
          assert.equal(
            (
              await f.input('begin', 0, {
                pointer: true,
                x: 30,
                y: 30,
                publication: collected,
              })
            ).status,
            p.statuses.stale,
            'A fresh packet cannot reuse the retired layout',
          );
        }),
    );
    test(
      `${profile}: an active pointer retains bounded collected publications until its terminal, then releases them`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { x: 10, y: 10, width: 80, height: 40 }),
            c.control(h(1), { kind: 'button' }),
            c.semantics(h(1), {
              role: 'button',
              label: 'captured',
              actions: p.semanticsActions.activate,
            }),
          ]);
          await f.input('begin', 0, { pointer: true, x: 30, y: 30 });
          await f.tick();
          await f.present();
          const collected = (await f.inspect()).publication;
          await f.commit([c.properties(h(1), { x: 150, y: 10, width: 80, height: 40 })]);
          await f.ready();
          await f.present();
          const held = (await f.inspect()).reservedBytes;
          assert.equal(
            (
              await f.input('end', 0, {
                pointer: true,
                x: 30,
                y: 30,
                publication: collected,
              })
            ).status,
            p.statuses.ok,
          );
          await f.tick();
          await f.present();
          const state = await f.inspect();
          assert.equal(state.controlWork, 1n);
          assert.ok(
            state.reservedBytes < held,
            'Terminal releases the retired captured scene and snapshot holds',
          );
          assert.equal(
            (
              await f.input('begin', 0, {
                pointer: true,
                x: 30,
                y: 30,
                publication: collected,
              })
            ).status,
            p.statuses.stale,
          );
        }),
    );
    test(
      `${profile}: canonical focus owners redirect semantic peers and queue copied keys with exact session fencing`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'stack'),
            c.properties(h(1), { width: 300, height: 100 }),
            c.eventPolicy(h(1), p.eventPolicies.canonicalKeyboard),
            c.create(h(2), 'box'),
            c.properties(h(2), { width: 100, height: 100 }),
            c.attach(h(2), h(1)),
            c.eventPolicy(h(2), p.eventPolicies.focusOwner | p.eventPolicies.focusEnabled),
            c.create(h(3), 'box'),
            c.properties(h(3), { x: 10, y: 10, width: 40, height: 30 }),
            c.attach(h(3), h(2)),
            c.semantics(h(3), {
              role: 'group',
              label: 'internal focus group',
              flags: p.semanticsFlags.focusable,
              actions: p.semanticsActions.focus | p.semanticsActions.activate,
            }),
            c.create(h(5), 'box'),
            c.properties(h(5), { width: 40, height: 30 }),
            c.attach(h(5), h(3)),
            c.semantics(h(5), {
              role: 'button',
              label: 'source focus peer',
              flags: p.semanticsFlags.focusable,
              actions: p.semanticsActions.focus | p.semanticsActions.activate,
            }),
            c.create(h(4), 'box'),
            c.properties(h(4), { x: 120, width: 100, height: 100 }),
            c.attach(h(4), h(1), 1),
            c.eventPolicy(
              h(4),
              p.eventPolicies.focusOwner |
                p.eventPolicies.focusEnabled |
                p.eventPolicies.skipTraversal,
            ),
            c.create(h(6), 'box'),
            c.properties(h(6), { x: 220, width: 80, height: 100 }),
            c.attach(h(6), h(1), 2),
            c.semantics(h(6), {
              role: 'button',
              label: 'semantic parent',
              flags: p.semanticsFlags.focusable,
              actions: p.semanticsActions.focus | p.semanticsActions.activate,
            }),
            c.create(h(7), 'box'),
            c.properties(h(7), { width: 80, height: 100 }),
            c.attach(h(7), h(6)),
            c.eventPolicy(h(7), p.eventPolicies.focusOwner | p.eventPolicies.focusEnabled),
            c.create(h(8), 'box'),
            c.properties(h(8), { width: 60, height: 40 }),
            c.attach(h(8), h(7)),
            c.semantics(h(8), {
              role: 'group',
              flags: p.semanticsFlags.focusable,
              actions: p.semanticsActions.focus,
            }),
          ]);
          let state = await f.inspect();
          assert.equal(state.publishedDocument, state.document);
          assert.equal(state.publishedMetrics, state.metrics);
          assert.equal(state.publishedDevice, state.device);
          assert.equal(state.canonicalKeyboard, true);
          assert.equal(
            (await f.send(p.opcodes.focus, focusBody(h(3), state.publication, 0n, true))).status,
            p.statuses.ok,
          );
          state = await f.send(p.opcodes.semanticsSnapshot);
          assert.deepEqual(state.focus.node, h(2));
          assert.deepEqual(state.focus.peer, h(5));
          assert.deepEqual(
            state.nodes.filter((n) => n.hasFocus).map((n) => n.node),
            [h(5)],
          );
          assert.equal(
            state.nodes.find((n) => n.node.slot === 5).hasFocus,
            true,
            'The ARIA/UIA peer reflects its canonical focus owner',
          );
          const session = state.focus.session;
          assert.equal(
            (await f.send(p.opcodes.focus, focusBody(h(4), state.publication, 0n, true))).status,
            p.statuses.stale,
            'Expected unfocused is exact, not a wildcard',
          );
          assert.deepEqual(
            (await f.send(p.opcodes.pollInteractionEvents)).events.find(
              (e) => e.kind === p.events.focusChanged,
            )?.focusPeer,
            h(5),
          );
          await f.send(p.opcodes.key, keyBody(state.publication, 39, true, 2));
          await f.send(p.opcodes.key, keyBody(state.publication, 39, false, 2));
          await f.send(p.opcodes.key, keyBody(state.publication, 39, true, 2, true));
          const events = (await f.send(p.opcodes.pollInteractionEvents)).events.filter(
            (e) => e.kind === p.events.key,
          );
          assert.deepEqual(
            events.map((e) => e.status),
            [p.keyKinds.down, p.keyKinds.up, p.keyKinds.repeat],
          );
          assert.ok(
            events.every(
              (e) => e.node.slot === 1 && e.epoch === session && e.detail === (39n | (2n << 32n)),
            ),
          );
          assert.equal((await f.inspect()).keyWork, 3n);
          assert.equal(
            (await f.send(p.opcodes.key, keyBody(state.publication, 39, true, 16))).status,
            p.statuses.invalidValue,
          );
          assert.equal(
            (await f.send(p.opcodes.key, keyBody(state.publication, 39, false, 0, true))).status,
            p.statuses.invalidValue,
          );
          state = await f.send(p.opcodes.focus, focusBody(h(6), state.publication, session, true));
          assert.equal(state.status, p.statuses.ok);
          assert.deepEqual(state.focus.node, h(7));
          assert.deepEqual(
            state.focus.peer,
            h(6),
            'Material-style semantic ancestors use their unique focus descendant',
          );
          state = await f.send(p.opcodes.semanticsSnapshot);
          assert.deepEqual(
            state.nodes.filter((n) => n.hasFocus).map((n) => n.node),
            [h(6)],
          );
          assert.equal(
            (
              await f.send(
                p.opcodes.focus,
                focusBody(h(4), state.publication, state.focus.session, true),
              )
            ).status,
            p.statuses.ok,
          );
          const epoch = (await f.inspect()).document;
          assert.equal(
            (await f.commit([c.eventPolicy(h(4), p.eventPolicies.focusEnabled)])).status,
            p.statuses.invalidValue,
          );
          assert.equal((await f.inspect()).document, epoch);
          await f.commit([c.eventPolicy(h(4), p.eventPolicies.focusOwner)]);
          state = await f.inspect();
          assert.equal(
            state.focus,
            null,
            'Disabling the source focus owner retires native focus immediately',
          );
          assert.notEqual(
            state.publishedDocument,
            state.document,
            'Pending metadata cannot masquerade as current published geometry',
          );
          assert.ok(state.focusWork >= 3n);
        }),
    );
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
          await f.input('update', 0, {
            pointer: true,
            hover: true,
            x: 50,
            y: 30,
          });
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
          await f.commit([
            c.control(h(1), null),
            c.semantics(h(1), {
              role: 'checkbox',
              label: 'mixed source checkbox',
              flags: p.semanticsFlags.mixed,
            }),
          ]);
          await f.ready();
          frame = await f.present();
          assert.equal(frame.nodes[0].semantics.flags, p.semanticsFlags.mixed);
          const mixedDocument = frame.document;
          for (const flags of [
            p.semanticsFlags.mixed,
            p.semanticsFlags.mixed | p.semanticsFlags.checked,
          ]) {
            assert.equal(
              (
                await f.commit([
                  c.semantics(h(1), {
                    role: flags === p.semanticsFlags.mixed ? 'radio' : 'checkbox',
                    flags,
                  }),
                ])
              ).status,
              p.statuses.invalidValue,
            );
            assert.equal(
              (await f.inspect()).document,
              mixedDocument,
              'Malformed mixed semantics must reject atomically',
            );
          }
          for (const role of ['radio', 'radioGroup']) {
            await f.commit([c.semantics(h(1), { role, label: 'source selection' })]);
            await f.ready();
            frame = await f.present();
            assert.equal(frame.nodes[0].semantics.role, p.semanticsRoles[role]);
          }
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
          await f.input('begin', 0, {
            pointer: true,
            x: 100,
            y: 20,
            stream: 2,
          });
          await f.tick();
          await f.input('update', 0, {
            pointer: true,
            x: 180,
            y: 20,
            stream: 2,
          });
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
