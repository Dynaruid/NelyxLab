import assert from 'node:assert/strict';
import { heapProfileSnapshot } from './windows-jank-heap-profile.ts';

const general = {
  numCollections: 2,
  totalTime: 1,
  totalCPUTime: 0.5,
  totalGCTime: 0.01,
  maxGCPause: 0.006,
  totalGCCPUTime: 0.02,
  maxGCCPUPause: 0.004,
  finalHeapSize: 1048576,
  peakAllocatedBytes: 524288,
  peakLiveAfterGC: 262144,
  totalAllocatedBytes: 2097152,
};
const host = (gc, gcStatsEnabled = true) => ({
  heapInfo: () => ({ heap: { 'hermes_allocatedBytes': 1234 }, gcStatsEnabled, gc }),
});
// The pinned GCBase emits a collector-specific dump before its named section.
const report =
  'Collector dump\n{"collection":1}\nGC stats:\n' +
  JSON.stringify({ type: 'hermes', version: 0, general }) +
  '\n';
assert.deepEqual(heapProfileSnapshot(host(report)), {
  heap: { 'hermes_allocatedBytes': 1234 },
  general,
});
assert.throws(() => heapProfileSnapshot(host(report, false)), /not enabled/);
assert.throws(() => heapProfileSnapshot(host(JSON.stringify({ general }))), /no statistics marker/);
assert.throws(() => heapProfileSnapshot(host('GC stats:\n{}')), /no general section/);
assert.throws(
  () =>
    heapProfileSnapshot(
      host('GC stats:\n' + JSON.stringify({ general: { ...general, maxGCPause: '0.006' } })),
    ),
  /invalid: maxGCPause/,
);
console.log('Native heap phase report: collector prefix, counters and invalid reports PASS.');
