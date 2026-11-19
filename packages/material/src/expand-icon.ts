// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/expand_icon.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { Curves } from '@nelyx/core/framework/animation/curves';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { AnimatedRotation } from '@nelyx/core/framework/widgets/implicit-animations';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import type { Color } from '@nelyx/core/ui/color';
import { Colors } from './colors.ts';
import { kThemeChangeDuration } from './constants.ts';
import { debugCheckHasMaterial, debugCheckHasMaterialLocalizations } from './debug.ts';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { Theme } from './theme.ts';

export interface ExpandIconOptions extends WidgetOptions {
  readonly isExpanded?: boolean;
  readonly size?: number;
  readonly onPressed: ((isExpanded: boolean) => void) | null;
  readonly padding?: EdgeInsetsGeometry;
  readonly color?: Color | null;
  readonly disabledColor?: Color | null;
  readonly expandedColor?: Color | null;
  readonly splashColor?: Color | null;
  readonly highlightColor?: Color | null;
}

const expandPadding = EdgeInsets.all(8);
export class ExpandIcon extends StatelessWidget {
  readonly options: Readonly<ExpandIconOptions>;

  constructor(options: ExpandIconOptions) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }

  override build(context: BuildContext): Widget {
    debugCheckHasMaterial(context);
    debugCheckHasMaterialLocalizations(context);
    const {
      isExpanded = false,
      onPressed,
      size = 24,
      padding = expandPadding,
      expandedColor,
      color,
      disabledColor = null,
      highlightColor = null,
      splashColor = null,
    } = this.options;
    const localizations = MaterialLocalizations.of(context);
    const hint = isExpanded
      ? localizations.expandedIconTapHint
      : localizations.collapsedIconTapHint;
    return new Semantics({
      onTapHint: onPressed ? hint : null,
      child: new IconButton({
        onPressed: onPressed ? () => onPressed(isExpanded) : null,
        padding,
        iconSize: size,
        color:
          (isExpanded ? expandedColor : null) ??
          color ??
          (Theme.of(context).brightness === 'dark' ? Colors.white60 : Colors.black54),
        disabledColor,
        splashColor,
        highlightColor,
        icon: new AnimatedRotation({
          turns: isExpanded ? 0.5 : 0,
          duration: kThemeChangeDuration,
          curve: Curves.fastOutSlowIn,
          child: new Icon(Icons.expand_more),
        }),
      }),
    });
  }
}
