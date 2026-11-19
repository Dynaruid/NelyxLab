// W11 Flutter design source b11e46be80c5a6715d66554fb8f2de69242cd76eaa96cc20eb9e6e84efbe7580 SHA256 e2f71f8336ad44c65c49747583a31646c2217b4eab28d111a6f8e6532d6ae186
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/elevation_overlay.dart; SHA256 9b3bf1c4f203abf6285ecfbfb7fa79eb78550c4122f29519452d7d979174937d
import { protect } from "@nelyx/core/internal/ui/value-math";
export class _ElevationOpacity {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly elevation: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly opacity: number;
    /**
     * @dartParam elevation double
     * @dartParamOrigin elevation inferred
     * @dartParam opacity double
     * @dartParamOrigin opacity inferred
     */
    constructor(elevation: number, opacity: number) {
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField0 = elevation;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField1 = opacity;
        this.elevation = _initialField0;
        this.opacity = _initialField1;
        protect(this, ["elevation", "opacity"]);
    }
}
