// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
import { Matrix4 } from '../../dist/math/matrix4.js';
import { MatrixUtils } from '../../dist/framework/painting/matrix-utils.js';
import { Rect } from '../../dist/ui/rect.js';
import { Offset } from '../../dist/ui/offset.js';
import { createSceneCompositionService } from '../../skia/packages/native/dist/scene-composition.js';
import { createSemanticsGeometryService } from '../../skia/packages/native/dist/semantics-geometry.js';
import { SceneBuilder } from '../../dist/ui/scene.js';
import { Canvas } from '../../dist/ui/canvas.js';
import { Paint } from '../../dist/ui/paint.js';
import { fixture } from '../../../packages/material/tests/root-fixture.mjs';
import { Semantics } from '../../dist/framework/widgets/semantics.js';
import { SizedBox, Transform } from '../../dist/framework/widgets/basic.js';
import { captureNumericSemanticsBounds } from '../../dist/framework/rendering/object.js';
import { RenderProxyBox } from '../../dist/framework/rendering/boxes.js';
const timeout = 1_200_000,
  root = path.resolve(import.meta.dirname, '../../..');
test(
  'unregistered and Proxy prototypes select TS without probing custom descriptors',
  { timeout },
  () => {
    const render = new RenderProxyBox(),
      prototype = Object.getPrototypeOf(render);
    let reads = 0;
    const proxy = new Proxy(prototype, {
      getOwnPropertyDescriptor(target, name) {
        reads++;
        return Reflect.getOwnPropertyDescriptor(target, name);
      },
      getPrototypeOf(target) {
        reads++;
        return Reflect.getPrototypeOf(target);
      },
    });
    try {
      Object.setPrototypeOf(render, proxy);
      assert.equal(captureNumericSemanticsBounds(render), undefined);
      assert.equal(reads, 0);
    } finally {
      Object.setPrototypeOf(render, prototype);
      render.dispose();
    }
  },
);
export function semanticsReference(query) {
  const r = (v) => (v === null ? null : Rect.fromLTRB(...v)),
    tuple = (v) => (v === null ? null : [v.left, v.top, v.right, v.bottom]);
  const intersect = (a, b) => (b === null ? a : (a?.intersect(b) ?? b));
  const transform = Matrix4.fromList(query.transform);
  let paint = r(query.paint),
    semantic = r(query.semantic);
  semantic ??= intersect(paint, r(query.parentSemantic));
  paint = intersect(paint, r(query.parentPaint));
  if (paint !== null || semantic !== null) {
    const translation = MatrixUtils.getAsTranslation(transform);
    if (
      translation !== null &&
      Number.isFinite(translation.dx) &&
      Number.isFinite(translation.dy)
    ) {
      const offset = new Offset(-translation.dx, -translation.dy),
        shift = (v) => (v === null ? null : v.isEmpty ? Rect.zero : v.shift(offset));
      semantic = shift(semantic);
      paint = shift(paint);
    } else {
      const inverse = transform.clone(),
        invertible = inverse.invert() !== 0,
        apply = (v) =>
          v === null
            ? null
            : v.isEmpty || inverse.isZero()
              ? Rect.zero
              : MatrixUtils.transformRect(inverse, v);
      semantic = invertible ? apply(semantic) : null;
      paint = invertible ? apply(paint) : null;
    }
  }
  if (query.parentTransform)
    MatrixUtils.multiplyInPlace(Matrix4.fromList(query.parentTransform), transform);
  let rect = semantic?.intersect(r(query.bounds)) ?? r(query.bounds),
    hidden = false;
  if (paint !== null) {
    const painted = paint.intersect(rect);
    hidden = painted.isEmpty && !rect.isEmpty;
    if (!hidden) rect = painted;
  }
  return [
    ...transform.storage,
    ...(paint ? [1, ...tuple(paint)] : [0, 0, 0, 0, 0]),
    ...(semantic ? [1, ...tuple(semantic)] : [0, 0, 0, 0, 0]),
    ...tuple(rect),
    hidden ? 1 : 0,
  ];
}
export function semanticsPacket(queries) {
  const words = [
    0x4e4c5347,
    1,
    1,
    7,
    1,
    2,
    3,
    4,
    5,
    1.25,
    queries.length,
    57,
    31,
    16 + queries.length * 57,
    0,
    0,
  ];
  for (const q of queries) {
    words.push(
      ...q.transform,
      q.parentTransform ? 1 : 0,
      ...(q.parentTransform ?? Array(16).fill(0)),
    );
    for (const r of [q.paint, q.semantic, q.parentPaint, q.parentSemantic])
      words.push(...(r ? [1, ...r] : [0, 0, 0, 0, 0]));
    words.push(...q.bounds);
  }
  return new Float64Array(words);
}
test(
  'actual C++ Scene transactions and Semantics differential preserve TS matrix/clip/visibility arithmetic',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-numeric-services-'));
    try {
      const env = windowsCompilerEnvironment(),
        executable = path.join(directory, 'numeric.exe');
      await execute(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/O2',
          '/MD',
          '/EHsc',
          '/fp:strict',
          '/I' + path.join(root, 'Nelyx/skia/native/core'),
          path.join(import.meta.dirname, 'numeric-services-native.cpp'),
          ...['scene_packet.cpp', 'scene_composition.cpp', 'semantics_geometry.cpp'].map((file) =>
            path.join(root, 'Nelyx/skia/native/core', file),
          ),
          '/Fe' + executable,
        ],
        { cwd: directory, env, timeout },
      );
      await execute(executable, [], { cwd: directory, env, timeout });
      const identity = [...Matrix4.identity().storage],
        base = {
          transform: identity,
          parentTransform: null,
          paint: [0, 0, 100, 80],
          semantic: null,
          parentPaint: null,
          parentSemantic: null,
          bounds: [0, 0, 120, 90],
        };
      const queries = [];
      for (const transform of [
        identity,
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 23, -7, 0, 1],
        [-2, 0.25, 0, 0, 0.5, 3, 0, 0, 0, 0, 1, 0, 4, 5, 0, 1],
        [1, 0, 0, 0.002, 0.2, 1, 0, -0.001, 0, 0, 1, 0, 2, 3, 0, 1],
        Array(16).fill(0),
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 3, 0, 1],
      ]) {
        queries.push(
          { ...base, transform },
          {
            ...base,
            transform,
            semantic: [3, 4, 110, 100],
            parentPaint: [2, 3, 95, 80],
            parentSemantic: [0, 0, 120, 110],
            parentTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 11, -13, 0, 1],
          },
        );
      }
      queries.push(
        { ...base, paint: null, semantic: null },
        { ...base, paint: [500, 500, 600, 600] },
        { ...base, paint: [3, 4, 3, 4] },
        {
          ...base,
          paint: [-1e308, -1e308, 1e308, 1e308],
          transform: [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        },
        { ...base, transform: [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -50] },
      );
      const packet = semanticsPacket(queries),
        run = (input) =>
          spawnSync(executable, ['sem'], {
            input: Buffer.from(input.buffer),
            env,
            cwd: directory,
            timeout,
            windowsHide: true,
            maxBuffer: 8 * 1024 * 1024,
          });
      const result = run(packet);
      assert.equal(result.status, 0, result.stderr.toString());
      const output = new Float64Array(
        result.stdout.buffer.slice(
          result.stdout.byteOffset,
          result.stdout.byteOffset + result.stdout.byteLength,
        ),
      );
      assert.equal(output.length, 16 + queries.length * 31);
      queries.forEach((q, i) =>
        assert.deepEqual(
          [...output.subarray(16 + i * 31, 16 + (i + 1) * 31)],
          semanticsReference(q),
          'query ' + i,
        ),
      );
      for (const [at, value] of [
        [1, 2],
        [3, 8],
        [10, 8193],
        [13, 0],
        [16 + 16, 2],
        [16, Infinity],
      ]) {
        const bad = packet.slice();
        bad[at] = value;
        assert.notEqual(run(bad).status, 0);
      }
      console.log(
        `PASS ${queries.length} actual C++/TS Semantics queries, 6 malformed/foreign/budget cases`,
      );
      const buffer = (value) => Uint8Array.from(value).buffer;
      let sceneCalls = 0,
        semanticsCalls = 0;
      const api = {
        nelyxSceneCompositionVersion: () => 1,
        nelyxSceneCompositionSession(session, generation) {
          const history = [];
          const invoke = (op, data = []) => {
            const payload = [...data];
            if (op === 1) payload[2] = 1;
            history.push(op, payload.length, ...payload);
            const words = new Float64Array(history),
              run = spawnSync(executable, ['scene', String(generation)], {
                cwd: directory,
                env,
                timeout,
                windowsHide: true,
                input: Buffer.from(words.buffer),
                maxBuffer: 4 * 1024 * 1024,
              });
            assert.equal(run.status, 0, run.stderr.toString());
            const output = buffer(run.stdout);
            if (op === 1) new Float64Array(output)[2] = session;
            return output;
          };
          return {
            prepare(bytes) {
              sceneCalls++;
              return invoke(1, new Float64Array(bytes));
            },
            commit: (rev) => {
              invoke(2, [rev]);
            },
            discard: (rev) => {
              invoke(3, [rev]);
            },
            stats: () => invoke(4),
            close: () => {
              invoke(5);
            },
          };
        },
        nelyxSemanticsGeometryVersion: () => 1,
        nelyxSemanticsGeometrySession(session, generation) {
          let closed = false;
          return {
            evaluate(bytes) {
              assert(!closed);
              semanticsCalls++;
              const input = new Float64Array(bytes).slice();
              input[2] = 1;
              const run = spawnSync(executable, ['sem', String(generation)], {
                cwd: directory,
                env,
                timeout,
                windowsHide: true,
                input: Buffer.from(input.buffer),
                maxBuffer: 4 * 1024 * 1024,
              });
              assert.equal(run.status, 0, run.stderr.toString());
              const output = buffer(run.stdout);
              new Float64Array(output)[2] = session;
              return output;
            },
            stats: () => new Float64Array([0, 0, 0, 0, 4096, closed ? 1 : 0]).buffer,
            close() {
              closed = true;
            },
          };
        },
      };
      const token = {
        owner: { id: 'compose', generation: 7 },
        sequence: 1,
        metrics: {
          viewportGeneration: 1,
          rendererGeneration: 1,
          nativeContextGeneration: null,
          nativeSurfaceGeneration: null,
          scale: 1,
        },
      };
      const service = createSceneCompositionService(api, token.owner, () => {});
      const build = (transaction) => {
        const builder = new SceneBuilder(null, transaction),
          canvas = new Canvas();
        builder.pushOffset(3, 4);
        builder.pushOpacity(127);
        builder.pushClipRect({ x: 1, y: 2, width: 90, height: 80 });
        builder._appendCanvasCommands([
          {
            op: 'drawRect',
            rect: { x: 4, y: 5, width: 30, height: 40 },
            paint: new Paint({ color: 0xffabcdef }).snapshot(),
          },
        ]);
        builder.pop();
        builder.pop();
        builder.pop();
        try {
          builder._buildInto(canvas);
          return structuredClone(canvas.commands);
        } finally {
          canvas.dispose();
          builder.dispose();
        }
      };
      try {
        const before = build();
        for (let i = 0; i < 2; i++) {
          const transaction = service.begin({ ...token, sequence: i + 1 });
          assert.deepEqual(build(transaction), before);
          transaction.commit();
        }
        assert.equal(sceneCalls, 2);
      } finally {
        service.dispose();
      }
      const f = fixture(),
        baseline = fixture(),
        native = createSemanticsGeometryService(api, f.root.context.owner, () => {});
      const content = () =>
        new Transform(
          new Semantics({ label: 'numeric semantics', child: new SizedBox(30, 40) }),
          Matrix4.translationValues(7, 11, 0).storage,
        );
      try {
        baseline.set(content());
        const before = structuredClone(baseline.root.nodes);
        f.root.context.semanticsGeometry = native;
        f.set(content());
        assert(semanticsCalls > 0, 'Actual framework did not invoke C++ Semantics');
        // IDs can change on a rebuilt tree; compare value/coordinate meaning.
        const clean = (nodes) =>
          JSON.parse(
            JSON.stringify(nodes, (key, value) =>
              key === 'id' || key === 'sourceNodeId' ? undefined : value,
            ),
          );
        assert.deepEqual(clean(f.root.nodes), clean(before));
      } finally {
        native.dispose();
        f.close();
        baseline.close();
      }
      console.log(
        `PASS real SceneBuilder/Frame lifecycle using ${sceneCalls} C++ compositions and ${semanticsCalls} C++ Semantics projections`,
      );
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(path.basename(directory).startsWith('nelyx-numeric-services-'));
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  },
);
