// SPDX-License-Identifier: BSD-3-Clause
import type { RenderBox } from './object.ts';
import type { ResourceId } from '../../ui/types.ts';
import type { NativeSemanticsMetadata } from './native-semantics.ts';
import { StadiumBorder } from '../painting/stadium-border.ts';
import { RoundedRectangleBorder } from '../painting/rounded-rectangle-border.ts';
import { CircleBorder } from '../painting/circle-border.ts';
import { Border, BorderDirectional } from '../painting/box-border.ts';
import type { ShapeBorder, OutlinedBorder } from '../painting/borders.ts';

/** Configuration only: dimensions, paths and reference-box transforms belong to Content. */
export interface NativeShape {
  readonly kind: 'rrect' | 'stadium' | 'circle';
  readonly radii: readonly number[];
  readonly strokeWidth: number;
  readonly strokeAlign: number;
  readonly strokeColor: number;
}
/** Pure geometry expressions evaluated by Content after native layout. */
export type NativePaintScalar =
  | number
  | {
      readonly op:
        | 'width'
        | 'height'
        | 'index'
        | 'add'
        | 'subtract'
        | 'multiply'
        | 'divide'
        | 'min'
        | 'max'
        | 'clamp'
        | 'less'
        | 'lessEqual'
        | 'greater'
        | 'greaterEqual'
        | 'equal'
        | 'select'
        | 'worldX'
        | 'worldY'
        | 'boundedWidth'
        | 'boundedHeight'
        | 'layoutValue'
        | 'contentOverflow'
        | 'contentOverflowX'
        | 'overflowProbeWidth'
        | 'overflowProbeHeight'
        | 'acos'
        | 'asin'
        | 'cos';
      readonly index?: number;
      readonly args?: readonly NativePaintScalar[];
    };
/** Bounded path commands; Content resolves every scalar before provider painting. */
export type NativePaintPathSegment<T = NativePaintScalar> =
  | readonly ['move' | 'line', T, T]
  | readonly ['quad' | 'rect', T, T, T, T]
  | readonly ['cubic', T, T, T, T, T, T]
  | readonly ['conic', T, T, T, T, T]
  | readonly ['rrect', T, T, T, T, T, T, T, T, T, T, T, T]
  /** Oval x/y/width/height, start/sweep radians, then forceMoveTo (0 or 1). */
  | readonly ['arc', T, T, T, T, T, T, T]
  | readonly ['close'];
export interface NativePaintPath<T = NativePaintScalar> {
  readonly fillRule?: 'nonZero' | 'evenOdd';
  readonly commands: readonly (
    | NativePaintPathSegment<T>
    | {
        readonly when: T;
        readonly command: NativePaintPathSegment<T>;
      }
  )[];
}
/** Intrinsic source configuration; final placement is resolved by Content. */
export type NativePaintGeometry =
  | {
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
  | {
      readonly kind: 'linear';
      /** x/y/width/height factors, then offsets, in the Content-owned reference box. */
      readonly rect: readonly [number, number, number, number, number, number, number, number];
    }
  | {
      readonly kind: 'program';
      readonly rect: readonly [
        NativePaintScalar,
        NativePaintScalar,
        NativePaintScalar,
        NativePaintScalar,
      ];
      readonly radii?: readonly NativePaintScalar[];
      readonly visible?: NativePaintScalar;
      readonly color?: NativePaintScalar;
      readonly strokeWidth?: NativePaintScalar;
      readonly repeat?: number;
    };
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
    | 'clip'
    | 'hitRegion'
    | 'elevationShadow'
    | 'save'
    | 'restore'
    | 'path'
    | 'paragraph'
    | 'linearMask';
  /** White-to-transparent opacity mask over this node and its children.
   * Content evaluates start-x/y and end-x/y; providers isolate the subtree. */
  readonly gradient?: readonly [
    NativePaintScalar,
    NativePaintScalar,
    NativePaintScalar,
    NativePaintScalar,
  ];
  readonly path?: NativePaintPath;
  readonly strokeCap?: 'butt' | 'round' | 'square';
  readonly blendMode?: 'srcOver' | 'srcATop';
  /** App-owned Source resource. The bridge copies immutable input, never its private paragraph. */
  readonly paragraph?: ResourceId;
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
  readonly transparentOccluder?: boolean;
}
export type NativeRenderMetadata =
  | NativeSemanticsMetadata
  | { readonly kind: 'singleChild' }
  | { readonly kind: 'inlineScale'; readonly scale: number }
  | { readonly kind: 'paint'; readonly entries: readonly NativePaintEntry[] }
  | {
      readonly kind: 'decoration';
      readonly entries: readonly NativePaintEntry[];
      readonly shape: NativeShape;
    }
  | {
      readonly kind: 'overlay';
      readonly skipCount: number;
      readonly clip: 'none' | 'hardEdge' | 'antiAlias' | 'antiAliasWithSaveLayer';
      readonly alignment: { readonly x: number; readonly y: number };
    }
  | {
      readonly kind: 'sizedSurface';
      readonly width: number;
      readonly height: number;
      readonly expandWidth: boolean;
      readonly hitRegion?: NativePaintEntry;
    }
  | { readonly kind: 'inputPadding'; readonly width: number; readonly height: number }
  | {
      readonly kind: 'ink';
      readonly entries: readonly NativePaintEntry[];
      readonly absorbHitTest: boolean;
      /** Includes live features whose reference is temporarily not painted. */
      readonly dependsOnChildVisibility?: boolean;
    }
  | { readonly kind: 'border'; readonly shape: NativeShape | null };
type MetadataDirection = 'ltr' | 'rtl' | null;
const readers = new WeakMap<
  object,
  (source: object, direction: MetadataDirection) => NativeRenderMetadata
>();
/** @internal Canonical packages register exact metadata identities, never a paint/layout callback. */
export function registerNativeRenderMetadata<T extends object>(
  prototype: T,
  reader: (source: T, direction: MetadataDirection) => NativeRenderMetadata,
): void {
  if (readers.has(prototype)) throw Error('Native render metadata is already registered');
  readers.set(
    prototype,
    reader as (source: object, direction: MetadataDirection) => NativeRenderMetadata,
  );
}
export function nativeRenderMetadata(
  source: object,
  direction: MetadataDirection = null,
): NativeRenderMetadata | undefined {
  return readers.get(Object.getPrototypeOf(source))?.(source, direction);
}
/** @internal Preserve canonical shape values without invoking getOuterPath/paint on App. */
export function nativeShape(shape: ShapeBorder, direction: 'ltr' | 'rtl' | null): NativeShape {
  const prototype = Object.getPrototypeOf(shape);
  if (
    ['getOuterPath', 'getInnerPath', 'paint', 'paintInterior'].some((name) =>
      Object.hasOwn(shape, name),
    )
  )
    throw Error('native instance shape hook');
  let kind: NativeShape['kind'];
  let radii = Array<number>(8).fill(0);
  const box =
    prototype === Border.prototype || prototype === BorderDirectional.prototype
      ? (shape as Border | BorderDirectional)
      : null;
  if (box) {
    if (!box.isUniform) throw Error('native nonuniform box border');
    kind = 'rrect';
  } else if (prototype === StadiumBorder.prototype) kind = 'stadium';
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
  const side = box ? box.top : (shape as OutlinedBorder).side;
  if (side.style !== 'solid' && side.style !== 'none') throw Error('native border style');
  return {
    kind,
    radii,
    strokeWidth: side.style === 'none' ? 0 : side.width,
    strokeAlign: side.strokeAlign,
    strokeColor: side.style === 'none' ? 0 : side.color,
  };
}
