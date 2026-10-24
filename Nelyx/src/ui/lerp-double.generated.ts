// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from engine/src/flutter/lib/ui/lerp.dart; SHA256 1e6a9e6177c6f2dc770a8725d2f784e6c5af771e9284577d3161b12cba61c626
import { FoundationBuildMode } from "../foundation/constants.ts";
import { invariant } from "../foundation/errors.ts";
import { number } from "./value-math.ts";
/**
 * @dartParam a num?
 * @dartParamOrigin a explicit
 * @dartParam b num?
 * @dartParamOrigin b explicit
 * @dartParam t double
 * @dartParamOrigin t explicit
 * @dartReturn double?
 * @dartReturnOrigin explicit
 */
export function lerpDouble(a: number | null, b: number | null, t: number): number | null {
    if (a === b || ((() => {
        const _dartTemporary0 = a;
        return _dartTemporary0 === null ? null : Number.isNaN(_dartTemporary0);
    })() ?? false) && ((() => {
        const _dartTemporary1 = b;
        return _dartTemporary1 === null ? null : Number.isNaN(_dartTemporary1);
    })() ?? false)) {
        return (() => {
            const _dartTemporary2 = a;
            return _dartTemporary2 === null ? null : number(_dartTemporary2);
        })();
    }
    a ??= 0;
    b ??= 0;
    if (FoundationBuildMode.debug)
        invariant(Number.isFinite(a), "invalid-lerp-double", "Cannot interpolate between finite and non-finite values");
    if (FoundationBuildMode.debug)
        invariant(Number.isFinite(b), "invalid-lerp-double", "Cannot interpolate between finite and non-finite values");
    if (FoundationBuildMode.debug)
        invariant(Number.isFinite(t), "invalid-lerp-double", "t must be finite when interpolating between values");
    return a * (1 - t) + b * t;
}
