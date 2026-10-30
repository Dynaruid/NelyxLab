// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { NeverScrollableScrollPhysics } from '@nelyx/core/framework/widgets/scroll-physics';
import { Center, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { MediaQuery, Directionality } from '@nelyx/core/framework/widgets/app-data';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { TextPosition } from '@nelyx/core/ui/text-position';
import { Axis } from '@nelyx/core/framework/painting/basic-types';
import { EditingSession } from '@nelyx/core/ui/editing';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { engineFixture } from '../../../packages/material/tests/engine-fixture.mjs';
import { KeepAlive } from '@nelyx/core/framework/widgets/sliver';
import { ResourceAccounting } from '@nelyx/core/hosting/resources';
import { textLimits } from '@nelyx/core/ui/text';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';

const timeout = 1_200_000,
  text = Array.from({ length: 12 }, (_, i) => 'Line ' + i).join('\n');
function deferredHost(f, focusRequests = []) {
  const pending = [];
  let session, changed;
  f.root.context.editing = {
    capabilities: { indexUnit: 'utf16', composing: 'observed', selectionDirection: 'observed' },
    bind(owner, initial, notify, options) {
      session = new EditingSession(owner, initial);
      changed = notify;
      return {
        read: () => session.value,
        get isComposing() {
          return false;
        },
        replace: (value) => pending.push(value),
        focus(request) {
          focusRequests.push(request);
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
  return {
    native(text, selection) {
      session.update({
        ...session.value,
        text,
        selection,
        source: 'native',
        revision: session.value.revision + 1,
      });
      changed(session.value);
    },
    get pending() {
      return pending.length;
    },
    ack() {
      assert(pending.length);
      const next = pending.shift();
      session.update({ ...next, revision: session.value.revision + 1, source: 'programmatic' });
      changed(session.value);
    },
  };
}
function scene(controller, focus, scroll, key, physics, reverse = false, configuration = {}) {
  return new MediaQuery(
    {
      width: 240,
      height: 160,
      scale: 1,
      textScale: 1,
      safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
      keyboardInset: 0,
    },
    new Directionality(
      'ltr',
      new Center(
        new SizedBox(
          220,
          120,
          new ListView({
            controller: scroll,
            physics,
            reverse,
            children: [
              new EditableText('scroll-editor', controller, 'Scrolling editor', focus, 0, key, {
                maxLines: null,
                minHeight: 0,
                configuration,
                textStyle: new TextStyle({ fontSize: 20, height: 1.5 }),
              }),
              new SizedBox(220, 200),
            ],
          }),
        ),
      ),
    ),
  );
}
function focusField(f, focus) {
  focus.requestFocus();
  f.root.buildOwner.focus.applyFocusChangesIfNeeded();
  f.frame();
}
function press(f, key, extra = {}) {
  for (const kind of ['down', 'up'])
    f.root.key({
      kind,
      key,
      shift: false,
      control: false,
      alt: false,
      meta: false,
      repeat: false,
      ...extra,
    });
  f.frame();
}
function pointer(f, kind, x, y) {
  f.root.pointer({
    kind,
    pointer: 1,
    device: 'mouse',
    buttons: kind === 'up' || kind === 'cancel' ? 0 : 1,
    x,
    y,
    timestamp: f.root.context.clock.now(),
    viewportGeneration: 1,
  });
  f.root.buildOwner.focus.applyFocusChangesIfNeeded();
  f.frame();
}

test(
  'Core keyboard selection reveals the actual ancestor viewport before OS acknowledgement and an acknowledgement cannot undo a later manual scroll',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      focus = new FocusNode(),
      scroll = new ScrollController(),
      key = new GlobalKey('ancestor reveal'),
      host = deferredHost(f);
    controller.selection = { anchor: 0, focus: 0 };
    try {
      f.set(scene(controller, focus, scroll, key));
      focusField(f, focus);
      assert.equal(scroll.offset, 0);
      press(f, 'End', { control: true });
      f.frame();
      assert.equal(controller.selection.focus, text.length);
      assert.equal(host.pending, 1);
      const render = key.currentState.renderEditable,
        caret = render.getLocalRectForCaret(new TextPosition({ offset: text.length })),
        point = render.localToGlobal({ x: caret.x, y: caret.y });
      assert(
        scroll.offset > 0,
        'Core selection must reveal through the real enclosing ScrollPosition without waiting for the OS',
      );
      assert(
        point.y >= 20 && point.y + caret.height <= 140,
        'The selected caret is inside the actual ancestor viewport',
      );
      scroll.jumpTo(0);
      f.frame();
      host.ack();
      f.frame();
      assert.equal(
        scroll.offset,
        0,
        'A transport acknowledgement cannot scroll the UI back to an old caret request',
      );
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
      scroll.dispose();
    }
  },
);

test(
  'selection edge scrolling stops when the complete text is exposed instead of scrolling unrelated following content',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      focus = new FocusNode(),
      scroll = new ScrollController(),
      key = new GlobalKey('bounded ancestor drag');
    deferredHost(f);
    controller.selection = { anchor: 0, focus: 0 };
    try {
      f.set(scene(controller, focus, scroll, key));
      focusField(f, focus);
      pointer(f, 'down', 15, 30);
      pointer(f, 'move', 120, 155);
      for (let i = 0; i < 24; i++) {
        f.advance(34);
        await Promise.resolve();
        f.frame();
      }
      const render = key.currentState.renderEditable;
      assert.equal(controller.selection.focus, text.length);
      assert(
        scroll.offset <= render.size.height - 120 + 0.1,
        'An editor drag must not scroll through the unrelated footer',
      );
      const before = scroll.offset;
      f.advance(200);
      f.frame();
      assert.equal(
        scroll.offset,
        before,
        'No active drag scroll remains after its text target is fully visible',
      );
      pointer(f, 'up', 120, 155);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
      scroll.dispose();
    }
  },
);

test('selection dragging respects ancestor user-scroll physics', { timeout }, async () => {
  FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
  const f = await engineFixture({ fonts: true }),
    controller = new TextEditingController(text),
    focus = new FocusNode(),
    scroll = new ScrollController(),
    key = new GlobalKey('fixed ancestor drag');
  deferredHost(f);
  try {
    f.set(scene(controller, focus, scroll, key, new NeverScrollableScrollPhysics()));
    focusField(f, focus);
    pointer(f, 'down', 15, 30);
    pointer(f, 'move', 120, 155);
    for (let i = 0; i < 8; i++) {
      f.advance(34);
      f.frame();
    }
    assert.equal(scroll.offset, 0);
    pointer(f, 'cancel', 120, 155);
    assert.equal(f.root.scheduler.transientCallbackCount, 0);
  } finally {
    await f.close();
    controller.dispose();
    focus.dispose();
    scroll.dispose();
  }
});

test(
  'an ancestor scroll listener cannot redirect an in-progress keyboard selection into a replacement editor',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      replacement = new TextEditingController('replacement'),
      focus = new FocusNode(),
      scroll = new ScrollController(),
      key = new GlobalKey('reentrant reveal');
    deferredHost(f);
    controller.selection = { anchor: 0, focus: 0 };
    replacement.selection = { anchor: 2, focus: 2 };
    try {
      f.set(scene(controller, focus, scroll, key));
      focusField(f, focus);
      const replace = () => {
        scroll.removeListener(replace);
        f.set(scene(replacement, focus, scroll, key));
      };
      scroll.addListener(replace);
      press(f, 'End', { control: true });
      f.frame();
      assert.equal(key.currentState.widget.controller, replacement);
      assert.deepEqual(
        replacement.selection,
        { anchor: 2, focus: 2 },
        'The old selection intent is retired with its original logical editor',
      );
    } finally {
      await f.close();
      controller.dispose();
      replacement.dispose();
      focus.dispose();
      scroll.dispose();
    }
  },
);

test(
  'a reconnect caret reveal cannot focus an editor replaced by its ancestor scroll listener',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      replacement = new TextEditingController('replacement'),
      focus = new FocusNode(),
      nextFocus = new FocusNode(),
      scroll = new ScrollController(),
      key = new GlobalKey('reentrant reconnect');
    deferredHost(f);
    controller.selection = { anchor: 0, focus: 0 };
    const owner = f.root.buildOwner,
      postFrame = owner.postFrame,
      pending = [];
    try {
      f.set(scene(controller, focus, scroll, key));
      focusField(f, focus);
      controller.selection = { anchor: text.length, focus: text.length };
      f.frame();
      assert.equal(scroll.offset, 0);
      owner.postFrame = (callback) => pending.push(callback);
      f.set(scene(controller, focus, scroll, key, undefined, false, { readOnly: true }));
      assert(pending.length > 0);
      const replace = () => {
        scroll.removeListener(replace);
        f.set(scene(replacement, nextFocus, scroll, key));
      };
      scroll.addListener(replace);
      for (const callback of pending.splice(0)) callback();
      owner.focus.applyFocusChangesIfNeeded();
      f.frame();
      assert.equal(key.currentState.widget.controller, replacement);
      assert.equal(
        nextFocus.hasPrimaryFocus,
        false,
        'The old connection cannot issue native focus after its reveal replaced the logical editor',
      );
    } finally {
      owner.postFrame = postFrame;
      await f.close();
      controller.dispose();
      replacement.dispose();
      focus.dispose();
      nextFocus.dispose();
      scroll.dispose();
    }
  },
);

test(
  'a reentrant ancestor listener can edit the same controller without the old selection intent restoring its earlier document',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      focus = new FocusNode(),
      scroll = new ScrollController(),
      key = new GlobalKey('reentrant document');
    deferredHost(f);
    controller.selection = { anchor: 0, focus: 0 };
    try {
      f.set(scene(controller, focus, scroll, key));
      focusField(f, focus);
      const replace = () => {
        scroll.removeListener(replace);
        controller.text = 'listener replacement';
      };
      scroll.addListener(replace);
      press(f, 'End', { control: true });
      f.frame();
      assert.equal(
        controller.text,
        'listener replacement',
        'A newer Core edit wins over an earlier keyboard selection request',
      );
      assert.deepEqual(controller.selection, { anchor: 20, focus: 20 });
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
      scroll.dispose();
    }
  },
);

