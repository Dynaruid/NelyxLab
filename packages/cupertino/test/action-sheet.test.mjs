// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { GestureBinding } from '@nelyx/core/framework/gestures/binding';
import { PointerDownEvent, PointerUpEvent } from '@nelyx/core/framework/gestures/events';
import { HitTestEntry } from '@nelyx/core/framework/gestures/hit-test';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import { PipelineOwner } from '@nelyx/core/framework/rendering/object';
import { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { AppFocus } from '@nelyx/core/framework/widgets/app-focus';
import { DecoratedBox, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { BuildOwner } from '@nelyx/core/framework/widgets/framework';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  registerTickerScheduler,
  unregisterTickerScheduler,
} from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import { KeyDownEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey, PhysicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { Offset } from '@nelyx/core/ui/offset';
import { PointerDeviceKind } from '@nelyx/core/ui/pointer';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { CupertinoActionSheet, CupertinoActionSheetAction } from '@nelyx/cupertino/action-sheet';
import { CupertinoAlertDialog, CupertinoDialogAction } from '@nelyx/cupertino/dialog';
import { CupertinoMenuItem } from '@nelyx/cupertino/menu-anchor';

function visit(element, predicate) {
  if (predicate(element.widget)) return element;
  for (const child of element.children) {
    const result = visit(child, predicate);
    if (result) return result;
  }
}

function layout(widget, verify, keyboardInset = 0) {
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
      // The scripted taps are inside the action clips.
      paths: { contains: () => true },
    },
    () => {},
  );
  const pipeline = new PipelineOwner({ accessibilityEnabled: false });
  const gestures = new GestureBinding({
    devicePixelRatioForView: () => 1,
    gestureArena: owner.gestures,
    scheduler,
    hitTestInView: (result, position) => {
      const entries = [];
      pipeline.rootNode.hitTest(position, entries);
      for (const entry of entries) {
        if (result.addCapturedLegacyEntry(entry)) continue;
        result.pushTransform(entry.transform);
        const source = entry.createSourceEntry?.() ?? new HitTestEntry(entry.target);
        result.add(source);
        entry.onSourceEntry?.(source);
        result.popTransform();
      }
    },
  });
  const gestureLease = owner.bindGestureBinding(gestures);
  registerTickerScheduler(owner, scheduler);
  const root = new MediaQuery(media, new Directionality('ltr', widget)).createElement();
  const flush = () => {
    owner.focus.applyFocusChangesIfNeeded();
    owner.flushBuild();
    pipeline.flushLayout({ width: media.width, height: media.height });
    assert.deepEqual(errors, []);
  };
  const platform = FoundationPlatform.hostEnvironment;
  try {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'ios' });
    root.mount(undefined, owner);
    owner.flushBuild();
    assert.deepEqual(errors, []);
    assert.equal(root.renderObjects.length, 1);
    pipeline.rootNode = root.renderObjects[0];
    flush();
    verify(root, {
      focus: owner.focus,
      flush,
      tap(matches, kind = PointerDeviceKind.mouse) {
        const action = visit(
          root,
          (widget) => widget instanceof Semantics && matches(widget.properties),
        );
        assert.ok(action);
        const render = action.renderObjects[0];
        const { x, y } = render.localToGlobal(
          new Offset(render.size.width / 2, render.size.height / 2),
        );
        const event = { pointer: 1, kind, position: new Offset(x, y) };
        gestures.handlePointerEvent(new PointerDownEvent(event));
        gestures.handlePointerEvent(new PointerUpEvent(event));
        flush();
      },
    });
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

test(
  'sheet actions keep pointer presses separate from the keyboard focus halo',
  { timeout },
  () => {
    const selected = [];
    const action = (id) =>
      new CupertinoActionSheetAction({
        child: new SizedBox(10, 20),
        id,
        onPressed: () => selected.push(id),
      });
    layout(
      new AppFocus(
        new CupertinoActionSheet({
          actions: [action('first'), action('second')],
          cancelButton: action('cancel'),
        }),
      ),
      (root, { focus, flush, tap }) => {
        const halo = () =>
          visit(
            root,
            (widget) =>
              widget instanceof DecoratedBox &&
              widget.position === 'foreground' &&
              widget.decoration instanceof ColorShapeDecoration &&
              widget.decoration.shape.side?.width > 0,
          );
        const pressKey = (key) => {
          assert.equal(
            focus.dispatchKeyEvents([
              new KeyDownEvent({
                physicalKey: PhysicalKeyboardKey[key],
                logicalKey: LogicalKeyboardKey[key],
                timeStamp: 0,
              }),
            ]),
            'handled',
          );
          flush();
        };
        const initialFocus = focus.primaryFocus;
        tap(({ identifier }) => identifier === 'first');
        assert.equal(focus.primaryFocus, initialFocus);
        assert.equal(halo(), undefined);
        tap(({ identifier }) => identifier === 'cancel', PointerDeviceKind.touch);
        assert.equal(focus.primaryFocus, initialFocus);
        assert.equal(halo(), undefined);
        pressKey('tab');
        assert.ok(halo());
        pressKey('enter');
        assert.deepEqual(selected, ['first', 'cancel', 'first']);
      },
    );
  },
);

test('dialog action taps activate without taking focus', { timeout }, () => {
  let activations = 0;
  const onPressed = () => activations++;
  const action = () =>
    new CupertinoDialogAction({ child: new SizedBox(10, 20), id: 'confirm', onPressed });
  for (const widget of [action(), new CupertinoAlertDialog({ actions: [action()] })]) {
    layout(new AppFocus(widget), (_root, { focus, tap }) => {
      const initialFocus = focus.primaryFocus;
      tap(({ identifier }) => identifier === 'confirm');
      assert.equal(focus.primaryFocus, initialFocus);
    });
  }
  assert.equal(activations, 2);
});

test('menu item clicks respect opt-out of hover focus', { timeout }, () => {
  let activations = 0;
  const menuItem = new CupertinoMenuItem({
    child: new SizedBox(10, 20),
    requestFocusOnHover: false,
    onPressed: () => activations++,
  });
  layout(new AppFocus(menuItem), (_root, { focus, tap }) => {
    const initialFocus = focus.primaryFocus;
    tap(({ role }) => role === SemanticsRole.menuItem);
    assert.equal(activations, 1);
    assert.equal(focus.primaryFocus, initialFocus);
  });
});
