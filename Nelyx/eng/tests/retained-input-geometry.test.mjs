// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  timeout,
  withRetainedGeometryHarness,
  retainedGeometryApi,
} from './retained-geometry-fixture.mjs';
import { createRetainedInputGeometryService } from '../../skia/packages/native/dist/input-geometry.js';
import {
  retainedInputGeometryProtocol as p,
  encodeInputGeometry,
  decodeRetainedInputGeometry,
  projectInputGeometry,
} from '../../dist/hosting/input-geometry.js';
import { captureTransform, identity } from '../../dist/ui/geometry.js';
import { captureMatrix4 } from '../../dist/ui/matrix4.js';
import { engineFixture } from '../../../packages/material/tests/engine-fixture.mjs';
import { Directionality } from '../../dist/framework/widgets/app-data.js';
import { SizedBox, Column, SliverToBoxAdapter } from '../../dist/framework/widgets/basic.js';
import { EditableText, TextEditingController } from '../../dist/framework/widgets/editable-text.js';
import { CustomScrollView } from '../../dist/framework/widgets/scroll-view.js';
import { ScrollController } from '../../dist/framework/widgets/scroll-controller.js';
import { RenderEditable } from '../../dist/framework/rendering/editable.js';
import { FoundationPlatform } from '../../dist/foundation/platform.js';
import { WindowsInteraction } from '../../sdk/dist/platforms/windows/interaction.js';
import { ComponentsGallery } from '../../../sample/nelyx-testbed-app-2/src/gallery.ts';
import { RenderObject } from '../../dist/framework/rendering/object.js';
const frame = {
    owner: { id: 'retained', generation: 7 },
    metrics: {
      viewportGeneration: 3,
      nativeSurfaceGeneration: 9,
      rendererGeneration: 1,
      nativeContextGeneration: 1,
      scale: 2,
      logicalWidth: 800,
      logicalHeight: 600,
    },
  },
  core = {
    coordinates: 'editable-local',
    epoch: 11,
    width: 120,
    height: 80,
    caret: { x: 4, y: 5, width: 1, height: 20 },
    caretBaseline: { x: 4, y: 22 },
    selectionRects: [{ x: 5, y: 5, width: 40, height: 20 }],
  };
