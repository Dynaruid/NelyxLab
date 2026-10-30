// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNativeFrameTerminals } from './windows-frame-terminals.ts';
const timeout = 1_200_000,
  entry = (stage, extra = {}) => ({
    stage,
    view: 1,
    contextGeneration: 1,
    submission: 1,
    ownerGeneration: 1,
    frameSequence: 1,
    surfaceGeneration: 1,
    ...extra,
  }),
  packet = (stages) => stages.map((stage) => entry(stage));
test(
  'capture prefixes, repeated retained frames and in-flight tails keep complete packet ownership',
  { timeout },
  () => {
    assert.deepEqual(
      validateNativeFrameTerminals(packet([1, 2, 3, 0, 1, 2, 3, 0, 1, 4, 3, 0, 1])),
      { completed: 2, superseded: 1 },
    );
  },
);
test(
  'interleaved views with the same local submission retain separate packet sequences',
  { timeout },
  () => {
    const first = packet([0, 1, 2, 3]),
      second = packet([0, 1, 4, 3]).map((value) => ({ ...value, view: 2 }));
    assert.deepEqual(
      validateNativeFrameTerminals(first.flatMap((value, index) => [value, second[index]])),
      { completed: 2, superseded: 1 },
    );
  },
);

test(
  'prepared resize copies keep their final terminal after the actual geometry commit',
  { timeout },
  () => {
    assert.deepEqual(validateNativeFrameTerminals(packet([6, 7, 0, 1, 12, 8, 9, 2, 3, 10])), {
      completed: 1,
      superseded: 0,
    });
    assert.deepEqual(validateNativeFrameTerminals(packet([0, 1, 12, 11, 4, 3])), {
      completed: 1,
      superseded: 1,
    });
  },
);
test('discarded middle observations and malformed later replays are rejected', { timeout }, () => {
  for (const stages of [
    [0, 3],
    [0, 1, 3],
    [0, 1, 3, 2],
    [0, 1, 2, 3, 1, 2, 3],
    [0, 1, 0],
    [0, 1, 2, 3, 0, 2, 3],
  ])
    assert.throws(() => validateNativeFrameTerminals(packet(stages)), /terminal order|restarted/);
});
test('failure observations and missing immutable identity remain errors', { timeout }, () => {
  assert.throws(() => validateNativeFrameTerminals(packet([5])), /Native frame failed/);
  assert.throws(
    () =>
      validateNativeFrameTerminals(
        packet([0, 1, 2, 3]).map((value) => ({ ...value, ownerGeneration: 0 })),
      ),
    /immutable Core frame identity/,
  );
});
