// W11 Flutter design source 958f4cc7037a3fa9cee25db38206f303f8e3a7dd43376f6005427e9e85de8e85 SHA256 f07c3d5419e3a169006a8f6a4171cf00da9fc129a73287b8d568f2a06820891a
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/scaffold.dart; SHA256 c8b4f9850f411dcaa33d0535e39f3fba176e8aa3f215d10c5f4f446ec3b52d0d
import { EdgeInsets } from "@nelyx/core/framework/painting/edge-insets";
import { protect } from "@nelyx/core/internal/ui/value-math";
import type { Size } from "@nelyx/core/ui/size";
import type { TextDirection } from "@nelyx/core/ui/typography";
export class ScaffoldPrelayoutGeometry {
    readonly floatingActionButtonSize: Size;
    readonly bottomSheetSize: Size;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly contentBottom: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly contentTop: number;
    readonly minInsets: EdgeInsets;
    readonly minViewPadding: EdgeInsets;
    readonly scaffoldSize: Size;
    readonly snackBarSize: Size;
    readonly materialBannerSize: Size;
    readonly textDirection: TextDirection;
    /**
     * @dartParam contentBottom double
     * @dartParamOrigin contentBottom inferred
     * @dartParam contentTop double
     * @dartParamOrigin contentTop inferred
     */
    constructor({ bottomSheetSize, contentBottom, contentTop, floatingActionButtonSize, minInsets, minViewPadding, scaffoldSize, snackBarSize, materialBannerSize, textDirection }: {
        readonly bottomSheetSize: Size;
        readonly contentBottom: number;
        readonly contentTop: number;
        readonly floatingActionButtonSize: Size;
        readonly minInsets: EdgeInsets;
        readonly minViewPadding: EdgeInsets;
        readonly scaffoldSize: Size;
        readonly snackBarSize: Size;
        readonly materialBannerSize: Size;
        readonly textDirection: TextDirection;
    }) {
        const _initialField0 = bottomSheetSize;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField1 = contentBottom;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField2 = contentTop;
        const _initialField3 = floatingActionButtonSize;
        const _initialField4 = minInsets;
        const _initialField5 = minViewPadding;
        const _initialField6 = scaffoldSize;
        const _initialField7 = snackBarSize;
        const _initialField8 = materialBannerSize;
        const _initialField9 = textDirection;
        this.floatingActionButtonSize = _initialField3;
        this.bottomSheetSize = _initialField0;
        this.contentBottom = _initialField1;
        this.contentTop = _initialField2;
        this.minInsets = _initialField4;
        this.minViewPadding = _initialField5;
        this.scaffoldSize = _initialField6;
        this.snackBarSize = _initialField7;
        this.materialBannerSize = _initialField8;
        this.textDirection = _initialField9;
        protect(this, ["floatingActionButtonSize", "bottomSheetSize", "contentBottom", "contentTop", "minInsets", "minViewPadding", "scaffoldSize", "snackBarSize", "materialBannerSize", "textDirection"]);
    }
}
