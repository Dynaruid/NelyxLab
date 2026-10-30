// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatelessWidget, Widget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Row, Flexible } from '@nelyx/core/framework/widgets/basic';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import { IconAlignment } from '../../icon-alignment.ts';
import type { ButtonStyle } from '../../button-style.ts';
export class ButtonIconLabel extends StatelessWidget {
  constructor(
    readonly label: Widget,
    readonly icon: Widget,
    readonly buttonStyle: ButtonStyle | null,
    readonly iconAlignment: IconAlignment | null,
    readonly themeStyle: (context: BuildContext) => ButtonStyle | null,
  ) {
    super();
    if (!(label instanceof Widget) || !(icon instanceof Widget))
      throw new TypeError('Button icon and label require canonical Widget values');
    if (iconAlignment !== null && !IconAlignment.values.includes(iconAlignment))
      throw new TypeError('Button iconAlignment requires a canonical enum value');
  }
  build(context: BuildContext): Widget {
    const defaultFontSize =
        this.buttonStyle?.textStyle?.resolve(emptyWidgetStateSet())?.fontSize ?? 14,
      scale =
        Math.min(2, Math.max(1, MediaQuery.textScalerOf(context).scale(defaultFontSize) / 14)) - 1;
    const alignment =
      this.iconAlignment ??
      this.themeStyle(context)?.iconAlignment ??
      this.buttonStyle?.iconAlignment ??
      IconAlignment.start;
    return new Row(
      alignment === IconAlignment.start
        ? [this.icon, new Flexible(this.label)]
        : [new Flexible(this.label), this.icon],
      { mainAxisSize: 'min', spacing: 8 - 4 * scale },
    );
  }
}
