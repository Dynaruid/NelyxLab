// SPDX-License-Identifier: BSD-3-Clause
// Reviewed Flutter rendering/flow.dart at the exact pin in upstream metadata.
import { invariant } from '../../foundation/errors.ts';
import type { Listenable } from '../../foundation/notifier.ts';
import {
  captureTransform,
  identity,
  multiply,
  inversePaintTransform,
  transform,
  contains,
} from '../../ui/geometry.ts';
import type { Size, Offset, TransformMatrix } from '../../ui/geometry.ts';
import { Paint } from '../../ui/paint.ts';
import { BoxConstraints } from './constraints.ts';
import { RenderBox, ContainerBoxParentData } from './object.ts';
import type { RenderObject, PipelineOwner, HitTestEntry } from './object.ts';
import type { PaintingContext } from '../painting/context.ts';
import { withRenderPaint, assertOutsideRenderPaint } from './phase.ts';

export type FlowClipBehavior = 'none' | 'hardEdge' | 'antiAlias' | 'antiAliasWithSaveLayer';
export interface FlowPaintChildOptions {
  readonly transform?: readonly number[] | Float64Array;
  readonly opacity?: number;
}
export interface FlowPaintingContext {
  readonly size: Size;
  readonly childCount: number;
  getChildSize(index: number): Size | null;
  paintChild(index: number, options?: FlowPaintChildOptions): void;
}
export interface FlowDelegateOptions {
  readonly repaint?: Listenable | null;
  readonly typeToken?: object | symbol;
}
export abstract class FlowDelegate {
  readonly repaint: Listenable | null;
  readonly typeToken: object | symbol;
  constructor(options: FlowDelegateOptions = {}) {
    invariant(
      Object.keys(options).every((key) => ['repaint', 'typeToken'].includes(key)),
      'unsupported-flow-delegate',
      'Unknown Flow delegate option',
    );
    this.repaint = options.repaint ?? null;
    this.typeToken = options.typeToken ?? this.constructor;
    invariant(
      !this.repaint ||
        (typeof this.repaint.addListener === 'function' &&
          typeof this.repaint.removeListener === 'function'),
      'invalid-flow-repaint',
      'repaint must implement Listenable',
    );
  }
  getSize(constraints: BoxConstraints): Size {
    return constraints.biggest;
  }
  getConstraintsForChild(_index: number, constraints: BoxConstraints): BoxConstraints {
    return constraints;
  }
  abstract paintChildren(context: FlowPaintingContext): void;
  shouldRelayout(_oldDelegate: FlowDelegate): boolean {
    return false;
  }
  abstract shouldRepaint(oldDelegate: FlowDelegate): boolean;
  toString(): string {
    return this.constructor.name;
  }
}
const transforms = new WeakMap<FlowParentData, TransformMatrix | null>();
export class FlowParentData extends ContainerBoxParentData<RenderBox<RenderObject>> {
  override detach(): void {
    transforms.delete(this);
    super.detach();
  }
}
interface Subscription {
  readonly source: Listenable;
  readonly callback: () => void;
  active: boolean;
  pending: boolean;
  notified: boolean;
}
interface PaintedChild {
  readonly child: RenderBox<RenderObject>;
  readonly data: FlowParentData;
}
interface PaintScope {
  readonly context: PaintingContext;
  readonly children: readonly RenderBox<RenderObject>[];
  readonly order: PaintedChild[];
  readonly seen: Set<RenderBox<RenderObject>>;
}
function attempt(errors: unknown[], callback: () => void): void {
  try {
    callback();
  } catch (error) {
    errors.push(error);
  }
}
function failures(errors: unknown[], message: string): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw new AggregateError(errors, message);
}
function clip(value: FlowClipBehavior): FlowClipBehavior {
  invariant(
    ['none', 'hardEdge', 'antiAlias', 'antiAliasWithSaveLayer'].includes(value),
    'invalid-flow-clip',
    'Unknown Flow clip behavior',
  );
  return value;
}
function measuredSize(delegate: FlowDelegate, constraints: BoxConstraints): Size {
  const size = delegate.getSize(constraints);
  invariant(
    size &&
      [size.width, size.height].every((n) => typeof n === 'number' && !Number.isNaN(n) && n >= 0),
    'invalid-flow-size',
    'Flow size must be nonnegative without NaN',
  );
  return constraints.constrain(size);
}

