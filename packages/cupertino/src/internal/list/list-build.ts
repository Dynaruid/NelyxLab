// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source list compositions on canonical Core layout, paragraph, path and gesture owners.
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import {
  ConstrainedBox,
  ColoredBox,
  Padding,
  Row,
  Column,
  SizedBox,
  Center,
  Expanded,
  DecoratedBox,
  Align,
} from '@nelyx/core/framework/widgets/basic';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { ClipPath } from '@nelyx/core/framework/widgets/clip';
import { ShapeBorderClipper } from '@nelyx/core/framework/rendering/shape-border-clipper';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Container } from '@nelyx/core/framework/widgets/container';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { Color } from '@nelyx/core/ui/color';
import { constSourceColor } from '@nelyx/core/ui/color-source';
import { FontWeight } from '@nelyx/core/ui/typography';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import {
  CupertinoColors,
  CupertinoDynamicColor,
  constCupertinoDynamicColor,
} from '../../colors.ts';
import { CupertinoTheme } from '../../theme.ts';
import { CupertinoIcons } from '../../icons.ts';
import { CupertinoListSectionType } from '../../generated/list/list-section-types.ts';
import type { CupertinoListTile } from '../../list-tile.ts';
import type { CupertinoListSection } from '../../list-section.ts';
export function buildCupertinoListTile(
  tile: CupertinoListTile,
  notched: boolean,
  context: BuildContext,
  tapped: boolean,
  callbacks: {
    readonly down: () => void;
    readonly cancel: () => void;
    readonly tap: () => void;
  },
): Widget {
  const text = CupertinoTheme.of(context).textTheme.textStyle,
    colored = text.copyWith({
      color: CupertinoColors.secondaryLabel.resolveFrom(context).toARGB32(),
    });
  const title = new DefaultTextStyle(
    !notched || tile.subtitle === null
      ? text
      : text.copyWith({ fontWeight: FontWeight.w600, fontSize: tile.leading === null ? 16 : null }),
    tile.title,
    { maxLines: 1, overflow: 'ellipsis' },
  );
  const padding =
    tile.padding ??
    (notched
      ? tile.leading === null
        ? EdgeInsetsDirectional.fromSTEB(28, 10, 14, 10)
        : EdgeInsets.symmetric({ horizontal: 14 })
      : EdgeInsetsDirectional.only({ start: 20, end: 14 }));
  const color = tapped
    ? (tile.backgroundColorActivated ?? CupertinoColors.systemGrey4.resolveFrom(context))
    : (tile.backgroundColor ?? CupertinoColors.transparent);
  const minHeight = notched ? (tile.leading === null ? 50 : 54) : tile.subtitle === null ? 44 : 48;
  const children: Widget[] = [];
  if (tile.leading !== null)
    children.push(
      new SizedBox(tile.leadingSize, tile.leadingSize, new Center(tile.leading)),
      new SizedBox(tile.leadingToTitle),
    );
  else children.push(new SizedBox(undefined, tile.leadingSize));
  children.push(
    new Expanded(
      new Column(
        [
          title,
          ...(tile.subtitle === null
            ? []
            : [
                new SizedBox(undefined, 3),
                new DefaultTextStyle(
                  colored.copyWith({ fontSize: notched ? 14 : 12 }),
                  tile.subtitle,
                  { maxLines: 1, overflow: 'ellipsis' },
                ),
              ]),
        ],
        { mainAxisAlignment: 'spaceBetween', crossAxisAlignment: 'start' },
      ),
    ),
  );
  if (tile.additionalInfo !== null) {
    children.push(new DefaultTextStyle(colored, tile.additionalInfo, { maxLines: 1 }));
    if (tile.trailing !== null) children.push(new SizedBox(6));
  }
  if (tile.trailing !== null) children.push(tile.trailing);
  const child = new ConstrainedBox(
    new ColoredBox({ color: color.toARGB32(), child: new Padding(padding, new Row(children)) }),
    new BoxConstraints(Infinity, Infinity, minHeight, Infinity),
  );
  return tile.onTap === null
    ? child
    : new GestureDetector(child, {
        onTapDown: callbacks.down,
        onTapCancel: callbacks.cancel,
        onTap: callbacks.tap,
        behavior: HitTestBehavior.opaque,
        ...(tile.id === undefined ? {} : { semanticsId: tile.id }),
      });
}
export function buildCupertinoListTileChevron(context: BuildContext): Widget {
  return new Icon(CupertinoIcons.right_chevron, {
    size: CupertinoTheme.of(context).textTheme.textStyle.fontSize,
    color: CupertinoColors.systemGrey2.resolveFrom(context),
  });
}
const constant = (argb: number) => constSourceColor(Color, argb);
const headerFooterColor = constCupertinoDynamicColor({
  color: constant(0xff6c6c6c),
  darkColor: constant(0xff8e8e92),
  highContrastColor: constant(0xff4a4a4d),
  darkHighContrastColor: constant(0xffb0b0b7),
  elevatedColor: constant(0xff6c6c6c),
  darkElevatedColor: constant(0xff8e8e92),
  highContrastElevatedColor: constant(0xff6c6c6c),
  darkHighContrastElevatedColor: constant(0xff8e8e92),
});
export function buildCupertinoListSection(
  section: CupertinoListSection,
  context: BuildContext,
): Widget {
  const base = section.type === CupertinoListSectionType.base,
    dividerColor = section.separatorColor ?? CupertinoColors.separator.resolveFrom(context),
    height = 1 / MediaQuery.of(context).scale;
  const long = new Container({ color: dividerColor.toARGB32(), height }),
    short = new Container({
      margin: EdgeInsetsDirectional.only({
        start: section.dividerMargin + section.additionalDividerMargin,
      }),
      color: dividerColor.toARGB32(),
      height,
    });
  let style = CupertinoTheme.of(context).textTheme.textStyle,
    header: Widget | null = null,
    footer: Widget | null = null;
  if (base) {
    style = style.merge(
      new TextStyle({
        fontSize: 13,
        color: CupertinoDynamicColor.resolve(headerFooterColor, context).toARGB32(),
      }),
    );
    if (section.header !== null) header = new DefaultTextStyle(style, section.header);
    if (section.footer !== null) footer = new DefaultTextStyle(style, section.footer);
  } else {
    if (section.header !== null)
      header = new DefaultTextStyle(
        style.merge(new TextStyle({ fontSize: 20, fontWeight: FontWeight.bold })),
        section.header,
      );
    if (section.footer !== null) footer = new DefaultTextStyle(style, section.footer);
  }
  let group: Widget | null = null;
  if (section.children !== null && section.children.length > 0) {
    const rows: Widget[] = base ? [long] : [];
    for (const row of section.children.slice(0, -1)) rows.push(row, short);
    rows.push(section.children.at(-1)!);
    if (base) rows.push(long);
    const radius = base ? BorderRadius.zero : BorderRadius.circular(10),
      shape = new RoundedSuperellipseBorder({ borderRadius: radius });
    group = new DecoratedBox(new Column(rows), {
      decoration:
        section.decoration ??
        new ColorShapeDecoration(
          shape,
          CupertinoColors.secondarySystemGroupedBackground.resolveFrom(context),
        ),
    });
    // Selected ClipRSuperellipse composition uses the same Core superellipse path
    // for paint/hit/semantics. This does not introduce the full RSuperellipse API.
    if (section.clipBehavior !== 'none')
      group = new ClipPath(group, {
        clipBehavior: section.clipBehavior,
        clipper: new ShapeBorderClipper({ shape, textDirection: Directionality.of(context) }),
      });
    group = new Padding(section.margin, group);
  }
  const children: Widget[] = [];
  if (base) children.push(new SizedBox(undefined, section.topMargin ?? undefined));
  if (header !== null)
    children.push(
      new Align(
        new Padding(
          base
            ? EdgeInsetsDirectional.fromSTEB(20, 0, 20, 6)
            : EdgeInsetsDirectional.fromSTEB(20, 16, 20, 6),
          header,
        ),
        { alignment: AlignmentDirectional.centerStart },
      ),
    );
  if (group !== null) children.push(group);
  if (footer !== null)
    children.push(
      new Align(
        new Padding(
          base
            ? EdgeInsetsDirectional.fromSTEB(20, 0, 20, 0)
            : EdgeInsetsDirectional.fromSTEB(20, 0, 20, 10),
          footer,
        ),
        { alignment: AlignmentDirectional.centerStart },
      ),
    );
  return new DecoratedBox(new Column(children), {
    decoration: new BoxDecoration({
      color: CupertinoDynamicColor.resolve(section.backgroundColor, context).toARGB32(),
    }),
  });
}
