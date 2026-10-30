// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatelessWidget } from './framework.ts';
import type { Widget, WidgetOptions, BuildContext } from './framework.ts';
import { Padding, SliverPadding } from './basic.ts';
import { MediaQuery } from './app-data.ts';
import { EdgeInsets } from '../painting/edge-insets.ts';
import { FlagProperty } from '../../foundation/diagnostic-properties.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
export interface SafeAreaOptions extends WidgetOptions {
  readonly left?: boolean;
  readonly top?: boolean;
  readonly right?: boolean;
  readonly bottom?: boolean;
  readonly minimum?: EdgeInsets;
  readonly maintainBottomViewPadding?: boolean;
  readonly child: Widget;
}
export interface SliverSafeAreaOptions extends Omit<
  SafeAreaOptions,
  'child' | 'maintainBottomViewPadding'
> {
  readonly sliver: Widget;
}
interface Sides {
  readonly left: boolean;
  readonly top: boolean;
  readonly right: boolean;
  readonly bottom: boolean;
  readonly minimum: EdgeInsets;
}
function safeInsets(padding: EdgeInsets, sides: Sides): EdgeInsets {
  return new EdgeInsets(
    Math.max(sides.left ? padding.left : 0, sides.minimum.left),
    Math.max(sides.top ? padding.top : 0, sides.minimum.top),
    Math.max(sides.right ? padding.right : 0, sides.minimum.right),
    Math.max(sides.bottom ? padding.bottom : 0, sides.minimum.bottom),
  );
}
function diagnostics(properties: DiagnosticPropertiesBuilder, sides: Sides): void {
  for (const side of ['left', 'top', 'right', 'bottom'] as const)
    properties.add(new FlagProperty(side, sides[side], { ifTrue: 'avoid ' + side + ' padding' }));
}
export class SafeArea extends StatelessWidget {
  readonly left: boolean;
  readonly top: boolean;
  readonly right: boolean;
  readonly bottom: boolean;
  readonly minimum: EdgeInsets;
  readonly maintainBottomViewPadding: boolean;
  readonly child: Widget;
  constructor({
    key = null,
    left = true,
    top = true,
    right = true,
    bottom = true,
    minimum = EdgeInsets.zero,
    maintainBottomViewPadding = false,
    child,
  }: SafeAreaOptions) {
    super(key);
    this.left = left;
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.minimum = minimum;
    this.maintainBottomViewPadding = maintainBottomViewPadding;
    this.child = child;
  }
  override build(context: BuildContext): Widget {
    let padding = MediaQuery.paddingOf(context);
    if (this.maintainBottomViewPadding)
      padding = padding.copyWith({ bottom: MediaQuery.viewPaddingOf(context).bottom });
    return new Padding(
      safeInsets(padding, this),
      MediaQuery.removePadding({
        context,
        removeLeft: this.left,
        removeTop: this.top,
        removeRight: this.right,
        removeBottom: this.bottom,
        child: this.child,
      }),
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    diagnostics(properties, this);
  }
}
export class SliverSafeArea extends StatelessWidget {
  readonly left: boolean;
  readonly top: boolean;
  readonly right: boolean;
  readonly bottom: boolean;
  readonly minimum: EdgeInsets;
  readonly sliver: Widget;
  constructor({
    key = null,
    left = true,
    top = true,
    right = true,
    bottom = true,
    minimum = EdgeInsets.zero,
    sliver,
  }: SliverSafeAreaOptions) {
    super(key);
    this.left = left;
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.minimum = minimum;
    this.sliver = sliver;
  }
  override build(context: BuildContext): Widget {
    return new SliverPadding({
      padding: safeInsets(MediaQuery.paddingOf(context), this),
      sliver: MediaQuery.removePadding({
        context,
        removeLeft: this.left,
        removeTop: this.top,
        removeRight: this.right,
        removeBottom: this.bottom,
        child: this.sliver,
      }),
    });
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    diagnostics(properties, this);
  }
}
