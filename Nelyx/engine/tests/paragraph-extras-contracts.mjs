// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { commands as c, protocol as p } from '../../runtime/engine-client/index.ts';
import {
  paragraphOptionsBytes,
  readParagraphOptions,
} from '../../runtime/engine-client/paragraph.ts';
export const strut = (extra = {}) => ({
  fontFamilies: ['NelyxDefault'],
  fontSize: 24,
  fontWeight: 500,
  fontStyle: 'italic',
  height: 1.4,
  leading: 0.2,
  halfLeading: true,
  forceStrutHeight: true,
  ...extra,
});
const placeholder = (offset, extra = {}) => ({
  offset,
  width: 24,
  height: 32,
  alignment: 'baseline',
  baseline: 'alphabetic',
  baselineOffset: 20,
  ...extra,
});
export function paragraphExtrasContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded'])
    test(
      `${profile}: strut and placeholder wire preserves geometry declarations and rejects malformed or displaced slots atomically`,
      { timeout },
      () =>
        using(profile, async (f) => {
          const text = 'A😀\ufffcב\ufffc',
            options = {
              strut: strut(),
              placeholders: [
                placeholder(3),
                placeholder(5, { baseline: 'ideographic', alignment: 'bottom' }),
              ],
            };
          const decoded = readParagraphOptions(paragraphOptionsBytes(options));
          assert.deepEqual(decoded.strut, options.strut);
          assert.deepEqual(decoded.placeholders, options.placeholders);
          await f.start([
            c.create(h(1), 'paragraph'),
            c.properties(h(1), { width: 180, height: 100 }),
            c.paragraphOptions(h(1), options),
            c.text(h(1), text, 18, 0xff172033),
          ]);
          const before = await f.inspect();
          const published = (await f.send(p.opcodes.layoutSnapshot)).nodes[0].paragraph;
          assert.deepEqual(published.strut, options.strut);
          assert.deepEqual(published.placeholders, options.placeholders);
          const strutOffset = p.paragraphBytes + 8,
            slotOffset = strutOffset + 64;
          for (const [mutate, status] of [
            [(v) => v.setUint32(56, 1, true), p.statuses.invalidValue],
            [(v) => v.setUint32(60, 65, true), p.statuses.budgetExceeded],
            [(v) => v.setUint32(strutOffset, 8, true), p.statuses.invalidValue],
            [(v) => v.setUint32(strutOffset + 8, 257, true), p.statuses.budgetExceeded],
            [(v) => v.setFloat64(strutOffset + 16, 513, true), p.statuses.invalidValue],
            [(v) => v.setFloat64(strutOffset + 24, -2, true), p.statuses.invalidValue],
            [(v) => v.setUint32(strutOffset + 40, 1, true), p.statuses.invalidValue],
            [(v) => v.setUint32(slotOffset + 4, 6, true), p.statuses.invalidValue],
            [(v) => v.setUint32(slotOffset + 8, 2, true), p.statuses.invalidValue],
            [(v) => v.setUint32(slotOffset + 12, 1, true), p.statuses.invalidValue],
            [(v) => v.setFloat64(slotOffset + 16, -1, true), p.statuses.invalidValue],
            [(v) => v.setFloat64(slotOffset + 32, Infinity, true), p.statuses.invalidValue],
          ]) {
            const raw = c.paragraphOptions(h(1), options),
              view = new DataView(raw.buffer, raw.byteOffset + 16, raw.length - 16);
            mutate(view);
            assert.equal((await f.commit([raw])).status, status);
            assert.equal((await f.inspect()).document, before.document);
            const bytes = paragraphOptionsBytes(options);
            mutate(new DataView(bytes.buffer));
            assert.throws(() => readParagraphOptions(bytes));
          }
          for (const change of [
            c.text(h(1), 'A😀xבx', 18, 0xff172033),
            c.paragraphOptions(h(1), {
              ...options,
              placeholders: [placeholder(2), placeholder(5)],
            }),
          ]) {
            assert.equal((await f.commit([change])).status, p.statuses.invalidValue);
            assert.equal((await f.inspect()).document, before.document);
          }
          const slots = Array.from({ length: 64 }, (_, i) =>
            placeholder(i, {
              alignment: ['baseline', 'aboveBaseline', 'belowBaseline', 'top', 'bottom', 'middle'][
                i % 6
              ],
            }),
          );
          assert.equal(
            (
              await f.commit([
                c.text(h(1), '\ufffc'.repeat(64), 18, 0xff172033),
                c.paragraphOptions(h(1), {
                  strut: strut({ fontWeight: 1000, fontSize: 512, height: 100, leading: 100 }),
                  placeholders: slots,
                }),
              ])
            ).status,
            p.statuses.accepted,
          );
          await f.ready();
          await f.present();
          assert.deepEqual(
            (await f.send(p.opcodes.layoutSnapshot)).nodes[0].paragraph.placeholders,
            slots,
          );
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
