// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { GestureBinding } from '@nelyx/core/framework/gestures/binding';
import {
  PointerCancelEvent,
  PointerDownEvent,
  PointerUpEvent,
} from '@nelyx/core/framework/gestures/events';
import { HitTestEntry } from '@nelyx/core/framework/gestures/hit-test';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { PipelineOwner } from '@nelyx/core/framework/rendering/object';
import { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Center, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { BuildOwner } from '@nelyx/core/framework/widgets/framework';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  registerTickerScheduler,
  unregisterTickerScheduler,
} from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import { KeyDownEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey, PhysicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { CupertinoSegmentedControl } from '@nelyx/cupertino/segmented-control';
import { CupertinoSegmentedControl as AggregateControl } from '@nelyx/cupertino/widgets';

const timeout = 1_200_000;
const group = (options = {}) =>
  new CupertinoSegmentedControl({
    children: new Map([
      ['a', new SizedBox(15, 10)],
      ['b', new SizedBox(45, 14)],
      ['c', new SizedBox(25, 18)],
    ]),
    onValueChanged() {},
    ...options,
  });

function* descendants(element) {
  yield element;
  for (const child of element.children) yield* descendants(child);
}

async function exercise(widget, verify, { rtl = false, width, height } = {}) {
  const media = {
    width: 400,
    height: 320,
    scale: 1,
    textScale: 1,
    safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
    keyboardInset: 0,
  };
  let now = 0;
  const clock = { now: () => now };
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
    async () => {},
    (callback) => scheduler.addPostFrame(callback),
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
  const lease = owner.bindGestureBinding(gestures);
  registerTickerScheduler(owner, scheduler);
  const tree = (control) =>
    new MediaQuery(
      media,
      new Directionality(
        rtl ? 'rtl' : 'ltr',
        new Center(width === undefined ? control : new SizedBox(width, height, control)),
      ),
    );
  const root = tree(widget).createElement();
  const flush = (time = now) => {
    now = time;
    scheduler.handleBeginFrame(now);
    owner.flushBuild();
    assert.deepEqual(errors, []);
    pipeline.flushLayout({ width: media.width, height: media.height });
    scheduler.handleDrawFrame();
    owner.focus.applyFocusChangesIfNeeded();
  };
  const elements = (type) => [...descendants(root)].filter((e) => e.widget instanceof type);
  const semantics = () => elements(Semantics).filter((e) => e.widget.properties.button);
  const strip = () => {
    let render = semantics()[0].renderObjects[0];
    while (render.children.length !== semantics().length) render = render.parent;
    return render;
  };
  const paints = () => {
    const commands = [];
    strip().paint({
      canvas: { drawRRect: (rect, paint) => commands.push({ rect, ...paint.snapshot() }) },
      paintChild() {},
    });
    return commands;
  };
  const pointerEvent = (Event, index, pointer) => {
    const { x, y } = strip().children[index].localToGlobal(new Offset(1, 1));
    gestures.handlePointerEvent(new Event({ pointer, position: new Offset(x, y), timeStamp: now }));
  };
  const platform = FoundationPlatform.hostEnvironment;
  try {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    root.mount(undefined, owner);
    owner.flushBuild();
    assert.deepEqual(errors, []);
    assert.equal(root.renderObjects.length, 1);
    pipeline.rootNode = root.renderObjects[0];
    flush();
    await verify({
      elements,
      semantics,
      strip,
      paints,
      pointerEvent,
      flush,
      owner,
      update: (control) => {
        root.update(tree(control));
        flush();
      },
    });
  } finally {
    pipeline.rootNode = null;
    root.unmount();
    unregisterTickerScheduler(owner);
    lease.dispose();
    gestures.dispose();
    owner.dispose();
    scheduler.dispose();
    FoundationPlatform.configure(platform);
  }
}

const backgrounds = (paints) =>
  paints()
    .filter((paint) => paint.style === 'fill')
    .map((paint) => paint.color);

test(
  'classic geometry uses widest and tallest child, outer padding, RTL order and a one-pixel border',
  { timeout },
  async () => {
    assert.equal(AggregateControl, CupertinoSegmentedControl);
    assert.throws(() => group({ children: new Map([['a', new SizedBox()]]) }), RangeError);
    assert.throws(() => group({ groupValue: 'missing' }), RangeError);
    await exercise(
      group({
        padding: EdgeInsets.fromLTRB(5, 3, 9, 7),
        children: new Map([
          ['a', new SizedBox(15, 10)],
          ['b', new SizedBox(45, 35)],
          ['c', new SizedBox(25, 18)],
        ]),
      }),
      ({ strip, paints, elements }) => {
        const render = strip();
        assert.deepEqual(render.size, { width: 135, height: 35 });
        assert.deepEqual(
          render.children.map((child) => child.layoutOffset.x),
          [90, 45, 0],
        );
        assert.ok(
          render.children.every((child) => child.size.width === 45 && child.size.height === 35),
        );
        assert.deepEqual(elements(SizedBox)[0].renderObjects[0].localToGlobal(new Offset(0, 0)), {
          x: 235.5,
          y: 153,
        });
        assert.deepEqual(render.localToGlobal(new Offset(0, 0)), { x: 130.5, y: 140.5 });
        assert.deepEqual(
          paints()
            .filter((paint) => paint.style === 'stroke')
            .map(({ rect, strokeWidth }) => [
              rect.left,
              rect.right,
              rect.tlRadiusX,
              rect.trRadiusX,
              strokeWidth,
            ]),
          [
            [90, 135, 0, 3, 1],
            [45, 90, 0, 0, 1],
            [0, 45, 3, 0, 1],
          ],
        );
      },
      { rtl: true },
    );
    await exercise(
      group(),
      ({ strip }) => {
        assert.deepEqual(strip().size, { width: 90, height: 28 });
        assert.deepEqual(
          strip().children.map((child) => child.size.width),
          [30, 30, 30],
        );
      },
      { width: 122, height: 20 },
    );
  },
);

test(
  'pointer, keyboard and semantics request controlled changes; press and selection colors are distinct',
  { timeout },
  async () => {
    const selected = 0xff0000ff,
      unselected = 0xffffffff,
      pressed = 0xff006600,
      border = 0xff00ff00;
    const requested = [];
    const control = (groupValue) =>
      group({
        groupValue,
        disabledChildren: new Set(['b']),
        selectedColor: selected,
        unselectedColor: unselected,
        pressedColor: pressed,
        borderColor: border,
        onValueChanged: (value) => requested.push(value),
      });
    await exercise(
      control('a'),
      async ({ semantics, elements, paints, pointerEvent, flush, owner, update }) => {
        const state = () =>
          semantics().map(({ widget: { properties: p } }) => [p.selected, p.enabled]);
        assert.deepEqual(state(), [
          [true, true],
          [false, false],
          [false, true],
        ]);
        assert.ok(
          elements(MouseRegion).every(({ widget }) => widget.cursor === SystemMouseCursors.click),
        );
        assert.deepEqual(
          elements(DefaultTextStyle).map(({ widget }) => widget.style.color),
          [unselected, 0x737a7a7a, selected],
        );
        assert.deepEqual(
          elements(IconTheme).map(({ widget }) => widget.data.color.toARGB32()),
          [unselected, 0x737a7a7a, selected],
        );
        assert.deepEqual(backgrounds(paints), [selected, unselected, unselected]);
        assert.ok(
          paints()
            .filter((paint) => paint.style === 'stroke')
            .every((paint) => paint.color === border),
        );
        pointerEvent(PointerDownEvent, 2, 1);
        await Promise.resolve();
        flush();
        assert.deepEqual(backgrounds(paints), [selected, unselected, pressed]);
        pointerEvent(PointerCancelEvent, 2, 1);
        flush();
        assert.deepEqual(backgrounds(paints), [selected, unselected, unselected]);
        for (const index of [0, 1, 2]) {
          pointerEvent(PointerDownEvent, index, index + 2);
          pointerEvent(PointerUpEvent, index, index + 2);
          flush();
        }
        assert.deepEqual(requested, ['c']);
        assert.deepEqual(state(), [
          [true, true],
          [false, false],
          [false, true],
        ]);
        assert.equal(semantics()[1].widget.properties.onTap, null);
        const space = new KeyDownEvent({
          logicalKey: LogicalKeyboardKey.space,
          physicalKey: PhysicalKeyboardKey.space,
          timeStamp: 0,
        });
        assert.equal(owner.focus.dispatchKeyEvent(space), 'handled');
        assert.deepEqual(requested, ['c', 'c']);
        assert.equal(
          owner.focus.dispatchKeyEvent(
            new KeyDownEvent({
              logicalKey: LogicalKeyboardKey.arrowLeft,
              physicalKey: PhysicalKeyboardKey.arrowLeft,
              timeStamp: 0,
            }),
          ),
          'handled',
        );
        owner.focus.applyFocusChangesIfNeeded();
        assert.equal(owner.focus.dispatchKeyEvent(space), 'handled');
        assert.deepEqual(requested, ['c', 'c', 'a']);
        update(control('c'));
        assert.deepEqual(backgrounds(paints), [selected, unselected, pressed]);
        flush(82.5);
        assert.deepEqual(backgrounds(paints), [
          Color.lerp(new Color(unselected), new Color(selected), 0.5).toARGB32(),
          unselected,
          Color.lerp(new Color(pressed), new Color(selected), 0.5).toARGB32(),
        ]);
        flush(165);
        assert.deepEqual(backgrounds(paints), [unselected, unselected, selected]);
        assert.deepEqual(state(), [
          [false, true],
          [false, false],
          [true, true],
        ]);
        update(control('b'));
        assert.equal(backgrounds(paints)[1], new Color(selected).withOpacity(0.5).toARGB32());
        update(control(null));
        assert.deepEqual(state(), [
          [false, true],
          [false, false],
          [false, true],
        ]);
      },
    );
  },
);
