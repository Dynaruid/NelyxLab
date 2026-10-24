// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/physics/utils.dart; SHA256 d29be83f4d6e0969183cbb32634d71034c0538e644d819aaefae7f81f07ec62d
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { invariant } from "../../foundation/errors.ts";
/**
 * @dartParam a double?
 * @dartParamOrigin a explicit
 * @dartParam b double?
 * @dartParamOrigin b explicit
 * @dartParam epsilon double
 * @dartParamOrigin epsilon explicit
 */
export function nearEqual(a: number | null, b: number | null, epsilon: number): boolean {
    if (FoundationBuildMode.debug)
        invariant(epsilon >= 0, "invalid-physics-epsilon", "Epsilon must be nonnegative");
    if (a === null || b === null) {
        return a === b;
    }
    return (a > (b - epsilon)) && (a < (b + epsilon)) || a === b;
}
/**
 * @dartParam a double
 * @dartParamOrigin a explicit
 * @dartParam epsilon double
 * @dartParamOrigin epsilon explicit
 */
export function nearZero(a: number, epsilon: number): boolean {
    return nearEqual(a, 0, epsilon);
}
