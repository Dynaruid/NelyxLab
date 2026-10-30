// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed port of the pinned widgets/selectable_region.dart delegates.
import { SelectionContainerDelegate } from './selection-container.ts';
import type { BuildContext } from './framework.ts';
import { maybeTickerScheduler } from './ticker-scheduler.ts';
import { ChangeNotifier } from '../../foundation/notifier.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { MatrixUtils } from '../painting/matrix-utils.ts';
import { Offset } from '../../ui/offset.ts';
import { Rect } from '../../ui/rect.ts';
import type { LayerLink } from '../rendering/layer.ts';
import {
  SelectionGeometry,
  SelectionPoint,
  SelectionResult,
  SelectionStatus,
  SelectionEventType,
  ClearSelectionEvent,
  SelectAllSelectionEvent,
  SelectWordSelectionEvent,
  SelectParagraphSelectionEvent,
  SelectionEdgeUpdateEvent,
  GranularlyExtendSelectionEvent,
  DirectionallyExtendSelectionEvent,
  SelectionExtendDirection,
  SelectedContent,
  SelectedContentRange,
} from '../rendering/selection.ts';
import type { Selectable, SelectionEvent } from '../rendering/selection.ts';

function transformOf(selectable: Selectable): Matrix4 {
  const matrix = selectable.getTransformTo(null);
  return matrix instanceof Matrix4 ? matrix : Matrix4.fromList(matrix);
}
function debugAssert(condition: boolean, code: string): void {
  if (FoundationBuildMode.debug) invariant(condition, code, code);
}

/** Combines child selection geometry and dispatches events in screen order. */
export abstract class MultiSelectableSelectionContainerDelegate extends SelectionContainerDelegate {
  selectables: Selectable[] = [];
  protected currentSelectionEndIndex = -1;
  protected currentSelectionStartIndex = -1;
  private readonly notifier = new ChangeNotifier();
  private startHandleLayer: LayerLink | null = null;
  private startHandleLayerOwner: Selectable | null = null;
  private endHandleLayer: LayerLink | null = null;
  private endHandleLayerOwner: Selectable | null = null;
  private isHandlingSelectionEvent = false;
  private scheduledSelectableUpdate = false;
  private selectionInProgress = false;
  private additions = new Set<Selectable>();
  private extendSelectionInProgress = false;
  private selectionGeometry = new SelectionGeometry({
    hasContent: false,
    status: SelectionStatus.none,
  });
  private taskGeneration = 0;
  private closed = false;
  private readonly handleSelectableGeometryChange = () => {
    if (!this.isHandlingSelectionEvent) this.updateSelectionGeometry();
  };

  override addListener(listener: () => void): void {
    this.notifier.addListener(listener);
  }
  override removeListener(listener: () => void): void {
    this.notifier.removeListener(listener);
  }
  get hasListeners(): boolean {
    return this.notifier.hasListeners;
  }
  notifyListeners(): void {
    this.notifier.notifyListeners();
  }
  override get value(): SelectionGeometry {
    return this.selectionGeometry;
  }

