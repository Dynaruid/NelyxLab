// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed _SelectableFragment from rendering/paragraph.dart at the upstream pin.
import { ChangeNotifier } from '../../foundation/notifier.ts';
import { Diagnosticable } from '../../foundation/diagnosticable.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { Offset } from '../../ui/offset.ts';
import { Rect } from '../../ui/rect.ts';
import { Paint } from '../../ui/paint.ts';
import { TextPosition, TextAffinity } from '../../ui/text-position.ts';
import { TextRange } from '../../ui/text-range.ts';
import { TextSelection } from '../../services/text-editing.ts';
import type { TextLayoutMetrics } from '../../services/text-layout-metrics.ts';
import {
  CharacterBoundary,
  ParagraphBoundary,
  DocumentBoundary,
  LineBoundary,
} from '../../services/text-boundary.ts';
import type { TextBoundary } from '../../services/text-boundary.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { MatrixUtils } from '../painting/matrix-utils.ts';
import type { PaintingContext } from '../painting/context.ts';
import type { RenderParagraph } from './boxes.ts';
import type { RenderObject } from './object.ts';
import { LeaderLayer } from './layer.ts';
import type { LayerLink } from './layer.ts';
import {
  SelectionHandler,
  SelectionGeometry,
  SelectionStatus,
  SelectionPoint,
  TextSelectionHandleType,
  SelectedContent,
  SelectedContentRange,
  SelectionResult,
  SelectionEventType,
  TextGranularity,
  SelectionExtendDirection,
  SelectionUtils,
} from './selection.ts';
import type {
  Selectable,
  SelectionEvent,
  SelectionEdgeUpdateEvent,
  SelectWordSelectionEvent,
  SelectParagraphSelectionEvent,
  GranularlyExtendSelectionEvent,
  DirectionallyExtendSelectionEvent,
} from './selection.ts';

type BoundaryRecord = { readonly boundaryStart: TextPosition; readonly boundaryEnd: TextPosition };
type BoundaryAt = (position: TextPosition) => BoundaryRecord;
type BoundaryInText = (position: TextPosition, text: string) => BoundaryRecord;
const same = (a: TextPosition | null, b: TextPosition | null): boolean =>
  a === b || (a !== null && b !== null && a.equals(b));
const pos = (offset: number, affinity: TextAffinity = TextAffinity.downstream): TextPosition =>
  new TextPosition({ offset, affinity });
const debugAssert = (condition: boolean, message = 'Invalid paragraph fragment state'): void => {
  if (FoundationBuildMode.debug) invariant(condition, 'invalid-selection-fragment', message);
};
const boxRect = (paragraph: RenderParagraph): Rect =>
  Rect.fromLTWH(0, 0, paragraph.size.width, paragraph.size.height);
const inverseTransform = (paragraph: RenderParagraph): Matrix4 => {
  const transform = Matrix4.fromList(paragraph.getTransformTo(null));
  transform.invert();
  return transform;
};

