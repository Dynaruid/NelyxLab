// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/desktop_text_selection_toolbar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Padding, Column, DecoratedBox } from '@nelyx/core/framework/widgets/basic';
import { Container } from '@nelyx/core/framework/widgets/container';
import { BackdropFilter } from '@nelyx/core/framework/widgets/backdrop-filter';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { DesktopTextSelectionToolbarLayoutDelegate } from '@nelyx/core/framework/widgets/desktop-text-selection-toolbar-layout-delegate';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { Decoration, BoxPainter } from '@nelyx/core/framework/painting/decoration';
import type { ImageConfiguration } from '@nelyx/core/framework/painting/image-configuration';
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { Offset } from '@nelyx/core/ui/offset';
import { Color } from '@nelyx/core/ui/color';
import { Rect } from '@nelyx/core/ui/rect';
import { Paint } from '@nelyx/core/ui/paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Offset as Point } from '@nelyx/core/ui/geometry';
import { ImageFilter } from '@nelyx/core/ui/image-filter';
import { ColorFilter } from '@nelyx/core/ui/color-filter';
import { CupertinoDynamicColor } from './colors.ts';

export { CupertinoDesktopTextSelectionToolbarButton } from './text-selection-toolbar-button.ts';

const screenPadding = 8;
const toolbarPadding = EdgeInsets.all(6);
const toolbarWidth = 222;
const toolbarRadius = BorderRadius.circular(8);
const toolbarBlurSigma = 20;
const toolbarSaturation = 3;
const toolbarBorderColor = CupertinoDynamicColor.withBrightness({
  color: new Color(0xffb8b8b8),
  darkColor: new Color(0xff5b5b5b),
});
const toolbarBackgroundColor = CupertinoDynamicColor.withBrightness({
  color: new Color(0xb2ffffff),
  darkColor: new Color(0xb2303030),
});
const toolbarShadows = [
  new BoxShadow({
    color: 0x3c000000,
    blurRadius: 10,
    spreadRadius: 0.5,
    offset: new Offset(0, 4),
  }),
];

const saturationR = 0.213 * (1 - toolbarSaturation);
const saturationG = 0.715 * (1 - toolbarSaturation);
const saturationB = 0.072 * (1 - toolbarSaturation);
const toolbarFilter = ImageFilter.compose({
  outer: ColorFilter.matrix([
    saturationR + toolbarSaturation,
    saturationG,
    saturationB,
    0,
    0,
    saturationR,
    saturationG + toolbarSaturation,
    saturationB,
    0,
    0,
    saturationR,
    saturationG,
    saturationB + toolbarSaturation,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ]),
  inner: ImageFilter.blur({ sigmaX: toolbarBlurSigma, sigmaY: toolbarBlurSigma }),
});

export class CupertinoDesktopTextSelectionToolbar extends StatelessWidget {
  readonly anchor: Offset;
  readonly children: readonly Widget[];
  constructor({
    key = null,
    anchor,
    children,
  }: {
    readonly anchor: Offset;
    readonly children: readonly Widget[];
  } & WidgetOptions) {
    super(key);
    if (!children.length) throw new Error('CupertinoDesktopTextSelectionToolbar requires children');
    this.anchor = anchor;
    this.children = Object.freeze([...children]);
  }
  build(context: BuildContext): Widget {
    const top = MediaQuery.paddingOf(context).top + screenPadding;
    const shape = new RoundedSuperellipseBorder({ borderRadius: toolbarRadius });
    const child = new Container({
      width: toolbarWidth,
      clipBehavior: 'hardEdge',
      decoration: new ToolbarDecoration(shape, null, toolbarShadows),
      child: new BackdropFilter({
        filter: toolbarFilter,
        child: new DecoratedBox(
          new Padding(toolbarPadding, new Column(this.children, { mainSize: 'min' })),
          {
            decoration: new ToolbarDecoration(
              new RoundedSuperellipseBorder({
                borderRadius: toolbarRadius,
                side: new BorderSide({ color: toolbarBorderColor.resolveFrom(context).toARGB32() }),
              }),
              toolbarBackgroundColor.resolveFrom(context).toARGB32(),
              [],
            ),
          },
        ),
      }),
    });
    return new Padding(
      {
        left: screenPadding,
        top,
        right: screenPadding,
        bottom: screenPadding,
      },
      new CustomSingleChildLayout(
        child,
        new DesktopTextSelectionToolbarLayoutDelegate({
          anchor: this.anchor.subtract(new Offset(screenPadding, top)),
        }),
      ),
    );
  }
}
/** Selection's ShapeDecoration subset; painter ownership belongs to DecoratedBox. */
class ToolbarDecoration extends Decoration {
  constructor(
    readonly shape: RoundedSuperellipseBorder,
    readonly color: number | null,
    readonly shadows: readonly BoxShadow[],
  ) {
    super();
  }
  override get padding() {
    return this.shape.dimensions;
  }
  override get isComplex(): boolean {
    return this.shadows.length > 0;
  }
  override getClipPath(rect: Rect, direction: 'ltr' | 'rtl') {
    return this.shape.getOuterPath(rect, { textDirection: direction });
  }
  createBoxPainter(onChanged: (() => void) | null = null): BoxPainter {
    return new ToolbarPainter(this, onChanged);
  }
}
class ToolbarPainter extends BoxPainter {
  constructor(
    private decoration: ToolbarDecoration,
    onChanged: (() => void) | null,
  ) {
    super(onChanged);
  }
  paint(canvas: Canvas, offset: Point, configuration: ImageConfiguration): void {
    this.assertLive();
    if (!configuration.size) return;
    const rect = Rect.fromLTWH(
        offset.x,
        offset.y,
        configuration.size.width,
        configuration.size.height,
      ),
      options = { textDirection: configuration.textDirection },
      d = this.decoration;
    for (const shadow of d.shadows)
      canvas.drawPath(
        d.shape.getOuterPath(rect.shift(shadow.offset).inflate(shadow.spreadRadius), options),
        shadow.toPaint(),
      );
    if (d.color !== null)
      d.shape.paintInterior(canvas, rect, new Paint({ color: d.color }), options);
    d.shape.paint(canvas, rect, options);
  }
}
