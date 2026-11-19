// W11 Flutter design source 069f5d8d365f32eaf31b53d894d705be7ecb4e12087d9246f36d6aadd189959b SHA256 0b2c5406d36d309182727e952cc4c3fa39b050d12c17425ed6cd0038eabd22b3
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/dropdown.dart; SHA256 ef267144982532fa442dea2892a1724f1d429b8a56999272a25be1f501fd3bd5
import { protect } from "@nelyx/core/internal/ui/value-math";
export class _MenuLimits {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly top: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly bottom: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly height: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly scrollOffset: number;
    /**
     * @dartParam top double
     * @dartParamOrigin top inferred
     * @dartParam bottom double
     * @dartParamOrigin bottom inferred
     * @dartParam height double
     * @dartParamOrigin height inferred
     * @dartParam scrollOffset double
     * @dartParamOrigin scrollOffset inferred
     */
    constructor(top: number, bottom: number, height: number, scrollOffset: number) {
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField0 = top;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField1 = bottom;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField2 = height;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField3 = scrollOffset;
        this.top = _initialField0;
        this.bottom = _initialField1;
        this.height = _initialField2;
        this.scrollOffset = _initialField3;
        protect(this, ["top", "bottom", "height", "scrollOffset"]);
    }
}
