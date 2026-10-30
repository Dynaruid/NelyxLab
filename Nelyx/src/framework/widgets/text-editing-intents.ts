// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed widgets/text_editing_intents.dart; constructor tokens adapt reified Intent types.
import { Intent } from './actions.ts';
import { SelectionChangedCause } from '../../services/text-input.ts';
import type { TextEditingValue } from '../../services/text-input.ts';
import type { TextSelection } from '../../services/text-editing.ts';
import type { TextRange } from '../../ui/text-range.ts';
import type { FocusNode } from './focus.ts';
import type { PointerDownEvent, PointerUpEvent } from '../gestures/events.ts';
import { protect } from '../../ui/value-math.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
export class DoNothingAndStopPropagationTextIntent extends Intent {}
export abstract class DirectionalTextEditingIntent extends Intent {
  constructor(readonly forward: boolean) {
    super();
    protect(this, ['forward']);
  }
}
export class DeleteCharacterIntent extends DirectionalTextEditingIntent {
  constructor({ forward }: { readonly forward: boolean }) {
    super(forward);
  }
}
export class DeleteToNextWordBoundaryIntent extends DirectionalTextEditingIntent {
  constructor({ forward }: { readonly forward: boolean }) {
    super(forward);
  }
}
export class DeleteToLineBreakIntent extends DirectionalTextEditingIntent {
  constructor({ forward }: { readonly forward: boolean }) {
    super(forward);
  }
}
export abstract class DirectionalCaretMovementIntent extends DirectionalTextEditingIntent {
  constructor(
    forward: boolean,
    readonly collapseSelection: boolean,
    readonly collapseAtReversal = false,
    readonly continuesAtWrap = false,
  ) {
    super(forward);
    if (FoundationBuildMode.debug)
      invariant(
        !collapseSelection || !collapseAtReversal,
        'invalid-caret-movement-intent',
        'Cannot collapse both the selection and at reversal',
      );
    protect(this, ['collapseSelection', 'collapseAtReversal', 'continuesAtWrap']);
  }
}
interface CaretIntentOptions {
  readonly forward: boolean;
  readonly collapseSelection: boolean;
}
export class ExtendSelectionByCharacterIntent extends DirectionalCaretMovementIntent {
  constructor({ forward, collapseSelection }: CaretIntentOptions) {
    super(forward, collapseSelection);
  }
}
export class ExtendSelectionToNextWordBoundaryIntent extends DirectionalCaretMovementIntent {
  constructor({ forward, collapseSelection }: CaretIntentOptions) {
    super(forward, collapseSelection);
  }
}
export class ExtendSelectionToNextWordBoundaryOrCaretLocationIntent extends DirectionalCaretMovementIntent {
  constructor({ forward }: { readonly forward: boolean }) {
    super(forward, false, true);
  }
}
export class ExpandSelectionToDocumentBoundaryIntent extends DirectionalCaretMovementIntent {
  constructor({ forward }: { readonly forward: boolean }) {
    super(forward, false);
  }
}
export class ExpandSelectionToLineBreakIntent extends DirectionalCaretMovementIntent {
  constructor({ forward }: { readonly forward: boolean }) {
    super(forward, false);
  }
}
export class ExtendSelectionToLineBreakIntent extends DirectionalCaretMovementIntent {
  constructor({
    forward,
    collapseSelection,
    collapseAtReversal = false,
    continuesAtWrap = false,
  }: CaretIntentOptions & {
    readonly collapseAtReversal?: boolean;
    readonly continuesAtWrap?: boolean;
  }) {
    super(forward, collapseSelection, collapseAtReversal, continuesAtWrap);
  }
}
export class ExtendSelectionVerticallyToAdjacentLineIntent extends DirectionalCaretMovementIntent {
  constructor({ forward, collapseSelection }: CaretIntentOptions) {
    super(forward, collapseSelection);
  }
}
export class ExtendSelectionVerticallyToAdjacentPageIntent extends DirectionalCaretMovementIntent {
  constructor({ forward, collapseSelection }: CaretIntentOptions) {
    super(forward, collapseSelection);
  }
}
export class ExtendSelectionToNextParagraphBoundaryIntent extends DirectionalCaretMovementIntent {
  constructor({ forward, collapseSelection }: CaretIntentOptions) {
    super(forward, collapseSelection);
  }
}
export class ExtendSelectionToNextParagraphBoundaryOrCaretLocationIntent extends DirectionalCaretMovementIntent {
  constructor({ forward }: { readonly forward: boolean }) {
    super(forward, false, true);
  }
}
export class ExtendSelectionToDocumentBoundaryIntent extends DirectionalCaretMovementIntent {
  constructor({ forward, collapseSelection }: CaretIntentOptions) {
    super(forward, collapseSelection);
  }
}
export class ScrollToDocumentBoundaryIntent extends DirectionalTextEditingIntent {
  constructor({ forward }: { readonly forward: boolean }) {
    super(forward);
  }
}
export class SelectAllTextIntent extends Intent {
  constructor(readonly cause: SelectionChangedCause) {
    super();
    protect(this, ['cause']);
  }
}
export class CopySelectionTextIntent extends Intent {
  static readonly copy = new CopySelectionTextIntent(SelectionChangedCause.keyboard, false);
  /** @internal Source private constructor is public in TS so this class can be an Actions type token. */
  constructor(
    readonly cause: SelectionChangedCause,
    readonly collapseSelection: boolean,
  ) {
    super();
    protect(this, ['cause', 'collapseSelection']);
  }
  static cut(cause: SelectionChangedCause): CopySelectionTextIntent {
    return new CopySelectionTextIntent(cause, true);
  }
}
export class PasteTextIntent extends Intent {
  constructor(readonly cause: SelectionChangedCause) {
    super();
    protect(this, ['cause']);
  }
}
export class RedoTextIntent extends Intent {
  constructor(readonly cause: SelectionChangedCause) {
    super();
    protect(this, ['cause']);
  }
}
export class ReplaceTextIntent extends Intent {
  constructor(
    readonly currentTextEditingValue: TextEditingValue,
    readonly replacementText: string,
    readonly replacementRange: TextRange,
    readonly cause: SelectionChangedCause,
  ) {
    super();
    protect(this, ['currentTextEditingValue', 'replacementText', 'replacementRange', 'cause']);
  }
}
export class UndoTextIntent extends Intent {
  constructor(readonly cause: SelectionChangedCause) {
    super();
    protect(this, ['cause']);
  }
}
export class UpdateSelectionIntent extends Intent {
  constructor(
    readonly currentTextEditingValue: TextEditingValue,
    readonly newSelection: TextSelection,
    readonly cause: SelectionChangedCause,
  ) {
    super();
    protect(this, ['currentTextEditingValue', 'newSelection', 'cause']);
  }
}
export class TransposeCharactersIntent extends Intent {}
export class EditableTextTapOutsideIntent extends Intent {
  constructor({
    focusNode,
    pointerDownEvent,
  }: {
    readonly focusNode: FocusNode;
    readonly pointerDownEvent: PointerDownEvent;
  }) {
    super();
    this.focusNode = focusNode;
    this.pointerDownEvent = pointerDownEvent;
    protect(this, ['focusNode', 'pointerDownEvent']);
  }
  readonly focusNode: FocusNode;
  readonly pointerDownEvent: PointerDownEvent;
}
export class EditableTextTapUpOutsideIntent extends Intent {
  constructor({
    focusNode,
    pointerUpEvent,
  }: {
    readonly focusNode: FocusNode;
    readonly pointerUpEvent: PointerUpEvent;
  }) {
    super();
    this.focusNode = focusNode;
    this.pointerUpEvent = pointerUpEvent;
    protect(this, ['focusNode', 'pointerUpEvent']);
  }
  readonly focusNode: FocusNode;
  readonly pointerUpEvent: PointerUpEvent;
}
