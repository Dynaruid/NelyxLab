// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/cupertino_focus_halo.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { BorderRadiusGeometry } from '@nelyx/core/framework/painting/border-radius';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import { DecoratedBox } from '@nelyx/core/framework/widgets/basic';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { CupertinoColors } from './colors.ts';
import { cupertinoFocusOutlineColor } from './internal/toggle/control-values.ts';

export interface CupertinoFocusHaloOptions extends WidgetOptions {
  readonly child: Widget;
}

export interface CupertinoRoundedFocusHaloOptions extends CupertinoFocusHaloOptions {
  readonly borderRadius: BorderRadiusGeometry;
}

export class CupertinoFocusHalo extends StatefulWidget {
  private constructor(
    options: CupertinoRoundedFocusHaloOptions,
    readonly usesSuperellipse: boolean,
  ) {
    super(options.key ?? null);
    this.child = options.child;
    this.borderRadius = options.borderRadius;
  }
  readonly child: Widget;
  readonly borderRadius: BorderRadiusGeometry;

  static withRect(options: CupertinoFocusHaloOptions): CupertinoFocusHalo {
    return this.withRRect({ ...options, borderRadius: BorderRadius.zero });
  }
  static withRRect(options: CupertinoRoundedFocusHaloOptions): CupertinoFocusHalo {
    return new CupertinoFocusHalo(options, false);
  }
  static withRoundedSuperellipse(options: CupertinoRoundedFocusHaloOptions): CupertinoFocusHalo {
    return new CupertinoFocusHalo(options, true);
  }
  override createState(): State<CupertinoFocusHalo> {
    return new CupertinoFocusHaloState();
  }
}

class CupertinoFocusHaloState extends State<CupertinoFocusHalo> {
  private childHasFocus = false;

  override build(): Widget {
    const { child, borderRadius, usesSuperellipse } = this.widget;
    const side = this.childHasFocus
      ? new BorderSide({
          color: cupertinoFocusOutlineColor(CupertinoColors.activeBlue).toARGB32(),
          width: 3.5,
        })
      : BorderSide.none;
    const shape = usesSuperellipse
      ? new RoundedSuperellipseBorder({ side, borderRadius })
      : new RoundedRectangleBorder({ side, borderRadius });
    return new Focus(
      new DecoratedBox(child, {
        decoration: new ColorShapeDecoration(shape, null),
        position: 'foreground',
      }),
      {
        canRequestFocus: false,
        skipTraversal: true,
        includeSemantics: false,
        onFocusChange: (focused) => {
          if (this.mounted && this.childHasFocus !== focused)
            this.setState(() => {
              this.childHasFocus = focused;
            });
        },
      },
    );
  }
}
