// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], {
    cwd: resolve(import.meta.dirname, '../..'),
    timeout: 1_200_000,
  });
  process.exit(0);
}

import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { Element } from '@nelyx/core/framework/widgets/framework';
import { Column, SizedBox, SliverToBoxAdapter } from '@nelyx/core/framework/widgets/basic';
import { CustomScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { flattenSemantics } from '@nelyx/core/framework/semantics/semantics';
import {
  WidgetState,
  WidgetStateTextStyle,
  WidgetStateProperty,
} from '@nelyx/core/framework/widgets/widget-state';
import {
  captureSourceMouseCursor,
  sourceMouseCursorType,
} from '@nelyx/core/framework/widgets/widget-state-mouse-cursor';
import { nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { releaseSceneFrameSource } from '@nelyx/core/ui/frame';
import { freezeTextInput } from '@nelyx/core/ui/text';
import { Color } from '@nelyx/core/ui/color';
import { MaterialApp } from '@nelyx/material/app';
import { Material } from '@nelyx/material/material';
import { ButtonStyle } from '@nelyx/material/button-style';
import { ElevatedButton } from '@nelyx/material/elevated-button';
import { Slider } from '@nelyx/material/slider';
import { TextField } from '@nelyx/material/text-field';
import { InputDecoration } from '@nelyx/material/input-decoration';

FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
FlutterError.onError = (details) => {
  throw details.exception;
};
const metrics = {
  logicalWidth: 340,
  logicalHeight: 170,
  physicalWidth: 340,
  physicalHeight: 170,
  scale: 1,
  viewportGeneration: 1,
  rendererGeneration: 1,
  nativeContextGeneration: null,
  nativeSurfaceGeneration: null,
};
const fillColor = 0xffd1d31d;
const hoverColor = 0xffc91350;
const hovered = (states) => states.contains(WidgetState.hovered);

function textService(resources) {
  return {
    layout(raw) {
      const input = freezeTextInput(raw);
      const resource = resources.allocateId('test-paragraph');
      resources.register({ ...resource, kind: 'paragraph' }, () => {});
      const width = Math.min(
        Number.isFinite(input.maxWidth) ? input.maxWidth : Infinity,
        input.text.length * 7,
      );
      return {
        resource,
        input,
        indexUnit: 'utf16',
        width,
        height: 20,
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
            bounds: { x: 0, y: 0, width, height: 20 },
            height: 20,
          },
        ],
      };
    },
    hit: () => ({ position: 0, affinity: 'downstream' }),
    range: () => [],
    boxes: () => [],
    glyphAt: () => null,
  };
}

function fixture(custom = false) {
  const resources = new ResourceRegistry();
  const font = resources.allocateId('test-font');
  resources.register({ ...font, kind: 'font' }, () => {});
  const owner = { id: 'material-hover', generation: 1 };
  const scroll = new ScrollController();
  const editor = new TextEditingController('Retained text');
  const buttonHover = [];
  const builderHover = [];
  const sliderChanges = [];
  let taps = 0;
  let semantics = [];
  let time = 0;
  let sequence = 0;
  let status = 'open';
  const child = new Column(
    [
      new SizedBox(undefined, 80),
      new SizedBox(
        160,
        56,
        new ElevatedButton({
          id: 'hover-button',
          semanticsLabel: 'Hover button',
          child: new SizedBox(20, 10),
          onPressed: () => ++taps,
          onHover: (value) => buttonHover.push(value),
          style: custom
            ? new ButtonStyle({
                foregroundBuilder: (_context, states, child) => {
                  builderHover.push(hovered(states));
                  return new SizedBox(hovered(states) ? 40 : 20, 10, child);
                },
              })
            : null,
        }),
      ),
      new SizedBox(undefined, 44),
      new SizedBox(
        160,
        56,
        new Slider({
          id: 'hover-slider',
          value: 0.5,
          onChanged: (value) => sliderChanges.push(value),
          mouseCursor: custom
            ? WidgetStateProperty.resolveWith(nullableDartType(sourceMouseCursorType), (states) =>
                captureSourceMouseCursor(
                  hovered(states) ? SystemMouseCursors.text : SystemMouseCursors.click,
                ),
              )
            : null,
        }),
      ),
      new SizedBox(undefined, 44),
      new SizedBox(
        160,
        62,
        new TextField({
          id: 'hover-field',
          controller: editor,
          decoration: new InputDecoration({
            filled: true,
            fillColor: new Color(fillColor),
            hoverColor: new Color(hoverColor),
            labelText: 'Label',
            labelStyle: custom
              ? WidgetStateTextStyle.resolveWith(
                  (states) => new TextStyle({ fontSize: hovered(states) ? 24 : 14 }),
                )
              : null,
          }),
        }),
      ),
      new SizedBox(undefined, 180),
    ],
    { crossAlign: 'start', mainSize: 'min' },
  );
  const view = new FrameworkRoot(
    {
      owner,
      resources,
      assets: new Map(),
      defaultFont: font,
      text: textService(resources),
      clock: { now: () => time },
      paths: {
        contains(path, point) {
          // The test only crosses the middle of rounded or rectangular controls.
          const bounds = path.operations.find(
            ({ verb }) => verb === 'addRRect' || verb === 'addRect',
          );
          assert(bounds);
          const [left, top, right, bottom] = bounds.values;
          return point.x >= left && point.x < right && point.y >= top && point.y < bottom;
        },
      },
      editing: {
        capabilities: {
          indexUnit: 'utf16',
          composing: 'unavailable',
          selectionDirection: 'unavailable',
        },
        bind(_owner, initial) {
          let value = initial;
          return {
            read: () => value,
            replace(next) {
              value = next;
            },
            focus() {},
            blur() {},
            dispose() {},
          };
        },
        dispose() {},
      },
      semantics: {
        capability: 'native-controls',
        bind(nodes) {
          semantics = nodes;
          return {
            update(nodes) {
              semantics = nodes;
            },
            dispose() {},
          };
        },
        dispose() {},
      },
      readMetrics: () => metrics,
      readStatus: () => status,
      requestFrame() {},
      reportError(error) {
        throw error;
      },
    },
    {
      id: owner.id,
      createRoot: () =>
        new MaterialApp({
          home: new Material({
            child: new CustomScrollView({
              controller: scroll,
              primary: false,
              slivers: [new SliverToBoxAdapter({ child })],
            }),
          }),
        }),
    },
  );
  function frames(count) {
    let commands;
    for (let n = 0; n < count; n++) {
      time += 16;
      const scene = view.build({ token: { owner, sequence: ++sequence, metrics }, resources });
      try {
        if (n === count - 1) commands = [...(scene.commands ?? scene)];
      } finally {
        releaseSceneFrameSource(scene);
      }
    }
    return commands;
  }
  function find(predicate) {
    const pending = [view.root];
    while (pending.length) {
      const element = pending.pop();
      if (predicate(element.widget)) return element.widget;
      pending.push(...element.children);
    }
  }
  function jump(offset, count = 16) {
    scroll.jumpTo(offset);
    const commands = frames(count);
    assert.equal(scroll.position.pixels, offset);
    return commands;
  }
  function hover(x = 60, y = 46) {
    view.pointer({
      kind: 'hover',
      pointer: 1,
      device: 'mouse',
      x,
      y,
      buttons: 0,
      timestamp: time,
      viewportGeneration: 1,
    });
  }
  frames(4);
  hover();
  frames(4);
  return {
    view,
    frames,
    find,
    jump,
    hover,
    editor,
    buttonHover,
    builderHover,
    sliderChanges,
    node: (id) => flattenSemantics(semantics).find((node) => node.id === id),
    taps: () => taps,
    close() {
      status = 'closing';
      view.dispose();
      scroll.dispose();
      editor.dispose();
      resources.dispose();
    },
  };
}

