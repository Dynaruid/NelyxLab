// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { RenderEditable } from '@nelyx/core/framework/rendering/editable';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import { StrutStyle } from '@nelyx/core/framework/painting/strut-style';
import { PaintingBinding } from '@nelyx/core/framework/painting/binding';
import { BinaryMessenger } from '@nelyx/core/services/binary-messenger';
import { JSONMethodCodec } from '@nelyx/core/services/message-codecs';
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Text, Center, SizedBox, Row } from '@nelyx/core/framework/widgets/basic';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { EditingSession } from '@nelyx/core/ui/editing';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import {
  engineFixture,
  assertParagraphOwnership,
} from '../../../packages/material/tests/engine-fixture.mjs';
const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
const style = new TextStyle({ fontSize: 16, height: 1.5, color: 0xff000000 });
function find(root, predicate) {
  let result;
  const visit = (e) => {
    if (predicate(e)) result = e;
    e.visitChildren(visit);
  };
  visit(root);
  assert(result);
  return result;
}
function media(child, scale = 1) {
  return new MediaQuery(
    {
      width: 240,
      height: 160,
      scale: 1,
      textScale: scale,
      safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
      keyboardInset: 0,
    },
    new Center(child),
  );
}
function editing(f) {
  const bindings = [];
  f.root.context.editing = {
    capabilities: { indexUnit: 'utf16', composing: 'observed', selectionDirection: 'observed' },
    bind(owner, initial, changed, options) {
      const session = new EditingSession(owner, initial);
      let closed = false;
      const replace = (value) => {
        assert(session.update({ ...value, revision: session.value.revision + 1 }));
        changed(session.value);
      };
      const host = {
        options,
        get closed() {
          return closed;
        },
        native(text, composing = { status: 'none' }) {
          replace({
            ...session.value,
            text,
            selection: { anchor: text.length, focus: text.length },
            composing,
            source: 'native',
          });
        },
      };
      bindings.push(host);
      return {
        get isComposing() {
          return session.value.composing.status === 'active';
        },
        read: () => session.value,
        replace,
        focus() {
          options.focusChanged?.(true);
        },
        blur() {
          options.focusChanged?.(false);
        },
        dispose() {
          assert(!closed);
          closed = true;
          session.dispose();
        },
      };
    },
  };
  return bindings;
}
const editor = (controller, lines = { maxLines: null }, extra = {}) =>
  new EditableText('editor', controller, 'Message', undefined, 0, null, {
    textStyle: style,
    minHeight: 0,
    ...lines,
    ...extra,
  });
const render = (f) => find(f.root.root, (e) => e.widget instanceof EditableText).renderObjects[0];

