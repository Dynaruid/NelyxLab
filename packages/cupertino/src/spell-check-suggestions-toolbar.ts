// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/spell_check_suggestions_toolbar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { ContextMenuButtonItem } from '@nelyx/core/framework/widgets/context-menu-button-item';
import type { EditableTextState } from '@nelyx/core/framework/widgets/editable-text';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import type { TextSelectionToolbarAnchors } from '@nelyx/core/framework/widgets/text-selection-toolbar-anchors';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { CupertinoTextSelectionToolbarButton } from './text-selection-toolbar-button.ts';
import { CupertinoTextSelectionToolbar } from './text-selection-toolbar.ts';

const maxSuggestions = 3;

export interface CupertinoSpellCheckSuggestionsToolbarOptions extends WidgetOptions {
  readonly anchors: TextSelectionToolbarAnchors;
  readonly buttonItems: readonly ContextMenuButtonItem[];
}

export class CupertinoSpellCheckSuggestionsToolbar extends StatelessWidget {
  readonly anchors: TextSelectionToolbarAnchors;
  readonly buttonItems: readonly ContextMenuButtonItem[];

  constructor({ anchors, buttonItems, key = null }: CupertinoSpellCheckSuggestionsToolbarOptions) {
    super(key);
    invariant(
      buttonItems.length <= maxSuggestions,
      'too-many-cupertino-spell-check-buttons',
      'Cupertino spell check toolbar accepts up to three suggestions',
    );
    this.anchors = anchors;
    this.buttonItems = Object.freeze([...buttonItems]);
  }

  static editableText({
    editableTextState,
    key = null,
  }: WidgetOptions & {
    readonly editableTextState: EditableTextState;
  }): CupertinoSpellCheckSuggestionsToolbar {
    return new CupertinoSpellCheckSuggestionsToolbar({
      key,
      anchors: editableTextState.contextMenuAnchors,
      buttonItems: this.buildButtonItems(editableTextState) ?? [],
    });
  }

  static buildButtonItems(editor: EditableTextState): ContextMenuButtonItem[] | null {
    const span = editor.findSuggestionSpanAtCursorIndex(
      editor.textEditingValue.selection.baseOffset,
    );
    if (span === null) return null;
    if (span.suggestions.length === 0)
      return [
        new ContextMenuButtonItem({
          onPressed: null,
          label: CupertinoLocalizations.of(editor.context).noSpellCheckReplacementsLabel,
        }),
      ];
    return span.suggestions.slice(0, maxSuggestions).map(
      (suggestion) =>
        new ContextMenuButtonItem({
          label: suggestion,
          onPressed: () =>
            editor.replaceSpellCheckSuggestion(span, suggestion, { collapseSelection: true }),
        }),
    );
  }

  override build(_context: BuildContext): Widget {
    if (!this.buttonItems.length) return new SizedBox(0, 0);
    return new CupertinoTextSelectionToolbar({
      anchorAbove: this.anchors.primaryAnchor,
      anchorBelow: this.anchors.secondaryAnchor ?? this.anchors.primaryAnchor,
      children: this.buttonItems.map((buttonItem) =>
        CupertinoTextSelectionToolbarButton.buttonItem({ buttonItem }),
      ),
    });
  }
}
