// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed selection handler/delegate from the pinned widgets/scrollable.dart.
import { State, StatefulWidget } from './framework.ts';
import type { Widget, BuildContext } from './framework.ts';
import type { ScrollableState } from './scrollable.ts';
import type { ScrollPosition } from './scroll-position.ts';
import { SelectionContainer } from './selection-container.ts';
import { MultiSelectableSelectionContainerDelegate } from './selectable-region.ts';
import { EdgeDraggingAutoScroller } from './scrollable-helpers.ts';
import { maybeTickerScheduler } from './ticker-scheduler.ts';
import { AxisDirection } from '../painting/basic-types.ts';
import { RenderBox } from '../rendering/object.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { MatrixUtils } from '../painting/matrix-utils.ts';
import { Offset } from '../../ui/offset.ts';
import { Rect } from '../../ui/rect.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import {
  SelectionResult,
  SelectionEventType,
  SelectionEdgeUpdateEvent,
} from '../rendering/selection.ts';
import type {
  Selectable,
  SelectionRegistrar,
  SelectionEvent,
  ClearSelectionEvent,
  SelectAllSelectionEvent,
  SelectWordSelectionEvent,
  GranularlyExtendSelectionEvent,
  DirectionallyExtendSelectionEvent,
} from '../rendering/selection.ts';
const debugAssert = (condition: boolean): void => {
  if (FoundationBuildMode.debug)
    invariant(condition, 'invalid-scroll-selection', 'Invalid scrollable selection state');
};
const matrix = (value: ReturnType<Selectable['getTransformTo']>): Matrix4 =>
  value instanceof Matrix4 ? value : Matrix4.fromList(value);
