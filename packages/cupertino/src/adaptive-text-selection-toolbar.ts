// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { getEditableButtonItems } from '@nelyx/core/framework/widgets/text-selection';
import type { EditableContextMenuOptions } from '@nelyx/core/framework/widgets/text-selection';
import type { ContextMenuButtonItem } from '@nelyx/core/framework/widgets/context-menu-button-item';
import type { TextSelectionToolbarAnchors } from '@nelyx/core/framework/widgets/text-selection-toolbar-anchors';
import { SelectableRegion } from '@nelyx/core/framework/widgets/selectable-region-state';
import type { SelectionGeometry } from '@nelyx/core/framework/rendering/selection';
import { CupertinoTextSelectionToolbar } from './text-selection-toolbar.ts';
import { CupertinoDesktopTextSelectionToolbar } from './desktop-text-selection-toolbar.ts';
import {
  CupertinoTextSelectionToolbarButton,
  CupertinoDesktopTextSelectionToolbarButton,
} from './text-selection-toolbar-button.ts';
export interface CupertinoAdaptiveTextSelectionToolbarOptions extends WidgetOptions {
  readonly anchors: TextSelectionToolbarAnchors;
  readonly children?: readonly Widget[];
  readonly buttonItems?: readonly ContextMenuButtonItem[];
}
export class CupertinoAdaptiveTextSelectionToolbar extends StatelessWidget {
  readonly anchors: TextSelectionToolbarAnchors;
  readonly children: readonly Widget[] | null;
  readonly buttonItems: readonly ContextMenuButtonItem[] | null;
  constructor({
    key = null,
    anchors,
    children,
    buttonItems,
  }: CupertinoAdaptiveTextSelectionToolbarOptions) {
    super(key);
    if (children && buttonItems) throw new Error('Provide either children or buttonItems');
    this.anchors = anchors;
    this.children = children ? Object.freeze([...children]) : null;
    this.buttonItems = buttonItems ? Object.freeze([...buttonItems]) : null;
  }
  static buttonItems(
    options: {
      readonly anchors: TextSelectionToolbarAnchors;
      readonly buttonItems: readonly ContextMenuButtonItem[];
    } & WidgetOptions,
  ): CupertinoAdaptiveTextSelectionToolbar {
    return new CupertinoAdaptiveTextSelectionToolbar(options);
  }
  static editable({
    anchors,
    key = null,
    ...options
  }: EditableContextMenuOptions & {
    readonly anchors: TextSelectionToolbarAnchors;
  } & WidgetOptions): CupertinoAdaptiveTextSelectionToolbar {
    return new CupertinoAdaptiveTextSelectionToolbar({
      key,
      anchors,
      buttonItems: getEditableButtonItems(options),
    });
  }
  static editableText({
    editableTextState,
    key = null,
  }: {
    readonly editableTextState: {
      readonly contextMenuButtonItems: readonly ContextMenuButtonItem[];
      readonly contextMenuAnchors: TextSelectionToolbarAnchors;
    };
  } & WidgetOptions): CupertinoAdaptiveTextSelectionToolbar {
    return new CupertinoAdaptiveTextSelectionToolbar({
      key,
      anchors: editableTextState.contextMenuAnchors,
      buttonItems: editableTextState.contextMenuButtonItems,
    });
  }
  static selectable({
    selectionGeometry,
    onCopy,
    onSelectAll,
    anchors,
    key = null,
  }: {
    readonly selectionGeometry: SelectionGeometry;
    readonly onCopy: () => void;
    readonly onSelectAll: () => void;
    readonly anchors: TextSelectionToolbarAnchors;
  } & WidgetOptions): CupertinoAdaptiveTextSelectionToolbar {
    return new CupertinoAdaptiveTextSelectionToolbar({
      key,
      anchors,
      buttonItems: SelectableRegion.getSelectableButtonItems({
        selectionGeometry,
        onCopy,
        onSelectAll,
        onShare: null,
      }),
    });
  }
  private static get mobile(): boolean {
    return ['android', 'iOS', 'fuchsia'].includes(FoundationPlatform.defaultTargetPlatform);
  }
  static getAdaptiveButtons(
    _context: BuildContext,
    items: readonly ContextMenuButtonItem[],
  ): Widget[] {
    return items.map((buttonItem) =>
      this.mobile
        ? CupertinoTextSelectionToolbarButton.buttonItem({ buttonItem })
        : CupertinoDesktopTextSelectionToolbarButton.buttonItem({ buttonItem }),
    );
  }
  build(context: BuildContext): Widget {
    if (!(this.children ?? this.buttonItems)?.length) return SizedBox.shrink();
    const children =
      this.children ??
      CupertinoAdaptiveTextSelectionToolbar.getAdaptiveButtons(context, this.buttonItems!);
    return CupertinoAdaptiveTextSelectionToolbar.mobile
      ? new CupertinoTextSelectionToolbar({
          anchorAbove: this.anchors.primaryAnchor,
          anchorBelow: this.anchors.secondaryAnchor ?? this.anchors.primaryAnchor,
          children,
        })
      : new CupertinoDesktopTextSelectionToolbar({ anchor: this.anchors.primaryAnchor, children });
  }
}
