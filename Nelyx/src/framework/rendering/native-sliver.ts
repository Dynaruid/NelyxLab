// SPDX-License-Identifier: BSD-3-Clause
import type { RenderBox } from './object.ts';
import type { SectionAnchor } from './section-extent-index.ts';
import type { SliverChildPolicy } from '../widgets/view-work-budget.ts';

/** Content observations, never an App-computed layout or estimated child size. */
export interface NativeSliverMeasurement {
  readonly index: number;
  readonly token: bigint;
  readonly offset: number;
  readonly extent: number;
}
export interface NativeSliverInput {
  readonly width: number;
  readonly height: number;
  readonly paintExtent: number;
  readonly offset: number;
  readonly begin: number;
  readonly end: number;
  readonly beginOffset: number;
  readonly rows: readonly NativeSliverMeasurement[];
}
export interface NativeSliverChild {
  readonly render: RenderBox;
  readonly index: number;
  readonly token: bigint;
  readonly keptAlive: boolean;
  readonly explicitKeepAlive: boolean;
  readonly published: boolean;
}
export interface NativeSliverConfiguration {
  readonly childPolicy: SliverChildPolicy;
  readonly revision: bigint;
  readonly generation: bigint;
  readonly count: number;
  readonly begin: number;
  readonly end: number;
  readonly estimate: number;
  readonly itemExtent: number | null;
  /** Unknown extents are measured in order; Content derives the remaining extent estimate. */
  readonly sequential?: boolean;
  readonly built: {
    readonly revision: bigint;
    readonly width: number;
    readonly height: number;
  } | null;
  readonly children: readonly NativeSliverChild[];
  readonly prepare: (revision: bigint, input: NativeSliverInput) => boolean;
  readonly observe: (revision: bigint, input: NativeSliverInput) => boolean;
  readonly requestWindow: (revision: bigint, begin: number, end: number) => void;
  readonly takeRequest?: () => SectionAnchor | null;
}
type Reject = (reason: string) => never;
type Reader<T extends object> = (render: T, reject: Reject) => NativeSliverConfiguration;
const readers = new WeakMap<object, Reader<object>>();
interface ChildOwner {
  readonly identity: (child: RenderBox) => object;
  readonly policy: () => SliverChildPolicy;
}
const childOwners = new WeakMap<object, ChildOwner>();
/** @internal The actual Source Element registers its own existing bookkeeping. */
export function registerNativeSliverChildOwner(owner: object, callbacks: ChildOwner): void {
  if (childOwners.has(owner)) throw Error('Native sliver child owner is already registered');
  childOwners.set(owner, callbacks);
}
/** @internal Custom managers retain their ordinary TS protocol; native admission is explicit. */
export function nativeSliverChildOwner(owner: object): ChildOwner | undefined {
  return childOwners.get(owner);
}

/** @internal Registration belongs to the canonical render module, never a subclass allowlist. */
export function registerNativeSliverConfiguration<T extends object>(
  prototype: T,
  reader: Reader<T>,
): void {
  if (readers.has(prototype)) throw Error('Native sliver configuration is already registered');
  readers.set(prototype, reader as Reader<object>);
}
/** @internal A reader is exact; inherited registration does not admit user execution hooks. */
export function nativeSliverConfiguration(
  render: object,
  reject: Reject,
): NativeSliverConfiguration | undefined {
  const reader = readers.get(Object.getPrototypeOf(render));
  if (!reader) return;
  if (
    [
      'layout',
      'performLayout',
      'paint',
      'hitTest',
      'constraints',
      'nativeSectionConfiguration',
      '_nativeListConfiguration',
      '_prepareNativeList',
      '_observeNativeList',
      '_configureNativeList',
      '_acceptNativeRows',
      '_invokeChildManagerLayoutCallback',
    ].some((name) => Object.hasOwn(render, name))
  )
    return reject('instance-sliver-owner-hook');
  return reader(render, reject);
}
