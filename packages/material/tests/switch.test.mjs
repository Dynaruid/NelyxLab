import { assertParagraphOwnership } from './engine-fixture.mjs';
// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Switch } from '@nelyx/material/switch';
import { Theme } from '@nelyx/material/theme';
import { ThemeData, MaterialTapTargetSize } from '@nelyx/material/theme-data';
import { SwitchTheme, SwitchThemeData } from '@nelyx/material/switch-theme';
import { CupertinoThemeData } from '@nelyx/cupertino/theme';
import { Align, SizedBox, Builder } from '@nelyx/core/framework/widgets/basic';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { Icons } from '@nelyx/material/icons';
import { Color } from '@nelyx/core/ui/color';
import {
  WidgetState,
  WidgetStateProperty,
  WidgetStatesController,
} from '@nelyx/core/framework/widgets/widget-state';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import { nullableDartType, dartDoubleType } from '@nelyx/core/foundation/dart-type-witness';
import { sourceColorType } from '@nelyx/core/ui/color-source';
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { MemoryImage } from '@nelyx/core/framework/painting/image-provider';
import { ImageService } from '@nelyx/core/hosting/images';
import { WebSkiaLibrary } from '@nelyx/skia-web/library';
import { switchEnvironment, resolveSwitchPaint } from '../dist/internal/switch/switch-values.js';
import { SwitchPainter } from '@nelyx/core/internal/framework/widgets/switch-painter';
import { fixture } from './root-fixture.mjs';

const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
const color = (value) => new Color(value),
  property = (callback) =>
    WidgetStateProperty.resolveWith(nullableDartType(sourceColorType), callback);
function elements(f, predicate) {
  const result = [],
    visit = (e) => {
      if (predicate(e)) result.push(e);
      e.visitChildren(visit);
    };
  visit(f.root.root);
  return result;
}
const painter = (f) =>
  elements(f, (e) => e.widget.painter instanceof SwitchPainter)[0].widget.painter;
const wrap = (widget, platform = 'windows', rtl = false, extra = {}) =>
  new Theme(
    new ThemeData({ platform, ...extra }),
    new Directionality(rtl ? 'rtl' : 'ltr', new Align(widget)),
  );
function environment(f, widget, platform = 'windows', adaptive = false, extra = {}) {
  let result;
  f.set(
    wrap(
      new Builder((context) => {
        result = switchEnvironment(widget, context, adaptive);
        return new SizedBox(1, 1);
      }),
      platform,
      false,
      extra,
    ),
  );
  return result;
}

test(
  'Switch constructor/defaults reject deprecated, invalid image handlers and missing controlled callbacks',
  { timeout },
  () => {
    const w = new Switch({ value: false, onChanged: null });
    assert.equal(w.activeThumbColor, null);
    assert.equal(w.thumbIcon, null);
    assert.equal(w.applyCupertinoTheme, null);
    assert.equal(w.dragStartBehavior, DragStartBehavior.start);
    assert.equal(w.autofocus, false);
    assert.throws(
      () => new Switch({ value: false, onChanged: null, activeColor: color(1) }),
      /activeThumbColor/,
    );
    assert.throws(() => new Switch({ value: false }), /explicit nullable callback/);
    assert.throws(
      () => new Switch({ value: false, onChanged: null, onActiveThumbImageError() {} }),
      /active thumb image/,
    );
    assert.throws(
      () => new Switch({ value: false, onChanged: null, splashRadius: -1 }),
      /finite and nonnegative/,
    );
  },
);

