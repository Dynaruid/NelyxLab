// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
import {
  encodeInputGeometry,
  decodeInputGeometry,
  inputGeometryProtocol as protocol,
} from '../../dist/hosting/input-geometry.js';
import {
  captureTransform,
  isCapturedTransform,
  fullTransform,
  identity,
  multiply,
  translate,
  bounds,
  intersect,
  transform,
} from '../../dist/ui/geometry.js';
import { captureMatrix4 } from '../../dist/ui/matrix4.js';
const timeout = 1_200_000,
  root = path.resolve(import.meta.dirname, '../../..');
export function referenceGeometry(frame, nodes, editors) {
  const matrices = nodes.map(() => null);
  nodes.forEach((node, i) => {
    matrices[i] =
      node.parent < 0
        ? multiply(node.local, identity)
        : multiply(matrices[node.parent], node.local);
  });
  return editors.map(({ node, core }) => {
    const matrix = matrices[node],
      full = fullTransform(matrix),
      projection = matrix.length === 6 && isCapturedTransform(matrix) ? matrix : full,
      project = (rect) => bounds(multiply(projection, translate(rect.x, rect.y)), rect),
      whole = project({ x: 0, y: 0, width: core.width, height: core.height });
    let clip = intersect(whole, {
      x: 0,
      y: 0,
      width: frame.metrics.logicalWidth,
      height: frame.metrics.logicalHeight,
    });
    if (clip.width === 0 || clip.height === 0) return null;
    for (let child = node; nodes[child].parent >= 0; child = nodes[child].parent) {
      const edge = nodes[child];
      if (edge.clip)
        clip = intersect(
          clip,
          bounds(
            multiply(
              matrices[edge.parent].length === 6 && isCapturedTransform(matrices[edge.parent])
                ? matrices[edge.parent]
                : fullTransform(matrices[edge.parent]),
              translate(edge.clip.x, edge.clip.y),
            ),
            edge.clip,
          ),
        );
      if (clip.width === 0 || clip.height === 0) return null;
    }
    const caret = project(core.caret),
      selectionRects = core.selectionRects.map(project),
      caretBaseline = transform(full, core.caretBaseline);
    if (
      ![whole, clip, caret, ...selectionRects].every((r) =>
        Object.values(r).every(Number.isFinite),
      ) ||
      !Object.values(caretBaseline).every(Number.isFinite)
    )
      return null;
    return { transform: full, bounds: whole, clip, caret, caretBaseline, selectionRects };
  });
}
test(
  'actual C++ geometry matches TS projection and rejects malformed/stale/closed transactions',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-input-geometry-'));
    try {
      const executable = path.join(directory, 'geometry.exe'),
        env = windowsCompilerEnvironment();
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
          path.join(import.meta.dirname, 'input-geometry-native.cpp'),
          path.join(root, 'Nelyx/skia/native/core/input_geometry.cpp'),
          '/Fe' + executable,
        ],
        { cwd: directory, env, timeout },
      );
      const frame = {
          owner: { id: 'fixture', generation: 7 },
          metrics: {
            viewportGeneration: 3,
            nativeSurfaceGeneration: 9,
            scale: 2,
            logicalWidth: 800,
            logicalHeight: 600,
          },
        },
        base = {
          coordinates: 'editable-local',
          epoch: 11,
          width: 120,
          height: 80,
          caret: { x: 4, y: 5, width: 1, height: 20 },
          caretBaseline: { x: 4, y: 22 },
          selectionRects: [
            { x: 5, y: 5, width: 40, height: 20 },
            { x: 0, y: 27, width: 50, height: 20 },
          ],
        },
        cases = [];
      const add = (name, nodes, editors = [{ node: nodes.length - 1, core: base }]) => {
        const packet = encodeInputGeometry(frame, 1, cases.length + 1, nodes, editors);
        let expected;
        try {
          expected = referenceGeometry(frame, nodes, editors);
        } catch {
          expected = 'reject';
        }
        cases.push({ name, packet, expected });
      };
      for (const local of [
        identity,
        captureTransform([1, 0, 0, 1, 20, -3]),
        captureTransform([2, 0, 0, 0.5, 0, 0]),
        captureTransform([0, 1, -1, 0, 80, 0]),
        captureTransform([-0, 0, 0, 1, -0, 0]),
        captureMatrix4([1, 0, 0, 0.001, 0, 1, 0, 0.002, 0, 0, 1, 0, 0, 0, 0, 1]),
        captureMatrix4([1, 0, 0, 0.01, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -0.5]),
      ])
        add('transform ' + JSON.stringify(local), [{ parent: -1, local, clip: null }]);
      add('nested clips', [
        { parent: -1, local: captureTransform([1, 0, 0, 1, 3, 7]), clip: null },
        {
          parent: 0,
          local: captureTransform([1, 0, 0, 1, 20, 10]),
          clip: { x: 0, y: 0, width: 100, height: 70 },
        },
        {
          parent: 1,
          local: captureTransform([1, 0, 0, 1, 4, 8]),
          clip: { x: 5, y: 5, width: 80, height: 40 },
        },
      ]);
      add('fully clipped', [
        { parent: -1, local: identity, clip: null },
        {
          parent: 0,
          local: captureTransform([1, 0, 0, 1, 200, 0]),
          clip: { x: 0, y: 0, width: 100, height: 100 },
        },
      ]);
      add(
        'zero size',
        [{ parent: -1, local: identity, clip: null }],
        [{ node: 0, core: { ...base, width: 0 } }],
      );
      add('large finite', [
        { parent: -1, local: captureTransform([1e150, 0, 0, 1e-150, 0, 0]), clip: null },
      ]);
      add(
        'nonfinite projected rect',
        [{ parent: -1, local: captureTransform([1e200, 0, 0, 1, 0, 0]), clip: null }],
        [{ node: 0, core: { ...base, caret: { x: 1e200, y: 0, width: 1, height: 20 } } }],
      );
      add('overflow composed transform', [
        { parent: -1, local: captureTransform([1e200, 0, 0, 1, 0, 0]), clip: null },
        { parent: 0, local: captureTransform([1e200, 0, 0, 1, 0, 0]), clip: null },
      ]);
      add('raw affine retains dense projection', [
        { parent: -1, local: [1, 0.5, -0.25, 1, 0, 0], clip: null },
      ]);
      add(
        'raw affine dense overflow rejects',
        [{ parent: -1, local: [1e200, 0, 0, 1, 0, 0], clip: null }],
        [{ node: 0, core: { ...base, caret: { x: 1e200, y: 0, width: 1, height: 20 } } }],
      );
      add(
        'ordered editors',
        [{ parent: -1, local: identity, clip: null }],
        [
          { node: 0, core: base },
          { node: 0, core: { ...base, epoch: 12, selectionRects: [] } },
        ],
      );
      const valid = cases[0].packet;
      const timed = valid.slice();
      timed[14] = 1;
      cases.push({ name: 'native timing flag', packet: timed, expected: cases[0].expected });
      const deepNodes = Array.from({ length: 129 }, (_, i) => ({
        parent: i - 1,
        local: identity,
        clip: null,
      }));
      cases.push({
        name: 'depth budget',
        packet: encodeInputGeometry(frame, 1, 1, deepNodes, [{ node: 128, core: base }]),
        expected: 'reject',
      });
      for (const [name, mutate] of [
        [
          'protocol',
          (p) => {
            p[1] = 2;
          },
        ],
        [
          'owner',
          (p) => {
            p[2] = 2;
          },
        ],
        [
          'fractional count',
          (p) => {
            p[10] = 0.5;
          },
        ],
        [
          'overflow count',
          (p) => {
            p[10] = Number.MAX_SAFE_INTEGER;
          },
        ],
        [
          'nonfinite',
          (p) => {
            p[18] = Infinity;
          },
        ],
        [
          'parent cycle',
          (p) => {
            p[16] = 0;
          },
        ],
        [
          'selection index',
          (p) => {
            p[16 + 24 + 10] = 1;
          },
        ],
        ['truncated', (p) => p.subarray(0, p.length - 1)],
      ]) {
        const packet = valid.slice(),
          changed = mutate(packet);
        cases.push({ name, packet: changed ?? packet, expected: 'reject' });
      }
      cases.push(
        { name: 'session first', packet: valid, op: 1, expected: cases[0].expected },
        { name: 'stale revision', packet: valid, op: 1, expected: 'reject' },
        { name: 'close', packet: new Float64Array(), op: 2, expected: 'closed' },
        { name: 'late closed', packet: valid, op: 1, expected: 'reject' },
      );
      assert(cases.length <= 30);
      const input = Buffer.concat(
        cases.map((c) => {
          const header = Buffer.alloc(8);
          header.writeUInt32LE(c.op ?? 0);
          header.writeUInt32LE(c.packet.length, 4);
          return Buffer.concat([
            header,
            Buffer.from(c.packet.buffer, c.packet.byteOffset, c.packet.byteLength),
          ]);
        }),
      );
      const run = spawnSync(executable, [], {
        cwd: directory,
        env,
        input,
        timeout,
        maxBuffer: protocol.maxBytes * 4,
      });
      if (run.error) throw run.error;
      assert.equal(run.status, 0, run.stderr?.toString());
      let at = 0;
      for (const c of cases) {
        const count = run.stdout.readUInt32LE(at);
        at += 4;
        const bytes = run.stdout.subarray(at, at + count * 8),
          output = new Float64Array(Uint8Array.from(bytes).buffer);
        at += count * 8;
        if (c.expected === 'reject') assert.equal(count, 0, c.name);
        else if (c.expected === 'closed') assert.equal(output[0], 1, c.name);
        else {
          assert(count > 0, c.name);
          assert.deepEqual(
            JSON.parse(JSON.stringify(decodeInputGeometry(c.packet, output))),
            JSON.parse(JSON.stringify(c.expected)),
            c.name,
          );
          const bad = output.slice();
          bad[5]++;
          assert.throws(() => decodeInputGeometry(c.packet, bad), /stale or malformed/);
        }
      }
      assert.equal(at, run.stdout.length);
      console.log(
        'C++ differential cases=' +
          cases.length +
          '; copied v1 input; finite/empty/order/session fences verified',
      );
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(
        path.basename(directory).startsWith('nelyx-input-geometry-') &&
          !fs.lstatSync(directory).isSymbolicLink(),
      );
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  },
);
