// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { AxisDirection, axisDirectionToAxis } from '../painting/basic-types.ts';
import type { Axis } from '../painting/basic-types.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { objectRuntimeType } from '../../foundation/object.ts';
import { clampDouble as clamp } from '../../ui/math.ts';
import { fixed, protect } from '../../ui/value-math.ts';
export interface ScrollMetricsCopyOptions {
  readonly minScrollExtent?: number | null;
  readonly maxScrollExtent?: number | null;
  readonly pixels?: number | null;
  readonly viewportDimension?: number | null;
  readonly axisDirection?: AxisDirection | null;
  readonly devicePixelRatio?: number | null;
}
export interface ScrollMetricsData {
  readonly minScrollExtent: number;
  readonly maxScrollExtent: number;
  readonly hasContentDimensions: boolean;
  readonly pixels: number;
  readonly hasPixels: boolean;
  readonly viewportDimension: number;
  readonly hasViewportDimension: boolean;
  readonly axisDirection: AxisDirection;
  readonly devicePixelRatio: number;
  readonly axis: Axis;
  readonly outOfRange: boolean;
  readonly atEdge: boolean;
  readonly extentBefore: number;
  readonly extentInside: number;
  readonly extentAfter: number;
  readonly extentTotal: number;
  copyWith(options?: ScrollMetricsCopyOptions): ScrollMetricsData;
}
type ScrollMetricsConstructor<Base extends abstract new (...args: any[]) => object> = abstract new (
  ...args: ConstructorParameters<Base>
) => InstanceType<Base> & ScrollMetricsData;
/** Source mixin permits a position to retain ViewportOffset's notifier ownership. */
export function ScrollMetricsMixin<Base extends abstract new (...args: any[]) => object>(
  Base: Base,
): ScrollMetricsConstructor<Base> {
  abstract class Metrics extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    copyWith({
      minScrollExtent,
      maxScrollExtent,
      pixels,
      viewportDimension,
      axisDirection,
      devicePixelRatio,
    }: ScrollMetricsCopyOptions = {}): ScrollMetrics {
      return new FixedScrollMetrics({
        minScrollExtent:
          minScrollExtent ?? (this.hasContentDimensions ? this.minScrollExtent : null),
        maxScrollExtent:
          maxScrollExtent ?? (this.hasContentDimensions ? this.maxScrollExtent : null),
        pixels: pixels ?? (this.hasPixels ? this.pixels : null),
        viewportDimension:
          viewportDimension ?? (this.hasViewportDimension ? this.viewportDimension : null),
        axisDirection: axisDirection ?? this.axisDirection,
        devicePixelRatio: devicePixelRatio ?? this.devicePixelRatio,
      });
    }
    abstract get minScrollExtent(): number;
    abstract get maxScrollExtent(): number;
    abstract get hasContentDimensions(): boolean;
    abstract get pixels(): number;
    abstract get hasPixels(): boolean;
    abstract get viewportDimension(): number;
    abstract get hasViewportDimension(): boolean;
    abstract get axisDirection(): AxisDirection;
    abstract get devicePixelRatio(): number;
    get axis(): Axis {
      return axisDirectionToAxis(this.axisDirection);
    }
    get outOfRange(): boolean {
      return this.pixels < this.minScrollExtent || this.pixels > this.maxScrollExtent;
    }
    get atEdge(): boolean {
      return this.pixels === this.minScrollExtent || this.pixels === this.maxScrollExtent;
    }
    get extentBefore(): number {
      return Math.max(this.pixels - this.minScrollExtent, 0);
    }
    get extentInside(): number {
      if (FoundationBuildMode.debug)
        invariant(
          this.minScrollExtent <= this.maxScrollExtent,
          'invalid-scroll-metric-extents',
          'Content dimensions must be ordered',
        );
      return (
        this.viewportDimension -
        clamp(this.minScrollExtent - this.pixels, 0, this.viewportDimension) -
        clamp(this.pixels - this.maxScrollExtent, 0, this.viewportDimension)
      );
    }
    get extentAfter(): number {
      return Math.max(this.maxScrollExtent - this.pixels, 0);
    }
    get extentTotal(): number {
      return this.maxScrollExtent - this.minScrollExtent + this.viewportDimension;
    }
  }
  return Metrics as unknown as ScrollMetricsConstructor<Base>;
}
export abstract class ScrollMetrics extends ScrollMetricsMixin(class {}) {}
export interface FixedScrollMetricsOptions {
  readonly minScrollExtent: number | null;
  readonly maxScrollExtent: number | null;
  readonly pixels: number | null;
  readonly viewportDimension: number | null;
  readonly axisDirection: AxisDirection;
  readonly devicePixelRatio: number;
}
export class FixedScrollMetrics extends ScrollMetrics {
  private readonly _minScrollExtent: number | null;
  private readonly _maxScrollExtent: number | null;
  private readonly _pixels: number | null;
  private readonly _viewportDimension: number | null;
  private readonly direction: AxisDirection;
  private readonly ratio: number;
  constructor({
    minScrollExtent,
    maxScrollExtent,
    pixels,
    viewportDimension,
    axisDirection,
    devicePixelRatio,
  }: FixedScrollMetricsOptions) {
    super();
    this._minScrollExtent = minScrollExtent;
    this._maxScrollExtent = maxScrollExtent;
    this._pixels = pixels;
    this._viewportDimension = viewportDimension;
    this.direction = axisDirection;
    this.ratio = devicePixelRatio;
    protect(this, [
      '_minScrollExtent',
      '_maxScrollExtent',
      '_pixels',
      '_viewportDimension',
      'direction',
      'ratio',
    ]);
  }
  get minScrollExtent(): number {
    invariant(
      this._minScrollExtent !== null,
      'unavailable-scroll-minimum',
      'Content minimum is not available',
    );
    return this._minScrollExtent;
  }
  get maxScrollExtent(): number {
    invariant(
      this._maxScrollExtent !== null,
      'unavailable-scroll-maximum',
      'Content maximum is not available',
    );
    return this._maxScrollExtent;
  }
  get hasContentDimensions(): boolean {
    return this._minScrollExtent !== null && this._maxScrollExtent !== null;
  }
  get pixels(): number {
    invariant(
      this._pixels !== null,
      'unavailable-scroll-pixels',
      'Scroll position is not available',
    );
    return this._pixels;
  }
  get hasPixels(): boolean {
    return this._pixels !== null;
  }
  get viewportDimension(): number {
    invariant(
      this._viewportDimension !== null,
      'unavailable-scroll-viewport',
      'Viewport dimension is not available',
    );
    return this._viewportDimension;
  }
  get hasViewportDimension(): boolean {
    return this._viewportDimension !== null;
  }
  get axisDirection(): AxisDirection {
    return this.direction;
  }
  get devicePixelRatio(): number {
    return this.ratio;
  }
  toString(): string {
    return `${objectRuntimeType(this, 'FixedScrollMetrics')}(${fixed(this.extentBefore)}..[${fixed(this.extentInside)}]..${fixed(this.extentAfter)})`;
  }
}
