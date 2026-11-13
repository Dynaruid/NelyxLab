// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/layout_builder.dart at the recorded pin.
import { invariant } from '../../foundation/errors.ts';
import type { Constraints } from '../rendering/constraints.ts';
import { BoxConstraints } from '../rendering/constraints.ts';
import { RenderProxyBox } from '../rendering/boxes.ts';
import { RenderBox } from '../rendering/object.ts';
import { isNativeRenderObject } from '../rendering/object.ts';
import { registerNativeBoxConfiguration } from '../rendering/native-box.ts';
import { registerNativeLayoutCallback } from '../rendering/layout-callback.ts';
import type { RenderObject, TextBaseline } from '../rendering/object.ts';
import { RenderObjectWithLayoutCallbackMixin } from '../rendering/layout-callback.ts';
import type {
  RenderObjectConstructor,
  LayoutCallbackRenderObject,
} from '../rendering/layout-callback.ts';
import { assertOutsideRenderPaint } from '../rendering/phase.ts';
import {
  Widget,
  RenderObjectWidget,
  SingleChildRenderObjectElement,
  BuildScope,
} from './framework.ts';
import type { BuildContext, BuildOwner, Element, WidgetOptions } from './framework.ts';
import type { FrameScheduler } from '../scheduler/scheduler.ts';
import { tickerScheduler } from './ticker-scheduler.ts';
export interface NativeLayoutBuilderCosts {
  calls: number;
  builds: number;
  callbackMs: number;
  rebuildMs: number;
  descendantMs: number;
  renderCommitMs: number;
  scopeMs: number;
  syncMs: number;
}
const nativeBuilderCosts = new WeakMap<BuildOwner, NativeLayoutBuilderCosts>();
const emptyBuilderCosts = Object.freeze({
  calls: 0,
  builds: 0,
  callbackMs: 0,
  rebuildMs: 0,
  descendantMs: 0,
  renderCommitMs: 0,
  scopeMs: 0,
  syncMs: 0,
});
const nativeBuilderNow = () => {
  const clock = (globalThis as unknown as { performance?: { now(): number } }).performance;
  return clock ? clock.now() : Date.now();
};
/** @internal Owner-lifetime counters only. scopeMs contains callback/rebuild;
 * it also includes the owner's remaining dirty work and render commit. */
export function nativeLayoutBuilderCosts(owner: BuildOwner): Readonly<NativeLayoutBuilderCosts> {
  const costs = nativeBuilderCosts.get(owner);
  return costs ? Object.freeze({ ...costs }) : emptyBuilderCosts;
}
export type LayoutWidgetBuilder = (context: BuildContext, constraints: BoxConstraints) => Widget;
export interface AbstractLayoutBuilderRender<
  I,
  Child extends RenderObject = RenderObject,
> extends LayoutCallbackRenderObject {
  readonly child: Child | null | undefined;
  readonly layoutInfo: I;
  _updateCallback(value: ((constraints: Constraints) => void) | null): void;
}
type AbstractLayoutConstructor<
  I,
  Child extends RenderObject,
  Base extends RenderObjectConstructor<
    LayoutCallbackRenderObject & { readonly child: Child | undefined }
  >,
> = abstract new (...args: ConstructorParameters<Base>) => InstanceType<Base> &
  AbstractLayoutBuilderRender<I, Child> & {
    /** @internal The original callback receives an observed native input only. */
    _rebuildNativeWithConstraints(constraints: Constraints): boolean;
  };
