// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type {
  ControlInteractionOptions,
  ControlVisualState,
} from '@nelyx/core/framework/widgets/control-interaction';
import { Color } from '@nelyx/core/ui/color';
export function disabledColor(color: Color, disabled: boolean): Color {
  return disabled ? color.withAlpha(Math.round(color.alpha * 0.5)) : color;
}
export type BaseOptions = Omit<
  ControlInteractionOptions,
  'onPressed' | 'selected' | 'semantics' | 'gestures' | 'onLongPress'
>;
export function reaction(state: ControlVisualState): number {
  return state.pressed ? 0.1 : state.showFocusHighlight ? 0.1 : state.showHoverHighlight ? 0.08 : 0;
}
