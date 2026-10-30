// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Radio } from '@nelyx/material/radio';
import { Theme } from '@nelyx/material/theme';
import { ThemeData } from '@nelyx/material/theme-data';
import { CupertinoRadio } from '@nelyx/cupertino/radio';
import { CupertinoTheme, CupertinoThemeData } from '@nelyx/cupertino/theme';
import { RadioGroup, RadioGroupRegistry } from '@nelyx/core/framework/widgets/radio-group';
import { Align, SizedBox, Builder, Row } from '@nelyx/core/framework/widgets/basic';
import { Directionality, Localizations } from '@nelyx/core/framework/widgets/app-data';
import { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { CupertinoRadioPainter } from '../../cupertino/dist/internal/radio/radio-painter.js';
import { resolveCupertinoRadio } from '../../cupertino/dist/internal/radio/radio-build.js';
import { RadioPainter } from '../dist/internal/radio/radio-painter.js';
import { fixture } from './root-fixture.mjs';
import { WebSkiaLibrary } from '@nelyx/skia-web/library';

const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
function values(f, options = {}, states = emptyWidgetStateSet(), brightness = 'light') {
  let result;
  f.set(
    new CupertinoTheme(
      new CupertinoThemeData({ brightness, primaryColor: 0xffaabbcc }),
      new Builder((context) => {
        result = resolveCupertinoRadio(
          new CupertinoRadio({ value: 1, ...options }),
          context,
          states,
        );
        return new SizedBox(1, 1);
      }),
    ),
  );
  return result;
}
function elements(f, predicate) {
  const result = [],
    visit = (element) => {
      if (predicate(element)) result.push(element);
      element.visitChildren(visit);
    };
  visit(f.root.root);
  return result;
}
class Registry extends RadioGroupRegistry {
  groupValue = 1;
  clients = new Set();
  changes = [];
  onChanged = (value) => this.changes.push(value);
  registerClient(client) {
    this.clients.add(client);
  }
  unregisterClient(client) {
    this.clients.delete(client);
  }
}

test(
  'CupertinoRadio independent light/dark/disabled/default/focus/color policy matches the pinned decisions',
  { timeout },
  () => {
    const f = fixture(),
      states = emptyWidgetStateSet();
    try {
      let p = values(f, {}, states);
      assert.equal(
        p.activeColor.toARGB32(),
        0xff007aff,
        'Default radio blue is independent of theme primaryColor',
      );
      assert.equal(p.inactiveColor.toARGB32(), 0xffffffff);
      assert.equal(p.fillColor.toARGB32(), 0xffffffff);
      assert.equal(p.borderColor.toARGB32(), 0xffd1d1d6);
      assert.equal(p.focusColor.toARGB32(), 0xcc6eadf2); // H=211.294..., S=.835, L=.69, alpha=.8.
      states.add(WidgetState.selected);
      p = values(f, {}, states, 'dark');
      assert.equal(p.activeColor.toARGB32(), 0xff3264d7);
      assert.equal(p.fillColor.toARGB32(), 0xffdee8f8);
      assert.equal(p.borderColor.toARGB32(), 0);
      states.add(WidgetState.disabled);
      p = values(f, { activeColor: new Color(0xff123456) }, states, 'dark');
      assert.equal(p.activeColor.toARGB32(), 0x80ffffff);
      assert.equal(p.fillColor.toARGB32(), 0x40ffffff);
      assert.equal(p.borderColor.toARGB32(), 0x40000000);
      p = values(f, {}, states, 'light');
      assert.equal(p.fillColor.toARGB32(), 0x40000000);
      p = values(f, { fillColor: 0xff010203, focusColor: 0xff040506 }, states, 'dark');
      assert.equal(p.fillColor.toARGB32(), 0xff010203);
      assert.equal(p.focusColor.toARGB32(), 0xff040506);
      assert.deepEqual([...states], [WidgetState.selected, WidgetState.disabled]);
      assert.equal(new CupertinoRadio({ value: 1 }).useCheckmarkStyle, false);
      assert.throws(
        () => new CupertinoRadio({ value: 1, fillColor: { resolve() {} } }),
        /Core Color/,
      );
      assert.throws(() => new CupertinoRadio({ value: 1, onChanged() {} }), /typed RadioGroup/);
    } finally {
      f.close();
    }
  },
);

test(
  'CupertinoRadio paints exact source circles, checkmark paths, dark gradient and focus outline',
  { timeout },
  () => {
    const f = fixture(),
      states = emptyWidgetStateSet();
    states.add(WidgetState.selected);
    try {
      const calls = [],
        canvas = {
          drawCircle(center, radius, paint) {
            calls.push({ op: 'circle', center, radius, paint: paint.snapshot() });
          },
          drawPath(path, paint) {
            calls.push({ op: 'path', path: path.snapshot(), paint: paint.snapshot() });
          },
        };
      const p = values(f, {}, states);
      new CupertinoRadioPainter({
        ...p,
        selected: true,
        checkmarkStyle: false,
        downPosition: null,
        isFocused: false,
      }).paint(canvas, { width: 18, height: 18 });
      assert.deepEqual(
        calls.map((c) => c.radius),
        [7, 2.975],
      );
      calls.length = 0;
      new CupertinoRadioPainter({
        ...p,
        selected: true,
        checkmarkStyle: true,
        downPosition: null,
        isFocused: true,
      }).paint(canvas, { width: 18, height: 18 });
      assert.deepEqual(
        calls.map((c) => c.op),
        ['path', 'path', 'circle'],
      );
      assert.equal(calls[0].paint.strokeWidth, 2);
      assert.equal(calls[0].paint.strokeCap, 'round');
      assert.deepEqual(
        calls[0].path.operations.map((p) => p.verb),
        ['moveTo', 'lineTo'],
      );
      assert.deepEqual(
        calls[1].path.operations.map((p) => p.verb),
        ['moveTo', 'lineTo', 'moveTo', 'lineTo'],
      );
      assert.equal(calls[2].radius, 8.5);
      assert.equal(calls[2].paint.strokeWidth, 3);
      calls.length = 0;
      states.add(WidgetState.disabled);
      new CupertinoRadioPainter({
        ...values(f, {}, states, 'dark'),
        selected: true,
        checkmarkStyle: false,
        downPosition: new Offset(1, 1),
        isFocused: false,
      }).paint(canvas, { width: 18, height: 18 });
      assert.equal(calls[0].op, 'path');
      assert.equal(calls[0].paint.shader.kind, 'linear');
      assert.deepEqual(calls[0].paint.shader.colors, [0x14ffffff, 0x24ffffff]);
      assert.equal(calls[1].paint.color, 0x26ffffff);
      assert.equal(calls.at(-1).paint.strokeWidth, Math.fround(0.3)); // Paint snapshots use SkScalar storage.
    } finally {
      f.close();
    }
  },
);

test(
  'Radio.adaptive follows Theme.platform across all source platforms and ignores Material paint policy on Cupertino',
  { timeout },
  () => {
    const f = fixture(),
      registry = new Registry(),
      key = new GlobalKey('adaptive-radio');
    const fillColor = {
      resolve() {
        throw Error('Material fillColor must not resolve on a Cupertino path');
      },
    };
    const radio = Radio.adaptive({
      key,
      value: 1,
      id: 'adaptive',
      groupRegistry: registry,
      activeColor: new Color(0xff112233),
      focusColor: new Color(0xff445566),
      fillColor,
      useCupertinoCheckmarkStyle: true,
    });
    try {
      assert.equal(radio.useCupertinoCheckmarkStyle, true);
      for (const platform of ['iOS', 'macOS']) {
        f.set(new Theme(new ThemeData({ platform }), new Directionality('ltr', new Align(radio))));
        const painters = elements(f, (e) => e.widget.painter instanceof CupertinoRadioPainter);
        assert.equal(painters.length, 1);
        assert.equal(painters[0].widget.painter.options.checkmarkStyle, true);
        assert.equal(painters[0].widget.painter.options.activeColor.toARGB32(), 0xff112233);
        assert.equal(painters[0].widget.painter.options.focusColor.toARGB32(), 0xff445566);
        assert.equal(f.root.nodes.find((n) => n.id === 'adaptive').bounds.width, 18);
      }
      for (const platform of ['android', 'fuchsia', 'linux', 'windows']) {
        f.set(
          new Theme(
            new ThemeData({ platform }),
            new Directionality(
              'ltr',
              new Align(
                Radio.adaptive({
                  key,
                  value: 1,
                  id: 'adaptive',
                  groupRegistry: registry,
                  useCupertinoCheckmarkStyle: true,
                }),
              ),
            ),
          ),
        );
        assert.equal(elements(f, (e) => e.widget.painter instanceof RadioPainter).length, 1);
        assert.equal(
          f.root.nodes.find((n) => n.id === 'adaptive').bounds.width,
          ['android', 'fuchsia'].includes(platform) ? 48 : 32,
        );
      }
      assert.equal(new Radio({ value: 1 }).useCupertinoCheckmarkStyle, false);
      f.set(new SizedBox(1, 1));
      assert.equal(registry.clients.size, 0);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
    }
  },
);

test(
  'adaptive platform replacement retains the outer State and internal focus owner, and disposes retired input',
  { timeout },
  async () => {
    const f = fixture(),
      registry = new Registry(),
      key = new GlobalKey('focus-owner');
    const wrap = (platform) =>
      new Theme(
        new ThemeData({ platform }),
        new Directionality(
          'ltr',
          new Align(Radio.adaptive({ key, value: 1, id: 'owner', groupRegistry: registry })),
        ),
      );
    try {
      f.set(wrap('windows'));
      const state = key.currentState,
        focus = [...registry.clients][0].focusNode;
      focus.requestFocus();
      await Promise.resolve();
      f.frame();
      assert(focus.hasFocus);
      f.set(wrap('iOS'));
      await Promise.resolve();
      f.frame();
      assert(focus.hasFocus);
      assert.equal(key.currentState, state);
      assert.equal([...registry.clients][0].focusNode, focus);
      assert.equal(registry.clients.size, 1);
      assert.equal(elements(f, (e) => e.widget instanceof ControlInteraction).length, 1);
      f.set(wrap('windows'));
      assert.equal([...registry.clients][0].focusNode, focus);
      f.set(new SizedBox(1, 1));
      assert.equal(registry.clients.size, 0);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
      assert.throws(() => focus.addListener(() => {}), /dispose/i);
    } finally {
      f.close();
    }
  },
);

test(
  'Cupertino circle/checkmark actual Root dispatch remains controlled, disables stale callbacks and borrows caller focus',
  { timeout },
  () => {
    const f = fixture(),
      registry = new Registry(),
      focus = new FocusNode(),
      key = new GlobalKey('cupertino-state');
    const wrap = (checkmarkStyle, enabled) =>
      new Directionality(
        'rtl',
        new Align(
          new CupertinoRadio({
            key,
            value: 1,
            id: 'cupertino',
            groupRegistry: registry,
            toggleable: true,
            useCheckmarkStyle: checkmarkStyle,
            enabled,
            focusNode: focus,
          }),
        ),
      );
    try {
      const commands = f.set(wrap(true, true));
      assert(commands.some((c) => c.op === 'drawPath'));
      const state = key.currentState;
      assert(state);
      const stale = f.root.nodes.find((n) => n.id === 'cupertino').activate;
      f.tap('cupertino');
      assert.deepEqual(registry.changes, [null]);
      registry.groupValue = 2;
      f.set(wrap(false, true));
      assert.equal(key.currentState, state);
      f.tap('cupertino');
      assert.deepEqual(registry.changes, [null, 1]);
      f.set(wrap(true, false));
      stale?.();
      f.tap('cupertino');
      assert.deepEqual(registry.changes, [null, 1]);
      f.set(new SizedBox(1, 1));
      stale?.();
      assert.equal(registry.clients.size, 0);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
      focus.addListener(() => {});
    } finally {
      f.close();
      focus.dispose();
    }
  },
);

test(
  'actual Root commands replay through production Web Skia paint/path/shader code on a real CanvasKit CPU surface',
  { timeout },
  async () => {
    const require = createRequire(import.meta.url),
      CanvasKitInit = require('canvaskit-wasm');
    const wasm = require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm');
    const ck = await CanvasKitInit({ wasmBinary: fs.readFileSync(wasm) }),
      f = fixture(),
      registry = new Registry();
    // No host is bound and bind/submit are never called. This tests the actual replay method on CPU,
    // separately from WebGL admission/retirement and platform/physical qualification.
    const library = new WebSkiaLibrary(ck, null, f.root.context.owner),
      surface = ck.MakeSurface(240, 160);
    assert(surface);
    const canvas = surface.getCanvas();
    const render = (name, checkmarkStyle, disabled, dark) => {
      const commands = f.set(
        new CupertinoTheme(
          new CupertinoThemeData({ brightness: dark ? 'dark' : 'light' }),
          new Directionality(
            'ltr',
            new Align(
              new CupertinoRadio({
                id: 'pixel',
                value: 1,
                groupRegistry: registry,
                useCheckmarkStyle: checkmarkStyle,
                enabled: !disabled,
              }),
            ),
          ),
        ),
      );
      canvas.clear(ck.Color(0, 0, 0, 1));
      library.replay(canvas, { commands });
      surface.flush();
      const image = surface.makeImageSnapshot();
      try {
        const pixels = image.readPixels(0, 0, {
          width: 240,
          height: 160,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB,
        });
        assert(pixels);
        const sample = (x, y) => {
          const i = (y * 240 + x) * 4;
          return (
            ((pixels[i + 3] << 24) | (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]) >>> 0
          );
        };
        return sample;
      } finally {
        image.delete();
      }
    };
    try {
      let sample = render('circle', false, false, false);
      assert.equal(sample(120, 80), 0xffffffff);
      assert.equal(sample(125, 80), 0xff007aff);
      sample = render('checkmark', true, false, false);
      assert.equal(sample(120, 74), sample(10, 10), 'Checkmark has no circular fill');
      assert.notEqual(sample(119, 83), sample(10, 10), 'Checkmark source path is rasterized');
      sample = render('disabled-dark', false, true, true);
      assert.equal(sample(10, 10), 0xff101827, 'Actual Root background supplied to replay');
      const center = sample(120, 80),
        expected = [96, 101, 111];
      // At y=80.5 the 20..36 alpha gradient is followed by the 64-alpha inner fill.
      // Allow one channel unit for Skia's premultiplied interpolation quantization.
      [(center >>> 16) & 255, (center >>> 8) & 255, center & 255].forEach((value, i) =>
        assert(Math.abs(value - expected[i]) <= 1),
      );
      assert(
        (sample(124, 83) & 255) > (sample(124, 76) & 255),
        'Real linear gradient brightens toward the bottom',
      );
    } finally {
      surface.delete();
      f.close();
      await library.dispose();
    }
  },
);

test(
  'actual radio semantics follows Foundation platform and localized unselected hints independently from Theme.platform',
  { timeout },
  () => {
    const f = fixture(),
      registry = new Registry();
    registry.groupValue = 2;
    const wrap = (locale, custom = {}) =>
      new Localizations(
        locale,
        custom,
        'en',
        new Directionality(
          'ltr',
          new Theme(
            new ThemeData({ platform: 'windows' }),
            new Align(new Radio({ value: 1, groupRegistry: registry, id: 'localized' })),
          ),
        ),
      );
    const sourceSemantics = () =>
      elements(
        f,
        (e) =>
          e.widget instanceof Semantics && e.widget.properties.inMutuallyExclusiveGroup === true,
      )[0].widget.properties;
    try {
      FoundationPlatform.configure({ kind: 'native', operatingSystem: 'ios' });
      f.set(wrap('ko'));
      let properties = sourceSemantics();
      assert.equal(properties.selected, false);
      assert.equal(properties.hint, '선택되지 않음');
      assert.equal(
        elements(f, (e) => e.widget.painter instanceof RadioPainter).length,
        1,
        'Theme.platform still selects Material paint',
      );
      f.set(wrap('zh-TW'));
      assert.equal(sourceSemantics().hint, '未選取');
      f.set(wrap('zh-HK'));
      assert.equal(sourceSemantics().hint, '未揀選');
      f.set(wrap('ko', { ko: { radioButtonUnselectedLabel: '사용자 라디오 힌트' } }));
      assert.equal(sourceSemantics().hint, '사용자 라디오 힌트');
      registry.groupValue = 1;
      f.set(wrap('ko'));
      properties = sourceSemantics();
      assert.equal(properties.selected, true);
      assert.equal(properties.hint, null);
      FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
      f.set(wrap('ko'));
      properties = sourceSemantics();
      assert.equal(properties.selected, null);
      assert.equal(properties.hint, null);
      f.set(new SizedBox(1, 1));
      assert.equal(registry.clients.size, 0);
    } finally {
      FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
      f.close();
    }
  },
);

test(
  'typed groups skip disabled radios, wrap source reading order and preserve the one-enabled navigation callback',
  { timeout },
  async () => {
    const f = fixture(),
      token = Symbol('outer'),
      a = new FocusNode(),
      c = new FocusNode(),
      changes = [];
    const keyEvent = (kind, key) => ({
      kind,
      key,
      code: key,
      shift: false,
      control: false,
      alt: false,
      meta: false,
      repeat: false,
    });
    const arrow = async (key) => {
      assert.equal(f.root.key(keyEvent('down', key)), true);
      f.root.key(keyEvent('up', key));
      await Promise.resolve();
      f.frame();
    };
    const wrap = (single) =>
      new Directionality(
        'ltr',
        new RadioGroup({
          typeToken: token,
          groupValue: 1,
          onChanged: (value) => changes.push(value),
          child: new Row([
            new Radio({ value: 1, groupToken: token, focusNode: a }),
            new Radio({ value: 2, groupToken: token, enabled: false }),
            new CupertinoRadio({ value: 3, groupToken: token, focusNode: c, enabled: !single }),
          ]),
        }),
      );
    try {
      f.set(wrap(false));
      a.requestFocus();
      await Promise.resolve();
      f.frame();
      await arrow('ArrowRight');
      assert.deepEqual(changes, [3]);
      assert(c.hasFocus);
      await arrow('ArrowRight');
      assert.deepEqual(changes, [3, 1]);
      assert(a.hasFocus);
      f.set(wrap(true));
      await arrow('ArrowLeft');
      assert.deepEqual(
        changes,
        [3, 1, 1],
        'Source dispatches the only enabled candidate while other clients remain registered',
      );
      f.set(new SizedBox(1, 1));
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
      a.addListener(() => {});
      c.addListener(() => {});
    } finally {
      f.close();
      a.dispose();
      c.dispose();
    }
  },
);
