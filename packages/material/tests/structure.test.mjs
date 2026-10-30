// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as material from '@nelyx/material/widgets';
import * as cupertino from '@nelyx/cupertino/widgets';
import { Theme } from '@nelyx/material/theme';
import { ThemeData, VisualDensity, MaterialTapTargetSize } from '@nelyx/material/theme-data';
import { ColorScheme } from '@nelyx/material/color-scheme';
import { Widget } from '@nelyx/core/framework/widgets/framework';
import { Align, SizedBox, Builder } from '@nelyx/core/framework/widgets/basic';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { WidgetStatesController } from '@nelyx/core/framework/widgets/widget-state';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { fixture } from './root-fixture.mjs';
import {
  CupertinoUserInterfaceLevel,
  CupertinoUserInterfaceLevelData,
} from '@nelyx/cupertino/interface-level';
import { ScrollbarTheme, ScrollbarThemeData } from '@nelyx/material/scrollbar-theme';
import { TextTheme } from '@nelyx/material/text-theme';
import { DefaultAssetBundle } from '@nelyx/core/framework/widgets/default-asset-bundle';
import { CachingAssetBundle } from '@nelyx/core/services/asset-bundle';

const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
test(
  'canonical feature subpaths and aggregates expose one Core widget identity',
  { timeout },
  async () => {
    for (const [name, module] of [
      ['Scaffold', 'scaffold'],
      ['TextField', 'text-field'],
      ['AlertDialog', 'dialog'],
      ['FilledButton', 'filled-button'],
      ['TextButton', 'text-button'],
      ['OutlinedButton', 'outlined-button'],
      ['ElevatedButton', 'elevated-button'],
      ['ButtonStyleButton', 'button-style-button'],
      ['Radio', 'radio'],
      ['Switch', 'switch'],
    ]) {
      assert.equal(material[name], (await import('@nelyx/material/' + module))[name]);
      assert(Widget.prototype.isPrototypeOf(material[name].prototype));
    }
    for (const [name, module] of [
      ['CupertinoNavigationBar', 'nav-bar'],
      ['CupertinoPageScaffold', 'page-scaffold'],
      ['CupertinoTextField', 'text-field'],
      ['CupertinoAlertDialog', 'dialog'],
      ['CupertinoRadio', 'radio'],
      ['CupertinoSwitch', 'switch'],
    ]) {
      assert.equal(cupertino[name], (await import('@nelyx/cupertino/' + module))[name]);
      assert(Widget.prototype.isPrototypeOf(cupertino[name].prototype));
    }
    assert.equal(material.ThemeData, ThemeData);
    assert.equal(material.VisualDensity, VisualDensity);
    assert.equal(material.MaterialTapTargetSize, MaterialTapTargetSize);
    assert.equal(material.ColorScheme, ColorScheme);
    assert.equal(material.Icon, cupertino.Icon);
    for (const [family, name] of [
      ['chip', 'Chip'],
      ['divider', 'Divider'],
      ['icon-button', 'IconButton'],
      ['text-selection', 'TextSelection'],
      ['tooltip', 'Tooltip'],
      ['scrollbar', 'Scrollbar'],
    ]) {
      const component = await import('@nelyx/material/' + family + '-theme');
      const data = await import('@nelyx/material/' + family + '-theme-data');
      assert.equal(component[name + 'ThemeData'], data[name + 'ThemeData']);
    }
  },
);

test(
  'design editing widgets retain canonical borrowed controllers without owning their lifetime',
  { timeout },
  () => {
    const controller = new TextEditingController('before');
    const field = new material.TextField({ id: 'editor', controller });
    assert.equal(field.controller, controller);
    assert.equal(field.options.controller, controller);
    const editor = new cupertino.CupertinoTextField({
      id: 'editor',
      controller,
      placeholder: 'Label',
    });
    assert.equal(editor.controller, controller);
    controller.text = 'after';
    assert.equal(field.controller.text, 'after');
    assert.equal(editor.controller.text, 'after');
    controller.addListener(() => {});
    controller.dispose();
  },
);