/** Curried class factory retains a concrete base constructor and child protocol. */
export function RenderAbstractLayoutBuilderMixin<I, Child extends RenderObject>() {
  return <
    Base extends RenderObjectConstructor<
      LayoutCallbackRenderObject & { readonly child: Child | undefined }
    >,
  >(
    Base: Base,
  ): AbstractLayoutConstructor<I, Child, Base> => {
    abstract class AbstractLayoutRender extends Base {
      private _callback: ((constraints: Constraints) => void) | null = null;
      private _nativeLayoutInfo: I | undefined;
      _updateCallback(value: ((constraints: Constraints) => void) | null): void {
        if (value === this._callback) return;
        this._callback = value;
        if (value) this.scheduleLayoutCallback();
      }
      layoutCallback(): void {
        invariant(this._callback, 'missing-layout-callback', 'Layout builder callback is detached');
        this._callback(this.constraints);
      }
      get layoutInfo(): I {
        return this._nativeLayoutInfo ?? (this.constraints as unknown as I);
      }
      _rebuildNativeWithConstraints(constraints: Constraints): boolean {
        if (!this._callback || this.debugDisposed) return false;
        this._nativeLayoutInfo = constraints as unknown as I;
        try {
          this._runNativeLayoutCallback(() => this._callback!(constraints));
          return true;
        } finally {
          this._nativeLayoutInfo = undefined;
        }
      }
    }
    return AbstractLayoutRender as unknown as AbstractLayoutConstructor<I, Child, Base>;
  };
}
function sameLayoutInfo(a: unknown, b: unknown): boolean {
  return (
    a === b ||
    (a !== null &&
      typeof a === 'object' &&
      typeof (a as { equals?: unknown }).equals === 'function' &&
      (a as { equals: (other: unknown) => boolean }).equals(b))
  );
}
export abstract class AbstractLayoutBuilder<I> extends RenderObjectWidget {
  constructor(options: WidgetOptions = {}) {
    super(options.key ?? null);
  }
  abstract readonly builder: (context: BuildContext, layoutInfo: I) => Widget;
  get childWidgets(): readonly Widget[] {
    return [];
  }
  override createElement(): SingleChildRenderObjectElement {
    return new _LayoutBuilderElement<I>(this);
  }
  updateShouldRebuild(_old: AbstractLayoutBuilder<I>): boolean {
    return true;
  }
  abstract override createRenderObject(context: BuildContext): AbstractLayoutBuilderRender<I>;
}
export abstract class ConstrainedLayoutBuilder<
  C extends Constraints,
