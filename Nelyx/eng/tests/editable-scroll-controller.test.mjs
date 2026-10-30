// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import {
  ClampingScrollPhysics,
  NeverScrollableScrollPhysics,
} from '@nelyx/core/framework/widgets/scroll-physics';
import { ScrollBehavior } from '@nelyx/core/framework/widgets/scroll-configuration';
import { RootRestorationScope } from '@nelyx/core/framework/widgets/restoration';
import { RestorationManager } from '@nelyx/core/services/restoration';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { EditingSession } from '@nelyx/core/ui/editing';
import { Center, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { TextPosition } from '@nelyx/core/ui/text-position';
import { engineFixture } from '../../../packages/material/tests/engine-fixture.mjs';

const timeout = 1_200_000,
  text = Array.from({ length: 16 }, (_, i) => 'Line ' + i).join('\n');
const behavior = new ScrollBehavior().copyWith({ scrollbars: false, overscroll: false });
function input(f) {
  f.root.context.editing = {
    capabilities: { indexUnit: 'utf16', composing: 'observed', selectionDirection: 'observed' },
    bind(owner, initial, changed, options) {
      const session = new EditingSession(owner, initial);
      return {
        read: () => session.value,
        get isComposing() {
          return false;
        },
        replace: (value) => {
          session.update({
            ...value,
            source: 'programmatic',
            revision: session.value.revision + 1,
          });
          changed(session.value);
        },
        focus() {
          options.focusChanged?.(true);
        },
        blur() {
          options.focusChanged?.(false);
        },
        dispose() {
          session.dispose();
        },
      };
    },
  };
}
function scene(controller, scroll, key, options = {}, focus) {
  return new Center(
    new SizedBox(
      220,
      60,
      new EditableText('scroll-editor', controller, 'Editor scrolling', focus, 0, key, {
        maxLines: 2,
        textStyle: new TextStyle({ fontSize: 20, height: 1.2 }),
        scrollController: scroll,
        scrollBehavior: behavior,
        ...options,
      }),
    ),
  );
}
function wheel(f, dy) {
  const bounds = f.root.nodes.find((node) => node.id === 'scroll-editor').bounds;
  f.root.pointer({
    kind: 'wheel',
    pointer: 1,
    device: 'mouse',
    buttons: 0,
    x: bounds.x + 30,
    y: bounds.y + 20,
    deltaY: dy,
    deltaX: 0,
    timestamp: f.root.context.clock.now(),
    viewportGeneration: 1,
  });
  f.frame();
}

test(
  'the public controller is the actual painted paragraph offset and retains explicit scroll through blink and animation',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      scroll = new ScrollController({ initialScrollOffset: 40 }),
      focus = new FocusNode(),
      key = new GlobalKey('public editor scroll');
    input(f);
    controller.selection = { anchor: 0, focus: 0 };
    try {
      f.set(scene(controller, scroll, key, {}, focus));
      const render = key.currentState.renderEditable,
        position = scroll.position;
      assert.equal(render.offset, position);
      assert.equal(render.scrollOffset.y, 40);
      assert.equal(position.viewportDimension, 60);
      assert(position.maxScrollExtent > 100);
      const before = render.getLocalRectForCaret({ offset: 0, affinity: 'downstream' });
      scroll.jumpTo(72);
      f.frame();
      assert.equal(render.scrollOffset.y, 72);
      assert.equal(
        render.getLocalRectForCaret({ offset: 0, affinity: 'downstream' }).y,
        before.y - 32,
      );
      assert.equal(controller.text, text);
      assert.deepEqual(controller.selection, { anchor: 0, focus: 0 });
      focus.requestFocus();
      f.root.buildOwner.focus.applyFocusChangesIfNeeded();
      f.frame();
      scroll.jumpTo(60);
      f.frame();
      f.advance(500);
      assert.equal(scroll.offset, 60, 'Blink does not restore the caret over an explicit scroll');
      assert.equal(scroll.position, position);
      f.set(scene(controller, scroll, key, {}, focus));
      render.markNeedsLayout();
      f.frame();
      f.frame();
      assert.equal(
        scroll.offset,
        60,
        'An unrelated parent relayout preserves the focused editor manual offset',
      );
      const movement = scroll.animateTo(100, { duration: 100, curve: Curves.linear });
      for (let i = 0; i < 8; i++) {
        f.advance(20);
        await Promise.resolve();
      }
      await movement;
      assert.equal(scroll.offset, 100);
      assert.equal(render.scrollOffset.y, 100);
      f.set(new SizedBox());
      assert.equal(scroll.hasClients, false);
      scroll.addListener(() => {});
    } finally {
      await f.close();
      controller.dispose();
      scroll.dispose();
      focus.dispose();
    }
  },
);