test(
  'explicit inherited class tokens preserve nearest lookup, updates and missing-ancestor behavior',
  { timeout },
  () => {
    const f = fixture(),
      levels = [],
      scrollbar = [];
    const observe = new Builder((context) => {
      levels.push(CupertinoUserInterfaceLevel.maybeOf(context));
      scrollbar.push(ScrollbarTheme.of(context));
      return new SizedBox(1, 1);
    });
    const data = new ScrollbarThemeData({ crossAxisMargin: 3 });
    try {
      f.set(
        new Theme(
          new ThemeData({ platform: 'windows' }),
          new CupertinoUserInterfaceLevel({
            data: CupertinoUserInterfaceLevelData.base,
            child: new ScrollbarTheme({ data, child: observe }),
          }),
        ),
      );
      assert.equal(levels.at(-1), CupertinoUserInterfaceLevelData.base);
      assert.equal(scrollbar.at(-1), data);
      f.set(
        new Theme(
          new ThemeData({ platform: 'windows' }),
          new CupertinoUserInterfaceLevel({
            data: CupertinoUserInterfaceLevelData.elevated,
            child: observe,
          }),
        ),
      );
      assert.equal(levels.at(-1), CupertinoUserInterfaceLevelData.elevated);
      assert.notEqual(scrollbar.at(-1), data);
      f.set(new Theme(new ThemeData({ platform: 'windows' }), observe));
      assert.equal(levels.at(-1), null);
    } finally {
      f.close();
    }
  },
);

test(
  'value-only text themes share ambient defaults and subscribe to the nearest inherited scope',
  { timeout },
  () => {
    const f = fixture(),
      values = [];
    const observer = new Builder((context) => {
      values.push({
        theme: Theme.of(context),
        text: TextTheme.of(context),
        primary: TextTheme.primaryOf(context),
      });
      return new SizedBox(1, 1);
    });
    try {
      f.set(observer);
      assert(values.at(-1).text.equals(values.at(-1).theme.textTheme));
      assert(values.at(-1).primary.equals(values.at(-1).theme.primaryTextTheme));
      const first = new ThemeData({
        platform: 'windows',
        colorScheme: new ColorScheme({ onSurface: 0xff123456, onPrimary: 0xffabcdef }),
      });
      f.set(new Theme(first, observer));
      const firstLocalized = ThemeData.localize(first, first.typography.englishLike);
      assert.equal(values.at(-1).theme, firstLocalized);
      assert.equal(values.at(-1).text, firstLocalized.textTheme);
      assert.equal(values.at(-1).primary, firstLocalized.primaryTextTheme);
      const second = new ThemeData({
        platform: 'windows',
        colorScheme: first.colorScheme.copyWith({ onSurface: 0xff654321 }),
      });
      f.set(new Theme(second, observer));
      assert.equal(values.at(-1).theme, ThemeData.localize(second, second.typography.englishLike));
      assert.equal(values.at(-1).text.bodyMedium.color, 0xff654321);
      f.set(new SizedBox(1, 1));
    } finally {
      f.close();
    }
  },
);

test(
  'Chip and direct RawChip share one owner with actual CPU path hit/input and retirement',
  { timeout },
  async () => {
    const { RawChip } = await import('@nelyx/material/raw-chip');
    assert.equal(RawChip, material.RawChip);
    const { default: CanvasKitInit } = await import('canvaskit-wasm');
    const { createEnginePath } = await import('../../../Nelyx/skia/packages/web/dist/path.js');
    const wasmFile = path.join(
      path.dirname(createRequire(import.meta.url).resolve('canvaskit-wasm')),
      'canvaskit.wasm',
    );
    const ck = await CanvasKitInit({ wasmBinary: fs.readFileSync(wasmFile) });
    let queries = 0,
      livePaths = 0,
      assetReads = 0;
    const paths = {
      contains(snapshot, point) {
        const native = createEnginePath(ck, snapshot);
        livePaths++;
        queries++;
        try {
          return native.contains(point.x, point.y);
        } finally {
          native.delete();
          livePaths--;
        }
      },
    };
    class FileAssets extends CachingAssetBundle {
      async load(key) {
        assetReads++;
        const files = new Map([
          ['MaterialIcons.otf', 'packages/material/assets/MaterialIcons.otf'],
        ]);
        assert(files.has(key), 'Undeclared fixture asset');
        return fs.readFileSync(files.get(key));
      }
    }
    const bundle = new FileAssets();
    const f = fixture({ paths }),
      events = [];
    try {
      const wrap = (child) =>
        new DefaultAssetBundle(
          bundle,
          new MediaQuery(
            {
              width: 240,
              height: 160,
              scale: 1,
              textScale: 1,
              safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
              keyboardInset: 0,
            },
            new Theme(
              new ThemeData({ platform: 'windows' }),
              new Directionality('ltr', new Align(child)),
            ),
          ),
        );
      f.set(wrap(new RawChip({ label: new SizedBox(12, 8), onPressed: () => events.push('raw') })));
      const raw = f.root.nodes.find((node) => node.role === 'button' && node.enabled);
      assert(raw);
      f.tap(raw.id);
      assert.deepEqual(events, ['raw']);
      assert(queries > 0);
      assert.equal(livePaths, 0);
      assert.equal(assetReads, 0);
      f.set(wrap(new material.Chip({ label: new SizedBox(12, 8) })));
      assert(f.root.nodes.every((node) => !node.enabled || !node.activate));
      f.set(new SizedBox(1, 1));
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
      bundle.clear();
      assert.equal(livePaths, 0);
    }
  },
);

