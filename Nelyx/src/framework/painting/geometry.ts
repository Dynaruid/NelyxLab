// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/painting/geometry.dart; SHA256 b8ed3676e7f779585f5679497b95ef31b01abe2e17fff9691b60a23077cd8649
import { Offset } from "../../ui/offset.ts";
import type { Size } from "../../ui/geometry.ts";
import { clampDouble } from "../../ui/math.ts";
import { castSourceDartDouble } from "../../foundation/dart-numeric.ts";
import { boxSourceDartDouble } from "../../foundation/dart-numeric.ts";
import { minSourceDartNum } from "../../foundation/dart-numeric-math.ts";
import { maxSourceDartNum } from "../../foundation/dart-numeric-math.ts";
/**
 * @dartParam verticalOffset double
 * @dartParamOrigin verticalOffset explicit
 * @dartParam margin double
 * @dartParamOrigin margin explicit
 */
export function positionDependentBox({ size, childSize, target, preferBelow, verticalOffset = 0, margin = 10 }: {
    readonly size: Size;
    readonly childSize: Size;
    readonly target: Offset;
    readonly preferBelow: boolean;
    readonly verticalOffset?: number;
    readonly margin?: number;
}): Offset {
    const fitsBelow: boolean = target.dy + verticalOffset + childSize.height <= size.height - margin;
    const fitsAbove: boolean = target.dy - verticalOffset - childSize.height >= margin;
    const tooltipBelow: boolean = fitsAbove === fitsBelow ? preferBelow : fitsBelow;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    let y: number;
    if (tooltipBelow) {
        y = castSourceDartDouble(minSourceDartNum(boxSourceDartDouble(target.dy + verticalOffset), boxSourceDartDouble(size.height - margin)));
    }
    else {
        y = castSourceDartDouble(maxSourceDartNum(boxSourceDartDouble(target.dy - verticalOffset - childSize.height), boxSourceDartDouble(margin)));
    }
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const flexibleSpace: number = size.width - childSize.width;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const x: number = flexibleSpace <= 2 * margin ? flexibleSpace / 2 : clampDouble(target.dx - childSize.width / 2, margin, flexibleSpace - margin);
    return new Offset(x, y);
}
