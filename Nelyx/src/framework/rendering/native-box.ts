// SPDX-License-Identifier: BSD-3-Clause
import type { BoxConstraints } from './constraints.ts';
import type { Clip } from '../../ui/clip.ts';
import type { NativeSnapshotConfiguration } from './native-snapshot.ts';

/** App configuration only. Content owns final dimensions, clipping and transforms. */
export interface NativeBoxLayout {
  readonly offstage?: boolean;
  readonly childConstraints?: 'inherit' | 'loose' | 'expand';
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
  readonly layoutBuilder?: NativeLayoutBuilderConfiguration;
  readonly snapshot?: NativeSnapshotConfiguration;
  readonly kind: 'box' | 'clip' | 'flex' | 'stack' | 'transform' | 'wrap';
  readonly layout: NativeBoxLayout;
  readonly constraints?: BoxConstraints;
  readonly color?: number;
  readonly semantics?: { readonly role: 'group'; readonly label: string };
  readonly hitTest?: 'self' | 'proxy';
  readonly semanticsPolicy?: {
    readonly blockPrevious?: boolean;
    readonly excludeChildren?: boolean;
  };
  readonly clipStyle?: {
    readonly behavior: Clip;
    readonly shape: 'rect' | 'rrect' | 'oval';
    readonly radii?: readonly [number, number, number, number, number, number, number, number];
  };
  readonly graphics?: {
    readonly transform: readonly [number, number, number, number, number, number];
    readonly origin?: { readonly x: number; readonly y: number };
    readonly alignment?: { readonly x: number; readonly y: number };
  };
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

/** @internal Each canonical module registers its own exact configuration identity. */
export function registerNativeBoxConfiguration<T extends object>(
  prototype: T,
  reader: Reader<T>,
): void {
  if (readers.has(prototype)) throw Error('Native box configuration is already registered');
  readers.set(prototype, reader as Reader<object>);
}
/** @internal Inherited registration never admits an unregistered user render subclass. */
export function nativeBoxConfiguration(
  render: object,
  reject: Reject,
): NativeBoxConfiguration | undefined {
  return readers.get(Object.getPrototypeOf(render))?.(render, reject);
}
