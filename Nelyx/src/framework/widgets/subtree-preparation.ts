// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../../foundation/errors.ts';
import { PreparationResourceBudget } from '../../hosting/resources.ts';
import { PipelineOwner } from '../rendering/object.ts';
import type { RenderObject } from '../rendering/object.ts';
import { RenderProxyBox } from '../rendering/boxes.ts';
import {
  RenderSliverMultiBoxAdaptor,
  SliverMultiBoxAdaptorParentData,
} from '../rendering/sliver-multi-box-adaptor.ts';
import type { BoxConstraints } from '../rendering/constraints.ts';
import {
  BuildScope,
  Element,
  RenderObjectElement,
  SingleChildRenderObjectElement,
  SingleChildRenderObjectWidget,
} from './framework.ts';
import type { BuildOwner, Widget } from './framework.ts';

class PreparationRenderBox extends RenderProxyBox {
  constructor(private readonly sliverChild: boolean) {
    super();
  }
  override setupParentData(child: RenderObject): void {
    if (this.sliverChild) child.parentData = new SliverMultiBoxAdaptorParentData();
    else super.setupParentData(child);
  }
}
class PreparationBoundary extends SingleChildRenderObjectWidget {
  private produced: Widget | undefined;
  constructor(
    readonly produce: Widget | (() => Widget),
    readonly scope: BuildScope,
    readonly sliverChild: boolean,
  ) {
    super(undefined);
  }
  override get childWidgets(): readonly Widget[] {
    this.produced ??= typeof this.produce === 'function' ? this.produce() : this.produce;
    return [this.produced];
  }
  override createElement(): PreparationBoundaryElement {
    return new PreparationBoundaryElement(this);
  }
  createRenderObject(): RenderProxyBox {
    return new PreparationRenderBox(this.sliverChild);
  }
}
class PreparationBoundaryElement extends SingleChildRenderObjectElement {
  override get buildScope(): BuildScope {
    return (this.widget as PreparationBoundary).scope;
  }
  // This root is an ancestry bridge, never a child of the published render tree.
  override get renderObjects() {
    return [];
  }
  override attachRenderObject(slot: unknown): void {
    this.currentSlot = slot;
  }
  protected override attachNotificationTree(): void {
    this.attachNotificationTarget({ onNotification: () => true });
  }
}

/** @internal One cold subtree in its canonical owner. No callback is replayed
 * on yield or required completion; cancellation owns every mounted Element and
 * its detached pipeline. Timers/subscriptions remain the opt-in State's job. */
export class SubtreePreparation {
  readonly scope: BuildScope;
  readonly boundary: PreparationBoundaryElement;
  readonly pipeline = new PipelineOwner({ accessibilityEnabled: false, detachedPreparation: true });
  readonly resourceBudget = new PreparationResourceBudget();
  private state: 'pending' | 'ready' | 'adopted' | 'cancelled' = 'pending';
  constructor(
    readonly owner: BuildOwner,
    readonly parent: Element,
    child: Widget | (() => Widget),
    readonly constraints: BoxConstraints,
  ) {
    this.scope = owner._createPreparationScope({ finiteProduction: true });
    this.boundary = new PreparationBoundary(
      child,
      this.scope,
      parent instanceof RenderObjectElement &&
        parent.renderObject instanceof RenderSliverMultiBoxAdaptor,
    ).createElement();
    owner._setPreparationCancellation(this.scope, () => this.cancel());
    owner._setPreparationResources(this.scope, this.resourceBudget);
    try {
      owner.services.resources._withPreparationBudget(this.resourceBudget, () => {
        this.boundary._mountPreparationRoot(parent, owner, this.scope);
        this.pipeline.setRoot(this.boundary.renderObject);
      });
    } catch (error) {
      this.fail(error);
    }
  }
  /** Production is ready for adoption. Layout coverage is established once in
   * the real parent's pipeline before CPU capture, never by a detached layout
   * that attachment would invalidate and replay (including custom delegates). */
  get ready(): boolean {
    return this.state === 'ready' && this.owner._preparationProductionReady(this.scope);
  }
  /** Each predicate call precedes an atomic rebuild/owner commit operation. */
  advance(shouldContinue: () => boolean): 'pending' | 'ready' {
    invariant(
      this.state === 'pending' || this.state === 'ready',
      'retired-preparation',
      'Cannot resume adopted or cancelled preparation',
    );
    try {
      return this.pipeline._withDetachedPreparation(() =>
        this.owner.services.resources._withPreparationBudget(this.resourceBudget, () => {
          if (!this.owner._advancePreparationBuild(this.scope, shouldContinue)) return 'pending';
          this.owner.finalizeTree(this.scope);
          this.state = 'ready';
          return 'ready';
        }),
      );
    } catch (error) {
      return this.fail(error);
    }
  }
  /** A required page drains this cursor, then its real parent completes layout. */
  complete(): void {
    this.advance(() => true);
  }
  adopt(slot: unknown): Element {
    invariant(this.ready, 'incomplete-preparation', 'Adoption requires complete finite production');
    const child = this.boundary.children[0];
    invariant(
      child && this.boundary.children.length === 1,
      'invalid-prepared-child',
      'Preparation must produce exactly one child',
    );
    try {
      this.pipeline.setRoot(undefined);
      this.owner._adoptPreparation(this.scope, child, this.parent, slot);
      this.boundary.unmount();
      this.pipeline.dispose();
      this.state = 'adopted';
      return child;
    } catch (error) {
      return this.fail(error);
    }
  }
  cancel(): void {
    if (this.state === 'cancelled') return;
    this.state = 'cancelled';
    const errors: unknown[] = [];
    if (!this.pipeline.debugDisposed)
      try {
        this.pipeline.setRoot(undefined);
      } catch (error) {
        errors.push(error);
      }
    if (this.owner._ownsPreparationScope(this.scope))
      try {
        this.owner._disposePreparationScope(this.scope);
      } catch (error) {
        errors.push(error);
      }
    if (!this.pipeline.debugDisposed)
      try {
        this.pipeline.dispose();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Preparation cancellation failed');
  }
  private fail(error: unknown): never {
    const details = this.owner._preparationFailure(this.scope),
      errors = [error];
    try {
      this.cancel();
    } catch (cleanup) {
      errors.push(cleanup);
    }
    if (details)
      try {
        this.owner.reportError(details);
      } catch (reported) {
        if (reported !== error) errors.push(reported);
      }
    if (errors.length > 1) throw new AggregateError(errors, 'Preparation and cancellation failed');
    throw error;
  }
}
