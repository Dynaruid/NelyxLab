// SPDX-License-Identifier: BSD-3-Clause
import { expect, test } from 'bun:test';
import type { Argument, Declaration, Reference } from './body-ir.ts';
import { emitDart } from './dart-emitter.ts';
import { wholeMillisecondDurationConstants } from './design-duration.ts';

const at = { offset: 0, length: 1 };
const reference = (id: string): Reference => ({
  id,
  name: 'Duration',
  owner: null,
  local: false,
  static: false,
});
const literal = (name: string, value: number): Argument => ({
  name,
  value: { ...at, kind: 'literal', type: 'int', value },
});
const duration = (
  args: Argument[],
  id = 'dart:core::Duration.Duration.new:CONSTRUCTOR',
): Declaration => ({
  ...at,
  kind: 'constant',
  name: 'fixtureDuration',
  owner: null,
  reference: reference('fixture.dart::fixtureDuration:GETTER'),
  type: 'Duration',
  value: {
    ...at,
    kind: 'construct',
    constructedType: {
      kind: 'interface',
      arguments: [],
      nullable: false,
      reference: reference('dart:core::Duration:CLASS'),
    },
    type: 'Duration',
    name: 'Duration',
    constructor: null,
    const: true,
    reference: reference(id),
    args,
  },
});

test('emits exact millisecond duration defaults without allowing shadow constructors or lossy values', () => {
  const source = duration([literal('seconds', 2), literal('milliseconds', 150)]);
  expect(wholeMillisecondDurationConstants([source])).toBe(true);
  const emitted = emitDart([source], {
    source: 'fixture.dart',
    sha256: '0'.repeat(64),
    destination: 'fixture.ts',
    symbols: ['fixtureDuration'],
    durationUnit: 'milliseconds',
  });
  expect(emitted).toContain('fixtureDuration: number = 0 + 2 * 1000 + 150 * 1');
  expect(wholeMillisecondDurationConstants([duration([literal('microseconds', 1)])])).toBe(false);
  expect(
    wholeMillisecondDurationConstants([duration([literal('days', Number.MAX_SAFE_INTEGER)])]),
  ).toBe(false);
  expect(
    wholeMillisecondDurationConstants([
      duration([], 'fixture.dart::Duration.Duration.new:CONSTRUCTOR'),
    ]),
  ).toBe(false);
}, 1_200_000);
