// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// SelectionArea's stable Region key and callback forwarding from the pinned
// material/selection_area.dart, including the default adaptive magnifier.
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Theme } from './theme.ts';
import { TextMagnifier } from './magnifier.ts';
import { invariant } from '@nelyx/core/foundation/errors';
import { SelectableRegion, SelectableRegionState } from '@nelyx/core/framework/widgets/selectable-region-state';
import type { SelectableRegionContextMenuBuilder } from '@nelyx/core/framework/widgets/selectable-region-state';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { TextSelectionControls } from '@nelyx/core/framework/widgets/text-selection';
import { TextMagnifierConfiguration } from '@nelyx/core/framework/widgets/magnifier';
import type { SelectedContent } from '@nelyx/core/framework/rendering/selection';
import { cupertinoTextSelectionHandleControls, cupertinoDesktopTextSelectionHandleControls } from '@nelyx/cupertino/text-selection';
import { materialTextSelectionHandleControls, desktopTextSelectionHandleControls } from './text-selection.ts';
import { AdaptiveTextSelectionToolbar } from './adaptive-text-selection-toolbar.ts';
export interface SelectionAreaOptions extends WidgetOptions {
    readonly child: Widget;
    readonly focusNode?: FocusNode | null;
    readonly selectionControls?: TextSelectionControls | null;
    readonly contextMenuBuilder?: SelectableRegionContextMenuBuilder | null;
    readonly magnifierConfiguration?: TextMagnifierConfiguration | null;
    readonly onSelectionChanged?: ((content: SelectedContent | null) => void) | null;
}
export class SelectionArea extends StatefulWidget {
    readonly child: Widget;
    readonly focusNode: FocusNode | null;
    readonly selectionControls: TextSelectionControls | null;
    readonly contextMenuBuilder: SelectableRegionContextMenuBuilder | null;
    readonly magnifierConfiguration: TextMagnifierConfiguration | null;
    readonly onSelectionChanged: ((content: SelectedContent | null) => void) | null;
    constructor({ child, focusNode = null, selectionControls = null, contextMenuBuilder = SelectionArea.defaultContextMenuBuilder, magnifierConfiguration = null, onSelectionChanged = null, key = null }: SelectionAreaOptions) {
        super(key);
        this.child = child;
        this.focusNode = focusNode;
        this.selectionControls = selectionControls;
        this.contextMenuBuilder = contextMenuBuilder;
        this.magnifierConfiguration = magnifierConfiguration;
        this.onSelectionChanged = onSelectionChanged;
    }
    private static defaultContextMenuBuilder(_context: BuildContext, selectableRegionState: SelectableRegionState): Widget {
        return AdaptiveTextSelectionToolbar.selectableRegion({ selectableRegionState });
    }
    createState(): SelectionAreaState {
        return new SelectionAreaState();
    }
}
export class SelectionAreaState extends State<SelectionArea> {
    private readonly regionKey = new GlobalKey<SelectableRegionState>();
    get selectableRegion(): SelectableRegionState {
        const state = this.regionKey.currentState;
        invariant(state, 'unmounted-selection-area', 'SelectionArea has no mounted SelectableRegion');
        return state;
    }
    build(context: BuildContext): Widget {
        const platform = Theme.of(context).platform;
        const controls = this.widget.selectionControls ?? (platform === 'iOS' ? cupertinoTextSelectionHandleControls : platform === 'macOS' ? cupertinoDesktopTextSelectionHandleControls : platform === 'android' || platform === 'fuchsia' ? materialTextSelectionHandleControls : desktopTextSelectionHandleControls);
        return new SelectableRegion({
            key: this.regionKey, child: this.widget.child, focusNode: this.widget.focusNode, selectionControls: controls, contextMenuBuilder: this.widget.contextMenuBuilder, magnifierConfiguration: this.widget.magnifierConfiguration ?? TextMagnifier.adaptiveMagnifierConfiguration, onSelectionChanged: this.widget.onSelectionChanged
        });
    }
}