test(
  'actual editor measures its height from the painted paragraph during first layout and document replacement',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('first 한글 line'),
      layout = f.library.layout,
      calls = [];
    editing(f);
    f.library.layout = function (input, request) {
      if (input.text === controller.text)
        calls.push({ text: input.text, transient: request?.transient });
      return layout.call(this, input, request);
    };
    try {
      for (const maxLines of [1, null]) {
        calls.length = 0;
        controller.text =
          maxLines === 1 ? 'single 한글 line' : 'wrapped 한글 line one two three four five';
        f.set(media(new SizedBox(100, undefined, editor(controller, { maxLines }))));
        const box = render(f);
        assert.equal(
          calls.length,
          1,
          'Wet layout must not shape the same document in a transient slot first',
        );
        assert(!calls[0].transient);
        assert(box.size.height > 0);
        assert.equal(f.library.debugTextStats.producers, 1);
        box.getDistanceToActualBaseline('alphabetic');
        assert.equal(calls.length, 1);
      }
    } finally {
      f.library.layout = layout;
      await f.close();
      controller.dispose();
    }
  },
);
async function fontApplication() {
  const codec = new JSONMethodCodec(),
    handlers = new Map(),
    environment = new Map([
      ['revision', 1],
      ['locales', ['en']],
      ['localeSource', 'runtime'],
      ['brightness', 'light'],
      ['lifecycle', 'resumed'],
      ['textScale', 1],
      [
        'capabilities',
        new Map([
          ['clipboardRead', 'unavailable'],
          ['clipboardWrite', 'unavailable'],
          ['navigation', 'unavailable'],
        ]),
      ],
    ]);
  class Messenger extends BinaryMessenger {
    send(channel) {
      return Promise.resolve(
        channel === 'nelyx/environment' ? codec.encodeSuccessEnvelope(environment) : null,
      );
    }
    setMessageHandler(channel, handler) {
      if (handler) handlers.set(channel, handler);
      else handlers.delete(channel);
    }
    async handlePlatformMessage(channel, data, reply) {
      reply?.((await handlers.get(channel)?.(data)) ?? null);
    }
  }
  const messenger = new Messenger(),
    binding = new PaintingBinding(messenger);
  await binding.ready;
  return { messenger, binding, handlers };
}
function registerLateFont(f) {
  const bytes = fs.readFileSync(
      new URL('../../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf', import.meta.url),
    ),
    font = f.library.decode(
      {
        id: 'w18-late-font',
        kind: 'font',
        fontFamily: 'W18LateFont',
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
      bytes,
    );
  f.root.context.resources.register(font.descriptor, font.retire);
}
function editableParagraph(f) {
  let result;
  const visit = (node) => {
    if (node instanceof RenderEditable) result = node;
    node.visitChildren(visit);
  };
  visit(f.root.pipeline.root);
  assert(result);
  return result;
}

test(
  'the actual editor keeps one InlineSpan painter through directional alignment, nonlinear scaling and document replacement',
  { timeout },
  async () => {
    class NonlinearScaler extends TextScaler {
      scale(size) {
        return size + (size * size) / 100;
      }
      get textScaleFactor() {
        return 1.16;
      }
    }
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('אבג 한글 👩‍👩‍👧‍👦'),
      scaler = new NonlinearScaler();
    editing(f);
    let owner;
    const editable = () => {
      let result;
      const visit = (node) => {
        if (node instanceof RenderEditable) result = node;
        node.visitChildren(visit);
      };
      visit(f.root.pipeline.root);
      assert(result);
      return result;
    };
    try {
      for (const direction of ['ltr', 'rtl'])
        for (const textAlign of ['start', 'center', 'end']) {
          f.set(
            media(
              new SizedBox(
                110,
                64,
                editor(
                  controller,
                  { maxLines: 1 },
                  { textDirection: direction, textAlign, textScaler: scaler },
                ),
              ),
            ),
          );
          const box = editable(),
            painter = box.textPainter;
          assert(painter.text instanceof TextSpan);
          assert.equal(painter.plainText, controller.text);
          owner ??= painter;
          assert.equal(painter, owner);
          const reference = new TextPainter(
            {
              text: new TextSpan({ text: controller.text, style }),
              textDirection: direction,
              textAlign,
              textScaler: scaler,
              maxLines: 1,
            },
            {
              text: f.root.context.text,
              resources: f.root.context.resources,
              font: f.root.context.defaultFont,
              scale: 1,
              transient: true,
            },
          );
          try {
            reference.layout({ minWidth: 110, maxWidth: Infinity });
            assert.equal(painter.width, reference.width);
            assert.equal(painter.height, reference.height);
            assert.equal(painter._paintOffset, reference._paintOffset);
            assert.deepEqual(
              painter.getPositionForOffset({ x: 50, y: 10 }),
              reference.getPositionForOffset({ x: 50, y: 10 }),
            );
          } finally {
            reference.dispose();
          }
        }
      const old = owner._layoutSnapshot().resource;
      controller.text = '새 문서 العربية e\u0301';
      f.frame();
      assert.equal(editable().textPainter, owner);
      assert.equal(owner.plainText, controller.text);
      assert(!f.root.context.resources.hasInitialProducer(old));
      f.set(new SizedBox());
      assertParagraphOwnership(f);
      assert.equal(f.library.debugTextStats.producers, 0);
    } finally {
      await f.close();
      controller.dispose();
    }
  },
);

test(
  'changing only strut policy refreshes the live editor style and line policy without rebinding its input',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('한글 A'),
      bindings = editing(f);
    const editable = () => {
      let result;
      const visit = (node) => {
        if (node instanceof RenderEditable) result = node;
        node.visitChildren(visit);
      };
      visit(f.root.pipeline.root);
      assert(result);
      return result;
    };
    try {
      f.set(media(new SizedBox(200, undefined, editor(controller, { minLines: 2, maxLines: 3 }))));
      const initial = editable(),
        before = initial.semantics.editorStyle.lineHeight;
      assert.equal(before, initial.textPainter.preferredLineHeight);
      const strut = new StrutStyle({ fontSize: 40, height: 1, forceStrutHeight: true });
      f.set(
        media(
          new SizedBox(
            200,
            undefined,
            editor(controller, { minLines: 2, maxLines: 3 }, { strutStyle: strut }),
          ),
        ),
      );
      const current = editable();
      assert.equal(current, initial);
      assert.equal(bindings.length, 1);
      assert(current.textPainter.preferredLineHeight > before);
      assert.equal(
        current.semantics.editorStyle.lineHeight,
        current.textPainter.preferredLineHeight,
      );
      assert.equal(current.size.height, current.textPainter.preferredLineHeight * 2);
      f.set(new SizedBox());
      assert(bindings[0].closed);
      assertParagraphOwnership(f);
      assert.equal(f.library.debugTextStats.producers, 0);
    } finally {
      await f.close();
      controller.dispose();
    }
  },
);

