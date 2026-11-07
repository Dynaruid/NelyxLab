// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { BuildOwner, buildNativeWidget } from '@nelyx/core/framework/widgets/framework';
import { Builder } from '@nelyx/core/framework/widgets/basic';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { OriginalEditingBridge } from '../../runtime/engine-client/original-editing.ts';
import { OriginalFocusBridge } from '../../runtime/engine-client/original-focus.ts';
import { OriginalNativeRender } from '../../runtime/engine-client/original-native-node.ts';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';

test(
  'Original editor acknowledges an edit observed before its receipt and rejects an older receipt',
  { timeout: 1_200_000 },
  async () => {
    const handle = { slot: 1, generation: 1 },
      changes = [],
      rejected = [],
      errors = [];
    let controller,
      current = {
        text: 'one',
        base: 3,
        extent: 3,
        composingStart: -1,
        composingEnd: -1,
        revision: 1n,
      };
    let edit = 0;
    const view = {
      owner: { session: 1, app: 1, view: 1, generation: 1 },
      editSnapshot: async () => current,
      request: async () => ({}),
      edit: async (_node, update) => {
        const result = {
          ...current,
          text: update.text,
          base: update.base,
          extent: update.extent,
          revision: current.revision + 1n,
        };
        current =
          ++edit === 1 ? result : { ...result, text: 'newer', revision: result.revision + 1n };
        // Native observation wins the scheduling race, before the request resolves.
        controller.publish(current);
        return result;
      },
    };
    const bridge = new OriginalEditingBridge(
      view,
      () => handle,
      () => {},
      (error) => errors.push(error),
      (reason) => {
        throw Error(reason);
      },
      (apply) => apply(),
    );
    const owner = new BuildOwner(
      {
        owner: bridge.owner,
        defaultFont: { id: 'font', generation: 1 },
        readMetrics: () => ({ scale: 1, logicalWidth: 300, logicalHeight: 100 }),
        readStatus: () => 'open',
      },
      () => {},
    );
    bridge.install(owner);
    const initial = {
      text: 'one',
      selection: { anchor: 3, focus: 3 },
      composing: { status: 'none' },
      revision: 0,
      session: bridge.owner,
      source: 'programmatic',
    };
    const binding = bridge.bind(bridge.owner, initial, (value) => changes.push(value), {
      id: 'editor',
      synchronizationRejected: (...args) => rejected.push(args),
    });

    const sourceController = new TextEditingController('one');
    const root = new Builder((context) =>
      buildNativeWidget(
        context,
        'editable-text',
        new EditableText('editor', sourceController, 'Editor'),
      ),
    ).createElement();
    try {
      root.mount(undefined, owner);
      owner.flushBuild();
      root.syncRenderTree();
      controller = root.renderObjects[0].editable.editor;
      await bridge.finishBuild();
      const before = changes.length;
      binding.replace({ ...initial, text: 'two' }, 1);
      for (let attempt = 0; attempt < 30 && changes.length < before + 2; ++attempt)
        await new Promise(setImmediate);
      assert.deepEqual(
        changes.slice(before).map((value) => [value.source, value.text]),
        [
          ['native', 'two'],
          ['programmatic', 'two'],
        ],
      );
      assert.ok(changes.at(-1).revision > changes.at(-2).revision);
      assert.deepEqual(rejected, []);
      binding.replace({ ...binding.read(), text: 'old', selection: { anchor: 3, focus: 3 } }, 2);
      for (let attempt = 0; attempt < 30 && !rejected.length; ++attempt)
        await new Promise(setImmediate);
      assert.deepEqual(rejected, [[2, 'stale']]);
      assert.equal(binding.read().text, 'newer');
      assert.deepEqual(errors, []);
    } finally {
      binding.dispose();
      await bridge.close();
      root.unmount();
      sourceController.dispose();
      owner.dispose();
    }
  },
);

test(
  'Source focus targets the actual Core editor and expires a request after a newer OS focus session',
  { timeout: 1_200_000 },
  async () => {
    const calls = [],
      errors = [],
      editorHandle = { slot: 2, generation: 1 };
    const owner = new BuildOwner({ owner: { id: 'view', generation: 1 } }, () => {});
    let blocked = false;
    const view = { focus: async (...args) => calls.push(args) };
    const root = new OriginalNativeRender('box', { nativeFocus: { enabled: true } });
    const editor = new OriginalNativeRender('editable', {}, {});
    root.insert(editor);
    const other = new OriginalNativeRender('box', { nativeFocus: { enabled: true } });
    const node = new FocusNode(),
      next = new FocusNode();
    owner.focus.add(node);
    owner.focus.add(next);
    const bridge = new OriginalFocusBridge(
      owner,
      view,
      (render) =>
        render === editor ? editorHandle : { slot: render === root ? 1 : 3, generation: 1 },
      () => !blocked,
      (error) => errors.push(error),
      () => {},
    );
    bridge.bind(node).render = root;
    bridge.bind(next).render = other;
    const state = {
      document: 1n,
      metrics: 1n,
      device: 1n,
      publication: 1n,
      publishedDocument: 1n,
      publishedMetrics: 1n,
      publishedDevice: 1n,
      visible: true,
      focused: true,
      nodes: [],
      focus: null,
    };
    bridge.observePublication(state);
    bridge.observeState(state);
    try {
      node.requestFocus();
      for (let attempt = 0; attempt < 30 && !calls.length; ++attempt)
        await new Promise(setImmediate);
      assert.deepEqual(calls, [[editorHandle, 1n, 0n, true]]);
      blocked = true;
      next.requestFocus();
      await new Promise(setImmediate);
      assert.equal(calls.length, 1);
      const newer = { ...state, focus: { node: editorHandle, session: 9n } };
      bridge.observePublication(newer);
      bridge.observeState(newer);
      blocked = false;
      bridge.finishPoll();
      await new Promise(setImmediate);
      assert.equal(calls.length, 1, 'A queued old request cannot steal the newer OS focus');
      assert.deepEqual(errors, []);
    } finally {
      bridge.close();
      owner.dispose();
      node.dispose();
      next.dispose();
      root.remove(editor);
      editor.dispose();
      root.dispose();
      other.dispose();
    }
  },
);
