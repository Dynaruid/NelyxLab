// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { installSemanticsConflictProfile } from './windows-jank-semantics-conflict-profile.mjs';
import { representationSamplingProfile } from './windows-jank-representation-profile.mjs';

let now = 0,
  reads = [],
  expected = new Error('expected');
class Probe {
  markConflicts(group, merge = false) {
    reads.push(['receiver', this, merge]);
    const kind = group.kind;
    now += 2;
    if (kind === 'nested') this.markConflicts(group.child, true);
    now += 3;
    if (kind === 'fail') throw expected;
    return group.result;
  }
}
const owner = new Probe(),
  original = Object.getOwnPropertyDescriptor(Probe.prototype, 'markConflicts'),
  opaque = (kind, child) =>
    new Proxy(
      { kind, child, result: Symbol.for(kind) },
      {
        get(target, key, receiver) {
          reads.push(key);
          return Reflect.get(target, key, receiver);
        },
      },
    ),
  nested = opaque('nested', opaque('simple'));
const answer = owner.markConflicts(nested),
  control = reads.slice();
const profile = installSemanticsConflictProfile(Probe.prototype, () => now);
try {
  reads = [];
  assert.equal(owner.markConflicts(nested), answer);
  assert.deepEqual(reads, control, 'Inactive instrumentation cannot inspect the group');
  reads = [];
  profile.beginFrame();
  assert.equal(owner.markConflicts(nested), answer);
  assert.deepEqual(reads, control, 'Active instrumentation preserves Proxy reads and receiver');
  const frame = profile.endFrame();
  assert.deepEqual(frame, {
    groups: 2,
    outerGroups: 1,
    nestedGroups: 1,
    mergeUpGroups: 1,
    siblingGroups: 1,
    failed: 0,
    outerMs: 10,
    mergeUpMs: 0,
    siblingMs: 10,
    maxMs: 10,
  });
  profile.beginFrame();
  assert.throws(
    () => owner.markConflicts(opaque('fail'), true),
    (error) => error === expected,
  );
  const failed = profile.endFrame();
  assert.equal(failed.failed, 1);
  assert.equal(failed.mergeUpMs, 5);
  assert.throws(() => profile.endFrame(), /incomplete/);

  const trace = { samples: [], stackFrames: {} },
    map = { version: 3, sources: [], names: [], mappings: '' },
    frames = [
      {
        sequence: 1,
        begin: 0,
        end: 40,
        cpuMs: 30,
        newDays: 1,
        rebuiltDays: 0,
        semanticsConflict: frame,
      },
      {
        sequence: 2,
        begin: 50,
        end: 90,
        cpuMs: 30,
        newDays: 0,
        rebuiltDays: 1,
        semanticsConflict: failed,
      },
    ],
    report = representationSamplingProfile(trace, frames, map);
  assert.equal(report.long.semanticsConflicts.outerMs, 15);
  assert.equal(report.long.semanticsConflicts.outerUpperOfCpu, 0.25);
  assert.equal(report.newMonth.semanticsConflicts.groups, 2);
  assert.equal(report.existingMonth.semanticsConflicts.failed, 1);
  for (const invalid of [
    { ...frame, groups: 3 },
    { ...frame, failed: 3 },
    { ...frame, outerMs: 41, siblingMs: 41 },
    { ...frame, maxMs: 11 },
    { ...frame, mergeUpMs: 1 },
  ])
    assert.throws(
      () =>
        representationSamplingProfile(trace, [{ ...frames[0], semanticsConflict: invalid }], map),
      /accounting/,
    );
  assert.throws(
    () =>
      representationSamplingProfile(
        trace,
        [frames[0], { ...frames[1], semanticsConflict: undefined }],
        map,
      ),
    /coverage/,
  );
} finally {
  profile.dispose();
}
assert.deepEqual(Object.getOwnPropertyDescriptor(Probe.prototype, 'markConflicts'), original);
const interrupted = installSemanticsConflictProfile(Probe.prototype, () => now);
interrupted.beginFrame();
assert.throws(() => interrupted.dispose(), /before completion/);
assert.deepEqual(Object.getOwnPropertyDescriptor(Probe.prototype, 'markConflicts'), original);
assert.throws(() => interrupted.beginFrame(), /already active/);
let invalidClock = 0;
const invalid = installSemanticsConflictProfile(Probe.prototype, () => invalidClock--);
try {
  invalid.beginFrame();
  assert.throws(
    () => owner.markConflicts(opaque('fail')),
    (error) => error === expected,
  );
  assert.throws(() => invalid.endFrame(), /clock differs/);
} finally {
  invalid.dispose();
}
console.log(
  'Semantics conflict diagnostic: union clocks, nested/failure/Proxy observations, frame accounting and restoration PASS.',
);
