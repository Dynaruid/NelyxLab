// W11 Flutter design source db31c5e260338979cbd3852d1f4a31b27a0ae14bcfad3591aca49737e8e98799 SHA256 2593fbf23fed2e27747ce7f7564cd677b68de7c86dec2125ed288ef15e97002e
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/chip.dart; SHA256 685691ad192ff45be1d81c82b2bda38e76784c30310c80daf9853a3815c3b93d
import { protect } from "@nelyx/core/internal/ui/value-math";
import type { Offset } from "@nelyx/core/ui/offset";
import type { Size } from "@nelyx/core/ui/size";
import type { BoxConstraints } from "@nelyx/core/framework/rendering/constraints";
export class _ChipSizes {
    readonly size: Size;
    readonly overall: Size;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly content: number;
    readonly avatar: Size;
    readonly labelConstraints: BoxConstraints;
    readonly label: Size;
    readonly deleteIcon: Size;
    readonly densityAdjustment: Offset;
    /**
     * @dartParam content double
     * @dartParamOrigin content inferred
     */
    constructor({ size, overall, content, avatar, labelConstraints, label, deleteIcon, densityAdjustment }: {
        readonly size: Size;
        readonly overall: Size;
        readonly content: number;
        readonly avatar: Size;
        readonly labelConstraints: BoxConstraints;
        readonly label: Size;
        readonly deleteIcon: Size;
        readonly densityAdjustment: Offset;
    }) {
        const _initialField0 = size;
        const _initialField1 = overall;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField2 = content;
        const _initialField3 = avatar;
        const _initialField4 = labelConstraints;
        const _initialField5 = label;
        const _initialField6 = deleteIcon;
        const _initialField7 = densityAdjustment;
        this.size = _initialField0;
        this.overall = _initialField1;
        this.content = _initialField2;
        this.avatar = _initialField3;
        this.labelConstraints = _initialField4;
        this.label = _initialField5;
        this.deleteIcon = _initialField6;
        this.densityAdjustment = _initialField7;
        protect(this, ["size", "overall", "content", "avatar", "labelConstraints", "label", "deleteIcon", "densityAdjustment"]);
    }
}