/** @internal This owner is mounted only while a parent registrar enables selection. */
export class ScrollableSelectionHandler extends StatefulWidget {
  constructor(
    readonly scrollable: ScrollableState,
    readonly position: ScrollPosition,
    readonly registrar: SelectionRegistrar,
    readonly child: Widget,
  ) {
    super();
  }
  createState(): State<ScrollableSelectionHandler> {
    return new ScrollableSelectionHandlerState();
  }
}
class ScrollableSelectionHandlerState extends State<ScrollableSelectionHandler> {
  private delegate!: ScrollableSelectionContainerDelegate;
  override initState(): void {
    super.initState();
    this.delegate = new ScrollableSelectionContainerDelegate({
      state: this.widget.scrollable,
      position: this.widget.position,
    });
  }
  override didUpdateWidget(old: ScrollableSelectionHandler): void {
    super.didUpdateWidget(old);
    if (old.position !== this.widget.position) this.delegate.position = this.widget.position;
  }
  override dispose(): void {
    this.delegate.dispose();
    super.dispose();
  }
  build(): Widget {
    return new SelectionContainer({
      registrar: this.widget.registrar,
      delegate: this.delegate,
      child: this.widget.child,
    });
  }
}
/** @internal Fixed source coordinates let both selection edges survive scroll layout. */
export class ScrollableSelectionContainerDelegate extends MultiSelectableSelectionContainerDelegate {
  readonly state: ScrollableState;
  private readonly autoScroller: EdgeDraggingAutoScroller;
  private currentPosition: ScrollPosition;
  private layoutChangeScheduled = false;
  private generation = 0;
  private retired = false;
  private dragStart: Offset | null = null;
  private dragEnd: Offset | null = null;
  private selectionStartsInside = false;
  private readonly startRecords = new Map<Selectable, number>();
  private readonly endRecords = new Map<Selectable, number>();
  constructor({
    state,
    position,
  }: {
    readonly state: ScrollableState;
    readonly position: ScrollPosition;
  }) {
    super();
    this.state = state;
    this.currentPosition = position;
    this.autoScroller = new EdgeDraggingAutoScroller(state, { velocityScalar: 30 });
    position.addListener(this.scheduleLayoutChange);
  }
  get position(): ScrollPosition {
    return this.currentPosition;
  }
  set position(other: ScrollPosition) {
    if (other === this.currentPosition) return;
    this.currentPosition.removeListener(this.scheduleLayoutChange);
    this.currentPosition = other;
    other.addListener(this.scheduleLayoutChange);
  }
  override _setSelectionContainerContext(context: BuildContext | null): void {
    super._setSelectionContainerContext(context);
    this.generation++;
    if (context !== null && this.layoutChangeScheduled) this.enqueueLayoutChange();
  }
  private readonly scheduleLayoutChange = (): void => {
    if (this.retired || this.layoutChangeScheduled) return;
    this.layoutChangeScheduled = true;
    this.enqueueLayoutChange();
  };
  /** Host boundary for the source SchedulerBinding post-frame layout callback. */
  protected scheduleScrollSelectionLayoutUpdate(callback: () => void): void {
    const context = this.selectionContainerContext;
    if (context === null) return;
    maybeTickerScheduler(context)?.addPostFrameCallback(callback, {
      debugLabel: 'ScrollableSelectionContainer.layoutDidChange',
    });
  }
  private enqueueLayoutChange(): void {
    const generation = this.generation;
    this.scheduleScrollSelectionLayoutUpdate(() => {
      if (this.retired || generation !== this.generation || !this.layoutChangeScheduled) return;
      this.layoutChangeScheduled = false;
      this.layoutDidChange();
    });
  }
  private get scrollBox(): RenderBox {
    const box = this.state.context.findRenderObject();
    invariant(
      box instanceof RenderBox,
      'missing-scroll-selection-box',
      'Scrollable selection requires a RenderBox',
    );
    return box;
  }
  override didChangeSelectables(): void {
    const current = new Set(this.selectables);
    for (const child of this.startRecords.keys())
      if (!current.has(child)) this.startRecords.delete(child);
    for (const child of this.endRecords.keys())
      if (!current.has(child)) this.endRecords.delete(child);
    super.didChangeSelectables();
  }
  protected override handleClearSelection(event: ClearSelectionEvent): SelectionResult {
    this.startRecords.clear();
    this.endRecords.clear();
    this.dragStart = this.dragEnd = null;
    this.selectionStartsInside = false;
    return super.handleClearSelection(event);
  }
  protected override handleSelectionEdgeUpdate(event: SelectionEdgeUpdateEvent): SelectionResult {
    if (this.dragStart === null && this.dragEnd === null) {
      debugAssert(!this.selectionStartsInside);
      this.selectionStartsInside = this.globalPositionInside(event.globalPosition);
    }
    const delta = this.state.deltaToScrollOrigin,
      isEnd = event.type === SelectionEventType.endEdgeUpdate,
      related = this.inferOriginPosition(event.globalPosition),
      offset = related.translate(-delta.dx, -delta.dy);
    if (isEnd) this.dragEnd = related;
    else this.dragStart = related;
    const adjusted = isEnd
        ? SelectionEdgeUpdateEvent.forEnd({
            globalPosition: offset,
            granularity: event.granularity,
          })
        : SelectionEdgeUpdateEvent.forStart({
            globalPosition: offset,
            granularity: event.granularity,
          }),
      result = super.handleSelectionEdgeUpdate(adjusted);
    if (result === SelectionResult.pending) {
      this.autoScroller.stopAutoScroll();
      return result;
    }
    if (this.selectionStartsInside) {
      if (!(this.state.resolvedPhysics?.allowSelectionEdgeScrolling ?? true)) {
        this.autoScroller.stopAutoScroll();
        return result;
      }
      this.autoScroller.startAutoScrollIfNecessary(
        Rect.fromCenter({ center: adjusted.globalPosition, width: 0, height: 0 }),
      );
      if (this.autoScroller.scrolling) return SelectionResult.pending;
    }
    return result;
  }
  private inferOriginPosition(global: Offset): Offset {
    const box = this.scrollBox,
      local = box.globalToLocal(global);
    if (!this.selectionStartsInside) {
      if (local.y < 0 || local.x < 0) {
        const point = box.localToGlobal(Offset.zero);
        return new Offset(point.x, point.y);
      }
      if (local.y > box.size.height || local.x > box.size.width) return Offset.infinite;
    }
    const delta = this.state.deltaToScrollOrigin,
      point = box.localToGlobal(new Offset(local.x + delta.dx, local.y + delta.dy));
    return new Offset(point.x, point.y);
  }
  private updateDragLocations(forceStart = true, forceEnd = true): void {
    const delta = this.state.deltaToScrollOrigin,
      box = this.scrollBox,
      transform = Matrix4.fromList(box.getTransformTo(null));
    for (const [isEnd, index, force, old] of [
      [false, this.currentSelectionStartIndex, forceStart, this.dragStart],
      [true, this.currentSelectionEndIndex, forceEnd, this.dragEnd],
    ] as const) {
      if (index === -1 || (old !== null && !force)) continue;
      const child = this.selectables[index]!,
        geometry = child.value;
      debugAssert(geometry.hasSelection);
      const point = (isEnd ? geometry.endSelectionPoint : geometry.startSelectionPoint)!,
        local = MatrixUtils.transformPoint(
          matrix(child.getTransformTo(box)),
          point.localPosition.translate(0, -point.lineHeight / 2),
        ),
        related = MatrixUtils.transformPoint(transform, local.add(delta));
      if (isEnd) this.dragEnd = related;
      else this.dragStart = related;
    }
  }
  protected override handleSelectAll(event: SelectAllSelectionEvent): SelectionResult {
    debugAssert(!this.selectionStartsInside);
    const result = super.handleSelectAll(event);
    debugAssert(
      (this.currentSelectionStartIndex === -1) === (this.currentSelectionEndIndex === -1),
    );
    if (this.currentSelectionStartIndex !== -1) this.updateDragLocations();
    return result;
  }
  protected override handleSelectWord(event: SelectWordSelectionEvent): SelectionResult {
    this.selectionStartsInside = this.globalPositionInside(event.globalPosition);
    const result = super.handleSelectWord(event);
    this.updateDragLocations();
    return result;
  }
  protected override handleGranularlyExtendSelection(
    event: GranularlyExtendSelectionEvent,
  ): SelectionResult {
    const result = super.handleGranularlyExtendSelection(event);
    this.updateDragLocations(!event.isEnd, event.isEnd);
    if (this.selectionStartsInside) this.jumpToEdge(event.isEnd);
    return result;
  }
  protected override handleDirectionallyExtendSelection(
    event: DirectionallyExtendSelectionEvent,
  ): SelectionResult {
    const result = super.handleDirectionallyExtendSelection(event);
    this.updateDragLocations(!event.isEnd, event.isEnd);
    if (this.selectionStartsInside) this.jumpToEdge(event.isEnd);
    return result;
  }
  private jumpToEdge(isEnd: boolean): void {
    const child =
        this.selectables[isEnd ? this.currentSelectionEndIndex : this.currentSelectionStartIndex]!,
      point = isEnd ? child.value.endSelectionPoint : child.value.startSelectionPoint,
      lineHeight = isEnd
        ? child.value.endSelectionPoint!.lineHeight
        : child.value.startSelectionPoint?.lineHeight;
    if (lineHeight === undefined || point === null) return;
    const box = this.scrollBox,
      offset = MatrixUtils.transformPoint(matrix(child.getTransformTo(box)), point.localPosition),
      rect = Rect.fromLTWH(0, 0, box.size.width, box.size.height),
      direction = this.state.axisDirection;
    if (direction === AxisDirection.up || direction === AxisDirection.down) {
      const bottom = offset.dy,
        top = offset.dy - lineHeight;
      if (bottom >= rect.bottom && top <= rect.top) return;
      if (bottom > rect.bottom) {
        this.position.jumpTo(
          this.position.pixels +
            (direction === AxisDirection.up ? rect.bottom - bottom : bottom - rect.bottom),
        );
        return;
      }
      if (top < rect.top)
        this.position.jumpTo(
          this.position.pixels + (direction === AxisDirection.up ? rect.top - top : top - rect.top),
        );
    } else {
      const edge = offset.dx;
      if (edge >= rect.right && edge <= rect.left) return;
      if (edge > rect.right) {
        this.position.jumpTo(
          this.position.pixels +
            (direction === AxisDirection.left ? rect.right - edge : edge - rect.right),
        );
        return;
      }
      if (edge < rect.left)
        this.position.jumpTo(
          this.position.pixels +
            (direction === AxisDirection.left ? rect.left - edge : edge - rect.left),
        );
    }
  }
  private globalPositionInside(global: Offset): boolean {
    const box = this.scrollBox,
      point = box.globalToLocal(global);
    return Rect.fromLTWH(0, 0, box.size.width, box.size.height).contains(
      new Offset(point.x, point.y),
    );
  }
  protected override dispatchSelectionEventToChild(
    child: Selectable,
    event: SelectionEvent,
  ): SelectionResult {
    switch (event.type) {
      case SelectionEventType.startEdgeUpdate:
        this.startRecords.set(child, this.state.position.pixels);
        this.ensureChildUpdated(child);
        break;
      case SelectionEventType.endEdgeUpdate:
        this.endRecords.set(child, this.state.position.pixels);
        this.ensureChildUpdated(child);
        break;
      case SelectionEventType.granularlyExtendSelection:
      case SelectionEventType.directionallyExtendSelection:
        this.ensureChildUpdated(child);
        this.startRecords.set(child, this.state.position.pixels);
        this.endRecords.set(child, this.state.position.pixels);
        break;
      case SelectionEventType.clear:
        this.startRecords.delete(child);
        this.endRecords.delete(child);
        break;
      case SelectionEventType.selectAll:
      case SelectionEventType.selectWord:
      case SelectionEventType.selectParagraph:
        this.startRecords.set(child, this.state.position.pixels);
        this.endRecords.set(child, this.state.position.pixels);
        break;
    }
    return super.dispatchSelectionEventToChild(child, event);
  }
  protected override ensureChildUpdated(child: Selectable): void {
    const current = this.state.position.pixels,
      start = this.startRecords.get(child);
    if (this.dragStart !== null && (start === undefined || Math.abs(current - start) > 1e-10)) {
      const delta = this.state.deltaToScrollOrigin;
      child.dispatchSelectionEvent(
        SelectionEdgeUpdateEvent.forStart({
          globalPosition: this.dragStart.translate(-delta.dx, -delta.dy),
        }),
      );
      this.startRecords.set(child, this.state.position.pixels);
    }
    const end = this.endRecords.get(child);
    if (this.dragEnd !== null && (end === undefined || Math.abs(current - end) > 1e-10)) {
      const delta = this.state.deltaToScrollOrigin;
      child.dispatchSelectionEvent(
        SelectionEdgeUpdateEvent.forEnd({
          globalPosition: this.dragEnd.translate(-delta.dx, -delta.dy),
        }),
      );
      this.endRecords.set(child, this.state.position.pixels);
    }
  }
  override dispose(): void {
    if (this.retired) return;
    this.retired = true;
    this.generation++;
    this.startRecords.clear();
    this.endRecords.clear();
    this.layoutChangeScheduled = false;
    this.autoScroller.stopAutoScroll();
    const errors: unknown[] = [];
    for (const close of [
      () => this.currentPosition.removeListener(this.scheduleLayoutChange),
      () => super.dispose(),
    ])
      try {
        close();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Scrollable selection retirement failed');
  }
}
