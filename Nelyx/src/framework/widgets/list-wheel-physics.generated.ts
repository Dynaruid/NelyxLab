// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/list_wheel_scroll_view.dart; SHA256 6e6a545ed8eb253a4980888bbddd67da3989f9c9c218c70816f8ac28eb42484e
import { ScrollPhysics } from "./scroll-physics.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { invariant } from "../../foundation/errors.ts";
import { checkedInteger } from "../../ui/value-math.ts";
import { roundInteger } from "../../ui/value-math.ts";
import "../physics/spring-simulation.ts";
import { FrictionSimulation } from "../physics/friction-simulation.ts";
import { isWheelPosition } from "./list-wheel-physics-adapter.ts";
import { castWheelPosition } from "./list-wheel-physics-adapter.ts";
import { createWheelSpring } from "./list-wheel-physics-adapter.ts";
import type { ScrollMetrics } from "./scroll-metrics.ts";
import type { Simulation } from "../physics/simulation.ts";
import type { WheelPosition } from "./list-wheel-physics-adapter.ts";
export class SourceFixedExtentScrollPhysics extends ScrollPhysics {
    constructor({ parent = null }: {
        readonly parent?: ScrollPhysics | null;
    } = {}) {
        super({ parent: parent });
    }
    override applyTo(ancestor: ScrollPhysics | null): SourceFixedExtentScrollPhysics {
        return new SourceFixedExtentScrollPhysics({ parent: this.buildParent(ancestor) });
    }
    /**
     * @dartParam velocity double
     * @dartParamOrigin velocity explicit
     */
    override createBallisticSimulation(position: ScrollMetrics, velocity: number): Simulation | null {
        if (FoundationBuildMode.debug)
            invariant(isWheelPosition(position), "generated-source-assert", "FixedExtentScrollPhysics can only be used with Scrollables that uses the FixedExtentScrollController");
        const metrics: WheelPosition = castWheelPosition(position);
        if ((velocity <= 0 && metrics.pixels <= metrics.minScrollExtent) || (velocity >= 0 && metrics.pixels >= metrics.maxScrollExtent)) {
            return super.createBallisticSimulation(metrics, velocity);
        }
        const testFrictionSimulation: Simulation | null = super.createBallisticSimulation(metrics, velocity);
        if (testFrictionSimulation !== null && (testFrictionSimulation.x(Infinity) === metrics.minScrollExtent || testFrictionSimulation.x(Infinity) === metrics.maxScrollExtent)) {
            return super.createBallisticSimulation(metrics, velocity);
        }
        /**
         * @dartType int
         * @dartTypeOrigin explicit
         */
        const settlingItemIndex: number = checkedInteger(_getItemFromOffset({ offset: testFrictionSimulation?.x(Infinity) ?? metrics.pixels, itemExtent: metrics.itemExtent, minScrollExtent: metrics.minScrollExtent, maxScrollExtent: metrics.maxScrollExtent }));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const settlingPixels: number = checkedInteger(settlingItemIndex) * metrics.itemExtent;
        if (Math.abs(velocity) < this.toleranceFor(position).velocity && Math.abs((settlingPixels - metrics.pixels)) < this.toleranceFor(position).distance) {
            return null;
        }
        if (checkedInteger(settlingItemIndex) === checkedInteger(metrics.itemIndex)) {
            return createWheelSpring(this.spring, metrics.pixels, settlingPixels, velocity, { tolerance: this.toleranceFor(position) });
        }
        return FrictionSimulation.through(metrics.pixels, settlingPixels, velocity, this.toleranceFor(position).velocity * Math.sign(velocity));
    }
}
/**
 * @dartParam offset double
 * @dartParamOrigin offset explicit
 * @dartParam itemExtent double
 * @dartParamOrigin itemExtent explicit
 * @dartParam minScrollExtent double
 * @dartParamOrigin minScrollExtent explicit
 * @dartParam maxScrollExtent double
 * @dartParamOrigin maxScrollExtent explicit
 * @dartReturn int
 * @dartReturnOrigin explicit
 */
export function _getItemFromOffset({ offset, itemExtent, minScrollExtent, maxScrollExtent }: {
    readonly offset: number;
    readonly itemExtent: number;
    readonly minScrollExtent: number;
    readonly maxScrollExtent: number;
}): number {
    return checkedInteger(roundInteger((_clipOffsetToScrollableRange(offset, minScrollExtent, maxScrollExtent) / itemExtent)));
}
/**
 * @dartParam offset double
 * @dartParamOrigin offset explicit
 * @dartParam minScrollExtent double
 * @dartParamOrigin minScrollExtent explicit
 * @dartParam maxScrollExtent double
 * @dartParamOrigin maxScrollExtent explicit
 * @dartReturn double
 * @dartReturnOrigin explicit
 */
export function _clipOffsetToScrollableRange(offset: number, minScrollExtent: number, maxScrollExtent: number): number {
    return Math.min(Math.max(offset, minScrollExtent), maxScrollExtent);
}
