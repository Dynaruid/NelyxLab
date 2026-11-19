// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/bottom_app_bar.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { NotchedShape } from '@nelyx/core/framework/painting/notched-shapes';
import { CustomClipper } from '@nelyx/core/framework/rendering/clip';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { Padding, PhysicalShape, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { Path } from '@nelyx/core/ui/path';
import { Rect } from '@nelyx/core/ui/rect';
import { BottomAppBarTheme } from './bottom-app-bar-theme.ts';
import { ElevationOverlay } from './elevation-overlay.ts';
import { Material, MaterialType } from './material.ts';
import { Scaffold } from './scaffold.ts';
import type { ScaffoldGeometry } from './scaffold.ts';
import { Theme } from './theme.ts';
import { ScaffoldGeometryNotifier } from './internal/scaffold-geometry.ts';

const defaultPadding = EdgeInsets.symmetric({ vertical: 12, horizontal: 16 });
const transparent = new Color(0);

export interface BottomAppBarOptions extends WidgetOptions {
  readonly child?: Widget | null;
  readonly color?: Color | null;
  readonly elevation?: number | null;
  readonly shape?: NotchedShape | null;
  readonly clipBehavior?: Clip;
  readonly notchMargin?: number;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly surfaceTintColor?: Color | null;
  readonly shadowColor?: Color | null;
  readonly height?: number | null;
}

export class BottomAppBar extends StatefulWidget {
  readonly child: Widget | null;
  readonly color: Color | null;
  readonly elevation: number | null;
  readonly shape: NotchedShape | null;
  readonly clipBehavior: Clip;
  readonly notchMargin: number;
  readonly padding: EdgeInsetsGeometry | null;
  readonly surfaceTintColor: Color | null;
  readonly shadowColor: Color | null;
  readonly height: number | null;

  constructor({
    child = null,
    color = null,
    elevation = null,
    shape = null,
    clipBehavior = 'none',
    notchMargin = 4,
    padding = null,
    surfaceTintColor = null,
    shadowColor = null,
    height = null,
    key = null,
  }: BottomAppBarOptions = {}) {
    super(key);
    invariant(
      elevation === null || elevation >= 0,
      'invalid-bottom-app-bar-elevation',
      'BottomAppBar elevation must be nonnegative',
    );
    this.child = child;
    this.color = color;
    this.elevation = elevation;
    this.shape = shape;
    this.clipBehavior = clipBehavior;
    this.notchMargin = notchMargin;
    this.padding = padding;
    this.surfaceTintColor = surfaceTintColor;
    this.shadowColor = shadowColor;
    this.height = height;
  }

  override createState(): State<BottomAppBar> {
    return new BottomAppBarState();
  }
}

class BottomAppBarState extends State<BottomAppBar> {
  private readonly materialKey = new GlobalKey('BottomAppBar material');

  override build(context: BuildContext): Widget {
    const widget = this.widget;
    const local = BottomAppBarTheme.of(context);
    const theme = Theme.of(context);
    const geometry = Scaffold.geometryOf(context);
    const shape = widget.shape ?? local.shape;
    const elevation = widget.elevation ?? local.elevation ?? 3;
    const color = widget.color ?? local.color ?? new Color(theme.colorScheme.surfaceContainer);
    const tint = widget.surfaceTintColor ?? local.surfaceTintColor ?? transparent;
    const shadow = widget.shadowColor ?? local.shadowColor ?? transparent;
    const child = new SizedBox(
      undefined,
      widget.height ?? local.height ?? 80,
      new Padding(
        widget.padding ?? local.padding ?? defaultPadding,
        widget.child ?? new SizedBox(),
      ),
    );
    return new PhysicalShape({
      clipper: new BottomAppBarClipper(geometry, shape, this.materialKey, widget.notchMargin),
      elevation,
      color: ElevationOverlay.applySurfaceTint(color, tint, elevation).toARGB32(),
      shadowColor: shadow.toARGB32(),
      clipBehavior: widget.clipBehavior,
      child: new Material({
        type: MaterialType.transparency,
        key: this.materialKey,
        child: new SafeArea({ child }),
      }),
    });
  }
}

class BottomAppBarClipper extends CustomClipper<Path> {
  constructor(
    readonly geometry: ValueListenable<ScaffoldGeometry>,
    readonly shape: NotchedShape | null,
    readonly materialKey: GlobalKey,
    readonly notchMargin: number,
  ) {
    super({ reclip: shape ? geometry : null });
  }

  override getClip(size: Size): Path {
    const host = Rect.fromLTWH(0, 0, size.width, size.height);
    const data =
      this.geometry instanceof ScaffoldGeometryNotifier
        ? this.geometry.clipGeometry
        : this.geometry.value;
    if (this.shape && data.floatingActionButtonArea) {
      let top = data.bottomNavigationBarTop;
      if (top === null) {
        const render = this.materialKey.currentContext?.findRenderObject();
        top =
          render instanceof RenderBox && render.attached
            ? render.localToGlobal({ x: 0, y: 0 }).y
            : 0;
      }
      return this.shape.getOuterPath(
        host,
        data.floatingActionButtonArea.translate(0, -top).inflate(this.notchMargin),
      );
    }
    const result = new Path();
    result.addRect(host);
    return result;
  }

  override shouldReclip(old: CustomClipper<Path>): boolean {
    return (
      !(old instanceof BottomAppBarClipper) ||
      old.geometry !== this.geometry ||
      old.shape !== this.shape ||
      old.notchMargin !== this.notchMargin
    );
  }
}
