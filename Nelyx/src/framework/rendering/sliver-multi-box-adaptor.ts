// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { RenderObject as NumericGeometryRenderObject } from './object.ts';
import { ParentData, RenderBox, isNativeRenderObject } from './object.ts';
import type { RenderObject } from './object.ts';
import {
  SliverLogicalParentData,
  RenderSliver,
  SliverConstraints,
  GrowthDirection,
} from './sliver.ts';
import type { SliverHitTestResult, SliverHitPosition } from './sliver.ts';
import { Axis, AxisDirection } from '../painting/basic-types.ts';
import { ScrollDirection } from './viewport-offset.ts';
import type {
  NativeSliverConfiguration,
  NativeSliverInput,
  NativeSliverMeasurement,
} from './native-sliver.ts';
import { nativeSliverChildOwner } from './native-sliver.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { identity, multiply, translate } from '../../ui/geometry.ts';
import type { TransformMatrix } from '../../ui/geometry.ts';
import type { Rect, SemanticsNode } from '../../ui/types.ts';
import type { Matrix4 } from '../../math/matrix4.ts';
import type { PaintingContext } from '../painting/context.ts';

export interface EstimateMaxScrollOffsetOptions {
  readonly firstIndex?: number | null;
  readonly lastIndex?: number | null;
  readonly leadingScrollOffset?: number | null;
  readonly trailingScrollOffset?: number | null;
}
export abstract class RenderSliverBoxChildManager {
  abstract createChild(index: number, options: { readonly after: RenderBox | null }): void;
  abstract removeChild(child: RenderBox): void;
  abstract estimateMaxScrollOffset(
    constraints: SliverConstraints,
    options: EstimateMaxScrollOffsetOptions,
  ): number;
  abstract get childCount(): number;
  get estimatedChildCount(): number | null {
    return null;
  }
  abstract didAdoptChild(child: RenderBox): void;
  abstract setDidUnderflow(value: boolean): void;
  didStartLayout(): void {}
  didFinishLayout(): void {}
  get boundedChildren(): boolean {
    return false;
  }
  get preparationIndex(): number | null {
    return null;
  }
  retainChild(_child: RenderBox): boolean {
    return false;
  }
  isRetainedChild(_child: RenderBox): boolean {
    return false;
  }
  didObtainChild(_child: RenderBox, _reason: 'active' | 'explicit' = 'active'): void {}
  debugAssertChildListLocked(): boolean {
    return true;
  }
}
export interface KeepAliveParentDataMixin {
  keepAlive: boolean;
  readonly keptAlive: boolean;
}
type ParentDataConstructor = abstract new (...args: any[]) => ParentData;
type KeepAliveParentDataConstructor<Base extends ParentDataConstructor> = abstract new (
  ...args: ConstructorParameters<Base>
) => InstanceType<Base> & KeepAliveParentDataMixin;
const keepAliveParentData = new WeakSet<ParentData>();
export function isKeepAliveParentData(
  data: ParentData | null | undefined,
): data is ParentData & KeepAliveParentDataMixin {
  return data != null && keepAliveParentData.has(data);
}
/** A class factory retains the source mixin's independent ParentData base. */
export function KeepAliveParentDataMixin<Base extends ParentDataConstructor>(
  Base: Base,
): KeepAliveParentDataConstructor<Base> {
  abstract class KeepAliveParentData extends Base {
    keepAlive = false;
    constructor(...args: any[]) {
      super(...args);
      keepAliveParentData.add(this);
    }
    abstract get keptAlive(): boolean;
  }
  return KeepAliveParentData as unknown as KeepAliveParentDataConstructor<Base>;
}
export class SliverMultiBoxAdaptorParentData extends KeepAliveParentDataMixin(
  SliverLogicalParentData,
) {
  index: number | null = null;
  previousSibling: RenderBox | null = null;
  nextSibling: RenderBox | null = null;
  /** @internal RenderSliverMultiBoxAdaptor owns the bucket transition. */
  _keptAlive = false;
  get keptAlive(): boolean {
    return this._keptAlive;
  }
  override detach(): void {
    this.previousSibling = null;
    this.nextSibling = null;
    super.detach();
  }
  override toString(): string {
    return `index=${this.index}; ${this.keepAlive ? 'keepAlive; ' : ''}${super.toString()}`;
  }
}