export interface RenderFlowOptions {
  readonly children?: readonly RenderBox<RenderObject>[];
  readonly clipBehavior?: FlowClipBehavior;
}
/** Paint-time child placement; records value commands and never owns GPU objects. */
export class RenderFlow extends RenderBox implements FlowPaintingContext {
  private current: FlowDelegate;
  private clipping: FlowClipBehavior;
  private subscription: Subscription | undefined;
  private changing = false;
  private randomAccess: readonly RenderBox<RenderObject>[] = [];
  private lastPaintOrder: readonly PaintedChild[] = [];
  private scope: PaintScope | undefined;
  constructor(delegate: FlowDelegate, options: RenderFlowOptions = {}) {
    super();
    invariant(
      Object.keys(options).every((key) => ['children', 'clipBehavior'].includes(key)),
      'unsupported-flow',
      'Unknown RenderFlow option',
    );
    invariant(
      delegate instanceof FlowDelegate,
      'invalid-flow-delegate',
      'Flow requires FlowDelegate',
    );
    this.current = delegate;
    this.clipping = clip(options.clipBehavior ?? 'hardEdge');
    if (options.children) this.setChildren(options.children);
  }
  override setupParentData(child: RenderObject): void {
    invariant(child instanceof RenderBox, 'invalid-flow-child', 'Flow requires RenderBox children');
    const data =
      child.parentData instanceof FlowParentData ? child.parentData : new FlowParentData();
    child.parentData = data;
    transforms.set(data, null);
  }
  get delegate(): FlowDelegate {
    return this.current;
  }
  set delegate(value: FlowDelegate) {
    this.assertCanMutateLayoutProperty();
    invariant(
      !this.changing && value instanceof FlowDelegate,
      'invalid-flow-delegate',
      'Wrong or reentrant Flow delegate',
    );
    if (value === this.current) return;
    this.changing = true;
    const errors: unknown[] = [];
    try {
      const old = this.current,
        different = old.typeToken !== value.typeToken,
        relayout = different || value.shouldRelayout(old),
        repaint = relayout || value.shouldRepaint(old),
        next = this.attached ? this.subscribe(value.repaint) : undefined,
        previous = this.subscription;
      this.current = value;
      this.subscription = next;
      if (next) {
        next.pending = false;
        next.active = true;
      }
      this.retire(previous, errors);
      if (relayout) attempt(errors, () => this.markNeedsLayout());
      else if (repaint || next?.notified) attempt(errors, () => this.markNeedsPaint());
    } finally {
      this.changing = false;
    }
    failures(errors, 'Flow delegate replacement failed');
  }
  get clipBehavior(): FlowClipBehavior {
    return this.clipping;
  }
  set clipBehavior(value: FlowClipBehavior) {
    this.assertCanMutateLayoutProperty();
    const next = clip(value);
    if (this.clipping !== next) {
      this.clipping = next;
      this.markNeedsPaint();
    }
  }
  override get clips(): boolean {
    return this.clipping !== 'none';
  }
  get childCount(): number {
    return this.children.length;
  }
  private subscribe(source: Listenable | null): Subscription | undefined {
    if (!source) return;
    const entry: Subscription = {
      source,
      callback: () => {
        if (entry.active && this.attached && !this.debugDisposed) this.markNeedsPaint();
        else if (entry.pending) entry.notified = true;
      },
      active: false,
      pending: true,
      notified: false,
    };
    try {
      source.addListener(entry.callback);
      return entry;
    } catch (error) {
      entry.pending = false;
      const errors = [error];
      attempt(errors, () => source.removeListener(entry.callback));
      failures(errors, 'Flow listener registration failed');
      return;
    }
  }
  private retire(entry: Subscription | undefined, errors: unknown[]): void {
    if (entry) {
      entry.active = false;
      entry.pending = false;
      attempt(errors, () => entry.source.removeListener(entry.callback));
    }
  }
  override attach(owner: PipelineOwner): void {
    invariant(!this.changing, 'reentrant-flow-delegate', 'Flow binding is active');
    const attached = this.attached;
    super.attach(owner);
    if (attached) return;
    this.changing = true;
    try {
      const entry = this.subscribe(this.current.repaint);
      this.subscription = entry;
      if (entry) {
        entry.pending = false;
        entry.active = true;
        if (entry.notified) this.markNeedsPaint();
      }
    } catch (error) {
      const errors = [error];
      this.retire(this.subscription, errors);
      this.subscription = undefined;
      if (!this.parent) attempt(errors, () => super.detach());
      failures(errors, 'Flow attach failed');
    } finally {
      this.changing = false;
    }
  }
  override detach(): void {
    invariant(!this.changing, 'reentrant-flow-delegate', 'Flow binding is active');
    this.changing = true;
    const errors: unknown[] = [];
    try {
      attempt(errors, () => super.detach());
      if (!this.attached) {
        const entry = this.subscription;
        this.subscription = undefined;
        this.retire(entry, errors);
      }
    } finally {
      this.changing = false;
    }
    failures(errors, 'Flow detach failed');
  }
  override dispose(): void {
    assertOutsideRenderPaint();
    const errors: unknown[] = [];
    attempt(errors, () => super.dispose());
    if (this.debugDisposed) {
      this.lastPaintOrder = [];
      this.randomAccess = [];
      const entry = this.subscription;
      this.subscription = undefined;
      this.retire(entry, errors);
    }
    failures(errors, 'Flow teardown failed');
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return measuredSize(this.current, constraints);
  }
  private intrinsicDimension(dimension: 'width' | 'height', input: number): number {
    const size = measuredSize(
        this.current,
        dimension === 'width'
          ? BoxConstraints.tightForFinite(Infinity, input)
          : BoxConstraints.tightForFinite(input, Infinity),
      ),
      value = size[dimension];
    return Number.isFinite(value) ? value : 0;
  }
  protected override computeMinIntrinsicWidth(height: number): number {
    return this.intrinsicDimension('width', height);
  }
  protected override computeMaxIntrinsicWidth(height: number): number {
    return this.intrinsicDimension('width', height);
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    return this.intrinsicDimension('height', width);
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return this.intrinsicDimension('height', width);
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const size = this.getDryLayout(constraints);
    this.size = size;
    const children = [...this.children];
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!,
        inner = this.current.getConstraintsForChild(i, constraints);
      invariant(
        inner instanceof BoxConstraints,
        'invalid-flow-constraints',
        'Flow child constraints must be BoxConstraints',
      );
      inner.debugAssertIsValid({ isAppliedConstraint: true });
      child.layout(inner, { parentUsesSize: true });
      child.layoutOffset = { x: 0, y: 0 };
    }
    this.randomAccess = Object.freeze(children);
    return size;
  }
  getChildSize(index: number): Size | null {
    invariant(
      Number.isSafeInteger(index),
      'invalid-flow-index',
      'Flow child index must be an integer',
    );
    if (index < 0 || index >= this.randomAccess.length) return null;
    invariant(!this.needsLayout, 'stale-flow-layout', 'Flow child sizes require current layout');
    return this.randomAccess[index]!.size;
  }
  /** The inherited protected canvas/child hook has a different protocol; Flow exposes indexed painting. */
  paintChild(index: number, options?: FlowPaintChildOptions): void;
  override paintChild(context: PaintingContext, child: RenderObject): void;
  override paintChild(
    index: number | PaintingContext,
    options: FlowPaintChildOptions | RenderObject = {},
  ): void {
    const scope = this.scope;
    invariant(scope, 'inactive-flow-paint', 'Flow paintChild is valid only inside paintChildren');
    invariant(
      typeof index === 'number' &&
        Number.isSafeInteger(index) &&
        index >= 0 &&
        index < scope.children.length,
      'invalid-flow-index',
      'Flow paintChild requires an existing integer child index',
    );
    invariant(
      options && Object.keys(options).every((key) => ['transform', 'opacity'].includes(key)),
      'invalid-flow-paint-options',
      'Unknown Flow paint options',
    );
    const values = options as FlowPaintChildOptions,
      opacity = values.opacity ?? 1;
    invariant(
      Number.isFinite(opacity) && opacity >= 0 && opacity <= 1,
      'invalid-flow-opacity',
      'Flow opacity must be between zero and one',
    );
    const matrix = captureTransform(values.transform ?? identity),
      child = scope.children[index]!,
      data = child.parentData;
    invariant(
      data instanceof FlowParentData && child.parent === this,
      'stale-flow-child',
      'Flow child owner changed',
    );
    invariant(
      !scope.seen.has(child),
      'duplicate-flow-paint',
      'Each Flow child can be painted at most once',
    );
    scope.seen.add(child);
    transforms.set(data, matrix);
    scope.order.push({ child, data });
    if (opacity === 0) return;
    const context = scope.context;
    if (opacity !== 1)
      context.saveLayer(null, new Paint({ color: (Math.round(opacity * 255) * 0x1000000) >>> 0 }));
    try {
      const start = context.commands.length;
      context.paintChild(child, this.childTransform(child));
      let depth = 1;
      for (const command of context.commands.slice(start + 1, -1)) {
        if (command.op === 'save' || command.op === 'saveLayer') depth++;
        else if (command.op === 'restore') {
          depth--;
          invariant(
            depth >= 1,
            'unbalanced-flow-child',
            'Child restored its enclosing paint scope',
          );
        }
      }
      invariant(depth === 1, 'unbalanced-flow-child', 'Child must balance paint saves');
    } finally {
      if (opacity !== 1) context.restore();
    }
  }
  protected override childTransform(child: RenderObject): TransformMatrix {
    const data = child.parentData,
      matrix = data instanceof FlowParentData ? transforms.get(data) : undefined;
    return matrix ? multiply(matrix, super.childTransform(child)) : super.childTransform(child);
  }
  override paint(context: PaintingContext): void {
    invariant(
      !this.scope && !this.needsLayout,
      'inactive-flow-layout',
      'Flow paint requires current layout and cannot reenter',
    );
    const children = this.randomAccess,
      start = context.commands.length,
      previous = children.map((child) => {
        const data = child.parentData;
        invariant(
          data instanceof FlowParentData,
          'invalid-flow-parent-data',
          'Flow parent data required',
        );
        return { data, transform: transforms.get(data) ?? null };
      }),
      scope: PaintScope = { context, children, order: [], seen: new Set() };
    this.scope = scope;
    for (const { data } of previous) transforms.set(data, null);
    try {
      context.save();
      if (this.clipping !== 'none')
        context.clipRect(this.paintBounds, { doAntiAlias: this.clipping !== 'hardEdge' });
      if (this.clipping === 'antiAliasWithSaveLayer')
        context.saveLayer(this.paintBounds, new Paint());
      withRenderPaint(() => this.current.paintChildren(this));
      if (this.clipping === 'antiAliasWithSaveLayer') context.restore();
      context.restore();
      this.lastPaintOrder = Object.freeze(scope.order);
    } catch (error) {
      const errors: unknown[] = [error];
      try {
        context.rollback(start);
      } catch (cleanup) {
        errors.push(cleanup);
      }
      for (const entry of previous) transforms.set(entry.data, entry.transform);
      if (errors.length > 1)
        throw new AggregateError(errors, 'Flow paint and resource rollback failed');
      throw error;
    } finally {
      this.scope = undefined;
    }
  }
  hitTestChildren(
    position: Offset,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    if (this.needsLayout) return false;
    for (const { child, data } of [...this.lastPaintOrder].reverse()) {
      if (child.parent !== this || child.parentData !== data || !transforms.get(data)) continue;
      const inverse = inversePaintTransform(this.childTransform(child));
      if (
        inverse &&
        child.hitTest(transform(inverse, position), result, multiply(inverse, toLocal))
      )
        return true;
    }
    return false;
  }
  override hitTest(
    position: Offset,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    invariant(this.hasSize, 'missing-hit-test-size', 'Flow hit testing requires layout');
    if (!contains(this.paintBounds, position) || this.needsLayout) return false;
    let hit = this.hitTestChildren(position, result, toLocal);
    if (this.onPointer || this.semantics) {
      result.push({ target: this, transform: toLocal });
      hit = true;
    }
    return hit;
  }
}