test(
  'an ancestor listener can replace the current selection and retire the held drag before its next text hit',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      focus = new FocusNode(),
      scroll = new ScrollController(),
      key = new GlobalKey('reentrant drag');
    deferredHost(f);
    controller.selection = { anchor: 0, focus: 0 };
    try {
      f.set(scene(controller, focus, scroll, key));
      focusField(f, focus);
      pointer(f, 'down', 15, 30);
      pointer(f, 'move', 120, 155);
      const replace = () => {
        scroll.removeListener(replace);
        controller.selection = { anchor: 3, focus: 3 };
      };
      scroll.addListener(replace);
      f.advance(34);
      f.frame();
      assert.deepEqual(
        controller.selection,
        { anchor: 3, focus: 3 },
        'A newer selection from the scroll observer wins over the suspended drag hit',
      );
      const before = scroll.offset;
      f.advance(100);
      f.frame();
      assert.equal(scroll.offset, before);
      pointer(f, 'cancel', 120, 155);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
      scroll.dispose();
    }
  },
);

test(
  'holding a selection beyond the ancestor viewport scrolls and extends it without another pointer move, then cancels at pointer retirement',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      focus = new FocusNode(),
      scroll = new ScrollController(),
      key = new GlobalKey('ancestor drag'),
      focusRequests = [];
    deferredHost(f, focusRequests);
    controller.selection = { anchor: 0, focus: 0 };
    try {
      f.set(scene(controller, focus, scroll, key));
      focusField(f, focus);
      pointer(f, 'down', 15, 30);
      pointer(f, 'move', 120, 155);
      const initial = controller.selection.focus,
        origin = focusRequests.at(-1),
        requestCount = focusRequests.length;
      for (let i = 0; i < 8; i++) {
        f.advance(34);
        await Promise.resolve();
        f.frame();
      }
      assert(focusRequests.length > requestCount);
      assert(origin?.inputTimestamp !== undefined);
      assert(
        focusRequests
          .slice(requestCount)
          .every((request) => request?.inputTimestamp === origin.inputTimestamp),
        'Ticker selection retains the real pointer origin instead of making a new keyboard-show intent',
      );
      assert(
        scroll.offset > 0,
        'The real outer ScrollPosition advances while the pointer is held beyond its viewport',
      );
      assert(
        controller.selection.focus > initial,
        'Newly exposed text extends the same Core selection',
      );
      assert.equal(controller.selection.anchor, 0);
      pointer(f, 'cancel', 120, 155);
      const stopped = scroll.offset;
      for (let i = 0; i < 4; i++) {
        f.advance(34);
        await Promise.resolve();
        f.frame();
      }
      assert.equal(
        scroll.offset,
        stopped,
        'The drag does not leave an ancestor scrolling after cancellation',
      );
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
      scroll.dispose();
    }
  },
);

