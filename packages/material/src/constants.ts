// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/constants.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { Color } from '@nelyx/core/ui/color';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { constEdgeInsetsSymmetric } from '@nelyx/core/internal/framework/painting/edge-insets-source-adapter';
// Source final values deliberately use new Color: identity distinguishes default Icon colors.
export const kDefaultIconLightColor = new Color(0xffffffff);
export const kDefaultIconDarkColor = new Color(0xdd000000);
export const kMinInteractiveDimension = 48;
export const kToolbarHeight = 56;
export const kBottomNavigationBarHeight = 56;
export const kTextTabBarHeight = kMinInteractiveDimension;
export const kThemeChangeDuration = 200;
export const kRadialReactionRadius = 20;
export const kRadialReactionDuration = 100;
export const kRadialReactionAlpha = 0x1f;
export const kTabScrollDuration = 300;
export const kTabLabelPadding = constEdgeInsetsSymmetric(EdgeInsets, { horizontal: 16 });
export const kMaterialListPadding = constEdgeInsetsSymmetric(EdgeInsets, { vertical: 8 });
