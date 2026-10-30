// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import { CupertinoFormRow } from '@nelyx/cupertino/form-row';
import { CupertinoFormSection } from '@nelyx/cupertino/form-section';
import {
  CupertinoFormRow as AggregateRow,
  CupertinoFormSection as AggregateSection,
} from '@nelyx/cupertino/widgets';
import { CupertinoListSection, CupertinoListSectionType } from '@nelyx/cupertino/list-section';
import { CupertinoTheme, CupertinoThemeData } from '@nelyx/cupertino/theme';
import { CupertinoColors } from '@nelyx/cupertino/colors';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { Builder, Center, ColoredBox, Column, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { ValueKey } from '@nelyx/core/foundation/key';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { engineFixture } from './engine-fixture.mjs';
const timeout = 1_200_000;
const wrap = (child, { direction = 'ltr', brightness = 'light', scale = 1 } = {}) =>
  new MediaQuery(
    {
      width: 240,
      height: 160,
      scale,
      textScale: 1,
      safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
      keyboardInset: 0,
    },
    new Directionality(
      direction,
      new CupertinoTheme({
        data: new CupertinoThemeData({ brightness }),
        child: new Center(new SizedBox(220, undefined, new Column([child], { mainSize: 'min' }))),
      }),
    ),
  );
const elements = (root) => {
  const result = [];
  const visit = (e) => {
    result.push(e);
    e.visitChildren(visit);
  };
  visit(root);
  return result;
};
const element = (f, widget) => {
  const found = elements(f.root.root).find((e) => e.widget === widget);
  assert(found);
  return found;
};
const rect = (f, widget) => {
  const box = element(f, widget).renderObjects[0],
    origin = box.localToGlobal(new Offset(0, 0));
  return { x: origin.x, y: origin.y, ...box.size };
};

test(
  'Cupertino Form row/section canonical APIs retain source defaults, inset constructor and explicit overrides',
  { timeout },
  () => {
    assert.equal(CupertinoFormRow, AggregateRow);
    assert.equal(CupertinoFormSection, AggregateSection);
    const child = new SizedBox(20, 20),
      row = new CupertinoFormRow({ child });
    assert.equal(row.child, child);
    assert.equal(row.padding, null);
    assert.equal(row.prefix, null);
    assert.equal(row.helper, null);
    assert.equal(row.error, null);
    assert.throws(() => new CupertinoFormSection({ children: [] }), /nonempty/);
    const base = new CupertinoFormSection({ children: [row] }),
      inset = CupertinoFormSection.insetGrouped({ children: [row] });
    assert(base.margin.equals(EdgeInsets.zero));
    assert.equal(base.backgroundColor, CupertinoColors.systemGroupedBackground);
    assert.equal(base.decoration, null);
    assert.equal(base.clipBehavior, 'none');
    assert.deepEqual(inset.margin.resolve('ltr'), EdgeInsets.fromLTRB(20, 0, 20, 10));
    assert.deepEqual(inset.margin.resolve('rtl'), EdgeInsets.fromLTRB(20, 0, 20, 10));
    const custom = CupertinoFormSection.insetGrouped({
      children: [row],
      margin: EdgeInsets.zero,
      backgroundColor: new Color(0xff123456),
      decoration: new BoxDecoration({ color: 0xffabcdef }),
      clipBehavior: 'hardEdge',
    });
    assert(custom.margin.equals(EdgeInsets.zero));
    assert.equal(custom.backgroundColor.toARGB32(), 0xff123456);
    assert.equal(custom.decoration.color, 0xffabcdef);
    assert.equal(custom.clipBehavior, 'hardEdge');
  },
);

test(
  'actual FormRow source directional padding, loose trailing input and helper/error layout agree with dry and intrinsic geometry',
  { timeout },
  async () => {
    const f = await engineFixture(),
      prefix = new SizedBox(30, 10),
      child = new SizedBox(40, 20),
      helper = new SizedBox(60, 12),
      error = new SizedBox(50, 8);
    try {
      for (const direction of ['ltr', 'rtl']) {
        const row = new CupertinoFormRow({ child, prefix, helper, error });
        f.set(wrap(row, { direction }));
        const r = rect(f, row),
          p = rect(f, prefix),
          c = rect(f, child),
          h = rect(f, helper),
          e = rect(f, error);
        assert.equal(r.width, 220);
        assert.equal(r.height, 52);
        assert.equal(p.x - r.x, direction === 'ltr' ? 20 : 170);
        assert.equal(p.y - r.y, 11);
        assert.equal(c.x - r.x, direction === 'ltr' ? 174 : 6);
        assert.equal(c.y - r.y, 6);
        assert.equal(h.x - r.x, direction === 'ltr' ? 20 : 140);
        assert.equal(h.y - r.y, 26);
        assert.equal(e.x - r.x, direction === 'ltr' ? 20 : 150);
        assert.equal(e.y - r.y, 38);
        const box = element(f, row).renderObjects[0],
          constraints = new BoxConstraints(220, 220, 0, Infinity);
        assert.deepEqual(box.getDryLayout(constraints), box.size);
        assert.equal(box.getMinIntrinsicHeight(220), 52);
        assert.equal(box.getMaxIntrinsicHeight(220), 52);
      }
      const row = new CupertinoFormRow({ child, padding: EdgeInsets.zero });
      f.set(wrap(row));
      assert.equal(rect(f, row).height, 20);
      assert.equal(rect(f, child).x - rect(f, row).x, 180);
    } finally {
      await f.close();
    }
  },
);

test(
  'Form row text defaults and form section delegation retain keyed child State during error/theme/direction/variant updates',
  { timeout },
  async () => {
    const f = await engineFixture(),
      seen = {},
      counts = { created: 0, disposed: 0 },
      rowKey = new GlobalKey('form row');
    class Marker extends StatefulWidget {
      constructor() {
        super(new ValueKey('input'));
      }
      createState() {
        counts.created++;
        return new MarkerState();
      }
    }
    class MarkerState extends State {
      build() {
        return new SizedBox(40, 20);
      }
      dispose() {
        counts.disposed++;
        super.dispose();
      }
    }
    const probe = (name) =>
      new Builder((context) => {
        seen[name] = DefaultTextStyle.of(context).style;
        return new SizedBox(20, 8);
      });
    const prefix = probe('prefix'),
      helper = probe('helper'),
      error = probe('error'),
      header = probe('header'),
      footer = probe('footer');
    try {
      for (const brightness of ['light', 'dark'])
        for (const direction of ['ltr', 'rtl'])
          for (const inset of [false, true]) {
            const row = new CupertinoFormRow({
              key: rowKey,
              child: new Marker(),
              prefix,
              helper,
              ...(inset ? { error } : {}),
            });
            const section = (
              inset
                ? CupertinoFormSection.insetGrouped
                : (options) => new CupertinoFormSection(options)
            )({ children: [row], header, footer });
            f.set(wrap(section, { brightness, direction }));
            assert.equal(seen.prefix.fontSize, 17);
            assert.equal(seen.helper.fontSize, 17);
            assert.equal(seen.header.fontSize, 13);
            assert.equal(seen.footer.fontSize, 13);
            assert.equal(seen.header.color, brightness === 'light' ? 0x993c3c43 : 0x99ebebf5);
            if (inset) {
              assert.equal(seen.error.color, 0xffff3b30);
              assert.equal(seen.error.fontWeight.value, 500);
            }
            const list = elements(f.root.root).find(
              (e) => e.widget instanceof CupertinoListSection,
            ).widget;
            assert.equal(
              list.type,
              inset ? CupertinoListSectionType.insetGrouped : CupertinoListSectionType.base,
            );
            assert.equal(list.dividerMargin, inset ? 14 : 20);
            assert.equal(list.additionalDividerMargin, inset ? 14 : 0);
            assert.equal(list.clipBehavior, 'none');
            assert.equal(list.children[0], row);
            assert.equal(counts.created, 1);
            assert.equal(counts.disposed, 0);
          }
      f.set(new SizedBox());
      assert.equal(counts.disposed, 1);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      await f.close();
    }
  },
);

test(
  'actual form section dividers use one physical pixel and inset defaults paint on the owned CPU surface',
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
    };
    try {
      const rows = [
        new ColoredBox({ color: 0xffff0000, child: new SizedBox(180, 20) }),
        new ColoredBox({ color: 0xff0000ff, child: new SizedBox(180, 20) }),
      ];
      const section = new CupertinoFormSection({ children: rows });
      f.set(wrap(section, { scale: 2 }));
      const boxes = elements(f.root.root)
        .flatMap((e) => e.renderObjects)
        .filter((box) => box.size?.height === 0.5 && box.size?.width > 0);
      assert(
        boxes.length >= 3,
        'Top/bottom borders and inter-row separator each use 1/devicePixelRatio',
      );
      f.library.replay(surface.getCanvas(), { commands: f.frame() });
      surface.flush();
      const red = rect(f, rows[0]),
        blue = rect(f, rows[1]);
      assert.deepEqual(pixel(Math.floor(red.x + 90), Math.floor(red.y + 10)), [255, 0, 0, 255]);
      assert.deepEqual(pixel(Math.floor(blue.x + 90), Math.floor(blue.y + 10)), [0, 0, 255, 255]);
      const inset = CupertinoFormSection.insetGrouped({ children: [new SizedBox(180, 40)] });
      f.set(wrap(inset));
      f.library.replay(surface.getCanvas(), { commands: f.frame() });
      surface.flush();
      const r = rect(f, inset);
      assert.deepEqual(pixel(120, Math.floor(r.y + 20)), [255, 255, 255, 255]);
      assert.deepEqual(pixel(12, Math.floor(r.y + 20)), [242, 242, 247, 255]);
    } finally {
      surface.delete();
      await f.close();
    }
  },
);