test(
  'the app font notification refreshes both actual editor shaping and its cached source metrics',
  { timeout },
  async () => {
    const { messenger, binding, handlers } = await fontApplication(),
      f = await engineFixture({
        fonts: true,
        platformServices: binding,
        binaryMessenger: messenger,
      }),
      controller = new TextEditingController('ABC'),
      dynamicStyle = new TextStyle({ fontSize: 20, fontFamily: 'W18LateFont' }),
      bindings = editing(f);
    let reference;
    const editable = () => {
      let result;
      const visit = (node) => {
        if (node instanceof RenderEditable) result = node;
        node.visitChildren(visit);
      };
      visit(f.root.pipeline.root);
      assert(result);
      return result;
    };
    try {
      f.set(
        media(
          new SizedBox(
            200,
            undefined,
            editor(controller, { maxLines: 1 }, { textStyle: dynamicStyle }),
          ),
        ),
      );
      const box = editable(),
        before = box.semantics.editorStyle.lineHeight,
        old = box.textPainter._layoutSnapshot().resource;
      registerLateFont(f);
      reference = new TextPainter(
        { text: new TextSpan({ text: ' ', style: dynamicStyle }), textDirection: 'ltr' },
        {
          text: f.library,
          resources: f.root.context.resources,
          font: f.root.context.defaultFont,
          scale: 1,
          transient: true,
        },
      );
      reference.layout();
      const expected = reference.height;
      assert.notEqual(
        expected,
        before,
        'The newly registered real font must change the measured baseline sample',
      );
      await binding.handleSystemMessage(new Map([['type', 'fontsChange']]));
      f.advance(16);
      assert.equal(editable(), box);
      assert.equal(bindings.length, 1);
      assert.equal(box.semantics.editorStyle.lineHeight, expected);
      assert.equal(box.textPainter.height, expected);
      assert(!f.root.context.resources.hasInitialProducer(old));
      reference.dispose();
      reference = undefined;
      f.set(new SizedBox());
      assertParagraphOwnership(f);
    } finally {
      reference?.dispose();
      await f.close();
      controller.dispose();
      binding.dispose();
      assert.equal(handlers.size, 0);
    }
  },
);

