// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/list_wheel_scroll_view.dart; SHA256 6e6a545ed8eb253a4980888bbddd67da3989f9c9c218c70816f8ac28eb42484e
import { WheelControllerHost } from "./list-wheel-controller-adapter.ts";
import { castWheelPositions } from "./list-wheel-controller-adapter.ts";
import { waitForWheelMotions } from "./list-wheel-controller-adapter.ts";
import { createWheelPosition } from "./list-wheel-controller-adapter.ts";
import { castWheelPosition } from "./list-wheel-physics-adapter.ts";
import { isWheelPosition } from "./list-wheel-physics-adapter.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { invariant } from "../../foundation/errors.ts";
import { checkedInteger } from "../../ui/value-math.ts";
import { protect } from "../../ui/value-math.ts";
import type { HostFuture } from "./list-wheel-controller-adapter.ts";
import type { WheelPosition } from "./list-wheel-physics-adapter.ts";
import type { ScrollPosition } from "./scroll-position.ts";
import type { ScrollPhysics } from "./scroll-physics.ts";
import type { ScrollContext } from "./scroll-context.ts";
import type { Curve } from "../animation/curves.ts";
export class SourceFixedExtentScrollController extends WheelControllerHost {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly initialItem: number;
    /**
     * @dartParam initialItem int
     * @dartParamOrigin initialItem inferred
     */
    constructor({ initialItem = 0, keepScrollOffset = true, debugLabel = null, onAttach = null, onDetach = null }: {
        readonly initialItem?: number;
        readonly keepScrollOffset?: boolean;
        readonly debugLabel?: string | null;
        readonly onAttach?: ((argument0: ScrollPosition) => void) | null;
        readonly onDetach?: ((argument0: ScrollPosition) => void) | null;
    } = {}) {
        checkedInteger(initialItem);
        /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        const _initialField0 = initialItem;
        super({ keepScrollOffset: keepScrollOffset, debugLabel: debugLabel, onAttach: onAttach, onDetach: onDetach });
        this.initialItem = _initialField0;
        protect(this, ["initialItem"]);
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    get selectedItem(): number {
        if (FoundationBuildMode.debug)
            invariant(this.sourcePositions.isNotEmpty, "generated-source-assert", "FixedExtentScrollController.selectedItem cannot be accessed before a scroll view is built with it.");
        if (FoundationBuildMode.debug)
            invariant(checkedInteger(this.sourcePositions.length) === 1, "generated-source-assert", "The selectedItem property cannot be read when multiple scroll views are attached to the same FixedExtentScrollController.");
        const position: WheelPosition = castWheelPosition(this.position);
        return checkedInteger(position.itemIndex);
    }
    /**
     * @dartParam itemIndex int
     * @dartParamOrigin itemIndex explicit
     */
    async animateToItem(itemIndex: number, { duration, curve }: {
        readonly duration: number;
        readonly curve: Curve;
    }): HostFuture<void> {
        checkedInteger(itemIndex);
        if (!this.hasClients) {
            return;
        }
        await waitForWheelMotions((() => {
            const _dartTemporary0: HostFuture<void>[] = [];
            for (const _dartTemporary1 of castWheelPositions(this.sourcePositions)) {
                const position: WheelPosition = _dartTemporary1;
                _dartTemporary0.push(position.animateTo(checkedInteger(itemIndex) * position.itemExtent, { duration: duration, curve: curve }));
            }
            return _dartTemporary0;
        })());
    }
    /**
     * @dartParam itemIndex int
     * @dartParamOrigin itemIndex explicit
     */
    jumpToItem(itemIndex: number): void {
        checkedInteger(itemIndex);
        for (const _dartTemporary2 of castWheelPositions(this.sourcePositions)) {
            const position: WheelPosition = _dartTemporary2;
            {
                position.jumpTo(checkedInteger(itemIndex) * position.itemExtent);
            }
        }
    }
    override createScrollPosition(physics: ScrollPhysics, context: ScrollContext, oldPosition: ScrollPosition | null): ScrollPosition {
        return createWheelPosition(this, { physics: physics, context: context, initialItem: checkedInteger(this.initialItem), oldPosition: oldPosition, keepScrollOffset: this.keepScrollOffset, debugLabel: this.debugLabel });
    }
}
