// SPDX-License-Identifier: BSD-3-Clause
import type { RenderBox } from './object.ts';
import { StadiumBorder } from '../painting/stadium-border.ts';
import { RoundedRectangleBorder } from '../painting/rounded-rectangle-border.ts';
import { CircleBorder } from '../painting/circle-border.ts';
import type { ShapeBorder, OutlinedBorder } from '../painting/borders.ts';

/** Configuration only: dimensions, paths and reference-box transforms belong to Content. */
export interface NativeShape {
  readonly kind: 'rrect' | 'stadium' | 'circle';
  readonly radii: readonly number[];
  readonly strokeWidth: number;
  readonly strokeAlign: number;
  readonly strokeColor: number;
}
/** Intrinsic source configuration; final placement is resolved by Content. */
export interface NativePaintGeometry {
  readonly kind:
    | 'switchTrack'
    | 'switchThumb'
    | 'switchReaction'
    | 'switchOnLabel'
    | 'switchOffLabel';
  readonly trackWidth: number;
  readonly trackHeight: number;
  readonly thumbWidth?: number;
  readonly thumbHeight?: number;
  readonly extension?: number;
  readonly position?: number;
  readonly rtl?: boolean;
  readonly inset?: number;
}
export interface NativePaintEntry {
  readonly kind:
    | 'physical'
    | 'border'
    | 'highlight'
    | 'ripple'
    | 'checkbox'
    | 'mark'
    | 'circle'
    | 'shape'
    | 'shadow'
    | 'clip';
  readonly reference?: RenderBox;
  readonly color: number;
  readonly shape: NativeShape;
  readonly elevation?: number;
  readonly shadowColor?: number;
  readonly clip?: 'none' | 'hardEdge' | 'antiAlias' | 'antiAliasWithSaveLayer';
  readonly contained?: boolean;
  readonly center?: boolean;
  readonly circular?: boolean;
  readonly customClip?: boolean;
  readonly x?: number;
  readonly y?: number;
  readonly radius?: number | null;
  readonly progress?: number;
  readonly dash?: boolean;
  readonly geometry?: NativePaintGeometry;
  readonly blurSigma?: number;
  readonly spread?: number;
}
export type NativeRenderMetadata =
  | { readonly kind: 'paint'; readonly entries: readonly NativePaintEntry[] }
  | { readonly kind: 'inputPadding'; readonly width: number; readonly height: number }
  | {
      readonly kind: 'ink';
      readonly entries: readonly NativePaintEntry[];
      readonly absorbHitTest: boolean;
    }
  | { readonly kind: 'border'; readonly shape: NativeShape | null };
const readers = new WeakMap<object, (source: object) => NativeRenderMetadata>();
/** @internal Canonical packages register exact metadata identities, never a paint/layout callback. */
export function registerNativeRenderMetadata<T extends object>(
  prototype: T,
  reader: (source: T) => NativeRenderMetadata,
): void {
  if (readers.has(prototype)) throw Error('Native render metadata is already registered');
  readers.set(prototype, reader as (source: object) => NativeRenderMetadata);
}
export function nativeRenderMetadata(source: object): NativeRenderMetadata | undefined {
  return readers.get(Object.getPrototypeOf(source))?.(source);
}
/** @internal Preserve canonical shape values without invoking getOuterPath/paint on App. */
export function nativeShape(shape: ShapeBorder, direction: 'ltr' | 'rtl' | null): NativeShape {
  const prototype = Object.getPrototypeOf(shape);
  let kind: NativeShape['kind'];
  let radii = Array<number>(8).fill(0);
  if (prototype === StadiumBorder.prototype) kind = 'stadium';
  else if (prototype === CircleBorder.prototype) {
    if ((shape as CircleBorder).eccentricity !== 0) throw Error('native circle eccentricity');
    kind = 'circle';
  } else if (prototype === RoundedRectangleBorder.prototype) {
    kind = 'rrect';
    const radius = (shape as RoundedRectangleBorder).borderRadius.resolve(direction);
    radii = [radius.topLeft, radius.topRight, radius.bottomRight, radius.bottomLeft].flatMap(
      (corner) => [corner.x, corner.y],
    );
  } else throw Error('native custom shape');
  const side = (shape as OutlinedBorder).side;
  if (side.style !== 'solid' && side.style !== 'none') throw Error('native border style');
  return {
    kind,
    radii,
    strokeWidth: side.style === 'none' ? 0 : side.width,
    strokeAlign: side.strokeAlign,
    strokeColor: side.color,
  };
}