test(
  'shared app font notifications stay on each View and pending editor callbacks retire with that View',
  { timeout },
  async () => {
    const { messenger, binding, handlers } = await fontApplication(),
      fonts = binding.systemFonts,
      listeners = new Set(),
      add = fonts.addListener,
      remove = fonts.removeListener;
    fonts.addListener = function (listener) {
      listeners.add(listener);
      return add.call(this, listener);
    };
    fonts.removeListener = function (listener) {
      listeners.delete(listener);
      return remove.call(this, listener);
    };
    const a = await engineFixture({
        fonts: true,
        platformServices: binding,
        binaryMessenger: messenger,
        viewId: 'w18-font-a',
      }),
      b = await engineFixture({
        fonts: true,
        platformServices: binding,
        binaryMessenger: messenger,
        viewId: 'w18-font-b',
      }),
      ca = new TextEditingController('A'),
      cb = new TextEditingController('B'),
      dynamicStyle = new TextStyle({ fontSize: 20, fontFamily: 'W18LateFont' }),
      ba = editing(a),
      bb = editing(b);
    let openA = true;
    const notify = () => binding.handleSystemMessage(new Map([['type', 'fontsChange']])),
      value = (c) =>
        media(
          new SizedBox(200, undefined, editor(c, { maxLines: 1 }, { textStyle: dynamicStyle })),
        );
    try {
      a.set(value(ca));
      b.set(value(cb));
      assert.equal(listeners.size, 4);
      const ra = editableParagraph(a),
        rb = editableParagraph(b),
        before = rb.semantics.editorStyle.lineHeight;
      registerLateFont(a);
      await notify();
      a.advance(16);
      assert.equal(editableParagraph(a), ra);
      const expected = ra.semantics.editorStyle.lineHeight;
      assert.notEqual(expected, before);
      assert.equal(
        rb.semantics.editorStyle.lineHeight,
        before,
        'Another View does not run its pending build on this View frame',
      );
      b.advance(16);
      assert.equal(
        rb.semantics.editorStyle.lineHeight,
        before,
        'Font registries remain owned by their respective engine',
      );
      registerLateFont(b);
      await notify();
      await notify();
      openA = false;
      await a.close();
      assert.equal(listeners.size, 2);
      assert.equal(binding.isClosed, false);
      await notify();
      b.advance(16);
      assert.equal(editableParagraph(b), rb);
      assert.equal(rb.semantics.editorStyle.lineHeight, expected);
      assert.equal(rb.textPainter.height, expected);
      assert.equal(ba.length, 1);
      assert.equal(bb.length, 1);
      assert(ba[0].closed);
      b.set(new SizedBox());
      assert.equal(listeners.size, 0);
      await notify();
      b.advance(16);
      assertParagraphOwnership(b);
    } finally {
      if (openA) await a.close();
      await b.close();
      ca.dispose();
      cb.dispose();
      fonts.addListener = add;
      fonts.removeListener = remove;
      binding.dispose();
      assert.equal(handlers.size, 0);
      assert.equal(listeners.size, 0);
    }
  },
);

test(
  'actual editor grows and clamps measured hard lines, retains binding through line policy/scale changes and retires measurements',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(),
      bindings = editing(f);
    const set = (policy, scale = 1) =>
      f.set(media(new SizedBox(200, undefined, editor(controller, policy)), scale));
    try {
      set({ maxLines: 3 });
      assert.equal(render(f).size.height, 72);
      assert.equal(bindings[0].options.configuration.multiline, true);
      set({ minLines: 1, maxLines: 3 });
      assert.equal(render(f).size.height, 24);
      controller.text = 'A\nB';
      f.frame();
      assert.equal(render(f).size.height, 48);
      controller.text = 'A\nB\nC\nD';
      f.frame();
      assert.equal(render(f).size.height, 72);
      set({ minLines: 2, maxLines: null });
      assert.equal(render(f).size.height, 96);
      assert.equal(bindings.length, 1);
      controller.text = 'A';
      f.frame();
      assert.equal(render(f).size.height, 48);
      set({ minLines: 2, maxLines: null }, 1.5);
      assert.equal(render(f).size.height, 72);
      assert.equal(bindings.length, 1);
      const box = render(f),
        constraints = new BoxConstraints(200, 200, 0, 160);
      assert.deepEqual(box.getDryLayout(constraints), box.size);
      assert.equal(
        box.getDryBaseline(constraints, 'alphabetic'),
        box.getDistanceToActualBaseline('alphabetic'),
      );
      f.set(new SizedBox());
      assert(bindings.every((binding) => binding.closed));
      assertParagraphOwnership(f);
    } finally {
      await f.close();
      controller.dispose();
    }
  },
);