  override _setSelectionContainerContext(context: BuildContext | null): void {
    super._setSelectionContainerContext(context);
    // Callbacks from an old View may not update a delegate adopted by a new View.
    this.taskGeneration++;
    if (context !== null && this.scheduledSelectableUpdate) this.enqueueSelectableUpdate();
  }
  /** Host boundary for SchedulerBinding. An unattached delegate waits for its container. */
  protected scheduleSelectionUpdate(callback: () => void): void {
    const context = this.selectionContainerContext;
    if (context === null) return;
    const scheduler = maybeTickerScheduler(context);
    if (scheduler === null) return;
    if (scheduler.phase === 'post-frame')
      void Promise.resolve()
        .then(callback)
        .catch((error) => {
          if (context.services.reportError) context.services.reportError(error);
          else throw error;
        });
    else
      scheduler.addPostFrameCallback(callback, {
        debugLabel: 'SelectionContainer.runScheduledTask',
      });
  }
  private enqueueSelectableUpdate(): void {
    const generation = this.taskGeneration;
    this.scheduleSelectionUpdate(() => {
      if (this.closed || generation !== this.taskGeneration || !this.scheduledSelectableUpdate)
        return;
      this.scheduledSelectableUpdate = false;
      if (this.additions.size) this.flushAdditions();
      this.didChangeSelectables();
    });
  }
  private scheduleSelectableUpdate(): void {
    invariant(!this.closed, 'disposed-selection-delegate', 'Selection delegate used after dispose');
    if (this.scheduledSelectableUpdate) return;
    this.scheduledSelectableUpdate = true;
    this.enqueueSelectableUpdate();
  }
  override add(selectable: Selectable): void {
    invariant(!this.closed, 'disposed-selection-delegate', 'Selection delegate used after dispose');
    debugAssert(!this.selectables.includes(selectable), 'duplicate-selectable');
    this.additions.add(selectable);
    this.scheduleSelectableUpdate();
  }
  override remove(selectable: Selectable): void {
    if (this.additions.delete(selectable)) return;
    debugAssert(this.selectables.includes(selectable), 'unknown-selectable');
    const index = this.selectables.indexOf(selectable);
    invariant(index >= 0, 'unknown-selectable', 'The selectable is not in this registrar');
    this.selectables.splice(index, 1);
    if (index <= this.currentSelectionEndIndex) this.currentSelectionEndIndex--;
    if (index <= this.currentSelectionStartIndex) this.currentSelectionStartIndex--;
    // State drops its Widget at retirement. Release cached handle owners while
    // the removed child is still alive, before its deferred geometry update.
    const owned =
      this.startHandleLayerOwner === selectable || this.endHandleLayerOwner === selectable;
    if (this.startHandleLayerOwner === selectable) this.startHandleLayerOwner = null;
    if (this.endHandleLayerOwner === selectable) this.endHandleLayerOwner = null;
    const errors: unknown[] = [];
    if (owned)
      try {
        selectable.pushHandleLayers(null, null);
      } catch (error) {
        errors.push(error);
      }
    try {
      selectable.removeListener(this.handleSelectableGeometryChange);
    } catch (error) {
      errors.push(error);
    }
    try {
      this.scheduleSelectableUpdate();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Removed selectable retirement failed');
  }
  layoutDidChange(): void {
    this.updateSelectionGeometry();
  }
  private flushAdditions(): void {
    const merging = [...this.additions].sort(this.compareOrder),
      existing = this.selectables;
    this.selectables = [];
    let mergingIndex = 0,
      existingIndex = 0,
      start = this.currentSelectionStartIndex,
      end = this.currentSelectionEndIndex;
    while (mergingIndex < merging.length || existingIndex < existing.length) {
      if (
        mergingIndex >= merging.length ||
        (existingIndex < existing.length &&
          this.compareOrder(existing[existingIndex]!, merging[mergingIndex]!) < 0)
      ) {
        if (existingIndex === this.currentSelectionStartIndex) start = this.selectables.length;
        if (existingIndex === this.currentSelectionEndIndex) end = this.selectables.length;
        this.selectables.push(existing[existingIndex++]!);
        continue;
      }
      const child = merging[mergingIndex++]!;
      if (
        existingIndex < Math.max(this.currentSelectionStartIndex, this.currentSelectionEndIndex) &&
        existingIndex > Math.min(this.currentSelectionStartIndex, this.currentSelectionEndIndex)
      )
        this.ensureChildUpdated(child);
      child.addListener(this.handleSelectableGeometryChange);
      this.selectables.push(child);
    }
    this.currentSelectionStartIndex = start;
    this.currentSelectionEndIndex = end;
    this.additions = new Set();
  }
  protected didChangeSelectables(): void {
    this.updateSelectionGeometry();
  }
  private updateSelectionGeometry(): void {
    const value = this.getSelectionGeometry();
    if (!this.selectionGeometry.equals(value)) {
      this.selectionGeometry = value;
      this.notifyListeners();
    }
    this.updateHandleLayersAndOwners();
  }
  private static boundingBox(selectable: Selectable): Rect {
    const boxes = selectable.boundingBoxes;
    invariant(
      boxes.length > 0,
      'empty-selectable-bounds',
      'A registered selectable needs a bounding box',
    );
    return boxes.slice(1).reduce((result, rect) => result.expandToInclude(rect), boxes[0]!);
  }
  protected get compareOrder(): (a: Selectable, b: Selectable) => number {
    return MultiSelectableSelectionContainerDelegate.compareScreenOrder;
  }
  private static compareScreenOrder(a: Selectable, b: Selectable): number {
    const type = MultiSelectableSelectionContainerDelegate,
      rectA = MatrixUtils.transformRect(transformOf(a), type.boundingBox(a)),
      rectB = MatrixUtils.transformRect(transformOf(b), type.boundingBox(b));
    const vertical = type.compareVertically(rectA, rectB);
    return vertical !== 0 ? vertical : type.compareHorizontally(rectA, rectB);
  }
  private static compareVertically(a: Rect, b: Rect): number {
    if (
      (a.top - b.top < 3 && a.bottom - b.bottom > -3) ||
      (b.top - a.top < 3 && b.bottom - a.bottom > -3)
    )
      return 0;
    if (Math.abs(a.top - b.top) > 3) return a.top > b.top ? 1 : -1;
    return a.bottom > b.bottom ? 1 : -1;
  }
  private static compareHorizontally(a: Rect, b: Rect): number {
    if (a.left - b.left < 1e-10 && a.right - b.right > -1e-10) return -1;
    if (b.left - a.left < 1e-10 && b.right - a.right > -1e-10) return 1;
    if (Math.abs(a.left - b.left) > 1e-10) return a.left > b.left ? 1 : -1;
    return a.right > b.right ? 1 : -1;
  }
  protected getSelectionGeometry(): SelectionGeometry {
    if (
      this.currentSelectionEndIndex === -1 ||
      this.currentSelectionStartIndex === -1 ||
      !this.selectables.length
    )
      return new SelectionGeometry({
        status: SelectionStatus.none,
        hasContent: !!this.selectables.length,
      });
    if (!this.extendSelectionInProgress) {
      this.currentSelectionStartIndex = this.adjustSelectionIndex(
        this.currentSelectionStartIndex,
        this.currentSelectionEndIndex,
      );
      this.currentSelectionEndIndex = this.adjustSelectionIndex(
        this.currentSelectionEndIndex,
        this.currentSelectionStartIndex,
      );
    }
    const forward = this.currentSelectionEndIndex >= this.currentSelectionStartIndex;
    let startIndex = this.currentSelectionStartIndex,
      endIndex = this.currentSelectionEndIndex;
    let startGeometry = this.selectables[startIndex]!.value,
      endGeometry = this.selectables[endIndex]!.value;
    while (
      startIndex !== this.currentSelectionEndIndex &&
      startGeometry.startSelectionPoint === null
    ) {
      startIndex += forward ? 1 : -1;
      startGeometry = this.selectables[startIndex]!.value;
    }
    while (endIndex !== this.currentSelectionStartIndex && endGeometry.endSelectionPoint === null) {
      endIndex += forward ? -1 : 1;
      endGeometry = this.selectables[endIndex]!.value;
    }
    const point = (geometry: SelectionPoint | null, index: number): SelectionPoint | null => {
      if (geometry === null) return null;
      const position = MatrixUtils.transformPoint(
        this.getTransformFrom(this.selectables[index]!),
        geometry.localPosition,
      );
      return position.isFinite
        ? new SelectionPoint({
            localPosition: position,
            lineHeight: geometry.lineHeight,
            handleType: geometry.handleType,
          })
        : null;
    };
    const selectionRects: Rect[] = [],
      drawableArea = this.hasSize
        ? Rect.fromLTWH(0, 0, this.containerSize.width, this.containerSize.height)
        : null;
    // The pinned implementation walks start..end, including its reversed-index behavior.
    for (
      let index = this.currentSelectionStartIndex;
      index <= this.currentSelectionEndIndex;
      index++
    )
      for (const rect of this.selectables[index]!.value.selectionRects) {
        const local = MatrixUtils.transformRect(
            this.getTransformFrom(this.selectables[index]!),
            rect,
          ),
          visible = drawableArea?.intersect(local) ?? local;
        if (visible.isFinite && !visible.isEmpty) selectionRects.push(visible);
      }
    return new SelectionGeometry({
      startSelectionPoint: point(startGeometry.startSelectionPoint, startIndex),
      endSelectionPoint: point(endGeometry.endSelectionPoint, endIndex),
      selectionRects,
      status: !startGeometry.equals(endGeometry)
        ? SelectionStatus.uncollapsed
        : startGeometry.status,
      hasContent: true,
    });
  }
  private adjustSelectionIndex(current: number, toward: number): number {
    const forward = toward > current;
    while (
      current !== toward &&
      this.selectables[current]!.value.status !== SelectionStatus.uncollapsed
    )
      current += forward ? 1 : -1;
    return current;
  }
  override pushHandleLayers(startHandle: LayerLink | null, endHandle: LayerLink | null): void {
    if (this.startHandleLayer === startHandle && this.endHandleLayer === endHandle) return;
    this.startHandleLayer = startHandle;
    this.endHandleLayer = endHandle;
    this.updateHandleLayersAndOwners();
  }
  private updateHandleLayersAndOwners(): void {
    let start = this.startHandleLayer,
      end = this.endHandleLayer;
    if (start !== null || end !== null) {
      const area = this.hasSize
        ? Rect.fromLTWH(0, 0, this.containerSize.width, this.containerSize.height).inflate(5)
        : null;
      if (
        this.value.startSelectionPoint === null ||
        area === null ||
        !area.contains(this.value.startSelectionPoint.localPosition)
      )
        start = null;
      if (
        this.value.endSelectionPoint === null ||
        area === null ||
        !area.contains(this.value.endSelectionPoint.localPosition)
      )
        end = null;
    }
    if (this.currentSelectionStartIndex === -1 || this.currentSelectionEndIndex === -1) {
      this.startHandleLayerOwner?.pushHandleLayers(null, null);
      this.startHandleLayerOwner = null;
      this.endHandleLayerOwner?.pushHandleLayers(null, null);
      this.endHandleLayerOwner = null;
      return;
    }
    if (this.selectables[this.currentSelectionStartIndex] !== this.startHandleLayerOwner)
      this.startHandleLayerOwner?.pushHandleLayers(null, null);
    if (this.selectables[this.currentSelectionEndIndex] !== this.endHandleLayerOwner)
      this.endHandleLayerOwner?.pushHandleLayers(null, null);
    this.startHandleLayerOwner = this.selectables[this.currentSelectionStartIndex]!;
    if (this.currentSelectionStartIndex === this.currentSelectionEndIndex) {
      this.endHandleLayerOwner = this.startHandleLayerOwner;
      this.startHandleLayerOwner.pushHandleLayers(start, end);
      return;
    }
    this.startHandleLayerOwner.pushHandleLayers(start, null);
    this.endHandleLayerOwner = this.selectables[this.currentSelectionEndIndex]!;
    this.endHandleLayerOwner.pushHandleLayers(null, end);
  }
  override getSelectedContent(): SelectedContent | null {
    const selections = this.selectables
      .map((child) => child.getSelectedContent())
      .filter((data): data is SelectedContent => data !== null);
    return selections.length
      ? new SelectedContent({ plainText: selections.map((data) => data.plainText).join('') })
      : null;
  }
  override get contentLength(): number {
    return this.selectables.reduce((sum, child) => sum + child.contentLength, 0);
  }
  override getSelection(): SelectedContentRange | null {
    if (this.currentSelectionStartIndex === -1 || this.currentSelectionEndIndex === -1) return null;
    let start = 0,
      end = 0,
      found = false,
      forward = this.currentSelectionEndIndex >= this.currentSelectionStartIndex;
    if (this.currentSelectionEndIndex === this.currentSelectionStartIndex) {
      const range = this.selectables[this.currentSelectionStartIndex]!.getSelection();
      invariant(
        range !== null,
        'missing-child-selection',
        'A selected child must provide its content range',
      );
      forward = range.endOffset >= range.startOffset;
    }
    for (const child of this.selectables) {
      const range = child.getSelection();
      if (range === null) {
        if (found)
          return new SelectedContentRange({
            startOffset: forward ? start : end,
            endOffset: forward ? end : start,
          });
        start += child.contentLength;
        end = start;
        continue;
      }
      const low = Math.min(range.startOffset, range.endOffset),
        high = Math.max(range.startOffset, range.endOffset);
      if (!found) {
        start += low;
        end = start + Math.abs(high - low);
        found = true;
      } else end += Math.abs(high - low);
    }
    debugAssert(found, 'missing-selection-start');
    return new SelectedContentRange({
      startOffset: forward ? start : end,
      endOffset: forward ? end : start,
    });
  }
  private clearSelectables(skipIndex?: number): void {
    for (let index = 0; index < this.selectables.length; index++)
      if (index !== skipIndex)
        this.dispatchSelectionEventToChild(this.selectables[index]!, new ClearSelectionEvent());
  }
  private flushInactiveSelections(): void {
    const start = this.currentSelectionStartIndex,
      end = this.currentSelectionEndIndex;
    if (start === -1 && end === -1) return;
    if (start === -1 || end === -1) {
      this.clearSelectables(start === -1 ? end : start);
      return;
    }
    for (let index = 0; index < this.selectables.length; index++)
      if (index < Math.min(start, end) || index > Math.max(start, end))
        this.dispatchSelectionEventToChild(this.selectables[index]!, new ClearSelectionEvent());
  }
  protected handleSelectAll(event: SelectAllSelectionEvent): SelectionResult {
    for (const child of this.selectables) this.dispatchSelectionEventToChild(child, event);
    this.currentSelectionStartIndex = 0;
    this.currentSelectionEndIndex = this.selectables.length - 1;
    return SelectionResult.none;
  }
  private handleSelectBoundary(
    event: SelectWordSelectionEvent | SelectParagraphSelectionEvent,
  ): SelectionResult {
    const position = event.globalPosition;
    let last: SelectionResult | null = null,
      distance = Infinity,
      nearestIndex = 0;
    for (let index = 0; index < this.selectables.length; index++) {
      const child = this.selectables[index]!,
        matrix = transformOf(child);
      let contains = false;
      for (const rect of child.boundingBoxes) {
        const global = MatrixUtils.transformRect(matrix, rect);
        if (global.contains(position)) {
          contains = true;
          break;
        }
        const dx = position.dx - Math.max(global.left, Math.min(position.dx, global.right)),
          dy = position.dy - Math.max(global.top, Math.min(position.dy, global.bottom)),
          squared = dx * dx + dy * dy;
        if (squared < distance) {
          distance = squared;
          nearestIndex = index;
        }
      }
      if (contains) {
        const existing = child.value;
        last = this.dispatchSelectionEventToChild(child, event);
        if (index === this.selectables.length - 1 && last === SelectionResult.next)
          return SelectionResult.next;
        if (last === SelectionResult.next) continue;
        if (index === 0 && last === SelectionResult.previous) return SelectionResult.previous;
        if (!child.value.equals(existing)) {
          this.clearSelectables(index);
          this.currentSelectionStartIndex = this.currentSelectionEndIndex = index;
        }
        return SelectionResult.end;
      }
      if (last === SelectionResult.next) {
        this.currentSelectionStartIndex = this.currentSelectionEndIndex = index - 1;
        return SelectionResult.end;
      }
    }
    debugAssert(last === null, 'unresolved-selection-boundary');
    if (this.selectables.length) {
      const child = this.selectables[nearestIndex]!,
        existing = child.value;
      this.dispatchSelectionEventToChild(child, event);
      if (!child.value.equals(existing)) {
        this.clearSelectables(nearestIndex);
        this.currentSelectionStartIndex = this.currentSelectionEndIndex = nearestIndex;
      }
    }
    return SelectionResult.end;
  }
  protected handleSelectWord(event: SelectWordSelectionEvent): SelectionResult {
    return this.handleSelectBoundary(event);
  }
  protected handleSelectParagraph(event: SelectParagraphSelectionEvent): SelectionResult {
    return this.handleSelectBoundary(event);
  }
  protected handleClearSelection(event: ClearSelectionEvent): SelectionResult {
    for (const child of this.selectables) this.dispatchSelectionEventToChild(child, event);
    this.currentSelectionStartIndex = this.currentSelectionEndIndex = -1;
    return SelectionResult.none;
  }
  protected handleGranularlyExtendSelection(
    event: GranularlyExtendSelectionEvent,
  ): SelectionResult {
    debugAssert(
      (this.currentSelectionStartIndex === -1) === (this.currentSelectionEndIndex === -1),
      'incomplete-selection-edges',
    );
    if (this.currentSelectionStartIndex === -1)
      this.currentSelectionStartIndex = this.currentSelectionEndIndex = event.forward
        ? 0
        : this.selectables.length - 1;
    let index = event.isEnd ? this.currentSelectionEndIndex : this.currentSelectionStartIndex;
    let result = this.dispatchSelectionEventToChild(this.selectables[index]!, event);
    if (event.forward) {
      debugAssert(result !== SelectionResult.previous, 'invalid-granular-result');
      while (index < this.selectables.length - 1 && result === SelectionResult.next) {
        result = this.dispatchSelectionEventToChild(this.selectables[++index]!, event);
        debugAssert(result !== SelectionResult.previous, 'invalid-granular-result');
      }
    } else {
      debugAssert(result !== SelectionResult.next, 'invalid-granular-result');
      while (index > 0 && result === SelectionResult.previous) {
        result = this.dispatchSelectionEventToChild(this.selectables[--index]!, event);
        debugAssert(result !== SelectionResult.next, 'invalid-granular-result');
      }
    }
    if (event.isEnd) this.currentSelectionEndIndex = index;
    else this.currentSelectionStartIndex = index;
    return result;
  }
  protected handleDirectionallyExtendSelection(
    event: DirectionallyExtendSelectionEvent,
  ): SelectionResult {
    debugAssert(
      (this.currentSelectionStartIndex === -1) === (this.currentSelectionEndIndex === -1),
      'incomplete-selection-edges',
    );
    if (this.currentSelectionStartIndex === -1)
      this.currentSelectionStartIndex = this.currentSelectionEndIndex =
        event.direction === SelectionExtendDirection.previousLine ||
        event.direction === SelectionExtendDirection.backward
          ? this.selectables.length - 1
          : 0;
    let index = event.isEnd ? this.currentSelectionEndIndex : this.currentSelectionStartIndex,
      result = this.dispatchSelectionEventToChild(this.selectables[index]!, event);
    if (event.direction === SelectionExtendDirection.previousLine) {
      debugAssert(
        result === SelectionResult.end || result === SelectionResult.previous,
        'invalid-directional-result',
      );
      if (result === SelectionResult.previous && index > 0) {
        result = this.dispatchSelectionEventToChild(
          this.selectables[--index]!,
          event.copyWith({ direction: SelectionExtendDirection.backward }),
        );
        debugAssert(result === SelectionResult.end, 'invalid-directional-result');
      }
    } else if (event.direction === SelectionExtendDirection.nextLine) {
      debugAssert(
        result === SelectionResult.end || result === SelectionResult.next,
        'invalid-directional-result',
      );
      if (result === SelectionResult.next && index < this.selectables.length - 1) {
        result = this.dispatchSelectionEventToChild(
          this.selectables[++index]!,
          event.copyWith({ direction: SelectionExtendDirection.forward }),
        );
        debugAssert(result === SelectionResult.end, 'invalid-directional-result');
      }
    } else debugAssert(result === SelectionResult.end, 'invalid-directional-result');
    if (event.isEnd) this.currentSelectionEndIndex = index;
    else this.currentSelectionStartIndex = index;
    return result;
  }
  protected handleSelectionEdgeUpdate(event: SelectionEdgeUpdateEvent): SelectionResult {
    const isEnd = event.type === SelectionEventType.endEdgeUpdate;
    return (isEnd ? this.currentSelectionEndIndex : this.currentSelectionStartIndex) === -1
      ? this.initSelection(event, isEnd)
      : this.adjustSelection(event, isEnd);
  }
  override dispatchSelectionEvent(event: SelectionEvent): SelectionResult {
    invariant(!this.closed, 'disposed-selection-delegate', 'Selection delegate used after dispose');
    const inProgress = !(event instanceof ClearSelectionEvent);
    if (!this.selectionInProgress && inProgress) this.selectables.sort(this.compareOrder);
    this.selectionInProgress = inProgress;
    this.isHandlingSelectionEvent = true;
    let result: SelectionResult;
    try {
      this.extendSelectionInProgress =
        event.type === SelectionEventType.granularlyExtendSelection ||
        event.type === SelectionEventType.directionallyExtendSelection;
      switch (event.type) {
        case SelectionEventType.startEdgeUpdate:
        case SelectionEventType.endEdgeUpdate:
          result = this.handleSelectionEdgeUpdate(event as SelectionEdgeUpdateEvent);
          break;
        case SelectionEventType.clear:
          result = this.handleClearSelection(event as ClearSelectionEvent);
          break;
        case SelectionEventType.selectAll:
          result = this.handleSelectAll(event as SelectAllSelectionEvent);
          break;
        case SelectionEventType.selectWord:
          result = this.handleSelectWord(event as SelectWordSelectionEvent);
          break;
        case SelectionEventType.selectParagraph:
          result = this.handleSelectParagraph(event as SelectParagraphSelectionEvent);
          break;
        case SelectionEventType.granularlyExtendSelection:
          result = this.handleGranularlyExtendSelection(event as GranularlyExtendSelectionEvent);
          break;
        case SelectionEventType.directionallyExtendSelection:
          result = this.handleDirectionallyExtendSelection(
            event as DirectionallyExtendSelectionEvent,
          );
          break;
        default:
          throw new Error('Unsupported selection event');
      }
    } finally {
      this.isHandlingSelectionEvent = false;
    }
    this.updateSelectionGeometry();
    return result;
  }
  protected abstract ensureChildUpdated(selectable: Selectable): void;
  protected dispatchSelectionEventToChild(
    selectable: Selectable,
    event: SelectionEvent,
  ): SelectionResult {
    return selectable.dispatchSelectionEvent(event);
  }
  private initSelection(event: SelectionEdgeUpdateEvent, isEnd: boolean): SelectionResult {
    let newIndex = -1,
      found = false,
      result: SelectionResult | null = null,
      forward: boolean | null = null,
      index = Math.max(isEnd ? this.currentSelectionStartIndex : this.currentSelectionEndIndex, 0);
    while (index >= 0 && index < this.selectables.length) {
      const childResult = this.dispatchSelectionEventToChild(this.selectables[index]!, event);
      switch (childResult) {
        case SelectionResult.next:
          if (forward === false) {
            found = true;
            result = SelectionResult.end;
          } else {
            forward = true;
            newIndex = index;
          }
          break;
        case SelectionResult.none:
          newIndex = index;
          break;
        case SelectionResult.end:
          newIndex = index;
          result = SelectionResult.end;
          found = true;
          break;
        case SelectionResult.previous:
          if (index === 0) {
            found = true;
            newIndex = 0;
            result = SelectionResult.previous;
            break;
          }
          if (forward ?? false) {
            found = true;
            result = SelectionResult.end;
          } else {
            forward = false;
            newIndex = index;
          }
          break;
        case SelectionResult.pending:
          newIndex = index;
          result = SelectionResult.pending;
          found = true;
          break;
      }
      if (found) break;
      index += (forward ?? true) ? 1 : -1;
    }
    if (newIndex === -1) {
      debugAssert(!this.selectables.length, 'uninitialized-selection-index');
      return SelectionResult.none;
    }
    if (isEnd) this.currentSelectionEndIndex = newIndex;
    else this.currentSelectionStartIndex = newIndex;
    this.flushInactiveSelections();
    return result ?? SelectionResult.next;
  }
  private adjustSelection(event: SelectionEdgeUpdateEvent, isEnd: boolean): SelectionResult {
    let result: SelectionResult | null = null,
      forward: boolean | null = null;
    const currentVisible =
        (isEnd
          ? this.selectionGeometry.endSelectionPoint
          : this.selectionGeometry.startSelectionPoint) !== null,
      oppositeVisible =
        (isEnd
          ? this.selectionGeometry.startSelectionPoint
          : this.selectionGeometry.endSelectionPoint) !== null;
    let index = currentVisible
      ? isEnd
        ? this.currentSelectionEndIndex
        : this.currentSelectionStartIndex
      : oppositeVisible
        ? isEnd
          ? this.currentSelectionStartIndex
          : this.currentSelectionEndIndex
        : 0;
    while (index < this.selectables.length && index >= 0 && result === null) {
      const childResult = this.dispatchSelectionEventToChild(this.selectables[index]!, event);
      switch (childResult) {
        case SelectionResult.end:
        case SelectionResult.pending:
        case SelectionResult.none:
          result = childResult;
          break;
        case SelectionResult.next:
          if (forward === false) {
            index++;
            result = SelectionResult.end;
          } else if (index === this.selectables.length - 1) result = childResult;
          else {
            forward = true;
            index++;
          }
          break;
        case SelectionResult.previous:
          if (forward ?? false) {
            index--;
            result = SelectionResult.end;
          } else if (index === 0) result = childResult;
          else {
            forward = false;
            index--;
          }
          break;
      }
    }
    if (isEnd) this.currentSelectionEndIndex = index;
    else this.currentSelectionStartIndex = index;
    this.flushInactiveSelections();
    invariant(
      result !== null,
      'unresolved-selection-edge',
      'Selection search must resolve an edge',
    );
    return result;
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.taskGeneration++;
    this.scheduledSelectableUpdate = false;
    const errors: unknown[] = [];
    for (const child of this.selectables)
      try {
        child.removeListener(this.handleSelectableGeometryChange);
      } catch (error) {
        errors.push(error);
      }
    this.selectables = [];
    this.additions.clear();
    this.startHandleLayerOwner = this.endHandleLayerOwner = null;
    this.startHandleLayer = this.endHandleLayer = null;
    try {
      this.notifier.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Selection delegate release failed');
  }
}

/** Replays the opposite edge for children newly incorporated into a selection. */
export class StaticSelectionContainerDelegate extends MultiSelectableSelectionContainerDelegate {
  private readonly hasReceivedStartEvent = new Set<Selectable>();
  private readonly hasReceivedEndEvent = new Set<Selectable>();
  private lastStartEdgeUpdateGlobalPosition: Offset | null = null;
  private lastEndEdgeUpdateGlobalPosition: Offset | null = null;
  protected didReceiveSelectionEventFor({
    selectable,
    forEnd = null,
  }: {
    readonly selectable: Selectable;
    readonly forEnd?: boolean | null;
  }): void {
    if (forEnd !== false) this.hasReceivedEndEvent.add(selectable);
    if (forEnd !== true) this.hasReceivedStartEvent.add(selectable);
  }
  protected didReceiveSelectionBoundaryEvents(): void {
    if (this.currentSelectionStartIndex === -1 || this.currentSelectionEndIndex === -1) return;
    for (
      let index = Math.min(this.currentSelectionStartIndex, this.currentSelectionEndIndex);
      index <= Math.max(this.currentSelectionStartIndex, this.currentSelectionEndIndex);
      index++
    )
      this.didReceiveSelectionEventFor({ selectable: this.selectables[index]! });
    const update = (index: number, forEnd: boolean): void => {
      if (index === -1) return;
      const child = this.selectables[index]!;
      if (!child.value.hasSelection) return;
      const point = forEnd ? child.value.endSelectionPoint : child.value.startSelectionPoint;
      invariant(
        point !== null,
        'missing-selection-point',
        'A selected child must have its boundary point',
      );
      this.updateLastSelectionEdgeLocation({
        globalSelectionEdgeLocation: MatrixUtils.transformPoint(
          transformOf(child),
          point.localPosition.translate(0, -point.lineHeight / 2),
        ),
        forEnd,
      });
    };
    update(this.currentSelectionStartIndex, false);
    update(this.currentSelectionEndIndex, true);
  }
  protected updateLastSelectionEdgeLocation({
    globalSelectionEdgeLocation,
    forEnd,
  }: {
    readonly globalSelectionEdgeLocation: Offset;
    readonly forEnd: boolean;
  }): void {
    if (forEnd) this.lastEndEdgeUpdateGlobalPosition = globalSelectionEdgeLocation;
    else this.lastStartEdgeUpdateGlobalPosition = globalSelectionEdgeLocation;
  }
  protected clearInternalSelectionState(): void {
    for (const child of this.selectables) this.clearInternalSelectionStateForSelectable(child);
    this.lastStartEdgeUpdateGlobalPosition = this.lastEndEdgeUpdateGlobalPosition = null;
  }
  protected clearInternalSelectionStateForSelectable(selectable: Selectable): void {
    this.hasReceivedStartEvent.delete(selectable);
    this.hasReceivedEndEvent.delete(selectable);
  }
  override remove(selectable: Selectable): void {
    this.clearInternalSelectionStateForSelectable(selectable);
    super.remove(selectable);
  }
  protected override handleSelectAll(event: SelectAllSelectionEvent): SelectionResult {
    const result = super.handleSelectAll(event);
    this.didReceiveSelectionBoundaryEvents();
    return result;
  }
  protected override handleSelectWord(event: SelectWordSelectionEvent): SelectionResult {
    const result = super.handleSelectWord(event);
    this.didReceiveSelectionBoundaryEvents();
    return result;
  }
  protected override handleSelectParagraph(event: SelectParagraphSelectionEvent): SelectionResult {
    const result = super.handleSelectParagraph(event);
    this.didReceiveSelectionBoundaryEvents();
    return result;
  }
  protected override handleClearSelection(event: ClearSelectionEvent): SelectionResult {
    const result = super.handleClearSelection(event);
    this.clearInternalSelectionState();
    return result;
  }
  protected override handleSelectionEdgeUpdate(event: SelectionEdgeUpdateEvent): SelectionResult {
    this.updateLastSelectionEdgeLocation({
      globalSelectionEdgeLocation: event.globalPosition,
      forEnd: event.type === SelectionEventType.endEdgeUpdate,
    });
    return super.handleSelectionEdgeUpdate(event);
  }
  protected override dispatchSelectionEventToChild(
    selectable: Selectable,
    event: SelectionEvent,
  ): SelectionResult {
    switch (event.type) {
      case SelectionEventType.startEdgeUpdate:
        this.didReceiveSelectionEventFor({ selectable, forEnd: false });
        this.ensureChildUpdated(selectable);
        break;
      case SelectionEventType.endEdgeUpdate:
        this.didReceiveSelectionEventFor({ selectable, forEnd: true });
        this.ensureChildUpdated(selectable);
        break;
      case SelectionEventType.clear:
        this.clearInternalSelectionStateForSelectable(selectable);
        break;
      case SelectionEventType.granularlyExtendSelection:
      case SelectionEventType.directionallyExtendSelection:
        this.didReceiveSelectionEventFor({ selectable });
        this.ensureChildUpdated(selectable);
        break;
    }
    return super.dispatchSelectionEventToChild(selectable, event);
  }
  protected override ensureChildUpdated(selectable: Selectable): void {
    if (
      this.lastEndEdgeUpdateGlobalPosition !== null &&
      !this.hasReceivedEndEvent.has(selectable)
    ) {
      this.hasReceivedEndEvent.add(selectable);
      const event = SelectionEdgeUpdateEvent.forEnd({
        globalPosition: this.lastEndEdgeUpdateGlobalPosition,
      });
      if (this.currentSelectionEndIndex === -1) this.handleSelectionEdgeUpdate(event);
      selectable.dispatchSelectionEvent(event);
    }
    if (
      this.lastStartEdgeUpdateGlobalPosition !== null &&
      !this.hasReceivedStartEvent.has(selectable)
    ) {
      this.hasReceivedStartEvent.add(selectable);
      const event = SelectionEdgeUpdateEvent.forStart({
        globalPosition: this.lastStartEdgeUpdateGlobalPosition,
      });
      if (this.currentSelectionStartIndex === -1) this.handleSelectionEdgeUpdate(event);
      selectable.dispatchSelectionEvent(event);
    }
  }
  protected override didChangeSelectables(): void {
    if (this.lastEndEdgeUpdateGlobalPosition !== null)
      this.handleSelectionEdgeUpdate(
        SelectionEdgeUpdateEvent.forEnd({ globalPosition: this.lastEndEdgeUpdateGlobalPosition }),
      );
    if (this.lastStartEdgeUpdateGlobalPosition !== null)
      this.handleSelectionEdgeUpdate(
        SelectionEdgeUpdateEvent.forStart({
          globalPosition: this.lastStartEdgeUpdateGlobalPosition,
        }),
      );
    for (const child of this.hasReceivedStartEvent)
      if (!this.selectables.includes(child)) this.hasReceivedStartEvent.delete(child);
    for (const child of this.hasReceivedEndEvent)
      if (!this.selectables.includes(child)) this.hasReceivedEndEvent.delete(child);
    super.didChangeSelectables();
  }
  override dispose(): void {
    this.clearInternalSelectionState();
    this.hasReceivedStartEvent.clear();
    this.hasReceivedEndEvent.clear();
    super.dispose();
  }
}
