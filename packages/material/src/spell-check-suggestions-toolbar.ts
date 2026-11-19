// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/spell_check_suggestions_toolbar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { Border } from '@nelyx/core/framework/painting/box-border';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { AnimatedSize } from '@nelyx/core/framework/widgets/animated-size';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Column, DecoratedBox, Padding, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import {
  ContextMenuButtonItem,
  ContextMenuButtonType,
} from '@nelyx/core/framework/widgets/context-menu-button-item';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import type { EditableTextState } from '@nelyx/core/framework/widgets/editable-text';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import type { TextSelectionToolbarAnchors } from '@nelyx/core/framework/widgets/text-selection-toolbar-anchors';
import type { Offset } from '@nelyx/core/ui/geometry';
import { CupertinoTextSelectionToolbar } from '@nelyx/cupertino/text-selection-toolbar';
import { AdaptiveTextSelectionToolbar } from './adaptive-text-selection-toolbar.ts';
import { Material, MaterialType } from './material.ts';
import { SpellCheckSuggestionsToolbarLayoutDelegate } from './spell-check-suggestions-toolbar-layout-delegate.ts';
import { TextSelectionToolbarTextButton } from './text-selection-toolbar-text-button.ts';

const defaultToolbarHeight = 193;
const maxSuggestions = 3;
const rowHeight = 48;
const deleteDivider = new BoxDecoration({
  border: new Border({ top: new BorderSide({ color: 0xff9e9e9e }) }),
});
const deleteStyle = new TextStyle({ color: 0xff2196f3 });

export interface SpellCheckSuggestionsToolbarOptions extends WidgetOptions {
  readonly anchor: Offset;
  readonly buttonItems: readonly ContextMenuButtonItem[];
}

export class SpellCheckSuggestionsToolbar extends StatelessWidget {
  readonly anchor: Offset;
  readonly buttonItems: readonly ContextMenuButtonItem[];

  constructor({ anchor, buttonItems, key = null }: SpellCheckSuggestionsToolbarOptions) {
    super(key);
    invariant(
      buttonItems.length <= maxSuggestions + 1,
      'too-many-spell-check-buttons',
      'Material spell check toolbar accepts up to four buttons',
    );
    this.anchor = anchor;
    this.buttonItems = Object.freeze([...buttonItems]);
  }

  static editableText({
    editableTextState,
    key = null,
  }: WidgetOptions & {
    readonly editableTextState: EditableTextState;
  }): SpellCheckSuggestionsToolbar {
    return new SpellCheckSuggestionsToolbar({
      key,
      anchor: this.getToolbarAnchor(editableTextState.contextMenuAnchors),
      buttonItems: this.buildButtonItems(editableTextState) ?? [],
    });
  }

  static getToolbarAnchor(anchors: TextSelectionToolbarAnchors): Offset {
    return anchors.secondaryAnchor ?? anchors.primaryAnchor;
  }

  static buildButtonItems(editor: EditableTextState): ContextMenuButtonItem[] | null {
    const span = editor.findSuggestionSpanAtCursorIndex(
      editor.textEditingValue.selection.baseOffset,
    );
    if (span === null) return null;
    return [
      ...span.suggestions.slice(0, maxSuggestions).map(
        (suggestion) =>
          new ContextMenuButtonItem({
            label: suggestion,
            onPressed: () => editor.replaceSpellCheckSuggestion(span, suggestion),
          }),
      ),
      new ContextMenuButtonItem({
        type: ContextMenuButtonType.delete,
        onPressed: () => editor.replaceSpellCheckSuggestion(span, ''),
      }),
    ];
  }

  override build(context: BuildContext): Widget {
    if (!this.buttonItems.length) return new SizedBox(0, 0);
    const padding = CupertinoTextSelectionToolbar.kToolbarScreenPadding;
    const top = MediaQuery.paddingOf(context).top + padding;
    const bottom = MediaQuery.viewInsetsOf(context).bottom + padding;
    const height =
      defaultToolbarHeight - rowHeight * (maxSuggestions + 1 - this.buttonItems.length);
    const buttons = this.buttonItems.map((item) => {
      const isDelete = item.type === ContextMenuButtonType.delete;
      const text = AdaptiveTextSelectionToolbar.getButtonLabel(context, item);
      const button = new TextSelectionToolbarTextButton({
        padding: EdgeInsets.only({ left: 20 }),
        alignment: Alignment.centerLeft,
        onPressed: item.onPressed,
        child: new Text(text, isDelete ? { style: deleteStyle } : {}),
      });
      return isDelete ? new DecoratedBox(button, { decoration: deleteDivider }) : button;
    });
    const card = new Material({
      type: MaterialType.card,
      elevation: 2,
      child: new SizedBox(
        165,
        height,
        new Column(buttons, { mainAxisSize: 'min', crossAxisAlignment: 'stretch' }),
      ),
    });
    return new Padding(
      EdgeInsets.fromLTRB(padding, top, padding, bottom),
      new CustomSingleChildLayout(
        new AnimatedSize({ duration: 140, child: card }),
        new SpellCheckSuggestionsToolbarLayoutDelegate({
          anchor: { x: this.anchor.x - padding, y: this.anchor.y - top },
        }),
      ),
    );
  }
}
