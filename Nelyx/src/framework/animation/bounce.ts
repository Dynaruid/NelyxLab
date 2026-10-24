// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/animation/curves.dart; SHA256 ddaa3b239073df731807210d6aa1ef583062ce5b2827b1aa87b4de4725b3f8f9
/**
 * @dartParam t double
 * @dartParamOrigin t explicit
 * @dartReturn double
 * @dartReturnOrigin explicit
 */
export function bounce(t: number): number {
    if (t < 1 / 2.75) {
        return 7.5625 * t * t;
    }
    else if (t < 2 / 2.75) {
        t -= 1.5 / 2.75;
        return 7.5625 * t * t + 0.75;
    }
    else if (t < 2.5 / 2.75) {
        t -= 2.25 / 2.75;
        return 7.5625 * t * t + 0.9375;
    }
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
}