function withoutBuilds(task) {
  const rebuilt = [];
  const rebuild = Element.prototype.rebuild;
  Element.prototype.rebuild = function (...args) {
    if (this.active && this.dirty) rebuilt.push(this.widget.constructor.name);
    return rebuild.apply(this, args);
  };
  try {
    const result = task();
    assert.deepEqual(rebuilt, [], 'Hover dirtied a Widget in the mounted scroll view');
    return result;
  } finally {
    Element.prototype.rebuild = rebuild;
  }
}

const stock = fixture();
try {
  const raised = withoutBuilds(() => stock.jump(60));
  assert(raised.some((op) => op.op === 'drawShadow' && op.elevation === 3));
  const lowered = withoutBuilds(() => stock.jump(105));
  assert(lowered.some((op) => op.op === 'drawShadow' && op.elevation === 1));
  assert.deepEqual(stock.buttonHover, [true, false]);
  stock.node('hover-button').activate();
  stock.frames(4);
  assert.equal(stock.taps(), 1);

  withoutBuilds(() => stock.jump(165));
  const overlay = withoutBuilds(() => {
    stock.hover(80, 43);
    return stock.frames(16);
  });
  assert(
    overlay.some(
      (op) => op.op === 'drawOval' && op.rect.width === 48 && op.paint.color >>> 24 === 20,
    ),
    'Expected the 8% overlay at full radius',
  );
  const slider = stock.node('hover-slider');
  assert.equal(slider.numericRange.value, 0.5);
  slider.rangeActions.setValue(0.8);
  stock.frames(4);
  assert.deepEqual(stock.sliderChanges, [0.8]);
  withoutBuilds(() => stock.jump(215));

  const editor = stock.find((widget) => widget instanceof EditableText);
  assert(editor);
  const hoverFill = withoutBuilds(() => stock.jump(270));
  assert(hoverFill.some((op) => op.op === 'drawPath' && op.paint.color === hoverColor));
  const normalFill = withoutBuilds(() => stock.jump(310));
  assert(normalFill.some((op) => op.op === 'drawPath' && op.paint.color === fillColor));
  assert.equal(
    stock.find((widget) => widget instanceof EditableText),
    editor,
  );
  assert.equal(stock.editor.text, 'Retained text');
} finally {
  stock.close();
}

const custom = fixture(true);
try {
  custom.jump(60);
  assert.equal(custom.builderHover.at(-1), true);
  custom.jump(105);
  assert.equal(custom.builderHover.at(-1), false);
  custom.jump(165);
  const mouse = custom.view.mouseTracker.states.get(1);
  assert([...mouse.annotations.keys()].some((target) => target.cursor.kind === 'text'));
  custom.jump(215);
  const editor = custom.find((widget) => widget instanceof EditableText);
  assert(editor);
  custom.jump(270);
  assert(
    custom.find((widget) => widget instanceof DefaultTextStyle && widget.style.fontSize === 24),
  );
  assert.equal(
    custom.find((widget) => widget instanceof EditableText),
    editor,
  );
  custom.jump(310);
  assert(
    !custom.find((widget) => widget instanceof DefaultTextStyle && widget.style.fontSize === 24),
  );
} finally {
  custom.close();
}

console.log('Material hover paint, retained controls, custom styles and semantics passed.');
