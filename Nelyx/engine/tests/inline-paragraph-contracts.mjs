// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  measurementBody,
  body,
  writeHandle,
  layoutQueryBody,
} from '../../runtime/engine-client/index.ts';

export function inlineParagraphContracts({ using, timeout, h }) {
  const slots = [
    {
      offset: 1,
      width: 0,
      height: 0,
      alignment: 'baseline',
      baseline: 'ideographic',
      baselineOffset: 0,
    },
    {
      offset: 3,
      width: 0,
      height: 0,
      alignment: 'middle',
      baseline: 'alphabetic',
      baselineOffset: 0,
    },
  ];
  for (const profile of ['native', 'single-worker', 'threaded'])
    test(
      `${profile}: Core measures inline children before shaping and preserves scaled baselines, placement, reuse and hidden input`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'box'),
            c.layout(h(1)),
            c.properties(h(1), { width: 240, height: 120 }),
          ]);
          const paragraph = (extra) => ({ inlineChildren: true, placeholders: slots, ...extra });
          const committed = await f.commit([
            c.create(h(2), 'paragraph'),
            c.attach(h(2), h(1)),
            c.layout(h(2), { paragraphSizing: true }),
            c.text(h(2), 'A\ufffcB\ufffc'),
            c.paragraphOptions(h(2), paragraph()),
            c.create(h(3), 'box'),
            c.attach(h(3), h(2), 0),
            c.layout(h(3), { inlineScale: 2 }),
            c.create(h(4), 'paragraph'),
            c.attach(h(4), h(3)),
            c.layout(h(4), { paragraphSizing: true }),
            c.text(h(4), 'I'),
            c.create(h(5), 'box'),
            c.attach(h(5), h(2), 1),
            c.layout(h(5)),
            c.properties(h(5), { width: 18, height: 14 }),
            c.semantics(h(5), {
              role: 'button',
              label: 'inline action',
              actions: p.semanticsActions.activate,
            }),
            c.nativePaint(h(1), [
              {
                kind: 'shape',
                reference: h(4),
                color: 0xff224466,
                shape: {
                  kind: 'rrect',
                  radii: Array(8).fill(0),
                  strokeWidth: 0,
                  strokeColor: 0,
                  strokeAlign: 0,
                },
                geometry: { kind: 'program', rect: [0, 0, { op: 'width' }, { op: 'height' }] },
              },
            ]),
          ]);
          assert.equal(committed.status, p.statuses.accepted);
          let visible = 2,
            compressed = false,
            requests = [];
          async function prepare(negative = false) {
            for (let i = 0; i < 30; i++) {
              const state = await f.step();
              if (state.measureRequest) {
                const request = await f.send(p.opcodes.measureRequest),
                  node = request.nodes[0];
                requests.push(node.node.slot);
                let value = {
                  width: node.width,
                  height: 10,
                  minimum: 12,
                  maximum: 12,
                  baseline: 7,
                  ideographicBaseline: 9,
                };
                if (node.node.slot === 4)
                  assert.equal(
                    node.width,
                    120,
                    'The inline wrapper divides the child constraint, without bounding its height',
                  );
                else {
                  assert.equal(node.node.slot, 2);
                  assert.equal(node.paragraph.inlineChildren, true);
                  assert.deepEqual(
                    node.paragraph.placeholders.map((s) => [s.width, s.height, s.baselineOffset]),
                    [
                      [24, 20, 18],
                      [18, 14, 14],
                    ],
                  );
                  value = {
                    width: node.width,
                    height: compressed ? 10 : 40,
                    minimum: 30,
                    maximum: 100,
                    baseline: 25,
                    ideographicBaseline: 28,
                    didExceedMaxLines: visible < 2,
                    placeholders: [
                      { x: 4, y: 7, width: 24, height: 20, direction: 0 },
                      { x: 40, y: 15, width: 18, height: 14, direction: 1 },
                    ].slice(0, visible),
                  };
                  if (negative) {
                    const valid = measurementBody(request, value);
                    for (const mutate of [
                      (v) => v.setUint32(p.measureFields.placeholderReserved, 1, true),
                      (v) => v.setUint32(p.measureFields.placeholderCount, 3, true),
                      (v) => v.setUint32(p.measurementPlaceholderBytes + 32, 2, true),
                      (v) => v.setUint32(p.measurementPlaceholderBytes + 36, 1, true),
                      (v) => v.setFloat64(p.measurementPlaceholderBytes + 16, -1, true),
                      (v) => v.setFloat64(p.measureFields.ideographicBaseline, NaN, true),
                      (v) => v.setFloat64(p.measurementPlaceholderBytes + 16, 25, true),
                    ]) {
                      const invalid = valid.slice();
                      mutate(new DataView(invalid.buffer));
                      assert.notEqual(
                        (await f.send(p.opcodes.measureResult, invalid)).status,
                        p.statuses.ok,
                      );
                      assert.equal(
                        (await f.send(p.opcodes.measureRequest)).measureRequest,
                        request.measureRequest,
                      );
                    }
                    const { placeholders, ...missing } = value;
                    assert.equal(
                      (await f.send(p.opcodes.measureResult, measurementBody(request, missing)))
                        .status,
                      p.statuses.malformed,
                    );
                  }
                }
                assert.equal(
                  (await f.send(p.opcodes.measureResult, measurementBody(request, value))).status,
                  p.statuses.ok,
                );
              }
              if (
                state.layoutQuery
                  ? state.layoutQuery.status !== p.statuses.pending
                  : state.preparationReady || !state.preparation
              )
                return state;
            }
            throw Error('Inline layout continuation did not terminate');
          }
          await prepare(true);
          await f.tick();
          await f.present();
          assert.deepEqual(requests, [4, 2]);
          const snapshot = () => f.send(p.opcodes.semanticsSnapshot);
          let frame = await snapshot(),
            node = (slot) => frame.nodes.find((n) => n.node.slot === slot);
          assert.deepEqual([node(2).width, node(2).height, node(2).baseline], [100, 40, 25]);
          assert.deepEqual(
            [node(3).x, node(3).y, node(3).width, node(3).height, node(3).baseline],
            [4, 7, 24, 20, 14],
          );
          assert.deepEqual(node(4).matrix, [2, 0, 0, 2, 4, 7]);
          assert.deepEqual(
            node(1).nativePaint[0].transform,
            [2, 0, 0, 2, 4, 7],
            'Static paint references use the same scaled child matrix as frame input',
          );
          const action = () =>
            f.send(
              p.opcodes.semanticsAction,
              body(32, (v) => {
                writeHandle(v, 0, h(5));
                v.setBigUint64(8, frame.publication, true);
                v.setUint32(16, p.semanticsActions.activate, true);
              }),
            );
          assert.equal((await action()).status, p.statuses.ok);
          compressed = true;
          await f.commit([
            c.paragraphOptions(
              h(2),
              paragraph({
                strut: {
                  fontFamilies: ['NelyxDefault'],
                  fontSize: 8,
                  fontWeight: 400,
                  fontStyle: 'normal',
                  height: 0.5,
                  leading: 0,
                  halfLeading: false,
                  forceStrutHeight: true,
                },
              }),
            ),
            c.layout(h(2), { paragraphSizing: true, clipOverflow: true }),
          ]);
          await prepare();
          await f.tick();
          await f.present();
          frame = await snapshot();
          assert.equal(
            node(2).flags & p.nodeFlags.rectangularClip,
            0,
            'Inline paint beyond a forced strut does not imply visual overflow',
          );
          const activate = await f.send(
            p.opcodes.activateAt,
            body(24, (v) => {
              v.setBigUint64(0, frame.publication, true);
              v.setFloat64(8, 45, true);
              v.setFloat64(16, 20, true);
            }),
          );
          assert.equal(
            activate.status,
            p.statuses.notFound,
            'A painted inline child outside the paragraph cannot receive pointer activation',
          );
          compressed = false;
          await f.commit([c.paragraphOptions(h(2), paragraph())]);
          await prepare();
          await f.tick();
          await f.present();
          frame = await snapshot();
          const oldDocument = frame.publishedDocument;
          for (const invalid of [
            c.paragraphOptions(h(2), { placeholders: slots }),
            c.paragraphOptions(h(2), { inlineChildren: true, placeholders: slots.slice(0, 1) }),
            c.layout(h(3), { inlineScale: -1 }),
            c.layout(h(3), { inlineScale: 2, alignment: { x: 0, y: 0 } }),
          ])
            assert.notEqual((await f.commit([invalid])).status, p.statuses.accepted);
          assert.equal((await f.inspect()).publishedDocument, oldDocument);
          visible = 1;
          requests = [];
          await f.commit([c.paragraphOptions(h(2), paragraph({ maxLines: 1, ellipsis: '…' }))]);
          await prepare();
          await f.tick();
          await f.present();
          frame = await snapshot();
          assert.deepEqual(requests, [2], 'Unchanged child measurements are reused');
          assert.ok(node(5).flags & p.nodeFlags.inlineHidden);
          assert.ok(node(5).semantics.flags & p.semanticsFlags.hidden);
          assert.equal(node(5).opacity, 0);
          assert.equal(
            (await action()).status,
            p.statuses.stale,
            'An ellipsized child cannot receive a semantic action',
          );
          requests = [];
          await f.commit([c.paint(h(1), 0xff123456)]);
          await prepare();
          await f.tick();
          await f.present();
          frame = await snapshot();
          assert.deepEqual(requests, []);
          assert.equal(
            node(2).paragraph.placeholders[0].width,
            24,
            'Whole-subtree reuse retains the resolved paragraph',
          );
          assert.ok(node(5).flags & p.nodeFlags.inlineHidden);
          visible = 2;
          requests = [];
          await f.commit([c.paragraphOptions(h(2), paragraph())]);
          await prepare();
          await f.tick();
          await f.present();
          frame = await snapshot();
          assert.equal(node(5).flags & p.nodeFlags.inlineHidden, 0);
          assert.equal((await action()).status, p.statuses.ok);
          // Queries run the same child-first continuation and never publish geometry.
          const publication = frame.publication;
          await f.send(
            p.opcodes.layoutQuery,
            layoutQueryBody(
              h(2),
              'dry',
              { kind: 'finite', min: 0, max: 240 },
              { kind: 'unbounded' },
            ),
            { id: 1n },
          );
          requests = [];
          await prepare();
          const query = await f.send(p.opcodes.layoutQueryResult, undefined, { id: 1n });
          assert.equal(query.status, p.statuses.ok);
          assert.deepEqual([query.layoutQuery.width, query.layoutQuery.height], [100, 40]);
          assert.deepEqual(requests, [4, 2]);
          assert.equal((await snapshot()).publication, publication);
        }),
    );
}
