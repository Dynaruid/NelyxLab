// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { ConstrainedBox, Padding, Align } from '@nelyx/core/framework/widgets/basic';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
export interface TextSelectionToolbarTextButtonOptions extends WidgetOptions {
    readonly child: Widget;
    readonly padding: EdgeInsetsGeometry;
    readonly onPressed?: (() => void) | null;
    readonly alignment?: AlignmentGeometry | null;
    readonly label?: string;
}
export class TextSelectionToolbarTextButton extends StatelessWidget {
    readonly child: Widget;
    readonly padding: EdgeInsetsGeometry;
    readonly onPressed: (() => void) | null;
    readonly alignment: AlignmentGeometry | null;
    readonly label: string;
    constructor({ key = null, child, padding, onPressed = null, alignment = null, label = '' }: TextSelectionToolbarTextButtonOptions) {
        super(key);
        this.child = child;
        this.padding = padding;
        this.onPressed = onPressed;
        this.alignment = alignment;
        this.label = label;
    }
    static getPadding(index: number, total: number): EdgeInsetsGeometry {
        if (!(total > 0 && index >= 0 && index < total))
            throw new Error('Invalid toolbar button index');
        return EdgeInsetsDirectional.only({ start: index === 0 ? 14.5 : 9.5, end: index === total - 1 ? 14.5 : 9.5 });
    }
    copyWith(options: Partial<TextSelectionToolbarTextButtonOptions> = {}): TextSelectionToolbarTextButton {
        return new TextSelectionToolbarTextButton({
            child: options.child ?? this.child, padding: options.padding ?? this.padding, onPressed: options.onPressed ?? this.onPressed, alignment: options.alignment ?? this.alignment, label: options.label ?? this.label
        });
    }
    build(_context: BuildContext): Widget {
        const body = new GestureDetector(new ConstrainedBox(new Padding(this.padding, new Align(this.child, {
            ...(this.alignment ? { alignment: this.alignment } : {}), widthFactor: 1, heightFactor: 1
        })), new BoxConstraints(48, Infinity, 48)), {
            ...(this.onPressed ? { onTap: this.onPressed } : {}), excludeFromSemantics: true, behavior: HitTestBehavior.opaque
        });
        return new Semantics({
            button: true, label: this.label, enabled: this.onPressed !== null, onTap: this.onPressed, excludeSemantics: true, child: body
        });
    }
}
