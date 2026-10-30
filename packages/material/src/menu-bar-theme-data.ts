// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { MenuStyle } from './menu-style.ts';
import { MenuThemeData } from './menu-theme-data.ts';
export interface MenuBarThemeDataOptions {
  readonly style?: MenuStyle | null;
}
export class MenuBarThemeData extends MenuThemeData {
  constructor(options: MenuBarThemeDataOptions = {}) {
    super({ style: options.style ?? null });
    if (new.target === MenuBarThemeData) Object.freeze(this);
  }
  /** @dartParam t double */
  static override lerp(
    a: MenuBarThemeData | null,
    b: MenuBarThemeData | null,
    t: number,
  ): MenuBarThemeData | null {
    if (a === b) {
      return a;
    }
    return new MenuBarThemeData({
      style: MenuStyle.lerp(a?.style ?? null, b?.style ?? null, t),
    });
  }
}
