// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from packages/flutter/lib/src/cupertino/menu_anchor.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import type { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { SingleChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { DisplayFeatureSubScreen } from '@nelyx/core/framework/widgets/display-feature-sub-screen';
import type { RawMenuOverlayInfo } from '@nelyx/core/framework/widgets/raw-menu-anchor';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Offset, Size } from '@nelyx/core/ui/geometry';
import { MaskFilter } from '@nelyx/core/ui/mask-filter';
import { Paint } from '@nelyx/core/ui/paint';
import { Path } from '@nelyx/core/ui/path';
import { Radius } from '@nelyx/core/ui/radius';
import { Rect } from '@nelyx/core/ui/rect';
import { RRect } from '@nelyx/core/ui/rrect';
import { squaredDistanceToMenuRect } from './menu-swipe.ts';

const baseFont = 'CupertinoSystemText';
const displayFont = 'CupertinoSystemDisplay';
export const menuBaseFontSize = 17;
export const minMenuScale = 1 - 3 / menuBaseFontSize;
export const maxMenuScale = 1 + 36 / menuBaseFontSize;
const largeTitleUnits = 11;

export function menuTextUnits(scaler: TextScaler): number {
  return scaler.scale(menuBaseFontSize) - menuBaseFontSize;
}

export function menuLargeText(scaler: TextScaler): boolean {
  return menuTextUnits(scaler) >= largeTitleUnits;
}

export function menuDefaultWidth(width: number, scalable: boolean): number {
  if (width < 768) return scalable ? 370 : 250;
  return scalable ? 343 : 262;
}

const bodyMetrics = [
  [14, 19, -0.15],
  [15, 20, -0.23],
  [16, 21, -0.31],
  [17, 22, -0.43],
  [19, 24, -0.44],
  [21, 26, -0.36],
  [23, 29, -0.1],
  [28, 34, 0.38],
  [33, 40, 0.4],
  [40, 48, 0.37],
  [47, 56, 0.37],
  [53, 62, 0.31],
] as const;
const subheadMetrics = [
  [12, 16, 0],
  [13, 18, -0.08],
  [14, 19, -0.15],
  [15, 20, -0.23],
  [17, 22, -0.43],
  [19, 24, -0.45],
  [21, 28, -0.36],
  [25, 31, 0.15],
  [30, 37, 0.4],
  [36, 43, 0.37],
  [42, 50, 0.37],
  [49, 58, 0.33],
] as const;
const normalizedBodySizes = bodyMetrics.map(([fontSize]) => fontSize - menuBaseFontSize);
function menuFontStyles(
  metrics: readonly (readonly [number, number, number])[],
  firstDisplayIndex: number,
) {
  return metrics.map(
    ([fontSize, lineHeight, letterSpacing], index) =>
      new TextStyle({
        fontFamily: index < firstDisplayIndex ? baseFont : displayFont,
        fontSize,
        height: lineHeight / fontSize,
        letterSpacing,
      }),
  );
}
const bodyStyles = menuFontStyles(bodyMetrics, 6);
const subheadStyles = menuFontStyles(subheadMetrics, 7);

export function menuTextStyle(scaler: TextScaler, subtitle = false): TextStyle {
  const styles = subtitle ? subheadStyles : bodyStyles;
  const units = menuTextUnits(scaler);
  const index = normalizedBodySizes.findIndex((entry) => units <= entry);
  if (index < 0) return styles[styles.length - 1]!;
  if (index === 0 || normalizedBodySizes[index] === units) return styles[index]!;
  const start = normalizedBodySizes[index - 1]!;
  const end = normalizedBodySizes[index]!;
  return TextStyle.lerp(styles[index - 1]!, styles[index]!, (units - start) / (end - start))!;
}

export function roundMenuMetric(value: number, pixelRatio: number): number {
  return pixelRatio > 0 ? Math.round(value * pixelRatio) / pixelRatio : value;
}

function clamp(value: number, start: number, end: number): number {
  return Math.max(start, Math.min(value, Math.max(start, end)));
}

