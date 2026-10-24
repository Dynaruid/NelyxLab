// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { ControlInteractionOptions, ControlVisualState } from '@nelyx/core/framework/widgets/control-interaction';
export type BaseOptions = Omit<ControlInteractionOptions, 'onPressed' | 'selected' | 'semantics' | 'gestures' | 'onLongPress'>;
export function reaction(state: ControlVisualState): number {
    return state.pressed ? .1 : state.showFocusHighlight ? .1 : state.showHoverHighlight ? .08 : 0;
}
