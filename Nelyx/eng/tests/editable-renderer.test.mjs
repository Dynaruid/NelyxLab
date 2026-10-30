// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { RenderEditable } from '@nelyx/core/framework/rendering/editable';
import { RenderTransform } from '@nelyx/core/framework/rendering/boxes';
import { RenderOffstage } from '@nelyx/core/framework/rendering/offstage';
import { Offstage } from '@nelyx/core/framework/widgets/offstage';
import { ClipRect as CustomClipRect } from '@nelyx/core/framework/widgets/clip';
import { CustomClipper } from '@nelyx/core/framework/rendering/clip';
import { ChangeNotifier } from '@nelyx/core/foundation/notifier';
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { TextPosition } from '@nelyx/core/ui/text-position';
import { TextSelection } from '@nelyx/core/services/text-editing';
import { EditingSession } from '@nelyx/core/ui/editing';
import {
  Center,
  SizedBox,
  Transform,
  ClipRect,
  Stack,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { graphemeBoundaries } from '@nelyx/core/foundation/grapheme-boundaries';
import { LengthLimitingTextInputFormatter } from '@nelyx/core/services/input-formatters';
import {
  captureMatrix4,
  transformMatrix4Point,
  tryUnprojectMatrix4Point,
  unprojectMatrix4Point,
} from '@nelyx/core/ui/matrix4';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import {
  engineFixture,
  assertParagraphOwnership,
} from '../../../packages/material/tests/engine-fixture.mjs';

const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
const color = 0xff1468c8,
  selectionColor = 0xffff0055,
  cursorColor = 0xff00cc44;
const style = new TextStyle({ fontSize: 20, height: 1.5, color });
function findRender(element) {
  if (element.renderObject instanceof RenderEditable) return element.renderObject;
  let result;
  element.visitChildren((child) => {
    result ??= findRender(child);
  });
  return result;
}
function input(f, { deferred = false } = {}) {
  let session,
    notify,
    editingOptions,
    focusCalls = 0;
  const geometries = [],
    pending = [];
  f.root.context.editing = {
    capabilities: { indexUnit: 'utf16', composing: 'observed', selectionDirection: 'observed' },
    bind(owner, initial, changed, options) {
      editingOptions = options;
      session = new EditingSession(owner, initial);
      notify = changed;
      const apply = (value) => {
        session.update({ ...value, source: 'programmatic', revision: session.value.revision + 1 });
        changed(session.value);
      };
      const replace = (value) => {
        if (deferred) pending.push(() => apply(value));
        else apply(value);
      };
      return {
        get isComposing() {
          return session.value.composing.status === 'active';
        },
        read: () => session.value,
        replace,
        replaceComposing: replace,
        focus() {
          focusCalls++;
          options.focusChanged?.(true);
        },
        blur() {
          options.focusChanged?.(false);
        },
        dispose() {
          session.dispose();
        },
        updateGeometry(geometry) {
          geometries.push(geometry);
        },
        readGeometry() {
          return {
            status: 'observed',
            coordinates: 'control-local',
            nativeRevision: 900,
            width: 999,
            height: 999,
            caret: { x: 888, y: 777, width: 1, height: 1 },
            selectionRects: [],
          };
        },
      };
    },
  };
  return {
    get focusCalls() {
      return focusCalls;
    },
    get options() {
      return editingOptions;
    },
    get value() {
      return session.value;
    },
    get pending() {
      return pending.length;
    },
    ack() {
      assert(pending.length);
      pending.shift()();
    },
    geometries,
    native(text, selection, composing = { status: 'none' }) {
      session.update({
        ...session.value,
        text,
        selection,
        composing,
        source: 'native',
        revision: session.value.revision + 1,
      });
      notify(session.value);
    },
  };
}
function reference(f, text, width, direction = 'ltr') {
  const painter = new TextPainter(
    { text: new TextSpan({ text, style }), textDirection: direction },
    {
      text: f.root.context.text,
      resources: f.root.context.resources,
      font: f.root.context.defaultFont,
      scale: 1,
    },
  );
  painter.layout({ minWidth: width, maxWidth: width });
  return painter;
}
const editor = (controller, focus, options = {}) =>
  new Center(
    new SizedBox(
      180,
      undefined,
      new EditableText('editor', controller, 'Core editor', focus, 0, null, {
        textStyle: style,
        minHeight: 0,
        maxLines: null,
        cursorColor,
        selectionColor,
        ...options,
      }),
    ),
  );

test(
  'ancestor motion reuses local editor geometry while selection, caret dimensions and custom geometry stay live',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('local geometry'),
      focus = new FocusNode(),
      host = input(f);
    let queries = 0;
    const boxes = f.library.boxes;
    f.library.boxes = function (...args) {
      queries++;
      return boxes.apply(this, args);
    };
    controller.selection = { anchor: 0, focus: 3 };
    const scene = (options) =>
      new Transform(editor(controller, focus, options), [1, 0, 0, 1, 0, 0]);
    try {
      f.set(scene());
      const render = findRender(f.root.root),
        local = render.editingGeometry,
        initial = host.geometries.at(-1);
      let ancestor = render.parent;
      while (ancestor && !(ancestor instanceof RenderTransform)) ancestor = ancestor.parent;
      assert(ancestor);
      queries = 0;
      for (const dx of [11, 24, -8]) {
        ancestor.matrix = [1, 0, 0, 1, dx, 0];
        f.frame();
        assert.equal(render.editingGeometry, local);
        assert.equal(host.geometries.at(-1).caret.x, initial.caret.x + dx);
      }
      assert.equal(queries, 0, 'Scrolling cannot repeat unchanged native range queries');
      controller.selection = { anchor: 0, focus: 5 };
      f.frame();
      const selected = render.editingGeometry;
      assert.notEqual(selected, local);
      assert(selected.selectionRects.length > 0);
      assert(queries > 0);
      queries = 0;
      assert.equal(render.editingGeometry, selected);
      assert.equal(queries, 0);
      f.set(scene({ cursorWidth: 4, cursorHeight: 12 }));
      const resized = render.editingGeometry;
      assert.notEqual(resized, selected);
      assert.equal(resized.caret.width, 4);
      assert.equal(resized.caret.height, 12);
      const caret = render.getLocalRectForCaret;
      let custom = 0;
      render.getLocalRectForCaret = function (...args) {
        custom++;
        return caret.apply(this, args);
      };
      assert.notEqual(render.editingGeometry, render.editingGeometry);
      assert.equal(custom, 2);
      delete render.getLocalRectForCaret;
      render.markNeedsLayout();
      assert.throws(() => render.editingGeometry, /current attached Core layout/);
      f.frame();
      const current = render.editingGeometry;
      f.set(new SizedBox());
      assert.throws(() => render.editingGeometry, /current attached Core layout/);
      assert(Object.isFrozen(current));
    } finally {
      f.library.boxes = boxes;
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'Core commands and formatters paint immediately; delayed OS synchronization cannot overwrite new input or nested commands',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('initial'),
      focus = new FocusNode(),
      host = input(f, { deferred: true }),
      changes = [];
    try {
      f.set(editor(controller, focus));
      controller.text = 'Core';
      assert.equal(controller.text, 'Core');
      assert.equal(host.value.text, 'initial');
      f.frame();
      assert.equal(findRender(f.root.root).plainText, 'Core');
      assert.equal(
        host.options.readCharacterBounds(0, 4),
        null,
        'An old OS buffer cannot receive bounds indexed into a newer Core document',
      );
      host.native('user', { anchor: 4, focus: 4 });
      const revision = controller.revision;
      host.ack();
      assert.equal(controller.text, 'user');
      assert.equal(controller.revision, revision, 'A transport ack is not another Core edit');
      await Promise.resolve();
      assert.equal(host.pending, 1);
      host.ack();
      assert.equal(
        host.value.text,
        'user',
        'New native input is resynchronized after the older command acknowledgement',
      );
      controller.replace('outer', { anchor: 5, focus: 5 }, () => {
        controller.text = 'inner';
      });
      assert.equal(controller.text, 'inner');
      assert.equal(
        host.pending,
        1,
        'The nested command supersedes the unsent outer synchronization',
      );
      host.ack();
      assert.equal(host.value.text, 'inner');
      for (const text of ['first', 'middle', 'last']) controller.text = text;
      assert.equal(controller.text, 'last');
      assert.equal(host.pending, 1, 'Only one OS write can be in flight');
      host.ack();
      await Promise.resolve();
      assert.equal(host.pending, 1);
      host.ack();
      assert.equal(host.value.text, 'last');
      assert.equal(host.pending, 0, 'Unsent intermediate values are coalesced');
      f.set(
        editor(controller, focus, {
          inputFormatters: [new LengthLimitingTextInputFormatter(2)],
          onChanged: (text) => changes.push(text),
        }),
      );
      const text = 'A👨‍👩‍👧‍👦B',
        formatted = 'A👨‍👩‍👧‍👦';
      host.native(text, { anchor: text.length, focus: text.length });
      assert.equal(controller.text, formatted);
      assert.equal(host.value.text, text);
      f.frame();
      assert.equal(findRender(f.root.root).plainText, formatted);
      assert.deepEqual(changes, [formatted]);
      const formattedRevision = controller.revision;
      host.ack();
      assert.equal(controller.revision, formattedRevision);
      assert.deepEqual(changes, [formatted]);
      assert(controller.undo());
      assert.equal(controller.text, 'last');
      host.ack();
      assert.throws(
        () =>
          controller.replace('callback', { anchor: 8, focus: 8 }, () => {
            throw new Error('observer');
          }),
        /observer/,
      );
      assert.equal(controller.text, 'callback');
      assert.equal(
        host.pending,
        1,
        'An observer failure cannot strand accepted Core text before OS synchronization',
      );
      host.ack();
      host.native('composing', { anchor: 9, focus: 9 }, { status: 'active', start: 0, end: 9 });
      let canceled = 0,
        applied = 0;
      controller.clear(() => canceled++);
      controller.replace('replacement', { anchor: 11, focus: 11 }, () => applied++);
      host.native(
        'compose more',
        { anchor: 12, focus: 12 },
        { status: 'active', start: 0, end: 12 },
      );
      host.ack();
      assert.equal(controller.text, 'compose more');
      await Promise.resolve();
      host.ack();
      assert.equal(controller.text, 'replacement');
      assert.equal(canceled, 0);
      assert.equal(
        applied,
        1,
        'Only the latest cancellation replacement completes after actual OS acknowledgement',
      );
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'replacing a full text page retires detached producers while frame leases and a retaken editor survive',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('retained value'),
      focus = new FocusNode(),
      key = new GlobalKey('retaken editor');
    input(f);
    let lease;
    const page = (name, count) =>
      new Stack(
        [
          ...Array.from({ length: count }, (_, index) => new Text(name + index)),
          new SizedBox(
            180,
            48,
            new EditableText('editor', controller, 'Core editor', focus, 48, key),
          ),
        ],
        new GlobalKey(name),
      );
    try {
      f.set(page('old', 40));
      assert.equal(
        f.root.nodes.filter((node) => node.role === 'button').length,
        0,
        'The field owns semantics; its pointer detector adds no duplicate button',
      );
      const render = findRender(f.root.root),
        old = [...f.library.paragraphs.values()].map((entry) => entry.layout.resource);
      lease = f.root.context.resources.acquire(old);
      f.set(page('next', 63));
      assert.equal(findRender(f.root.root), render);
      assert.equal(controller.text, 'retained value');
      assert.equal(
        [...f.library.paragraphs.values()].filter((entry) =>
          f.root.context.resources.hasInitialProducer(entry.layout.resource),
        ).length,
        64,
      );
      for (const resource of old)
        assert(
          f.root.context.resources.isRetained(resource),
          'Previous frame lease stays valid through replacement',
        );
      lease.returnBy('caller');
      lease = undefined;
      assert.equal(f.library.paragraphs.size, 64);
      f.set(new SizedBox());
      assertParagraphOwnership(f);
    } finally {
      lease?.returnBy('caller');
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'Core frame contains its own glyphs, directional selection, composition and caret; native rectangles cannot change them',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('Hello Core'),
      focus = new FocusNode(),
      host = input(f),
      surface = f.ck.MakeSurface(240, 160);
    assert(surface);
    const raster = () => {
      surface.getCanvas().clear(f.ck.TRANSPARENT);
      const commands = f.frame();
      f.library.replay(surface.getCanvas(), { commands });
      surface.flush();
      const pixels = surface.getCanvas().readPixels(0, 0, {
        width: 240,
        height: 160,
        colorType: f.ck.ColorType.RGBA_8888,
        alphaType: f.ck.AlphaType.Unpremul,
        colorSpace: f.ck.ColorSpace.SRGB,
      });
      return { commands, pixels };
    };
    const contains = (pixels, r, g, b) => {
      for (let i = 0; i < pixels.length; i += 4)
        if (
          Math.abs(pixels[i] - r) <= 2 &&
          Math.abs(pixels[i + 1] - g) <= 2 &&
          Math.abs(pixels[i + 2] - b) <= 2 &&
          pixels[i + 3] > 64
        )
          return true;
      return false;
    };
    try {
      f.set(editor(controller, focus));
      assert(findRender(f.root.root));
      let frame = raster();
      assert(frame.commands.some((command) => command.op === 'paragraph'));
      assert(
        contains(frame.pixels, 20, 104, 200),
        'Skia surface has the editor glyph pixels without a host control',
      );
      focus.requestFocus();
      await Promise.resolve();
      f.frame();
      controller.selection = { anchor: 0, focus: 5 };
      f.frame();
      frame = raster();
      assert(contains(frame.pixels, 255, 0, 85), 'Core paints selected text background');
      host.native('Hello Core', { anchor: 5, focus: 5 }, { status: 'active', start: 0, end: 5 });
      f.frame();
      frame = raster();
      assert(
        contains(frame.pixels, 0, 204, 68),
        'Composing underline and caret are Core paint: ' +
          JSON.stringify(frame.commands.filter((c) => c.op === 'drawRect')),
      );
      const render = findRender(f.root.root),
        painter = reference(f, controller.text, 180);
      try {
        const expected = painter.getOffsetForCaret(new TextPosition({ offset: 5 }), { width: 1 }),
          actual = render.editingGeometry.caret;
        const metrics = painter.computeLineMetrics()[0];
        assert.equal(render.editingGeometry.caretBaseline.y, metrics.baseline);
        assert.equal(actual.x, expected.dx);
        assert.equal(actual.y, expected.dy);
        assert(actual.x < 180);
        assert.equal(
          controller.geometry.caret.x,
          888,
          'Host observation is intentionally unrelated to Core geometry',
        );
      } finally {
        painter.dispose();
      }
      host.native('Hello Core', { anchor: 0, focus: 0 });
      f.frame();
      assert.equal(controller.isComposing, false);
      controller.text = '';
      f.frame();
      assert(findRender(f.root.root).editingGeometry.caret.height > 0);
      f.set(new SizedBox());
      assertParagraphOwnership(f);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      surface.delete();
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'Core paint/hit/caret share the same paragraph for Korean, emoji, combining marks, bidi and trailing newlines',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(),
      focus = new FocusNode();
    input(f);
    try {
      for (const text of ['한글 가\u0301 👨‍👩‍👧‍👦', 'abc אבג 123', 'first\nsecond\n', '']) {
        controller.text = text;
        f.set(editor(controller, focus));
        const render = findRender(f.root.root),
          painter = reference(f, text, 180);
        try {
          for (const offset of graphemeBoundaries(text)) {
            const position = new TextPosition({ offset }),
              expected = painter.getOffsetForCaret(position, { width: 1 }),
              actual = render.getLocalRectForCaret(position);
            assert(Math.abs(actual.x - Math.max(0, Math.min(179, expected.dx))) < 0.001);
            assert.equal(actual.y, expected.dy);
            const point = { x: actual.x, y: actual.y + actual.height / 2 },
              hit = render.getPositionForOffset(point);
            assert(graphemeBoundaries(text).includes(hit.offset), 'Hit never divides a grapheme');
          }
          if (text) {
            const selection = new TextSelection({ baseOffset: 0, extentOffset: text.length });
            assert.deepEqual(
              render.getBoxesForSelection(selection),
              painter.getBoxesForSelection(selection).map((box) => box.toRect()),
            );
          }
        } finally {
          painter.dispose();
        }
      }
      f.set(new SizedBox());
      assertParagraphOwnership(f);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'Core caret reveal scrolls clipped single and multiple lines and retires paragraphs on style/width changes',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('a long line of text that is wider than the editor'),
      focus = new FocusNode();
    input(f);
    try {
      f.set(editor(controller, focus, { maxLines: 1 }));
      focus.requestFocus();
      await Promise.resolve();
      f.frame();
      let render = findRender(f.root.root);
      assert(render.scrollOffset.x > 0);
      assert(render.editingGeometry.caret.right <= 181);
      controller.selection = { anchor: 0, focus: 0 };
      f.frame();
      assert.equal(render.scrollOffset.x, 0);
      controller.text = 'one\ntwo\nthree\nfour\nfive';
      f.set(editor(controller, focus, { maxLines: 2 }));
      await Promise.resolve();
      f.frame();
      render = findRender(f.root.root);
      assert(
        render.scrollOffset.y > 0,
        JSON.stringify({
          scroll: render.scrollOffset,
          caret: render.editingGeometry.caret,
          size: render.size,
          focused: focus.hasPrimaryFocus,
          text: controller.text,
          selection: controller.selection,
        }),
      );
      assert(render.editingGeometry.caret.bottom <= render.size.height + 0.01);
      controller.selection = { anchor: 0, focus: 0 };
      f.frame();
      assert.equal(render.scrollOffset.y, 0);
      for (const size of [16, 24, 18]) {
        f.set(
          editor(controller, focus, { maxLines: 2, textStyle: style.copyWith({ fontSize: size }) }),
        );
        assertParagraphOwnership(f, 2);
      }
      f.set(new SizedBox());
      assertParagraphOwnership(f);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'canvas tap and keyboard selection use Core hit geometry and preserve borrowed focus handlers',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('Ae\u0301👨‍👩‍👧‍👦Z'),
      previous = () => 'ignored',
      focus = new FocusNode({ onKeyEvent: previous }),
      submitted = [],
      host = input(f);
    const key = (key, extra = {}) => {
      f.root.key({
        kind: 'down',
        key,
        shift: false,
        control: false,
        alt: false,
        meta: false,
        repeat: false,
        ...extra,
      });
      f.root.key({
        kind: 'up',
        key,
        shift: false,
        control: false,
        alt: false,
        meta: false,
        repeat: false,
        ...extra,
      });
      f.frame();
    };
    try {
      f.set(editor(controller, focus, { onSubmitted: (text) => submitted.push(text) }));
      const render = findRender(f.root.root),
        caret = render.getLocalRectForCaret(new TextPosition({ offset: 1 })),
        global = render.localToGlobal({ x: caret.x, y: caret.y + caret.height / 2 });
      for (const kind of ['down', 'up'])
        f.root.pointer({
          kind,
          pointer: 1,
          device: 'mouse',
          buttons: kind === 'up' ? 0 : 1,
          x: global.x,
          y: global.y,
          timestamp: 0,
          viewportGeneration: 1,
        });
      await Promise.resolve();
      f.frame();
      assert.deepEqual(controller.selection, { anchor: 1, focus: 1 });
      assert(focus.hasPrimaryFocus);
      const focusedCalls = host.focusCalls;
      f.advance(400);
      for (const kind of ['down', 'up'])
        f.root.pointer({
          kind,
          pointer: 1,
          device: 'mouse',
          buttons: kind === 'up' ? 0 : 1,
          x: global.x,
          y: global.y,
          timestamp: 400,
          viewportGeneration: 1,
        });
      await Promise.resolve();
      f.frame();
      assert.equal(
        host.focusCalls,
        focusedCalls + 1,
        'Retapping a focused Core editor requests the OS keyboard again after native dismissal',
      );
      key('ArrowRight');
      assert.deepEqual(controller.selection, { anchor: 3, focus: 3 });
      key('ArrowRight', { shift: true });
      assert.deepEqual(controller.selection, { anchor: 3, focus: 14 });
      key('Backspace');
      assert.equal(controller.text, 'Ae\u0301Z');
      key('Backspace');
      assert.equal(controller.text, 'AZ');
      key('Delete');
      assert.equal(controller.text, 'A');
      controller.text = 'Ae\u0301👨‍👩‍👧‍👦Z';
      f.frame();
      key('Home');
      assert.deepEqual(controller.selection, { anchor: 0, focus: 0 });
      key('a', { control: true });
      assert.deepEqual(controller.selection, { anchor: 0, focus: 15 });
      key('Enter');
      assert.equal(controller.text, '\n');
      assert.deepEqual(submitted, []);
      assert(focus.hasPrimaryFocus);
      for (const [kind, repeat] of [
        ['down', false],
        ['down', true],
        ['up', false],
      ])
        f.root.key({
          kind,
          key: 'Enter',
          shift: false,
          control: true,
          alt: false,
          meta: false,
          repeat,
        });
      f.frame();
      assert.deepEqual(submitted, ['\n'], 'Core submits once and consumes repeated submit keys');
      f.set(new SizedBox());
      assert.equal(focus.onKeyEvent, previous);
      assertParagraphOwnership(f);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'password paint contains only obscuring glyphs and preserves original grapheme hit boundaries',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('e\u0301👨‍👩‍👧‍👦'),
      focus = new FocusNode();
    input(f);
    try {
      f.set(editor(controller, focus, { maxLines: 1, configuration: { obscureText: true } }));
      const render = findRender(f.root.root);
      assert(
        [...f.library.paragraphs.values()].every(
          (entry) =>
            !entry.layout.input.text.includes('👨') && !entry.layout.input.text.includes('e'),
        ),
      );
      for (const x of [0, 10, 20, 40, 60, 100, 170])
        assert(
          graphemeBoundaries(controller.text).includes(
            render.getPositionForOffset({ x, y: 15 }).offset,
          ),
        );
      controller.selection = { anchor: 0, focus: controller.text.length };
      f.frame();
      assert.equal(
        f.root.nodes.find((node) => node.id === 'editor').value,
        '•'.repeat(controller.text.length),
      );
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'caret blink pauses with the View and retires its timer on unmount',
  { timeout },
  async (context) => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('cursor'),
      focus = new FocusNode();
    input(f);
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const cursor = () =>
      f.frame().some((command) => command.op === 'drawRect' && command.paint.color === cursorColor);
    try {
      f.set(editor(controller, focus));
      assert.equal(cursor(), false);
      focus.requestFocus();
      await Promise.resolve();
      f.frame();
      assert(cursor());
      context.mock.timers.tick(500);
      assert.equal(cursor(), false);
      context.mock.timers.tick(500);
      assert(cursor());
      f.root.scheduler.visible = false;
      context.mock.timers.tick(1500);
      f.root.scheduler.visible = true;
      assert(cursor());
      f.set(new SizedBox());
      context.mock.timers.tick(1500);
      assert.equal(cursor(), false);
      assertParagraphOwnership(f);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'OS input geometry travels from the Core paragraph through View transform and clip with frozen owner epochs',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('Core coordinates'),
      focus = new FocusNode();
    input(f);
    try {
      f.set(new ClipRect(new Transform(editor(controller, focus), [1.25, 0, 0, 1.5, -10, 4])));
      const render = findRender(f.root.root),
        local = render.editingGeometry.caret,
        expected = render.localToGlobal({ x: local.x, y: local.y }),
        node = f.root.nodes.find((node) => node.id === 'editor'),
        geometry = node.textInputGeometry;
      assert.equal(geometry.coordinates, 'view-logical');
      assert.deepEqual(geometry.owner, f.root.context.owner);
      assert.equal(geometry.viewportGeneration, 1);
      assert.equal(geometry.scale, 1);
      const baseline = render.localToGlobal(render.editingGeometry.caretBaseline);
      assert.deepEqual(geometry.caretBaseline, baseline);
      assert(Object.isFrozen(geometry.caretBaseline));
      assert.equal(geometry.caret.x, expected.x);
      assert.equal(geometry.caret.y, expected.y);
      assert.equal(geometry.caret.width, local.width * 1.25);
      assert.equal(geometry.caret.height, local.height * 1.5);
      assert(
        geometry.clip.x >= 0 &&
          geometry.clip.y >= 0 &&
          geometry.clip.x + geometry.clip.width <= 240 &&
          geometry.clip.y + geometry.clip.height <= 160,
      );
      assert(
        Object.isFrozen(geometry) &&
          Object.isFrozen(geometry.owner) &&
          Object.isFrozen(geometry.caret) &&
          Object.isFrozen(geometry.transform),
      );
      assert.throws(() => {
        geometry.caret.x = 888;
      }, TypeError);
      controller.selection = { anchor: 0, focus: 0 };
      f.frame();
      assert(
        f.root.nodes.find((node) => node.id === 'editor').textInputGeometry.layoutEpoch >
          geometry.layoutEpoch,
      );
      f.set(new SizedBox());
      assert.equal(
        f.root.nodes.some((node) => node.id === 'editor'),
        false,
      );
      assert.throws(() => render.editingGeometry, /current attached Core layout/);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'a new native backing at unchanged size commits a new input frame without changing the editing document',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('same paragraph'),
      focus = new FocusNode(),
      host = input(f);
    try {
      const metrics = f.root.context.readMetrics();
      metrics.nativeSurfaceGeneration = 7;
      f.set(editor(controller, focus));
      const first = host.geometries.at(-1),
        revision = controller.revision;
      assert.equal(first.nativeSurfaceGeneration, 7);
      f.frame();
      assert.equal(host.geometries.at(-1).layoutEpoch, first.layoutEpoch);
      metrics.nativeSurfaceGeneration = 8;
      assert.equal(
        host.options.readCharacterBounds(0, 1, first),
        null,
        'A backing change withdraws old paragraph coordinates before the next frame commits',
      );
      f.frame();
      const next = host.geometries.at(-1);
      assert.equal(next.nativeSurfaceGeneration, 8);
      assert(next.layoutEpoch > first.layoutEpoch);
      assert.deepEqual(next.caret, first.caret);
      assert.equal(next.viewportGeneration, first.viewportGeneration);
      assert.equal(controller.revision, revision);
      assert.equal(
        host.options.readCharacterBounds(0, 1, first),
        null,
        'An old backing frame cannot receive a current paragraph reply',
      );
      assert(host.options.readCharacterBounds(0, 1, next));
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'IME character bounds are lazy Core glyph queries and defer a dirty or retired editing connection',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('e\u0301👩‍🚀\nאבג'),
      focus = new FocusNode(),
      host = input(f);
    try {
      f.set(editor(controller, focus));
      const revision = controller.revision,
        options = host.options,
        queried = options.readCharacterBounds(0, controller.text.length);
      assert(queried);
      assert.equal(queried.rangeStart, 0);
      assert.equal(queried.rects.length, controller.text.length);
      assert.deepEqual(queried.owner, f.root.context.owner);
      assert.deepEqual(
        queried.rects[0],
        queried.rects[1],
        'Combining code units share their shaped grapheme',
      );
      assert.deepEqual(
        queried.rects[2],
        queried.rects[3],
        'A surrogate pair shares its actual glyph bounds',
      );
      assert(
        queried.rects[7].y < queried.rects[8].y,
        'A newline belongs to the preceding visual line',
      );
      assert(
        Object.isFrozen(queried) &&
          Object.isFrozen(queried.rects) &&
          queried.rects.every(Object.isFrozen),
      );
      assert(host.geometries.length > 0);
      f.frame();
      assert.equal(
        controller.revision,
        revision,
        'Geometry publication never acknowledges editing content',
      );
      controller.text = 'replacement';
      assert.equal(
        options.readCharacterBounds(0, 1),
        null,
        'Wait for the paragraph carrying the replacement',
      );
      f.frame();
      assert(options.readCharacterBounds(0, 1));
      assert.throws(() => options.readCharacterBounds(-1, 1), /in-body UTF-16 range/);
      f.set(new SizedBox());
      assert.equal(options.readCharacterBounds(0, 1), null);
      assertParagraphOwnership(f);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'Core range, arbitrary caret and hit queries use the committed paragraph with explicit miss and frame identity',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('AB\nאבג\n👩‍🚀e\u0301'),
      focus = new FocusNode(),
      host = input(f);
    try {
      controller.selection = { anchor: 0, focus: 0 };
      f.set(new ClipRect(new Transform(editor(controller, focus), [1.1, 0.12, -0.08, 0.9, 5, 2])));
      const render = findRender(f.root.root),
        options = host.options,
        geometry = host.geometries.at(-1),
        character = options.readCharacterBounds(0, controller.text.length, geometry);
      const center = (rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }),
        global = (point) => render.localToGlobal(point);
      const local = render.getLocalRectForCaret(new TextPosition({ offset: 1 })),
        caret = options.readRangeBounds(1, 1, geometry),
        corners = [
          global({ x: local.x, y: local.y }),
          global({ x: local.right, y: local.y }),
          global({ x: local.x, y: local.bottom }),
          global({ x: local.right, y: local.bottom }),
        ];
      assert.equal(caret.rangeStart, 1);
      assert.equal(caret.rangeEnd, 1);
      assert.equal(caret.layoutEpoch, geometry.layoutEpoch);
      assert(Object.isFrozen(caret) && Object.isFrozen(caret.rect));
      assert.equal(caret.rect.x, Math.min(...corners.map((p) => p.x)));
      assert.equal(caret.rect.y, Math.min(...corners.map((p) => p.y)));
      assert.equal(caret.rect.width, Math.max(...corners.map((p) => p.x)) - caret.rect.x);
      assert.equal(caret.rect.height, Math.max(...corners.map((p) => p.y)) - caret.rect.y);
      const range = options.readRangeBounds(0, controller.text.length, geometry);
      assert.equal(range.rect.x, Math.min(...character.rects.map((r) => r.x)));
      assert.equal(range.rect.y, Math.min(...character.rects.map((r) => r.y)));
      assert.equal(
        range.rect.width,
        Math.max(...character.rects.map((r) => r.x + r.width)) - range.rect.x,
      );
      assert.equal(
        range.rect.height,
        Math.max(...character.rects.map((r) => r.y + r.height)) - range.rect.y,
      );
      for (const offset of [0, 1, 3, 4, 5, 7, 12]) {
        const rect = render.getCharacterBounds(offset, offset + 1)[0],
          point = global(center(rect)),
          hit = options.readTextPosition(point, {}, geometry);
        assert.equal(hit.status, 'hit');
        assert.equal(hit.position, offset);
        assert.equal(hit.layoutEpoch, geometry.layoutEpoch);
        assert.deepEqual(hit.owner, geometry.owner);
        assert(Object.isFrozen(hit));
      }
      const first = render.getCharacterBounds(0, 1)[0],
        right = global({ x: first.right - 0.01, y: first.y + first.height / 2 });
      assert.equal(options.readTextPosition(right, {}, geometry).position, 0);
      assert.equal(
        options.readTextPosition(right, { roundNearest: true }, geometry).position,
        1,
        'Rounding uses the actual nearest paragraph caret edge',
      );
      const outside = { x: -100, y: -100 };
      assert.equal(options.readTextPosition(outside, {}, geometry).status, 'miss');
      assert.equal(
        options.readTextPosition(outside, { roundNearest: true }, geometry).status,
        'miss',
        'Rounding does not authorize an outside hit',
      );
      assert.equal(options.readTextPosition(outside, { nearest: true }, geometry).status, 'hit');
      for (const expected of [
        { ...geometry, layoutEpoch: geometry.layoutEpoch + 1 },
        { ...geometry, viewportGeneration: geometry.viewportGeneration + 1 },
        { ...geometry, owner: { ...geometry.owner, generation: geometry.owner.generation + 1 } },
        { ...geometry, owner: { ...geometry.owner, id: 'other' } },
      ]) {
        assert.equal(options.readCharacterBounds(0, 1, expected), null);
        assert.equal(options.readRangeBounds(1, 1, expected), null);
        assert.equal(options.readTextPosition(right, { nearest: true }, expected), null);
      }
      assert.throws(() => options.readRangeBounds(-1, 0, geometry), /in-body UTF-16 range/);
      controller.selection = { anchor: 1, focus: 1 };
      assert.equal(options.readTextPosition(right, {}, geometry), null);
      f.frame();
      const next = host.geometries.at(-1);
      assert(next.layoutEpoch > geometry.layoutEpoch);
      assert.equal(options.readRangeBounds(1, 1, geometry), null);
      assert(options.readRangeBounds(1, 1, next));
      f.set(
        new ClipRect(
          new Transform(
            editor(controller, focus),
            [1, 0.05, 0.2, 0.0003, -0.04, 0.9, 0.3, 0.0002, 0.1, 0.2, 1, 0.001, 3, 2, 1, 1],
          ),
        ),
      );
      const perspective = findRender(f.root.root),
        box = perspective.getCharacterBounds(0, 1)[0],
        screen = perspective.localToGlobal(center(box));
      assert.equal(
        host.options.readTextPosition(screen, {}, host.geometries.at(-1)).position,
        0,
        'The Core query unprojects the actual perspective paint plane',
      );
      f.set(new SizedBox());
      assert.equal(options.readRangeBounds(0, 0), null);
      assert.equal(options.readTextPosition(outside, { nearest: true }), null);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'Core hit queries preserve obscured grapheme boundaries, scroll and clipped visibility without mutating the document',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('A👩‍🚀e\u0301B'),
      focus = new FocusNode(),
      host = input(f);
    try {
      f.set(editor(controller, focus, { maxLines: 1, configuration: { obscureText: true } }));
      const options = host.options,
        render = findRender(f.root.root),
        geometry = host.geometries.at(-1),
        revision = controller.revision;
      for (const offset of [1, 2, 3, 4, 5, 6, 7]) {
        const rect = render.getCharacterBounds(offset, offset + 1)[0],
          point = render.localToGlobal({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }),
          hit = options.readTextPosition(point, {}, geometry);
        assert.equal(hit.status, 'hit');
        assert.equal(
          hit.position,
          offset < 6 ? 1 : 6,
          'A bullet inside a surrogate/ZWJ/combining sequence retains the original grapheme start',
        );
        assert(
          graphemeBoundaries(controller.text).includes(
            options.readTextPosition(point, { roundNearest: true }, geometry).position,
          ),
        );
      }
      assert.equal(controller.revision, revision);
      assert.equal(controller.text, 'A👩‍🚀e\u0301B');
      f.set(
        editor(controller, focus, {
          maxLines: 1,
          configuration: { obscureText: true },
          enabled: false,
        }),
      );
      assert.equal(host.options.readTextPosition({ x: 0, y: 0 }, { nearest: true }), null);
      assert.equal(host.options.readRangeBounds(0, 0), null);
      const text = 'a long line which scrolls beyond its viewport and retains Core hit coordinates';
      controller.replace(text, { anchor: text.length, focus: text.length });
      f.set(editor(controller, focus, { maxLines: 1 }));
      focus.requestFocus();
      f.frame();
      const scrolling = findRender(f.root.root),
        caret = scrolling.getLocalRectForCaret(
          new TextPosition({ offset: controller.text.length }),
        );
      const point = scrolling.localToGlobal({ x: caret.x, y: caret.y + caret.height / 2 }),
        hit = host.options.readTextPosition(
          point,
          { nearest: true, roundNearest: true },
          host.geometries.at(-1),
        );
      assert.equal(hit.position, controller.text.length);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'nullable screen unprojection round-trips a perspective plane and rejects a singular or edge-on plane',
  { timeout },
  () => {
    for (const matrix of [
      captureMatrix4([
        1.2, 0.2, 0.3, 0.001, -0.3, 0.8, 0.4, -0.002, 0.1, 0.2, 1, 0.001, 20, 30, 4, 1,
      ]),
      captureMatrix4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1]),
    ])
      for (const point of [
        { x: 0, y: 0 },
        { x: 20, y: 30 },
        { x: -10, y: 4 },
      ]) {
        const projected = transformMatrix4Point(matrix, point),
          local = tryUnprojectMatrix4Point(matrix, projected);
        assert(local);
        assert(Math.abs(local.x - point.x) < 1e-9);
        assert(Math.abs(local.y - point.y) < 1e-9);
      }
    for (const matrix of [
      captureMatrix4([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
      captureMatrix4([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]),
    ]) {
      assert.equal(tryUnprojectMatrix4Point(matrix, { x: 7, y: 9 }), null);
      assert.deepEqual(unprojectMatrix4Point(matrix, { x: 7, y: 9 }), { x: 0, y: 0 });
    }
    assert.equal(
      tryUnprojectMatrix4Point(captureMatrix4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), {
        x: Infinity,
        y: 0,
      }),
      null,
    );
  },
);

test(
  'paint-only ancestor transforms invalidate stale IME bounds and commit the same epoch to semantics and the input port',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('Core coordinates'),
      focus = new FocusNode(),
      host = input(f);
    const transforms = () => {
      const result = [];
      const visit = (element) => {
        if (element.renderObject instanceof RenderTransform) result.push(element.renderObject);
        element.visitChildren(visit);
      };
      visit(f.root.root);
      return result;
    };
    try {
      f.set(new ClipRect(new Transform(editor(controller, focus), [1, 0, 0, 1, 0, 0])));
      findRender(f.root.root);
      const ancestor = transforms()[0],
        initial = f.root.nodes.find((node) => node.id === 'editor').textInputGeometry,
        paragraph = f.library.paragraphs.values().next().value;
      assert.equal(host.options.readCharacterBounds(0, 1).layoutEpoch, initial.layoutEpoch);
      ancestor.matrix = [1, 0, 0, 1, 19, 7];
      assert.equal(
        host.options.readCharacterBounds(0, 1),
        null,
        'Dirty paint cannot answer using a transform that has not been recorded',
      );
      assert.equal(host.options.readRangeBounds(0, 0), null);
      assert.equal(host.options.readTextPosition({ x: 100, y: 80 }, { nearest: true }), null);
      f.frame();
      const moved = f.root.nodes.find((node) => node.id === 'editor').textInputGeometry;
      assert(
        moved.layoutEpoch > initial.layoutEpoch,
        'A transform-only frame requires a new input geometry epoch',
      );
      assert.equal(moved.caret.x, initial.caret.x + 19);
      assert.equal(moved.caret.y, initial.caret.y + 7);
      assert.equal(host.options.readCharacterBounds(0, 1).layoutEpoch, moved.layoutEpoch);
      assert.deepEqual(
        host.geometries.at(-1),
        moved,
        'The OS port and semantics must consume the same committed snapshot',
      );
      assert.equal(
        f.library.paragraphs.values().next().value,
        paragraph,
        'A transform does not re-layout the paragraph',
      );
      const epoch = moved.layoutEpoch;
      f.frame();
      assert.equal(
        host.options.readCharacterBounds(0, 0).layoutEpoch,
        epoch,
        'An unchanged frame retains its input epoch',
      );
      ancestor.matrix = [1, 0, 0, 1, 0, 0];
      f.frame();
      const restored = host.options.readCharacterBounds(0, 1);
      assert(
        restored.layoutEpoch > epoch,
        'Returning to previous coordinates cannot revive the old epoch',
      );
      assert.equal(
        f.root.nodes.find((node) => node.id === 'editor').textInputGeometry.layoutEpoch,
        restored.layoutEpoch,
      );
      f.set(new SizedBox());
      assert.equal(host.options.readCharacterBounds(0, 1), null);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'paint-only custom clipping updates the Core input snapshot without replacing its paragraph',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('Clipped input'),
      focus = new FocusNode(),
      host = input(f),
      reclip = new ChangeNotifier();
    let width = 120;
    class DynamicClip extends CustomClipper {
      constructor() {
        super({ reclip });
      }
      getClip() {
        return { x: 40, y: 30, width, height: 90 };
      }
      getApproximateClipRect() {
        return this.getClip();
      }
      shouldReclip() {
        return false;
      }
    }
    try {
      f.set(new CustomClipRect(editor(controller, focus), { clipper: new DynamicClip() }));
      const initial = f.root.nodes.find((node) => node.id === 'editor').textInputGeometry,
        paragraph = f.library.paragraphs.values().next().value;
      assert.equal(initial.clip.width, 120);
      const render = findRender(f.root.root),
        glyph = render.getCharacterBounds(0, 1)[0],
        local = { x: glyph.x + 0.01, y: glyph.y + glyph.height / 2 },
        point = render.localToGlobal(local);
      assert(point.x < initial.clip.x);
      assert.equal(render.getTextPositionForPoint(local, {}).offset, 0);
      assert.equal(
        host.options.readTextPosition(point, {}, initial).status,
        'miss',
        'A painted glyph outside the committed ancestor clip cannot be hit',
      );
      assert.equal(host.options.readTextPosition(point, { nearest: true }, initial).status, 'hit');
      width = 80;
      reclip.notifyListeners();
      assert.equal(host.options.readCharacterBounds(0, 0), null);
      f.frame();
      const next = f.root.nodes.find((node) => node.id === 'editor').textInputGeometry;
      assert.equal(next.clip.width, 80);
      assert(next.layoutEpoch > initial.layoutEpoch);
      assert.deepEqual(host.geometries.at(-1), next);
      assert.equal(f.library.paragraphs.values().next().value, paragraph);
      const commands = f.frame();
      assert(
        commands.some((command) => command.op === 'clipRect' && command.rect.width === 80),
        'The same custom clip must be present in the actual Core recording',
      );
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
      reclip.dispose();
    }
  },
);

test(
  'an offstage editor withdraws its IME geometry and cannot revive an older epoch when shown again',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('Retained input'),
      focus = new FocusNode(),
      host = input(f);
    try {
      f.set(new Offstage(editor(controller, focus), { offstage: false }));
      const initial = host.geometries.at(-1);
      let offstage;
      const visit = (element) => {
        if (element.renderObject instanceof RenderOffstage) offstage = element.renderObject;
        element.visitChildren(visit);
      };
      visit(f.root.root);
      assert(offstage);
      offstage.offstage = true;
      f.frame();
      assert.equal(host.options.readCharacterBounds(0, 0), null);
      assert.equal(host.geometries.at(-1), null);
      assert(!f.root.nodes.some((node) => node.id === 'editor'));
      offstage.offstage = false;
      f.frame();
      const shown = host.geometries.at(-1);
      assert(shown);
      assert(shown.layoutEpoch > initial.layoutEpoch);
      assert.deepEqual(shown.caret, initial.caret);
      assert.equal(host.options.readCharacterBounds(0, 0).layoutEpoch, shown.layoutEpoch);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'Home/End retain painted wrap affinity and repeat across soft lines according to the platform map',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('one two three four five six seven eight'),
      focus = new FocusNode(),
      host = input(f);
    const key = (key) => {
      f.root.key({
        kind: 'down',
        key,
        shift: false,
        control: false,
        alt: false,
        meta: false,
        repeat: false,
      });
      f.root.key({
        kind: 'up',
        key,
        shift: false,
        control: false,
        alt: false,
        meta: false,
        repeat: false,
      });
      f.frame();
    };
    try {
      f.set(editor(controller, focus, { maxLines: 3 }));
      focus.requestFocus();
      await Promise.resolve();
      controller.selection = { anchor: 2, focus: 2 };
      f.frame();
      const render = findRender(f.root.root),
        line = render.getLineBoundary(new TextPosition({ offset: 2 })),
        y = render.editingGeometry.caret.y;
      assert(line.end > 2 && line.end < controller.text.length);
      key('End');
      assert.equal(controller.selection.focus, line.end);
      assert.equal(
        render.editingGeometry.caret.y,
        y,
        'End must retain the upstream side of the wrap',
      );
      assert.deepEqual(
        host.options.readRangeBounds(line.end, line.end).rect,
        host.geometries.at(-1).caret,
        'An OS caret query must retain the painted soft-wrap affinity',
      );
      key('End');
      const second = render.getLineBoundary(
        new TextPosition({ offset: line.end, affinity: 'downstream' }),
      );
      assert.equal(
        controller.selection.focus,
        second.end,
        'Repeated End continues into the next soft line',
      );
      key('Home');
      assert.equal(controller.selection.focus, second.start);
      key('Home');
      assert.equal(
        controller.selection.focus,
        0,
        'Repeated Home crosses the soft wrap back into the first line',
      );
      controller.selection = { anchor: 2, focus: 2 };
      f.frame();
      key('ArrowDown');
      key('Home');
      assert.equal(render.editingGeometry.caret.y, y + style.fontSize * style.height);
      // Pointer hits at the end of the previous visual line may retain the same
      // UTF-16 offset while changing affinity; the painted caret must follow.
      const end = render.getLocalRectForCaret(
          new TextPosition({ offset: line.end, affinity: 'upstream' }),
        ),
        point = render.localToGlobal({ x: end.x + 1, y: end.y + end.height / 2 });
      for (const kind of ['down', 'up'])
        f.root.pointer({
          kind,
          pointer: 1,
          device: 'mouse',
          buttons: kind === 'up' ? 0 : 1,
          x: point.x,
          y: point.y,
          timestamp: 100,
          viewportGeneration: 1,
        });
      f.frame();
      assert.equal(controller.selection.focus, line.end);
      assert.equal(render.editingGeometry.caret.y, y);
      controller.text = 'one\ntwo';
      controller.selection = { anchor: 2, focus: 2 };
      f.frame();
      const hardY = render.editingGeometry.caret.y;
      key('End');
      assert.equal(controller.selection.focus, 3);
      assert.equal(render.editingGeometry.caret.y, hardY, 'End stays before a hard line separator');
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'a failed Core frame withdraws input geometry and a successful retry commits the new coordinates',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('Frame transaction'),
      focus = new FocusNode(),
      host = input(f);
    let reject = false,
      rejectPublication = false;
    const bind = f.root.context.editing.bind;
    f.root.context.editing.bind = (...args) => {
      const binding = bind(...args),
        update = binding.updateGeometry;
      binding.updateGeometry = (geometry) => {
        if (rejectPublication && geometry) {
          rejectPublication = false;
          throw new Error('OS geometry publication failed');
        }
        update(geometry);
      };
      return binding;
    };
    f.root.context.semantics = {
      capability: 'native-controls',
      bind() {
        return {
          update() {
            if (reject) throw new Error('semantic transport failure');
          },
          dispose() {},
        };
      },
    };
    try {
      f.set(new Transform(editor(controller, focus), [1, 0, 0, 1, 0, 0]));
      const initial = host.geometries.at(-1);
      let ancestor;
      const visit = (element) => {
        if (element.renderObject instanceof RenderTransform) ancestor = element.renderObject;
        element.visitChildren(visit);
      };
      visit(f.root.root);
      ancestor.matrix = [1, 0, 0, 1, 23, 0];
      reject = true;
      assert.throws(() => f.frame(), /semantic transport failure/);
      assert.equal(host.options.readCharacterBounds(0, 0), null);
      assert.equal(
        host.geometries.at(-1),
        null,
        'An aborted frame cannot leave provisional OS coordinates',
      );
      assert.equal(host.options.readRangeBounds(0, 0), null);
      assert.equal(host.options.readTextPosition({ x: 100, y: 80 }, { nearest: true }), null);
      reject = false;
      f.frame();
      const next = host.geometries.at(-1);
      assert(next);
      assert(next.layoutEpoch > initial.layoutEpoch);
      assert.equal(next.caret.x, initial.caret.x + 23);
      assert.equal(host.options.readCharacterBounds(0, 0).layoutEpoch, next.layoutEpoch);
      rejectPublication = true;
      ancestor.matrix = [1, 0, 0, 1, 24, 0];
      assert.throws(() => f.frame(), /Frame build\/finalization failed/);
      assert.equal(
        host.geometries.at(-1),
        null,
        'A publication error withdraws the failed frame before retry',
      );
      f.frame();
      assert(host.geometries.at(-1));
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'mouse selection starts at pointer down, follows vertical text and scrolls continuously while held at the multiline edge',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      text = Array.from({ length: 24 }, (_, index) => 'Line ' + index).join('\n'),
      controller = new TextEditingController(text),
      focus = new FocusNode();
    input(f);
    controller.selection = { anchor: 0, focus: 0 };
    const pointer = (kind, point, time) =>
      f.root.pointer({
        kind,
        pointer: 21,
        device: 'mouse',
        buttons: kind === 'up' || kind === 'cancel' ? 0 : 1,
        x: point.x,
        y: point.y,
        timestamp: time,
        viewportGeneration: 1,
      });
    try {
      f.set(
        new Center(
          new SizedBox(
            180,
            72,
            new EditableText('field', controller, 'Vertical drag', focus, 72, null, {
              maxLines: 3,
              minHeight: 0,
              textStyle: style,
              configuration: { readOnly: true },
            }),
          ),
        ),
      );
      const render = findRender(f.root.root),
        start = render.localToGlobal({ x: 1, y: 5 }),
        second = render.localToGlobal({ x: 1, y: 40 }),
        edge = render.localToGlobal({ x: 50, y: render.size.height + 15 });
      pointer('down', start, 0);
      pointer('move', second, 16);
      pointer('move', render.localToGlobal({ x: 1, y: 55 }), 24);
      await Promise.resolve();
      f.frame();
      assert(
        focus.hasPrimaryFocus,
        'The batched pointer ingress commits its pending focus before the next frame',
      );
      assert.equal(
        controller.selection.anchor,
        0,
        'DragStartBehavior.down retains the original paragraph hit',
      );
      assert(controller.selection.focus > 0, 'A vertical mouse drag selects another line');
      pointer('move', edge, 32);
      f.frame();
      const first = controller.selection.focus,
        firstScroll = render.scrollOffset.y;
      for (let frame = 0; frame < 16; frame++) f.advance(16);
      assert(
        controller.selection.focus > first,
        'A stationary edge pointer extends into newly exposed paragraph lines',
      );
      assert(render.scrollOffset.y > firstScroll);
      assert.equal(controller.text, text, 'Read-only selection scrolling never edits the document');
      pointer('up', edge, 320);
      f.frame();
      const stopped = render.scrollOffset.y;
      f.advance(250);
      assert.equal(render.scrollOffset.y, stopped);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'single-line selection edge scrolling retires on cancel, View hiding, document replacement and unmount',
  { timeout },
  async () => {
    for (const retirement of ['cancel', 'hidden', 'replace', 'unmount']) {
      const f = await engineFixture({ fonts: true }),
        controller = new TextEditingController('0123456789 '.repeat(12)),
        focus = new FocusNode();
      input(f);
      controller.selection = { anchor: 0, focus: 0 };
      const pointer = (kind, point, time) =>
        f.root.pointer({
          kind,
          pointer: 22,
          device: 'mouse',
          buttons: kind === 'up' || kind === 'cancel' ? 0 : 1,
          x: point.x,
          y: point.y,
          timestamp: time,
          viewportGeneration: 1,
        });
      try {
        f.set(
          new Center(
            new SizedBox(
              120,
              48,
              new EditableText('field', controller, 'Horizontal drag', focus, 48, null, {
                textStyle: style,
              }),
            ),
          ),
        );
        focus.requestFocus();
        f.frame();
        const render = findRender(f.root.root),
          start = render.localToGlobal({ x: 1, y: 24 }),
          edge = render.localToGlobal({ x: render.size.width + 20, y: 24 });
        pointer('down', start, 0);
        pointer('move', edge, 20);
        f.frame();
        f.advance(16);
        f.advance(16);
        assert(render.scrollOffset.x > 0);
        if (retirement === 'cancel') pointer('cancel', edge, 60);
        else if (retirement === 'hidden') f.root.scheduler.visible = false;
        else if (retirement === 'replace') controller.text = 'new';
        else f.set(new SizedBox());
        f.frame();
        assert.equal(
          f.root.scheduler.transientCallbackCount,
          0,
          retirement + ' retires the selection ticker',
        );
        if (retirement === 'hidden') {
          f.root.scheduler.visible = true;
          f.advance(100);
          assert.equal(
            f.root.scheduler.transientCallbackCount,
            0,
            'Showing a View cannot resume a retired pointer gesture',
          );
        }
      } finally {
        await f.close();
        controller.dispose();
        focus.dispose();
      }
    }
  },
);

test(
  'horizontal keys walk the painted mixed-bidi graphemes and use inherited paragraph direction',
  { timeout },
  async () => {
    for (const scenario of [
      {
        text: 'abc אבג def',
        direction: 'ltr',
        right: [1, 2, 3, 4, 6, 5, 4, 8, 9, 10, 11],
        left: [10, 9, 8, 7, 5, 6, 7, 3, 2, 1, 0],
      },
      { text: 'abc', direction: 'rtl', right: [1, 2, 3], left: [2, 1, 0] },
    ]) {
      const f = await engineFixture({ fonts: true }),
        controller = new TextEditingController(scenario.text),
        focus = new FocusNode();
      input(f);
      controller.selection = { anchor: 0, focus: 0 };
      const key = (name) => {
        for (const kind of ['down', 'up'])
          f.root.key({
            kind,
            key: name,
            control: false,
            meta: false,
            alt: false,
            shift: false,
            repeat: false,
          });
        f.frame();
      };
      try {
        f.set(
          new Directionality(
            scenario.direction,
            new Center(
              new SizedBox(
                220,
                48,
                new EditableText('field', controller, 'Visual movement', focus, 48, null, {
                  textStyle: style,
                }),
              ),
            ),
          ),
        );
        focus.requestFocus();
        f.frame();
        const render = findRender(f.root.root);
        assert.equal(render.textDirection, scenario.direction);
        let previous = render.editingGeometry.caret.x;
        for (const expected of scenario.right) {
          key('ArrowRight');
          assert.equal(controller.selection.focus, expected);
          const x = render.editingGeometry.caret.x;
          assert(
            x >= previous,
            'Right must advance in the painted direction through an opposite-direction run',
          );
          previous = x;
        }
        for (const expected of scenario.left) {
          key('ArrowLeft');
          assert.equal(controller.selection.focus, expected);
          const x = render.editingGeometry.caret.x;
          assert(
            x <= previous,
            'Left must advance in the painted direction through an opposite-direction run',
          );
          previous = x;
        }
        assert.equal(controller.text, scenario.text);
      } finally {
        await f.close();
        controller.dispose();
        focus.dispose();
      }
    }
  },
);

test(
  'visual caret movement crosses hard separators once and skips the duplicate soft-wrap affinity stop',
  { timeout },
  async () => {
    for (const text of ['a\n\nb', 'a\r\nb']) {
      const f = await engineFixture({ fonts: true }),
        controller = new TextEditingController(text);
      input(f);
      try {
        f.set(
          new Center(
            new SizedBox(
              180,
              120,
              new EditableText('field', controller, 'Line movement', undefined, 120, null, {
                maxLines: 4,
                textStyle: style,
              }),
            ),
          ),
        );
        const render = findRender(f.root.root),
          expected = graphemeBoundaries(text);
        let position = new TextPosition({ offset: 0 });
        for (const offset of expected.slice(1)) {
          position = render.getNextVisualPosition(position, 'right');
          assert.equal(position.offset, offset);
        }
        for (const offset of expected.slice(0, -1).reverse()) {
          position = render.getNextVisualPosition(position, 'left');
          assert.equal(position.offset, offset);
        }
      } finally {
        await f.close();
        controller.dispose();
      }
    }
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('alpha beta gamma delta');
    input(f);
    try {
      f.set(
        new Center(
          new SizedBox(
            80,
            90,
            new EditableText('field', controller, 'Wrap movement', undefined, 90, null, {
              maxLines: 3,
              textStyle: style,
            }),
          ),
        ),
      );
      const render = findRender(f.root.root),
        lines = render.textPainter._layoutLineMetrics();
      assert(lines.length > 1);
      assert.equal(lines[0].end, lines[1].start);
      const edge = lines[0].end,
        next = render.getNextVisualPosition(
          new TextPosition({ offset: edge, affinity: 'upstream' }),
          'right',
        );
      assert.equal(
        next.offset,
        edge + 1,
        'One right press enters the next painted grapheme rather than revisiting the same logical offset',
      );
      const before = render.getNextVisualPosition(
        new TextPosition({ offset: edge, affinity: 'downstream' }),
        'left',
      );
      assert.equal(before.offset, edge - 1);
    } finally {
      await f.close();
      controller.dispose();
    }
  },
);

test(
  'visual navigation retains grapheme stops for emoji, Arabic, nested bidi controls and obscured text',
  { timeout },
  async () => {
    for (const [text, obscureText] of [
      ['A👩‍🚀אבB', false],
      ['אב 12 cd', false],
      ['a\u2067אב\u2069z', false],
      ['لا abc', false],
      ['A👩‍🚀B', true],
    ]) {
      const f = await engineFixture({ fonts: true }),
        controller = new TextEditingController(text);
      input(f);
      try {
        f.set(
          new Center(
            new SizedBox(
              220,
              48,
              new EditableText('field', controller, 'Grapheme movement', undefined, 48, null, {
                textStyle: style,
                configuration: { obscureText },
              }),
            ),
          ),
        );
        const render = findRender(f.root.root),
          stops = graphemeBoundaries(text);
        let position = render.getPositionForOffset({ x: -100, y: 24 }),
          x = render.getLocalRectForCaret(position).x,
          finished = false;
        for (let press = 0; press < 24; press++) {
          const next = render.getNextVisualPosition(position, 'right');
          assert(
            stops.includes(next.offset),
            'Caret stays on an original UTF-16 grapheme boundary',
          );
          if (next.equals(position)) {
            finished = true;
            break;
          }
          const nextX = render.getLocalRectForCaret(next).x;
          assert(nextX >= x, 'Right cannot turn left inside a resolved bidi run');
          x = nextX;
          position = next;
        }
        assert(finished, 'Visual movement reaches its edge within the number of graphemes');
        const full = render.getBoxesForSelection(
            new TextSelection({ baseOffset: 0, extentOffset: text.length }),
          ),
          right = Math.max(...full.map((rect) => rect.right));
        assert(
          Math.abs(render.getLocalRectForCaret(position).right - right) <= 2,
          'The final caret reaches the actual painted right edge',
        );
      } finally {
        await f.close();
        controller.dispose();
      }
    }
  },
);

for (const platform of ['windows', 'macOS'])
  test(
    `${platform} word shortcuts skip Unicode punctuation/space and keep directed Shift ranges`,
    { timeout },
    async () => {
      FoundationPlatform.configure({ kind: 'web', operatingSystem: platform });
      const f = await engineFixture({ fonts: true }),
        controller = new TextEditingController('one,   two\r\nthree'),
        focus = new FocusNode();
      input(f);
      const modifier = platform === 'macOS' ? { alt: true } : { control: true },
        key = (name, extra = modifier) => {
          for (const kind of ['down', 'up'])
            f.root.key({
              kind,
              key: name,
              shift: false,
              control: false,
              alt: false,
              meta: false,
              repeat: false,
              ...extra,
            });
          f.frame();
        };
      try {
        f.set(editor(controller, focus));
        focus.requestFocus();
        await Promise.resolve();
        f.frame();
        controller.selection = { anchor: 0, focus: 0 };
        f.frame();
        for (const offset of [3, 10, 12, 17]) {
          key('ArrowRight');
          assert.deepEqual(controller.selection, { anchor: offset, focus: offset });
        }
        for (const offset of [12, 10, 7, 0]) {
          key('ArrowLeft');
          assert.deepEqual(controller.selection, { anchor: offset, focus: offset });
        }
        controller.selection = { anchor: 7, focus: 1 };
        f.frame();
        key('ArrowRight');
        assert.deepEqual(
          controller.selection,
          { anchor: 3, focus: 3 },
          'Word movement starts at the directed focus instead of first collapsing the selection',
        );
        controller.selection = { anchor: 10, focus: 10 };
        f.frame();
        key('ArrowLeft', { ...modifier, shift: true });
        assert.deepEqual(controller.selection, { anchor: 10, focus: 7 });
        key('ArrowLeft', { ...modifier, shift: true });
        assert.deepEqual(controller.selection, { anchor: 10, focus: 0 });
        if (platform === 'macOS') {
          controller.selection = { anchor: 5, focus: 3 };
          f.frame();
          key('ArrowRight', { alt: true, shift: true });
          assert.deepEqual(
            controller.selection,
            { anchor: 5, focus: 5 },
            'Option-Shift collapses at the original anchor before reversing',
          );
          key('ArrowRight', { alt: true, shift: true });
          assert.deepEqual(controller.selection, { anchor: 5, focus: 10 });
        }
        controller.selection = { anchor: 10, focus: 10 };
        f.frame();
        key('Backspace');
        assert.equal(controller.text, 'one,   \r\nthree');
        key('z', platform === 'macOS' ? { meta: true } : { control: true });
        assert.equal(controller.text, 'one,   two\r\nthree');
        controller.selection = { anchor: 3, focus: 3 };
        f.frame();
        key('Delete');
        assert.equal(
          controller.text,
          'one\r\nthree',
          'Forward word deletion includes punctuation/space and the next word',
        );
        controller.text = 'a\u0301 👩🏽‍💻 한글';
        controller.selection = { anchor: 0, focus: 0 };
        f.frame();
        key('ArrowRight');
        assert.equal(controller.selection.focus, 2, 'A combining sequence is one word stop');
        key('ArrowRight');
        assert.equal(controller.selection.focus, 10, 'A modified ZWJ emoji remains whole');
        key('ArrowRight');
        assert.equal(controller.selection.focus, 13);
        controller.selection = { anchor: 0, focus: 0 };
        f.frame();
        key('ArrowRight', { control: true, alt: true });
        assert.equal(
          controller.selection.focus,
          0,
          'AltGr-like chords do not match a text movement shortcut',
        );
      } finally {
        await f.close();
        controller.dispose();
        focus.dispose();
        FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
      }
    },
  );

test(
  'keyboard deletion expands partial UTF-16 ranges to whole original graphemes and remains undoable',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(''),
      focus = new FocusNode();
    input(f);
    const key = (name, extra = {}) => {
      for (const kind of ['down', 'up'])
        f.root.key({
          kind,
          key: name,
          shift: false,
          control: false,
          alt: false,
          meta: false,
          repeat: false,
          ...extra,
        });
      f.frame();
    };
    try {
      f.set(editor(controller, focus));
      focus.requestFocus();
      await Promise.resolve();
      f.frame();
      for (const [text, range, name, expected] of [
        ['Ae\u0301Z', { anchor: 2, focus: 3 }, 'Backspace', 'AZ'],
        ['A👨‍👩‍👧‍👦Z', { anchor: 4, focus: 4 }, 'Backspace', 'AZ'],
        ['A👨‍👩‍👧‍👦Z', { anchor: 4, focus: 4 }, 'Delete', 'AZ'],
        ['A👩🏽‍💻Z', { anchor: 6, focus: 3 }, 'Delete', 'AZ'],
      ]) {
        controller.replace(text, range);
        f.frame();
        key(name);
        assert.equal(controller.text, expected);
        assert.deepEqual(controller.selection, { anchor: 1, focus: 1 });
        key('z', { control: true });
        assert.equal(controller.text, text);
        assert.deepEqual(controller.selection, range);
      }
      controller.replace('one   two', { anchor: 9, focus: 9 });
      f.frame();
      f.set(editor(controller, focus, { configuration: { readOnly: true } }));
      key('Backspace', { control: true });
      assert.equal(controller.text, 'one   two');
      key('ArrowLeft', { control: true });
      assert.equal(controller.selection.focus, 6, 'Read-only fields still permit word navigation');
      f.set(editor(controller, focus, { maxLines: 1, configuration: { obscureText: true } }));
      controller.selection = { anchor: 4, focus: 4 };
      f.frame();
      key('ArrowLeft', { control: true });
      assert.equal(
        controller.selection.focus,
        0,
        'Password movement does not disclose word boundaries',
      );
      controller.selection = { anchor: 4, focus: 4 };
      f.frame();
      key('Delete', { control: true });
      assert.equal(controller.text, 'one ', 'Password word deletion uses the document edge');
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
    }
  },
);

test(
  'Mac command boundaries use the current painted line while document expansion preserves the original range',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'macOS' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('one\ntwo\nthree'),
      focus = new FocusNode(),
      submitted = [];
    input(f);
    const key = (name, extra = { meta: true }) => {
      for (const kind of ['down', 'up'])
        f.root.key({
          kind,
          key: name,
          shift: false,
          control: false,
          alt: false,
          meta: false,
          repeat: false,
          ...extra,
        });
      f.frame();
    };
    try {
      f.set(editor(controller, focus, { onSubmitted: (text) => submitted.push(text) }));
      focus.requestFocus();
      await Promise.resolve();
      f.frame();
      controller.selection = { anchor: 5, focus: 5 };
      f.frame();
      key('ArrowLeft');
      assert.deepEqual(controller.selection, { anchor: 4, focus: 4 });
      key('ArrowRight');
      assert.equal(controller.selection.focus, 7);
      key('ArrowUp');
      assert.equal(controller.selection.focus, 0);
      key('ArrowDown');
      assert.equal(controller.selection.focus, 13);
      controller.selection = { anchor: 5, focus: 5 };
      f.frame();
      key('ArrowLeft', { meta: true, shift: true });
      assert.deepEqual(controller.selection, { anchor: 5, focus: 4 });
      key('ArrowRight', { meta: true, shift: true });
      assert.deepEqual(
        controller.selection,
        { anchor: 7, focus: 4 },
        'Command-Shift expands both edges rather than shrinking the previous selection',
      );
      key('ArrowUp', { meta: true, shift: true });
      assert.deepEqual(controller.selection, { anchor: 7, focus: 0 });
      key('ArrowDown', { meta: true, shift: true });
      assert.deepEqual(controller.selection, { anchor: 0, focus: 13 });
      controller.selection = { anchor: 6, focus: 6 };
      f.frame();
      key('Backspace');
      assert.equal(
        controller.text,
        'one\no\nthree',
        'Command-Backspace deletes to the painted line start',
      );
      key('z');
      assert.equal(controller.text, 'one\ntwo\nthree');
      key('a', { control: true });
      assert.equal(controller.selection.focus, 4, 'Control-A is a Mac line shortcut');
      key('a');
      assert.deepEqual(controller.selection, { anchor: 0, focus: 13 });
      for (const [kind, repeat] of [
        ['down', false],
        ['down', true],
        ['up', false],
      ])
        f.root.key({
          kind,
          key: 'Enter',
          shift: false,
          control: false,
          alt: false,
          meta: true,
          repeat,
        });
      f.frame();
      assert.deepEqual(
        submitted,
        ['one\ntwo\nthree'],
        'Meta-Enter submits once without replacing the selection or inserting a newline',
      );
      assert.equal(controller.text, 'one\ntwo\nthree');
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
      FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    }
  },
);

test(
  'paired Android native/raw keys invoke canonical Core shortcuts with independent no-scan physical identities',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'android' });
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('one,   two'),
      focus = new FocusNode();
    input(f);
    let at = 0;
    const native = (
      kind,
      keyCode,
      key,
      { control = false, shift = false, plain = 0, codePoint = plain } = {},
    ) => {
      const metaState = (control ? 0x3000 : 0) | (shift ? 0x41 : 0),
        transport = {
          kind,
          key,
          character: kind === 'down' && codePoint ? String.fromCharCode(codePoint) : null,
          control,
          shift,
          alt: false,
          meta: false,
          repeat: false,
          timestamp: ++at,
          platform: 'android',
          android: { keyCode, scanCode: 0, deviceId: -1, source: 0x101, metaState, flags: 8 },
        };
      const handled = f.root.rawKey(
        {
          type: kind === 'down' ? 'keydown' : 'keyup',
          keymap: 'android',
          keyCode,
          scanCode: 0,
          deviceId: -1,
          source: 0x101,
          metaState,
          flags: 8,
          codePoint,
          plainCodePoint: plain,
          character: String.fromCharCode(codePoint),
          repeatCount: 0,
        },
        transport,
      );
      f.frame();
      return handled;
    };
    const chord = (keyCode, key, plain = 0, shift = false) => {
      native('down', 113, 'Control', { control: true });
      if (shift) native('down', 59, 'Shift', { control: true, shift: true });
      const handled = native('down', keyCode, key, {
        control: true,
        shift,
        plain,
        codePoint: plain ? plain & 0x1f : 0,
      });
      native('up', keyCode, key, { control: true, shift, plain });
      if (shift) native('up', 59, 'Shift', { control: true });
      native('up', 113, 'Control');
      return handled;
    };
    try {
      f.set(editor(controller, focus));
      focus.requestFocus();
      await Promise.resolve();
      f.frame();
      assert(chord(29, 'a', 97));
      assert.deepEqual(controller.selection, { anchor: 0, focus: 10 });
      assert(chord(122, 'Home'));
      assert.deepEqual(controller.selection, { anchor: 0, focus: 0 });
      assert(chord(22, 'ArrowRight'));
      assert.equal(controller.selection.focus, 3);
      assert(chord(22, 'ArrowRight', 0, true));
      assert.deepEqual(controller.selection, { anchor: 3, focus: 10 });
      native('down', 67, 'Backspace');
      native('up', 67, 'Backspace');
      assert.equal(controller.text, 'one');
      assert(chord(54, 'z', 122));
      assert.equal(controller.text, 'one,   two');
      assert.equal(f.root.buildOwner.keyboard.physicalKeysPressed.size, 0);
    } finally {
      await f.close();
      controller.dispose();
      focus.dispose();
      FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    }
  },
);
