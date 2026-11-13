// SPDX-License-Identifier: BSD-3-Clause
import type { BoxConstraints } from './constraints.ts';
import type { Clip } from '../../ui/clip.ts';
import type { NativeSnapshotConfiguration } from './native-snapshot.ts';
import type { RenderBox, RenderObject } from './object.ts';
import type { NativePaintEntry } from './native-paint.ts';
import type { NativeLayoutProgram } from './native-layout.ts';

/** App configuration only. Content owns final dimensions, clipping and transforms. */
export interface NativeBoxLayout {
  readonly offstage?: boolean;
  readonly childConstraints?: 'inherit' | 'loose' | 'expand' | 'unconstrained';
  readonly enforceBounds?: boolean;
  readonly reverseMain?: boolean;
  readonly reverseCross?: boolean;
  readonly alignment?: { readonly x: number; readonly y: number };
  readonly alignmentSizing?: boolean;
  readonly widthFactor?: number;
  readonly heightFactor?: number;
  readonly shrinkUnboundedMain?: boolean;
  readonly expandEmpty?: boolean;
  readonly clipOverflow?: boolean;
  readonly overflowClipBehavior?: Clip;
  readonly canonicalStack?: boolean;
  readonly textBaseline?: 'alphabetic' | 'ideographic';
  readonly direction?: 'horizontal' | 'vertical';
  readonly mainSize?: 'min' | 'max';
  readonly mainAlign?: 'start' | 'end' | 'center' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly';
  readonly crossAlign?: 'start' | 'end' | 'center' | 'stretch' | 'baseline';
  readonly gap?: number;
  readonly runGap?: number;
  readonly runAlign?: NonNullable<NativeBoxLayout['mainAlign']>;
  readonly padding?: {
    readonly left?: number;
    readonly top?: number;
    readonly right?: number;
    readonly bottom?: number;
  };
}
export interface NativeBoxConfiguration {
  readonly layoutProgram?: NativeLayoutProgram;
  /** Parent and child size factors, then an offset, for each translation axis. */
  readonly childAnchor?: readonly [number, number, number, number, number, number];
  readonly intrinsicSizing?: {
    readonly minimumHeight: number;
    readonly minimumWidthPerHeight: number;
    readonly expandReportedWidth: boolean;
  };
  readonly children?: readonly RenderObject[];
  readonly paint?: readonly NativePaintEntry[];
  readonly foreground?: readonly NativePaintEntry[];
  readonly tooltipPosition?: {
    readonly target: () => RenderBox | null;
    readonly verticalOffset: number;
    readonly preferBelow: boolean;
    readonly margin: number;
  };
  readonly onPointerSample?: (sample: NativePointerSample) => void;
  readonly pointerBlock?: 'ignore' | 'absorb';
  readonly layoutBuilder?: NativeLayoutBuilderConfiguration;
  readonly snapshot?: NativeSnapshotConfiguration;
  readonly kind: 'box' | 'clip' | 'flex' | 'stack' | 'transform' | 'wrap';
  readonly layout: NativeBoxLayout;
  readonly constraints?: BoxConstraints;
  readonly color?: number;
  readonly opacity?: number;
  readonly semantics?: { readonly role: 'group'; readonly label: string };
  readonly hitTest?: 'self' | 'proxy' | 'deferToChild' | 'translucent';
  readonly semanticsPolicy?: {
    readonly boundary?: boolean;
    readonly blockPrevious?: boolean;
    readonly excludeChildren?: boolean;
    readonly blockActions?: boolean;
    readonly explicitChildren?: boolean;
    readonly forceMergeDescendants?: boolean;
  };
  readonly clipStyle?: {
    readonly behavior: Clip;
    readonly shape: 'rect' | 'rrect' | 'oval' | 'stadium' | 'circle';
    readonly hitTestShape?: boolean;
    readonly radii?: readonly [number, number, number, number, number, number, number, number];
  };
  readonly graphics?: {
    readonly transform: readonly [number, number, number, number, number, number];
    readonly origin?: { readonly x: number; readonly y: number };
    readonly alignment?: { readonly x: number; readonly y: number };
  };
}
/** The Core retains the original hit path and its inverse for the whole contact. */
export interface NativePointerSample {
  readonly phase: 'begin' | 'update' | 'end' | 'cancel';
  readonly pointer?: boolean;
  readonly hover?: boolean;
  readonly time: number;
  readonly stream: number;
  readonly kind?: 'unknown' | 'touch' | 'mouse' | 'stylus' | 'invertedStylus' | 'trackpad';
  readonly device?: number;
  readonly buttons?: number;
  readonly x?: number;
  readonly y?: number;
  readonly dx?: number;
  readonly dy?: number;
  readonly inverse: readonly [number, number, number, number, number, number];
}
/** Source owns rebuild policy and the original Element's build scope. */
export interface NativeLayoutBuilderConfiguration {
  readonly revision: bigint;
  readonly built: { readonly revision: bigint; readonly constraints: BoxConstraints } | null;
  readonly rebuild: (revision: bigint, constraints: BoxConstraints) => boolean;
}
type Reject = (reason: string) => never;
type Reader<T extends object> = (render: T, reject: Reject) => NativeBoxConfiguration;
const readers = new WeakMap<object, Reader<object>>();
const dataReaders = new WeakMap<object, Reader<object>>();

/** @internal Each canonical module registers its own exact configuration identity. */
export function registerNativeBoxConfiguration<T extends object>(
  prototype: T,
  reader: Reader<T>,
  directData = false,
): void {
  if (readers.has(prototype)) throw Error('Native box configuration is already registered');
  readers.set(prototype, reader as Reader<object>);
  if (directData) dataReaders.set(prototype, reader as Reader<object>);
}
/** @internal Opted-in module data has no paint callbacks or handle references.
 * The App seals it directly into commands; custom subclasses remain adapters. */
export function nativeBoxDataConfiguration(
  render: object,
  reject: Reject,
): NativeBoxConfiguration | undefined {
  return dataReaders.get(Object.getPrototypeOf(render))?.(render, reject);
}
/** @internal Inherited registration never admits an unregistered user render subclass. */
export function nativeBoxConfiguration(
  render: object,
  reject: Reject,
): NativeBoxConfiguration | undefined {
  return readers.get(Object.getPrototypeOf(render))?.(render, reject);
}