test(
  'real wheel input scrolls the editor and its explicit physics can reject that input',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      scroll = new ScrollController(),
      key = new GlobalKey('editor wheel');
    input(f);
    try {
      f.set(scene(controller, scroll, key));
      wheel(f, 45);
      assert.equal(scroll.offset, 45);
      assert.equal(key.currentState.renderEditable.scrollOffset.y, 45);
      f.set(scene(controller, scroll, key, { scrollPhysics: new NeverScrollableScrollPhysics() }));
      const before = scroll.offset;
      wheel(f, 45);
      assert.equal(scroll.offset, before);
      scroll.jumpTo(80);
      f.frame();
      assert.equal(
        scroll.offset,
        80,
        'Physics suppresses user input while explicit controller commands remain available',
      );
      f.set(
        scene(controller, scroll, key, {
          enabled: false,
          scrollPhysics: new ClampingScrollPhysics(),
        }),
      );
      wheel(f, 45);
      assert.equal(
        scroll.offset,
        80,
        'Disabling the field also suppresses its inner wheel/scrollbar input',
      );
      scroll.jumpTo(100);
      f.frame();
      assert.equal(
        scroll.offset,
        100,
        'The caller still owns explicit disabled-field scroll commands',
      );
    } finally {
      await f.close();
      controller.dispose();
      scroll.dispose();
    }
  },
);

test(
  'a vertical touch drag scrolls the actual multiline paragraph without editing or moving its selection',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      scroll = new ScrollController(),
      key = new GlobalKey('editor touch');
    input(f);
    try {
      f.set(scene(controller, scroll, key, { enableInteractiveSelection: false }));
      const selection = controller.selection,
        bounds = f.root.nodes.find((node) => node.id === 'scroll-editor').bounds;
      for (const [kind, y, timestamp] of [
        ['down', 50, 0],
        ['move', 20, 40],
        ['move', 2, 80],
        ['up', 2, 120],
      ]) {
        f.root.pointer({
          kind,
          pointer: 1,
          device: 'touch',
          buttons: kind === 'up' ? 0 : 1,
          x: bounds.x + 70,
          y: bounds.y + y,
          timestamp,
          viewportGeneration: 1,
        });
        f.frame();
      }
      assert(scroll.offset > 0);
      assert.equal(key.currentState.renderEditable.scrollOffset.y, scroll.offset);
      assert.deepEqual(controller.selection, selection);
      assert.equal(controller.text, text);
    } finally {
      await f.close();
      controller.dispose();
      scroll.dispose();
    }
  },
);

test(
  'the iOS single-line default blocks user scrolling and retains implicit and explicit caret movement',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'iOS' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('Long line '.repeat(20)),
      scroll = new ScrollController(),
      key = new GlobalKey('ios scroll');
    input(f);
    try {
      f.set(scene(controller, scroll, key, { maxLines: 1 }));
      assert.equal(scroll.position.physics.allowUserScrolling, false);
      assert.equal(scroll.position.physics.allowImplicitScrolling, true);
      scroll.jumpTo(45);
      f.frame();
      assert.equal(key.currentState.renderEditable.scrollOffset.x, 45);
      f.set(
        scene(controller, scroll, key, { maxLines: 1, scrollPhysics: new ClampingScrollPhysics() }),
      );
      assert.equal(scroll.position.physics.allowUserScrolling, true);
    } finally {
      await f.close();
      controller.dispose();
      scroll.dispose();
    }
  },
);

test(
  'replacing the borrowed scroll controller transfers the live position and retires only the old registration',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      first = new ScrollController(),
      second = new ScrollController({ initialScrollOffset: 120 }),
      key = new GlobalKey('scroll handoff');
    input(f);
    try {
      f.set(scene(controller, first, key));
      first.jumpTo(64);
      f.frame();
      const position = first.position,
        state = key.currentState;
      f.set(scene(controller, second, key));
      assert.equal(key.currentState, state);
      assert.equal(first.hasClients, false);
      assert.equal(second.position, position);
      assert.equal(second.offset, 64);
      second.jumpTo(90);
      f.frame();
      assert.equal(state.renderEditable.scrollOffset.y, 90);
      f.set(new SizedBox());
      assert.equal(second.hasClients, false);
      first.addListener(() => {});
      second.addListener(() => {});
    } finally {
      await f.close();
      controller.dispose();
      first.dispose();
      second.dispose();
    }
  },
);

