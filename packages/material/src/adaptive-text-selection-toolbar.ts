// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Platform dispatch and labels from the pinned Material adaptive toolbar.
import { getEditableButtonItems } from '@nelyx/core/framework/widgets/text-selection';
import type { EditableContextMenuOptions } from '@nelyx/core/framework/widgets/text-selection';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { ContextMenuButtonItem, ContextMenuButtonType } from '@nelyx/core/framework/widgets/context-menu-button-item';
import type { TextSelectionToolbarAnchors } from '@nelyx/core/framework/widgets/text-selection-toolbar-anchors';
import { SelectableRegion } from '@nelyx/core/framework/widgets/selectable-region-state';
import type { SelectableRegionState } from '@nelyx/core/framework/widgets/selectable-region-state';
import type { SelectionGeometry } from '@nelyx/core/framework/rendering/selection';
import { Theme } from './theme.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { TextSelectionToolbar } from './text-selection-toolbar.ts';
import { TextSelectionToolbarTextButton } from './text-selection-toolbar-text-button.ts';
import { DesktopTextSelectionToolbar, DesktopTextSelectionToolbarButton } from './desktop-text-selection-toolbar.ts';
import { CupertinoTextSelectionToolbar } from '@nelyx/cupertino/text-selection-toolbar';
import { CupertinoTextSelectionToolbarButton, CupertinoDesktopTextSelectionToolbarButton } from '@nelyx/cupertino/text-selection-toolbar-button';
import { CupertinoDesktopTextSelectionToolbar } from '@nelyx/cupertino/desktop-text-selection-toolbar';
export interface AdaptiveTextSelectionToolbarOptions extends WidgetOptions {
    readonly anchors: TextSelectionToolbarAnchors;
    readonly children?: readonly Widget[];
    readonly buttonItems?: readonly ContextMenuButtonItem[];
}
export class AdaptiveTextSelectionToolbar extends StatelessWidget {
    readonly buttonItems: readonly ContextMenuButtonItem[] | null;
    readonly children: readonly Widget[] | null;
    readonly anchors: TextSelectionToolbarAnchors;
    constructor(options: AdaptiveTextSelectionToolbarOptions) {
        super(options.key ?? null);
        if (!options.anchors || options.children && options.buttonItems)
            throw new Error('Provide anchors and either children or buttonItems');
        this.anchors = options.anchors;
        this.children = options.children ? Object.freeze([...options.children]) : null;
        this.buttonItems = options.buttonItems ? Object.freeze([...options.buttonItems]) : null;
    }
    static buttonItems(options: {
        readonly buttonItems: readonly ContextMenuButtonItem[];
        readonly anchors: TextSelectionToolbarAnchors;
    } & WidgetOptions): AdaptiveTextSelectionToolbar {
        return new AdaptiveTextSelectionToolbar(options);
    }
    static editable({ anchors, key = null, ...options }: EditableContextMenuOptions & {
        readonly anchors: TextSelectionToolbarAnchors;
    } & WidgetOptions): AdaptiveTextSelectionToolbar {
        return new AdaptiveTextSelectionToolbar({
            key, anchors, buttonItems: getEditableButtonItems(options)
        });
    }
    static editableText({ editableTextState, key = null }: {
        readonly editableTextState: {
            readonly contextMenuButtonItems: readonly ContextMenuButtonItem[];
            readonly contextMenuAnchors: TextSelectionToolbarAnchors;
        };
    } & WidgetOptions): AdaptiveTextSelectionToolbar {
        return new AdaptiveTextSelectionToolbar({
            key, anchors: editableTextState.contextMenuAnchors, buttonItems: editableTextState.contextMenuButtonItems
        });
    }
    static selectableRegion({ selectableRegionState, key = null }: {
        readonly selectableRegionState: SelectableRegionState;
    } & WidgetOptions): AdaptiveTextSelectionToolbar {
        return new AdaptiveTextSelectionToolbar({
            key, buttonItems: selectableRegionState.contextMenuButtonItems, anchors: selectableRegionState.contextMenuAnchors
        });
    }
    static selectable({ selectionGeometry, onCopy, onSelectAll, onShare, anchors, key = null }: {
        readonly selectionGeometry: SelectionGeometry;
        readonly onCopy: () => void;
        readonly onSelectAll: () => void;
        readonly onShare: (() => void) | null;
        readonly anchors: TextSelectionToolbarAnchors;
    } & WidgetOptions): AdaptiveTextSelectionToolbar {
        return new AdaptiveTextSelectionToolbar({
            key, anchors, buttonItems: SelectableRegion.getSelectableButtonItems({
                selectionGeometry, onCopy, onSelectAll, onShare
            })
        });
    }
    static getButtonLabel(context: BuildContext, item: ContextMenuButtonItem): string {
        if (item.label !== null)
            return item.label;
        const platform = Theme.of(context).platform;
        if (platform === 'iOS' || platform === 'macOS')
            return CupertinoTextSelectionToolbarButton.getButtonLabel(context, item);
        const l = MaterialLocalizations.of(context);
        switch (item.type.name) {
            case 'cut': return l.cutButtonLabel;
            case 'copy': return l.copyButtonLabel;
            case 'paste': return l.pasteButtonLabel;
            case 'selectAll': return l.selectAllButtonLabel;
            case 'delete': return l.deleteButtonTooltip.toUpperCase();
            case 'lookUp': return l.lookUpButtonLabel;
            case 'searchWeb': return l.searchWebButtonLabel;
            case 'share': return l.shareButtonLabel;
            case 'liveTextInput': return l.scanTextButtonLabel;
            default: return '';
        }
    }
    static getAdaptiveButtons(context: BuildContext, items: readonly ContextMenuButtonItem[]): Widget[] {
        const platform = Theme.of(context).platform;
        return items.map((item, index) => {
            const text = this.getButtonLabel(context, item);
            switch (platform) {
                case 'iOS': return CupertinoTextSelectionToolbarButton.buttonItem({ buttonItem: item });
                case 'macOS': return CupertinoDesktopTextSelectionToolbarButton.text({ onPressed: item.onPressed, text });
                case 'windows':
                case 'linux': return DesktopTextSelectionToolbarButton.text({
                    context, onPressed: item.onPressed, text
                });
                default: {
                    const colors = Theme.of(context).colorScheme, defaultColor = colors.onSurface === (colors.brightness === 'dark' ? 0xffe6e0e9 : 0xff1d1b20);
                    return new TextSelectionToolbarTextButton({
                        label: text, child: new Text(text, { fontSize: 14, color: defaultColor ? (colors.brightness === 'dark' ? 0xffffffff : 0xff000000) : colors.onSurface }), padding: TextSelectionToolbarTextButton.getPadding(index, items.length), alignment: AlignmentDirectional.centerStart, onPressed: item.onPressed
                    });
                }
            }
        });
    }
    build(context: BuildContext): Widget {
        if (!(this.children ?? this.buttonItems)?.length)
            return SizedBox.shrink();
        const children = this.children ?? AdaptiveTextSelectionToolbar.getAdaptiveButtons(context, this.buttonItems!), anchorAbove = this.anchors.primaryAnchor, anchorBelow = this.anchors.secondaryAnchor ?? anchorAbove;
        switch (Theme.of(context).platform) {
            case 'iOS': return new CupertinoTextSelectionToolbar({
                anchorAbove, anchorBelow, children
            });
            case 'android': return new TextSelectionToolbar({
                anchorAbove, anchorBelow, children
            });
            case 'macOS': return new CupertinoDesktopTextSelectionToolbar({ anchor: anchorAbove, children });
            default: return new DesktopTextSelectionToolbar({ anchor: anchorAbove, children });
        }
    }
}
