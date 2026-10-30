// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { NativeInteraction } from '../../sdk/dist/runtime/native-interaction.js';
import { createReactNativeInteractionControls } from '../../sdk/dist/backends/react-native/interaction-controls.js';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { SizedBox, Transform } from '@nelyx/core/framework/widgets/basic';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { ValueKey } from '@nelyx/core/foundation/key';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { RenderTransform } from '@nelyx/core/framework/rendering/boxes';
import { engineFixture } from '../../../packages/material/tests/engine-fixture.mjs';

// Actual React reconciliation and Core/CanvasKit; native I/O is controlled here.
// The Android API/APK fixtures qualify the matching native implementation.
test(
  'Android input keeps its native identity and composition across Core semantic reparenting, clipping and availability changes',
  { timeout: 1_200_000 },
  async () => {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'android' });
    const disk = fs.statfsSync(process.cwd());
    assert(disk.bavail * disk.bsize >= 20 * 1024 ** 3, 'At least 20 GiB of free disk is required');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-native-input-react-')),
      previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
    let tree, f, interaction, controller, failure;
    try {
      const installed = spawnSync(
        'cmd.exe',
        [
          '/d',
          '/c',
          'npm.cmd',
          'install',
          '--prefix',
          temp,
          'react@19.2.0',
          'react-test-renderer@19.2.0',
          'react-is@19.3.0',
          'scheduler@0.27.0',
          '--offline',
          '--ignore-scripts',
          '--no-package-lock',
          '--no-audit',
          '--no-fund',
        ],
        { encoding: 'utf8', timeout: 1_200_000, windowsHide: true },
      );
      assert.equal(installed.status, 0, installed.stdout + installed.stderr);
      const load = createRequire(path.join(temp, 'package.json')),
        react = load('react'),
        renderer = load('react-test-renderer'),
        { act } = react;
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      const allocations = [],
        commands = [];
      let tag = 100;
      const native = {
        Platform: { OS: 'android' },
        UIManager: {
          getViewManagerConfig: (name) => ({
            Constants:
              name === 'NelyxInputConnection'
                ? { inputConnectionProtocol: 4 }
                : { semanticsProtocol: 2 },
          }),
          dispatchViewManagerCommand: (...args) => commands.push(args),
        },
        requireNativeComponent: (name) => name,
        findNodeHandle: (ref) => ref?.tag ?? null,
        View: 'View',
        Text: 'Text',
        Pressable: 'Pressable',
      };
      const Controls = createReactNativeInteractionControls(() => ({ react, native }));
      f = await engineFixture({ fonts: true });
      controller = new TextEditingController();
      interaction = new NativeInteraction(f.root.context.owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
        geometry: 'unavailable',
      });
      f.root.context.editing = interaction.editing;
      f.root.context.semantics = interaction.semantics;
      const key = new GlobalKey('retained Core editor');
      const scene = (parent, enabled = true, dx = 0) =>
        new Semantics(
          new Transform(
            new EditableText('field', controller, 'Name', undefined, 48, key, { enabled }),
            [1, 0, 0, 1, dx, 0],
          ),
          { id: parent, role: 'group', name: '', enabled: true, container: true },
          new ValueKey(parent),
        );
      await act(() => {
        f.set(scene('before'));
        tree = renderer.create(react.createElement(Controls, { interaction }), {
          createNodeMock: (element) => {
            const ref = { tag: ++tag };
            allocations.push({
              type: element.type,
              tag: ref.tag,
              textInput: !!element.props.textInput,
            });
            return ref;
          },
        });
      });
      const endpoint = () => tree.root.findByType('NelyxInputConnection'),
        proxy = () =>
          tree.root.findAllByType('NelyxSemantics').find((node) => node.props.textInput);
      const nativeTag = interaction.editorNativeTag('field'),
        generation = interaction.editorGeneration('field'),
        coreState = key.currentState;
      const initialBounds = interaction.editorInputBounds('field');
      assert(initialBounds);
      assert.deepEqual(endpoint().props.style, {
        position: 'absolute',
        left: initialBounds.x,
        top: initialBounds.y,
        width: initialBounds.width,
        height: initialBounds.height,
      });
      assert(nativeTag > 0);
      assert.equal(endpoint().props.accessible, false);
      assert.equal(endpoint().props.importantForAccessibility, 'no');
      assert.equal(proxy().props.textInput.target, nativeTag);
      assert.equal(
        proxy().props.accessibilityValue,
        undefined,
        'The editable value is exposed as text, without duplicating it in the label',
      );
      assert.equal(
        interaction.nativeSemanticsTag(interaction.node('field', 'text-field').sourceNodeId),
        allocations.find((entry) => entry.type === 'NelyxSemantics' && entry.textInput).tag,
      );
      await act(() => {
        endpoint().props.onNelyxEditing({
          nativeEvent: {
            revision: 1,
            text: '한',
            anchor: 1,
            focus: 1,
            composingStart: 0,
            composingEnd: 1,
            focused: true,
            source: 'native',
          },
        });
        f.frame();
      });
      assert(controller.isComposing);
      assert.equal(proxy().props.textInput.value, '한');
      const inputAllocations = () =>
        allocations.filter((entry) => entry.type === 'NelyxInputConnection').length;
      assert.equal(inputAllocations(), 1);
      await act(() => {
        f.set(scene('after'));
      });
      assert.equal(key.currentState, coreState);
      assert.equal(interaction.editorGeneration('field'), generation);
      assert.equal(interaction.editorNativeTag('field'), nativeTag);
      assert.equal(inputAllocations(), 1);
      assert(controller.isComposing);
      let transform;
      const visit = (element) => {
        if (element.renderObject instanceof RenderTransform) transform = element.renderObject;
        element.visitChildren(visit);
      };
      visit(f.root.root);
      assert(transform);
      await act(() => {
        transform.matrix = [1, 0, 0, 1, 10000, 0];
        f.frame();
      });
      assert.equal(
        interaction.node('field', 'text-field'),
        undefined,
        'Clipping removes the field from the actual Core semantics snapshot',
      );
      assert.equal(proxy(), undefined);
      assert.equal(
        endpoint().props.editable,
        true,
        'A clipped live Core editor remains a valid input connection',
      );
      assert.equal(interaction.editorNativeTag('field'), nativeTag);
      assert(controller.isComposing);
      await act(() => {
        f.set(scene('after', false, 10000));
      });
      assert.equal(
        endpoint().props.editable,
        false,
        'Core availability reaches an endpoint that has no semantics node',
      );
      await act(() => {
        f.set(scene('after', true));
      });
      assert.equal(endpoint().props.editable, true);
      assert.equal(proxy().props.textInput.target, nativeTag);
      assert.equal(proxy().props.textInput.value, '한');
      assert.equal(inputAllocations(), 1);
      const restoredBounds = interaction.editorInputBounds('field');
      assert.deepEqual(endpoint().props.style, {
        position: 'absolute',
        left: restoredBounds.x,
        top: restoredBounds.y,
        width: restoredBounds.width,
        height: restoredBounds.height,
      });
      assert(
        !commands.some((command) => command[1] === 'replaceComposing'),
        'Semantic reparenting and clipping must not synthesize composition cancellation',
      );
      const retired = endpoint().props.onNelyxEditing;
      const beforeRetirement = commands.length;
      await act(() => {
        f.set(new SizedBox());
      });
      assert.equal(tree.root.findAllByType('NelyxInputConnection').length, 0);
      assert.equal(interaction.editorClients.length, 0);
      assert(
        commands
          .slice(beforeRetirement)
          .some((command) => command[0] === nativeTag && command[1] === 'blur'),
        'The actual Core disposal sends blur while the React input ref still identifies its native endpoint',
      );
      retired({
        nativeEvent: {
          revision: 2,
          text: 'late',
          anchor: 4,
          focus: 4,
          composingStart: -1,
          composingEnd: -1,
          source: 'native',
        },
      });
      assert.equal(controller.text, '한');
      await act(() => {
        tree.unmount();
      });
      tree = undefined;
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      const errors = [];
      for (const close of [
        async () => {
          if (tree) {
            const load = createRequire(path.join(temp, 'package.json'));
            await load('react').act(() => {
              tree.unmount();
            });
          }
        },
        () => f?.close(),
        () => interaction?.dispose(),
        () => controller?.dispose(),
        () => {
          globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
        },
        () => fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }),
      ])
        try {
          await close();
        } catch (error) {
          errors.push(error);
        }
      /* oxlint-disable no-unsafe-finally -- Retirement and finalization failures must propagate, including while unwinding a frame or test. */
      if (errors.length)
        throw new AggregateError(
          failure ? [failure, ...errors] : errors,
          'Input lifetime fixture cleanup failed',
        );
      /* oxlint-enable no-unsafe-finally */
    }
  },
);
