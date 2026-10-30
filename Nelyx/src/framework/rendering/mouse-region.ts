// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { RenderProxyBox } from './boxes.ts';
import type { RenderBox, RenderObject, HitTestEntry, PipelineOwner } from './object.ts';
import { invariant } from '../../foundation/errors.ts';
import { contains, identity } from '../../ui/geometry.ts';
import type { Offset, TransformMatrix, Size } from '../../ui/geometry.ts';
import type { BoxConstraints } from './constraints.ts';
import type {
  MouseTrackerAnnotation,
  PointerEnterEventListener,
  PointerExitEventListener,
  PointerHoverEventListener,
} from '../../services/mouse-tracking.ts';
import { PointerHoverEvent } from '../gestures/events.ts';
import type { PointerEvent } from '../gestures/events.ts';
import type { HitTestEntry as SourceHitTestEntry } from '../gestures/hit-test.ts';
import { MouseCursor } from '../../services/mouse-cursor.ts';
export type MouseHitTestBehavior = 'deferToChild' | 'opaque' | 'translucent';
export interface RenderMouseRegionOptions {
  readonly child?: RenderBox<RenderObject>;
  readonly onEnter?: PointerEnterEventListener;
  readonly onExit?: PointerExitEventListener;
  readonly onHover?: PointerHoverEventListener;
  readonly cursor?: MouseCursor;
  readonly opaque?: boolean;
  readonly hitTestBehavior?: MouseHitTestBehavior | null;
}
export class RenderMouseRegion extends RenderProxyBox implements MouseTrackerAnnotation {
  private mouseAnnotationChanged(): void {
    if (this.hasDefaultPaintSemantics(RenderMouseRegion.prototype)) this.markNeedsPaintOnly();
    else this.markNeedsPaint();
  }
  onEnter: PointerEnterEventListener | undefined;
  onExit: PointerExitEventListener | undefined;
  onHover: PointerHoverEventListener | undefined;
  private _opaque: boolean;
  private behavior: MouseHitTestBehavior;
  private valid = true;
  private cursorValue: MouseCursor;
  constructor({
    child,
    onEnter,
    onExit,
    onHover,
    cursor = MouseCursor.defer,
    opaque = true,
    hitTestBehavior = null,
  }: RenderMouseRegionOptions = {}) {
    super(child);
    invariant(
      cursor instanceof MouseCursor &&
        typeof opaque === 'boolean' &&
        (hitTestBehavior === null ||
          ['deferToChild', 'opaque', 'translucent'].includes(hitTestBehavior)),
      'invalid-mouse-region',
      'Invalid mouse hit-test configuration',
    );
    this.onEnter = onEnter;
    this.onExit = onExit;
    this.onHover = onHover;
    this._opaque = opaque;
    this.behavior = hitTestBehavior ?? 'opaque';
    this.cursorValue = cursor;
  }
  get cursor(): MouseCursor {
    return this.cursorValue;
  }
  set cursor(value: MouseCursor) {
    this.assertCanMutateLayoutProperty();
    invariant(
      value instanceof MouseCursor,
      'invalid-mouse-cursor',
      'Mouse region requires a real cursor',
    );
    if (!this.cursorValue.equals(value)) {
      this.cursorValue = value;
      this.mouseAnnotationChanged();
    }
  }
  override handleEvent(event: PointerEvent, _entry: SourceHitTestEntry): void {
    if (event instanceof PointerHoverEvent) this.onHover?.(event);
  }
  get validForMouseTracker(): boolean {
    return this.valid;
  }
  override attach(owner: PipelineOwner): void {
    super.attach(owner);
    this.valid = true;
  }
  override detach(): void {
    this.valid = false;
    super.detach();
  }
  get opaque(): boolean {
    return this._opaque;
  }
  set opaque(value: boolean) {
    this.assertCanMutateLayoutProperty();
    invariant(typeof value === 'boolean', 'invalid-mouse-region', 'opaque must be boolean');
    if (value !== this._opaque) {
      this._opaque = value;
      this.mouseAnnotationChanged();
    }
  }
  get hitTestBehavior(): MouseHitTestBehavior {
    return this.behavior;
  }
  set hitTestBehavior(value: MouseHitTestBehavior | null) {
    this.assertCanMutateLayoutProperty();
    const behavior = value ?? 'opaque';
    invariant(
      ['deferToChild', 'opaque', 'translucent'].includes(behavior),
      'invalid-mouse-region',
      'Unknown mouse hit-test behavior',
    );
    if (behavior !== this.behavior) {
      this.behavior = behavior;
      this.mouseAnnotationChanged();
    }
  }
  protected override hitTestSelf(_position: Offset): boolean {
    return this.behavior === 'opaque';
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return this.child ? super.computeDryLayout(constraints) : constraints.biggest;
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    return this.child ? super.performLayout(constraints) : constraints.biggest;
  }
  override hitTest(
    position: Offset,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    if (!contains({ x: 0, y: 0, ...this.size }, position)) return false;
    const hit = super.hitTest(position, result, toLocal);
    if ((hit || this.behavior === 'translucent') && !result.some((entry) => entry.target === this))
      result.push({ target: this, transform: toLocal });
    return hit && this._opaque;
  }
}
RenderProxyBox._registerGeometryLayoutSemantics(RenderMouseRegion.prototype);
