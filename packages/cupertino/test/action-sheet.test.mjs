// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { GestureBinding } from '@nelyx/core/framework/gestures/binding';
import { PipelineOwner } from '@nelyx/core/framework/rendering/object';
import { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { BuildOwner } from '@nelyx/core/framework/widgets/framework';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  registerTickerScheduler,
  unregisterTickerScheduler,
} from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import { CupertinoActionSheet, CupertinoActionSheetAction } from '@nelyx/cupertino/action-sheet';

function visit(element, predicate) {
  if (predicate(element.widget)) return element;
  for (const child of element.children) {
    const result = visit(child, predicate);
    if (result) return result;
  }
}

function layout(sheet, verify, keyboardInset = 0) {
  const media = {
    width: 400,
    height: 320,
    scale: 1,
    textScale: 1,
    safeArea: { left: 0, top: 0, right: 0, bottom: 10 },
    keyboardInset,
  };
  const clock = { now: () => 0 };
  const scheduler = new FrameScheduler(clock, () => {});
  const errors = [];
  const owner = new BuildOwner(
    {
      clock,
      scheduler,
      readMetrics: () => media,
      readStatus: () => 'open',
      reportError: ({ exception }) => errors.push(exception),
    },
    () => {},
  );
  const gestures = new GestureBinding({
    devicePixelRatioForView: () => 1,
    gestureArena: owner.gestures,
    scheduler,
  });
  const gestureLease = owner.bindGestureBinding(gestures);
  registerTickerScheduler(owner, scheduler);
  const pipeline = new PipelineOwner({ accessibilityEnabled: false });
  const root = new MediaQuery(media, new Directionality('ltr', sheet)).createElement();
  const platform = FoundationPlatform.hostEnvironment;
  try {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'ios' });
    root.mount(undefined, owner);
    owner.flushBuild();
    assert.deepEqual(errors, []);
    assert.equal(root.renderObjects.length, 1);
    pipeline.rootNode = root.renderObjects[0];
    pipeline.flushLayout({ width: media.width, height: media.height });
    assert.deepEqual(errors, []);
    verify(root);
  } finally {
    pipeline.rootNode = null;
    root.unmount();
    unregisterTickerScheduler(owner);
    gestureLease.dispose();
    gestures.dispose();
    owner.dispose();
    scheduler.dispose();
    FoundationPlatform.configure(platform);
  }
}

const timeout = 1_200_000;

test(
  'long content and actions scroll independently above a fixed cancel action',
  { timeout },
  () => {
    const message = new ScrollController();
    const actions = new ScrollController();
    const pressed = [];
    const action = (id) =>
      new CupertinoActionSheetAction({
        child: new SizedBox(70, 22),
        id,
        onPressed: () => pressed.push(id),
      });
    try {
      layout(
        new CupertinoActionSheet({
          message: new SizedBox(50, 400),
          actions: Array.from({ length: 8 }, (_, i) => action(`action-${i}`)),
          cancelButton: action('cancel'),
          messageScrollController: message,
          actionScrollController: actions,
        }),
        (root) => {
          assert.ok(message.position.maxScrollExtent > 0);
          assert.ok(actions.position.maxScrollExtent > 0);
          const cancel = visit(
            root,
            (widget) => widget instanceof Semantics && widget.properties.identifier === 'cancel',
          );
          assert.ok(cancel);
          const render = cancel.renderObjects[0];
          const top = render.localToGlobal({ x: 0, y: 0 });
          assert.ok(Math.abs(top.y + render.size.height - 310) < 0.01);
          assert.equal(render.size.width, 304);
          cancel.widget.properties.onTap();
          assert.deepEqual(pressed, ['cancel']);
        },
      );
      assert.equal(message.hasClients, false);
      assert.equal(actions.hasClients, false);
      message.addListener(() => {});
      actions.addListener(() => {});
    } finally {
      message.dispose();
      actions.dispose();
    }
  },
);

test('cancel-only sheet shrink-wraps without an empty main section', { timeout }, () => {
  layout(new CupertinoActionSheet({ cancelButton: new SizedBox(10, 60) }), (root) => {
    const dialog = visit(
      root,
      (widget) => widget instanceof Semantics && widget.properties.role === 'dialog',
    );
    assert.ok(dialog);
    assert.equal(dialog.renderObjects[0].size.height, 60);
  });
});

test('short sections shrink-wrap above the keyboard inset', { timeout }, () => {
  layout(
    new CupertinoActionSheet({
      title: new SizedBox(10, 20),
      actions: [
        new CupertinoActionSheetAction({ child: new SizedBox(10, 20), onPressed: () => {} }),
      ],
    }),
    (root) => {
      const dialog = visit(
        root,
        (widget) => widget instanceof Semantics && widget.properties.role === 'dialog',
      );
      assert.ok(dialog);
      const render = dialog.renderObjects[0];
      assert.ok(render.size.height > 100 && render.size.height < 110);
      const top = render.localToGlobal({ x: 0, y: 0 });
      assert.ok(Math.abs(top.y + render.size.height - 230) < 0.01);
    },
    90,
  );
});
