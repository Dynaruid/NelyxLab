// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed _SelectableTextContainer and delegate from the pinned widgets/text.dart.
import { State, StatefulWidget, StatelessWidget } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import { GlobalKey } from './global-key.ts';
import { SelectionContainer } from './selection-container.ts';
import { StaticSelectionContainerDelegate } from './selectable-region.ts';
import { RenderParagraph } from '../rendering/boxes.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { MatrixUtils } from '../painting/matrix-utils.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import type { Selectable } from '../rendering/selection.ts';
import {
  SelectionResult,
  SelectionEdgeUpdateEvent,
  SelectionEventType,
  SelectParagraphSelectionEvent,
  ClearSelectionEvent,
  SelectedContentRange,
  TextGranularity,
} from '../rendering/selection.ts';
const debugAssert = (condition: boolean, message: string): void => {
  if (FoundationBuildMode.debug) invariant(condition, 'invalid-text-selection-container', message);
};
type TextFactory = (context: BuildContext, key: GlobalKey) => Widget;
/** @internal The factory supplies existing plain/rich paragraph host configuration. */
export class SelectableTextContainer extends StatefulWidget {
  constructor(readonly createText: TextFactory) {
    super();
  }
  createState(): State<SelectableTextContainer> {
    return new SelectableTextContainerState();
  }
}
class SelectableTextContainerState extends State<SelectableTextContainer> {
  private readonly textKey = new GlobalKey();
  private readonly delegate = new SelectableTextContainerDelegate(this.textKey);
  override dispose(): void {
    this.delegate.dispose();
    super.dispose();
  }
  build(): Widget {
    return new SelectionContainer({
      delegate: this.delegate,
      child: new RegisteredText(this.widget.createText, this.textKey),
    });
  }
}
class RegisteredText extends StatelessWidget {
  constructor(
    readonly createText: TextFactory,
    readonly textKey: GlobalKey,
  ) {
    super();
  }
  build(context: BuildContext): Widget {
    return this.createText(context, this.textKey);
  }
}
/** @internal Source inline delegate has distinct paragraph traversal and local range math. */
export class SelectableTextContainerDelegate extends StaticSelectionContainerDelegate {
  constructor(private readonly textKey: GlobalKey) {
    super();
  }
  protected get paragraph(): RenderParagraph {
    const render = this.textKey.currentContext?.findRenderObject();
    invariant(
      render instanceof RenderParagraph,
      'missing-text-paragraph',
      'Text selection key must resolve to RenderParagraph',
    );
    return render;
  }
  protected override handleSelectParagraph(event: SelectParagraphSelectionEvent): SelectionResult {
    const result = this.selectParagraph(event);
    super.didReceiveSelectionBoundaryEvents();
    return result;
  }
  private selectParagraph(event: SelectParagraphSelectionEvent): SelectionResult {
    if (event.absorb) {
      for (const selectable of this.selectables)
        this.dispatchSelectionEventToChild(selectable, event);
      this.currentSelectionStartIndex = 0;
      this.currentSelectionEndIndex = this.selectables.length - 1;
      return SelectionResult.next;
    }
    for (let index = 0; index < this.selectables.length; index++) {
      const selectable = this.selectables[index]!;
      if (!this.paragraph.selectableBelongsToParagraph(selectable))
        for (const rect of selectable.boundingBoxes) {
          const transform = selectable.getTransformTo(null),
            global = MatrixUtils.transformRect(
              transform instanceof Matrix4 ? transform : Matrix4.fromList(transform),
              rect,
            );
          if (global.contains(event.globalPosition)) {
            this.currentSelectionStartIndex = this.currentSelectionEndIndex = index;
            return this.dispatchSelectionEventToChild(selectable, event);
          }
        }
    }
    let last: SelectionResult | null = null,
      foundStart = false,
      lastNext: number | null = null;
    for (let index = 0; index < this.selectables.length; index++) {
      const selectable = this.selectables[index]!;
      if (!this.paragraph.selectableBelongsToParagraph(selectable)) {
        if (foundStart) {
          const result = this.dispatchSelectionEventToChild(
            selectable,
            new SelectParagraphSelectionEvent({
              globalPosition: event.globalPosition,
              absorb: true,
            }),
          );
          if (index === this.selectables.length - 1) {
            this.currentSelectionEndIndex = index;
            this.flushTextInactiveSelections();
            return result;
          }
        }
        continue;
      }
      const existing = selectable.value;
      last = this.dispatchSelectionEventToChild(selectable, event);
      const changed = !selectable.value.equals(existing);
      if (index === this.selectables.length - 1 && last === SelectionResult.next) {
        if (foundStart) this.currentSelectionEndIndex = index;
        else this.currentSelectionStartIndex = this.currentSelectionEndIndex = index;
        return SelectionResult.next;
      }
      if (last === SelectionResult.next) {
        if (!changed && !foundStart) lastNext = index;
        if (changed && !foundStart) {
          debugAssert(
            selectable.boundingBoxes.length > 0 && selectable.value.selectionRects.length > 0,
            'Selected fragment requires bounding/selection rectangles',
          );
          const atStart = selectable.boundingBoxes[0]!.overlaps(
              selectable.value.selectionRects[0]!,
            ),
            startIndex =
              lastNext !== null && atStart
                ? lastNext + 1
                : lastNext === null && atStart
                  ? 0
                  : index;
          for (let i = startIndex; i < index; i++)
            this.dispatchSelectionEventToChild(
              this.selectables[i]!,
              new SelectParagraphSelectionEvent({
                globalPosition: event.globalPosition,
                absorb: true,
              }),
            );
          this.currentSelectionStartIndex = startIndex;
          foundStart = true;
        }
        continue;
      }
      if (index === 0 && last === SelectionResult.previous) return SelectionResult.previous;
      if (changed) {
        if (!foundStart && lastNext === null) {
          this.currentSelectionStartIndex = 0;
          for (let i = 0; i < index; i++)
            this.dispatchSelectionEventToChild(
              this.selectables[i]!,
              new SelectParagraphSelectionEvent({
                globalPosition: event.globalPosition,
                absorb: true,
              }),
            );
        }
        this.currentSelectionEndIndex = index;
        this.flushTextInactiveSelections();
      }
      return SelectionResult.end;
    }
    debugAssert(last === null, 'Unexpected final text paragraph selection result');
    return SelectionResult.end;
  }
  private adjustParagraphSelection(
    event: SelectionEdgeUpdateEvent,
    isEnd: boolean,
  ): SelectionResult {
    debugAssert(
      (isEnd ? this.currentSelectionEndIndex : this.currentSelectionStartIndex) >= 0 &&
        (isEnd ? this.currentSelectionEndIndex : this.currentSelectionStartIndex) <
          this.selectables.length,
      'Selection index must identify a child',
    );
    const visible = isEnd
        ? this.value.endSelectionPoint !== null
        : this.value.startSelectionPoint !== null,
      oppositeVisible = isEnd
        ? this.value.startSelectionPoint !== null
        : this.value.endSelectionPoint !== null;
    let index = visible
        ? isEnd
          ? this.currentSelectionEndIndex
          : this.currentSelectionStartIndex
        : oppositeVisible
          ? isEnd
            ? this.currentSelectionStartIndex
            : this.currentSelectionEndIndex
          : 0,
      forward: boolean | null = null,
      result: SelectionResult | null = null;
    while (index < this.selectables.length && index >= 0 && result === null) {
      const current = this.dispatchSelectionEventToChild(this.selectables[index]!, event);
      switch (current) {
        case SelectionResult.end:
        case SelectionResult.pending:
        case SelectionResult.none:
          result = current;
          break;
        case SelectionResult.next:
          if (forward === false) {
            index++;
            result = SelectionResult.end;
          } else if (index === this.selectables.length - 1) result = current;
          else {
            forward = true;
            index++;
          }
          break;
        case SelectionResult.previous:
          if (forward === true) {
            index--;
            result = SelectionResult.end;
          } else if (index === 0) result = current;
          else {
            forward = false;
            index--;
          }
          break;
      }
    }
    const selectionForward = this.currentSelectionEndIndex >= this.currentSelectionStartIndex;
    if (isEnd) {
      if (
        forward !== null &&
        ((!selectionForward && forward && index >= this.currentSelectionStartIndex) ||
          (selectionForward && !forward && index <= this.currentSelectionStartIndex))
      )
        this.currentSelectionStartIndex = this.currentSelectionEndIndex;
      this.currentSelectionEndIndex = index;
    } else {
      if (
        forward !== null &&
        ((!selectionForward && !forward && index <= this.currentSelectionEndIndex) ||
          (selectionForward && forward && index >= this.currentSelectionEndIndex))
      )
        this.currentSelectionEndIndex = this.currentSelectionStartIndex;
      this.currentSelectionStartIndex = index;
    }
    this.flushTextInactiveSelections();
    invariant(
      result !== null,
      'unresolved-text-selection',
      'Text paragraph selection must resolve an edge',
    );
    return result;
  }
  protected override get compareOrder(): (a: Selectable, b: Selectable) => number {
    return (a, b) => {
      const first = (selectable: Selectable) => {
          const transform = selectable.getTransformTo(null);
          return MatrixUtils.transformRect(
            transform instanceof Matrix4 ? transform : Matrix4.fromList(transform),
            selectable.boundingBoxes[0]!,
          );
        },
        left = first(a),
        right = first(b);
      let vertical = 0;
      if (
        !(
          (left.top - right.top < 3 && left.bottom - right.bottom > -3) ||
          (right.top - left.top < 3 && right.bottom - left.bottom > -3)
        )
      )
        vertical =
          Math.abs(left.top - right.top) > 3
            ? left.top > right.top
              ? 1
              : -1
            : left.bottom > right.bottom
              ? 1
              : -1;
      if (vertical !== 0) return vertical;
      if (left.left - right.left < 1e-10 && left.right - right.right > -1e-10) return -1;
      if (right.left - left.left < 1e-10 && right.right - left.right > -1e-10) return 1;
      return Math.abs(left.left - right.left) > 1e-10
        ? left.left > right.left
          ? 1
          : -1
        : left.right > right.right
          ? 1
          : -1;
    };
  }
  override getSelection(): SelectedContentRange | null {
    if (this.currentSelectionStartIndex === -1 || this.currentSelectionEndIndex === -1) return null;
    let start = 0,
      end = 0,
      found = false,
      forward = this.currentSelectionEndIndex >= this.currentSelectionStartIndex;
    if (this.currentSelectionEndIndex === this.currentSelectionStartIndex) {
      const range = this.selectables[this.currentSelectionStartIndex]!.getSelection()!;
      forward = range.endOffset >= range.startOffset;
    }
    for (let index = 0; index < this.selectables.length; index++) {
      const selectable = this.selectables[index]!,
        range = selectable.getSelection();
      if (range === null) {
        if (found)
          return new SelectedContentRange({
            startOffset: forward ? start : end,
            endOffset: forward ? end : start,
          });
        start += selectable.contentLength;
        end = start;
        continue;
      }
      const first = Math.min(range.startOffset, range.endOffset),
        last = Math.max(range.startOffset, range.endOffset);
      if (!found) {
        const considerStart = index > 0 && this.paragraph.selectableBelongsToParagraph(selectable);
        start += Math.abs(
          first -
            (considerStart
              ? this.paragraph.getPositionForOffset(selectable.boundingBoxes[0]!.centerLeft).offset
              : 0),
        );
        end = start + Math.abs(last - first);
        found = true;
      } else end += Math.abs(last - first);
    }
    debugAssert(
      found,
      'The start of the selection has not been found despite existing currentSelectionStartIndex and currentSelectionEndIndex',
    );
    return new SelectedContentRange({
      startOffset: forward ? start : end,
      endOffset: forward ? end : start,
    });
  }
  private flushTextInactiveSelections(): void {
    const start = this.currentSelectionStartIndex,
      end = this.currentSelectionEndIndex;
    if (start === -1 && end === -1) return;
    for (let index = 0; index < this.selectables.length; index++) {
      const skip =
        start === -1 || end === -1
          ? index === (start === -1 ? end : start)
          : index >= Math.min(start, end) && index <= Math.max(start, end);
      if (!skip)
        this.dispatchSelectionEventToChild(this.selectables[index]!, new ClearSelectionEvent());
    }
  }
  protected override handleSelectionEdgeUpdate(event: SelectionEdgeUpdateEvent): SelectionResult {
    if (event.granularity !== TextGranularity.paragraph)
      return super.handleSelectionEdgeUpdate(event);
    const isEnd = event.type === SelectionEventType.endEdgeUpdate;
    this.updateLastSelectionEdgeLocation({
      globalSelectionEdgeLocation: event.globalPosition,
      forEnd: isEnd,
    });
    return (isEnd ? this.currentSelectionEndIndex : this.currentSelectionStartIndex) === -1
      ? super.handleSelectionEdgeUpdate(event)
      : this.adjustParagraphSelection(event, isEnd);
  }
}
