// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/constants.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { constEdgeInsetsSymmetric } from '@nelyx/core/internal/framework/painting/edge-insets-source-adapter';
import type { CupertinoButtonSize } from './button.ts';

export const kMinInteractiveDimensionCupertino = 44;
export const kCupertinoFocusColorOpacity = 0.8;
export const kCupertinoFocusColorBrightness = 0.69;
export const kCupertinoFocusColorSaturation = 0.835;
export const kCupertinoButtonTintedOpacityLight = 0.12;
export const kCupertinoButtonTintedOpacityDark = 0.26;
export const kCupertinoButtonDefaultIconSize = 20;
export const kCupertinoButtonTapMoveSlop = 70;

export const kCupertinoButtonPadding = Object.freeze({
  small: constEdgeInsetsSymmetric(EdgeInsets, { vertical: 6, horizontal: 12 }),
  medium: constEdgeInsetsSymmetric(EdgeInsets, { vertical: 10, horizontal: 15 }),
  large: constEdgeInsetsSymmetric(EdgeInsets, { vertical: 16, horizontal: 20 }),
} satisfies Record<CupertinoButtonSize, EdgeInsets>);

const capsuleRadius = BorderRadius.circular(40);
export const kCupertinoButtonSizeBorderRadius = Object.freeze({
  small: capsuleRadius,
  medium: capsuleRadius,
  large: BorderRadius.circular(12),
} satisfies Record<CupertinoButtonSize, BorderRadius>);

export const kCupertinoButtonMinSize = Object.freeze({
  small: 28,
  medium: 32,
  large: kMinInteractiveDimensionCupertino,
} satisfies Record<CupertinoButtonSize, number>);
