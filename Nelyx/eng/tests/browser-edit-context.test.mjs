// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { TextSelection } from '@nelyx/core/services/text-editing';
import { SelectionChangedCause } from '@nelyx/core/services/text-input';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { Transform } from '@nelyx/core/framework/widgets/basic';
import { RenderTransform } from '@nelyx/core/framework/rendering/boxes';
import { engineFixture } from '../../../packages/material/tests/engine-fixture.mjs';
import { createBrowserEditContext } from '../../sdk/dist/backends/browser/edit-context.js';
const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });

// Controlled OS/DOM IO for adapter admission; all layout/glyph/state work uses
// the actual Core/CanvasKit. Real Chrome/IME behavior is checked separately.
function controlledBrowser() {
  const keys = ['document', 'window', 'EditContext', 'DOMRect'],
    saved = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let context;
  class ClientRect {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      Object.assign(this, { x, y, width, height });
    }
  }
  const window = new EventTarget();
  window.visualViewport = new EventTarget();
  const document = {
    activeElement: null,
    createElement() {
      const element = new EventTarget();
      element.style = {};
      element.dataset = {};
      element.setAttribute = () => {};
      element.focus = () => {
        document.activeElement = element;
        element.dispatchEvent(new Event('focus'));
      };
      element.blur = () => {
        if (document.activeElement === element) document.activeElement = null;
        element.dispatchEvent(new Event('blur'));
      };
      return element;
    },
  };
  class EditContext extends EventTarget {
    constructor(options) {
      super();
      this.text = options.text;
      this.selectionStart = options.selectionStart;
      this.selectionEnd = options.selectionEnd;
      this.updates = 0;
      this.characters = [];
      context = this;
    }
    updateText(start, end, text) {
      this.text = this.text.slice(0, start) + text + this.text.slice(end);
    }
    updateSelection(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    }
    updateControlBounds(rect) {
      this.control = rect;
      this.updates++;
    }
    updateSelectionBounds(rect) {
      this.selection = rect;
    }
    updateCharacterBounds(start, rects) {
      this.rangeStart = start;
      this.characters = rects;
    }
  }
  Object.assign(globalThis, { window, document, DOMRect: ClientRect, EditContext });
  return {
    window,
    get context() {
      return context;
    },
    rect: (...args) => new ClientRect(...args),
    restore() {
      for (const key of keys) {
        const descriptor = saved.get(key);
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}

test(
  'EditContext fences new input and glyph requests after View admission stops, while an admitted cancellation completes',
  { timeout },
  async () => {
    for (const status of ['failed', 'closing']) {
      const f = await engineFixture({ fonts: true }),
        browser = controlledBrowser(),
        controller = new TextEditingController('before');
      let port,
        queries = 0,
        state = 'open';
      f.root.context.readStatus = () => state;
      f.root.context.editing = {
        capabilities: { indexUnit: 'utf16', composing: 'observed', selectionDirection: 'observed' },
        bind(owner, initial, changed, options) {
          const query = options.readCharacterBounds;
          port = createBrowserEditContext({
            owner,
            initial,
            changed,
            options: {
              ...options,
              readCharacterBounds(...args) {
                queries++;
                return query(...args);
              },
            },
            viewport: () => ({
              bounds: browser.rect(0, 0, 240, 160),
              width: 240,
              height: 160,
              generation: 1,
            }),
            moving: () => false,
          });
          return port.binding;
        },
      };
      try {
        f.set(new EditableText('field', controller, 'View lifetime'));
        const native = browser.context;
        state = status;
        native.text = 'late';
        native.selectionStart = 4;
        native.selectionEnd = 4;
        native.dispatchEvent(new Event('textupdate'));
        assert.equal(controller.text, 'before');
        assert.equal(
          port.binding.read().text,
          'before',
          'Rejected OS input cannot enter the transport document',
        );
        const before = queries,
          request = new Event('characterboundsupdate');
        Object.defineProperties(request, { rangeStart: { value: 0 }, rangeEnd: { value: 1 } });
        native.dispatchEvent(request);
        assert.equal(queries, before, 'An inactive View cannot start a glyph query');
        assert.equal(native.control.width, 0);
      } finally {
        await f.close();
        controller.dispose();
        browser.restore();
      }
    }
    const f = await engineFixture({ fonts: true }),
      browser = controlledBrowser(),
      controller = new TextEditingController('before');
    let port,
      state = 'open';
    f.root.context.readStatus = () => state;
    f.root.context.editing = {
      capabilities: { indexUnit: 'utf16', composing: 'observed', selectionDirection: 'observed' },
      bind(owner, initial, changed, options) {
        port = createBrowserEditContext({
          owner,
          initial,
          changed,
          options,
          viewport: () => ({
            bounds: browser.rect(0, 0, 240, 160),
            width: 240,
            height: 160,
            generation: 1,
          }),
          moving: () => false,
        });
        return port.binding;
      },
    };
    try {
      f.set(new EditableText('field', controller, 'Cancellation receipt'));
      const native = browser.context;
      port.binding.focus();
      native.text = '한';
      native.selectionStart = 1;
      native.selectionEnd = 1;
      native.dispatchEvent(new Event('compositionstart'));
      controller.replace('Core', { anchor: 4, focus: 4 });
      assert.equal(controller.text, '한');
      assert.equal(controller.isComposing, true);
      state = 'closing';
      native.dispatchEvent(new Event('compositionend'));
      await Promise.resolve();
      assert.equal(native.text, 'Core');
      assert.equal(controller.text, 'Core');
      assert.equal(controller.isComposing, false);
      assert.equal(
        document.activeElement,
        null,
        'Completion cannot restore input focus after View admission stopped',
      );
    } finally {
      await f.close();
      controller.dispose();
      browser.restore();
    }
  },
);

test(
  'the controlled EditContext port withdraws stale Core coordinates and wakes after a paint-only frame',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      browser = controlledBrowser(),
      controller = new TextEditingController('engine');
    let port;
    const viewport = () => ({
      bounds: browser.rect(10, 20, 240, 160),
      width: 240,
      height: 160,
      generation: 1,
    });
    f.root.context.editing = {
      capabilities: { indexUnit: 'utf16', composing: 'observed', selectionDirection: 'observed' },
      bind(owner, initial, changed, options) {
        port = createBrowserEditContext({
          owner,
          initial,
          changed,
          options,
          viewport,
          moving: () => false,
        });
        return port.binding;
      },
    };
    try {
      f.set(
        new Transform(new EditableText('editor', controller, 'Core geometry'), [1, 0, 0, 1, 0, 0]),
      );
      let ancestor;
      const visit = (element) => {
        if (element.renderObject instanceof RenderTransform) ancestor = element.renderObject;
        element.visitChildren(visit);
      };
      visit(f.root.root);
      assert(ancestor);
      const native = browser.context,
        initial = f.root.nodes.find((node) => node.id === 'editor').textInputGeometry;
      assert.equal(native.selection.x, initial.caret.x + 10);
      assert.equal(native.selection.y, initial.caret.y + 20);
      assert(native.control.width > 0);
      const updates = native.updates;
      f.frame();
      assert.equal(native.updates, updates, 'An unchanged frame need not republish OS rectangles');
      ancestor.matrix = [1, 0, 0, 1, 15, 7];
      browser.window.dispatchEvent(new Event('scroll'));
      assert.equal(native.control.width, 0);
      assert.equal(native.selection.height, 0);
      assert.deepEqual(native.characters, []);
      f.frame();
      const moved = f.root.nodes.find((node) => node.id === 'editor').textInputGeometry;
      assert(moved.layoutEpoch > initial.layoutEpoch);
      assert.equal(native.selection.x, moved.caret.x + 10);
      const request = new Event('characterboundsupdate');
      Object.defineProperties(request, {
        rangeStart: { value: 0 },
        rangeEnd: { value: controller.text.length },
      });
      native.dispatchEvent(request);
      assert.equal(native.characters.length, controller.text.length);
      assert(native.characters.every((rect) => rect.width > 0));
      ancestor.matrix = [1, 0, 0, 1, 20, 7];
      browser.window.dispatchEvent(new Event('scroll'));
      assert.equal(native.control.width, 0);
      ancestor.matrix = [1, 0, 0, 1, 15, 7];
      f.frame();
      assert.equal(
        native.selection.x,
        moved.caret.x + 10,
        'A frame with the original coordinates restores withdrawn OS bounds',
      );
      port.binding.updateGeometry(initial);
      assert.equal(native.control.width, 0, 'An older epoch cannot replace current Core geometry');
      port.binding.updateGeometry(
        f.root.nodes.find((node) => node.id === 'editor').textInputGeometry,
      );
      assert(native.control.width > 0);
      controller.text = 'replacement';
      assert.equal(
        native.control.width,
        0,
        'An acknowledged OS replacement waits for the current Core recording',
      );
      f.frame();
      assert.equal(native.text, controller.text);
      assert(native.control.width > 0);
      port.binding.updateGeometry(null);
      assert.equal(native.control.width, 0);
      assert.equal(native.selection.width, 0);
      assert.deepEqual(native.characters, []);
      assert.throws(
        () =>
          port.binding.updateGeometry({
            ...f.root.nodes.find((node) => node.id === 'editor').textInputGeometry,
            owner: { id: 'foreign', generation: 1 },
          }),
        /Foreign EditContext geometry/,
      );
      f.set(new (await import('@nelyx/core/framework/widgets/basic')).SizedBox());
      browser.window.dispatchEvent(new Event('scroll'));
    } finally {
      try {
        await f.close();
      } finally {
        try {
          controller.dispose();
        } finally {
          browser.restore();
        }
      }
    }
  },
);

test(
  'the EditContext port changes only selection while its real composition state remains active',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      browser = controlledBrowser(),
      controller = new TextEditingController('before'),
      key = new GlobalKey('active EditContext');
    let port;
    f.root.context.editing = {
      capabilities: { indexUnit: 'utf16', composing: 'observed', selectionDirection: 'observed' },
      bind(owner, initial, changed, options) {
        port = createBrowserEditContext({
          owner,
          initial,
          changed,
          options,
          viewport: () => ({
            bounds: browser.rect(0, 0, 240, 160),
            width: 240,
            height: 160,
            generation: 1,
          }),
          moving: () => false,
        });
        return port.binding;
      },
    };
    try {
      f.set(new EditableText('field', controller, 'Composition', undefined, 48, key));
      const native = browser.context;
      native.text = '한A';
      native.selectionStart = 1;
      native.selectionEnd = 1;
      native.dispatchEvent(new Event('compositionstart'));
      const update = new Event('textupdate');
      Object.defineProperties(update, {
        updateRangeStart: { value: 0 },
        updateRangeEnd: { value: 0 },
        text: { value: '한' },
      });
      native.dispatchEvent(update);
      f.frame();
      assert.equal(controller.isComposing, true);
      const text = native.text;
      key.currentState.userUpdateTextEditingValue(
        key.currentState.textEditingValue.copyWith({
          selection: new TextSelection({ baseOffset: 1, extentOffset: 0 }),
        }),
        SelectionChangedCause.drag,
      );
      assert.equal(native.text, text);
      assert.equal(native.selectionStart, 1);
      assert.equal(native.selectionEnd, 0);
      assert.equal(controller.isComposing, true);
      assert.equal(port.composing, true);
      assert.deepEqual(controller.composing, { status: 'active', start: 0, end: 1 });
      native.dispatchEvent(new Event('compositionend'));
      assert.equal(
        controller.isComposing,
        false,
        'Only the native end event completes the observed composition',
      );
    } finally {
      await f.close();
      controller.dispose();
      browser.restore();
    }
  },
);
