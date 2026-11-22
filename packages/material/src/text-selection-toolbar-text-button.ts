// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/text_selection_toolbar_text_button.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import { ContextMenuButtonFocus } from '@nelyx/core/framework/widgets/context-menu-controller';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { Color } from '@nelyx/core/ui/color';
import { Size } from '@nelyx/core/ui/size';
import { FontWeight } from '@nelyx/core/ui/typography';
import { kMinInteractiveDimension } from './constants.ts';
import { defaultMaterialColorScheme } from './internal/theme/default-color-schemes.ts';
import { TextButton } from './text-button.ts';
import { Theme } from './theme.ts';
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
  constructor({
    key = null,
    child,
    padding,
    onPressed = null,
    alignment = null,
    label = '',
  }: TextSelectionToolbarTextButtonOptions) {
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
    return EdgeInsetsDirectional.only({
      start: index === 0 ? 14.5 : 9.5,
      end: index === total - 1 ? 14.5 : 9.5,
    });
  }
  copyWith(
    options: Partial<TextSelectionToolbarTextButtonOptions> = {},
  ): TextSelectionToolbarTextButton {
    return new TextSelectionToolbarTextButton({
      child: options.child ?? this.child,
      padding: options.padding ?? this.padding,
      onPressed: options.onPressed ?? this.onPressed,
      alignment: options.alignment ?? this.alignment,
      label: options.label ?? this.label,
    });
  }
  build(context: BuildContext): Widget {
    const { brightness, onSurface } = Theme.of(context).colorScheme;
    const foreground =
      onSurface === defaultMaterialColorScheme(brightness).onSurface
        ? brightness === 'dark'
          ? 0xffffffff
          : 0xff000000
        : onSurface;
    return new ContextMenuButtonFocus(
      new TextButton({
        onPressed: this.onPressed,
        child: this.child,
        ...(this.label ? { semanticsLabel: this.label } : {}),
        style: TextButton.styleFrom({
          backgroundColor: new Color(0),
          foregroundColor: new Color(foreground),
          shape: new RoundedRectangleBorder(),
          minimumSize: new Size(kMinInteractiveDimension, kMinInteractiveDimension),
          padding: this.padding,
          alignment: this.alignment,
          textStyle: new TextStyle({ fontWeight: FontWeight.w400 }),
        }),
      }),
      this.onPressed,
    );
  }
}
