// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { AnimationStyle } from '@nelyx/core/framework/animation/animation-style';
export interface ChipAnimationStyleOptions {
    readonly enableAnimation?: AnimationStyle | null;
    readonly selectAnimation?: AnimationStyle | null;
    readonly avatarDrawerAnimation?: AnimationStyle | null;
    readonly deleteDrawerAnimation?: AnimationStyle | null;
}
export class ChipAnimationStyle {
    readonly enableAnimation: AnimationStyle | null;
    readonly selectAnimation: AnimationStyle | null;
    readonly avatarDrawerAnimation: AnimationStyle | null;
    readonly deleteDrawerAnimation: AnimationStyle | null;
    constructor({ enableAnimation = null, selectAnimation = null, avatarDrawerAnimation = null, deleteDrawerAnimation = null }: ChipAnimationStyleOptions = {}) {
        this.enableAnimation = enableAnimation;
        this.selectAnimation = selectAnimation;
        this.avatarDrawerAnimation = avatarDrawerAnimation;
        this.deleteDrawerAnimation = deleteDrawerAnimation;
    }
}
