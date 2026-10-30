// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// theme_data.dart ThemeExtension<T>; callbacks remain subclass-owned value operations.
import { validateThemeType, themeTypeKey } from './internal/theme/theme-types.ts';
import type { ThemeType } from './internal/theme/theme-types.ts';

/** Heterogeneous extension view; typed lookup recovers its self type. */
export interface ThemeExtensionEntry {
  readonly type: object;
  copyWith(): ThemeExtensionEntry;
  /** @dartParam t double */
  lerp(other: never, t: number): ThemeExtensionEntry;
}

export abstract class ThemeExtension<T extends ThemeExtension<T>> implements ThemeExtensionEntry {
  protected constructor(private readonly valueType: ThemeType<T>) {
    validateThemeType(valueType);
  }
  get type(): object {
    return themeTypeKey(this.valueType);
  }
  abstract copyWith(): ThemeExtension<T>;
  /** @dartParam t double */
  abstract lerp(other: ThemeExtension<T> | null, t: number): ThemeExtension<T>;
}
