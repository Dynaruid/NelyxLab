// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Padding, Column, DecoratedBox } from '@nelyx/core/framework/widgets/basic';
import { Container } from '@nelyx/core/framework/widgets/container';
import { BackdropFilter } from '@nelyx/core/framework/widgets/backdrop-filter';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { DesktopTextSelectionToolbarLayoutDelegate } from '@nelyx/core/framework/widgets/desktop-text-selection-toolbar-layout-delegate';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { Decoration, BoxPainter } from '@nelyx/core/framework/painting/decoration';
import type { ImageConfiguration } from '@nelyx/core/framework/painting/image-configuration';
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { Paint } from '@nelyx/core/ui/paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Offset as Point } from '@nelyx/core/ui/geometry';
import { ImageFilter } from '@nelyx/core/ui/image-filter';
import { ColorFilter } from '@nelyx/core/ui/color-filter';
import { CupertinoTheme } from './theme.ts';
export class CupertinoDesktopTextSelectionToolbar extends StatelessWidget {
    readonly anchor: Offset;
    readonly children: readonly Widget[];
    constructor({ key = null, anchor, children }: {
        readonly anchor: Offset;
        readonly children: readonly Widget[];
    } & WidgetOptions) {
        super(key);
        if (!children.length)
            throw new Error('CupertinoDesktopTextSelectionToolbar requires children');
        this.anchor = anchor;
        this.children = Object.freeze([...children]);
    }
    build(context: BuildContext): Widget {
        const dark = CupertinoTheme.of(context).brightness === 'dark', top = MediaQuery.of(context).safeArea.top + 8, r = -.426, g = -1.43, b = -.144, filter = ImageFilter.compose({ outer: ColorFilter.matrix([r + 3, g, b, 0, 0, r, g + 3, b, 0, 0, r, g, b + 3, 0, 0, 0, 0, 0, 1, 0]), inner: ImageFilter.blur({ sigmaX: 20, sigmaY: 20 }) });
        const radius = BorderRadius.circular(8), shape = new RoundedSuperellipseBorder({ borderRadius: radius });
        const child = new Container({
            width: 222, clipBehavior: 'hardEdge', decoration: new ToolbarDecoration(shape, null, [new BoxShadow({
                    color: 0x3c000000, blurRadius: 10, spreadRadius: .5, offset: new Offset(0, 4)
                })]), child: new BackdropFilter({ filter, child: new DecoratedBox(new Padding({
                    left: 6, top: 6, right: 6, bottom: 6
                }, new Column(this.children, { mainSize: 'min', crossAlign: 'stretch' })), { decoration: new ToolbarDecoration(new RoundedSuperellipseBorder({ borderRadius: radius, side: new BorderSide({ color: dark ? 0xff5b5b5b : 0xffb8b8b8 }) }), dark ? 0xb2303030 : 0xb2ffffff, []) }) })
        });
        return new Padding({
            left: 8, top, right: 8, bottom: 8
        }, new CustomSingleChildLayout(child, new DesktopTextSelectionToolbarLayoutDelegate({ anchor: this.anchor.subtract(new Offset(8, top)) })));
    }
}
/** Selection's ShapeDecoration subset; painter ownership belongs to DecoratedBox. */
class ToolbarDecoration extends Decoration {
    constructor(readonly shape: RoundedSuperellipseBorder, readonly color: number | null, readonly shadows: readonly BoxShadow[]) {
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
    constructor(private decoration: ToolbarDecoration, onChanged: (() => void) | null) {
        super(onChanged);
    }
    paint(canvas: Canvas, offset: Point, configuration: ImageConfiguration): void {
        this.assertLive();
        if (!configuration.size)
            return;
        const rect = Rect.fromLTWH(offset.x, offset.y, configuration.size.width, configuration.size.height), options = { textDirection: configuration.textDirection }, d = this.decoration;
        for (const shadow of d.shadows)
            canvas.drawPath(d.shape.getOuterPath(rect.shift(shadow.offset).inflate(shadow.spreadRadius), options), shadow.toPaint());
        if (d.color !== null)
            d.shape.paintInterior(canvas, rect, new Paint({ color: d.color }), options);
        d.shape.paint(canvas, rect, options);
    }
}
