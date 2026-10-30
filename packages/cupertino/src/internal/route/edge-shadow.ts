// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Decoration, BoxPainter } from '@nelyx/core/framework/painting/decoration';
import { DecorationTween } from '@nelyx/core/framework/widgets/implicit-animations';
import { Color } from '@nelyx/core/ui/color';
import { Rect } from '@nelyx/core/ui/rect';
import { Paint } from '@nelyx/core/ui/paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Offset } from '@nelyx/core/ui/geometry';
import type { ImageConfiguration } from '@nelyx/core/framework/painting/image-configuration';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { invariant } from '@nelyx/core/foundation/errors';
import { IterableProperty } from '@nelyx/core/foundation/diagnostic-properties';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';

// Source List equality/hash is identity based; this is the local host hash ABI.
const colorListIdentities = new WeakMap<readonly Color[], number>();
let nextColorListIdentity = 0;
class CupertinoEdgeShadowDecoration extends Decoration {
  constructor(readonly colors: readonly Color[] | null = null) {
    super();
  }
  /** @dartParam t double */
  static lerp(
    a: CupertinoEdgeShadowDecoration | null,
    b: CupertinoEdgeShadowDecoration | null,
    t: number,
  ): CupertinoEdgeShadowDecoration | null {
    if (a === b) return a;
    if (a === null)
      return b!.colors === null
        ? b
        : new CupertinoEdgeShadowDecoration(b!.colors.map((color) => Color.lerp(null, color, t)!));
    if (b === null)
      return a.colors === null
        ? a
        : new CupertinoEdgeShadowDecoration(
            a.colors.map((color) => Color.lerp(null, color, 1 - t)!),
          );
    if (FoundationBuildMode.debug) {
      invariant(
        b.colors !== null || a.colors !== null,
        'empty-edge-shadow-lerp',
        'At least one edge shadow needs colors',
      );
      invariant(
        b.colors === null || a.colors === null || a.colors.length === b.colors.length,
        'edge-shadow-color-count',
        'Source edge shadows need equal color counts',
      );
    }
    // The pinned source dereferences b._colors even when a has colors.
    invariant(
      b.colors !== null,
      'null-edge-shadow-colors',
      'Source edge-shadow lerp requires non-null b colors',
    );
    return new CupertinoEdgeShadowDecoration(
      b.colors.map((color, index) => Color.lerp(a.colors?.[index] ?? null, color, t)!),
    );
  }
  /** @dartParam t double */
  override lerpFrom(a: Decoration | null, t: number): CupertinoEdgeShadowDecoration {
    return CupertinoEdgeShadowDecoration.lerp(
      a instanceof CupertinoEdgeShadowDecoration ? a : null,
      this,
      t,
    )!;
  }
  /** @dartParam t double */
  override lerpTo(b: Decoration | null, t: number): CupertinoEdgeShadowDecoration {
    return CupertinoEdgeShadowDecoration.lerp(
      this,
      b instanceof CupertinoEdgeShadowDecoration ? b : null,
      t,
    )!;
  }
  createBoxPainter(onChanged: (() => void) | null = null): BoxPainter {
    return new CupertinoEdgeShadowPainter(this, onChanged);
  }
  equals(other: unknown): boolean {
    return (
      other instanceof CupertinoEdgeShadowDecoration &&
      other.constructor === this.constructor &&
      other.colors === this.colors
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    if (this.colors === null) return 0;
    let id = colorListIdentities.get(this.colors);
    if (id === undefined) colorListIdentities.set(this.colors, (id = ++nextColorListIdentity));
    return id;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new IterableProperty<Color>('colors', this.colors, { elementType: 'Color' }));
  }
}
class CupertinoEdgeShadowPainter extends BoxPainter {
  constructor(
    private readonly decoration: CupertinoEdgeShadowDecoration,
    onChanged: (() => void) | null,
  ) {
    super(onChanged);
    if (FoundationBuildMode.debug)
      invariant(
        decoration.colors === null || decoration.colors.length > 1,
        'invalid-edge-shadow-colors',
        'An edge shadow needs at least two colors',
      );
  }
  paint(canvas: Canvas, offset: Offset, configuration: ImageConfiguration): void {
    this.assertLive();
    const colors = this.decoration.colors;
    if (colors === null) return;
    invariant(configuration.size !== null, 'missing-shadow-size', 'Edge shadow requires a size');
    /** @dartType double */
    const shadowWidth = 0.05 * configuration.size.width;
    /** @dartType double */
    const shadowHeight = configuration.size.height;
    /** @dartType double */
    const bandWidth = shadowWidth / (colors.length - 1);
    invariant(
      configuration.textDirection !== null,
      'missing-shadow-direction',
      'Edge shadow requires Directionality',
    );
    /** @dartType double */
    const shadowDirection = configuration.textDirection === 'rtl' ? 1 : -1;
    /** @dartType double */
    const start =
      configuration.textDirection === 'rtl' ? offset.x + configuration.size.width : offset.x;
    /** @dartType int */
    let bandColorIndex = 0;
    /** @dartType int */
    let dx = 0;
    for (; dx < shadowWidth; dx++) {
      if (Math.trunc(dx / bandWidth) !== bandColorIndex) bandColorIndex++;
      const paint = new Paint();
      paint.color = Color.lerp(
        colors[bandColorIndex]!,
        colors[bandColorIndex + 1]!,
        (dx % bandWidth) / bandWidth,
      )!.toARGB32();
      /** @dartType double */
      const x = start + shadowDirection * dx;
      canvas.drawRect(Rect.fromLTWH(x - 1, offset.y, 1, shadowHeight), paint);
    }
  }
}
/** Shared source-private decoration, exposed only through the internal facade. */
export const cupertinoEdgeShadowTween: DecorationTween = new DecorationTween({
  begin: new CupertinoEdgeShadowDecoration(),
  end: new CupertinoEdgeShadowDecoration(
    Object.freeze([new Color(0x04000000), new Color(0x00000000)]),
  ),
});
