// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/list_wheel_scroll_view.dart; SHA256 6e6a545ed8eb253a4980888bbddd67da3989f9c9c218c70816f8ac28eb42484e
import { FixedScrollMetrics } from "./scroll-metrics.ts";
import { WheelPosition } from "./list-wheel-physics-adapter.ts";
import { isWheelContext } from "./list-wheel-position-adapter.ts";
import { castWheelContext } from "./list-wheel-position-adapter.ts";
import { wheelContextItemExtent } from "./list-wheel-position-adapter.ts";
import { _getItemFromOffset } from "./list-wheel-physics.generated.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { invariant } from "../../foundation/errors.ts";
import { checkedInteger } from "../../ui/value-math.ts";
import { protect } from "../../ui/value-math.ts";
import type { ScrollPhysics } from "./scroll-physics.ts";
import type { ScrollPosition } from "./scroll-position.ts";
import type { ScrollContext } from "./scroll-context.ts";
import type { AxisDirection } from "../painting/basic-types.ts";
import type { WheelMetricsData } from "./list-wheel-position-adapter.ts";
export class SourceFixedExtentMetrics extends FixedScrollMetrics {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly itemIndex: number;
    /**
     * @dartParam minScrollExtent double?
     * @dartParamOrigin minScrollExtent inferred
     * @dartParam maxScrollExtent double?
     * @dartParamOrigin maxScrollExtent inferred
     * @dartParam pixels double?
     * @dartParamOrigin pixels inferred
     * @dartParam viewportDimension double?
     * @dartParamOrigin viewportDimension inferred
     * @dartParam itemIndex int
     * @dartParamOrigin itemIndex inferred
     * @dartParam devicePixelRatio double
     * @dartParamOrigin devicePixelRatio inferred
     */
    constructor({ minScrollExtent, maxScrollExtent, pixels, viewportDimension, axisDirection, itemIndex, devicePixelRatio }: {
        readonly minScrollExtent: number | null;
        readonly maxScrollExtent: number | null;
        readonly pixels: number | null;
        readonly viewportDimension: number | null;
        readonly axisDirection: AxisDirection;
        readonly itemIndex: number;
        readonly devicePixelRatio: number;
    }) {
        checkedInteger(itemIndex);
        /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        const _initialField0 = itemIndex;
        super({ minScrollExtent: minScrollExtent, maxScrollExtent: maxScrollExtent, pixels: pixels, viewportDimension: viewportDimension, axisDirection: axisDirection, devicePixelRatio: devicePixelRatio });
        this.itemIndex = _initialField0;
        protect(this, ["itemIndex"]);
    }
    /**
     * @dartParam minScrollExtent double?
     * @dartParamOrigin minScrollExtent explicit
     * @dartParam maxScrollExtent double?
     * @dartParamOrigin maxScrollExtent explicit
     * @dartParam pixels double?
     * @dartParamOrigin pixels explicit
     * @dartParam viewportDimension double?
     * @dartParamOrigin viewportDimension explicit
     * @dartParam itemIndex int?
     * @dartParamOrigin itemIndex explicit
     * @dartParam devicePixelRatio double?
     * @dartParamOrigin devicePixelRatio explicit
     */
    copyWith({ minScrollExtent = null, maxScrollExtent = null, pixels = null, viewportDimension = null, axisDirection = null, itemIndex = null, devicePixelRatio = null }: {
        readonly minScrollExtent?: number | null;
        readonly maxScrollExtent?: number | null;
        readonly pixels?: number | null;
        readonly viewportDimension?: number | null;
        readonly axisDirection?: AxisDirection | null;
        readonly itemIndex?: number | null;
        readonly devicePixelRatio?: number | null;
    } = {}): SourceFixedExtentMetrics {
        if (itemIndex !== null)
            checkedInteger(itemIndex);
        return new SourceFixedExtentMetrics({ minScrollExtent: minScrollExtent ?? (this.hasContentDimensions ? this.minScrollExtent : null), maxScrollExtent: maxScrollExtent ?? (this.hasContentDimensions ? this.maxScrollExtent : null), pixels: pixels ?? (this.hasPixels ? this.pixels : null), viewportDimension: viewportDimension ?? (this.hasViewportDimension ? this.viewportDimension : null), axisDirection: axisDirection ?? this.axisDirection, itemIndex: checkedInteger(itemIndex ?? checkedInteger(this.itemIndex)), devicePixelRatio: devicePixelRatio ?? this.devicePixelRatio });
    }
}
export class GeneratedFixedExtentScrollPosition extends WheelPosition implements WheelMetricsData {
    /**
     * @dartParam initialItem int
     * @dartParamOrigin initialItem explicit
     */
    constructor({ physics, context, initialItem, oldPosition = null, keepScrollOffset = true, debugLabel = null }: {
        readonly physics: ScrollPhysics;
        readonly context: ScrollContext;
        readonly initialItem: number;
        readonly oldPosition?: ScrollPosition | null;
        readonly keepScrollOffset?: boolean;
        readonly debugLabel?: string | null;
    }) {
        checkedInteger(initialItem);
        if (FoundationBuildMode.debug)
            invariant(isWheelContext(context), "invalid-wheel-position", "FixedExtentScrollController can only be used with ListWheelScrollViews");
        super({ initialPixels: GeneratedFixedExtentScrollPosition._dart_7b25c3dc43b1ced7_getItemExtentFromScrollContext(context) * checkedInteger(initialItem), physics: physics, context: context, oldPosition: oldPosition, keepScrollOffset: keepScrollOffset, debugLabel: debugLabel });
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    static _dart_7b25c3dc43b1ced7_getItemExtentFromScrollContext(context: ScrollContext): number {
        const scrollable: ScrollContext = castWheelContext(context);
        return wheelContextItemExtent(scrollable);
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get itemExtent(): number {
        return GeneratedFixedExtentScrollPosition._dart_7b25c3dc43b1ced7_getItemExtentFromScrollContext(this.context);
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    get itemIndex(): number {
        return checkedInteger(_getItemFromOffset({ offset: this.pixels, itemExtent: this.itemExtent, minScrollExtent: this.minScrollExtent, maxScrollExtent: this.maxScrollExtent }));
    }
    /**
     * @dartParam minScrollExtent double?
     * @dartParamOrigin minScrollExtent explicit
     * @dartParam maxScrollExtent double?
     * @dartParamOrigin maxScrollExtent explicit
     * @dartParam pixels double?
     * @dartParamOrigin pixels explicit
     * @dartParam viewportDimension double?
     * @dartParamOrigin viewportDimension explicit
     * @dartParam itemIndex int?
     * @dartParamOrigin itemIndex explicit
     * @dartParam devicePixelRatio double?
     * @dartParamOrigin devicePixelRatio explicit
     */
    copyWith({ minScrollExtent = null, maxScrollExtent = null, pixels = null, viewportDimension = null, axisDirection = null, itemIndex = null, devicePixelRatio = null }: {
        readonly minScrollExtent?: number | null;
        readonly maxScrollExtent?: number | null;
        readonly pixels?: number | null;
        readonly viewportDimension?: number | null;
        readonly axisDirection?: AxisDirection | null;
        readonly itemIndex?: number | null;
        readonly devicePixelRatio?: number | null;
    } = {}): SourceFixedExtentMetrics {
        if (itemIndex !== null)
            checkedInteger(itemIndex);
        return new SourceFixedExtentMetrics({ minScrollExtent: minScrollExtent ?? (this.hasContentDimensions ? this.minScrollExtent : null), maxScrollExtent: maxScrollExtent ?? (this.hasContentDimensions ? this.maxScrollExtent : null), pixels: pixels ?? (this.hasPixels ? this.pixels : null), viewportDimension: viewportDimension ?? (this.hasViewportDimension ? this.viewportDimension : null), axisDirection: axisDirection ?? this.axisDirection, itemIndex: checkedInteger(itemIndex ?? checkedInteger(this.itemIndex)), devicePixelRatio: devicePixelRatio ?? this.devicePixelRatio });
    }
}