test(
  'soft wrapping and both baselines match an independently rendered paragraph while width changes during composition',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('one two three'),
      bindings = editing(f);
    const set = (width) =>
      f.set(
        media(
          new Row(
            [
              new SizedBox(width, undefined, editor(controller)),
              new SizedBox(width, undefined, new Text(controller.text, { style })),
            ],
            { mainSize: 'min', crossAlign: 'start' },
          ),
        ),
      );
    try {
      set(50);
      const measured = render(f),
        paragraph = find(f.root.root, (e) => e.widget instanceof Text).renderObjects[0];
      assert(measured.size.height > 24);
      assert.equal(measured.size.height, paragraph.size.height);
      assert.equal(
        measured.getDistanceToActualBaseline('alphabetic'),
        paragraph.getDistanceToActualBaseline('alphabetic'),
      );
      // RenderParagraph deliberately reports its alphabetic baseline for either
      // request. The public painter retains the separate ideographic baseline.
      const reference = new TextPainter(
        { text: new TextSpan({ text: controller.text, style }), textDirection: 'ltr' },
        {
          text: f.root.context.text,
          resources: f.root.context.resources,
          font: f.root.context.defaultFont,
          scale: 1,
          transient: true,
        },
      );
      try {
        reference.layout({ minWidth: 50, maxWidth: 50 });
        assert.equal(
          measured.getDistanceToActualBaseline('ideographic'),
          reference.computeDistanceToActualBaseline('ideographic'),
        );
      } finally {
        reference.dispose();
      }
      const state = find(f.root.root, (e) => e.widget instanceof EditableText).stateObject;
      bindings[0].native('one two three', { status: 'active', start: 0, end: 13 });
      set(110);
      assert.equal(find(f.root.root, (e) => e.widget instanceof EditableText).stateObject, state);
      assert.equal(bindings.length, 1);
      assert(controller.isComposing);
      assert.deepEqual(controller.selection, { anchor: 13, focus: 13 });
      assert.equal(render(f).size.height, 24);
      bindings[0].native('one two three');
      f.frame();
      assert.equal(controller.isComposing, false);
    } finally {
      await f.close();
      controller.dispose();
    }
  },
);

test(
  'expanded editors fill bounded space; intrinsic heights count source hard separators and invalid line policies fail before binding',
  { timeout },
  async () => {
    const controller = new TextEditingController();
    for (const policy of [
      { maxLines: 0 },
      { minLines: -1 },
      { minLines: 3, maxLines: 2 },
      { maxLines: 129 },
      { maxLines: 1, expands: true },
      { maxLines: null, minLines: 1, expands: true },
    ])
      assert.throws(() => editor(controller, policy));
    assert.throws(
      () => editor(controller, { maxLines: 1 }, { configuration: { multiline: true } }),
      /agree/,
    );
    assert.throws(() =>
      editor(controller, { maxLines: null }, { configuration: { obscureText: true } }),
    );
    const f = await engineFixture({ fonts: true });
    editing(f);
    try {
      f.set(
        media(
          new SizedBox(
            200,
            120,
            editor(controller, { minLines: null, maxLines: null, expands: true }),
          ),
        ),
      );
      const box = render(f);
      assert.equal(box.size.height, 120);
      assert.equal(box.getMaxIntrinsicHeight(Infinity), 24);
      controller.text = 'A\r\nB\u0085C\u000bD\u000cE\u2028F\u2029G';
      f.frame();
      assert.equal(box.getMaxIntrinsicHeight(Infinity), 168);
      assert.equal(
        f.library.debugTextStats.producers,
        1,
        'Only the painted Core paragraph keeps a producer; intrinsic probes retire theirs',
      );
      assertParagraphOwnership(f, 1);
    } finally {
      await f.close();
      controller.dispose();
    }
  },
);

