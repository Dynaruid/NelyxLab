// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Card } from '@nelyx/material/card';
import { CardTheme, CardThemeData } from '@nelyx/material/card-theme';
import { Theme } from '@nelyx/material/theme';
import { ThemeData } from '@nelyx/material/theme-data';
import { ColorScheme } from '@nelyx/material/color-scheme';
import { Material, MaterialType } from '@nelyx/material/material';
import { InkWell } from '@nelyx/material/ink-well';
import { InkRipple } from '@nelyx/material/ink-ripple';
import { Color } from '@nelyx/core/ui/color';
import '@nelyx/core/framework/painting/borders';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Builder, SizedBox, Padding, ColoredBox, Row } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { ValueKey } from '@nelyx/core/foundation/key';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { fixture } from './root-fixture.mjs';
import { engineFixture } from './engine-fixture.mjs';
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
const timeout = 1200000,
  original = JSON.parse(
    fs.readFileSync(new URL('./fixtures/card-source.json', import.meta.url)),
  ).result;
const shape = (radius) =>
    new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(radius) }),
  constructor = (variant) =>
    variant === 'elevated' ? (options) => new Card(options) : Card[variant],
  global = () =>
    new CardThemeData({
      color: new Color(0xff101020),
      shadowColor: new Color(0xff202030),
      surfaceTintColor: new Color(0xff303040),
      elevation: 7,
      shape: shape(20),
      margin: new EdgeInsets(5, 6, 7, 8),
      clipBehavior: 'antiAlias',
    }),
  local = () =>
    new CardThemeData({ color: new Color(0xff405060), elevation: 11, margin: EdgeInsets.all(9) });
const palette = (brightness) => {
  const [surfaceContainerLow, surfaceContainerHighest, surface, shadow, outlineVariant] =
    original.palettes[brightness];
  return new ColorScheme({
    brightness,
    surfaceContainerLow,
    surfaceContainerHighest,
    surface,
    shadow,
    outlineVariant,
  });
};
function parts(card, context) {
  const semantics = card.build(context),
    padding = semantics.child,
    material = padding.childWidgets[0];
  assert(
    semantics instanceof Semantics && padding instanceof Padding && material instanceof Material,
  );
  assert.equal(material.type, MaterialType.card);
  return { semantics, padding, material };
}
function descriptor(card, p) {
  const m = p.material,
    inner = m.child,
    radius = m.shape.borderRadius.resolve('ltr').topLeft.x;
  return {
    container: p.semantics.container,
    explicitChildNodes: inner.explicitChildNodes,
    leafSame: inner.child === card.child,
    color: m.color?.toARGB32() ?? null,
    shadowColor: m.shadowColor?.toARGB32() ?? null,
    surfaceTintColor: m.surfaceTintColor?.toARGB32() ?? null,
    elevation: m.elevation,
    margin: ['left', 'top', 'right', 'bottom'].map((k) => p.padding.padding[k]),
    clip: m.clipBehavior,
    borderOnForeground: m.borderOnForeground,
    radius,
    side: { color: m.shape.side.color, width: m.shape.side.width, style: m.shape.side.style },
  };
}

