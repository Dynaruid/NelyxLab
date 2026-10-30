// SPDX-License-Identifier: BSD-3-Clause
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
