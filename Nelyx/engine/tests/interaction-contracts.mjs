// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  body,
  writeHandle,
  layoutQueryBody,
  measurementBody,
  editBody,
  focusBody,
  semanticActionBody,
  decodeUtf8,
  EngineClient,
  EngineError,
  WidgetHost,
  State,
  StatefulWidget,
  StatelessWidget,
  InheritedWidget,
  GlobalKey,
  ValueKey,
  Box,
  Row,
  Column,
  Text,
  Button,
  Navigator,
  NavigatorController,
} from '../../runtime/engine-client/index.ts';

export function interactionContracts({ using, timeout, h }) {
  const bounds = { kind: 'unbounded' };
  const measure = (request) => {
    const n = request.nodes[0],
      text = decodeUtf8(request.blobs.find((b) => b.type === 1)?.bytes ?? new Uint8Array());
    const width = n.flags & 32 ? text.length * 8 : n.width,
      height = Math.max(20, Math.ceil((text.length * 8) / Math.max(1, width)) * 20);
    return {
      width,
      height,
      minimum: 8,
      maximum: Math.max(8, text.length * 8),
      baseline: 15,
      ...(n.editing
        ? {
            geometry: {
              revision: n.editing.revision,
              caret: { x: n.editing.extent * 8, y: 0, width: 1, height: 20 },
              selection:
                n.editing.base === n.editing.extent
                  ? []
                  : [
                      {
                        x: Math.min(n.editing.base, n.editing.extent) * 8,
                        y: 0,
                        width: Math.abs(n.editing.base - n.editing.extent) * 8,
                        height: 20,
                      },
                    ],
            },
          }
        : {}),
    };
  };
  const pump = async (f) => {
    let state;
    for (let i = 0; i < 30; ++i) {
      state = await f.step();
      if (state.measureRequest) {
        const request = await f.send(p.opcodes.measureRequest);
        assert.equal(
          (await f.send(p.opcodes.measureResult, measurementBody(request, measure(request))))
            .status,
          p.statuses.ok,
        );
      }
      if (!state.preparation && !state.pendingDocument) break;
      if (state.preparationReady) {
        await f.tick();
        break;
      }
    }
    return f.inspect();
  };
  const query = async (f, node, kind, id, horizontal = bounds, vertical = bounds) => {
    let result = await f.send(
      p.opcodes.layoutQuery,
      layoutQueryBody(node, kind, horizontal, vertical),
      { id },
    );
    assert.equal(result.status, p.statuses.pending);
    for (let i = 0; i < 30; ++i) {
      await f.step();
      let state = await f.inspect();
      if (state.measureRequest) {
        const request = await f.send(p.opcodes.measureRequest);
        assert.equal(
          (await f.send(p.opcodes.measureResult, measurementBody(request, measure(request))))
            .status,
          p.statuses.ok,
        );
      }
      result = await f.send(p.opcodes.layoutQueryResult, undefined, { id });
      if (result.status !== p.statuses.pending) break;
    }
    assert.equal(result.status, p.statuses.ok);
    assert.ok(result.queryWork > 0n);
    return result.layoutQuery;
  };
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: focus reveals nested viewports on both axes and user scrolling is not pinned`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'scrollViewport'),
            c.properties(h(1), { width: 100, height: 100, maximum: 500, horizontal: true }),
            c.create(h(2), 'scrollViewport'),
            c.properties(h(2), { x: 200, width: 100, height: 100, maximum: 500 }),
            c.attach(h(2), h(1)),
            c.create(h(3), 'box'),
            c.properties(h(3), { y: 220, width: 80, height: 30 }),
            c.attach(h(3), h(2)),
            c.semantics(h(3), {
              role: 'button',
              flags: p.semanticsFlags.focusable,
              actions: p.semanticsActions.focus,
            }),
          ]);
          const before = await f.inspect();
          assert.equal(
            (await f.send(p.opcodes.focus, focusBody(h(3), before.publication))).status,
            p.statuses.ok,
          );
          await f.tick();
          let state = await f.inspect();
          assert.equal(state.nodes.find((n) => n.node.slot === 1).offset, 180);
          assert.equal(state.nodes.find((n) => n.node.slot === 2).offset, 150);
          assert.equal(state.contentWork, before.contentWork);
          assert.equal(state.transactionWork, before.transactionWork);
          await f.present();
          await f.input('update', -20, { target: h(2), source: 'wheelUnknown' });
          await f.tick();
          state = await f.inspect();
          assert.equal(state.nodes.find((n) => n.node.slot === 2).offset, 130);
          await f.tick();
          assert.equal((await f.inspect()).nodes.find((n) => n.node.slot === 2).offset, 130);
        }),
    );
    test(
      `${profile}: compositor caret blinks without App or Content work and stops on selection and blur`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([c.create(h(1), 'box'), c.properties(h(1), { width: 300, height: 200 })]);
          await f.commit([
            c.create(h(2), 'editable'),
            c.text(h(2), 'abcd'),
            c.editor(h(2)),
            c.properties(h(2), { width: 100 }),
            c.layout(h(2)),
            c.attach(h(2), h(1)),
          ]);
          await pump(f);
          const initial = await f.present(),
            focus = await f.send(p.opcodes.focus, focusBody(h(2), initial.submission));
          assert.equal(focus.status, p.statuses.ok);
          await f.tick(10);
          let frame = await f.present();
          assert.equal(frame.nodes.find((n) => n.node.slot === 2).caretVisible, true);
          const baseline = await f.inspect();
          assert.equal(baseline.nextDeadline, 10.5);
          assert.equal(
            baseline.renderWake,
            false,
            'A future caret deadline does not request a frame clock',
          );
          await f.tick(10.49);
          assert.equal((await f.send(p.opcodes.takeFrame)).status, p.statuses.notFound);
          await f.tick(10.5);
          frame = await f.present();
          assert.equal(frame.nodes.find((n) => n.node.slot === 2).caretVisible, false);
          await f.tick(11);
          frame = await f.present();
          assert.equal(frame.nodes.find((n) => n.node.slot === 2).caretVisible, true);
          const after = await f.inspect();
          assert.equal(after.layoutWork, baseline.layoutWork);
          assert.equal(after.contentWork, baseline.contentWork);
          assert.equal(after.transactionWork, baseline.transactionWork);
          assert.equal(
            (
              await f.send(
                p.opcodes.edit,
                editBody(h(2), {
                  session: focus.focus.session,
                  kind: 'selection',
                  revision: 1n,
                  base: 0,
                  extent: 2,
                }),
              )
            ).status,
            p.statuses.ok,
          );
          await pump(f);
          frame = await f.present();
          assert.equal(frame.nodes.find((n) => n.node.slot === 2).caretVisible, false);
          assert.equal((await f.inspect()).nextDeadline, null);
          await f.send(p.opcodes.focus, focusBody(null, 0n, focus.focus.session));
          await f.tick(12);
          await f.present();
          assert.equal((await f.inspect()).nextDeadline, null);
          assert.equal((await f.inspect()).renderWake, false);
        }),
    );
    test(
      `${profile}: Widget build failure rolls back allocations and reparenting activates retained State`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            key = new GlobalKey(),
            failedKey = new GlobalKey(),
            events = [],
            states = [];
          class Child extends StatefulWidget {
            createState() {
              const state = new ChildState();
              states.push(state);
              return state;
            }
          }
          class ChildState extends State {
            value = 0;
            initState() {
              this.setState(() => ++this.value);
              events.push('init');
            }
            deactivate() {
              events.push('deactivate');
            }
            activate() {
              this.setState(() => ++this.value);
              events.push('activate');
            }
            dispose() {
              events.push('dispose');
            }
            build() {
              return new Box([], { properties: { width: this.value, height: 10 } });
            }
          }
          class Failing extends StatelessWidget {
            build() {
              throw new Error('builder failed');
            }
          }
          const host = new WidgetHost(view, { pollEvents: false });
          const tree = (move = false, fail = false) =>
            new Row([
              new Box(move ? [] : [new Child(key)], { key: new ValueKey('left') }),
              new Box(move ? [new Child(key)] : [], { key: new ValueKey('right') }),
              ...(fail ? [new Child(failedKey), new Failing()] : []),
            ]);
          await host.mount(tree());
          const original = key.currentState,
            handle = key.currentNode,
            epoch = view.documentEpoch;
          assert.equal(original.value, 1);
          await assert.rejects(host.update(tree(false, true)), /builder failed/);
          assert.equal(view.documentEpoch, epoch);
          assert.equal(states[1].mounted, false);
          assert.equal(failedKey.currentState, null);
          assert.equal(key.currentState, original);
          assert.deepEqual(key.currentNode, handle);
          await host.update(tree(true));
          assert.equal(key.currentState, original);
          assert.deepEqual(key.currentNode, handle);
          assert.equal(original.value, 2);
          assert.equal(events.filter((e) => e === 'activate').length, 1);
          await host.close();
          assert.equal(
            states.every((s) => !s.mounted),
            true,
          );
          assert.equal(events.filter((e) => e === 'dispose').length, 2);
          await client.close();
        }),
    );
    test(
      `${profile}: disposal errors still close the native view and cannot resurrect State`,
      { timeout },
      () =>
        using(profile, async (_f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            states = [];
          class Broken extends StatefulWidget {
            createState() {
              const state = new BrokenState();
              states.push(state);
              return state;
            }
          }
          class BrokenState extends State {
            build() {
              return new Box();
            }
            deactivate() {
              throw new Error('deactivate failed');
            }
            dispose() {
              throw new Error('dispose failed');
            }
          }
          const host = new WidgetHost(view, { pollEvents: false });
          await host.mount(new Row([new Broken(), new Broken()]));
          const closing = host.close();
          assert.equal(host.close(), closing);
          await assert.rejects(
            closing,
            (error) => error instanceof AggregateError && error.errors.length === 4,
          );
          assert.equal(
            states.every((s) => !s.mounted && s.disposed),
            true,
          );
          assert.throws(() => states[0].setState(() => {}), /dispose/);
          const next = await client.openView(1, 2),
            nextHost = new WidgetHost(next, { pollEvents: false });
          class Reused extends StatefulWidget {
            createState() {
              return states[0];
            }
          }
          await assert.rejects(nextHost.mount(new Reused()), /disposed/);
          await nextHost.close();
          await client.close();
        }),
    );
    test(
      `${profile}: padded text, image and editing queries retain one paint origin`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([c.create(h(1), 'box'), c.properties(h(1), { width: 300, height: 200 })]);
          await f.commit([
            c.create(h(2), 'editable'),
            c.text(h(2), 'abcd'),
            c.editor(h(2)),
            c.properties(h(2), { width: 100 }),
            c.layout(h(2), { padding: { left: 8, right: 8, top: 4, bottom: 6 } }),
            c.attach(h(2), h(1)),
          ]);
          await pump(f);
          const before = await f.send(p.opcodes.layoutSnapshot),
            editor = before.nodes.find((n) => n.node.slot === 2);
          assert.equal(editor.height, 30);
          assert.equal(editor.baseline, 19);
          assert.deepEqual(editor.content, { x: 8, y: 4, width: 84, height: 20 });
          assert.equal(editor.textGeometry.caret.x, 8);
          assert.equal(editor.textGeometry.caret.y, 4);
          assert.equal((await query(f, h(2), 'minWidth', 1n)).value, 100);
          assert.equal(
            (await query(f, h(2), 'maxWidth', 2n)).value,
            100,
            'Explicit width remains the outer box width',
          );
          assert.equal(
            (await query(f, h(2), 'minHeight', 3n, { kind: 'finite', min: 0, max: 100 })).value,
            30,
          );
          const dry = await query(
            f,
            h(2),
            'dry',
            4n,
            { kind: 'finite', min: 0, max: 100 },
            { kind: 'finite', min: 0, max: 100 },
          );
          assert.equal(dry.width, 100);
          assert.equal(dry.height, 30);
          assert.equal(dry.baseline, 19);
          assert.equal(
            (await f.send(p.opcodes.layoutSnapshot)).layoutDocument,
            before.layoutDocument,
          );
          await f.commit([c.properties(h(2), { width: 0 })]);
          assert.equal((await query(f, h(2), 'minWidth', 5n)).value, 24);
          assert.equal((await query(f, h(2), 'maxWidth', 6n)).value, 48);
          await f.commit([
            c.create(h(3), 'image'),
            c.acquireResource(h(1), new Uint8Array([1])),
            c.bindResource(h(3), h(1)),
            c.layout(h(3), { padding: { left: 10, right: 10, top: 5, bottom: 5 } }),
          ]);
          const imageMeasure = (r) =>
            r.nodes[0].kind === p.kinds.image
              ? { width: 80, height: 40, minimum: 80, maximum: 80, baseline: -1 }
              : measure(r);
          for (let i = 0; i < 30; ++i) {
            const state = await f.step();
            if (state.measureRequest) {
              const request = await f.send(p.opcodes.measureRequest);
              assert.equal(
                (
                  await f.send(
                    p.opcodes.measureResult,
                    measurementBody(request, imageMeasure(request)),
                  )
                ).status,
                p.statuses.ok,
              );
            }
            if (state.preparationReady) {
              await f.tick();
              if ((await f.send(p.opcodes.layoutSnapshot)).layoutDocument === f.epoch) break;
            }
          }
          await f.tick();
          const image = (await f.send(p.opcodes.layoutSnapshot)).nodes.find(
            (n) => n.node.slot === 3,
          );
          assert.equal(image.width, 100);
          assert.equal(image.height, 50);
          assert.deepEqual(image.content, { x: 10, y: 5, width: 80, height: 40 });
          await f.commit([c.properties(h(3), { width: 400 })]);
          for (let i = 0; i < 30; ++i) {
            const state = await f.step();
            if (state.measureRequest) {
              const pending = await f.send(p.opcodes.measureRequest);
              await f.send(
                p.opcodes.measureResult,
                measurementBody(pending, imageMeasure(pending)),
              );
            }
            if (state.preparationReady) break;
          }
          await f.tick();
          const constrained = (await f.send(p.opcodes.layoutSnapshot)).nodes.find(
            (n) => n.node.slot === 3,
          );
          assert.equal(constrained.width, 300);
          assert.equal(
            constrained.height,
            150,
            'Parent clamping preserves the padded image aspect ratio',
          );
        }),
    );
    test(
      `${profile}: a composition-start notification preserves its own undo baseline`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([c.create(h(1), 'box'), c.properties(h(1), { width: 300, height: 200 })]);
          assert.equal(
            (
              await f.commit([
                c.create(h(2), 'editable'),
                c.layout(h(2)),
                c.text(h(2), 'base'),
                c.editor(h(2)),
                c.attach(h(2), h(1)),
              ])
            ).status,
            p.statuses.accepted,
          );
          await pump(f);
          const frame = await f.present(),
            focus = await f.send(p.opcodes.focus, focusBody(h(2), frame.submission));
          const apply = (value) =>
            f.send(
              p.opcodes.edit,
              editBody(h(2), {
                session: focus.focus.session,
                publication: frame.submission,
                ...value,
              }),
            );
          await apply({ kind: 'replace', revision: 1n, text: 'first', base: 5, extent: 5 });
          await apply({
            kind: 'update',
            revision: 2n,
            text: 'first',
            base: 5,
            extent: 5,
            composingStart: 5,
            composingEnd: 5,
          });
          await apply({
            kind: 'update',
            revision: 3n,
            text: 'first한',
            base: 6,
            extent: 6,
            composingStart: 5,
            composingEnd: 6,
          });
          await apply({ kind: 'update', revision: 4n, text: 'first한', base: 6, extent: 6 });
          const undo = await apply({ kind: 'undo', revision: 5n });
          assert.equal(undo.status, p.statuses.ok);
          assert.equal(undo.nodes[0].editing.text, 'first');
          await apply({
            kind: 'update',
            revision: 6n,
            text: 'first',
            base: 5,
            extent: 5,
            composingStart: 5,
            composingEnd: 5,
          });
          assert.equal(
            (await f.commit([c.editor(h(2), p.editFlags.disabled)])).status,
            p.statuses.accepted,
          );
          assert.equal((await f.inspect()).focus, null);
          const disabled = await f.send(
            p.opcodes.editSnapshot,
            body(8, (v) => writeHandle(v, 0, h(2))),
          );
          assert.equal(disabled.nodes[0].editing.composingStart, -1);
        }),
    );
    test(
      `${profile}: dry and Flex intrinsic queries freeze demand without activating geometry`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'flex'),
            c.layout(h(1), { gap: 10 }),
            ...[
              [2, 40, 0],
              [3, 20, 1],
              [4, 60, 2],
            ].flatMap(([slot, width, flex], i) => [
              c.create(h(slot), 'box'),
              c.properties(h(slot), { width, height: 20 + slot }),
              c.layout(h(slot), { flex }),
              c.attach(h(slot), h(1), i),
            ]),
          ]);
          const before = await f.send(p.opcodes.layoutSnapshot);
          assert.equal((await query(f, h(1), 'maxWidth', 1n)).value, 150);
          const dry = await query(
            f,
            h(1),
            'dry',
            2n,
            { kind: 'finite', min: 240, max: 240 },
            { kind: 'finite', min: 80, max: 80 },
          );
          assert.deepEqual([dry.width, dry.height], [240, 80]);
          const after = await f.send(p.opcodes.layoutSnapshot);
          assert.equal(after.scene, before.scene);
          assert.equal(after.property, before.property);
          assert.deepEqual(after.nodes, before.nodes);
          const payload = layoutQueryBody(h(1), 'maxWidth', bounds, bounds);
          assert.equal(
            (await f.send(p.opcodes.layoutQuery, payload, { id: 3n })).status,
            p.statuses.pending,
          );
          assert.equal(
            (await f.send(p.opcodes.layoutQuery, payload, { id: 3n })).status,
            p.statuses.pending,
          );
          assert.equal(
            (await f.send(p.opcodes.layoutQuery, payload, { id: 4n })).status,
            p.statuses.busy,
          );
          await f.resize(310, 210);
          assert.equal(
            (await f.send(p.opcodes.layoutQueryResult, undefined, { id: 3n })).status,
            p.statuses.stale,
          );
        }),
    );
    test(
      `${profile}: paragraph query measurements use separate attempt IDs and reject late replies`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([c.create(h(1), 'box')]);
          await f.commit([
            c.create(h(2), 'paragraph'),
            c.text(h(2), 'A😀한글', 18),
            c.layout(h(2)),
            c.attach(h(2), h(1)),
          ]);
          await f.send(p.opcodes.layoutQuery, layoutQueryBody(h(2), 'maxWidth', bounds, bounds), {
            id: 1n,
          });
          await f.step();
          const request = await f.send(p.opcodes.measureRequest);
          assert.ok(request.measurePreparation > 0n);
          const old = measurementBody(request, measure(request));
          assert.equal((await f.send(p.opcodes.measureResult, old)).status, p.statuses.ok);
          await pump(f); // Scene preparation and query may both request this paragraph.
          const state = await f.inspect();
          if (state.layoutQuery.status === p.statuses.pending) {
            for (let i = 0; i < 20; ++i) {
              await f.step();
              const q = await f.inspect();
              if (q.measureRequest) {
                const r = await f.send(p.opcodes.measureRequest);
                await f.send(p.opcodes.measureResult, measurementBody(r, measure(r)));
              }
              if (q.layoutQuery.status !== p.statuses.pending) break;
            }
          }
          assert.equal(
            (await f.send(p.opcodes.layoutQueryResult, undefined, { id: 1n })).status,
            p.statuses.ok,
          );
          assert.equal((await f.send(p.opcodes.measureResult, old)).status, p.statuses.stale);
          assert.equal(
            (await query(f, h(2), 'minHeight', 2n, { kind: 'finite', min: 0, max: 16 })).value,
            60,
          );
        }),
    );
    test(
      `${profile}: editing revisions, composition, UTF-16 selection, undo and generation retirement`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([c.create(h(1), 'box'), c.properties(h(1), { width: 300, height: 200 })]);
          assert.equal(
            (
              await f.commit([
                c.create(h(2), 'editable'),
                c.layout(h(2)),
                c.properties(h(2), { width: 180 }),
                c.text(h(2), 'A😀'),
                c.editor(h(2), p.editFlags.multiline),
                c.semantics(h(2), {
                  role: 'textField',
                  label: '입력',
                  hint: '한글',
                  flags: p.semanticsFlags.focusable,
                  actions: p.semanticsActions.focus | p.semanticsActions.setSelection,
                }),
                c.attach(h(2), h(1)),
              ])
            ).status,
            p.statuses.accepted,
          );
          await pump(f);
          const frame = await f.present();
          assert.ok(frame.nodes.find((n) => n.node.slot === 2).textGeometry);
          const focused = await f.send(p.opcodes.focus, focusBody(h(2), frame.submission));
          assert.equal(focused.status, p.statuses.ok);
          const session = focused.focus.session;
          const apply = async (value) =>
            f.send(
              p.opcodes.edit,
              editBody(h(2), { session, publication: frame.submission, ...value }),
            );
          let state = await apply({
            kind: 'update',
            revision: 1n,
            text: 'A😀ㅎ',
            base: 4,
            extent: 4,
            composingStart: 3,
            composingEnd: 4,
          });
          assert.equal(state.status, p.statuses.ok);
          assert.equal(state.nodes[0].editing.revision, 2n);
          assert.equal(
            (await apply({ kind: 'replace', revision: 2n, text: 'override', base: 0, extent: 0 }))
              .status,
            p.statuses.busy,
          );
          assert.equal(
            (await apply({ kind: 'selection', revision: 2n, base: 2, extent: 2 })).status,
            p.statuses.invalidValue,
          );
          assert.equal(
            (await apply({ kind: 'selection', revision: 1n, base: 0, extent: 0 })).status,
            p.statuses.baseConflict,
          );
          state = await apply({
            kind: 'update',
            revision: 2n,
            text: 'A😀한',
            base: 4,
            extent: 4,
            composingStart: 3,
            composingEnd: 4,
          });
          assert.equal(state.status, p.statuses.ok);
          state = await apply({ kind: 'update', revision: 3n, text: 'A😀한', base: 4, extent: 4 });
          assert.equal(state.nodes[0].editing.revision, 4n);
          state = await apply({ kind: 'undo', revision: 4n });
          assert.equal(state.nodes[0].editing.text, 'A😀');
          state = await apply({ kind: 'redo', revision: 5n });
          assert.equal(state.nodes[0].editing.text, 'A😀한');
          assert.equal(
            state.document,
            frame.document,
            'Native editing does not invent App document epochs',
          );
          assert.ok(state.editingWork >= 5n);
          const snapshot = await f.send(p.opcodes.semanticsSnapshot);
          const editor = snapshot.nodes.find((n) => n.node.slot === 2);
          assert.equal(editor.semantics.label, '입력');
          assert.equal(editor.editing.revision, 6n);
          assert.equal(
            editor.textGeometry,
            null,
            'Old geometry is withdrawn until this revision is prepared',
          );
          await pump(f);
          const painted = await f.present();
          assert.equal(painted.nodes.find((n) => n.node.slot === 2).textGeometry.revision, 6n);
          await f.commit([c.detach(h(2)), c.destroy(h(2)), c.create(h(2, 2), 'box')]);
          assert.equal(
            (await apply({ kind: 'selection', revision: 6n })).status,
            p.statuses.invalidHandle,
          );
          assert.equal((await f.inspect()).focus, null);
        }),
    );
    test(
      `${profile}: semantics actions use published geometry, declared capabilities and a separate App mailbox`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { width: 100, height: 50 }),
            c.semantics(h(1), {
              role: 'button',
              label: '실행',
              actions: p.semanticsActions.activate | p.semanticsActions.focus,
            }),
          ]);
          const state = await f.inspect();
          assert.equal(
            (
              await f.send(
                p.opcodes.semanticsAction,
                semanticActionBody(h(1), state.publication, 'activate'),
              )
            ).status,
            p.statuses.ok,
          );
          assert.equal(
            (
              await f.send(
                p.opcodes.semanticsAction,
                semanticActionBody(h(1), state.publication, 'increment'),
              )
            ).status,
            p.statuses.capabilityMissing,
          );
          await f.send(p.opcodes.pollEvents);
          const app = await f.send(p.opcodes.pollInteractionEvents);
          assert.equal(app.events.length, 1);
          assert.equal(app.events[0].kind, p.events.semanticAction);
          assert.equal(app.semanticsWork, 1n);
          await f.resize(200, 100);
          assert.equal(
            (
              await f.send(
                p.opcodes.semanticsAction,
                semanticActionBody(h(1), state.publication, 'activate'),
              )
            ).status,
            p.statuses.stale,
          );
        }),
    );
    test(
      `${profile}: Widget keys preserve State and handles through moves, NACK and native callbacks`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1);
          await f.resize(300, 200);
          const key = new GlobalKey(),
            events = [];
          class Counter extends StatefulWidget {
            createState() {
              return new CounterState();
            }
          }
          class CounterState extends State {
            count = 0;
            initState() {
              events.push('init');
            }
            dispose() {
              events.push('dispose');
            }
            build() {
              return new Button(String(this.count), () => this.setState(() => ++this.count));
            }
          }
          const host = new WidgetHost(view, { pollEvents: false });
          const tree = (right = false, bad = false) =>
            new Row([
              new Box(right ? [] : [new Counter(key)], {
                key: new ValueKey('a'),
                properties: { width: 100, height: 80 },
              }),
              new Box(right ? [new Counter(key)] : [], {
                key: new ValueKey('b'),
                properties: { width: bad ? -1 : 100, height: 80 },
              }),
            ]);
          await host.mount(tree());
          assert.equal(
            host.counters.moved,
            0,
            'Initial attachment preserves declaration order without redundant moves',
          );
          const before = key.currentNode,
            original = key.currentState;
          assert.equal(events.length, 1);
          await host.update(tree(true));
          assert.equal(key.currentState, original);
          assert.deepEqual(key.currentNode, before);
          assert.ok(host.counters.moved > 0);
          const accepted = view.documentEpoch;
          await assert.rejects(
            host.update(tree(false, true)),
            (e) => e.status === p.statuses.invalidValue,
          );
          assert.equal(view.documentEpoch, accepted);
          await host.update(tree(false));
          assert.equal(key.currentState, original);
          assert.deepEqual(key.currentNode, before);
          original.setState(() => ++original.count);
          await host.flush();
          assert.equal(original.count, 1);
          assert.equal(host.counters.created, 5);
          await pump(f);
          const frame = await f.present();
          assert.equal(
            (
              await f.send(
                p.opcodes.semanticsAction,
                semanticActionBody(key.currentNode, frame.submission, 'activate'),
              )
            ).status,
            p.statuses.ok,
          );
          await host.pollEvents();
          await host.flush();
          assert.equal(original.count, 2, 'Native action dispatch reaches the retained State');
          await assert.rejects(
            host.update(new Column([new Counter(key), new Counter(key)])),
            /Duplicate/,
          );
          await host.update(new Box());
          assert.equal(original.mounted, false);
          assert.equal(events.filter((e) => e === 'dispose').length, 1);
          await host.close();
          await client.close();
        }),
    );
    test(
      `${profile}: Widget ACK recovery retains the accepted baseline across repeated transport loss`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          let lostCommit = true,
            lostQuery = true;
          const port = {
            close: () => transport.close(),
            async exchange(bytes) {
              const op = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
                p.headerFields.opcode,
                true,
              );
              const result = await transport.exchange(bytes);
              if (op === p.opcodes.transaction && lostCommit) {
                lostCommit = false;
                throw new EngineError(p.statuses.timedOut, 'Lost ACK');
              }
              if (op === p.opcodes.queryResult && lostQuery) {
                lostQuery = false;
                throw new EngineError(p.statuses.timedOut, 'Lost query result');
              }
              return result;
            },
          };
          const client = await EngineClient.connect(port),
            view = await client.openView(1),
            host = new WidgetHost(view, { pollEvents: false }),
            key = new ValueKey('stable');
          await assert.rejects(
            host.mount(new Text('first', { key })),
            (e) => e.status === p.statuses.timedOut,
          );
          assert.equal(view.hasPendingTransaction, true);
          await host.update(new Text('second', { key }));
          assert.equal(view.hasPendingTransaction, false);
          assert.equal(host.counters.created, 1);
          assert.equal(host.counters.transactions, 2);
          const state = await view.request(p.opcodes.inspect);
          assert.equal(state.nodeCount, 1);
          assert.equal(state.document, 2n);
          await host.close();
          await client.close();
        }),
    );
    test(`${profile}: inherited Widget dependencies notify the retained State`, { timeout }, () =>
      using(profile, async (f, transport) => {
        class Theme extends InheritedWidget {
          constructor(value, child) {
            super(child);
            this.value = value;
          }
          updateShouldNotify(old) {
            return this.value !== old.value;
          }
        }
        class Child extends StatefulWidget {
          createState() {
            return new ChildState();
          }
        }
        class ChildState extends State {
          notifications = 0;
          didChangeDependencies() {
            ++this.notifications;
          }
          build(context) {
            return new Text(context.dependOn(Theme).value);
          }
        }
        const client = await EngineClient.connect(transport),
          view = await client.openView(1),
          host = new WidgetHost(view, { pollEvents: false }),
          key = new GlobalKey();
        await host.mount(new Theme('light', new Child(key)));
        const state = key.currentState;
        assert.equal(state.notifications, 1);
        await host.update(new Theme('light', new Child(key)));
        assert.equal(state.notifications, 1);
        await host.update(new Theme('dark', new Child(key)));
        assert.equal(state.notifications, 2);
        assert.equal(host.counters.created, 1);
        await host.close();
        await client.close();
      }),
    );
    test(
      `${profile}: Navigator retains page State and modal barriers fence hidden routes`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new WidgetHost(view, { pollEvents: false });
          const home = new GlobalKey(),
            dialog = new GlobalKey();
          const control = (key, label) =>
            new Button(label, () => {}, { key, properties: { width: 100, height: 40 } });
          const navigator = new NavigatorController(control(home, 'home'));
          await f.resize(300, 200);
          await host.mount(new Navigator(navigator));
          await pump(f);
          await f.present();
          const original = home.currentNode;
          const result = navigator.push(control(dialog, 'dialog'), { modal: true });
          await host.flush();
          await pump(f);
          await f.present();
          let semantics = await view.semanticsSnapshot();
          assert.ok(
            semantics.nodes.find((n) => n.semantics?.label === 'home').semantics.flags &
              p.semanticsFlags.hidden,
          );
          assert.equal(home.currentNode.slot, original.slot);
          assert.ok(dialog.currentNode);
          navigator.pop('done');
          assert.equal(await result, 'done');
          await host.flush();
          await pump(f);
          await f.present();
          semantics = await view.semanticsSnapshot();
          assert.ok(
            !(
              semantics.nodes.find((n) => n.semantics?.label === 'home').semantics.flags &
              p.semanticsFlags.hidden
            ),
          );
          assert.equal(dialog.currentNode, null);
          assert.equal(home.currentNode.slot, original.slot);
          await host.close();
          await client.close();
        }),
    );
  }
}
