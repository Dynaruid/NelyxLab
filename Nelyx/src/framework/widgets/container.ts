// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter widgets/container.dart at 71e4717a61786faab4c7aa39825989305ed29e8a; color uses the existing ARGB paint transport.
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { protect } from '../../ui/value-math.ts';
import { Rect } from '../../ui/rect.ts';
import type { Path } from '../../ui/path.ts';
import type { Size } from '../../ui/geometry.ts';
import type { Clip } from '../../ui/clip.ts';
import type { Matrix4 } from '../../math/matrix4.ts';
import type { AlignmentGeometry } from '../painting/alignment.ts';
import type { EdgeInsetsGeometry } from '../painting/edge-insets.ts';
import type { Decoration } from '../painting/decoration.ts';
import { BoxConstraints } from '../rendering/constraints.ts';
import { CustomClipper } from '../rendering/clip.ts';
import { StatelessWidget } from './framework.ts';
import type { Widget, WidgetOptions, BuildContext } from './framework.ts';
import {
  Align,
  LimitedBox,
  ConstrainedBox,
  Padding,
  ColoredBox,
  DecoratedBox,
  Transform,
} from './basic.ts';
import { ClipPath } from './clip.ts';
import { Directionality } from './app-data.ts';
export interface ContainerOptions extends WidgetOptions {
  readonly child?: Widget | null;
  readonly alignment?: AlignmentGeometry | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly color?: number | null;
  readonly isAntiAlias?: boolean;
  readonly decoration?: Decoration | null;
  readonly foregroundDecoration?: Decoration | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly constraints?: BoxConstraints | null;
  readonly margin?: EdgeInsetsGeometry | null;
  readonly transform?: Matrix4 | null;
  readonly transformAlignment?: AlignmentGeometry | null;
  readonly clipBehavior?: Clip;
}
export class Container extends StatelessWidget {
  readonly child: Widget | null;
  readonly alignment: AlignmentGeometry | null;
  readonly padding: EdgeInsetsGeometry | null;
  readonly color: number | null;
  readonly isAntiAlias: boolean;
  readonly decoration: Decoration | null;
  readonly foregroundDecoration: Decoration | null;
  readonly constraints: BoxConstraints | null;
  readonly margin: EdgeInsetsGeometry | null;
  readonly transform: Matrix4 | null;
  readonly transformAlignment: AlignmentGeometry | null;
  readonly clipBehavior: Clip;
  constructor({
    key = null,
    child = null,
    alignment = null,
    padding = null,
    color = null,
    isAntiAlias = true,
    decoration = null,
    foregroundDecoration = null,
    width = null,
    height = null,
    constraints = null,
    margin = null,
    transform = null,
    transformAlignment = null,
    clipBehavior = 'none',
  }: ContainerOptions = {}) {
    super(key);
    if (FoundationBuildMode.debug) {
      invariant(
        margin === null || margin.isNonNegative,
        'negative-container-margin',
        'Container margin must be nonnegative',
      );
      invariant(
        padding === null || padding.isNonNegative,
        'negative-container-padding',
        'Container padding must be nonnegative',
      );
      invariant(
        decoration === null || decoration.debugAssertIsValid(),
        'invalid-container-decoration',
        'Container decoration must be valid',
      );
      constraints?.debugAssertIsValid();
      invariant(
        decoration !== null || clipBehavior === 'none',
        'missing-clip-decoration',
        'Container clipping requires a decoration',
      );
      invariant(
        color === null || decoration === null,
        'ambiguous-container-color',
        'Choose either color or decoration',
      );
    }
    this.child = child;
    this.alignment = alignment;
    this.padding = padding;
    this.color = color;
    this.isAntiAlias = isAntiAlias;
    this.decoration = decoration;
    this.foregroundDecoration = foregroundDecoration;
    this.constraints =
      width !== null || height !== null
        ? (constraints?.tighten(width, height) ?? BoxConstraints.tightFor(width, height))
        : constraints;
    this.margin = margin;
    this.transform = transform;
    this.transformAlignment = transformAlignment;
    this.clipBehavior = clipBehavior;
    protect(this, [
      'child',
      'alignment',
      'padding',
      'color',
      'isAntiAlias',
      'decoration',
      'foregroundDecoration',
      'constraints',
      'margin',
      'transform',
      'transformAlignment',
      'clipBehavior',
    ]);
  }
  private get paddingIncludingDecoration(): EdgeInsetsGeometry | null {
    const decorationPadding = this.decoration?.padding ?? null;
    return this.padding === null
      ? decorationPadding
      : decorationPadding === null
        ? this.padding
        : this.padding.add(decorationPadding);
  }
  build(context: BuildContext): Widget {
    let current = this.child ?? undefined;
    if (this.child === null && (this.constraints === null || !this.constraints.isTight))
      current = new LimitedBox(new ConstrainedBox(undefined, BoxConstraints.expand()), {
        maxWidth: 0,
        maxHeight: 0,
      });
    else if (this.alignment !== null) current = new Align(current, { alignment: this.alignment });
    const padding = this.paddingIncludingDecoration;
    if (padding !== null) current = new Padding(padding, current);
    if (this.color !== null)
      current = new ColoredBox({
        color: this.color,
        isAntiAlias: this.isAntiAlias,
        child: current ?? null,
      });
    if (this.clipBehavior !== 'none') {
      invariant(
        this.decoration !== null,
        'missing-clip-decoration',
        'Container clipping requires a decoration',
      );
      current = new ClipPath(current, {
        clipBehavior: this.clipBehavior,
        clipper: new DecorationClipper(
          this.decoration,
          context.maybeDependOn(Directionality)?.direction ?? 'ltr',
        ),
      });
    }
    if (this.decoration !== null)
      current = new DecoratedBox(current, { decoration: this.decoration });
    if (this.foregroundDecoration !== null)
      current = new DecoratedBox(current, {
        decoration: this.foregroundDecoration,
        position: 'foreground',
      });
    if (this.constraints !== null) current = new ConstrainedBox(current, this.constraints);
    if (this.margin !== null) current = new Padding(this.margin, current);
    if (this.transform !== null)
      current = new Transform(current, this.transform.storage, null, {
        alignment: this.transformAlignment,
      });
    invariant(
      current !== undefined,
      'empty-container-composition',
      'Container composition must produce a widget',
    );
    return current;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new DiagnosticsProperty('alignment', this.alignment, { showName: false, defaultValue: null }),
    );
    properties.add(new DiagnosticsProperty('padding', this.padding, { defaultValue: null }));
    properties.add(
      new DiagnosticsProperty('clipBehavior', this.clipBehavior, { defaultValue: 'none' }),
    );
    properties.add(
      new DiagnosticsProperty('bg', this.color ?? this.decoration, { defaultValue: null }),
    );
    properties.add(
      new DiagnosticsProperty('fg', this.foregroundDecoration, { defaultValue: null }),
    );
    properties.add(
      new DiagnosticsProperty('constraints', this.constraints, { defaultValue: null }),
    );
    properties.add(new DiagnosticsProperty('margin', this.margin, { defaultValue: null }));
    properties.add(new DiagnosticsProperty('transform', this.transform, { defaultValue: null }));
  }
}
class DecorationClipper extends CustomClipper<Path> {
  constructor(
    readonly decoration: Decoration,
    readonly textDirection: 'ltr' | 'rtl',
  ) {
    super();
  }
  getClip(size: Size): Path {
    return this.decoration.getClipPath(
      Rect.fromLTWH(0, 0, size.width, size.height),
      this.textDirection,
    );
  }
  shouldReclip(old: CustomClipper<Path>): boolean {
    return (
      !(old instanceof DecorationClipper) ||
      !this.decorationEquals(old.decoration) ||
      old.textDirection !== this.textDirection
    );
  }
  private decorationEquals(other: Decoration): boolean {
    return (
      this.decoration === other ||
      ('equals' in this.decoration &&
        typeof this.decoration.equals === 'function' &&
        (this.decoration as Decoration & { equals(value: unknown): boolean }).equals(other))
    );
  }
}
