// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { createInputGeometryService } from '../../skia/packages/native/dist/input-geometry.js';
import { engineFixture } from '../../../packages/material/tests/engine-fixture.mjs';
import { Directionality } from '../../dist/framework/widgets/app-data.js';
import { SizedBox, Column, SliverToBoxAdapter } from '../../dist/framework/widgets/basic.js';
import { EditableText, TextEditingController } from '../../dist/framework/widgets/editable-text.js';
import { CustomScrollView } from '../../dist/framework/widgets/scroll-view.js';
import { ScrollController } from '../../dist/framework/widgets/scroll-controller.js';
import { RenderEditable } from '../../dist/framework/rendering/editable.js';
import { RenderObject } from '../../dist/framework/rendering/object.js';
import { FoundationPlatform } from '../../dist/foundation/platform.js';
import { WindowsInteraction } from '../../sdk/dist/platforms/windows/interaction.js';
import { FrameDiagnostics } from '../../dist/ui/frame-diagnostics.js';
const timeout = 1_200_000;
test(
  'C++ service preserves real editor epochs, pending commit/discard and side-effect-free custom fallback',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-input-integration-')),
      executable = path.join(directory, 'geometry.exe'),
      root = path.resolve(import.meta.dirname, '../../..'),
      env = windowsCompilerEnvironment();
    let f, service, interaction;
    const controllers = Array.from(
        { length: 3 },
        (_, i) => new TextEditingController('Field ' + i),
      ),
      scroll = new ScrollController();
    try {
      FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
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
      let calls = 0,
        closed = 0;
      f = await engineFixture({ fonts: true });
      const context = f.root.context;
      interaction = new WindowsInteraction(context.owner);
      context.editing = interaction.editing;
      context.semantics = interaction.semantics;
      service = createInputGeometryService(
        {
          nelyxInputGeometryVersion: () => 1,
          nelyxInputGeometrySession: () => ({
            evaluate(buffer) {
              assert(++calls <= 30);
              const packet = new Float64Array(buffer);
              packet[2] = 1;
              const header = Buffer.alloc(8);
              header.writeUInt32LE(0);
              header.writeUInt32LE(packet.length, 4);
              const run = spawnSync(executable, [String(context.owner.generation)], {
                cwd: directory,
                env,
                timeout,
                input: Buffer.concat([header, Buffer.from(buffer)]),
                maxBuffer: 4 * 1024 * 1024,
              });
              if (run.error) throw run.error;
              assert.equal(run.status, 0, run.stderr?.toString());
              assert(run.stdout.readUInt32LE(0) > 0, 'Actual C++ rejected framework snapshot');
              return Uint8Array.from(run.stdout.subarray(4)).buffer;
            },
            close() {
              closed++;
            },
          }),
        },
        context.owner,
        () => {},
      );
      const treeWidget = new Directionality(
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
                      new EditableText('cpp-' + i, controller, 'Field ' + i, undefined, 24, null, {
                        minHeight: 0,
                        maxLines: 1,
                      }),
                    ),
                ),
                { mainSize: 'min' },
              ),
            }),
          ],
        }),
      );
      f.set(treeWidget);
      const tree = f.root.root.renderObjects[0],
        editors = [];
      const visit = (render) => {
        if (render instanceof RenderEditable) editors.push(render);
        render.visitChildren(visit);
      };
      visit(tree);
      assert.equal(editors.length, 3);
      const read = (editor) => editor.readTextInputGeometry(context.owner, context.readMetrics());
      const before = editors.map(read);
      context.inputGeometry = service;
      f.frame();
      const unsupported = [];
      const inspect = (node) => {
        if (node.attached && node.inputGeometrySubtreeWork === 0) return;
        for (const name of RenderObject.inputGeometryHookNames) {
          let at = node,
            d;
          while (at && !d) {
            d = Object.getOwnPropertyDescriptor(at, name);
            at = Object.getPrototypeOf(at);
          }
          if (d && !RenderObject.inputGeometryHooks.get(name)?.has(d.get ?? d.value))
            unsupported.push(node.constructor.name + '.' + name);
        }
        node.visitChildren(inspect);
      };
      if (!calls) inspect(tree);
      assert(
        calls > 0,
        'Standard render paths must execute the actual C++ kernel: ' + unsupported.join(', '),
      );
      editors.forEach((editor, i) =>
        assert.equal(
          read(editor),
          before[i],
          'Unchanged snapshots retain their exact epoch/identity',
        ),
      );
      for (const offset of [40, 160, 0]) {
        delete context.inputGeometry;
        scroll.jumpTo(offset);
        f.advance(17);
        const expected = editors.map(read);
        context.inputGeometry = service;
        f.frame();
        editors.forEach((editor, i) =>
          assert.equal(read(editor), expected[i], 'Scroll/clip geometry matches TS at ' + offset),
        );
      }
      const frame = {
        owner: context.owner,
        metrics: context.readMetrics(),
        inputGeometry: service,
      };
      let pending = tree.commitTextInputGeometries(frame);
      assert.equal(read(editors[0]), null);
      assert(editors[0].readTextInputGeometry(context.owner, frame.metrics, pending.token));
      pending.commit();
      assert(read(editors[0]));
      pending = tree.commitTextInputGeometries(frame);
      pending.discard();
      assert.equal(read(editors[0]), null);
      f.frame();
      const diagnostics = new FrameDiagnostics({ now: () => performance.now() }, 512);
      f.frame({ frameDiagnostics: diagnostics });
      const stages = diagnostics.drain().samples;
      for (const stage of [
        'input-geometry-extract',
        'input-geometry-packet',
        'input-geometry-jsi',
        'input-geometry-copy-validate',
        'input-geometry-kernel',
        'input-geometry-decode',
        'input-geometry-apply',
      ])
        assert(
          stages.some((sample) => sample.stage === stage && sample.duration >= 0),
          stage,
        );
      let notified = 0;
      const originalNotification = editors[0].onInputGeometryChanged;
      editors[0].onInputGeometryChanged = () => {
        notified++;
        originalNotification?.();
      };
      const invalidating = {
        project(...args) {
          const values = service.project(...args);
          tree.markNeedsPaint();
          return values;
        },
        dispose() {},
      };
      pending = tree.commitTextInputGeometries({ ...frame, inputGeometry: invalidating });
      assert.equal(read(editors[0]), null, 'Paint changed during calculation');
      pending.discard();
      assert.equal(notified, 1, 'Stale native results must still notify withdrawal on discard');
      f.frame();
      let inner;
      const reentrant = {
        project(...args) {
          const values = service.project(...args);
          inner = tree.commitTextInputGeometries({ owner: frame.owner, metrics: frame.metrics });
          inner.commit();
          return values;
        },
        dispose() {},
      };
      pending = tree.commitTextInputGeometries({ ...frame, inputGeometry: reentrant });
      const innerGeometry = read(editors[0]);
      assert(innerGeometry);
      pending.discard();
      assert.equal(
        read(editors[0]),
        innerGeometry,
        'Old native transaction cannot overwrite/delete a newer reentrant commit',
      );
      editors[0].onInputGeometryChanged = originalNotification;
      f.frame();
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
      const called = calls;
      pending = tree.commitTextInputGeometries(frame);
      pending.commit();
      assert.equal(reads, 1, 'Fallback proof must not evaluate a custom provider');
      assert.equal(calls, called);
      delete editor.coreEditingGeometry;
      const oldVisitor = tree.visitChildren;
      let visits = 0;
      Object.defineProperty(tree, 'visitChildren', {
        configurable: true,
        get() {
          visits++;
          throw Error('custom visitor failure');
        },
      });
      assert.throws(() => tree.commitTextInputGeometries(frame), /custom visitor failure/);
      assert.equal(visits, 1, 'Unknown getters must not run during native eligibility');
      delete tree.visitChildren;
      assert.equal(tree.visitChildren, oldVisitor);
      const beforeSubtree = calls;
      pending = editor.commitTextInputGeometries(frame);
      pending.commit();
      assert.equal(calls, beforeSubtree, 'Subtree commits cannot prove their outside ancestors');
      const replacement = Object.create(Object.getPrototypeOf(editor));
      Object.setPrototypeOf(editor, replacement);
      pending = tree.commitTextInputGeometries(frame);
      pending.commit();
      assert.equal(calls, called, 'Prototype replacement keeps the transaction in TS');
      Object.setPrototypeOf(editor, RenderEditable.prototype);
      service.dispose();
      service.dispose();
      assert.equal(closed, 1);
      assert.throws(() => service.project(frame, [], []), /closed/);
      delete context.inputGeometry;
      assert.equal(
        createInputGeometryService({}, context.owner, () => {}),
        undefined,
      );
      assert.throws(
        () =>
          createInputGeometryService(
            { nelyxInputGeometryVersion: () => 2 },
            context.owner,
            () => {},
          ),
        /version/,
      );
      console.log(
        'Real editor/native calls=' +
          calls +
          '; epochs, clipping, pending publication, custom hooks and close passed',
      );
    } finally {
      try {
        service?.dispose();
        if (f) {
          delete f.root.context.inputGeometry;
          await f.close();
        }
        interaction?.editing.dispose();
        interaction?.semantics.dispose();
        scroll.dispose();
        controllers.forEach((c) => c.dispose());
      } finally {
        assert.equal(path.dirname(fs.realpathSync(directory)), parent);
        assert(
          path.basename(directory).startsWith('nelyx-input-integration-') &&
            !fs.lstatSync(directory).isSymbolicLink(),
        );
        fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    }
  },
);
