// SPDX-License-Identifier: BSD-3-Clause
import type {
  NativePaintEntry,
  NativePaintScalar,
  RenderBox,
} from '@nelyx/core/framework/rendering/object';
import type { NativeRangeSource } from './range-native-paint.ts';
import type { Thumb } from '../../slider-theme.ts';

export interface NativeRangeSliderRect {
  readonly left: NativePaintScalar;
  readonly top: NativePaintScalar;
  readonly width: NativePaintScalar;
  readonly height: NativePaintScalar;
}
export interface NativeRangeSliderGeometry extends NativeRangeSliderRect {
  readonly right: NativePaintScalar;
  readonly start: NativePaintScalar;
  readonly end: NativePaintScalar;
  readonly cy: NativePaintScalar;
  readonly first: NativePaintScalar;
  readonly last: NativePaintScalar;
  readonly centersRect: NativeRangeSliderRect;
}
export interface NativeRangeSliderShapeContext {
  readonly source: NativeRangeSource;
  readonly geometry: NativeRangeSliderGeometry;
  readonly center: readonly [NativePaintScalar, NativePaintScalar];
  readonly thumb: Thumb;
  readonly activation: number;
  readonly pressed: boolean;
  readonly onTop: NativePaintScalar;
  /** Concrete index, or Core's index expression for a repeating tick adapter. */
  readonly tickIndex?: NativePaintScalar;
}
export interface NativeRangeSliderIndicatorContext extends NativeRangeSliderShapeContext {
  readonly reference: RenderBox;
  readonly textScale: number;
  readonly screenWidth: number | null;
  readonly label: {
    readonly width: number;
    readonly height: number;
    /** Paragraph resources at the label's local origin; placement remains a Core expression. */
    readonly entries: readonly NativePaintEntry[];
  };
}
export type NativeRangeSliderShapeAdapter<T extends object> =
  | {
      readonly kind: 'track';
      readonly rect: (
        source: T,
        options: {
          readonly source: NativeRangeSource;
          readonly enabled: boolean;
          readonly discrete: boolean;
        },
      ) => NativeRangeSliderRect;
      readonly paint: (
        source: T,
        options: NativeRangeSliderShapeContext,
      ) => readonly NativePaintEntry[];
    }
  | {
      [K in 'thumb' | 'tick' | 'overlay']: {
        readonly kind: K;
        /** Tick only: emit exactly one program entry evaluated for each index. */
        readonly repeat?: K extends 'tick' ? boolean : never;
        readonly paint: (
          source: T,
          options: NativeRangeSliderShapeContext,
        ) => readonly NativePaintEntry[];
      };
    }['thumb' | 'tick' | 'overlay']
  | {
      readonly kind: 'indicator';
      readonly horizontalShift: (
        source: T,
        options: NativeRangeSliderIndicatorContext,
      ) => NativePaintScalar;
      readonly paint: (
        source: T,
        options: NativeRangeSliderIndicatorContext,
      ) => readonly NativePaintEntry[];
    };
const adapters = new WeakMap<object, NativeRangeSliderShapeAdapter<object>>();
const methods = [
  'paint',
  'getPreferredSize',
  'getPreferredRect',
  'getHorizontalShift',
  'isRounded',
] as const;
const identities = new WeakMap<object, readonly unknown[]>();
/** Explicit lowering for an exact custom Source shape prototype. Readers emit
 * bounded configuration; no RenderBox, Canvas or layout callback runs in Core. */
export function registerNativeRangeSliderShape<T extends object>(
  prototype: T,
  adapter: NativeRangeSliderShapeAdapter<T>,
): void {
  if (
    !prototype ||
    prototype === Object.prototype ||
    adapters.has(prototype) ||
    !['track', 'thumb', 'tick', 'overlay', 'indicator'].includes(adapter.kind) ||
    typeof adapter.paint !== 'function' ||
    (adapter.kind === 'track' && typeof adapter.rect !== 'function') ||
    (adapter.kind === 'indicator' && typeof adapter.horizontalShift !== 'function') ||
    ('repeat' in adapter && (adapter.kind !== 'tick' || typeof adapter.repeat !== 'boolean'))
  )
    throw Error('Invalid or duplicate native RangeSlider shape adapter');
  adapters.set(prototype, Object.freeze({ ...adapter }) as NativeRangeSliderShapeAdapter<object>);
  identities.set(
    prototype,
    methods.map((name) => Reflect.get(prototype, name)),
  );
}
export function nativeRangeSliderShape<K extends NativeRangeSliderShapeAdapter<object>['kind']>(
  source: object | null,
  kind: K,
): Extract<NativeRangeSliderShapeAdapter<object>, { readonly kind: K }> | undefined {
  if (!source) return;
  const prototype = Object.getPrototypeOf(source),
    adapter = adapters.get(prototype);
  if (
    adapter &&
    methods.some((name, i) => Reflect.get(source, name) !== identities.get(prototype)![i])
  )
    throw Error('Native RangeSlider shape methods changed after registration');
  if (adapter && adapter.kind !== kind)
    throw Error('Native RangeSlider shape adapter role differs');
  return adapter as
    | Extract<NativeRangeSliderShapeAdapter<object>, { readonly kind: K }>
    | undefined;
}