export function menuAttachment(info: RawMenuOverlayInfo) {
  const target = info.anchorRect;
  const middle = info.position
    ? { x: target.x + info.position.x, y: target.y + info.position.y }
    : { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const width = Math.max(1, info.overlaySize.width);
  const height = Math.max(1, info.overlaySize.height);
  const ratioX = middle.x / width;
  const dx = ratioX < 0.4 ? -1 : ratioX > 0.6 ? 1 : 0;
  const dy = middle.y / height < 0.55 ? 1 : -1;
  const attachment = info.position
    ? middle
    : {
        x: middle.x + (dx * target.width) / 2,
        y: middle.y + dy * (target.height / 2 + 8),
      };
  return {
    anchor: info.position
      ? Rect.fromLTWH(middle.x, middle.y, 0, 0)
      : Rect.fromLTWH(target.x, target.y, target.width, target.height),
    attachment,
    alignment: new Alignment(dx, -dy),
    pivot: new Alignment((2 * middle.x) / width - 1, (2 * attachment.y) / height - 1),
  };
}

export class CupertinoMenuLayout extends SingleChildLayoutDelegate {
  constructor(
    private readonly info: RawMenuOverlayInfo,
    private readonly attachment: ReturnType<typeof menuAttachment>,
    private readonly padding: EdgeInsets,
    private readonly avoided: readonly Rect[],
    private readonly heightFactor: number,
    private readonly constrainWidth: boolean,
    private readonly rtl: boolean,
  ) {
    super();
  }

  private screen(size: Size): Rect {
    const rect = Rect.fromLTWH(0, 0, size.width, size.height);
    let chosen = rect;
    let distance = Infinity;
    for (const screen of DisplayFeatureSubScreen.subScreensInBounds(rect, this.avoided)) {
      const candidate = squaredDistanceToMenuRect(this.attachment.anchor.center, screen);
      if (candidate === 0) return screen;
      if (candidate < distance) {
        chosen = screen;
        distance = candidate;
      }
    }
    return chosen;
  }

  override getConstraintsForChild(constraints: BoxConstraints): BoxConstraints {
    const screen = this.screen(this.info.overlaySize);
    const maxWidth = this.constrainWidth
      ? Math.max(0, Math.min(screen.width, constraints.maxWidth) - this.padding.horizontal)
      : Infinity;
    const maxHeight = Math.max(
      0,
      Math.min(screen.height, constraints.maxHeight) - this.padding.vertical,
    );
    return new BoxConstraints(0, maxWidth, 0, maxHeight);
  }

  override getPositionForChild(size: Size, child: Size): Offset {
    const { alignment, anchor, attachment } = this.attachment;
    const fullHeight = Math.min(size.height, child.height / Math.max(0.01, this.heightFactor));
    const screen = this.screen(size);
    const minimumX = screen.left + this.padding.left;
    const maximumX = screen.right - this.padding.right - child.width;
    const minimumY = screen.top + this.padding.top;
    const maximumY = screen.bottom - this.padding.bottom - fullHeight;
    const origin = alignment.alongSize({ width: child.width, height: fullHeight });
    const x = attachment.x - origin.x;
    let y = attachment.y - origin.y;
    const flippedX = 2 * anchor.center.x - x - child.width;
    let horizontalOverlap = maximumX < minimumX;
    let left: number;
    if (horizontalOverlap) left = this.rtl ? maximumX : minimumX;
    else if (x >= minimumX && x <= maximumX) left = x;
    else if (flippedX >= minimumX && flippedX <= maximumX) left = flippedX;
    else {
      left = clamp(x, minimumX, maximumX);
      horizontalOverlap = true;
    }
    if (horizontalOverlap && !anchor.isEmpty && y < anchor.bottom && y + fullHeight > anchor.top) {
      y = anchor.bottom - y > y + fullHeight - anchor.top ? anchor.top - fullHeight : anchor.bottom;
    }
    const flippedY = 2 * anchor.center.y - (attachment.y - origin.y) - fullHeight;
    const top =
      y >= minimumY && y <= maximumY
        ? y
        : flippedY >= minimumY && flippedY <= maximumY
          ? flippedY
          : clamp(y, minimumY, maximumY);
    return {
      x: left,
      y:
        top + fullHeight <= anchor.center.y
          ? top + fullHeight - child.height
          : anchor.bottom + (top - anchor.bottom) * this.heightFactor,
    };
  }

  override shouldRelayout(old: SingleChildLayoutDelegate): boolean {
    return (
      !(old instanceof CupertinoMenuLayout) ||
      old.info !== this.info ||
      old.attachment !== this.attachment ||
      old.heightFactor !== this.heightFactor ||
      old.constrainWidth !== this.constrainWidth ||
      old.rtl !== this.rtl ||
      !old.padding.equals(this.padding) ||
      old.avoided !== this.avoided
    );
  }
}

export class MenuMidpointLayout extends SingleChildLayoutDelegate {
  constructor(private readonly alignment: Alignment) {
    super();
  }

  override getConstraintsForChild(constraints: BoxConstraints): BoxConstraints {
    return constraints.loosen();
  }

  override getPositionForChild(size: Size, child: Size): Offset {
    const anchor = this.alignment.alongSize(size);
    return {
      x: clamp(anchor.x - child.width / 2, 0, size.width - child.width),
      y: clamp(anchor.y - child.height / 2, 0, size.height - child.height),
    };
  }

  override shouldRelayout(old: SingleChildLayoutDelegate): boolean {
    return !(old instanceof MenuMidpointLayout) || !old.alignment.equals(this.alignment);
  }
}

export class CupertinoMenuShadow extends CustomPainter {
  constructor(private readonly fade: number) {
    super();
  }

  override paint(canvas: Canvas, size: Size): void {
    if (this.fade <= 0 || size.width <= 0 || size.height <= 0) return;
    const rect = Rect.fromLTWH(0, 0, size.width, size.height);
    const radius = Radius.circular(13);
    const shadow = menuShadowShape.getOuterPath(rect.inflate(50));
    const outside = new Path();
    outside.fillType = 'evenOdd';
    outside.addRect(rect.inflate(200));
    outside.addRRect(RRect.fromRectAndRadius(rect, radius));
    const alpha = Math.round(255 * 0.12 * this.fade * this.fade);
    canvas.save();
    try {
      canvas.clipPath(outside);
      canvas.drawPath(
        shadow,
        new Paint({
          color: ((alpha << 24) | 10) >>> 0,
          maskFilter: MaskFilter.blur('normal', this.fade * 50),
        }),
      );
    } finally {
      canvas.restore();
    }
  }

  override shouldRepaint(old: CustomPainter): boolean {
    return !(old instanceof CupertinoMenuShadow) || old.fade !== this.fade;
  }
}

const menuShadowShape = new RoundedSuperellipseBorder({ borderRadius: BorderRadius.circular(63) });
