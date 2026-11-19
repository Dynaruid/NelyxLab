// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { GestureBinding } from '@nelyx/core/framework/gestures/binding';
import { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import {
  registerTickerScheduler,
  unregisterTickerScheduler,
} from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { BuildOwner } from '@nelyx/core/framework/widgets/framework';
import { UnmanagedRestorationScope } from '@nelyx/core/framework/widgets/restoration';
import { StandardMessageCodec } from '@nelyx/core/services/message-codecs';
import { RestorationManager } from '@nelyx/core/services/restoration';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { CupertinoSearchTextField } from '@nelyx/cupertino/search-field';

const media = {
  width: 400,
  height: 320,
  scale: 1,
  textScale: 1,
  safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
};
const codec = new StandardMessageCodec();
const timeout = 1_200_000;
function widgetWithEditor(element) {
  if (element.widget instanceof EditableText) return element.widget;
  for (const child of element.children) {
    const found = widgetWithEditor(child);
    if (found) return found;
  }
}
function editorFixture(data) {
  const manager = new RestorationManager();
  manager.handleRestorationUpdateFromEngine({ enabled: true, data });
  const errors = [],
    postFrame = [];
  const clock = { now: () => 0 };
  const scheduler = new FrameScheduler(clock, () => {});
  const resources = new ResourceRegistry();
  const defaultFont = resources.allocateId('font');
  resources.register({ ...defaultFont, kind: 'font' }, () => {});
  const owner = new BuildOwner(
    {
      owner: { id: 'search-test', generation: 1 },
      clock,
      scheduler,
      defaultFont,
      resources,
      assets: new Map(),
      text: {
        layout(input) {
          const resource = resources.allocateId('paragraph');
          resources.register({ ...resource, kind: 'paragraph' }, () => {});
          const width = Math.min(input.width, input.text.length * 8);
          const height = 20;
          return {
            resource,
            input,
            indexUnit: 'utf16',
            width,
            height,
            alphabeticBaseline: 15,
            ideographicBaseline: 15,
            minIntrinsicWidth: width,
            maxIntrinsicWidth: width,
            longestLine: width,
            overflow: false,
            unresolvedGlyphs: 0,
            lines: [
              {
                start: 0,
                end: input.text.length,
                baseline: 15,
                height,
                bounds: { x: 0, y: 0, width, height },
              },
            ],
          };
        },
      },
      readMetrics: () => media,
      readStatus: () => 'open',
      reportError: ({ exception }) => errors.push(exception),
      editing: {
        capabilities: { composing: 'unavailable' },
        bind(_owner, initial, changed) {
          let value = initial;
          return {
            read: () => value,
            replace(next) {
              value = { ...next, revision: value.revision + 1 };
              changed(value);
            },
            focus() {},
            blur() {},
            dispose() {},
          };
        },
      },
    },
    () => {},
    (callback) => postFrame.push(callback),
  );
  const gestures = new GestureBinding({
    devicePixelRatioForView: () => 1,
    gestureArena: owner.gestures,
    scheduler,
  });
  const gestureLease = owner.bindGestureBinding(gestures);
  registerTickerScheduler(owner, scheduler);
  const tree = (options) =>
    new UnmanagedRestorationScope({
      bucket: manager.currentRootBucket,
      child: new MediaQuery(
        media,
        new Directionality(
          'ltr',
          new CupertinoSearchTextField({
            id: 'query',
            restorationId: 'search',
            ...options,
          }),
        ),
      ),
    });
  const root = tree({}).createElement();
  const settle = () => {
    owner.flushBuild();
    for (const callback of postFrame.splice(0)) callback();
    assert.deepEqual(errors, []);
    const editor = widgetWithEditor(root);
    assert.ok(editor, 'Search field must mount a Core editing widget');
    return editor;
  };
  root.mount(undefined, owner);
  return {
    editor: settle,
    update(options) {
      root.update(tree(options));
      return settle();
    },
    data() {
      const bytes = codec.encodeMessage(manager.currentRootBucket._raw());
      return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    },
    close() {
      root.unmount();
      unregisterTickerScheduler(owner);
      gestureLease.dispose();
      gestures.dispose();
      owner.dispose();
      scheduler.dispose();
      manager.dispose();
      resources.dispose();
    },
  };
}

test(
  'a caller-owned edit value becomes locally restorable without disposing borrowed objects',
  { timeout },
  (t) => {
    const previousPlatform = FoundationPlatform.hostEnvironment;
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'ios' });
    const borrowed = new TextEditingController('pear');
    const focus = new FocusNode();
    t.after(() => {
      borrowed.dispose();
      focus.dispose();
      FoundationPlatform.configure(previousPlatform);
    });
    const fixture = editorFixture(null);
    let snapshot;
    try {
      const first = fixture.editor();
      const external = fixture.update({ controller: borrowed, focusNode: focus });
      assert.equal(external.controller, borrowed);
      assert.equal(external.focusNode, focus);
      assert.throws(() => {
        first.controller.text = 'disposed';
      });
      borrowed.selection = { anchor: 1, focus: 3 };
      const local = fixture.update({});
      assert.notEqual(local.focusNode, focus);
      assert.equal(local.controller.text, 'pear');
      assert.deepEqual(local.controller.selection, { anchor: 1, focus: 3 });
      local.controller.text = 'peach';
      snapshot = fixture.data();
    } finally {
      fixture.close();
    }
    borrowed.text = 'still caller-owned';
    focus.addListener(() => {});
    const restored = editorFixture(snapshot);
    try {
      assert.equal(restored.editor().controller.text, 'peach');
    } finally {
      restored.close();
    }
  },
);
