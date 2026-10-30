// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional palette swatches from Flutter material/colors.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a; bracket lookup is exposed as get().
import type { Color } from '@nelyx/core/ui/color';
import { ColorSwatch } from '@nelyx/core/framework/painting/color-swatch';
import type { ColorSwatchMap } from '@nelyx/core/framework/painting/color-swatch';
abstract class MaterialSwatch extends ColorSwatch<number> {
  constructor(primary: number, swatch: ColorSwatchMap<number>) {
    super(primary, swatch);
    Object.freeze(this);
  }
  protected shade(key: number): Color {
    const color = this.get(key);
    if (color === null) throw new TypeError('Missing Material shade ' + key);
    return color;
  }
}
export class MaterialColor extends MaterialSwatch {
  get shade50(): Color {
    return this.shade(50);
  }
  get shade100(): Color {
    return this.shade(100);
  }
  get shade200(): Color {
    return this.shade(200);
  }
  get shade300(): Color {
    return this.shade(300);
  }
  get shade400(): Color {
    return this.shade(400);
  }
  get shade500(): Color {
    return this.shade(500);
  }
  get shade600(): Color {
    return this.shade(600);
  }
  get shade700(): Color {
    return this.shade(700);
  }
  get shade800(): Color {
    return this.shade(800);
  }
  get shade900(): Color {
    return this.shade(900);
  }
}
export class MaterialAccentColor extends MaterialSwatch {
  get shade100(): Color {
    return this.shade(100);
  }
  get shade200(): Color {
    return this.shade(200);
  }
  get shade400(): Color {
    return this.shade(400);
  }
  get shade700(): Color {
    return this.shade(700);
  }
}
