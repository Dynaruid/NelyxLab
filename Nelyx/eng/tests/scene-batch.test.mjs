// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { submitNativeScene } from '@nelyx/skia-native/scene';
import { createEnginePath } from '@nelyx/skia-native/path';
import { Path, freezePath } from '@nelyx/core/ui/path';
import { Paint } from '@nelyx/core/ui/paint';
import { FrameDiagnostics } from '@nelyx/core/ui/frame';
const timeout = 1_200_000;
const token = {
  owner: { id: 'scene2', generation: 7 },
  sequence: 8,
  inputSequence: 9,
  metrics: {
    viewportGeneration: 2,
    rendererGeneration: 3,
    nativeContextGeneration: 4,
    nativeSurfaceGeneration: 5,
    scale: 1.25,
  },
};
const rect = { x: 1, y: 2, width: 30, height: 40 };
function capturedPath() {
  const p = new Path();
  p.moveTo(1, 2);
  p.lineTo(10, 20);
  p.close();
  return p.snapshot();
}
test(
  'frame-local tables share captured paths across draw/clip/shadow and replace supported paint/clip wrappers',
  { timeout },
  () => {
    const path = capturedPath(),
      paint = new Paint({
        color: 0xffabcdef,
        style: 'stroke',
        strokeWidth: 2,
        strokeMiterLimit: 4.75,
      }).snapshot();
    const commands = [
      { op: 'save' },
      { op: 'clipRect', rect, clipOp: 'difference', doAntiAlias: false },
      { op: 'drawPath', path, paint },
      { op: 'clipPath', path, clipOp: 'intersect', doAntiAlias: true },
      {
        op: 'drawShadow',
        path,
        color: 0x55000000,
        elevation: 2,
        transparentOccluder: false,
        devicePixelRatio: 1.25,
      },
      { op: 'drawRect', rect, paint },
      { op: 'restore' },
    ];
    let packet,
      handles,
      calls = 0;
    const api = { nelyxScenePacketVersion: () => 2 };
    const trace = new FrameDiagnostics({ now: () => performance.now() });
    submitNativeScene(
      api,
      {
        nelyxReplayDisplayList(bytes, refs) {
          calls++;
          packet = new Float64Array(bytes).slice();
          handles = [...refs];
        },
      },
      { token, commands },
      {
        sceneBatch: 'all',
        image() {
          throw Error('image');
        },
        paragraph() {
          throw Error('paragraph');
        },
      },
      undefined,
      trace,
    );
    assert.equal(calls, 1);
    assert.equal(packet[1], 2);
    assert.equal(packet[4], packet.length);
    assert.equal(packet[5], 1);
    assert.equal(packet[6], 1);
    assert.deepEqual(handles, []);
    assert.deepEqual([...packet.subarray(8, 16)], [7, 8, 2, 3, 4, 5, 1.25, 0]);
    let at = packet[7];
    const ops = [];
    while (at < packet.length) {
      const op = packet[at++],
        size = packet[at++];
      ops.push([op, [...packet.subarray(at, at + size)]]);
      at += size;
    }
    assert.deepEqual(
      ops.map(([op]) => op),
      [0, 23, 10, 11, 21, 25, 1],
    );
    assert.equal(ops[2][1][0], -2);
    assert.equal(ops[3][1][0], -2);
    assert.equal(ops[4][1][0], -2);
    const samples = trace.drain().samples;
    assert.equal(samples.find((s) => s.stage === 'scene-path-native').count, 3);
    assert.equal(samples.find((s) => s.stage === 'scene-paint-native').count, 2);
    assert.equal(samples.find((s) => s.stage === 'scene-wrappers').count, 0);
  },
);
test(
  'missing capability and native rejection are errors without retrying legacy getters',
  { timeout },
  () => {
    let calls = 0;
    const resources = { sceneBatch: 'path', image() {}, paragraph() {} };
    const target = {
      nelyxReplayDisplayList() {
        calls++;
        throw Error('native-reject');
      },
    };
    const frame = {
      token,
      commands: [
        {
          op: 'drawShadow',
          path: capturedPath(),
          color: 0x55000000,
          elevation: 2,
          transparentOccluder: false,
          devicePixelRatio: 1,
        },
      ],
    };
    assert.throws(() => submitNativeScene({}, target, frame, resources), /scene2 binding/);
    assert.equal(calls, 0);
    assert.throws(
      () => submitNativeScene({ nelyxScenePacketVersion: () => 2 }, target, frame, resources),
      /native-reject/,
    );
    assert.equal(calls, 1);
  },
);
test(
  'external Path preserves existing getter evaluation and the batch stays immutable after source mutation',
  { timeout },
  () => {
    let reads = 0,
      wire;
    const operations = [{ verb: 'moveTo', values: [1, 2] }];
    const external = {
      fillType: 'nonZero',
      get operations() {
        reads++;
        return operations;
      },
    };
    freezePath(external);
    const referenceReads = reads;
    reads = 0;
    const result = { dispose() {} };
    assert.equal(
      createEnginePath(
        {
          nelyxScenePacketVersion: () => 2,
          nelyxMakePath(bytes) {
            wire = new Float64Array(bytes).slice();
            return result;
          },
        },
        external,
        true,
      ),
      result,
    );
    operations[0].values[0] = 99;
    assert.equal(reads, referenceReads);
    assert.equal(wire[7], 1);
    assert.equal(wire[8], 2);
  },
);
