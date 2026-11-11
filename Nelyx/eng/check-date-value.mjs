// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Date value checks exceeded 20 minutes');
}, 1200000);
const NativeDate = globalThis.Date;
const zone = process.env.TZ;
try {
  const result = await build({
    stdin: {
      contents: "export { DateTime } from './packages/material/src/internal/date/date-time.ts';",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  const { DateTime } = await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
  let allocations = 0;
  globalThis.Date = class extends NativeDate {
    constructor(...args) {
      super(...args);
      ++allocations;
    }
  };
  const components = (date) => [date.year, date.month, date.day, date.weekday];
  const oracle = (date) => [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getDay() || 7,
  ];
  for (const tz of ['UTC', 'Asia/Seoul', 'America/New_York']) {
    process.env.TZ = tz;
    for (const parts of [
      [2024, 2, 29],
      [2026, 3, 8, 2, 30],
      [2026, 11, 1, 1, 30],
      [99, 1, 1],
      [2026, 13, 0],
      [-1, 1, 1],
    ]) {
      const date = new DateTime(...parts);
      const expected = new NativeDate(0);
      expected.setFullYear(parts[0], parts[1] - 1, parts[2]);
      expected.setHours(parts[3] ?? 0, parts[4] ?? 0, 0, 0);
      assert.equal(date.millisecondsSinceEpoch, expected.getTime());
      const before = allocations;
      assert.deepEqual(components(date), oracle(expected));
      assert.deepEqual(components(date), oracle(expected));
      assert.equal(allocations, before, 'Civil component reads allocated Date objects');
      const copy = date.toDate();
      copy.setTime(0);
      assert.deepEqual(components(date), oracle(expected), 'Mutable export changed its DateTime');
      assert(DateTime.fromDate(expected).equals(date));
      assert(DateTime.fromMillisecondsSinceEpoch(expected.getTime()).equals(date));
      assert(Object.isFrozen(date));
    }
  }
  const date = DateTime.fromMillisecondsSinceEpoch(NativeDate.UTC(2026, 10, 12, 1));
  for (const tz of ['UTC', 'Asia/Seoul', 'America/New_York']) {
    process.env.TZ = tz;
    assert.deepEqual(
      components(date),
      oracle(new NativeDate(date.millisecondsSinceEpoch)),
      'Existing value ignored a host time zone change',
    );
  }
  const original = new NativeDate(2026, 10, 12);
  const value = DateTime.fromDate(original);
  original.setTime(0);
  assert.notEqual(value.millisecondsSinceEpoch, original.getTime());
  assert.throws(() => DateTime.fromMillisecondsSinceEpoch(8640000000000001));
  assert.throws(() => new DateTime(2026.5));
  console.log(
    'Date value: allocation-free civil reads, mutable copy isolation, year/rollover/leap/DST and live time-zone oracle PASS.',
  );
} finally {
  globalThis.Date = NativeDate;
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
  clearTimeout(watchdog);
}
