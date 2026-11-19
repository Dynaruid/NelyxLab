// W11 Flutter design source d08309f4409653d8150b6ccfacff6041feb3ace336199fdb647c47f3da6c31a5 SHA256 417e71e1016fd45a9bd1f076e553953e3a0584c3c8c9a66697680618670dcdcb
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/flexible_space_bar.dart; SHA256 45051ac78d4d9ff498c72d58a6194bd747bee325b555957bfdca7d88e69dee90
import { Widget } from "@nelyx/core/framework/widgets/framework";
import { InheritedWidget } from "@nelyx/core/framework/widgets/framework";
import { FoundationBuildMode } from "@nelyx/core/foundation/constants";
import { invariant } from "@nelyx/core/foundation/errors";
import { protect } from "@nelyx/core/internal/ui/value-math";
import type { Key } from "@nelyx/core/foundation/key";
export class FlexibleSpaceBarSettings extends InheritedWidget {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly toolbarOpacity: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly minExtent: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly maxExtent: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly currentExtent: number;
    readonly isScrolledUnder: boolean | null;
    readonly hasLeading: boolean | null;
    /**
     * @dartParam toolbarOpacity double
     * @dartParamOrigin toolbarOpacity inferred
     * @dartParam minExtent double
     * @dartParamOrigin minExtent inferred
     * @dartParam maxExtent double
     * @dartParamOrigin maxExtent inferred
     * @dartParam currentExtent double
     * @dartParamOrigin currentExtent inferred
     */
    constructor({ key = null, toolbarOpacity, minExtent, maxExtent, currentExtent, child, isScrolledUnder = null, hasLeading = null }: {
        readonly key?: Key | null;
        readonly toolbarOpacity: number;
        readonly minExtent: number;
        readonly maxExtent: number;
        readonly currentExtent: number;
        readonly child: Widget;
        readonly isScrolledUnder?: boolean | null;
        readonly hasLeading?: boolean | null;
    }) {
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField0 = toolbarOpacity;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField1 = minExtent;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField2 = maxExtent;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField3 = currentExtent;
        const _initialField4 = isScrolledUnder;
        const _initialField5 = hasLeading;
        if (FoundationBuildMode.debug)
            invariant(minExtent >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(maxExtent >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(currentExtent >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(toolbarOpacity >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(minExtent <= maxExtent, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(minExtent <= currentExtent, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(currentExtent <= maxExtent, "generated-source-assert", "Pinned Dart assertion failed");
        super(child, key);
        this.toolbarOpacity = _initialField0;
        this.minExtent = _initialField1;
        this.maxExtent = _initialField2;
        this.currentExtent = _initialField3;
        this.isScrolledUnder = _initialField4;
        this.hasLeading = _initialField5;
        protect(this, ["toolbarOpacity", "minExtent", "maxExtent", "currentExtent", "isScrolledUnder", "hasLeading"]);
    }
    override updateShouldNotify(oldWidget: FlexibleSpaceBarSettings): boolean {
        if (!(oldWidget instanceof FlexibleSpaceBarSettings))
            throw new TypeError("Invalid covariant argument: oldWidget");
        return this.toolbarOpacity !== oldWidget.toolbarOpacity || this.minExtent !== oldWidget.minExtent || this.maxExtent !== oldWidget.maxExtent || this.currentExtent !== oldWidget.currentExtent || this.isScrolledUnder !== oldWidget.isScrolledUnder || this.hasLeading !== oldWidget.hasLeading;
    }
}