/** @internal A source fragment excludes U+FFFC; inline child text registers independently. */
export class SelectableParagraphFragment
  extends Diagnosticable(SelectionHandler)
  implements Selectable, TextLayoutMetrics
{
  readonly range: TextRange;
  readonly paragraph: RenderParagraph;
  readonly fullText: string;
  private start: TextPosition | null = null;
  private end: TextPosition | null = null;
  /** @internal Used by nested paragraph boundary traversal. */
  containsOriginTextBoundary = false;
  private startLink: LayerLink | null = null;
  private endLink: LayerLink | null = null;
  private geometry: SelectionGeometry;
  private readonly notifier = new ChangeNotifier();
  private cachedBoxes: readonly Rect[] | null = null;
  private cachedRect: Rect | null = null;
  private readonly paragraphType: typeof RenderParagraph;
  constructor({
    paragraph,
    paragraphType,
    fullText,
    range,
  }: {
    readonly paragraph: RenderParagraph;
    readonly paragraphType: typeof RenderParagraph;
    readonly fullText: string;
    readonly range: TextRange;
  }) {
    super();
    debugAssert(range.isValid && !range.isCollapsed && range.isNormalized);
    this.paragraph = paragraph;
    this.paragraphType = paragraphType;
    this.fullText = fullText;
    this.range = range;
    this.geometry = this.getGeometry();
  }
  override addListener(listener: () => void): void {
    this.notifier.addListener(listener);
  }
  override removeListener(listener: () => void): void {
    this.notifier.removeListener(listener);
  }
  override get value(): SelectionGeometry {
    return this.geometry;
  }
  /** @internal RenderParagraph.selections preserves the pinned offset-only values. */
  get selection(): TextSelection | null {
    return this.start === null || this.end === null
      ? null
      : new TextSelection({ baseOffset: this.start.offset, extentOffset: this.end.offset });
  }
  private getGeometry(): SelectionGeometry {
    if (this.start === null || this.end === null)
      return new SelectionGeometry({ status: SelectionStatus.none, hasContent: true });
    const collapsed = this.start.offset === this.end.offset,
      reversed = this.start.offset > this.end.offset,
      flip = reversed !== (this.paragraph.textDirection === 'rtl'),
      startOffset = this.paragraph.selectionOffsetForPosition(this.start),
      endOffset = collapsed ? startOffset : this.paragraph.selectionOffsetForPosition(this.end),
      lineHeight = this.paragraph.selectionPainter.preferredLineHeight;
    return new SelectionGeometry({
      startSelectionPoint: new SelectionPoint({
        localPosition: startOffset,
        lineHeight,
        handleType: collapsed
          ? TextSelectionHandleType.collapsed
          : flip
            ? TextSelectionHandleType.right
            : TextSelectionHandleType.left,
      }),
      endSelectionPoint: new SelectionPoint({
        localPosition: endOffset,
        lineHeight,
        handleType: collapsed
          ? TextSelectionHandleType.collapsed
          : flip
            ? TextSelectionHandleType.left
            : TextSelectionHandleType.right,
      }),
      selectionRects: this.paragraph
        .getBoxesForSelection(this.selection!)
        .map((box) => box.toRect()),
      status: collapsed ? SelectionStatus.collapsed : SelectionStatus.uncollapsed,
      hasContent: true,
    });
  }
  private didChangeSelection(): void {
    this.paragraph.markNeedsPaint();
    const next = this.getGeometry();
    if (!this.geometry.equals(next)) {
      this.geometry = next;
      this.notifier.notifyListeners();
    }
  }
  override dispatchSelectionEvent(event: SelectionEvent): SelectionResult {
    const oldStart = this.start,
      oldEnd = this.end;
    let result: SelectionResult;
    switch (event.type) {
      case SelectionEventType.startEdgeUpdate:
      case SelectionEventType.endEdgeUpdate: {
        const update = event as SelectionEdgeUpdateEvent,
          isEnd = update.type === SelectionEventType.endEdgeUpdate;
        switch (update.granularity) {
          case TextGranularity.character:
            result = this.updateEdge(update.globalPosition, isEnd);
            break;
          case TextGranularity.word:
            result = this.updateBoundaryEdge(update.globalPosition, isEnd, (p) =>
              this.wordBoundaryAt(p),
            );
            break;
          case TextGranularity.paragraph:
            result = this.updateMultiBoundaryEdge(
              update.globalPosition,
              isEnd,
              (p, text) => this.paragraphBoundaryAt(p, text),
              (p) => this.clampedParagraphBoundaryAt(p),
            );
            break;
          default:
            debugAssert(false, 'Moving the selection edge by line or document is not supported.');
            throw new Error('Uninitialized selection result');
        }
        break;
      }
      case SelectionEventType.clear:
        this.start = this.end = null;
        this.containsOriginTextBoundary = false;
        result = SelectionResult.none;
        break;
      case SelectionEventType.selectAll:
        result = this.selectAll();
        break;
      case SelectionEventType.selectWord: {
        const position = this.paragraph.getPositionForOffset(
          this.paragraph.globalToLocal((event as SelectWordSelectionEvent).globalPosition),
        );
        result =
          this.positionIsWithinSelection(position) && !same(this.start, this.end)
            ? SelectionResult.end
            : this.selectBoundary(this.wordBoundaryAt(position));
        break;
      }
      case SelectionEventType.selectParagraph: {
        const select = event as SelectParagraphSelectionEvent;
        if (select.absorb) {
          this.selectAll();
          this.containsOriginTextBoundary = true;
          result = SelectionResult.next;
        } else {
          const position = this.paragraph.getPositionForOffset(
            this.paragraph.globalToLocal(select.globalPosition),
          );
          result = this.selectMultiBoundary(this.paragraphBoundaryAt(position, this.fullText));
        }
        break;
      }
      case SelectionEventType.granularlyExtendSelection: {
        const extend = event as GranularlyExtendSelectionEvent;
        result = this.extendGranularly(extend.forward, extend.isEnd, extend.granularity);
        break;
      }
      case SelectionEventType.directionallyExtendSelection: {
        const extend = event as DirectionallyExtendSelectionEvent;
        result = this.extendDirectionally(extend.dx, extend.isEnd, extend.direction);
        break;
      }
      default:
        throw new Error('Unknown selection event');
    }
    if (!same(oldStart, this.start) || !same(oldEnd, this.end)) this.didChangeSelection();
    return result;
  }
  override getSelectedContent(): SelectedContent | null {
    return this.start === null || this.end === null
      ? null
      : new SelectedContent({
          plainText: new TextRange({
            start: Math.min(this.start.offset, this.end.offset),
            end: Math.max(this.start.offset, this.end.offset),
          }).textInside(this.fullText),
        });
  }
  override getSelection(): SelectedContentRange | null {
    return this.start === null || this.end === null
      ? null
      : new SelectedContentRange({ startOffset: this.start.offset, endOffset: this.end.offset });
  }
  private setPosition(position: TextPosition | null, isEnd: boolean): void {
    if (isEnd) this.end = position;
    else this.start = position;
  }
  private clamp(position: TextPosition): TextPosition {
    if (
      position.offset > this.range.end ||
      (position.offset === this.range.end && position.affinity === TextAffinity.downstream)
    )
      return pos(this.range.end, TextAffinity.upstream);
    return position.offset < this.range.start ? pos(this.range.start) : position;
  }
  private closest(boundary: BoundaryRecord, position: TextPosition): TextPosition {
    return Math.abs(position.offset - boundary.boundaryStart.offset) <
      Math.abs(position.offset - boundary.boundaryEnd.offset)
      ? boundary.boundaryStart
      : boundary.boundaryEnd;
  }
  private boundaryOutside(boundary: BoundaryRecord): boolean {
    return (
      (boundary.boundaryStart.offset < this.range.start &&
        boundary.boundaryEnd.offset <= this.range.start) ||
      (boundary.boundaryStart.offset >= this.range.end &&
        boundary.boundaryEnd.offset > this.range.end)
    );
  }
  private boundaryTarget(
    boundary: BoundaryRecord | null,
    getBoundary: BoundaryAt,
    position: TextPosition,
    oldStart: TextPosition | null,
    oldEnd: TextPosition | null,
    isEnd: boolean,
  ): TextPosition {
    const opposite = isEnd ? oldStart : oldEnd,
      current = isEnd ? oldEnd : oldStart;
    let target: TextPosition | null = null;
    const origin = this.containsOriginTextBoundary && oldStart !== null && oldEnd !== null;
    if (boundary !== null) {
      debugAssert(
        boundary.boundaryStart.offset >= this.range.start &&
          boundary.boundaryEnd.offset <= this.range.end,
      );
      if (origin) {
        const atSame = position.offset === opposite!.offset,
          inverted = oldStart!.offset > oldEnd!.offset,
          swap =
            !atSame &&
            inverted !==
              (isEnd ? position.offset < opposite!.offset : position.offset > opposite!.offset);
        if (swap) {
          target =
            position.offset < opposite!.offset ? boundary.boundaryStart : boundary.boundaryEnd;
          const local = getBoundary(opposite!);
          debugAssert(
            local.boundaryStart.offset >= this.range.start &&
              local.boundaryEnd.offset <= this.range.end,
          );
          this.setPosition(
            opposite!.offset === local.boundaryStart.offset
              ? local.boundaryEnd
              : local.boundaryStart,
            !isEnd,
          );
        } else
          target =
            position.offset < opposite!.offset
              ? boundary.boundaryStart
              : position.offset > opposite!.offset
                ? boundary.boundaryEnd
                : current;
      } else
        target =
          opposite !== null
            ? position.offset < opposite.offset
              ? boundary.boundaryStart
              : boundary.boundaryEnd
            : this.closest(boundary, position);
    } else if (origin) {
      const atSame = position.offset === opposite!.offset,
        inverted = oldStart!.offset > oldEnd!.offset,
        swap = isEnd
          ? inverted !== position.offset < opposite!.offset || atSame
          : !atSame && inverted !== position.offset > opposite!.offset;
      if (swap) {
        const local = getBoundary(opposite!);
        debugAssert(
          local.boundaryStart.offset >= this.range.start &&
            local.boundaryEnd.offset <= this.range.end,
        );
        this.setPosition(
          isEnd
            ? inverted
              ? local.boundaryStart
              : local.boundaryEnd
            : inverted
              ? local.boundaryEnd
              : local.boundaryStart,
          !isEnd,
        );
      }
    }
    return target ?? position;
  }
  private emptyEdge(local: Offset, isEnd: boolean): SelectionResult {
    const result = SelectionUtils.getResultBasedOnRect(this.rect, local);
    this.setPosition(
      result === SelectionResult.next
        ? pos(this.range.end)
        : pos(this.range.start, TextAffinity.upstream),
      isEnd,
    );
    return result;
  }
  private edgeResult(position: TextPosition, local: Offset): SelectionResult {
    return position.offset === this.range.end
      ? SelectionResult.next
      : position.offset === this.range.start
        ? SelectionResult.previous
        : SelectionUtils.getResultBasedOnRect(this.rect, local);
  }
  private updateEdge(global: Offset, isEnd: boolean): SelectionResult {
    this.setPosition(null, isEnd);
    const local = MatrixUtils.transformPoint(inverseTransform(this.paragraph), global);
    if (this.rect.isEmpty) return this.emptyEdge(local, isEnd);
    const adjusted = SelectionUtils.adjustDragOffset(this.rect, local, {
        direction: this.paragraph.textDirection,
      }),
      position = this.clamp(this.paragraph.getPositionForOffset(adjusted));
    this.setPosition(position, isEnd);
    return this.edgeResult(position, local);
  }
  private updateBoundaryEdge(
    global: Offset,
    isEnd: boolean,
    getBoundary: BoundaryAt,
  ): SelectionResult {
    const oldStart = this.start,
      oldEnd = this.end;
    this.setPosition(null, isEnd);
    const local = MatrixUtils.transformPoint(inverseTransform(this.paragraph), global);
    if (this.rect.isEmpty) return this.emptyEdge(local, isEnd);
    const position = this.paragraph.getPositionForOffset(
      SelectionUtils.adjustDragOffset(this.rect, local, {
        direction: this.paragraph.textDirection,
      }),
    );
    let boundary = this.rect.contains(local) ? getBoundary(position) : null;
    if (boundary !== null && this.boundaryOutside(boundary)) boundary = null;
    const target = this.clamp(
      this.boundaryTarget(boundary, getBoundary, position, oldStart, oldEnd, isEnd),
    );
    this.setPosition(target, isEnd);
    return this.edgeResult(target, local);
  }
  private selectAll(): SelectionResult {
    this.start = pos(this.range.start);
    this.end = pos(this.range.end, TextAffinity.upstream);
    return SelectionResult.none;
  }
  private selectBoundary(boundary: BoundaryRecord): SelectionResult {
    if (
      boundary.boundaryStart.offset < this.range.start &&
      boundary.boundaryEnd.offset <= this.range.start
    )
      return SelectionResult.previous;
    if (
      boundary.boundaryStart.offset >= this.range.end &&
      boundary.boundaryEnd.offset > this.range.end
    )
      return SelectionResult.next;
    debugAssert(
      boundary.boundaryStart.offset >= this.range.start &&
        boundary.boundaryEnd.offset <= this.range.end,
    );
    this.start = boundary.boundaryStart;
    this.end = boundary.boundaryEnd;
    this.containsOriginTextBoundary = true;
    return SelectionResult.end;
  }
  private selectMultiBoundary(boundary: BoundaryRecord): SelectionResult {
    if (
      boundary.boundaryStart.offset < this.range.start &&
      boundary.boundaryEnd.offset <= this.range.start
    )
      return SelectionResult.previous;
    if (
      boundary.boundaryStart.offset >= this.range.end &&
      boundary.boundaryEnd.offset > this.range.end
    )
      return SelectionResult.next;
    const start = Math.max(this.range.start, boundary.boundaryStart.offset),
      end = Math.min(this.range.end, boundary.boundaryEnd.offset);
    if (start <= end) {
      this.start = pos(start);
      this.end = pos(end);
      this.containsOriginTextBoundary = true;
      return this.range.end < boundary.boundaryEnd.offset
        ? SelectionResult.next
        : SelectionResult.end;
    }
    return SelectionResult.none;
  }
  private adjustBoundary(boundary: TextRange, position: TextPosition): BoundaryRecord {
    if (position.offset > boundary.end) {
      const collapsed = pos(position.offset);
      return { boundaryStart: collapsed, boundaryEnd: collapsed };
    }
    return {
      boundaryStart: pos(boundary.start),
      boundaryEnd: pos(boundary.end, TextAffinity.upstream),
    };
  }
  private wordBoundaryAt(position: TextPosition): BoundaryRecord {
    const boundary = this.paragraph.getWordBoundary(position);
    debugAssert(boundary.isNormalized);
    return this.adjustBoundary(boundary, position);
  }
  private paragraphBoundaryAt(position: TextPosition, text: string): BoundaryRecord {
    const boundary = new ParagraphBoundary(text),
      start =
        boundary.getLeadingTextBoundaryAt(
          position.offset === text.length || position.affinity === TextAffinity.upstream
            ? position.offset - 1
            : position.offset,
        ) ?? 0,
      end = boundary.getTrailingTextBoundaryAt(position.offset) ?? text.length;
    debugAssert(start <= end);
    return this.adjustBoundary(new TextRange({ start, end }), position);
  }
  private clampedParagraphBoundaryAt(position: TextPosition): BoundaryRecord {
    const boundary = new ParagraphBoundary(this.fullText),
      start = Math.max(
        this.range.start,
        Math.min(
          this.range.end,
          boundary.getLeadingTextBoundaryAt(
            position.offset === this.fullText.length || position.affinity === TextAffinity.upstream
              ? position.offset - 1
              : position.offset,
          ) ?? 0,
        ),
      ),
      end = Math.max(
        this.range.start,
        Math.min(
          this.range.end,
          boundary.getTrailingTextBoundaryAt(position.offset) ?? this.fullText.length,
        ),
      );
    debugAssert(start <= end);
    return this.adjustBoundary(new TextRange({ start, end }), position);
  }
  private positionInParagraph(target: RenderParagraph): TextPosition {
    return target.getPositionForOffset(
      MatrixUtils.transformPoint(
        Matrix4.fromList(this.paragraph.getTransformTo(target)),
        boxRect(this.paragraph).centerLeft,
      ),
    );
  }
  private isPlaceholder(): boolean {
    for (let current = this.paragraph.parent; current !== undefined; current = current.parent)
      if (current instanceof this.paragraphType) return true;
    return false;
  }
  private originParagraph(): RenderParagraph {
    debugAssert(this.containsOriginTextBoundary);
    let origin: RenderParagraph | null = null;
    for (let current = this.paragraph.parent; current !== undefined; current = current.parent)
      if (current instanceof this.paragraphType && current.selectionFragments !== null) {
        if (current.selectionFragments.some((fragment) => fragment.containsOriginTextBoundary))
          origin = current;
        else return origin ?? this.paragraph;
      }
    return origin ?? this.paragraph;
  }
  private paragraphContaining(
    global: Offset,
  ): { readonly paragraph: RenderParagraph; readonly localPosition: Offset } | null {
    for (
      let current: RenderObject | undefined = this.paragraph;
      current !== undefined;
      current = current.parent
    )
      if (current instanceof this.paragraphType) {
        const localPosition = MatrixUtils.transformPoint(inverseTransform(current), global);
        if (boxRect(current).contains(localPosition)) return { paragraph: current, localPosition };
      }
    return null;
  }

  private originResult(
    boundary: BoundaryRecord,
    origin: BoundaryRecord,
    forward: boolean,
    isEnd: boolean,
  ): SelectionResult | null {
    if (forward !== isEnd) {
      if (boundary.boundaryStart.offset >= origin.boundaryStart.offset) return SelectionResult.end;
      if (boundary.boundaryStart.offset < origin.boundaryStart.offset)
        return SelectionResult.previous;
    } else {
      if (boundary.boundaryEnd.offset <= origin.boundaryEnd.offset) return SelectionResult.end;
      if (boundary.boundaryEnd.offset > origin.boundaryEnd.offset) return SelectionResult.next;
    }
    return null;
  }
  private outsideMultiBoundary(boundary: BoundaryRecord, range: TextRange): SelectionResult | null {
    if (boundary.boundaryStart.offset > range.end && boundary.boundaryEnd.offset > range.end)
      return SelectionResult.next;
    if (boundary.boundaryStart.offset < range.start && boundary.boundaryEnd.offset < range.start)
      return SelectionResult.previous;
    return null;
  }
  private backwardSelection(
    oldStart: TextPosition | null,
    oldEnd: TextPosition | null,
    isEnd: boolean,
  ): boolean {
    return isEnd
      ? (oldEnd === null && oldStart!.offset === this.range.end) ||
          (same(oldStart, oldEnd) && oldStart!.offset === this.range.end) ||
          (oldEnd !== null && oldStart!.offset > oldEnd.offset)
      : (oldStart === null && oldEnd!.offset === this.range.start) ||
          (same(oldStart, oldEnd) && oldEnd!.offset === this.range.start) ||
          (oldStart !== null && oldStart.offset > oldEnd!.offset);
  }
  private updateMultiEdge(
    getBoundary: BoundaryInText,
    contains: boolean,
    position: TextPosition,
    oldStart: TextPosition | null,
    oldEnd: TextPosition | null,
    isEnd: boolean,
  ): SelectionResult | null {
    if (this.containsOriginTextBoundary && oldStart !== null && oldEnd !== null) {
      const forward = oldEnd.offset >= oldStart.offset,
        opposite = isEnd ? oldStart : oldEnd,
        origin = getBoundary(
          (isEnd ? !forward : forward) ? pos(opposite.offset - 1, opposite.affinity) : opposite,
          this.fullText,
        );
      if (contains) {
        const boundary = getBoundary(position, this.fullText),
          pivot = isEnd
            ? forward
              ? origin.boundaryStart.offset
              : origin.boundaryEnd.offset
            : forward
              ? origin.boundaryEnd.offset
              : origin.boundaryStart.offset,
          swap = !forward !== (isEnd ? position.offset < pivot : position.offset > pivot),
          target =
            position.offset < pivot
              ? boundary.boundaryStart
              : position.offset > pivot
                ? boundary.boundaryEnd
                : isEnd
                  ? forward
                    ? oldEnd
                    : oldStart
                  : forward
                    ? oldStart
                    : oldEnd;
        if (swap)
          this.setPosition(
            this.clamp(
              isEnd
                ? forward
                  ? origin.boundaryEnd
                  : origin.boundaryStart
                : forward
                  ? origin.boundaryStart
                  : origin.boundaryEnd,
            ),
            !isEnd,
          );
        this.setPosition(this.clamp(target), isEnd);
        const outside = this.outsideMultiBoundary(boundary, this.range);
        if (outside !== null) return outside;
        return this.originResult(boundary, origin, this.end!.offset >= this.start!.offset, isEnd);
      }
      const clamped = this.clamp(position),
        atStart = clamped.offset === this.range.start,
        atEnd = clamped.offset === this.range.end;
      if (
        (forward && atStart) ||
        (!forward && atEnd) ||
        (forward && atEnd) ||
        (!forward && atStart)
      ) {
        if (isEnd ? (forward ? atStart : atEnd) : forward ? atEnd : atStart)
          this.setPosition(
            this.clamp(
              isEnd
                ? forward
                  ? origin.boundaryEnd
                  : origin.boundaryStart
                : forward
                  ? origin.boundaryStart
                  : origin.boundaryEnd,
            ),
            !isEnd,
          );
        this.setPosition(clamped, isEnd);
        return atStart ? SelectionResult.previous : SelectionResult.next;
      }
    } else {
      const onPlaceholder =
        this.paragraph.getWordBoundary(position).textInside(this.fullText) === '\ufffc';
      if (!contains || onPlaceholder) return null;
      const opposite = isEnd ? oldStart : oldEnd;
      if (opposite !== null) {
        const boundary = getBoundary(position, this.fullText),
          backward = this.backwardSelection(oldStart, oldEnd, isEnd),
          outside = this.outsideMultiBoundary(boundary, this.range);
        if (outside !== null) {
          this.setPosition(
            pos(outside === SelectionResult.previous ? this.range.start : this.range.end),
            isEnd,
          );
          return outside;
        }
        if (backward === isEnd) {
          this.setPosition(this.clamp(boundary.boundaryStart), isEnd);
          return boundary.boundaryStart.offset < this.range.start
            ? SelectionResult.previous
            : SelectionResult.end;
        }
        this.setPosition(this.clamp(boundary.boundaryEnd), isEnd);
        return boundary.boundaryEnd.offset <= this.range.end
          ? SelectionResult.end
          : SelectionResult.next;
      }
    }
    return null;
  }
  private updatePlaceholderEdge(
    getBoundary: BoundaryInText,
    global: Offset,
    contains: boolean,
    position: TextPosition,
    oldStart: TextPosition | null,
    oldEnd: TextPosition | null,
    isEnd: boolean,
  ): SelectionResult | null {
    if (this.containsOriginTextBoundary && oldStart !== null && oldEnd !== null) {
      const forward = oldEnd.offset >= oldStart.offset,
        originParagraph = this.originParagraph(),
        current = isEnd ? oldEnd : oldStart;
      if (originParagraph === this.paragraph)
        return this.updateMultiEdge(getBoundary, contains, position, oldStart, oldEnd, isEnd);
      const local = MatrixUtils.transformPoint(inverseTransform(originParagraph), global),
        originPosition = originParagraph.getPositionForOffset(local),
        placeholderPosition = this.positionInParagraph(originParagraph),
        placeholderRange = new TextRange({
          start: placeholderPosition.offset,
          end: placeholderPosition.offset + 1,
        });
      if (boxRect(originParagraph).contains(local)) {
        const text = originParagraph.plainText,
          boundary = getBoundary(originPosition, text),
          origin = getBoundary(this.positionInParagraph(originParagraph), text),
          pivot = isEnd
            ? forward
              ? origin.boundaryStart.offset
              : origin.boundaryEnd.offset
            : forward
              ? origin.boundaryEnd.offset
              : origin.boundaryStart.offset,
          swap =
            !forward !== (isEnd ? originPosition.offset < pivot : originPosition.offset > pivot),
          target =
            originPosition.offset < pivot
              ? boundary.boundaryStart
              : originPosition.offset > pivot
                ? boundary.boundaryEnd
                : current;
        if (swap) this.setPosition(current, !isEnd);
        this.setPosition(this.clamp(target), isEnd);
        const outside = this.outsideMultiBoundary(boundary, placeholderRange);
        if (outside !== null) return outside;
        // Both pinned placeholder methods test the end boundary for a forward selection.
        return this.originResult(boundary, origin, this.end!.offset >= this.start!.offset, true);
      }
      const adjusted = originParagraph.getPositionForOffset(
          SelectionUtils.adjustDragOffset(boxRect(originParagraph), local, {
            direction: this.paragraph.textDirection,
          }),
        ),
        atStart = adjusted.offset <= placeholderRange.start,
        atEnd = adjusted.offset >= placeholderRange.end;
      if (
        (forward && atStart) ||
        (!forward && atEnd) ||
        (forward && atEnd) ||
        (!forward && atStart)
      ) {
        if (isEnd ? (forward ? atStart : atEnd) : forward ? atEnd : atStart)
          this.setPosition(current, !isEnd);
        this.setPosition(pos(atStart ? this.range.start : this.range.end), isEnd);
        return atStart ? SelectionResult.previous : SelectionResult.next;
      }
    } else {
      if (contains)
        return this.updateMultiEdge(getBoundary, contains, position, oldStart, oldEnd, isEnd);
      const opposite = isEnd ? oldStart : oldEnd;
      if (opposite !== null) {
        const details = this.paragraphContaining(global);
        if (details === null) return null;
        const target = details.paragraph,
          targetPosition = target.getPositionForOffset(details.localPosition),
          text = target.plainText;
        if (target.getWordBoundary(targetPosition).textInside(text) === '\ufffc') return null;
        const backward = this.backwardSelection(oldStart, oldEnd, isEnd),
          boundary = getBoundary(targetPosition, text),
          placeholderPosition = this.positionInParagraph(target),
          placeholderRange = new TextRange({
            start: placeholderPosition.offset,
            end: placeholderPosition.offset + 1,
          }),
          outside = this.outsideMultiBoundary(boundary, placeholderRange);
        if (outside !== null) {
          this.setPosition(
            pos(outside === SelectionResult.previous ? this.range.start : this.range.end),
            isEnd,
          );
          return outside;
        }
        if (backward === isEnd) {
          this.setPosition(pos(this.range.start), isEnd);
          return boundary.boundaryStart.offset >= placeholderRange.start
            ? SelectionResult.end
            : SelectionResult.previous;
        }
        this.setPosition(pos(this.range.end), isEnd);
        return boundary.boundaryEnd.offset <= placeholderRange.end
          ? SelectionResult.end
          : SelectionResult.next;
      }
    }
    return null;
  }
  private updateMultiBoundaryEdge(
    global: Offset,
    isEnd: boolean,
    getBoundary: BoundaryInText,
    getClampedBoundary: BoundaryAt,
  ): SelectionResult {
    const oldStart = this.start,
      oldEnd = this.end;
    this.setPosition(null, isEnd);
    const local = MatrixUtils.transformPoint(inverseTransform(this.paragraph), global);
    if (this.rect.isEmpty) return this.emptyEdge(local, isEnd);
    const position = this.paragraph.getPositionForOffset(
        SelectionUtils.adjustDragOffset(this.rect, local, {
          direction: this.paragraph.textDirection,
        }),
      ),
      positionInFullText = this.paragraph.getPositionForOffset(
        SelectionUtils.adjustDragOffset(boxRect(this.paragraph), local, {
          direction: this.paragraph.textDirection,
        }),
      ),
      contains = boxRect(this.paragraph).contains(local),
      result = this.isPlaceholder()
        ? this.updatePlaceholderEdge(
            getBoundary,
            global,
            contains,
            positionInFullText,
            oldStart,
            oldEnd,
            isEnd,
          )
        : this.updateMultiEdge(getBoundary, contains, positionInFullText, oldStart, oldEnd, isEnd);
    if (result !== null) return result;
    let boundary = this.boundingBoxes.some((box) => box.contains(local))
      ? getClampedBoundary(position)
      : null;
    if (boundary !== null && this.boundaryOutside(boundary)) boundary = null;
    const target = this.clamp(
      this.boundaryTarget(boundary, getClampedBoundary, position, oldStart, oldEnd, isEnd),
    );
    this.setPosition(target, isEnd);
    return this.edgeResult(target, local);
  }

  private extendGranularly(
    forward: boolean,
    isExtent: boolean,
    granularity: TextGranularity,
  ): SelectionResult {
    this.end ??= forward ? pos(this.range.start) : pos(this.range.end, TextAffinity.upstream);
    this.start ??= this.end;
    const edge = (isExtent ? this.end : this.start)!;
    if (forward && edge.offset === this.range.end) return SelectionResult.next;
    if (!forward && edge.offset === this.range.start) return SelectionResult.previous;
    let boundary: TextBoundary,
      newPosition: TextPosition,
      result = SelectionResult.end;
    switch (granularity) {
      case TextGranularity.character:
        boundary = new CharacterBoundary(this.range.textInside(this.fullText));
        break;
      case TextGranularity.word:
        boundary = this.paragraph.selectionPainter.wordBoundaries.moveByWordBoundary;
        break;
      case TextGranularity.paragraph:
        boundary = new ParagraphBoundary(this.range.textInside(this.fullText));
        break;
      case TextGranularity.line:
        boundary = new LineBoundary(this);
        break;
      case TextGranularity.document:
        boundary = new DocumentBoundary(this.range.textInside(this.fullText));
        break;
      default:
        throw new Error('Unknown selection granularity');
    }
    newPosition =
      granularity === TextGranularity.line
        ? this.moveToBoundary(edge, forward, boundary)
        : pos(
            forward
              ? (boundary.getTrailingTextBoundaryAt(edge.offset) ?? this.range.end)
              : (boundary.getLeadingTextBoundaryAt(edge.offset - 1) ?? this.range.start),
          );
    if (granularity === TextGranularity.document)
      result =
        forward && newPosition.offset === this.range.end
          ? SelectionResult.next
          : !forward && newPosition.offset === this.range.start
            ? SelectionResult.previous
            : SelectionResult.end;
    this.setPosition(newPosition, isExtent);
    return result;
  }
  private moveToBoundary(
    edge: TextPosition,
    forward: boolean,
    boundary: TextBoundary,
  ): TextPosition {
    debugAssert(edge.offset >= 0);
    let offset: number;
    if (edge.affinity === TextAffinity.upstream) {
      if (edge.offset < 1 && !forward) {
        debugAssert(edge.offset === 0);
        return pos(0);
      }
      offset =
        Math.max(
          0,
          new CharacterBoundary(this.fullText).getLeadingTextBoundaryAt(
            this.range.start + edge.offset,
          ) ?? this.range.start,
        ) - 1;
    } else offset = edge.offset;
    return pos(
      forward
        ? (boundary.getTrailingTextBoundaryAt(offset) ?? this.range.end)
        : (boundary.getLeadingTextBoundaryAt(offset) ?? this.range.start),
    );
  }
  private extendDirectionally(
    horizontalBaseline: number,
    isExtent: boolean,
    movement: SelectionExtendDirection,
  ): SelectionResult {
    const transform = Matrix4.fromList(this.paragraph.getTransformTo(null));
    if (transform.invert() === 0)
      return movement === SelectionExtendDirection.previousLine ||
        movement === SelectionExtendDirection.backward
        ? SelectionResult.previous
        : SelectionResult.next;
    const x = MatrixUtils.transformPoint(transform, new Offset(horizontalBaseline, 0)).dx;
    debugAssert(!Number.isNaN(x));
    let position: TextPosition, result: SelectionResult;
    if (
      movement === SelectionExtendDirection.previousLine ||
      movement === SelectionExtendDirection.nextLine
    ) {
      debugAssert(this.start !== null && this.end !== null);
      [position, result] = this.verticalMovement(
        (isExtent ? this.end : this.start)!,
        x,
        movement === SelectionExtendDirection.nextLine,
      );
    } else {
      this.end ??=
        movement === SelectionExtendDirection.forward
          ? pos(this.range.start)
          : pos(this.range.end, TextAffinity.upstream);
      this.start ??= this.end;
      const offset = this.paragraph.selectionOffsetForPosition((isExtent ? this.end : this.start)!);
      position = this.paragraph.getPositionForOffset(
        new Offset(x, offset.dy - this.paragraph.selectionPainter.preferredLineHeight / 2),
      );
      result = SelectionResult.end;
    }
    this.setPosition(position, isExtent);
    return result;
  }
  private verticalMovement(
    position: TextPosition,
    x: number,
    below: boolean,
  ): readonly [TextPosition, SelectionResult] {
    const lines = this.paragraph.selectionPainter._layoutLineMetrics(),
      offset = this.paragraph.getOffsetForCaret(position, Rect.zero);
    let current = lines.length - 1;
    for (let index = 0; index < lines.length; index++)
      if (lines[index]!.baseline > offset.dy) {
        current = index;
        break;
      }
    const next =
        below && current === lines.length - 1
          ? pos(this.range.end, TextAffinity.upstream)
          : !below && current === 0
            ? pos(this.range.start)
            : this.clamp(
                this.paragraph.getPositionForOffset(
                  new Offset(x, lines[below ? current + 1 : current - 1]!.baseline),
                ),
              ),
      result =
        next.offset === this.range.start
          ? SelectionResult.previous
          : next.offset === this.range.end
            ? SelectionResult.next
            : SelectionResult.end;
    debugAssert(result !== SelectionResult.next || below);
    debugAssert(result !== SelectionResult.previous || !below);
    return [next, result];
  }
  private static compare(position: TextPosition, other: TextPosition): number {
    return position.offset < other.offset
      ? 1
      : position.offset > other.offset
        ? -1
        : position.affinity === other.affinity
          ? 0
          : position.affinity === TextAffinity.upstream
            ? 1
            : -1;
  }
  private positionIsWithinSelection(position: TextPosition): boolean {
    if (this.start === null || this.end === null) return false;
    const forward = SelectableParagraphFragment.compare(this.start, this.end) > 0,
      start = forward ? this.start : this.end,
      end = forward ? this.end : this.start;
    return (
      SelectableParagraphFragment.compare(start, position) >= 0 &&
      SelectableParagraphFragment.compare(end, position) <= 0
    );
  }
  getTransformTo(ancestor: RenderObject | null): Matrix4 {
    return Matrix4.fromList(this.paragraph.getTransformTo(ancestor));
  }
  override pushHandleLayers(start: LayerLink | null, end: LayerLink | null): void {
    if (!this.paragraph.attached) {
      debugAssert(start === null && end === null, 'Only clean up can be called.');
      return;
    }
    if (this.startLink !== start) {
      this.startLink = start;
      this.paragraph.markNeedsPaint();
    }
    if (this.endLink !== end) {
      this.endLink = end;
      this.paragraph.markNeedsPaint();
    }
  }
  private fallbackRect(): Rect {
    const offset = this.paragraph.selectionOffsetForPosition(pos(this.range.start));
    return Rect.fromPoints(
      offset,
      offset.translate(0, -this.paragraph.selectionPainter.preferredLineHeight),
    );
  }
  get boundingBoxes(): readonly Rect[] {
    if (this.cachedBoxes === null) {
      const boxes = this.paragraph.getBoxesForSelection(
        new TextSelection({ baseOffset: this.range.start, extentOffset: this.range.end }),
        { boxHeightStyle: 'max' },
      );
      this.cachedBoxes = boxes.length ? boxes.map((box) => box.toRect()) : [this.fallbackRect()];
    }
    return this.cachedBoxes;
  }
  private get rect(): Rect {
    if (this.cachedRect === null) {
      const boxes = this.paragraph.getBoxesForSelection(
        new TextSelection({ baseOffset: this.range.start, extentOffset: this.range.end }),
        { boxHeightStyle: 'max' },
      );
      this.cachedRect = boxes.length
        ? boxes
            .slice(1)
            .reduce((rect, box) => rect.expandToInclude(box.toRect()), boxes[0]!.toRect())
        : this.fallbackRect();
    }
    return this.cachedRect;
  }
  didChangeParagraphLayout(): void {
    this.cachedRect = null;
    this.cachedBoxes = null;
  }
  override get contentLength(): number {
    return this.range.end - this.range.start;
  }
  get size(): import('../../ui/geometry.ts').Size {
    return this.rect.size;
  }
  paintSelection(context: PaintingContext, offset: Offset = Offset.zero): void {
    if (this.start === null || this.end === null || this.paragraph.selectionColor === null) return;
    const paint = new Paint({ style: 'fill', color: this.paragraph.selectionColor });
    for (const box of this.paragraph.getBoxesForSelection(this.selection!))
      context.drawRect(box.toRect().shift(offset), paint);
  }
  paintHandles(context: PaintingContext, offset: Offset = Offset.zero): void {
    if (this.start === null || this.end === null) return;
    for (const [link, point] of [
      [this.startLink, this.value.startSelectionPoint],
      [this.endLink, this.value.endSelectionPoint],
    ] as const)
      if (link !== null && point !== null)
        context.pushLayer(
          new LeaderLayer({ link, offset: offset.add(point.localPosition) }),
          () => {},
          Offset.zero,
        );
  }
  getLineAtOffset(position: TextPosition): TextSelection {
    const line = this.paragraph.selectionPainter.getLineBoundary(position);
    return new TextSelection({
      baseOffset: Math.max(this.range.start, Math.min(this.range.end, line.start)),
      extentOffset: Math.max(this.range.start, Math.min(this.range.end, line.end)),
    });
  }
  getWordBoundary(position: TextPosition): TextRange {
    return this.paragraph.getWordBoundary(position);
  }
  getTextPositionAbove(position: TextPosition): TextPosition {
    return this.verticalTextPosition(position, -0.5);
  }
  getTextPositionBelow(position: TextPosition): TextPosition {
    return this.verticalTextPosition(position, 1.5);
  }
  private verticalTextPosition(position: TextPosition, factor: number): TextPosition {
    const caret = this.paragraph.getOffsetForCaret(position, Rect.zero);
    return this.clamp(
      this.paragraph.getPositionForOffset(
        caret.translate(0, factor * this.paragraph.selectionPainter.preferredLineHeight),
      ),
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new DiagnosticsProperty('textInsideRange', this.range.textInside(this.fullText)),
    );
    properties.add(new DiagnosticsProperty('range', this.range));
    properties.add(new DiagnosticsProperty('fullText', this.fullText));
  }
  dispose(): void {
    this.notifier.dispose();
  }
}
