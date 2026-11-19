// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { execute } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { FrameDiagnostics, releaseSceneFrameSource } from '@nelyx/core/ui/frame';
import { freezeTextInput } from '@nelyx/core/ui/text';
import { Color } from '@nelyx/core/ui/color';
import { flattenSemantics } from '@nelyx/core/framework/semantics/semantics';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { Align, Row, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Hero } from '@nelyx/core/framework/widgets/heroes';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import {
  WidgetState,
  WidgetStateColor,
  WidgetStateMouseCursor,
} from '@nelyx/core/framework/widgets/widget-state';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { KeyDownEvent, KeyUpEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey, PhysicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { MaterialApp } from '@nelyx/material/app';
import { FloatingActionButton } from '@nelyx/material/floating-action-button';
import { FloatingActionButton as BarrelFab } from '@nelyx/material/widgets';
import {
  FloatingActionButtonTheme,
  FloatingActionButtonThemeData,
} from '@nelyx/material/floating-action-button-theme';
import { Material, MaterialType } from '@nelyx/material/material';
import { MaterialTapTargetSize, ThemeData } from '@nelyx/material/theme-data';
import { InkWell } from '@nelyx/material/ink-well';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
FlutterError.onError = ({ exception }) => {
  throw exception;
};
assert.equal(BarrelFab, FloatingActionButton);
const child = () => new SizedBox(16, 16);
const standIn = new Color(0xff123456),
  override = new Color(0xff654321);
const theme = new ThemeData({ materialTapTargetSize: MaterialTapTargetSize.padded });
const outerTheme = new FloatingActionButtonThemeData({
  backgroundColor: standIn,
  sizeConstraints: BoxConstraints.tightFor(60, 58),
  disabledElevation: 2,
  hoverElevation: 11,
  iconSize: 18,
});
const calls = [],
  focus = new FocusNode(),
  enabled = new ValueNotifier(true);
const owner = { id: 'fab-check', generation: 1 },
  resources = new ResourceRegistry();
const font = resources.allocateId('font');
resources.register({ ...font, kind: 'font' }, () => {});
let now = 0,
  sequence = 0,
  semantics = [];
const clock = { now: () => now },
  frameDiagnostics = new FrameDiagnostics(clock);
const metrics = {
  logicalWidth: 800,
  logicalHeight: 240,
  physicalWidth: 800,
  physicalHeight: 240,
  scale: 1,
  viewportGeneration: 1,
  rendererGeneration: 1,
  nativeContextGeneration: null,
  nativeSurfaceGeneration: null,
};
const view = new FrameworkRoot(
  {
    owner,
    resources,
    assets: new Map(),
    defaultFont: font,
    clock,
    paths: {
      contains(path, { x, y }) {
        const [
          {
            verb,
            values: [left, top, right, bottom, rx, ry],
          },
        ] = path.operations;
        assert.equal(verb, 'addRRect');
        if (x < left || y < top || x >= right || y >= bottom) return false;
        if (!rx || !ry) return true;
        const dx = Math.max(left + rx - x, 0, x - (right - rx));
        const dy = Math.max(top + ry - y, 0, y - (bottom - ry));
        return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
      },
    },
    text: {
      layout(raw) {
        const input = freezeTextInput(raw),
          width = Math.min(input.width, input.text.length * 7);
        const resource = resources.allocateId('paragraph');
        resources.register({ ...resource, kind: 'paragraph' }, () => {});
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
              height: 20,
              bounds: { x: 0, y: 0, width, height: 20 },
            },
          ],
        };
      },
      hit: () => ({ position: 0, affinity: 'downstream' }),
      range: () => [],
      boxes: () => [],
      glyphAt: () => null,
    },
    semantics: {
      capability: 'native-controls',
      bind(nodes) {
        semantics = nodes;
        return {
          update: (nodes) => {
            semantics = nodes;
          },
          dispose() {},
        };
      },
      dispose() {},
    },
    readMetrics: () => metrics,
    readStatus: () => 'open',
    requestFrame() {},
    reportError(error) {
      throw error;
    },
  },
  {
    id: owner.id,
    createRoot: () =>
      new MaterialApp({
        theme,
        home: new Material({
          child: new Align(
            new Row(
              [
                new FloatingActionButton({
                  child: child(),
                  tooltip: 'Regular FAB',
                  onPressed: () => calls.push('regular'),
                }),
                FloatingActionButton.small({
                  child: child(),
                  tooltip: 'Small FAB',
                  heroTag: null,
                  onPressed: () => calls.push('small'),
                }),
                FloatingActionButton.large({
                  child: child(),
                  tooltip: 'Large FAB',
                  heroTag: 'large',
                  onPressed: () => calls.push('large'),
                }),
                FloatingActionButton.extended({
                  icon: child(),
                  label: new Text('Create'),
                  heroTag: null,
                  onPressed: () => calls.push('extended'),
                }),
                FloatingActionButton.extended({
                  icon: child(),
                  label: new Text('Hidden'),
                  isExtended: false,
                  heroTag: null,
                  onPressed: null,
                }),
                new FloatingActionButtonTheme(
                  outerTheme,
                  new ListenableBuilder(
                    enabled,
                    () =>
                      new FloatingActionButton({
                        child: new Text('Dynamic'),
                        focusNode: focus,
                        focusElevation: 9,
                        highlightElevation: 13,
                        heroTag: null,
                        backgroundColor: override,
                        foregroundColor: WidgetStateColor.resolveWith((states) =>
                          states.contains(WidgetState.disabled) ? override : standIn,
                        ),
                        mouseCursor: WidgetStateMouseCursor.resolveWith((states) =>
                          states.contains(WidgetState.disabled)
                            ? SystemMouseCursors.basic
                            : states.contains(WidgetState.hovered)
                              ? SystemMouseCursors.text
                              : SystemMouseCursors.click,
                        ),
                        onPressed: enabled.value ? () => calls.push('dynamic') : null,
                      }),
                  ),
                ),
              ],
              { mainSize: 'min', spacing: 10 },
            ),
          ),
        }),
      }),
  },
);