type RenderSliverConstructor = abstract new (...args: any[]) => RenderSliver;
export function RenderSliverWithKeepAliveMixin<Base extends RenderSliverConstructor>(
  Base: Base,
): Base {
  abstract class RenderSliverWithKeepAlive extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    override setupParentData(child: RenderObject): void {
      if (FoundationBuildMode.debug) {
        if (!isKeepAliveParentData(child.parentData))
          invariant(
            false,
            'invalid-sliver-keep-alive-data',
            'Sliver child must use KeepAliveParentDataMixin',
          );
      }
    }
  }
  return RenderSliverWithKeepAlive as unknown as Base;
}
/** Source active chain and keep-alive bucket. The host's base ownership list
 * retains both sets, so attach/detach/dispose always see every owned child.
 * Unlike the source container's childCount, base children includes cached nodes.
 * The canonical bucket can also retain the previous published native window
 * until its replacement is visible. A scene admits at most 128 children. */
export abstract class RenderSliverMultiBoxAdaptor extends RenderSliverWithKeepAliveMixin(
  RenderSliver,
) {
  private collectingGarbage = false;
  private nativeScope: SliverConstraints | undefined;
  private nativePreviousOffset: number | undefined;
  private nativeRevision = 1n;
  private nativeGeneration = 1n;
  private nativeNeedsBuild = true;
  private nativeBuilt: NativeSliverConfiguration['built'] = null;
  private nativeWindow = { begin: 0, end: 0 };
  private nativeMetrics:
    | { count: number; estimate: number; itemExtent: number | null; sequential: boolean }
    | undefined;
  private readonly nativeTokens = new WeakMap<object, bigint>();
  private nextNativeToken = 0n;
  private nativePublished = new Set<bigint>();
  private readonly nativeReleased = new Set<bigint>();
  override get constraints(): SliverConstraints {
    return this.nativeScope ?? super.constraints;
  }
  override markNeedsLayout(): void {
    if (isNativeRenderObject(this) && !this.nativeScope && !this.nativeNeedsBuild) {
      ++this.nativeRevision;
      this.nativeNeedsBuild = true;
    }
    super.markNeedsLayout();
  }
  private nativeToken(child: RenderBox): bigint {
    const identity = nativeSliverChildOwner(this.childManager)?.identity(child) ?? child;
    let token = this.nativeTokens.get(identity);
    if (token === undefined) this.nativeTokens.set(identity, (token = ++this.nextNativeToken));
    return token;
  }
  private publishedNativeChild(child: RenderBox): boolean {
    return this.nativePublished.size > 0 && this.nativePublished.has(this.nativeToken(child));
  }
  /** @internal The owning concrete module supplies metric policy, never final child geometry. */
  _nativeListConfiguration(
    estimate: number,
    itemExtent: number | null,
    sequential = false,
  ): NativeSliverConfiguration {
    const childOwner = nativeSliverChildOwner(this.childManager);
    invariant(
      childOwner,
      'native-sliver-child-owner',
      'Native list requires its actual Source child Element',
    );
    const count = this.childManager.estimatedChildCount;
    invariant(
      Number.isSafeInteger(count) &&
        count! >= 0 &&
        count! <= 1_000_000 &&
        Number.isFinite(estimate) &&
        (sequential ? estimate === 0 && itemExtent === null : estimate > 0) &&
        estimate * count! <= 1e12,
      'invalid-native-sliver-count',
      'Native list requires a finite delegate and a supported metric policy',
    );
    const previous = this.nativeMetrics;
    if (
      previous &&
      (previous.count !== count ||
        previous.estimate !== estimate ||
        previous.itemExtent !== itemExtent ||
        previous.sequential !== sequential)
    )
      ++this.nativeGeneration;
    this.nativeMetrics = { count: count!, estimate, itemExtent, sequential };
    const children = this.children.map((child) => {
      invariant(
        child instanceof RenderBox,
        'invalid-native-sliver-child',
        'Native list children must be boxes',
      );
      return {
        render: child,
        index: this.indexOf(child),
        token: this.nativeToken(child),
        keptAlive: this.data(child).keptAlive,
        explicitKeepAlive: this.data(child).keepAlive,
        published: this.publishedNativeChild(child),
      };
    });
    return {
      childPolicy: childOwner.policy(),
      revision: this.nativeRevision,
      generation: this.nativeGeneration,
      count: count!,
      begin: this.nativeNeedsBuild ? 0 : this.nativeWindow.begin,
      end: this.nativeNeedsBuild ? 0 : this.nativeWindow.end,
      estimate,
      itemExtent,
      sequential,
      built: this.nativeBuilt,
      children,
      prepare: this.prepareNativeList,
      observe: this.observeNativeList,
      requestWindow: this.requestNativeWindow,
    };
  }
  protected _configureNativeList(_input: NativeSliverInput): boolean {
    return false;
  }
  protected _acceptNativeRows(
    _input: NativeSliverInput,
    _rows: readonly NativeSliverMeasurement[],
  ): void {}
  /** @internal Reconcile real children without running Source layout or fabricating geometry. */
  _prepareNativeList(revision: bigint, input: NativeSliverInput): boolean {
    if (!isNativeRenderObject(this) || this.debugDisposed || revision !== this.nativeRevision)
      return false;
    invariant(
      !this.nativeScope,
      'reentrant-native-sliver',
      'Native child scope is already running',
    );
    const count = this.childManager.estimatedChildCount;
    invariant(
      count !== null &&
        Number.isSafeInteger(input.begin) &&
        Number.isSafeInteger(input.end) &&
        input.begin >= 0 &&
        input.begin <= input.end &&
        input.end <= count &&
        input.end - input.begin <= 128 &&
        [input.width, input.height, input.paintExtent, input.offset, input.beginOffset].every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 1e12,
        ) &&
        input.paintExtent <= input.height &&
        input.rows.length <= 128,
      'invalid-native-sliver-input',
      'Native child demand must contain bounded Content observations',
    );
    const rows: NativeSliverMeasurement[] = [],
      seen = new Set<number>();
    for (const row of input.rows) {
      const child = this.children.find(
        (child) => child instanceof RenderBox && this.indexOf(child) === row.index,
      );
      invariant(
        Number.isSafeInteger(row.index) &&
          row.index >= 0 &&
          row.index < count &&
          typeof row.token === 'bigint' &&
          row.token > 0n &&
          !seen.has(row.index) &&
          [row.offset, row.extent].every(
            (value) => Number.isFinite(value) && value >= 0 && value <= 1e12,
          ),
        'invalid-native-sliver-measurement',
        'Native row measurement has an invalid identity or extent',
      );
      if (!(child instanceof RenderBox) || this.nativeToken(child) !== row.token) return false;
      seen.add(row.index);
      rows.push({ ...row });
    }
    const previousOffset = this.nativePreviousOffset;
    this.nativeScope = new SliverConstraints({
      axisDirection: AxisDirection.down,
      growthDirection: GrowthDirection.forward,
      userScrollDirection:
        previousOffset === undefined || input.offset === previousOffset
          ? ScrollDirection.idle
          : input.offset > previousOffset
            ? ScrollDirection.reverse
            : ScrollDirection.forward,
      scrollOffset: input.offset,
      precedingScrollExtent: 0,
      overlap: 0,
      remainingPaintExtent: input.paintExtent,
      crossAxisExtent: input.width,
      crossAxisDirection: AxisDirection.right,
      viewportMainAxisExtent: input.height,
      remainingCacheExtent: input.paintExtent,
      cacheOrigin: 0,
    });
    try {
      this.childManager.didStartLayout();
      if (this._configureNativeList(input)) ++this.nativeGeneration;
      this._acceptNativeRows(input, rows);
      this.childManager.setDidUnderflow(false);
      // Required cached rows leave the optional budget before outgoing rows
      // compete for it. Retiring first could evict the very State we need next.
      for (let index = input.begin; index < input.end; ++index) {
        if (!this._keepAliveBucket.has(index)) continue;
        let after: RenderBox | null = null;
        for (const child of this.activeChildren) {
          if (this.indexOf(child) >= index) break;
          after = child;
        }
        this._createOrObtainChild(index, { after });
      }
      // A completed publication releases its old required rows into the same
      // canonical optional policy, inside this authorized child build scope.
      for (const child of this._keepAliveBucket.values()) {
        const token = this.nativeToken(child);
        if (
          this.nativeReleased.has(token) &&
          !this.nativePublished.has(token) &&
          !this.data(child).keepAlive &&
          !this.childManager.isRetainedChild(child)
        )
          this.childManager.retainChild(child);
      }
      this.nativeReleased.clear();
      const active = [...this.activeChildren];
      this.collectGarbage(
        active.filter((child) => this.indexOf(child) < input.begin).length,
        active.filter((child) => this.indexOf(child) >= input.end).length,
      );
      let after: RenderBox | null = null;
      for (let index = input.begin; index < input.end; ++index) {
        let child = this.activeChildren.find((child) => this.indexOf(child) === index);
        if (!child) {
          this._createOrObtainChild(index, { after });
          child = this.activeChildren.find((child) => this.indexOf(child) === index);
        }
        invariant(
          child,
          'native-sliver-builder-null',
          'A declared native list row must emit a child',
        );
        this.childManager.didObtainChild(child);
        const row = rows.find((row) => row.index === index);
        if (row) this.data(child).layoutOffset = row.offset;
        after = child;
      }
      this.childManager.didFinishLayout();
      this.nativeWindow = { begin: input.begin, end: input.end };
      this.nativeBuilt = { revision, width: input.width, height: input.height };
      this.nativeNeedsBuild = false;
      this.nativePreviousOffset = input.offset;
      return true;
    } finally {
      this.nativeScope = undefined;
    }
  }
  private readonly prepareNativeList = (revision: bigint, input: NativeSliverInput) =>
    this._prepareNativeList(revision, input);
  /** @internal Observe a completed Content cohort without entering a build/layout scope. */
  _observeNativeList(revision: bigint, input: NativeSliverInput): boolean {
    if (
      !isNativeRenderObject(this) ||
      this.debugDisposed ||
      this.nativeNeedsBuild ||
      revision !== this.nativeRevision ||
      this.nativeBuilt?.revision !== revision ||
      input.width !== this.nativeBuilt.width ||
      input.height !== this.nativeBuilt.height ||
      input.begin !== this.nativeWindow.begin ||
      input.end !== this.nativeWindow.end
    )
      return false;
    invariant(
      [input.paintExtent, input.offset, input.beginOffset].every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 1e12,
      ) &&
        input.paintExtent <= input.height &&
        input.rows.length <= 128,
      'invalid-native-sliver-input',
      'Native observations require a finite Content viewport',
    );
    const seen = new Set<number>();
    for (const row of input.rows) {
      invariant(
        Number.isSafeInteger(row.index) &&
          row.index >= 0 &&
          row.index < this.childManager.estimatedChildCount! &&
          typeof row.token === 'bigint' &&
          row.token > 0n &&
          !seen.has(row.index),
        'invalid-native-sliver-measurement',
        'Native row observation has an invalid identity',
      );
      seen.add(row.index);
      const child = this.children.find(
        (child) => child instanceof RenderBox && this.indexOf(child) === row.index,
      );
      if (!(child instanceof RenderBox) || this.nativeToken(child) !== row.token) return false;
      invariant(
        [row.offset, row.extent].every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 1e12,
        ),
        'invalid-native-sliver-measurement',
        'Native row measurement must be finite',
      );
    }
    this._acceptNativeRows(input, input.rows);
    const published = new Set<bigint>();
    for (const row of input.rows) {
      const child = this.children.find(
        (child) => child instanceof RenderBox && this.indexOf(child) === row.index,
      )!;
      this.data(child).layoutOffset = row.offset;
      // Protect the published document's whole required window. Compositor
      // scrolling can advance its offset before the next frame is published.
      if (row.index >= input.begin && row.index < input.end) published.add(row.token);
    }
    for (const token of this.nativePublished)
      if (!published.has(token)) this.nativeReleased.add(token);
    this.nativePublished = published;
    if (
      [...this._keepAliveBucket.values()].some((child) =>
        this.nativeReleased.has(this.nativeToken(child)),
      )
    )
      this.markNeedsLayout();
    return true;
  }
  private readonly observeNativeList = (revision: bigint, input: NativeSliverInput) =>
    this._observeNativeList(revision, input);
  private readonly requestNativeWindow = (revision: bigint, begin: number, end: number): void => {
    if (this.debugDisposed || revision !== this.nativeRevision || this.nativeNeedsBuild) return;
    invariant(
      Number.isSafeInteger(begin) &&
        Number.isSafeInteger(end) &&
        begin >= 0 &&
        begin <= end &&
        end <= this.childManager.estimatedChildCount! &&
        end - begin <= 128,
      'invalid-native-sliver-window',
      'Native child demand must fit the Content row budget',
    );
    if (begin !== this.nativeWindow.begin || end !== this.nativeWindow.end) this.markNeedsLayout();
  };
  /** @internal Off-cache local Elements can retire before replacement layout.
   * GlobalKey subtrees retain the BuildOwner end-of-frame retake window. */
  get _retireInactiveChildrenDuringLayout(): boolean {
    return this.collectingGarbage;
  }
  protected readonly childManager: RenderSliverBoxChildManager;
  private readonly activeChildren: RenderBox[] = [];
  private readonly _keepAliveBucket = new Map<number, RenderBox>();
  private readonly danglingKeepAlives = new Set<RenderBox>();
  private _debugChildIntegrityEnabled = true;
  constructor({ childManager }: { readonly childManager: RenderSliverBoxChildManager }) {
    super();
    this.childManager = childManager;
  }
  protected override get childCountLimit(): number {
    return 256;
  }
  get firstChild(): RenderBox | null {
    return this.activeChildren[0] ?? null;
  }
  get lastChild(): RenderBox | null {
    return this.activeChildren.at(-1) ?? null;
  }
  get childCount(): number {
    return this.activeChildren.length;
  }
  get debugChildIntegrityEnabled(): boolean {
    return this._debugChildIntegrityEnabled;
  }
  set debugChildIntegrityEnabled(value: boolean) {
    if (FoundationBuildMode.debug) {
      this._debugChildIntegrityEnabled = value;
      if (value) {
        this._debugVerifyChildOrder();
        if (!(this.danglingKeepAlives.size === 0))
          invariant(
            false,
            'dangling-sliver-keep-alives',
            'Keep-alive moves left unclaimed children',
          );
      }
    }
  }
  override setupParentData(child: RenderObject): void {
    if (!(child.parentData instanceof SliverMultiBoxAdaptorParentData))
      child.parentData = new SliverMultiBoxAdaptorParentData();
  }
  protected override adoptChild(child: RenderObject): void {
    if (!(child instanceof RenderBox))
      invariant(
        false,
        'invalid-sliver-box-child',
        'SliverMultiBoxAdaptor requires RenderBox children',
      );
    super.adoptChild(child);
    if (!(child.parentData as SliverMultiBoxAdaptorParentData).keptAlive)
      this.childManager.didAdoptChild(child);
  }
  private data(child: RenderObject): SliverMultiBoxAdaptorParentData {
    const data = child.parentData;
    if (!(data instanceof SliverMultiBoxAdaptorParentData))
      invariant(
        false,
        'invalid-sliver-parent-data',
        'Child requires SliverMultiBoxAdaptorParentData',
      );
    return data;
  }
  childBefore(child: RenderBox): RenderBox | null {
    if (!(child.parent === this && !this.data(child).keptAlive))
      invariant(false, 'invalid-active-sliver-child', 'Child must be in this sliver active chain');
    return this.data(child).previousSibling;
  }
  childAfter(child: RenderBox): RenderBox | null {
    if (!(child.parent === this && !this.data(child).keptAlive))
      invariant(false, 'invalid-active-sliver-child', 'Child must be in this sliver active chain');
    return this.data(child).nextSibling;
  }
  private syncSiblingsAt(index: number): void {
    const child = this.activeChildren[index],
      previous = this.activeChildren[index - 1] ?? null,
      next = this.activeChildren[index + 1] ?? null;
    if (child) {
      const data = this.data(child);
      data.previousSibling = previous;
      data.nextSibling = next;
      if (previous) this.data(previous).nextSibling = child;
      if (next) this.data(next).previousSibling = child;
    } else if (previous) this.data(previous).nextSibling = null;
  }
  private _debugVerifyChildOrder(): boolean {
    if (FoundationBuildMode.debug && this._debugChildIntegrityEnabled)
      for (let i = 1; i < this.activeChildren.length; i++) {
        if (!(this.indexOf(this.activeChildren[i - 1]!) < this.indexOf(this.activeChildren[i]!)))
          invariant(
            false,
            'invalid-sliver-child-order',
            'Active sliver child indices must strictly increase',
          );
      }
    return true;
  }
  override insert(child: RenderObject, after?: RenderObject): void {
    if (
      !(
        child instanceof RenderBox &&
        (!after || (after instanceof RenderBox && this.activeChildren.includes(after)))
      )
    )
      invariant(
        false,
        'invalid-sliver-insertion',
        'Insert requires a box and an active preceding child',
      );
    if ([...this._keepAliveBucket.values()].includes(child))
      invariant(
        false,
        'cached-sliver-insertion',
        'Cached child must be obtained through its keep-alive bucket',
      );
    try {
      super.insert(child, after);
    } finally {
      if (child.parent === this && !this.activeChildren.includes(child)) {
        const index = after ? this.activeChildren.indexOf(after as RenderBox) + 1 : 0;
        this.activeChildren.splice(index, 0, child);
        this.syncSiblingsAt(index);
      }
    }
    this._debugVerifyChildOrder();
  }
  override move(child: RenderObject, after?: RenderObject): void {
    if (!(child instanceof RenderBox && child.parent === this))
      invariant(false, 'invalid-sliver-child', 'Move requires an owned box');
    const data = this.data(child);
    if (!data.keptAlive) {
      if (!(!after || (after instanceof RenderBox && this.activeChildren.includes(after))))
        invariant(false, 'invalid-sliver-insertion', 'Move requires an active preceding child');
      super.move(child, after);
      const previousIndex = this.activeChildren.indexOf(child);
      this.activeChildren.splice(previousIndex, 1);
      this.syncSiblingsAt(previousIndex);
      const index = after ? this.activeChildren.indexOf(after as RenderBox) + 1 : 0;
      this.activeChildren.splice(index, 0, child);
      this.syncSiblingsAt(index);
      this.childManager.didAdoptChild(child);
      this.markNeedsLayout();
    } else {
      const previousIndex = this.indexOf(child);
      if (this._keepAliveBucket.get(previousIndex) === child)
        this._keepAliveBucket.delete(previousIndex);
      this.danglingKeepAlives.delete(child);
      try {
        this.childManager.didAdoptChild(child);
      } catch (error) {
        data.index = previousIndex;
        this._keepAliveBucket.set(previousIndex, child);
        throw error;
      }
      const index = this.indexOf(child),
        previous = this._keepAliveBucket.get(index);
      if (previous && previous !== child) this.danglingKeepAlives.add(previous);
      this._keepAliveBucket.set(index, child);
    }
  }
  override remove(child: RenderObject): void {
    if (!(child instanceof RenderBox && child.parent === this))
      invariant(false, 'invalid-sliver-child', 'Remove requires an owned box');
    const data = this.data(child),
      index = data.index;
    try {
      super.remove(child);
    } finally {
      if (child.parent !== this) {
        const active = this.activeChildren.indexOf(child);
        if (active >= 0) {
          this.activeChildren.splice(active, 1);
          this.syncSiblingsAt(active);
        }
        if (index !== null && this._keepAliveBucket.get(index) === child)
          this._keepAliveBucket.delete(index);
        this.danglingKeepAlives.delete(child);
      }
    }
  }
  removeAll(): void {
    const errors: unknown[] = [];
    const snapshot = [...this.children];
    for (const child of snapshot)
      try {
        this.remove(child);
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Sliver child removal failed');
  }
  override setChildren(children: readonly RenderObject[]): void {
    if (
      children.length === this.children.length &&
      children.every((child, index) => child === this.children[index])
    )
      return;
    if (!(children.length === 0))
      invariant(
        false,
        'managed-sliver-children',
        'SliverMultiBoxAdaptor children must be managed through its child manager',
      );
    this.removeAll();
  }
  /** @internal Queued widget build scopes flush inside this owner's real layout callback. */
  _invokeChildManagerLayoutCallback(callback: () => void): void {
    if (this.nativeScope) {
      callback();
      return;
    }
    this.invokeLayoutCallback<SliverConstraints>(() => callback());
  }
  protected _createOrObtainChild(
    index: number,
    { after }: { readonly after: RenderBox | null },
  ): void {
    this._invokeChildManagerLayoutCallback(() => {
      const child = this._keepAliveBucket.get(index);
      if (child) {
        const data = this.data(child);
        if (!data.keptAlive)
          invariant(false, 'invalid-keep-alive-bucket', 'Cached child must be marked keptAlive');
        super.move(child, after ?? undefined);
        this._keepAliveBucket.delete(index);
        data._keptAlive = false;
        const position = after ? this.activeChildren.indexOf(after) + 1 : 0;
        this.activeChildren.splice(position, 0, child);
        this.syncSiblingsAt(position);
        this.childManager.didObtainChild?.(child);
      } else {
        // Required admission may reclaim optional bucket entries, never an
        // explicit keep-alive or a visible child. The real owner performs the
        // teardown inside this already-authorized layout callback.
        if (this.childManager.boundedChildren) {
          const wasCollecting = this.collectingGarbage;
          this.collectingGarbage = true;
          try {
            for (const cached of this._keepAliveBucket.values()) {
              if (this.children.length < this.childCountLimit) break;
              if (!this.data(cached).keepAlive && !this.publishedNativeChild(cached))
                this.childManager.removeChild(cached);
            }
          } finally {
            this.collectingGarbage = wasCollecting;
          }
        }
        this.childManager.createChild(index, { after });
      }
    });
  }
  private _destroyOrCacheChild(child: RenderBox): void {
    const data = this.data(child);
    const published = this.publishedNativeChild(child);
    if (data.keepAlive || published || this.childManager.retainChild?.(child)) {
      if (data.keepAlive || published) this.childManager.didObtainChild?.(child, 'explicit');
      if (data.keptAlive)
        invariant(false, 'already-cached-sliver-child', 'An active child cannot already be cached');
      const index = this.indexOf(child);
      if (this._keepAliveBucket.has(index))
        invariant(false, 'duplicate-cached-sliver-index', 'A keep-alive index is already occupied');
      const position = this.activeChildren.indexOf(child);
      this.activeChildren.splice(position, 1);
      this.syncSiblingsAt(position);
      data.previousSibling = null;
      data.nextSibling = null;
      data._keptAlive = true;
      this._keepAliveBucket.set(index, child);
    } else {
      this.childManager.removeChild(child);
      if (!(child.parent === undefined))
        invariant(
          false,
          'sliver-child-not-removed',
          'Child manager must actually remove the retired child',
        );
    }
  }
  override visitChildren(visitor: (child: RenderObject) => void): void {
    for (const child of this.activeChildren) visitor(child);
    for (const child of this._keepAliveBucket.values()) visitor(child);
    for (const child of this.danglingKeepAlives) visitor(child);
  }
  visitChildrenForSemantics(visitor: (child: RenderObject) => void): void {
    for (const child of this.activeChildren) visitor(child);
  }
  override get semanticBounds(): Rect {
    if (this.geometry !== null && !this.geometry.visible && this.firstChild?.hasSize)
      return this.firstChild.paintBounds;
    return super.semanticBounds;
  }
  protected addInitialChild({
    index = 0,
    layoutOffset = 0,
  }: { readonly index?: number; readonly layoutOffset?: number } = {}): boolean {
    if (!(this.childManager.debugAssertChildListLocked() && this.firstChild === null))
      invariant(
        false,
        'invalid-initial-sliver-child',
        'Initial child requires an empty active list and an unlocked manager',
      );
    this._createOrObtainChild(index, { after: null });
    if (this.firstChild !== null) {
      if (!(this.firstChild === this.lastChild && this.indexOf(this.firstChild) === index))
        invariant(
          false,
          'invalid-initial-sliver-child',
          'Manager must create exactly the requested initial child',
        );
      this.data(this.firstChild).layoutOffset = layoutOffset;
      return true;
    }
    this.childManager.setDidUnderflow(true);
    return false;
  }
  protected insertAndLayoutLeadingChild(
    childConstraints: import('./constraints.ts').BoxConstraints,
    { parentUsesSize = false }: { readonly parentUsesSize?: boolean } = {},
  ): RenderBox | null {
    if (!(this.childManager.debugAssertChildListLocked() && this.firstChild !== null))
      invariant(
        false,
        'invalid-leading-sliver-child',
        'Leading child requires a current first child',
      );
    const index = this.indexOf(this.firstChild) - 1;
    this._createOrObtainChild(index, { after: null });
    if (this.firstChild !== null && this.indexOf(this.firstChild) === index) {
      this.firstChild.layout(childConstraints, { parentUsesSize });
      return this.firstChild;
    }
    this.childManager.setDidUnderflow(true);
    return null;
  }
  protected insertAndLayoutChild(
    childConstraints: import('./constraints.ts').BoxConstraints,
    {
      after,
      parentUsesSize = false,
    }: { readonly after: RenderBox | null; readonly parentUsesSize?: boolean },
  ): RenderBox | null {
    if (!(this.childManager.debugAssertChildListLocked() && after !== null))
      invariant(
        false,
        'invalid-following-sliver-child',
        'Following child requires a preceding child',
      );
    const index = this.indexOf(after) + 1;
    this._createOrObtainChild(index, { after });
    const child = this.childAfter(after);
    if (child !== null && this.indexOf(child) === index) {
      child.layout(childConstraints, { parentUsesSize });
      return child;
    }
    this.childManager.setDidUnderflow(true);
    return null;
  }
  protected calculateLeadingGarbage({ firstIndex }: { readonly firstIndex: number }): number {
    let child = this.firstChild,
      count = 0;
    while (child !== null && this.indexOf(child) < firstIndex) {
      count++;
      child = this.childAfter(child);
    }
    return count;
  }
  protected calculateTrailingGarbage({ lastIndex }: { readonly lastIndex: number }): number {
    let child = this.lastChild,
      count = 0;
    while (child !== null && this.indexOf(child) > lastIndex) {
      count++;
      child = this.childBefore(child);
    }
    return count;
  }
  protected collectGarbage(leadingGarbage: number, trailingGarbage: number): void {
    if (
      !(
        this.childManager.debugAssertChildListLocked() &&
        Number.isSafeInteger(leadingGarbage) &&
        Number.isSafeInteger(trailingGarbage) &&
        leadingGarbage >= 0 &&
        trailingGarbage >= 0 &&
        this.childCount >= leadingGarbage + trailingGarbage
      )
    )
      invariant(false, 'invalid-sliver-garbage', 'Garbage counts must fit the active child list');
    this.collectingGarbage = true;
    try {
      this._invokeChildManagerLayoutCallback(() => {
        while (leadingGarbage-- > 0) this._destroyOrCacheChild(this.firstChild!);
        while (trailingGarbage-- > 0) this._destroyOrCacheChild(this.lastChild!);
        const retired = [...this._keepAliveBucket.values()].filter((child) => {
          if (this.data(child).keepAlive || this.publishedNativeChild(child)) {
            this.childManager.didObtainChild?.(child, 'explicit');
            return false;
          }
          return !this.childManager.isRetainedChild?.(child);
        });
        for (const child of retired) this.childManager.removeChild(child);
        if (
          ![...this._keepAliveBucket.values()].every(
            (child) =>
              this.data(child).keepAlive ||
              this.publishedNativeChild(child) ||
              this.childManager.isRetainedChild?.(child),
          )
        )
          invariant(
            false,
            'unretired-sliver-keep-alive',
            'Manager must remove every released cached child',
          );
      });
    } finally {
      this.collectingGarbage = false;
    }
  }
  indexOf(child: RenderBox): number {
    const index = this.data(child).index;
    if (!(index !== null && Number.isSafeInteger(index)))
      invariant(
        false,
        'missing-sliver-child-index',
        'Child manager must provide an integer child index',
      );
    return index;
  }
  protected paintExtentOf(child: RenderBox): number {
    return this.constraints.axis === Axis.horizontal ? child.size.width : child.size.height;
  }
  protected override hitTestChildren(
    result: SliverHitTestResult,
    position: SliverHitPosition,
  ): boolean {
    let child = this.lastChild;
    while (child !== null) {
      if (this.hitTestBoxChild(result, child, position)) return true;
      child = this.childBefore(child);
    }
    return false;
  }
  protected override childMainAxisPosition(child: RenderBox): number {
    const offset = this.childScrollOffset(child);
    if (!(offset !== null))
      invariant(false, 'missing-sliver-child-offset', 'Active child needs a layout offset');
    return offset - this.constraints.scrollOffset;
  }
  override childScrollOffset(child: RenderObject): number | null {
    if (!(child.parent === this))
      invariant(false, 'invalid-sliver-child', 'Child must belong to this sliver');
    return this.data(child).layoutOffset;
  }
  paintsChild(child: RenderBox): boolean {
    const data = child.parentData;
    return (
      data instanceof SliverMultiBoxAdaptorParentData &&
      data.index !== null &&
      !this._keepAliveBucket.has(data.index) &&
      !this.danglingKeepAlives.has(child)
    );
  }
  applyPaintTransform(child: RenderBox, transform: Matrix4): void {
    if (!this.paintsChild(child)) transform.setZero();
    else this.applyPaintTransformForBoxChild(child, transform);
  }
  protected override childTransform(child: RenderObject): TransformMatrix {
    if (!(child instanceof RenderBox && child.parent === this))
      invariant(false, 'invalid-sliver-child', 'Transform requires an owned box');
    if (!this.paintsChild(child)) return [0, 0, 0, 0, 0, 0];
    let main = this.childMainAxisPosition(child);
    const cross = this.childCrossAxisPosition(child);
    if (!this._getRightWayUp(this.constraints))
      main = this.geometry!.paintExtent - this.paintExtentOf(child) - main;
    return multiply(
      this.constraints.axis === Axis.horizontal ? translate(main, cross) : translate(cross, main),
      child.localTransform,
    );
  }
  override paint(context: PaintingContext): void {
    for (const child of this.activeChildren) {
      const main = this.childMainAxisPosition(child);
      if (main < this.constraints.remainingPaintExtent && main + this.paintExtentOf(child) > 0)
        this.paintChild(context, child);
    }
  }
  override collectSemantics(
    output: SemanticsNode[],
    matrix: TransformMatrix = identity,
    clip?: Rect,
  ): void {
    if (!this.geometry?.visible && !this.ensureSemantics) return;
    for (const child of this.activeChildren)
      child.collectSemantics(output, multiply(matrix, this.childTransform(child)), clip);
  }
  debugAssertChildListIsNonEmptyAndContiguous(): boolean {
    if (FoundationBuildMode.debug) {
      if (!(this.firstChild !== null))
        invariant(false, 'empty-sliver-child-list', 'Active child list must not be empty');
      for (let i = 1; i < this.activeChildren.length; i++) {
        if (
          !(this.indexOf(this.activeChildren[i]!) === this.indexOf(this.activeChildren[i - 1]!) + 1)
        )
          invariant(
            false,
            'noncontiguous-sliver-child-list',
            'Active child indices must be contiguous',
          );
      }
    }
    return true;
  }
  override dispose(): void {
    try {
      super.dispose();
    } finally {
      if (this.debugDisposed) {
        this.activeChildren.length = 0;
        this._keepAliveBucket.clear();
        this.danglingKeepAlives.clear();
      }
    }
  }
}

NumericGeometryRenderObject._registerInputGeometryHooks(RenderSliverMultiBoxAdaptor.prototype);