test(
  'M3 state precedence, outline numeric provenance, icon/image radius and caller-state preservation',
  { timeout },
  () => {
    const f = fixture(),
      states = emptyWidgetStateSet();
    try {
      const w = new Switch({ value: false, onChanged() {} }),
        e = environment(f, w),
        p = resolveSwitchPaint(w, e, states),
        c = ThemeData.light().colorScheme;
      assert.equal(p.activeTrackColor.toARGB32(), c.primary);
      assert.equal(p.inactiveTrackColor.toARGB32(), c.surfaceContainerHighest);
      assert.equal(p.activeRadius, 12);
      assert.equal(p.inactiveRadius, 8);
      assert.equal(p.inactiveOutlineWidth, 2);
      const custom = new Switch({
        value: false,
        onChanged() {},
        activeThumbColor: color(0xff123456),
        thumbColor: property((s) => (s.contains(WidgetState.selected) ? color(0xff112233) : null)),
        trackOutlineWidth: WidgetStateProperty.resolveWith(nullableDartType(dartDoubleType), () =>
          DartDouble.fromSource(5),
        ),
        thumbIcon: { resolve: () => new Icon(null) },
      });
      const q = resolveSwitchPaint(custom, e, states);
      assert.equal(q.activeColor.toARGB32(), 0xff112233);
      assert.equal(q.activeTrackColor.toARGB32(), 0x80123456);
      assert.equal(q.inactiveOutlineWidth, 5);
      assert.equal(q.inactiveRadius, 12);
      assert.deepEqual([...states], []);
      assert.throws(
        () =>
          resolveSwitchPaint(
            new Switch({ value: false, onChanged() {}, trackOutlineWidth: { resolve: () => 2 } }),
            e,
            states,
          ),
        /DartDouble/,
      );
      states.add(WidgetState.disabled);
      const disabled = resolveSwitchPaint(custom, e, states);
      assert.equal(
        disabled.activeColor.toARGB32(),
        0xff112233,
        'Explicit state property still wins while disabled',
      );
      assert.deepEqual([...states], [WidgetState.disabled]);
    } finally {
      f.close();
    }
  },
);

test(
  'actual M3 Root paints 52x32 track, 16/24 thumbs, padding/tap size and RTL endpoints',
  { timeout },
  () => {
    const f = fixture();
    try {
      let commands = f.set(wrap(new Switch({ value: false, onChanged() {}, id: 'switch' })));
      assert.equal(f.root.nodes.find((n) => n.id === 'switch').bounds.width, 60);
      assert.equal(f.root.nodes.find((n) => n.id === 'switch').bounds.height, 40);
      const rects = commands.filter((c) => c.op === 'drawRRect');
      assert.deepEqual(rects[0].rrect.values.slice(0, 4), [4, 4, 56, 36]);
      assert.deepEqual(rects.at(-1).rrect.values.slice(0, 4), [12, 12, 28, 28]);
      commands = f.set(
        wrap(new Switch({ value: true, onChanged() {}, id: 'switch' }), 'windows', true),
      );
      f.advance(400);
      commands = f.frame();
      assert.deepEqual(
        commands
          .filter((c) => c.op === 'drawRRect')
          .at(-1)
          .rrect.values.slice(0, 4),
        [8, 8, 32, 32],
      );
      f.set(
        wrap(
          new Switch({
            value: false,
            onChanged() {},
            id: 'switch',
            padding: EdgeInsets.all(3),
            materialTapTargetSize: MaterialTapTargetSize.padded,
          }),
        ),
      );
      assert.equal(f.root.nodes.find((n) => n.id === 'switch').bounds.width, 58);
      assert.equal(f.root.nodes.find((n) => n.id === 'switch').bounds.height, 62);
    } finally {
      f.close();
    }
  },
);

test(
  'M3 position, color and thumb morph use distinct source curves on the same controller',
  { timeout },
  () => {
    const f = fixture(),
      options = (value) => wrap(new Switch({ value, onChanged() {} }));
    try {
      f.set(options(false));
      f.set(options(true));
      f.advance(150);
      const p = painter(f).options;
      assert(Math.abs(p.rawPosition - 0.5) < 0.01);
      assert(p.position > 1, 'easeOutBack geometry overshoots');
      assert(p.colorPosition > p.rawPosition && p.colorPosition < 1);
      f.advance(200);
      assert.equal(painter(f).options.rawPosition, 1);
      f.set(new SizedBox(1, 1));
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
    }
  },
);

