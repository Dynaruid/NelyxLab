// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from packages/flutter/lib/src/cupertino/nav_bar.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import type { Alignment } from '@nelyx/core/framework/painting/alignment';
import { BoxBorder, Border } from '@nelyx/core/framework/painting/box-border';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { RenderObject, TextBaseline } from '@nelyx/core/framework/rendering/object';
import { RenderShiftedBox } from '@nelyx/core/framework/rendering/shifted-box';
import {
  AnnotatedRegion,
  systemUiOverlayStyleAnnotation,
} from '@nelyx/core/framework/widgets/annotated-region';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { BackdropFilter } from '@nelyx/core/framework/widgets/backdrop-filter';
import { DecoratedBox, Padding } from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import { SingleChildRenderObjectWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { AnimatedOpacity } from '@nelyx/core/framework/widgets/implicit-animations';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SystemUiOverlayStyle } from '@nelyx/core/services/system-ui-overlay-style';
import { Color } from '@nelyx/core/ui/color';
import { multiply } from '@nelyx/core/ui/geometry';
import type { Offset, Size, TransformMatrix } from '@nelyx/core/ui/geometry';
import { ImageFilter } from '@nelyx/core/ui/image-filter';

export const navBarLargeTitleHeight = 52;
export const navBarLargeTitleThreshold = 10;
export const navBarScrollUnderExtent = 10;
export const navBarEdgePadding = 16;
export const navBarBottomPadding = 8;
export const minNavBarScale = 0.9;
export const maxNavBarScale = 1.235;
export const navBarLargeTitleDamping = 3;
const titleFadeDuration = 150;
const defaultBorderColor = 0x4d000000;
const defaultBorder = new Border({
  bottom: new BorderSide({ color: defaultBorderColor, width: 0 }),
});
const transparentBorder = new Border({ bottom: new BorderSide({ color: 0, width: 0 }) });
const blur = ImageFilter.blur({ sigmaX: 10, sigmaY: 10 });

export function clampedFraction(value: number): number {
  return Math.max(0, Math.min(value, 1));
}

export function dampNavBarScale(scaler: TextScaler, fontSize: number, damping: number): number {
  const factor = scaler.scale(fontSize) / fontSize;
  return factor < 1 ? Math.max(minNavBarScale, factor) : 1 + (factor - 1) / damping;
}

export interface NavBarSurfaceOptions {
  readonly border?: Border | null;
  readonly brightness?: 'light' | 'dark' | null;
  readonly enableBackgroundFilterBlur?: boolean;
  readonly automaticBackgroundVisibility?: boolean;
}

export function navBarSurface(
  options: NavBarSurfaceOptions,
  barColor: Color,
  pageColor: Color | null,
  opacity: number,
): { color: Color; border: BoxBorder | null } {
  const border = options.border === undefined ? defaultBorder : options.border;
  if (options.automaticBackgroundVisibility === false || pageColor === null)
    return { color: barColor, border };
  return {
    color: Color.lerp(pageColor, barColor, opacity) ?? barColor,
    border: border === null ? null : BoxBorder.lerp(transparentBorder, border, opacity),
  };
}

export function paintNavBarSurface(
  child: Widget,
  { color, border }: ReturnType<typeof navBarSurface>,
  options: NavBarSurfaceOptions,
  updateSystemUiOverlay = true,
): Widget {
  if (updateSystemUiOverlay) {
    const brightness = options.brightness ?? (color.computeLuminance() < 0.179 ? 'dark' : 'light');
    const overlay = brightness === 'dark' ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark;
    const value = new SystemUiOverlayStyle({
      statusBarColor: overlay.statusBarColor,
      statusBarBrightness: overlay.statusBarBrightness,
      statusBarIconBrightness: overlay.statusBarIconBrightness,
      systemStatusBarContrastEnforced: overlay.systemStatusBarContrastEnforced,
    });
    child = new AnnotatedRegion(child, { value, annotationType: systemUiOverlayStyleAnnotation });
  }
  const decorated = new DecoratedBox(child, {
    decoration: new BoxDecoration({ color: color.toARGB32(), border }),
  });
  return new ClipRect(
    new BackdropFilter({
      filter: blur,
      enabled: color.alpha !== 255 && options.enableBackgroundFilterBlur !== false,
      child: decorated,
    }),
  );
}

export function fadeNavBarTitle(child: Widget, visible: boolean): Widget {
  return new AnimatedOpacity({
    opacity: visible ? 1 : 0,
    duration: titleFadeDuration,
    child: new ExcludeFocus(
      new ExcludeSemantics({
        excluding: !visible,
        child: new IgnorePointer(child, { ignoring: !visible }),
      }),
      { excluding: !visible },
    ),
  });
}