> extends AbstractLayoutBuilder<C> {
  constructor(
    readonly builder: (context: BuildContext, constraints: C) => Widget,
    options: WidgetOptions = {},
  ) {
    super(options);
    invariant(
      typeof builder === 'function',
      'invalid-layout-builder',
      'A synchronous builder is required',
    );
  }
}
class _LayoutBuilderElement<I> extends SingleChildRenderObjectElement {
  private readonly _buildScope = new BuildScope({ scheduleRebuild: () => this._scheduleRebuild() });
  private ready = false;
  private _needsBuild = true;
  private _previousLayoutInfo: I | undefined;
  private built: Widget | undefined;
  private deferred: { scheduler: FrameScheduler; id: number } | undefined;
  override get buildScope(): BuildScope {
    return this._buildScope;
  }
  override get renderObject(): AbstractLayoutBuilderRender<I> {
    return super.renderObject as AbstractLayoutBuilderRender<I>;
  }
  override mount(parent: Element | undefined, owner: BuildOwner, slot?: unknown): void {
    super.mount(parent, owner, slot);
    owner.forget(this);
    this.dirty = false;
    this.ready = true;
    this.renderObject._updateCallback(this._rebuildWithConstraints);
  }
  private _scheduleRebuild(): void {
    if (!this.ready || !this.active || this.deferred) return;
    const scheduler = tickerScheduler(this);
    if (scheduler.phase === 'idle' || scheduler.phase === 'post-frame') {
      const id = scheduler.scheduleFrameCallback(() => {
        this.deferred = undefined;
        if (this.active) this.renderObject.scheduleLayoutCallback();
      });
      this.deferred = { scheduler, id };
    } else this.renderObject.scheduleLayoutCallback();
  }
  private cancelDeferred(): void {
    if (this.deferred) {
      this.deferred.scheduler.cancelFrameCallbackWithId(this.deferred.id);
      this.deferred = undefined;
    }
  }
  override update(widget: Widget): void {
    assertOutsideRenderPaint();
    invariant(
      this.active &&
        Widget.canUpdate(this.widget, widget) &&
        widget instanceof AbstractLayoutBuilder,
      'invalid-widget-update',
      'LayoutBuilder type/key changed or context is inactive',
    );
    const old = this.widget as AbstractLayoutBuilder<I>;
    this.widget = widget;
    widget.updateRenderObject(this, this.renderObject);
    this.renderObject._updateCallback(this._rebuildWithConstraints);
    if (widget.updateShouldRebuild(old)) {
      this._needsBuild = true;
      this.renderObject.scheduleLayoutCallback();
    }
  }
  override markNeedsBuild(): void {
    assertOutsideRenderPaint();
    invariant(this.mounted, 'unmounted-element', 'Rebuild after unmount');
    this._needsBuild = true;
    if (this.ready && this.active) this.renderObject.scheduleLayoutCallback();
  }
  protected override build(): readonly Widget[] {
    (this.widget as AbstractLayoutBuilder<I>).updateRenderObject(this, this.renderObject);
    return this.built ? [this.built] : [];
  }
  private readonly _rebuildWithConstraints = (_constraints: Constraints): void => {
    // Native Content can flush this scope before its deferred App frame. That
    // frame only requested the work we are about to consume; leaving it queued
    // would invalidate the completed builder and require another transaction.
    // Cancel before building so new work scheduled during the callback survives.
    const native = isNativeRenderObject(this.renderObject);
    if (native) this.cancelDeferred();
    const info = this.renderObject.layoutInfo,
      needs = this._needsBuild || !sameLayoutInfo(info, this._previousLayoutInfo);
    let callbackMs = 0,
      rebuildMs = 0,
      scopeMs = 0,
      syncMs = 0;
    const scopeCosts = native ? { dirtyFlushMs: 0, renderCommitMs: 0 } : undefined;
    const scopeStarted = native ? nativeBuilderNow() : 0;
    try {
      try {
        this.owner.buildScope(
          this,
          needs
            ? () => {
                let built: Widget;
                const callbackStarted = native ? nativeBuilderNow() : 0;
                try {
                  built = (this.widget as AbstractLayoutBuilder<I>).builder(this, info);
                  invariant(
                    built instanceof Widget,
                    'invalid-layout-builder-result',
                    'Builder must synchronously return a Widget',
                  );
                } catch (exception) {
                  built = this.buildErrorWidget(exception);
                } finally {
                  if (native) callbackMs += nativeBuilderNow() - callbackStarted;
                }
                const rebuildStarted = native ? nativeBuilderNow() : 0;
                try {
                  this.built = built;
                  this.dirty = true;
                  this.rebuild();
                } catch (exception) {
                  this.built = this.buildErrorWidget(exception);
                  try {
                    this.owner.deactivateChildren(this.children);
                  } catch {}
                  this.children = [];
                  this.dirty = true;
                  this.rebuild();
                } finally {
                  this._needsBuild = false;
                  this._previousLayoutInfo = info;
                  if (native) rebuildMs += nativeBuilderNow() - rebuildStarted;
                }
              }
            : undefined,
          scopeCosts,
        );
      } finally {
        if (native) scopeMs = nativeBuilderNow() - scopeStarted;
      }
      const syncStarted = native ? nativeBuilderNow() : 0;
      try {
        this.syncRenderTree();
      } finally {
        if (native) syncMs = nativeBuilderNow() - syncStarted;
      }
    } finally {
      if (native) {
        let costs = nativeBuilderCosts.get(this.owner);
        if (!costs) nativeBuilderCosts.set(this.owner, (costs = { ...emptyBuilderCosts }));
        ++costs.calls;
        if (needs) ++costs.builds;
        costs.callbackMs += callbackMs;
        costs.rebuildMs += rebuildMs;
        costs.descendantMs += Math.max(0, scopeCosts!.dirtyFlushMs - callbackMs - rebuildMs);
        costs.renderCommitMs += scopeCosts!.renderCommitMs;
        costs.scopeMs += scopeMs;
        costs.syncMs += syncMs;
      }
    }
  };
  override deactivate(): void {
    this.cancelDeferred();
    super.deactivate();
  }
  override unmount(): void {
    if (!this.mounted) return;
    this.cancelDeferred();
    this.ready = false;
    this.renderObject._updateCallback(null);
    try {
      super.unmount();
    } finally {
      this._buildScope._clear();
      this.built = undefined;
    }
  }
}
export class LayoutBuilder extends ConstrainedLayoutBuilder<BoxConstraints> {
  override createRenderObject(
    _context: BuildContext,
  ): RenderBox<RenderObject> &
    AbstractLayoutBuilderRender<BoxConstraints, RenderBox<RenderObject>> {
    return new _RenderLayoutBuilder();
  }
}
class _RenderLayoutBuilder extends RenderAbstractLayoutBuilderMixin<
  BoxConstraints,
  RenderBox<RenderObject>