test(
  'adaptive Switch keeps the shared State/painter, clears component themes and applies explicit Cupertino policy',
  { timeout },
  () => {
    const f = fixture(),
      sourceTheme = new SwitchThemeData({ trackColor: property(() => color(0xffff0000)) });
    const widget = (applyCupertinoTheme) =>
      Switch.adaptive({ value: true, onChanged() {}, id: 'adaptive-switch', applyCupertinoTheme });
    try {
      f.set(wrap(new SwitchTheme(sourceTheme, widget(false)), 'iOS'));
      const samePainter = painter(f);
      assert.equal(samePainter.options.config.isCupertino, true);
      assert.equal(samePainter.options.activeTrackColor.toARGB32(), 0xff34c759);
      f.set(
        wrap(new SwitchTheme(sourceTheme, widget(true)), 'macOS', false, {
          cupertinoOverrideTheme: new CupertinoThemeData({ primaryColor: 0xff112233 }),
        }),
      );
      assert.equal(painter(f), samePainter);
      assert.equal(painter(f).options.activeTrackColor.toARGB32(), 0xff112233);
      f.set(wrap(new SwitchTheme(sourceTheme, widget(false)), 'windows'));
      assert.equal(painter(f), samePainter);
      assert.equal(painter(f).options.config.isCupertino, false);
      f.set(new SizedBox(1, 1));
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
    }
  },
);

