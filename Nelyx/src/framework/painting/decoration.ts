// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '../../foundation/errors.ts';
import { Diagnosticable } from '../../foundation/diagnosticable.ts';
import type { Canvas } from '../../ui/canvas.ts';
import type { Rect } from '../../ui/rect.ts';
import type { Path } from '../../ui/path.ts';
import type { Offset, Size } from '../../ui/geometry.ts';
import { EdgeInsets, EdgeInsetsGeometry } from './edge-insets.ts';
import type { ImageConfiguration } from './image-configuration.ts';
export type DecorationPosition = 'background' | 'foreground';
export abstract class Decoration extends Diagnosticable(class {}) {
  override toStringShort(): string {
    return this.constructor.name;
  }
  get padding(): EdgeInsetsGeometry {
    return EdgeInsets.zero;
  }
  get isComplex(): boolean {
    return false;
  }
  debugAssertIsValid(): boolean {
    return true;
  }
  lerpFrom(_a: Decoration | null, _t: number): Decoration | null {
    return null;
  }
  lerpTo(_b: Decoration | null, _t: number): Decoration | null {
    return null;
  }
  static lerp(a: Decoration | null, b: Decoration | null, t: number): Decoration | null {
    if (a === b) return a;
    if (a === null) return b!.lerpFrom(null, t) ?? b;
    if (b === null) return a.lerpTo(null, t) ?? a;
    if (t === 0) return a;
    if (t === 1) return b;
    return (
      b.lerpFrom(a, t) ??
      a.lerpTo(b, t) ??
      (t < 0.5 ? (a.lerpTo(null, t * 2) ?? a) : (b.lerpFrom(null, (t - 0.5) * 2) ?? b))
    );
  }
  hitTest(
    _size: Size,
    _point: Offset,
    _options: { readonly textDirection?: 'ltr' | 'rtl' | null } = {},
  ): boolean {
    return true;
  }
  getClipPath(_rect: Rect, _textDirection: 'ltr' | 'rtl'): Path {
    throw new Error(`${this.constructor.name} does not support clipping`);
  }
  abstract createBoxPainter(onChanged?: (() => void) | null): BoxPainter;
}
export abstract class BoxPainter {
  private dead = false;
  private changed: (() => void) | null;
  constructor(onChanged: (() => void) | null = null) {
    this.changed = onChanged;
  }
  get onChanged(): (() => void) | null {
    return this.dead ? null : this.changed;
  }
  get debugDisposed(): boolean {
    return this.dead;
  }
  protected assertLive(): void {
    invariant(!this.dead, 'disposed-box-painter', 'Cannot paint a disposed BoxPainter');
  }
  abstract paint(canvas: Canvas, offset: Offset, configuration: ImageConfiguration): void;
  dispose(): void {
    this.dead = true;
    this.changed = null;
  }
}
