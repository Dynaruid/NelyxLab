// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter packages/flutter/lib/src/material/slider_theme.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { SliderThemeData } from './slider-theme-data.ts';
export {
  SliderThemeData,
  ShowValueIndicator,
  Thumb,
  SliderInteraction,
} from './slider-theme-data.ts';
export type { SliderThemeOptions } from './slider-theme-data.ts';

/** Formats the slider's value for assistive technology. */
export type SemanticFormatterCallback = (value: number) => string;

const emptyTheme = new SliderThemeData();
export class SliderTheme extends InheritedTheme {
  constructor(
    readonly data: SliderThemeData,
    child: Widget,
  ) {
    super(child);
  }
  static of(context: BuildContext): SliderThemeData {
    return context.maybeDependOn(SliderTheme)?.data ?? Theme.of(context).sliderTheme ?? emptyTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new SliderTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
