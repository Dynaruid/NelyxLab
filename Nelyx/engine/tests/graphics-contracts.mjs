// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { commands as c, protocol as p, body, response } from '../../runtime/engine-client/index.ts';
export function graphicsContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: native switch paint resolves track, thumb, RTL, clip and shadow with atomic malformed rollback`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const shape = {
              kind: 'stadium',
              radii: Array(8).fill(0),
              strokeWidth: 0,
              strokeColor: 0,
              strokeAlign: 0,
            },
            geometry = {
              kind: 'switchThumb',
              trackWidth: 52,
              trackHeight: 32,
              thumbWidth: 16,
              thumbHeight: 16,
              position: 0,
            },
            paint = (position = 0, rtl = false) => ({
              kind: 'shape',
              color: 0xff123456,
              shape,
              geometry: { ...geometry, position, rtl },
            });
          let frame = await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { width: 80, height: 48 }),
            c.nativePaint(h(1), [paint()]),
            c.semantics(h(1), {
              role: 'switchControl',
              label: 'controlled switch',
              flags: p.semanticsFlags.checked,
              actions: p.semanticsActions.activate,
            }),
          ]);
          assert.ok(frame.capabilities & p.capabilities.canonicalSwitch);
          frame = await f.send(p.opcodes.semanticsSnapshot);
          const thumb = frame.nodes[0].nativePaint[0];
          assert.deepEqual(
            [thumb.width, thumb.height, ...thumb.transform],
            [16, 16, 1, 0, 0, 1, 22, 16],
          );
          assert.equal(
            frame.nodes[0].control,
            null,
            'TypeScript retains the controlled value policy',
          );
          await f.commit([c.nativePaint(h(1), [paint(1)])]);
          await f.ready();
          await f.present();
          frame = await f.send(p.opcodes.semanticsSnapshot);
          assert.equal(frame.nodes[0].nativePaint[0].transform[4], 42);
          await f.commit([
            c.nativePaint(h(1), [
              paint(1, true),
              { ...paint(), kind: 'clip', geometry: { ...geometry, kind: 'switchTrack' } },
              { ...paint(), kind: 'shadow', blurSigma: 2, spread: 1, x: 0, y: 2 },
            ]),
          ]);
          await f.ready();
          await f.present();
          frame = await f.send(p.opcodes.semanticsSnapshot);
          assert.equal(frame.nodes[0].nativePaint[0].transform[4], 22);
          assert.deepEqual(
            frame.nodes[0].nativePaint.map((e) => e.kind),
            ['shape', 'clip', 'shadow'],
          );
          const before = await f.inspect();
          for (const mutate of [
            (v) => v.setUint32(256, 6, true),
            (v) => v.setUint32(260, 2, true),
            (v) => v.setFloat64(264, 0, true),
            (v) => v.setFloat64(280, 0, true),
            (v) => v.setFloat64(304, NaN, true),
            (v) => v.setFloat64(304, 5, true),
            (v) => v.setFloat64(320, 2, true),
            (v) => v.setFloat64(328, 513, true),
          ]) {
            const bad = c.nativePaint(h(1), [paint()]);
            mutate(
              new DataView(
                bad.buffer,
                bad.byteOffset + 16 + p.nativePaintHeaderBytes,
                p.nativePaintBytes,
              ),
            );
            const rejected = await f.commit([c.paint(h(1), 0xffabcdef), bad]);
            assert.equal(rejected.status, p.statuses.invalidValue);
            const after = await f.inspect();
            assert.equal(after.document, before.document);
            assert.equal(after.nodes[0].color, before.nodes[0].color);
            assert.equal(
              response(await transport.exchange(rejected.bytes)).status,
              p.statuses.invalidValue,
            );
            assert.equal(
              (await f.inspect()).reservedBytes,
              after.reservedBytes,
              'An identical NACK retry does not retain another staged paint',
            );
          }
          await f.send(p.opcodes.closeView);
          const closed = await f.send(p.opcodes.closeSession, new Uint8Array(), {
            owner: { session: 1, app: 1, view: 0, generation: 0 },
          });
          assert.equal(
            closed.reservedBytes,
            0n,
            'Paint, snapshot and bounded NACK history leases drain on close',
          );
        }),
    );
    test(
      `${profile}: clip styles preserve canonical default hit shapes, Clip.none, saveLayer and atomic malformed rejection`,
      { timeout },
      () =>
        using(profile, async (f) => {
          let frame = await f.start([
            c.create(h(1), 'clip'),
            c.properties(h(1), { x: 10, y: 10, width: 100, height: 60 }),
            c.clipStyle(h(1), {
              shape: 'rrect',
              behavior: 'antiAlias',
              radii: [30, 20, 10, 15, 30, 20, 10, 15],
            }),
            c.create(h(2), 'box'),
            c.properties(h(2), { width: 150, height: 100 }),
            c.attach(h(2), h(1)),
            c.control(h(2), { kind: 'toggle' }),
            c.gesture(h(2), p.gestures.tap),
          ]);
          assert.ok(frame.capabilities & p.capabilities.clipStyles);
          assert.deepEqual(frame.nodes[0].clipStyle, {
            shape: 'rrect',
            behavior: 'antiAlias',
            radii: [30, 20, 10, 15, 30, 20, 10, 15],
          });
          const tap = async (x, y, publishes = true) => {
            await f.input('begin', 0, { pointer: true, target: h(0, 0), x, y });
            await f.tick();
            await f.input('end', 0, { pointer: true, target: h(0, 0), x, y });
            await f.tick();
            if (publishes) await f.present();
          };
          await tap(11, 11);
          assert.equal(
            (await f.inspect()).nodes[1].control.value,
            1,
            'Default RenderClipRRect hits its proxy rectangle without a custom clipper',
          );
          await f.commit([c.clipStyle(h(1), { shape: 'oval', behavior: 'none' })]);
          await f.ready();
          frame = await f.present();
          assert.equal(frame.nodes[0].flags & p.nodeFlags.clipsChildren, 0);
          assert.deepEqual(
            frame.nodes[1].clip,
            { x: 0, y: 0, width: 300, height: 200 },
            'Clip.none preserves uncut painting bounds',
          );
          await tap(11, 11, false);
          assert.equal(
            (await f.inspect()).nodes[1].control.value,
            1,
            'Oval hit shape remains active with Clip.none',
          );
          await tap(60, 40);
          assert.equal((await f.inspect()).nodes[1].control.value, 0);
          await tap(130, 40, false);
          assert.equal(
            (await f.inspect()).nodes[1].control.value,
            0,
            'Proxy input still rejects a child outside its own size',
          );
          await f.commit([
            c.clipStyle(h(1), { shape: 'oval', behavior: 'antiAliasWithSaveLayer' }),
          ]);
          await f.ready();
          frame = await f.present();
          assert.ok(frame.nodes[0].flags & p.nodeFlags.clipSaveLayer);
          assert.ok(frame.nodes[0].flags & p.nodeFlags.clipsChildren);
          await f.commit([
            c.clipStyle(h(1), {
              shape: 'rrect',
              behavior: 'hardEdge',
              radii: [30, 30, 30, 30, 30, 30, 30, 30],
            }),
          ]);
          await f.ready();
          frame = await f.present();
          assert.ok(frame.nodes[0].flags & p.nodeFlags.hardEdgeClip);
          assert.equal(
            frame.nodes[0].flags & p.nodeFlags.rectangularClip,
            0,
            'Hard-edge rrect painting must retain its shape',
          );
          const before = await f.inspect();
          for (const mutate of [
            (v) => v.setUint32(16, 4, true),
            (v) => v.setUint32(20, 3, true),
            (v) => v.setUint32(24, 1, true),
            (v) => v.setFloat64(32, -1, true),
            (v) => v.setFloat64(32, 1, true),
            (v) => v.setFloat64(40, NaN, true),
          ]) {
            const bad = c.clipStyle(h(1), {});
            mutate(new DataView(bad.buffer, bad.byteOffset, bad.byteLength));
            assert.equal(
              (await f.commit([c.paint(h(2), 0xffabcdef), bad])).status,
              p.statuses.invalidValue,
            );
            assert.equal((await f.inspect()).document, before.document);
            assert.equal((await f.inspect()).nodes[1].color, before.nodes[1].color);
          }
          assert.equal((await f.commit([c.clipStyle(h(2), {})])).status, p.statuses.invalidValue);
          await f.commit([c.clipStyle(h(1)), c.paint(h(1), 0, 24)]);
          await f.ready();
          frame = await f.present();
          assert.equal(frame.nodes[0].clipStyle, null);
          await tap(11, 11, false);
          assert.equal(
            (await f.inspect()).nodes[1].control.value,
            0,
            'Reset restores the raw v2 rounded hit contract',
          );
          await f.commit([c.clipStyle(h(1), { shape: 'rect' })]);
          await f.ready();
          await f.present();
          await tap(11, 11);
          assert.equal((await f.inspect()).nodes[1].control.value, 1);
        }),
    );
    test(
      `${profile}: layout-dependent transform pivots share clip and input geometry and reject malformed flags atomically`,
      { timeout },
      () =>
        using(profile, async (f) => {
          let frame = await f.start([
            c.create(h(1), 'clip'),
            c.properties(h(1), { x: 50, y: 30, width: 100, height: 60 }),
            c.graphics(h(1), {
              transform: [-1, 0, 0, -1, 0, 0],
              origin: { x: 5, y: 7 },
              alignment: { x: 0, y: 0 },
            }),
            c.create(h(2), 'box'),
            c.properties(h(2), { width: 30, height: 20 }),
            c.attach(h(2), h(1)),
            c.control(h(2), { kind: 'toggle' }),
            c.gesture(h(2), p.gestures.tap),
          ]);
          assert.deepEqual(frame.nodes[0].matrix, [-1, 0, 0, -1, 160, 104]);
          assert.deepEqual(frame.nodes[0].graphics.origin, { x: 5, y: 7 });
          assert.deepEqual(frame.nodes[0].graphics.alignment, { x: 0, y: 0 });
          const tap = async (x, y, publishes = true) => {
            await f.input('begin', 0, { pointer: true, target: h(0, 0), x, y });
            await f.tick();
            await f.input('end', 0, { pointer: true, target: h(0, 0), x, y });
            await f.tick();
            if (publishes) await f.present();
          };
          await tap(145, 94);
          assert.equal((await f.inspect()).nodes[1].control.value, 1);
          await tap(65, 40, false);
          assert.equal((await f.inspect()).nodes[1].control.value, 1);
          assert.equal(
            (await f.commit([c.properties(h(1), { x: 50, y: 30, width: 140, height: 80 })])).status,
            p.statuses.accepted,
          );
          await f.ready();
          frame = await f.present();
          assert.deepEqual(frame.nodes[0].matrix, [-1, 0, 0, -1, 200, 124]);
          await tap(145, 94, false);
          assert.equal(
            (await f.inspect()).nodes[1].control.value,
            1,
            'Old published coordinates cannot hit the resized pivot',
          );
          await tap(185, 114);
          assert.equal((await f.inspect()).nodes[1].control.value, 0);
          const before = await f.inspect();
          for (const mutate of [
            (v) => v.setUint32(16 + p.graphicsFields.flags, 16, true),
            (v) => v.setFloat64(16 + p.graphicsFields.originX, 1, true),
            (v) => v.setFloat64(16 + p.graphicsFields.alignmentY, 1, true),
            (v) => v.setFloat64(16 + p.graphicsFields.originY, NaN, true),
          ]) {
            const bad = c.graphics(h(1));
            mutate(new DataView(bad.buffer, bad.byteOffset, bad.byteLength));
            assert.equal(
              (await f.commit([c.paint(h(2), 0xffabcdef), bad])).status,
              p.statuses.invalidValue,
            );
            assert.equal((await f.inspect()).document, before.document);
            assert.equal((await f.inspect()).nodes[1].color, before.nodes[1].color);
          }
          await f.commit([c.graphics(h(1), { transform: [1e-7, 0, 0, 1e-7, 0, 0] })]);
          await f.ready();
          frame = await f.present();
          assert.ok(frame.nodes[0].bounds.width > 0);
          await tap(50.000001, 30.000001);
          assert.equal(
            (await f.inspect()).nodes[1].control.value,
            1,
            'Small invertible transforms retain source hit semantics',
          );
          await f.commit([c.graphics(h(1))]);
          await f.ready();
          frame = await f.present();
          assert.deepEqual(frame.nodes[0].matrix, [1, 0, 0, 1, 50, 30]);
          assert.equal(
            frame.nodes[0].graphics,
            null,
            'Reset clears pivot presence as well as values',
          );
        }),
    );
    test(
      `${profile}: transformed nested handoff converts residual distances between ancestor axes`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'scrollViewport'),
            c.properties(h(1), { width: 250, height: 180, maximum: 1000, horizontal: true }),
            c.create(h(2), 'scrollViewport'),
            c.properties(h(2), {
              x: 40,
              y: 20,
              width: 80,
              height: 80,
              maximum: 20,
              chaining: true,
            }),
            c.graphics(h(2), { transform: [0, -2, 2, 0, 0, 160] }),
            c.attach(h(2), h(1)),
            c.create(h(3), 'box'),
            c.properties(h(3), { width: 80, height: 200 }),
            c.attach(h(3), h(2)),
          ]);
          await f.input('update', 0, {
            source: 'wheelUnknown',
            target: h(0, 0),
            x: 60,
            y: 50,
            dx: 100,
          });
          await f.tick();
          const nodes = (await f.inspect()).nodes;
          assert.equal(nodes[1].offset, 20, 'The child consumes 40 view pixels at scale two');
          assert.equal(
            nodes[0].offset,
            60,
            'The horizontal ancestor receives the remaining 60 view pixels',
          );
        }),
    );

    test(
      `${profile}: empty paths clip all input and static native extensions own bounded geometry`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'clip'),
            c.properties(h(1), { width: 100, height: 100 }),
            c.graphics(h(1), { path: [] }),
            c.create(h(2), 'path'),
            c.properties(h(2), { width: 80, height: 60 }),
            c.attach(h(2), h(1)),
            c.graphics(h(2), { stroke: { width: 2, color: 0xff000000 } }),
            c.nativeExtension(h(2), 80, 60, [0, 1, 0]),
            c.control(h(2), { kind: 'toggle' }),
            c.gesture(h(2), p.gestures.tap),
          ]);
          const declared = await f.send(p.opcodes.layoutSnapshot),
            line = declared.nodes.find((n) => n.node.slot === 2);
          assert.ok(line.flags & p.nodeFlags.nativeExtension);
          assert.deepEqual(line.graphics.path, [
            ['move', 0, 60],
            ['line', 40, 0],
            ['line', 80, 60],
          ]);
          assert.equal(declared.nodes[0].graphics.hasPath, true);
          assert.deepEqual(declared.nodes[0].graphics.path, []);
          await f.input('begin', 0, { pointer: true, target: h(0, 0), x: 30, y: 40 });
          await f.tick();
          await f.input('end', 0, { pointer: true, target: h(0, 0), x: 30, y: 40 });
          await f.tick();
          assert.equal((await f.inspect()).nodes[1].control.value, 0);
          await f.commit([c.graphics(h(1))]);
          await f.ready();
          await f.present();
          await f.input('begin', 0, { pointer: true, target: h(0, 0), x: 30, y: 40 });
          await f.tick();
          await f.input('end', 0, { pointer: true, target: h(0, 0), x: 30, y: 40 });
          await f.tick();
          assert.equal(
            (await f.inspect()).nodes[1].control.value,
            1,
            'Removing the empty clip restores the same path hit',
          );
          const previous = (await f.inspect()).document;
          assert.equal(
            (await f.commit([c.nativeExtension(h(2), 80, 60, [0, 2])])).status,
            p.statuses.invalidValue,
          );
          assert.equal((await f.inspect()).document, previous);
          assert.equal(
            (await f.commit([c.properties(h(2), { width: 90, height: 60 })])).status,
            p.statuses.invalidValue,
            'Static extension geometry changes require a new bounded extension declaration',
          );
        }),
    );
    test(
      `${profile}: affine snapshots, rounded/path clips and singular transforms share hit geometry`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'scrollViewport'),
            c.properties(h(1), { x: 10, y: 10, width: 100, height: 100, maximum: 1000 }),
            c.paint(h(1), 0, 20),
            c.graphics(h(1), { transform: [0, 1, -1, 0, 100, 0] }),
            c.create(h(2), 'clip'),
            c.properties(h(2), { width: 100, height: 100 }),
            c.attach(h(2), h(1)),
            c.graphics(h(2), {
              path: [['move', 0, 0], ['line', 100, 0], ['line', 0, 100], ['close']],
            }),
            c.create(h(3), 'box'),
            c.properties(h(3), { width: 100, height: 100 }),
            c.attach(h(3), h(2)),
          ]);
          const before = await f.inspect();
          await f.input('update', 0, {
            source: 'wheelUnknown',
            target: h(0, 0),
            x: 100,
            y: 20,
            dx: -10,
          });
          await f.tick();
          assert.equal(
            (await f.inspect()).nodes[0].offset,
            10,
            'A view-space delta is unprojected into the rotated scroll axis',
          );
          await f.present();
          await f.input('update', 40, { source: 'wheelUnknown', target: h(0, 0), x: 109, y: 11 });
          await f.tick();
          assert.equal(
            (await f.inspect()).nodes[0].offset,
            10,
            'Rounded corner is outside input coverage',
          );
          await f.commit([c.graphics(h(1), { transform: [0, 0, 0, 0, 100, 0] })]);
          await f.ready();
          const frame = await f.present();
          assert.equal(frame.nodes[0].bounds.width, 0);
          assert.equal(frame.nodes[0].bounds.height, 0);
          await f.input('update', 50, { source: 'wheelUnknown', target: h(0, 0), x: 100, y: 20 });
          await f.tick();
          assert.equal((await f.inspect()).nodes[0].offset, 10);
          assert.ok((await f.inspect()).transactionWork > before.transactionWork);
        }),
    );
    test(
      `${profile}: path winding and staged graphics failure preserve the accepted document`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'path'),
            c.properties(h(1), { width: 100, height: 100 }),
            c.graphics(h(1), {
              path: [['move', 0, 0], ['line', 100, 0], ['line', 0, 100], ['close']],
            }),
            c.control(h(1), { kind: 'toggle' }),
            c.gesture(h(1), p.gestures.tap),
          ]);
          for (const point of [
            [80, 80],
            [20, 20],
          ]) {
            await f.input('begin', 0, { pointer: true, target: h(0, 0), x: point[0], y: point[1] });
            await f.tick();
            await f.input('end', 0, { pointer: true, target: h(0, 0), x: point[0], y: point[1] });
            await f.tick();
          }
          assert.equal(
            (await f.inspect()).nodes[0].control.value,
            1,
            'Only the filled triangle activates the native control',
          );
          const before = await f.inspect();
          const failed = await f.commit([
            c.paint(h(1), 0xffabcdef),
            c.graphics(h(1), { path: [['line', 10, 10]] }),
          ]);
          assert.equal(failed.status, p.statuses.invalidValue);
          assert.equal((await f.inspect()).document, before.document);
        }),
    );
    test(
      `${profile}: one memory ceiling covers engine heap, both providers, GPU and staging atomically`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start();
          const global = { session: 1, app: 1, view: 0, generation: 0 };
          const report = (owner, kind, bytes) =>
            f.send(
              p.opcodes.memoryReport,
              body(16, (v) => {
                v.setUint32(0, owner, true);
                v.setUint32(4, kind, true);
                v.setBigUint64(8, BigInt(bytes), true);
              }),
              { owner: global },
            );
          const mib = 1024 * 1024;
          await report(0, 0, 32 * mib);
          await report(1, 1, 64 * mib);
          await report(2, 1, 64 * mib);
          await report(1, 2, 48 * mib);
          await report(2, 3, 100 * mib);
          const before = await f.inspect();
          assert.equal(before.memory.total, 308n * BigInt(mib));
          assert.equal((await report(1, 4, 100 * mib)).status, p.statuses.budgetExceeded);
          const after = await f.inspect();
          assert.equal(after.memory.total, before.memory.total);
          assert.equal(after.memory.rejected, before.memory.rejected + 1n);
          assert.ok(after.memory.peak <= after.memory.limit);
          for (const [owner, kind] of [
            [0, 0],
            [1, 1],
            [2, 1],
            [1, 2],
            [2, 3],
          ])
            await report(owner, kind, 0);
          assert.equal((await f.inspect()).memory.total, (await f.inspect()).reservedBytes);
        }),
    );
    test(
      `${profile}: composed transform overflow rolls back all staged changes before activation`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'clip'),
            c.properties(h(1), { width: 100, height: 100 }),
            c.create(h(2), 'box'),
            c.properties(h(2), { width: 100, height: 100 }),
            c.attach(h(2), h(1)),
          ]);
          const before = await f.inspect();
          const rejected = await f.commit([
            c.paint(h(2), 0xffabcdef),
            c.graphics(h(1), { transform: [1e6, 0, 0, 1e6, 0, 0] }),
            c.graphics(h(2), { transform: [1e6, 0, 0, 1e6, 0, 0] }),
          ]);
          assert.equal(rejected.status, p.statuses.invalidValue);
          assert.equal((await f.inspect()).document, before.document);
          assert.equal((await f.inspect()).nodes[1].color, before.nodes[1].color);
          assert.equal((await f.inspect()).activeDocument, before.activeDocument);
        }),
    );
  }
}