function tick() {
  now += 16;
  releaseSceneFrameSource(
    view.build({ token: { owner, sequence: ++sequence, metrics }, resources, frameDiagnostics }),
  );
}
function descendants(element, Type) {
  const matches = [];
  function visit(node) {
    if (node.widget instanceof Type) matches.push(node);
    node.visitChildren(visit);
  }
  visit(element);
  return matches;
}
const buttons = () => descendants(view.root, FloatingActionButton);
const surface = (button) =>
  descendants(button, Material).find((node) => node.widget.type === MaterialType.button);
const ink = (button) => descendants(button, InkWell)[0].widget;
function size(element) {
  const { width, height } = element.findRenderObject().size;
  return [width, height];
}
function mouse(kind, element, dx) {
  const render = element.findRenderObject();
  const { x, y } = render.localToGlobal({
    x: dx ?? render.size.width / 2,
    y: render.size.height / 2,
  });
  view.pointer({
    kind,
    pointer: 1,
    device: 'mouse',
    x,
    y,
    buttons: kind === 'down' ? 1 : 0,
    timestamp: now,
    viewportGeneration: 1,
  });
}
function tap(element, dx) {
  mouse('down', element, dx);
  mouse('up', element, dx);
  tick();
}
function enter() {
  const options = {
    physicalKey: PhysicalKeyboardKey.enter,
    logicalKey: LogicalKeyboardKey.enter,
    timeStamp: now,
  };
  view.key(new KeyDownEvent(options));
  view.key(new KeyUpEvent(options));
  tick();
}

try {
  tick();
  tick();
  const [regular, small, large, extended, collapsed, dynamic] = buttons();
  assert.deepEqual(
    [regular, small, large, extended, collapsed, dynamic].map((button) => size(surface(button))),
    [
      [56, 56],
      [40, 40],
      [96, 96],
      [102, 56],
      [52, 56],
      [60, 58],
    ],
  );
  assert.deepEqual(size(small), [48, 48]);
  assert.deepEqual(
    [regular, small, large, extended].map(
      (button) => surface(button).widget.shape.borderRadius.topLeft.x,
    ),
    [16, 12, 28, 16],
  );
  assert.equal(surface(regular).widget.color.toARGB32(), theme.colorScheme.primaryContainer);
  assert.equal(surface(regular).widget.textStyle.color, theme.colorScheme.onPrimaryContainer);
  assert.equal(surface(dynamic).widget.color, override);
  assert.equal(surface(dynamic).widget.textStyle.color, standIn.toARGB32());
  assert.equal(descendants(large, IconTheme).at(-1).widget.data.size, 36);
  assert.equal(descendants(dynamic, IconTheme).at(-1).widget.data.size, 18);
  assert.equal(descendants(regular, Hero).length, 1);
  assert.equal(descendants(small, Hero).length, 0);
  assert.equal(descendants(large, Hero)[0].widget.options.tag, 'large');
  assert.equal(surface(collapsed).widget.elevation, 6);
  assert.equal(ink(collapsed).onTap, null);
  assert.equal(ink(collapsed).canRequestFocus, false);
  assert(!flattenSemantics(semantics).some((node) => node.name === 'Hidden'));
  assert(
    flattenSemantics(semantics).some((node) => node.name === 'Create' && node.role === 'button'),
    JSON.stringify(
      flattenSemantics(semantics).map(({ name, role, enabled }) => ({ name, role, enabled })),
    ),
  );
  tap(regular);
  tap(small, 1);
  tap(large);
  tap(extended);
  tap(collapsed);
  assert.deepEqual(calls, ['regular', 'small', 'large', 'extended']);

  focus.requestFocus();
  await Promise.resolve();
  tick();
  tick();
  assert(focus.hasFocus);
  assert.equal(surface(dynamic).widget.elevation, 9);
  enter();
  assert.deepEqual(calls.slice(4), ['dynamic']);
  await wait(120);
  mouse('hover', dynamic);
  tick();
  assert.equal(surface(dynamic).widget.elevation, 11);
  assert.equal(ink(dynamic).mouseCursor, SystemMouseCursors.text);
  mouse('down', dynamic);
  await wait(120);
  tick();
  assert.equal(surface(dynamic).widget.elevation, 13);
  enabled.value = false;
  tick();
  tick();
  assert.equal(surface(dynamic).widget.elevation, 2);
  assert.equal(surface(dynamic).widget.textStyle.color, override.toARGB32());
  assert.equal(ink(dynamic).mouseCursor, SystemMouseCursors.basic);
  mouse('up', dynamic);
  tick();
  enter();
  tap(dynamic);
  assert.deepEqual(calls.slice(4), ['dynamic']);
  assert(
    flattenSemantics(semantics).some(
      (node) => node.name === 'Dynamic' && node.role === 'button' && !node.enabled,
    ),
  );
  enabled.value = true;
  tick();
  tap(dynamic);
  assert.deepEqual(calls.slice(4), ['dynamic', 'dynamic']);
} finally {
  view.dispose();
  enabled.dispose();
  focus.dispose();
  resources.dispose();
}
console.log('FloatingActionButton variants, theme, pointer, keyboard and disabled behavior passed');
