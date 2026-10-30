// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from pinned rendering/image.dart; the setter takes ownership of its Image handle.
import { invariant } from '../../foundation/errors.ts';
import type { ValueListenable } from '../../foundation/notifier.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import { Image } from '../../ui/image.ts';
import { Rect } from '../../ui/rect.ts';
import { ColorFilter } from '../../ui/color-filter.ts';
import type { BlendMode } from '../../ui/paint.ts';
import type { FilterQuality } from '../../ui/paint-effects-data.ts';
import type { Size, Offset } from '../../ui/geometry.ts';
import { Alignment, AlignmentGeometry } from '../painting/alignment.ts';
import { paintImage } from '../painting/decoration-image.ts';
import type { ImageRepeat } from '../painting/decoration-image.ts';
import type { BoxFit } from '../painting/box-fit.ts';
import { valueEquals } from '../painting/value-equality.ts';
import type { PaintingContext } from '../painting/context.ts';
import { BoxConstraints } from './constraints.ts';
import { RenderBox } from './object.ts';
import type { PipelineOwner } from './object.ts';
export interface RenderImageOptions {
  readonly image?: Image | null;
  readonly debugImageLabel?: string | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly scale?: number;
  readonly color?: number | null;
  readonly opacity?: ValueListenable<number> | null;
  readonly colorBlendMode?: BlendMode | null;
  readonly blendMode?: BlendMode;
  readonly fit?: BoxFit | null;
  readonly alignment?: AlignmentGeometry;
  readonly repeat?: ImageRepeat;
  readonly centerSlice?: Rect | null;
  readonly matchTextDirection?: boolean;
  readonly textDirection?: 'ltr' | 'rtl' | null;
  readonly invertColors?: boolean;
  readonly isAntiAlias?: boolean;
  readonly filterQuality?: FilterQuality;
}
function failures(errors: unknown[], message: string): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, message);
}
export class RenderImage extends RenderBox {
  private value: Image | null = null;
  private w: number | null = null;
  private h: number | null = null;
  private density = 1;
  private tint: number | null = null;
  private alpha: ValueListenable<number> | null = null;
  private tintMode: BlendMode | null = null;
  private mode: BlendMode = 'srcOver';
  private fitting: BoxFit | null = null;
  private positioning: AlignmentGeometry = Alignment.center;
  private repeating: ImageRepeat = 'noRepeat';
  private slice: Rect | null = null;
  private directional = false;
  private direction: 'ltr' | 'rtl' | null = null;
  private inverted = false;
  private antialiased = false;
  private quality: FilterQuality = 'medium';
  private colorFilter: ColorFilter | null = null;
  private resolvedAlignment: Alignment | null = null;
  private flipHorizontally: boolean | null = null;
  private listening = false;
  debugImageLabel: string | null = null;
  private readonly opacityChanged = () => {
    if (this.attached && !this.debugDisposed) this.markNeedsPaint();
  };
  constructor({
    image = null,
    debugImageLabel = null,
    width = null,
    height = null,
    scale = 1,
    color = null,
    opacity = null,
    colorBlendMode = null,
    blendMode = 'srcOver',
    fit = null,
    alignment = Alignment.center,
    repeat = 'noRepeat',
    centerSlice = null,
    matchTextDirection = false,
    textDirection = null,
    invertColors = false,
    isAntiAlias = false,
    filterQuality = 'medium',
  }: RenderImageOptions = {}) {
    super();
    for (const value of [width, height]) this.validateDimension(value);
    invariant(
      Number.isFinite(scale) && scale > 0,
      'invalid-image-scale',
      'Image scale must be positive',
    );
    if (image) void image.resource;
    this.value = image;
    this.debugImageLabel = debugImageLabel;
    this.w = width;
    this.h = height;
    this.density = scale;
    this.tint = color;
    this.alpha = opacity;
    this.tintMode = colorBlendMode;
    this.mode = blendMode;
    this.fitting = fit;
    this.positioning = alignment;
    this.repeating = repeat;
    this.slice = centerSlice;
    this.directional = matchTextDirection;
    this.direction = textDirection;
    this.inverted = invertColors;
    this.antialiased = isAntiAlias;
    this.quality = filterQuality;
    this.updateColorFilter();
  }
  protected override get childCountLimit(): number {
    return 0;
  }
  private validateDimension(value: number | null): void {
    invariant(
      value === null || (typeof value === 'number' && !Number.isNaN(value) && value >= 0),
      'invalid-image-size',
      'Image dimensions must be nonnegative',
    );
  }
  private change<T>(old: T, next: T, apply: () => void, layout = false): void {
    this.assertCanMutateLayoutProperty();
    if (valueEquals(old, next)) return;
    apply();
    if (layout) this.markNeedsLayout();
    else this.markNeedsPaint();
  }
  get image(): Image | null {
    return this.value;
  }
  set image(next: Image | null) {
    this.assertCanMutateLayoutProperty();
    if (this.value === next) return;
    if (next) void next.resource;
    if (next && this.value && next.isCloneOf(this.value)) {
      next.dispose();
      return;
    }
    const previous = this.value,
      sizeChanged = previous?.width !== next?.width || previous?.height !== next?.height;
    this.value = next;
    const errors: unknown[] = [];
    for (const action of [
      () => this.markNeedsPaint(),
      () => {
        if (sizeChanged && (this.w === null || this.h === null)) this.markNeedsLayout();
      },
      () => previous?.dispose(),
    ])
      try {
        action();
      } catch (error) {
        errors.push(error);
      }
    failures(errors, 'Image replacement failed');
  }
  get width(): number | null {
    return this.w;
  }
  set width(value: number | null) {
    this.validateDimension(value);
    this.change(this.w, value, () => (this.w = value), true);
  }
  get height(): number | null {
    return this.h;
  }
  set height(value: number | null) {
    this.validateDimension(value);
    this.change(this.h, value, () => (this.h = value), true);
  }
  get scale(): number {
    return this.density;
  }
  set scale(value: number) {
    invariant(
      Number.isFinite(value) && value > 0,
      'invalid-image-scale',
      'Image scale must be positive',
    );
    this.change(this.density, value, () => (this.density = value), true);
  }
  private updateColorFilter(): void {
    this.colorFilter =
      this.tint === null ? null : ColorFilter.mode(this.tint, this.tintMode ?? 'srcIn');
  }
  get color(): number | null {
    return this.tint;
  }
  set color(value: number | null) {
    this.change(this.tint, value, () => {
      this.tint = value;
      this.updateColorFilter();
    });
  }
  get colorBlendMode(): BlendMode | null {
    return this.tintMode;
  }
  set colorBlendMode(value: BlendMode | null) {
    this.change(this.tintMode, value, () => {
      this.tintMode = value;
      this.updateColorFilter();
    });
  }
  get blendMode(): BlendMode {
    return this.mode;
  }
  set blendMode(value: BlendMode) {
    this.change(this.mode, value, () => (this.mode = value));
  }
  get opacity(): ValueListenable<number> | null {
    return this.alpha;
  }
  set opacity(value: ValueListenable<number> | null) {
    this.assertCanMutateLayoutProperty();
    if (value === this.alpha) return;
    const errors: unknown[] = [];
    try {
      this.unlistenOpacity();
    } catch (error) {
      errors.push(error);
    }
    this.alpha = value;
    if (this.attached)
      try {
        this.listenOpacity();
      } catch (error) {
        errors.push(error);
      }
    try {
      this.markNeedsPaint();
    } catch (error) {
      errors.push(error);
    }
    failures(errors, 'Image opacity replacement failed');
  }
  get filterQuality(): FilterQuality {
    return this.quality;
  }
  set filterQuality(value: FilterQuality) {
    this.change(this.quality, value, () => (this.quality = value));
  }
  get fit(): BoxFit | null {
    return this.fitting;
  }
  set fit(value: BoxFit | null) {
    this.change(this.fitting, value, () => (this.fitting = value));
  }
  private markNeedResolution(): void {
    this.resolvedAlignment = null;
    this.flipHorizontally = null;
  }
  get alignment(): AlignmentGeometry {
    return this.positioning;
  }
  set alignment(value: AlignmentGeometry) {
    this.change(this.positioning, value, () => {
      this.positioning = value;
      this.markNeedResolution();
    });
  }
  get repeat(): ImageRepeat {
    return this.repeating;
  }
  set repeat(value: ImageRepeat) {
    this.change(this.repeating, value, () => (this.repeating = value));
  }
  get centerSlice(): Rect | null {
    return this.slice;
  }
  set centerSlice(value: Rect | null) {
    this.change(this.slice, value, () => (this.slice = value));
  }
  get matchTextDirection(): boolean {
    return this.directional;
  }
  set matchTextDirection(value: boolean) {
    this.change(this.directional, value, () => {
      this.directional = value;
      this.markNeedResolution();
    });
  }
  get textDirection(): 'ltr' | 'rtl' | null {
    return this.direction;
  }
  set textDirection(value: 'ltr' | 'rtl' | null) {
    this.change(this.direction, value, () => {
      this.direction = value;
      this.markNeedResolution();
    });
  }
  get invertColors(): boolean {
    return this.inverted;
  }
  set invertColors(value: boolean) {
    this.change(this.inverted, value, () => (this.inverted = value));
  }
  get isAntiAlias(): boolean {
    return this.antialiased;
  }
  set isAntiAlias(value: boolean) {
    this.change(this.antialiased, value, () => (this.antialiased = value));
  }
  private resolve(): void {
    if (this.resolvedAlignment !== null) return;
    invariant(
      !this.directional || this.direction !== null,
      'missing-text-direction',
      'matchTextDirection requires a direction',
    );
    this.resolvedAlignment = this.positioning.resolve(this.direction);
    this.flipHorizontally = this.directional && this.direction === 'rtl';
  }
  private sizeForConstraints(constraints: BoxConstraints): Size {
    constraints = BoxConstraints.tightFor(this.w, this.h).enforce(constraints);
    return this.value === null
      ? constraints.smallest
      : constraints.constrainSizeAndAttemptToPreserveAspectRatio({
          width: this.value.width / this.density,
          height: this.value.height / this.density,
        });
  }
  protected override computeDryLayout(c: BoxConstraints): Size {
    return this.sizeForConstraints(c);
  }
  protected override performLayout(c: BoxConstraints): Size {
    return this.sizeForConstraints(c);
  }
  protected override computeMinIntrinsicWidth(height: number): number {
    return this.w === null && this.h === null
      ? 0
      : this.sizeForConstraints(BoxConstraints.tightForFinite(Infinity, height)).width;
  }
  protected override computeMaxIntrinsicWidth(height: number): number {
    return this.sizeForConstraints(BoxConstraints.tightForFinite(Infinity, height)).width;
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    return this.w === null && this.h === null
      ? 0
      : this.sizeForConstraints(BoxConstraints.tightForFinite(width, Infinity)).height;
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return this.sizeForConstraints(BoxConstraints.tightForFinite(width, Infinity)).height;
  }
  protected override hitTestSelf(_position: Offset): boolean {
    return true;
  }
  private listenOpacity(): void {
    if (this.listening || this.alpha === null) return;
    this.listening = true;
    this.alpha.addListener(this.opacityChanged);
  }
  private unlistenOpacity(): void {
    if (!this.listening) return;
    this.listening = false;
    this.alpha?.removeListener(this.opacityChanged);
  }
  override attach(owner: PipelineOwner): void {
    super.attach(owner);
    try {
      this.listenOpacity();
    } catch (error) {
      const errors = [error];
      try {
        this.detach();
      } catch (cleanup) {
        errors.push(cleanup);
      }
      failures(errors, 'Image opacity attach failed');
    }
  }
  override detach(): void {
    const errors: unknown[] = [];
    for (const action of [() => this.unlistenOpacity(), () => super.detach()])
      try {
        action();
      } catch (error) {
        errors.push(error);
      }
    failures(errors, 'Image detach failed');
  }
  override paint(context: PaintingContext): void {
    if (this.value === null) return;
    this.resolve();
    paintImage({
      canvas: context,
      rect: Rect.fromLTWH(0, 0, this.size.width, this.size.height),
      image: this.value,
      debugImageLabel: this.debugImageLabel,
      scale: this.density,
      opacity: this.alpha?.value ?? 1,
      colorFilter: this.colorFilter,
      fit: this.fitting,
      alignment: this.resolvedAlignment!,
      centerSlice: this.slice,
      repeat: this.repeating,
      flipHorizontally: this.flipHorizontally!,
      invertColors: this.inverted,
      filterQuality: this.quality,
      isAntiAlias: this.antialiased,
      blendMode: this.mode,
    });
  }
  override dispose(): void {
    if (this.debugDisposed) return;
    const errors: unknown[] = [];
    try {
      super.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (this.debugDisposed) {
      const previous = this.value;
      this.value = null;
      for (const action of [() => this.unlistenOpacity(), () => previous?.dispose()])
        try {
          action();
        } catch (error) {
          errors.push(error);
        }
      this.alpha = null;
    }
    failures(errors, 'RenderImage disposal failed');
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    for (const name of [
      'image',
      'width',
      'height',
      'scale',
      'color',
      'opacity',
      'colorBlendMode',
      'blendMode',
      'fit',
      'alignment',
      'repeat',
      'centerSlice',
      'matchTextDirection',
      'textDirection',
      'invertColors',
      'filterQuality',
      'isAntiAlias',
    ] as const)
      properties.add(new DiagnosticsProperty(name, this[name]));
  }
}