>()(RenderObjectWithLayoutCallbackMixin(RenderProxyBox)) {
  private nativeRevision = 1n;
  private nativeBuilt: { readonly revision: bigint; readonly constraints: BoxConstraints } | null =
    null;
  constructor() {
    super();
    registerNativeLayoutCallback(this, () => {
      ++this.nativeRevision;
    });
  }
  private readonly rebuildNative = (revision: bigint, constraints: BoxConstraints): boolean => {
    if (revision !== this.nativeRevision || !isNativeRenderObject(this) || this.debugDisposed)
      return false;
    if (!this._rebuildNativeWithConstraints(constraints) || this.debugDisposed) return false;
    this.nativeBuilt = { revision, constraints };
    // A callback may return the same Widget and leave every child unchanged.
    // Its completed Content input is still new native configuration metadata.
    this.markNeedsLayout();
    return true;
  };
  /** @internal Configuration only; neither callback nor layout runs during compilation. */
  nativeBuilderConfiguration() {
    return { revision: this.nativeRevision, built: this.nativeBuilt, rebuild: this.rebuildNative };
  }
  protected override computeMinIntrinsicWidth(_height: number): number {
    throw new Error(
      'LayoutBuilder cannot compute intrinsic dimensions without speculative tree mutation',
    );
  }
  protected override computeMaxIntrinsicWidth(_height: number): number {
    throw new Error(
      'LayoutBuilder cannot compute intrinsic dimensions without speculative tree mutation',
    );
  }
  protected override computeMinIntrinsicHeight(_width: number): number {
    throw new Error(
      'LayoutBuilder cannot compute intrinsic dimensions without speculative tree mutation',
    );
  }
  protected override computeMaxIntrinsicHeight(_width: number): number {
    throw new Error(
      'LayoutBuilder cannot compute intrinsic dimensions without speculative tree mutation',
    );
  }
  protected override computeDryLayout(_constraints: BoxConstraints): never {
    throw new Error('LayoutBuilder cannot compute dry layout without speculative tree mutation');
  }
  protected override computeDryBaseline(
    _constraints: BoxConstraints,
    _baseline: TextBaseline,
  ): never {
    throw new Error('LayoutBuilder cannot compute dry baseline without speculative tree mutation');
  }
  protected override performLayout(constraints: BoxConstraints) {
    this.runLayoutCallback();
    if (this.child) {
      this.child.layout(constraints, { parentUsesSize: true });
      this.child.layoutOffset = { x: 0, y: 0 };
      return constraints.constrain(this.child.size);
    }
    return constraints.biggest;
  }
}
RenderBox._registerGeometryLayoutSemantics(_RenderLayoutBuilder.prototype);
registerNativeBoxConfiguration(_RenderLayoutBuilder.prototype, (render, reject) => {
  if (
    [
      'layoutCallback',
      'runLayoutCallback',
      'scheduleLayoutCallback',
      '_updateCallback',
      '_runNativeLayoutCallback',
      '_rebuildNativeWithConstraints',
      'layoutInfo',
      'nativeBuilderConfiguration',
    ].some((name) => Object.hasOwn(render, name))
  )
    return reject('instance-layout-builder-hook');
  return {
    kind: 'box',
    layout: { childConstraints: 'inherit', expandEmpty: true },
    layoutBuilder: render.nativeBuilderConfiguration(),
  };
});