test(
  'moved Material control paints, dispatches once, disables stale callbacks and retires borrowed owners',
  { timeout },
  () => {
    const f = fixture(),
      focus = new FocusNode(),
      states = new WidgetStatesController(),
      changes = [];
    const theme = new ThemeData({ platform: 'windows' });
    const control = (onChanged) =>
      new Theme(
        theme,
        new Directionality(
          'rtl',
          new Align(
            new material.Switch({
              id: 'switch',
              value: false,
              onChanged,
              focusNode: focus,
              statesController: states,
            }),
          ),
        ),
      );
    try {
      const commands = f.set(control((value) => changes.push(value)));
      assert(
        commands.some((command) => ['drawRRect', 'drawPath', 'drawOval'].includes(command.op)),
        'Real Root must record control paint',
      );
      const stale = f.root.nodes.find((node) => node.id === 'switch').activate;
      f.tap('switch');
      assert.deepEqual(changes, [true]);
      f.advance(250);
      f.set(control(null));
      stale?.();
      f.tap('switch');
      assert.deepEqual(changes, [true]);
      assert.equal(f.root.nodes.find((node) => node.id === 'switch').enabled, false);
      f.set(new SizedBox(1, 1));
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
      focus.addListener(() => {});
      states.addListener(() => {});
    } finally {
      f.close();
      focus.dispose();
      states.dispose();
    }
  },
);

test('moved Cupertino control uses the same Root input lifecycle', { timeout }, () => {
  const f = fixture(),
    changes = [];
  try {
    const commands = f.set(
      new Directionality(
        'ltr',
        new MediaQuery(
          {
            width: 240,
            height: 160,
            scale: 1,
            textScale: 1,
            safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
            keyboardInset: 0,
          },
          new Align(
            new cupertino.CupertinoSwitch({
              id: 'cupertino-switch',
              value: false,
              onChanged: (value) => changes.push(value),
            }),
          ),
        ),
      ),
    );
    assert(commands.length > 1);
    f.tap('cupertino-switch');
    assert.deepEqual(changes, [true]);
    f.set(new SizedBox(1, 1));
    assert.equal(f.root.scheduler.transientCallbackCount, 0);
  } finally {
    f.close();
  }
});

test('split button owner preserves variants and input', { timeout }, async () => {
  const { engineFixture } = await import('./engine-fixture.mjs');
  const f = await engineFixture(),
    events = [];
  try {
    assert.equal(
      material.FilledButton.tonal({ child: new SizedBox(8, 8), onPressed() {} }).variant,
      'tonal',
    );
    for (const [Button, variant] of [
      [material.FilledButton, 'filled'],
      [material.TextButton, 'text'],
      [material.OutlinedButton, 'outlined'],
      [material.ElevatedButton, 'elevated'],
    ]) {
      const button = new Button({
        id: variant,
        child: new SizedBox(8, 8),
        onPressed: () => events.push(variant),
      });
      assert.equal(button.variant, variant);
      f.set(
        new Directionality(
          'ltr',
          new MediaQuery(
            {
              width: 240,
              height: 160,
              scale: 1,
              textScale: 1,
              safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
              keyboardInset: 0,
            },
            new Theme(new ThemeData({ platform: 'windows' }), new Align(button)),
          ),
        ),
      );
      f.tap(variant);
    }
    assert.deepEqual(events, ['filled', 'text', 'outlined', 'elevated']);
    f.set(new SizedBox(1, 1));
    assert.equal(f.root.scheduler.transientCallbackCount, 0);
  } finally {
    await f.close();
  }
});
