// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/context_menu.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { Color } from '@nelyx/core/ui/color';
import { CupertinoDynamicColor } from '../colors.ts';

export const contextMenuBackground = CupertinoDynamicColor.withBrightness({
  color: new Color(0xfff1f1f1),
  darkColor: new Color(0xff212122),
});
export const contextMenuSeparator = CupertinoDynamicColor.withBrightness({
  color: new Color(0xffa9a9af),
  darkColor: new Color(0xff57585a),
});
export const contextMenuPreviewShadows = Object.freeze([
  new BoxShadow({ color: 0x40000000, blurRadius: 10, spreadRadius: 0.5 }),
]);