test(
  'reversed ancestor scrolling follows the physical drag direction while preserving logical text selection',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      focus = new FocusNode(),
      scroll = new ScrollController(),
      key = new GlobalKey('reverse ancestor');
    deferredHost(f);
    controller.selection = { anchor: 0, focus: 0 };
    try {
      f.set(scene(controller, focus, scroll, key, undefined, true));
      focusField(f, focus);
      f.frame();
      const render = key.currentState.renderEditable,
        caret = render.getLocalRectForCaret(new TextPosition({ offset: 0 })),
        start = render.localToGlobal({ x: caret.x + 0.1, y: caret.y + caret.height / 2 }),
        before = scroll.offset;
      pointer(f, 'down', start.x, start.y);
      pointer(f, 'move', 120, 155);
      const initial = controller.selection.focus;
      for (let i = 0; i < 8; i++) {
        f.advance(34);
        f.frame();
      }
      assert(
        scroll.offset < before,
        'A reversed ScrollPosition moves toward its lower offset when the pointer advances down the document',
      );
      assert(controller.selection.focus > initial);
      assert.equal(controller.selection.anchor, 0);
      pointer(f, 'up', 120, 155);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
      scroll.dispose();
    }
  },
);

test(
  'a held selection can reveal through nested viewports with different scroll axes',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      focus = new FocusNode(),
      vertical = new ScrollController(),
      horizontal = new ScrollController(),
      key = new GlobalKey('nested ancestor');
    deferredHost(f);
    controller.selection = { anchor: 0, focus: 0 };
    try {
      const editor = new EditableText('nested-editor', controller, 'Nested editor', focus, 0, key, {
        maxLines: null,
        minHeight: 0,
        textStyle: new TextStyle({ fontSize: 20, height: 1.5 }),
      });
      f.set(
        new Directionality(
          'ltr',
          new Center(
            new SizedBox(
              220,
              120,
              new ListView({
                controller: vertical,
                children: [
                  new SizedBox(
                    220,
                    360,
                    new ListView({
                      controller: horizontal,
                      scrollDirection: Axis.horizontal,
                      children: [new SizedBox(500, 360, editor)],
                    }),
                  ),
                  new SizedBox(220, 200),
                ],
              }),
            ),
          ),
        ),
      );
      focusField(f, focus);
      pointer(f, 'down', 15, 30);
      pointer(f, 'move', 239, 155);
      const initial = controller.selection.focus;
      for (let i = 0; i < 8; i++) {
        f.advance(34);
        f.frame();
      }
      assert(
        vertical.offset > 0 && horizontal.offset > 0,
        'Both real ScrollPositions advance in their own axis',
      );
      assert(controller.selection.focus > initial);
      assert.equal(controller.selection.anchor, 0);
      pointer(f, 'cancel', 239, 155);
      const stopped = [vertical.offset, horizontal.offset];
      f.advance(200);
      f.frame();
      assert.deepEqual([vertical.offset, horizontal.offset], stopped);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
      vertical.dispose();
      horizontal.dispose();
    }
  },
);