test(
  'changing multiline mode defers native reconfiguration and layout until composition commits without losing text or selection',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(),
      bindings = editing(f);
    try {
      f.set(media(new SizedBox(200, undefined, editor(controller, { maxLines: null }))));
      const state = find(f.root.root, (e) => e.widget instanceof EditableText).stateObject;
      bindings[0].native('A\nB', { status: 'active', start: 0, end: 3 });
      f.frame();
      assert.equal(render(f).size.height, 48);
      f.set(media(new SizedBox(200, undefined, editor(controller, { maxLines: 1 }))));
      assert.equal(bindings.length, 1);
      assert.equal(render(f).size.height, 48);
      assert.equal(bindings[0].options.configuration.multiline, true);
      assert(controller.isComposing);
      bindings[0].native('A\nB');
      f.frame();
      f.frame();
      assert.equal(bindings.length, 2);
      assert(bindings[0].closed);
      assert.equal(bindings[1].options.configuration.multiline, false);
      assert.equal(render(f).size.height, 24);
      assert.equal(controller.text, 'A\nB');
      assert.deepEqual(controller.selection, { anchor: 3, focus: 3 });
      assert.equal(find(f.root.root, (e) => e.widget instanceof EditableText).stateObject, state);
    } finally {
      await f.close();
      controller.dispose();
    }
  },
);

test(
  'completion callbacks override default focus actions, report through the owner, and stop after synchronous retirement',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      first = new TextEditingController('First'),
      second = new TextEditingController('Second'),
      focusA = new FocusNode(),
      focusB = new FocusNode(),
      bindings = editing(f),
      events = [];
    const view = (options = {}) =>
      media(
        new Row(
          [
            new SizedBox(
              100,
              undefined,
              new EditableText('first', first, 'First', focusA, 0, null, {
                textStyle: style,
                minHeight: 0,
                action: 'next',
                onSubmitted: (value) => events.push('first:' + value),
                ...options,
              }),
            ),
            new SizedBox(
              100,
              undefined,
              new EditableText('second', second, 'Second', focusB, 0, null, {
                textStyle: style,
                minHeight: 0,
                action: 'done',
                onSubmitted: (value) => events.push('second:' + value),
              }),
            ),
          ],
          { mainSize: 'min' },
        ),
      );
    const submit = (index) => bindings[index].options.onAction();
    const previousReport = f.root.context.reportError,
      previousFlutterError = FlutterError.onError,
      reports = [];
    try {
      f.set(view());
      focusA.requestFocus();
      await Promise.resolve();
      f.frame();
      submit(0);
      await Promise.resolve();
      f.frame();
      assert(focusB.hasFocus);
      assert.deepEqual(events, ['first:First']);
      submit(1);
      await Promise.resolve();
      f.frame();
      assert.equal(focusB.hasFocus, false);
      assert.equal(events.at(-1), 'second:Second');
      f.set(view({ onEditingComplete: () => events.push('complete') }));
      focusA.requestFocus();
      await Promise.resolve();
      f.frame();
      submit(0);
      await Promise.resolve();
      f.frame();
      assert(focusA.hasFocus);
      assert.deepEqual(events.slice(-2), ['complete', 'first:First']);
      assert.equal(bindings.length, 2);
      f.root.context.reportError = (details) => reports.push(details);
      FlutterError.onError = () => {};
      f.set(
        view({
          onEditingComplete: () => {
            throw new Error('Completion failure');
          },
        }),
      );
      submit(0);
      assert.equal(reports.length, 1);
      assert.match(String(reports[0].exception), /Completion failure/);
      assert.equal(events.at(-1), 'first:First');
      const before = events.length;
      f.set(view({ onEditingComplete: () => f.set(new SizedBox()) }));
      submit(0);
      assert.equal(events.length, before);
      assert(bindings.every((binding) => binding.closed));
    } finally {
      f.root.context.reportError = previousReport;
      FlutterError.onError = previousFlutterError;
      await f.close();
      first.dispose();
      second.dispose();
      focusA.dispose();
      focusB.dispose();
    }
  },
);
