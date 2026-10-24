// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/two_dimensional_viewport.dart; SHA256 a3bca9a23d5367265ebb00bf6618ac912a74c4b008568ba0d0da1364a66cf69e
import { checkedInteger } from "../../ui/value-math.ts";
import { protect } from "../../ui/value-math.ts";
import { invariant } from "../../foundation/errors.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { hashValues } from "../painting/value-equality.ts";
import { isChildVicinity } from "./child-vicinity-adapter.ts";
import { castChildVicinity } from "./child-vicinity-adapter.ts";
import { constantChildVicinity } from "./child-vicinity-constant.ts";
import { integerString } from "./child-vicinity-adapter.ts";
import type { DartComparable } from "./child-vicinity-adapter.ts";
export class ChildVicinity implements DartComparable<ChildVicinity> {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly xIndex: number;
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly yIndex: number;
    static readonly invalid: ChildVicinity = constantChildVicinity(ChildVicinity, { xIndex: checkedInteger(-1), yIndex: checkedInteger(-1) });
    /**
     * @dartParam xIndex int
     * @dartParamOrigin xIndex inferred
     * @dartParam yIndex int
     * @dartParamOrigin yIndex inferred
     */
    constructor({ xIndex, yIndex }: {
        readonly xIndex: number;
        readonly yIndex: number;
    }) {
        checkedInteger(xIndex);
        checkedInteger(yIndex);
        /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        const _initialField0 = xIndex;
        /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        const _initialField1 = yIndex;
        if (FoundationBuildMode.debug)
            invariant(checkedInteger(xIndex) >= checkedInteger(-1), "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(checkedInteger(yIndex) >= checkedInteger(-1), "generated-source-assert", "Pinned Dart assertion failed");
        this.xIndex = _initialField0;
        this.yIndex = _initialField1;
        protect(this, ["xIndex", "yIndex"]);
    }
    equals(other: {}): boolean {
        return isChildVicinity(other) && checkedInteger(other.xIndex) === checkedInteger(this.xIndex) && checkedInteger(other.yIndex) === checkedInteger(this.yIndex);
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    get hashCode(): number {
        return checkedInteger(hashValues(checkedInteger(this.xIndex), checkedInteger(this.yIndex)));
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    compareTo(other: ChildVicinity): number {
        if (checkedInteger(this.xIndex) === checkedInteger(other.xIndex)) {
            return checkedInteger(checkedInteger(this.yIndex) - checkedInteger(other.yIndex));
        }
        return checkedInteger(checkedInteger(this.xIndex) - checkedInteger(other.xIndex));
    }
    toString(): string {
        return `(xIndex: ${integerString(checkedInteger(this.xIndex))}, yIndex: ${integerString(checkedInteger(this.yIndex))})`;
    }
}
protect(ChildVicinity, ["invalid"]);
