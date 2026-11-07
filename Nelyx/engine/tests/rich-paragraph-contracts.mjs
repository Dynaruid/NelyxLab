// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { commands as c, protocol as p } from '../../runtime/engine-client/index.ts';
import {
  paragraphOptionsBytes,
  readParagraphOptions,
} from '../../runtime/engine-client/paragraph.ts';
export const richRun = (start, end, extra = {}) => ({
  start,
  end,
  fontSize: 18,
  color: 0xff172033,
  fontWeight: 400,
  fontStyle: 'normal',
  fontFamilies: ['NelyxDefault'],
  locale: 'en',
  height: null,
  letterSpacing: 0,
  wordSpacing: 0,
  halfLeading: false,
  decoration: 0,
  decorationStyle: 'solid',
  decorationThickness: 1,
  ...extra,
});
export function richParagraphContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded'])
    test(
      `${profile}: rich paragraph DTO preserves declarations and rejects UTF-16/style corruption atomically`,
      { timeout },
      () =>
        using(profile, async (f) => {
          const text = 'A😀e\u0301אבג',
            runs = [
              richRun(0, 3, {
                fontFeatures: [
                  { name: 'liga', value: 0 },
                  { name: 'test', value: 0xffffffff },
                ],
                fontVariations: [{ axis: 'wght', value: 225.5 }],
                shadows: [{ color: 0xff22cc99, offset: { x: -24, y: 36 }, blurSigma: 3.5 }],
              }),
              richRun(3, 5, {
                fontSize: 28,
                color: 0xff3377cc,
                fontWeight: 700,
                backgroundColor: 0xffccddff,
                decoration: 1,
                decorationStyle: 'wavy',
                decorationColor: 0xff990022,
              }),
              richRun(5, 8, {
                locale: 'he',
                fontFamilies: ['NelyxHebrew', 'NelyxDefault'],
                fontStyle: 'italic',
              }),
            ];
          assert.deepEqual(readParagraphOptions(paragraphOptionsBytes({ runs })).runs, runs);
          await f.start([
            c.create(h(1), 'paragraph'),
            c.properties(h(1), { width: 180, height: 80 }),
            c.paragraphOptions(h(1), { runs }),
            c.text(h(1), text, 18, 0xff172033),
          ]);
          const inspect = await f.inspect(),
            snapshot = await f.send(p.opcodes.layoutSnapshot);
          assert.deepEqual(snapshot.nodes[0].paragraph.runs, runs);
          for (const invalid of [
            [c.paragraphOptions(h(1), { runs: [richRun(0, 2), richRun(2, 8)] })],
            [c.text(h(1), 'short', 18, 0xff172033)],
            [c.paragraphOptions(h(1), { runs: [richRun(0, 9)] })],
          ]) {
            assert.equal((await f.commit(invalid)).status, p.statuses.invalidValue);
            assert.equal((await f.inspect()).document, inspect.document);
            assert.deepEqual(
              (await f.send(p.opcodes.layoutSnapshot)).nodes[0].paragraph.runs,
              runs,
            );
          }
          const bytes = paragraphOptionsBytes({ runs }),
            offset = p.paragraphBytes + 8,
            effects = offset + p.paragraphRunBytes + 16 + 8;
          for (const [mutate, status] of [
            [
              (data) => data.setUint32(28, p.limits.paragraphRuns + 1, true),
              p.statuses.budgetExceeded,
            ],
            [(data) => data.setUint32(offset + 100, 1, true), p.statuses.invalidValue],
            [(data) => data.setFloat64(offset + 32, 513, true), p.statuses.invalidValue],
            [(data) => data.setUint32(offset + 88, 65, true), p.statuses.budgetExceeded],
            [(data) => data.setUint32(offset + 92, 65, true), p.statuses.budgetExceeded],
            [(data) => data.setUint32(offset + 96, 17, true), p.statuses.budgetExceeded],
            [(data) => data.setUint32(effects, 0, true), p.statuses.invalidValue],
            [(data) => data.setUint32(effects + 20, 1, true), p.statuses.invalidValue],
            [(data) => data.setFloat64(effects + 24, Infinity, true), p.statuses.invalidValue],
            [(data) => data.setUint32(effects + 36, 1, true), p.statuses.invalidValue],
            [(data) => data.setFloat64(effects + 56, -1, true), p.statuses.invalidValue],
          ]) {
            const raw = c.paragraphOptions(h(1), { runs }),
              view = new DataView(raw.buffer, raw.byteOffset + 16, raw.length - 16);
            mutate(view);
            assert.equal((await f.commit([raw])).status, status);
            assert.equal((await f.inspect()).document, inspect.document);
            const corrupt = bytes.slice();
            mutate(new DataView(corrupt.buffer));
            assert.throws(() => readParagraphOptions(corrupt));
          }
          assert.throws(
            () => readParagraphOptions(new Uint8Array([...paragraphOptionsBytes({}), 0])),
            /Trailing/,
          );
          assert.throws(
            () => paragraphOptionsBytes({ runs: [richRun(0, 1, { fontSize: 513 })] }),
            /scalar/,
          );
          for (const extra of [
            { fontFeatures: [{ name: 'bad', value: 0 }] },
            { fontFeatures: [{ name: 'liga', value: -1 }] },
            { fontVariations: [{ axis: 'wght', value: NaN }] },
            { shadows: [{ color: 0xff000000, offset: { x: 0, y: 0 }, blurSigma: 4097 }] },
          ])
            assert.throws(() => paragraphOptionsBytes({ runs: [richRun(0, 1, extra)] }));
          const ceiling = {
            fontFeatures: Array.from({ length: 64 }, (_, i) => ({ name: 'liga', value: i })),
            fontVariations: Array.from({ length: 64 }, (_, i) => ({ axis: 'wght', value: i })),
            shadows: Array.from({ length: 16 }, (_, i) => ({
              color: 0xff000000,
              offset: { x: i, y: -i },
              blurSigma: i,
            })),
          };
          assert.deepEqual(
            readParagraphOptions(paragraphOptionsBytes({ runs: [richRun(0, 8, ceiling)] })).runs[0],
            richRun(0, 8, ceiling),
          );
          assert.equal(
            (await f.commit([c.paragraphOptions(h(1), { runs: [richRun(0, 8, ceiling)] })])).status,
            p.statuses.accepted,
          );
          await f.ready();
          await f.present();
          assert.deepEqual(
            (await f.send(p.opcodes.layoutSnapshot)).nodes[0].paragraph.runs[0],
            richRun(0, 8, ceiling),
          );
          assert.ok(bytes.length < 4096);
          assert.equal(
            (
              await f.commit([
                c.text(h(1), 'plain', 18, 0xff172033),
                c.paragraphOptions(h(1), null),
              ])
            ).status,
            p.statuses.accepted,
          );
        }),
    );
}