test(
  'three M3 Card constructors supply original nullable/default fields, key and unbound factory calls',
  { timeout },
  () => {
    const key = new ValueKey('card');
    for (const variant of ['elevated', 'filled', 'outlined']) {
      const card = constructor(variant)({ key });
      assert.deepEqual(
        {
          key: card.key.value,
          color: card.color,
          elevation: card.elevation,
          shape: card.shape,
          margin: card.margin,
          clip: card.clipBehavior,
          child: card.child,
          borderOnForeground: card.borderOnForeground,
          semanticContainer: card.semanticContainer,
        },
        original.public,
      );
      assert(Object.isFrozen(card));
      const counts = { key: 0, child: 0, elevation: 0 };
      class Options {
        get key() {
          counts.key++;
          return key;
        }
        get child() {
          counts.child++;
          return null;
        }
        get elevation() {
          counts.elevation++;
          return 0;
        }
      }
      const inherited = constructor(variant)(new Options());
      assert.equal(inherited.key, key);
      assert.equal(inherited.elevation, 0);
      assert.deepEqual(counts, { key: 1, child: 1, elevation: 1 });
      assert.throws(() => constructor(variant)({ elevation: -1 }));
    }
  },
);
test(
  'five unchanged source declarations agree with30 M3 local/global/widget/default precedence and selected identity recipes',
  { timeout },
  () => {
    const f = fixture(),
      leaf = new SizedBox(1, 1);
    try {
      for (const row of original.rows) {
        const create = constructor(row.variant),
          globalData = row.mode === 'default' ? new CardThemeData() : global(),
          localData = ['local', 'mixed'].includes(row.mode) ? local() : null,
          options = { child: leaf };
        if (row.mode === 'widget')
          Object.assign(options, {
            color: new Color(0xff112200),
            shadowColor: new Color(0xff223300),
            surfaceTintColor: new Color(0xff334400),
            elevation: 3,
            shape: shape(7),
            margin: new EdgeInsets(10, 11, 12, 13),
            clipBehavior: 'hardEdge',
            borderOnForeground: false,
            semanticContainer: false,
          });
        if (row.mode === 'mixed')
          Object.assign(options, { color: new Color(0), elevation: 0, clipBehavior: 'none' });
        const card = create(options);
        let child = new Builder((context) => {
          const a = parts(card, context),
            b = parts(card, context);
          assert.deepEqual(descriptor(card, a), row.value, row.variant + '/' + row.mode);
          assert.equal(a.material.shape === b.material.shape, row.identity.shapeSame);
          assert.equal(a.padding.padding === b.padding.padding, row.identity.marginSame);
          assert.equal(
            a.material.surfaceTintColor === b.material.surfaceTintColor,
            row.identity.tintSame,
          );
          if (row.mode !== 'default')
            assert.equal(a.material.color === b.material.color, row.identity.colorSame);
          return new SizedBox(1, 1);
        });
        if (localData) child = new CardTheme(localData, child);
        f.set(
          new Theme(
            new ThemeData({
              platform: 'windows',
              colorScheme: palette(row.brightness),
              cardTheme: globalData,
            }),
            child,
          ),
        );
      }
    } finally {
      f.close();
    }
  },
);
test(
  'actual owned Card paint supplies M3 variant surfaces and outlined border from source roles',
  { timeout },
  async () => {
    const f = await engineFixture(),
      surface = f.ck.MakeSurface(240, 160);
    const pixel = (x, y) => {
        const image = surface.makeImageSnapshot();
        try {
          return Array.from(
            image.readPixels(x, y, {
              width: 1,
              height: 1,
              colorType: f.ck.ColorType.RGBA_8888,
              alphaType: f.ck.AlphaType.Unpremul,
              colorSpace: f.ck.ColorSpace.SRGB,
            }),
          );
        } finally {
          image.delete();
        }
      },
      rgba = (argb) => [(argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255, argb >>> 24];
    try {
      for (const brightness of ['light', 'dark'])
        for (const variant of ['elevated', 'filled', 'outlined']) {
          f.set(
            new Directionality(
              'ltr',
              new Theme(
                new ThemeData({ platform: 'windows', colorScheme: palette(brightness) }),
                constructor(variant)({}),
              ),
            ),
          );
          f.library.replay(surface.getCanvas(), { commands: f.frame() });
          surface.flush();
          const row = original.rows.find(
            (r) => r.brightness === brightness && r.variant === variant && r.mode === 'default',
          );
          assert.deepEqual(pixel(120, 80), rgba(row.value.color));
          if (variant === 'outlined') assert.deepEqual(pixel(4, 80), rgba(row.value.side.color));
          f.set(new SizedBox());
          assert.equal(f.root.scheduler.transientCallbackCount, 0);
        }
    } finally {
      surface.delete();
      await f.close();
    }
  },
);
test(
  'Card passes border foreground and shape clipping to actual Material without changing child paint ownership',
  { timeout },
  async () => {
    const f = await engineFixture(),
      surface = f.ck.MakeSurface(240, 160),
      theme = new ThemeData({ platform: 'windows', colorScheme: palette('light') }),
      paint = (card) => {
        f.set(new Directionality('ltr', new Theme(theme, card)));
        f.library.replay(surface.getCanvas(), { commands: f.frame() });
        surface.flush();
      },
      pixel = (x, y) => {
        const image = surface.makeImageSnapshot();
        try {
          return Array.from(
            image.readPixels(x, y, {
              width: 1,
              height: 1,
              colorType: f.ck.ColorType.RGBA_8888,
              alphaType: f.ck.AlphaType.Unpremul,
              colorSpace: f.ck.ColorSpace.SRGB,
            }),
          );
        } finally {
          image.delete();
        }
      };
    try {
      for (const foreground of [true, false]) {
        paint(
          Card.outlined({
            elevation: 0,
            borderOnForeground: foreground,
            child: new ColoredBox({ color: 0xffff0000, child: new SizedBox() }),
          }),
        );
        assert.deepEqual(pixel(4, 80), foreground ? [0x77, 0x88, 0x99, 255] : [255, 0, 0, 255]);
        f.set(new SizedBox());
      }
      paint(
        Card.filled({
          elevation: 0,
          clipBehavior: 'none',
          child: new ColoredBox({ color: 0xffff0000, child: new SizedBox() }),
        }),
      );
      assert.deepEqual(pixel(5, 5), [255, 0, 0, 255]);
      f.set(new SizedBox());
      paint(
        Card.filled({
          elevation: 0,
          clipBehavior: 'antiAlias',
          child: new ColoredBox({ color: 0xffff0000, child: new SizedBox() }),
        }),
      );
      assert.deepEqual(pixel(5, 5), [16, 24, 39, 255]);
      assert.deepEqual(pixel(120, 80), [255, 0, 0, 255]);
      f.set(new SizedBox());
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      surface.delete();
      await f.close();
    }
  },
);
test(
  'changing Card variants/theme retains actual child State, current Material ink owner and tap routing',
  { timeout },
  async () => {
    const f = await engineFixture(),
      counts = { created: 0, disposed: 0 },
      owners = [];
    let taps = 0;
    class Probe extends StatefulWidget {
      createState() {
        counts.created++;
        return new (class extends State {
          build(context) {
            owners.push(Material.of(context));
            return new InkWell({
              id: 'card-ink',
              onTap: () => taps++,
              child: new SizedBox(100, 80),
            });
          }
          dispose() {
            counts.disposed++;
            super.dispose();
          }
        })();
      }
    }
    const child = new Probe(),
      theme = new ThemeData({ platform: 'windows', splashFactory: InkRipple.splashFactory });
    try {
      for (const variant of ['elevated', 'filled', 'outlined']) {
        f.set(new Directionality('ltr', new Theme(theme, constructor(variant)({ child }))));
        f.frame();
        f.advance(201);
        f.frame();
        assert.equal(counts.created, 1);
        f.tap('card-ink');
        f.advance(1000);
        f.frame();
      }
      assert.equal(taps, 3);
      assert(owners.every((owner) => owner === owners[0]));
      f.set(new SizedBox());
      assert.equal(counts.disposed, 1);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      await f.close();
    }
  },
);
test(
  'Card resolves directional margin in RTL and supplies separate source semantics nodes for collections',
  { timeout },
  () => {
    const f = fixture(),
      card = Card.filled({
        semanticContainer: false,
        margin: EdgeInsetsDirectional.only({ start: 5, end: 17, top: 3, bottom: 9 }),
        child: new Row([
          new Semantics({ label: 'first', child: new SizedBox(20, 20) }),
          new Semantics({ label: 'second', child: new SizedBox(20, 20) }),
        ]),
      });
    try {
      f.set(new Directionality('rtl', new Theme(new ThemeData({ platform: 'windows' }), card)));
      assert(f.root.nodes.some((n) => n.name === 'first'));
      assert(f.root.nodes.some((n) => n.name === 'second'));
      const found = [];
      const visit = (e) => {
        if (e.widget instanceof Material && e.widget.type === MaterialType.card)
          found.push(e.widget);
        e.visitChildren(visit);
      };
      visit(f.root.root);
      assert.equal(found.length, 1);
      assert.equal(found[0].child.explicitChildNodes, true);
      const outer = card.build(f.root.root);
      assert.equal(outer.container, false);
      assert.deepEqual(outer.child.padding.resolve('rtl').left, 17);
      assert.equal(outer.child.padding.resolve('rtl').right, 5);
      f.set(new SizedBox());
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
    }
  },
);
