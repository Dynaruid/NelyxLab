// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from '@nelyx/core/ui/color';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { constEdgeInsetsSymmetric } from '@nelyx/core/internal/framework/painting/edge-insets-source-adapter';
// Source final values deliberately use new Color: identity distinguishes default Icon colors.
export const kDefaultIconLightColor = new Color(0xffffffff);
export const kDefaultIconDarkColor = new Color(0xdd000000);
export const kTabScrollDuration = 300;
export const kTabLabelPadding = constEdgeInsetsSymmetric(EdgeInsets, { horizontal: 16 });
