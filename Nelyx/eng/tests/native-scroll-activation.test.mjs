// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyNativeScrollActivation } from './native-scroll-activation.js';
const timeout = 1_200_000;
function observations(change = {}) {
  const pointer = {
      strategy: 'linear-prefix',
      prefixQueries: 2,
      prefixNodes: 2,
      queries: 2,
      visited: 4,
      bytes: 320,
      tsFallbacks: 1,
      closed: true,
    },
    section = {
      decisions: 3,
      visited: 6,
      retain: 2,
      evict: 1,
      prepare: 0,
      appliedRetain: 2,
      appliedEvict: 1,
      appliedPrepare: 0,
    };
  return [
    'NELYX_INPUT_GEOMETRY_STATUS ' +
      JSON.stringify({
        kind: 'manual',
        ownerGeneration: 7,
        engine: {
          scroll: {
            selected: { input: true, frame: true, pointer: true, section: true },
            pointer,
            section,
            credit: { wakes: 3, attempts: 2, submissions: 2, blockedInput: 1 },
            host: [2, 4, 2, 4, 2, 3, 0, 0, 3, 0, 0, 0, 0],
            closed: true,
            ...change,
          },
        },
      }),
    'NELYX_NATIVE_SCROLL_USAGE ' +
      JSON.stringify({
        schema: 1,
        ownerGeneration: 7,
        mode: 'scroll',
        beganQpcMs: 1000,
        endedQpcMs: 2000,
        overflow: false,
        timing: 'counters-only',
        totals: [2, 4, 128, 3, 6, 2, 1, 0],
      }),
    'NELYX_SCROLL_HOST_USAGE ' +
      JSON.stringify({
        schema: 1,
        ownerGeneration: 7,
        beganQpcMs: 1000,
        endedQpcMs: 2000,
        timing: 'counters-only',
        overflow: false,
        binCount: 0,
        pendingPackets: 0,
        pendingBatches: 0,
        retiredPackets: 0,
        pendingStaged: 0,
        pendingJsPackets: 0,
        mailboxOwners: 0,
        totals: [2, 4, 2, 4, 2, 3, 3, 3],
      }),
  ];
}
test(
  'scroll verifier rejects missing native work, false cleanup and SDK/native disagreement',
  { timeout },
  () => {
    const result = verifyNativeScrollActivation(observations(), {
      mode: 'scroll',
      requireNativeWork: true,
    });
    assert(Object.values(result.modules).every((value) => value === 'observed'));
    assert.equal(result.performanceAccepted, false);
    assert.throws(
      () => verifyNativeScrollActivation(observations().slice(0, 1), { mode: 'scroll' }),
      /Missing/,
    );
    assert.throws(
      () =>
        verifyNativeScrollActivation(
          observations({ host: [0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0] }),
          {
            mode: 'scroll',
            requireNativeWork: true,
          },
        ),
      /No relevant/,
    );
    assert.throws(
      () =>
        verifyNativeScrollActivation(
          observations({ host: [2, 4, 2, 4, 2, 3, 1, 1, 3, 0, 0, 0, 0] }),
          {
            mode: 'scroll',
          },
        ),
      /Unretired/,
    );
    assert.throws(
      () =>
        verifyNativeScrollActivation(observations({ pointer: { queries: 1 } }), { mode: 'scroll' }),
      /pointer counts/,
    );
  },
);

test(
  'scroll QPC verification excludes startup and requires real work inside every complete input bucket',
  { timeout },
  () => {
    const base = observations().map((line) => {
      const at = line.indexOf(' {'),
        prefix = line.slice(0, at + 1),
        value = JSON.parse(line.slice(at + 1));
      if (value.timing) {
        value.timing = 'qpc-buckets';
        value.beganQpcMs = 50;
        value.endedQpcMs = 6050;
        if ('binCount' in value) value.binCount = 1;
      }
      return prefix + JSON.stringify(value);
    });
    const native = [2, 4, 128, 3, 6, 2, 1, 0],
      host = [2, 4, 2, 4, 2, 3, 3, 3],
      chunks = (second) => [
        'NELYX_NATIVE_SCROLL_BINS ' +
          JSON.stringify({ schema: 1, index: 0, rows: [[second, ...native]] }),
        'NELYX_SCROLL_HOST_BINS ' +
          JSON.stringify({ schema: 1, index: 0, rows: [[second, ...host]] }),
      ],
      check = { nativeBeginMs: 1000, nativeEndMs: 5000 };
    assert.equal(
      verifyNativeScrollActivation([...base, ...chunks(0)], { mode: 'scroll', checks: [check] })
        .nativeDuringEveryLeg,
      false,
    );
    assert.equal(
      verifyNativeScrollActivation([...base, ...chunks(2)], { mode: 'scroll', checks: [check] })
        .nativeDuringEveryLeg,
      true,
    );
    assert.throws(
      () => verifyNativeScrollActivation(base, { mode: 'scroll', checks: [check] }),
      /Incomplete/,
    );
    assert.throws(
      () =>
        verifyNativeScrollActivation([...base, ...chunks(2)], {
          mode: 'scroll',
          checks: [{ nativeBeginMs: 1, nativeEndMs: 5000 }],
        }),
      /outside/,
    );
  },
);