const normalized = (value) => JSON.parse(JSON.stringify(value));
test(
  'actual Testbed Material page executes C++ for twelve editors and preserves custom clip callbacks',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    await withRetainedGeometryHarness(async (create) => {
      FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
      const f = await engineFixture({ fonts: true }),
        context = f.root.context,
        interaction = new WindowsInteraction(context.owner),
        api = retainedGeometryApi(create, context.owner.generation),
        service = createRetainedInputGeometryService(api, context.owner, () => {});
      context.editing = interaction.editing;
      context.semantics = interaction.semantics;
      Object.assign(context.readMetrics(), {
        logicalWidth: 1280,
        logicalHeight: 729,
        physicalWidth: 1280,
        physicalHeight: 729,
      });
      try {
        f.set(new ComponentsGallery());
        f.tap('show-mixed-scroll');
        f.advance(350);
        const nodes = [],
          root = f.root.root.renderObjects[0];
        const visit = (node) => {
          nodes.push(node);
          node.visitChildren(visit);
        };
        visit(root);
        const editors = nodes.filter((node) => node instanceof RenderEditable),
          read = (editor) => editor.readTextInputGeometry(context.owner, context.readMetrics());
        assert.equal(editors.length, 12);
        assert(editors.some(read));
        const before = editors.map(read);
        context.inputGeometry = service;
        f.frame();
        const issues = [];
        if (!api.sessions.length)
          for (const node of nodes)
            for (const name of RenderObject.inputGeometryHookNames) {
              let at = node,
                d;
              while (at && !d) {
                d = Object.getOwnPropertyDescriptor(at, name);
                at = Object.getPrototypeOf(at);
              }
              if (d && !RenderObject.inputGeometryHooks.get(name)?.has(d.get ?? d.value))
                issues.push(node.constructor.name + '.' + name);
            }
        assert(
          api.sessions.length > 0,
          'Actual Material path must execute C++, not silently fall back: ' +
            [...new Set(issues)].join(','),
        );
        editors.forEach((editor, i) => assert.equal(read(editor), before[i]));
        let viewport = editors.find(read);
        while (viewport && viewport.constructor.name !== 'RenderViewport')
          viewport = viewport.parent;
        assert(viewport);
        for (const offset of [160, 0]) {
          delete context.inputGeometry;
          viewport.offset.jumpTo(offset);
          f.advance(17);
          const expected = editors.map(read);
          context.inputGeometry = service;
          f.frame();
          editors.forEach((editor, i) => assert.equal(read(editor), expected[i]));
        }
        let clipped = editors.find(read);
        while (clipped && !Object.getOwnPropertyDescriptor(clipped, 'current')?.value)
          clipped = clipped.parent;
        const clipper = clipped && Object.getOwnPropertyDescriptor(clipped, 'current').value;
        assert(clipper);
        const oldBehavior = clipped.clipBehavior;
        clipped.clipBehavior = 'hardEdge';
        const approximation = clipper.getApproximateClipRect;
        let reads = 0;
        Object.defineProperty(clipper, 'getApproximateClipRect', {
          configurable: true,
          get() {
            reads++;
            return approximation;
          },
        });
        try {
          delete context.inputGeometry;
          f.frame();
          reads = 0;
          f.frame();
          const expectedReads = reads;
          assert(expectedReads > 0);
          reads = 0;
          const calls = api.sessions.reduce((sum, value) => sum + value.calls, 0);
          context.inputGeometry = service;
          f.frame();
          assert.equal(reads, expectedReads, 'Eligibility must not invoke a custom clip getter');
          assert.equal(
            api.sessions.reduce((sum, value) => sum + value.calls, 0),
            calls,
          );
        } finally {
          delete clipper.getApproximateClipRect;
          clipped.clipBehavior = oldBehavior;
        }
        f.frame();
        assert(api.sessions.length > 1, 'Restored built-in clip starts a fresh native session');
        assert(service.execution().committedFrames > 0);
        assert.equal(service.execution().fallbackReasons['guarded-input'], 1);
      } finally {
        service.dispose();
        delete context.inputGeometry;
        await f.close();
        interaction.editing.dispose();
        interaction.semantics.dispose();
      }
    });
  },
);
test(
  'an older preparation failure cannot close metadata committed by a reentrant replacement',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    await withRetainedGeometryHarness(async (create) => {
      const api = retainedGeometryApi(create, 7),
        factory = api.nelyxRetainedInputGeometrySession;
      let onPrepared, service;
      api.nelyxRetainedInputGeometrySession = (...args) => {
        const native = factory(...args);
        return {
          ...native,
          prepare(buffer) {
            const result = native.prepare(buffer),
              callback = onPrepared;
            onPrepared = undefined;
            callback?.();
            return result;
          },
        };
      };
      service = createRetainedInputGeometryService(api, frame.owner, () => {});
      try {
        const old = service.begin(frame),
          oldHandle = old.node({}, -1, identity, null);
        onPrepared = () => {
          service.reset();
          const newer = service.begin(frame),
            handle = newer.node({}, -1, identity, null);
          newer.prepare([{ node: handle, core }]).commit();
        };
        assert.throws(() => old.prepare([{ node: oldHandle, core }]), /changed during preparation/);
        assert.equal(service.stats()[0], 1);
        assert.equal(service.stats()[4], 2);
        assert(api.sessions[0].closed);
        assert.equal(api.sessions[1].closed, false);
      } finally {
        service.dispose();
      }
      assert(api.sessions.every((value) => value.closed));
    });
  },
);
function packet(
  revision,
  base,
  nodes,
  handles,
  editors,
  updates = nodes.map((_, i) => i),
  removals = [],
) {
  const snapshot = encodeInputGeometry(frame, 1, revision, nodes, editors),
    editorAt = 16 + nodes.length * 24,
    result = new Float64Array(
      p.headerWords + updates.length * p.nodeWords + removals.length + snapshot.length - editorAt,
    );
  result.set(snapshot.subarray(0, 16));
  result[0] = p.magic;
  result[1] = p.version;
  result[10] = updates.length;
  result[13] = result.length;
  result[15] = base;
  result[16] = removals.length;
  result[17] = nodes.length;
  let at = p.headerWords;
  for (const index of updates) {
    result[at] = handles[index];
    result.set(snapshot.subarray(16 + index * 24, 16 + (index + 1) * 24), at + 1);
    result[at + 1] = nodes[index].parent < 0 ? -1 : handles[nodes[index].parent];
    at += p.nodeWords;
  }
  result.set(removals, at);
  at += removals.length;
  result.set(snapshot.subarray(editorAt), at);
  for (let i = 0; i < editors.length; i++) result[at + i * 12] = handles[editors[i].node];
  return result;
}
test(
  'retained C++ delta state shares ancestors, rolls back, rejects invalid graphs and releases metadata',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    await withRetainedGeometryHarness(async (create) => {
      const run = create(),
        handles = [1024, 1025, 1026],
        editors = [
          { node: 1, core },
          { node: 2, core },
        ],
        nodes = [
          { parent: -1, local: identity, clip: null },
          {
            parent: 0,
            local: captureTransform([1, 0, 0, 1, 20, 10]),
            clip: { x: 0, y: 0, width: 200, height: 100 },
          },
          { parent: 0, local: [1, 0.5, -0.25, 1, 8, 8], clip: null },
        ];
      const compare = (input, expectedNodes = nodes, expectedEditors = editors) => {
        const out = run(3, input);
        assert(out.length > 0);
        assert.deepEqual(
          normalized(decodeRetainedInputGeometry(input, out)),
          normalized(projectInputGeometry(frame, expectedNodes, expectedEditors)),
        );
        return out;
      };
      const first = packet(1, 0, nodes, handles, editors),
        immutable = compare(first).slice();
      run(4, Float64Array.of(1));
      compare(packet(2, 1, nodes, handles, editors, []));
      let stats = run(6);
      assert.equal(stats[7], 0);
      assert.equal(stats[8], 0);
      assert.equal(stats[9], 0);
      run(4, Float64Array.of(2));
      nodes[0] = { ...nodes[0], local: captureTransform([1, 0, 0, 1, 0, -15]) };
      compare(packet(3, 2, nodes, handles, editors, [0]));
      stats = run(6);
      assert.equal(stats[7], 1);
      assert.equal(stats[8], 3);
      assert.equal(stats[9], 1);
      run(5, Float64Array.of(3));
      // Retry the SAME user revision after discard with different arithmetic.
      nodes[0] = { ...nodes[0], local: captureTransform([1, 0, 0, 1, 0, 5]) };
      compare(packet(3, 2, nodes, handles, editors, [0]));
      run(4, Float64Array.of(3));
      const invalid = packet(4, 3, nodes, handles, editors, [0]);
      invalid[21] = handles[1];
      assert.equal(run(3, invalid).length, 0, 'cycle is rejected atomically');
      const stale = packet(4, 2, nodes, handles, editors, []);
      assert.equal(run(3, stale).length, 0);
      const nonfinite = packet(4, 3, nodes, handles, editors, [0]);
      nonfinite[23] = NaN;
      assert.equal(run(3, nonfinite).length, 0);
      compare(packet(4, 3, nodes, handles, editors, []));
      run(4, Float64Array.of(4));
      nodes[2] = {
        ...nodes[2],
        parent: 1,
        local: captureMatrix4([1, 0, 0, 0.001, 0, 1, 0, 0.002, 0, 0, 1, 0, 0, 0, 0, 1]),
      };
      compare(packet(5, 4, nodes, handles, editors, [2]));
      run(4, Float64Array.of(5));
      const removed = handles.pop();
      nodes.pop();
      editors.pop();
      compare(packet(6, 5, nodes, handles, editors, [], [removed]));
      run(4, Float64Array.of(6));
      handles.push(2050);
      nodes.push({ parent: 0, local: identity, clip: null });
      editors.push({ node: 2, core });
      compare(packet(7, 6, nodes, handles, editors, [2]));
      run(4, Float64Array.of(7));
      const aba = packet(8, 7, nodes, handles, editors, []);
      aba[p.headerWords + 12] = removed;
      assert.equal(run(3, aba).length, 0, 'retired editor handle cannot revive');
      assert.equal(immutable[4], 1, 'earlier result owns its numeric storage');
      stats = run(6);
      assert.equal(stats[0], 3);
      assert(stats[2] > 0 && stats[3] <= 4 * 1024 * 1024);
      run(7);
      stats = run(6);
      assert.deepEqual(Array.from(stats), [0, 0, 0, 0, 0, 1, 0, 0, 0, 0]);
      assert.equal(run(3, packet(8, 7, nodes, handles, editors, [])).length, 0);
    });
  },
);
test(
  'real framework editors stream C++ deltas with CPU commit/discard and custom-hook fallback',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    await withRetainedGeometryHarness(async (create) => {
      const controllers = Array.from(
          { length: 3 },
          (_, i) => new TextEditingController('Field ' + i),
        ),
        scroll = new ScrollController();
      let f, service, interaction;
      try {
        FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
        f = await engineFixture({ fonts: true });
        const context = f.root.context,
          api = retainedGeometryApi(create, context.owner.generation);
        interaction = new WindowsInteraction(context.owner);
        context.editing = interaction.editing;
        context.semantics = interaction.semantics;
        service = createRetainedInputGeometryService(api, context.owner, () => {});
        f.set(
          new Directionality(
            'ltr',
            new CustomScrollView({
              controller: scroll,
              primary: false,
              slivers: [
                new SliverToBoxAdapter({
                  child: new Column(
                    controllers.map(
                      (controller, i) =>
                        new SizedBox(
                          240,
                          80,
                          new EditableText(
                            'retained-' + i,
                            controller,
                            'Field ' + i,
                            undefined,
                            24,
                            null,
                            { minHeight: 0, maxLines: 1 },
                          ),
                        ),
                    ),
                    { mainSize: 'min' },
                  ),
                }),
              ],
            }),
          ),
        );
        const tree = f.root.root.renderObjects[0],
          editors = [];
        const visit = (node) => {
          if (node instanceof RenderEditable) editors.push(node);
          node.visitChildren(visit);
        };
        visit(tree);
        assert.equal(editors.length, 3);
        const read = (editor) => editor.readTextInputGeometry(context.owner, context.readMetrics()),
          before = editors.map(read);
        context.inputGeometry = service;
        f.frame();
        assert(api.sessions[0].calls > 0, 'standard paths execute actual C++');
        editors.forEach((editor, i) => assert.equal(read(editor), before[i]));
        f.frame();
        assert.equal(
          api.sessions[0].packets.at(-1)[10],
          0,
          'unchanged frame sends no node snapshot',
        );
        for (const offset of [40, 160, 0]) {
          delete context.inputGeometry;
          scroll.jumpTo(offset);
          f.advance(17);
          const expected = editors.map(read);
          context.inputGeometry = service;
          f.frame();
          editors.forEach((editor, i) => assert.equal(read(editor), expected[i]));
        }
        const activeFrame = {
          owner: context.owner,
          metrics: context.readMetrics(),
          inputGeometry: service,
        };
        let pending = tree.commitTextInputGeometries(activeFrame);
        assert.equal(read(editors[0]), null);
        assert(service.stats()[6] > 0);
        pending.discard();
        assert.equal(service.stats()[6], 0);
        assert.equal(read(editors[0]), null);
        pending = tree.commitTextInputGeometries(activeFrame);
        pending.commit();
        assert(read(editors[0]));
        pending.commit();
        assert(read(editors[0]), 'CPU geometry commit stays idempotent');
        const old = tree.commitTextInputGeometries(activeFrame),
          newer = tree.commitTextInputGeometries(activeFrame);
        newer.commit();
        const value = read(editors[0]);
        old.discard();
        assert.equal(read(editors[0]), value);
        const editor = editors[0],
          getter = Object.getOwnPropertyDescriptor(
            RenderEditable.prototype,
            'coreEditingGeometry',
          ).get;
        let reads = 0;
        Object.defineProperty(editor, 'coreEditingGeometry', {
          configurable: true,
          get() {
            reads++;
            return getter.call(this);
          },
        });
        pending = tree.commitTextInputGeometries(activeFrame);
        pending.commit();
        assert.equal(reads, 1);
        assert(api.sessions[0].closed, 'unsupported hook retracts numeric metadata');
        delete editor.coreEditingGeometry;
        f.frame();
        assert.equal(api.sessions.length, 2, 'supported tree starts a fresh native session');
        service.dispose();
        service.dispose();
        assert(api.sessions.every((value) => value.closed));
        assert.deepEqual(service.stats(), [0, 0, 0, 0, 0, 1, 0, 0, 0, 0]);
        assert.throws(() => service.begin(activeFrame), /closed/);
      } finally {
        service?.dispose();
        if (f) {
          delete f.root.context.inputGeometry;
          await f.close();
        }
        interaction?.editing.dispose();
        interaction?.semantics.dispose();
        scroll.dispose();
        controllers.forEach((value) => value.dispose());
      }
    });
  },
);
test(
  'retained producer captures budget fallback once and fences malformed or replaced cohorts',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    await withRetainedGeometryHarness(async (create) => {
      const api = retainedGeometryApi(create, 7),
        service = createRetainedInputGeometryService(api, frame.owner, () => {}),
        key = {};
      try {
        let batch = service.begin(frame),
          handle = batch.node(key, -1, identity, null);
        const selected = {
            ...core,
            selectionRects: Array.from({ length: 3000 }, () => core.selectionRects[0]),
          },
          many = Array.from({ length: 3 }, () => ({ node: handle, core: selected }));
        let candidate = batch.prepare(many);
        assert.equal(candidate.projections[0].selectionRects.length, 3000);
        assert.equal(
          api.sessions.length,
          0,
          'known capacity miss never calls C++ or revisits source hooks',
        );
        candidate.commit();
        batch = service.begin(frame);
        handle = batch.node(key, -1, identity, null);
        candidate = batch.prepare([{ node: handle, core }]);
        candidate.commit();
        assert.equal(service.stats()[0], 1);
        batch = service.begin(frame);
        handle = batch.node(key, -1, [NaN, 0, 0, 1, 0, 0], null);
        assert.throws(() => batch.prepare([{ node: handle, core }]), /Actual C\+\+ rejected/);
        assert(api.sessions[0].closed, 'protocol failure closes metadata instead of retrying TS');
        batch = service.begin(frame);
        handle = batch.node(key, -1, identity, null);
        candidate = batch.prepare([{ node: handle, core }]);
        const replacement = { ...frame, metrics: { ...frame.metrics, viewportGeneration: 4 } };
        batch = service.begin(replacement);
        assert.equal(candidate.commit(), false);
        handle = batch.node(key, -1, identity, null);
        candidate = batch.prepare([{ node: handle, core }]);
        candidate.commit();
        assert(api.sessions[1].closed, 'viewport replacement invalidates the former native owner');
        batch = service.begin(replacement);
        for (let i = 0; i < p.nodes; i++) batch.node({}, -1, identity, null);
        assert.throws(() => batch.node({}, -1, identity, null), /node budget/);
        batch.discard();
      } finally {
        service.dispose();
      }
      assert(api.sessions.every((value) => value.closed));
    });
  },
);