export function navBarLargeTitle(
  child: Widget,
  height: number,
  textStyle: TextStyle,
  textScale: number,
): Widget {
  const styled = new DefaultTextStyle(
    textStyle.apply({ fontSizeFactor: textScale }),
    new LargeTitle(child, height),
    { maxLines: 1, overflow: 'ellipsis', softWrap: false },
  );
  return new ClipRect(
    new SafeArea({
      top: false,
      bottom: false,
      child: new Padding(
        EdgeInsetsDirectional.only({
          start: navBarEdgePadding,
          end: navBarEdgePadding,
          bottom: navBarBottomPadding,
        }),
        new Semantics({ header: true, child: MediaQuery.withNoTextScaling({ child: styled }) }),
      ),
    }),
  );
}

class LargeTitle extends SingleChildRenderObjectWidget {
  constructor(
    child: Widget,
    readonly height: number,
  ) {
    super(child);
  }

  override createRenderObject(context: BuildContext): RenderLargeTitle {
    return new RenderLargeTitle(
      AlignmentDirectional.bottomStart.resolve(Directionality.of(context)),
      this.height,
    );
  }

  override updateRenderObject(context: BuildContext, render: RenderLargeTitle): void {
    render.configure(
      AlignmentDirectional.bottomStart.resolve(Directionality.of(context)),
      this.height,
    );
  }
}

class RenderLargeTitle extends RenderShiftedBox {
  private titleScale = 1;

  constructor(
    private alignment: Alignment,
    private height: number,
  ) {
    super();
  }

  configure(alignment: Alignment, height: number): void {
    if (alignment.equals(this.alignment) && height === this.height) return;
    this.assertCanMutateLayoutProperty();
    this.alignment = alignment;
    this.height = height;
    this.markNeedsLayout();
  }

  private availableSize(constraints: BoxConstraints, child: Size): Size {
    return {
      width: constraints.hasBoundedWidth ? constraints.maxWidth : child.width,
      height: constraints.hasBoundedHeight ? constraints.maxHeight : child.height,
    };
  }

  private titleGeometry(size: Size, child: Size): { offset: Offset; factor: number } {
    const maxHeight = Math.max(1, this.height - navBarBottomPadding);
    const widthLimit = child.width > 0 ? Math.max(1, size.width / child.width) : 1.1;
    const stretchScale = 1 + (0.03 * (size.height - maxHeight)) / maxHeight;
    const factor = Math.max(1, Math.min(stretchScale, widthLimit, 1.1));
    return {
      factor,
      offset: this.alignment.alongSize({
        width: size.width - child.width * factor,
        height: size.height - child.height * factor,
      }),
    };
  }

  protected override performLayout(constraints: BoxConstraints): Size {
    const child = this.child;
    if (!child) return this.availableSize(constraints, constraints.smallest);
    child.layout(new BoxConstraints(0, constraints.maxWidth), { parentUsesSize: true });
    const size = this.availableSize(constraints, child.size);
    const { factor, offset } = this.titleGeometry(size, child.size);
    this.titleScale = factor;
    child.layoutOffset = offset;
    return size;
  }

  protected override computeDryLayout(constraints: BoxConstraints): Size {
    const size = this.child?.getDryLayout(new BoxConstraints(0, constraints.maxWidth));
    return this.availableSize(constraints, size ?? constraints.smallest);
  }

  protected override computeDistanceToActualBaseline(baseline: TextBaseline): number | null {
    const child = this.child;
    const base = child?.getDistanceToActualBaseline(baseline) ?? null;
    return child && base !== null ? base * this.titleScale + child.layoutOffset.y : null;
  }

  protected override computeDryBaseline(
    constraints: BoxConstraints,
    baseline: TextBaseline,
  ): number | null {
    const child = this.child;
    if (!child) return null;
    const limits = new BoxConstraints(0, constraints.maxWidth);
    const base = child.getDryBaseline(limits, baseline);
    if (base === null) return null;
    const childSize = child.getDryLayout(limits);
    const { factor, offset } = this.titleGeometry(
      this.availableSize(constraints, childSize),
      childSize,
    );
    return base * factor + offset.y;
  }

  protected override childTransform(child: RenderObject): TransformMatrix {
    return multiply(super.childTransform(child), [this.titleScale, 0, 0, this.titleScale, 0, 0]);
  }
}
