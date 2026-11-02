// SPDX-License-Identifier: BSD-3-Clause
import { createEnginePath } from '@nelyx/skia-native/path';
import { submitNativeScene } from '@nelyx/skia-native/scene';
import { Path } from '@nelyx/core/ui/path';
import { Paint } from '@nelyx/core/ui/paint';
/** Direct pinned-VM execution, independent of representative-page coverage. */
export function verifyRnwSceneApi(api) {
  if (api.nelyxScenePacketVersion?.() !== 2) throw Error('RNW scene2 capability missing');
  const owned = [],
    own = (v) => {
      owned.push(v);
      return v;
    },
    require = (v, message) => {
      if (!v) throw Error(message);
    };
  let composition, semantics;
  try {
    const source = new Path();
    source.moveTo(1, 2);
    source.lineTo(40, 3);
    source.cubicTo(50, 4, 45, 30, 30, 40);
    source.conicTo(15, 30, 1, 2, 0.75);
    source.close();
    const path = source.snapshot(),
      before = own(createEnginePath(api, path)),
      after = own(createEnginePath(api, path, true));
    require(before.toSVGString() ===
      after.toSVGString(), 'RNW numeric Path differs from original builder');
    source.lineTo(99, 99);
    require(before.toSVGString() === after.toSVGString(), 'RNW numeric Path changed with source');
    const token = {
      owner: { id: 'rnw-scene-fixture', generation: 1 },
      sequence: 1,
      metrics: {
        viewportGeneration: 1,
        rendererGeneration: 1,
        nativeContextGeneration: null,
        nativeSurfaceGeneration: null,
        scale: 1.25,
      },
    };
    const paint = new Paint({
      color: 0xff5387af,
      style: 'stroke',
      strokeWidth: 1.5,
      strokeMiterLimit: 4.75,
    }).snapshot();
    const rect = { x: 1, y: 2, width: 90, height: 80 };
    for (const sceneBatch of ['path', 'paint', 'all']) {
      const recorder = own(api.PictureRecorder());
      recorder.beginRecording();
      submitNativeScene(
        api,
        recorder,
        {
          token,
          commands: [
            { op: 'save' },
            { op: 'clipRect', rect, clipOp: 'intersect', doAntiAlias: true },
            { op: 'drawPath', path, paint },
            { op: 'clipPath', path, clipOp: 'difference', doAntiAlias: true },
            {
              op: 'drawShadow',
              path,
              color: 0x55000000,
              elevation: 2.25,
              transparentOccluder: false,
              devicePixelRatio: 1.25,
            },
            { op: 'drawRRect', rect, radius: 7, paint },
            { op: 'restore' },
          ],
        },
        {
          sceneBatch,
          image() {
            throw Error('No image');
          },
          paragraph() {
            throw Error('No paragraph');
          },
        },
      );
      own(recorder.finishRecordingAsPicture());
    }
    const disposed = own(api.Paint());
    disposed.dispose();
    const recorder = own(api.PictureRecorder());
    recorder.beginRecording();
    const packet = new Float64Array([
      0x4e4c444c, 2, 1, 1, 19, 0, 0, 16, 1, 1, 1, 1, -1, -1, 1, 0, 3, 1, 0,
    ]);
    let rejected = false;
    try {
      recorder.nelyxReplayDisplayList(packet.buffer, [disposed]);
    } catch {
      rejected = true;
    }
    require(rejected, 'RNW scene accepted a disposed paint');
    const paintHandle = own(api.Paint()),
      retiring = own(api.PictureRecorder());
    retiring.beginRecording();
    const handles = [];
    Object.defineProperty(handles, 0, {
      get() {
        retiring.dispose();
        return paintHandle;
      },
      configurable: true,
    });
    handles.length = 1;
    rejected = false;
    try {
      retiring.nelyxReplayDisplayList(packet.buffer, handles);
    } catch {
      rejected = true;
    }
    require(rejected, 'RNW scene used a recording disposed during handle admission');
    const restarting = own(api.PictureRecorder());
    restarting.beginRecording();
    const replacement = [];
    Object.defineProperty(replacement, 0, {
      get() {
        own(restarting.finishRecordingAsPicture());
        restarting.beginRecording();
        return paintHandle;
      },
    });
    replacement.length = 1;
    rejected = false;
    try {
      restarting.nelyxReplayDisplayList(packet.buffer, replacement);
    } catch {
      rejected = true;
    }
    require(rejected, 'RNW scene crossed finish/begin into a replacement recording');
    own(restarting.finishRecordingAsPicture());
    composition = api.nelyxSceneCompositionSession(9001, 1);
    const structure = new Float64Array([
      0x4e4c5343, 1, 9001, 1, 1, 1, 1, -1, -1, 1, 1, 0, 1, 21, 0, 0, 1, 0, 0, 0, 0,
    ]);
    require(new Float64Array(composition.prepare(structure.buffer))[0] ===
      0x4e4c534f, 'RNW Scene prepare failed');
    composition.commit(1);
    require(new Float64Array(composition.stats())[0] ===
      1, 'RNW Scene commit did not retain one node');
    composition.close();
    require([...new Float64Array(composition.stats()).slice(0, 4)].every(
      (value) => value === 0,
    ), 'RNW Scene close retained metadata');
    rejected = false;
    try {
      composition.prepare(structure.buffer);
    } catch {
      rejected = true;
    }
    require(rejected, 'RNW Scene prepare accepted a closed owner');
    semantics = api.nelyxSemanticsGeometrySession(9002, 1);
    const query = new Float64Array([
      0x4e4c5347, 1, 9002, 1, 1, 1, 1, -1, -1, 1, 0, 57, 31, 16, 0, 0,
    ]);
    require(new Float64Array(semantics.evaluate(query.buffer))[0] ===
      0x4e4c5348, 'RNW Semantics evaluate failed');
    semantics.close();
    require([...new Float64Array(semantics.stats()).slice(0, 4)].every(
      (value) => value === 0,
    ), 'RNW Semantics close retained metadata');
    rejected = false;
    try {
      semantics.evaluate(query.buffer);
    } catch {
      rejected = true;
    }
    require(rejected, 'RNW Semantics evaluate accepted a closed owner');
    const originalArray = globalThis.Float64Array;
    const guardedAllocation = (native, method, first) => {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Float64Array');
      const next = new originalArray(first);
      next[4]++;
      let attempted = false,
        guarded = false;
      try {
        globalThis.Float64Array = function (length) {
          if (!attempted) {
            attempted = true;
            try {
              native[method](next.buffer);
            } catch (error) {
              guarded = String(error).includes('Reentrant');
            }
          }
          return new originalArray(length);
        };
        native[method](first.buffer);
      } finally {
        Object.defineProperty(globalThis, 'Float64Array', descriptor);
      }
      require(attempted && guarded, 'RNW numeric allocation admitted a second in-flight operation');
    };
    composition = api.nelyxSceneCompositionSession(9003, 1);
    const guardedStructure = new originalArray(structure);
    guardedStructure[2] = 9003;
    guardedAllocation(composition, 'prepare', guardedStructure);
    composition.commit(1);
    semantics = api.nelyxSemanticsGeometrySession(9004, 1);
    const guardedQuery = new originalArray(query);
    guardedQuery[2] = 9004;
    guardedAllocation(semantics, 'evaluate', guardedQuery);
    return {
      version: 2,
      pathEqual: true,
      executedModes: 3,
      disposedRejected: true,
      reentrantRecordingRejected: true,
      replacementRecordingRejected: true,
      reentrantAllocationRejected: true,
      numericSessionsClosed: true,
      closedOwnerRejected: true,
    };
  } finally {
    semantics?.close();
    composition?.close();
    for (let i = owned.length - 1; i >= 0; i--) owned[i].dispose();
  }
}