test(
  'bounded eviction preserves an explicitly retained composing editor and its single host binding',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('prefix'),
      focus = new FocusNode(),
      scroll = new ScrollController(),
      key = new GlobalKey('bounded composing editor');
    let session,
      notify,
      binds = 0,
      disposed = 0,
      lease,
      budget;
    f.root.context.editing = {
      capabilities: { indexUnit: 'utf16', composing: 'observed', selectionDirection: 'observed' },
      bind(owner, initial, changed, options) {
        binds++;
        session = new EditingSession(owner, initial);
        notify = changed;
        const replace = (content) => {
          session.update({
            ...content,
            source: 'programmatic',
            revision: session.value.revision + 1,
          });
          changed(session.value);
        };
        return {
          read: () => session.value,
          get isComposing() {
            return session.value.composing.status === 'active';
          },
          replace,
          replaceComposing: replace,
          focus() {
            options.focusChanged?.(true);
          },
          blur() {
            options.focusChanged?.(false);
          },
          dispose() {
            disposed++;
            session.dispose();
          },
        };
      },
    };
    try {
      f.set(
        new Directionality(
          'ltr',
          ListView.builder({
            controller: scroll,
            primary: false,
            itemCount: 100,
            itemExtent: 80,
            padding: EdgeInsets.zero,
            childPolicy: { mode: 'bounded' },
            addAutomaticKeepAlives: false,
            addRepaintBoundaries: false,
            addSemanticIndexes: false,
            itemBuilder: (_context, i) =>
              i === 0
                ? new KeepAlive({
                    keepAlive: true,
                    child: new EditableText(
                      'bounded-editor',
                      controller,
                      'Bounded editor',
                      focus,
                      80,
                      key,
                      { maxLines: 1, textStyle: new TextStyle({ fontSize: 20 }) },
                    ),
                  })
                : new SizedBox(240, 80),
          }),
        ),
      );
      focusField(f, focus);
      const original = key.currentState;
      assert(original && session);
      session.update({
        ...session.value,
        text: '한A',
        selection: { anchor: 1, focus: 1 },
        composing: { status: 'active', start: 0, end: 1 },
        source: 'native',
        revision: session.value.revision + 1,
      });
      notify(session.value);
      f.frame();
      f.frame();
      budget = f.root.buildOwner.maybeViewWorkBudget;
      for (const offset of [800, 1600]) {
        scroll.jumpTo(offset);
        f.frame();
        assert.equal(key.currentState, original);
        assert(focus.hasPrimaryFocus);
        assert.equal(binds, 1);
        assert.equal(disposed, 0);
      }
      const registry = f.root.context.resources,
        accounting = new ResourceAccounting(registry),
        resource = { id: 'composing-pressure', generation: 1 };
      registry.register({ ...resource, kind: 'paragraph' }, () => {}, {
        owner: accounting,
        identity: {},
        cost: { units: textLimits.retainedUnits, bytes: 1 },
      });
      lease = registry.acquire([resource]);
      registry.releaseProducer(resource);
      f.frame();
      assert.equal(budget.debugStats.optionalChildren, 0);
      assert.equal(key.currentState, original);
      assert.equal(disposed, 0);
      assert.equal(binds, 1);
      assert.equal(controller.text, '한A');
      assert.deepEqual(controller.selection, { anchor: 1, focus: 1 });
      assert.deepEqual(controller.value.composing, { status: 'active', start: 0, end: 1 });
      assert(registry.accountedTotals.residentUnits >= textLimits.retainedUnits);
    } finally {
      if (lease && !lease.released) lease.returnBy('caller');
      await f.close();
      controller.dispose();
      focus.dispose();
      scroll.dispose();
    }
    assert.equal(disposed, 1);
    assert.equal(budget.debugStats.trackedElements, 0);
  },
);

test(
  'native text edits and a public bringIntoView wait for the current Core paragraph before revealing ancestors',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(text),
      focus = new FocusNode(),
      scroll = new ScrollController(),
      key = new GlobalKey('deferred caret'),
      host = deferredHost(f);
    controller.selection = { anchor: 0, focus: 0 };
    const visible = () => {
      const render = key.currentState.renderEditable,
        caret = render.getLocalRectForCaret(new TextPosition({ offset: controller.text.length })),
        point = render.localToGlobal({ x: caret.x, y: caret.y });
      assert.equal(render.plainText, controller.text);
      assert(point.y >= 20 && point.y + caret.height <= 140);
    };
    try {
      f.set(scene(controller, focus, scroll, key));
      focusField(f, focus);
      const next = text + '\nNew native line';
      host.native(next, { anchor: next.length, focus: next.length });
      f.frame();
      f.frame();
      assert(scroll.offset > 0);
      visible();
      scroll.jumpTo(0);
      controller.text = next + '\nAnother programmatic line';
      key.currentState.bringIntoView(new TextPosition({ offset: controller.text.length }));
      f.frame();
      f.frame();
      visible();
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
      scroll.dispose();
    }
  },
);