test(
  'an internal scroll listener can change selection and retire the suspended selection ticker',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      scroll = new ScrollController(),
      focus = new FocusNode(),
      key = new GlobalKey('reentrant editor offset');
    input(f);
    controller.selection = { anchor: 0, focus: 0 };
    const pointer = (kind, x, y) => {
      f.root.pointer({
        kind,
        pointer: 1,
        device: 'mouse',
        buttons: kind === 'cancel' ? 0 : 1,
        x,
        y,
        timestamp: f.root.context.clock.now(),
        viewportGeneration: 1,
      });
      f.root.buildOwner.focus.applyFocusChangesIfNeeded();
      f.frame();
    };
    try {
      f.set(scene(controller, scroll, key, {}, focus));
      focus.requestFocus();
      f.root.buildOwner.focus.applyFocusChangesIfNeeded();
      f.frame();
      const bounds = f.root.nodes.find((node) => node.id === 'scroll-editor').bounds;
      pointer('down', bounds.x + 1, bounds.y + 10);
      pointer('move', bounds.x + 70, bounds.y + bounds.height + 30);
      const replace = () => {
        scroll.removeListener(replace);
        controller.selection = { anchor: 3, focus: 3 };
      };
      scroll.addListener(replace);
      f.advance(34);
      f.frame();
      assert.deepEqual(controller.selection, { anchor: 3, focus: 3 });
      const offset = scroll.offset;
      f.advance(100);
      f.frame();
      assert.equal(scroll.offset, offset);
      pointer('cancel', bounds.x + 70, bounds.y + 90);
    } finally {
      await f.close();
      controller.dispose();
      scroll.dispose();
      focus.dispose();
    }
  },
);

test(
  'a reentrant internal scroll reveal cannot read geometry or focus a replacement editor',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      replacement = new TextEditingController('replacement'),
      scroll = new ScrollController(),
      focus = new FocusNode(),
      nextFocus = new FocusNode(),
      key = new GlobalKey('reentrant reveal offset');
    input(f);
    try {
      f.set(scene(controller, scroll, key, {}, focus));
      const state = key.currentState;
      const replace = () => {
        scroll.removeListener(replace);
        f.set(scene(replacement, scroll, key, {}, nextFocus));
      };
      scroll.addListener(replace);
      assert.doesNotThrow(() => state.bringIntoView(new TextPosition({ offset: text.length })));
      assert.equal(state.widget.controller, replacement);
      assert.equal(replacement.text, 'replacement');
      f.root.buildOwner.focus.applyFocusChangesIfNeeded();
      assert.equal(nextFocus.hasPrimaryFocus, false);
    } finally {
      await f.close();
      controller.dispose();
      replacement.dispose();
      scroll.dispose();
      focus.dispose();
      nextFocus.dispose();
    }
  },
);

test(
  'EditableText restoration serializes its scroll offset and restores it in a fresh Root with caller-owned content',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    let snapshot;
    for (const restore of [false, true]) {
      const f = await engineFixture({ fonts: true }),
        controller = new TextEditingController(restore ? text + '\nCaller content' : text),
        scroll = new ScrollController(),
        key = new GlobalKey('restored editor'),
        manager = new RestorationManager();
      input(f);
      manager.handleRestorationUpdateFromEngine({ enabled: true, data: restore ? snapshot : null });
      try {
        f.set(
          new RootRestorationScope({
            restorationId: 'app',
            manager,
            child: scene(controller, scroll, key, { restorationId: 'message' }),
          }),
        );
        await Promise.resolve();
        f.frame();
        if (!restore) {
          scroll.jumpTo(84);
          f.frame();
          await manager.flushData();
          snapshot = manager.takeSnapshot();
          assert(snapshot instanceof Uint8Array);
          assert(snapshot.byteLength > 0);
        } else {
          assert.equal(scroll.offset, 84);
          assert.equal(key.currentState.renderEditable.scrollOffset.y, 84);
          assert.equal(
            controller.text,
            text + '\nCaller content',
            'Editor scroll restoration does not claim ownership of caller text or OS composition',
          );
          assert.equal(controller.isComposing, false);
        }
      } finally {
        await f.close();
        controller.dispose();
        scroll.dispose();
        manager.dispose();
      }
    }
  },
);