test(
  'actual switch input dispatches once, RTL drag is controlled and borrowed owners survive retirement',
  { timeout },
  () => {
    const f = fixture(),
      focus = new FocusNode(),
      states = new WidgetStatesController(),
      changes = [];
    const widget = (value, callback = (next) => changes.push(next)) =>
      wrap(
        new Switch({
          value,
          onChanged: callback,
          id: 'drag-switch',
          focusNode: focus,
          statesController: states,
          dragStartBehavior: DragStartBehavior.down,
        }),
        'windows',
        true,
      );
    try {
      f.set(widget(false));
      assert.equal(elements(f, (e) => e.widget instanceof ControlInteraction).length, 1);
      const stale = f.root.nodes.find((n) => n.id === 'drag-switch').activate;
      f.tap('drag-switch');
      assert.deepEqual(changes, [true]);
      const node = f.root.nodes.find((n) => n.id === 'drag-switch'),
        x = node.bounds.x + node.bounds.width / 2,
        y = node.bounds.y + node.bounds.height / 2;
      const send = (kind, dx) => {
        f.root.pointer({
          kind,
          x: x + dx,
          y,
          pointer: 7,
          device: 'mouse',
          buttons: kind === 'up' ? 0 : 1,
          timestamp: 0,
          viewportGeneration: 1,
        });
        f.frame();
      };
      send('down', 0);
      send('move', -25);
      send('move', -40);
      send('up', -40);
      assert.deepEqual(changes, [true, true]);
      f.set(widget(false, null));
      stale?.();
      f.tap('drag-switch');
      assert.deepEqual(changes, [true, true]);
      f.set(new SizedBox(1, 1));
      stale?.();
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

test(
  'actual CanvasKit image decode and thumb glyph paint retain and retire the View resources',
  { timeout },
  async () => {
    const require = createRequire(import.meta.url),
      runtime = new URL('../generated/runtime/', import.meta.resolve('@nelyx/skia-web/library'));
    const ck = await require(fileURLToPath(new URL('canvaskit.js', runtime)))({
      wasmBinary: fs.readFileSync(new URL('canvaskit.wasm', runtime)),
    });
    assert.equal(
      ck.nelyxParagraphApiVersion(),
      1,
      'Glyph checks use the actual owned paragraph runtime',
    );
    const f = fixture(),
      context = f.root.context,
      resources = context.resources,
      library = new WebSkiaLibrary(ck, null, context.owner),
      frames = new Map();
    library.bind(resources);
    context.text = library;
    const fontBytes = fs.readFileSync(
        new URL('../assets/MaterialIcons.otf', import.meta.resolve('@nelyx/material/icons')),
      ),
      font = library.decode(
        {
          id: 'switch-icons',
          kind: 'font',
          fontFamily: 'MaterialIcons',
          sha256: crypto.createHash('sha256').update(fontBytes).digest('hex'),
        },
        fontBytes,
      );
    resources.register(font.descriptor, font.retire);
    context.defaultFont = font.descriptor;
    context.assets.set('switch-icons', font.descriptor);
    let invalidDecodes = 0;
    const images = new ImageService(
      resources,
      {
        instantiateCodec: (bytes, options) => {
          if (bytes.length === 3) invalidDecodes++;
          return library.instantiateImageCodec(bytes, options);
        },
        async loadAsset() {
          throw Error('This memory-image test does not declare file assets');
        },
        async loadNetwork() {
          throw Error('This test declares no network capability');
        },
      },
      {
        request(callback) {
          const key = {};
          frames.set(key, callback);
          return {
            dispose() {
              frames.delete(key);
            },
          };
        },
      },
      {
        now: context.clock.now,
        scheduleTimer(callback, ms) {
          const key = setTimeout(callback, ms);
          return {
            dispose() {
              clearTimeout(key);
            },
          };
        },
      },
    );
    context.images = images;
    const source = ck.MakeSurface(2, 2);
    source.getCanvas().clear(ck.Color(0, 255, 0, 1));
    const native = source.makeImageSnapshot(),
      png = native.encodeToBytes();
    native.delete();
    source.delete();
    const image = new MemoryImage(png),
      errorEvents = [];
    const raster = ck.MakeSurface(240, 160);
    assert(raster);
    const pixels = (name, commands) => {
      const canvas = raster.getCanvas();
      library.replay(canvas, { commands });
      raster.flush();
      const snapshot = raster.makeImageSnapshot();
      try {
        const bytes = snapshot.readPixels(0, 0, {
          width: 240,
          height: 160,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB,
        });
        assert(bytes);
        return (x, y) => {
          const i = (y * 240 + x) * 4;
          return (
            ((bytes[i + 3] << 24) | (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]) >>> 0
          );
        };
      } finally {
        snapshot.delete();
      }
    };
    const flush = async () => {
      let commands;
      for (let i = 0; i < 8; i++) {
        await new Promise(setImmediate);
        const snapshot1 = [...frames];
        for (const [key, callback] of snapshot1) {
          frames.delete(key);
          callback();
        }
        commands = f.frame();
      }
      return commands;
    };
    try {
      f.set(
        wrap(
          new Switch({ value: true, onChanged() {}, activeThumbImage: image, id: 'image-switch' }),
        ),
      );
      let commands = await flush();
      assert(commands.some((c) => c.op === 'drawImageRect'));
      const imagePixels = pixels('image', commands);
      assert.equal(
        imagePixels(130, 80),
        0xff00ff00,
        'Actual encoded green image appears on the thumb',
      );
      f.set(
        wrap(
          new Switch({
            value: true,
            onChanged() {},
            activeThumbColor: color(0xffffffff),
            thumbIcon: { resolve: () => new Icon(Icons.check, { color: color(0xff000000) }) },
            id: 'glyph-switch',
          }),
        ),
      );
      commands = f.frame();
      assert(commands.some((c) => c.op === 'paragraph'));
      assert.equal(
        [...library.paragraphs.values()].some((e) => e.layout.unresolvedGlyphs > 0),
        false,
      );
      const glyphPixels = pixels('glyph', commands);
      let ink = 0;
      for (let y = 72; y < 88; y++)
        for (let x = 122; x < 138; x++) {
          const value = glyphPixels(x, y);
          if (((value >>> 16) & 255) < 180 && ((value >>> 8) & 255) < 180 && (value & 255) < 180)
            ink++;
        }
      assert(
        ink > 5,
        'Actual antialiased MaterialIcons check glyph is rasterized inside the white thumb',
      );
      f.set(
        wrap(
          new Switch({
            value: true,
            onChanged() {},
            activeThumbImage: new MemoryImage(new Uint8Array([1, 2, 3])),
            onActiveThumbImageError: (error) => errorEvents.push(error),
          }),
        ),
      );
      await flush();
      await new Promise(setImmediate);
      assert(invalidDecodes > 0);
      assert.equal(
        errorEvents.length,
        invalidDecodes,
        'Each real failed decode reports its error once',
      );
      f.set(new SizedBox(1, 1));
      await images.dispose();
      assert.equal(library.images.size, 0, 'Decoded images retire');
      assertParagraphOwnership({ library });
      const reported = errorEvents.length;
      await flush();
      assert.equal(errorEvents.length, reported, 'Retired painters do not receive late errors');
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      raster.delete();
      await images.dispose();
      f.close();
      await library.dispose();
      assert.equal(library.fonts.size, 0);
    }
  },
);
