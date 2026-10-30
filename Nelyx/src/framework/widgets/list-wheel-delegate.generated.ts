// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/list_wheel_scroll_view.dart; SHA256 6e6a545ed8eb253a4980888bbddd67da3989f9c9c218c70816f8ac28eb42484e
import { createWheelIndexedSemantics } from "./list-wheel-delegate-adapter.ts";
import "../../foundation/dart-method-tear-off.ts";
import { checkedInteger } from "../../ui/value-math.ts";
import { protect } from "../../ui/value-math.ts";
import { dartListGet } from "../../foundation/dart-list.ts";
import { dartListIsEmpty } from "../../foundation/dart-list.ts";
import { dartIntegerModulo } from "../../foundation/dart-list.ts";
import type { Widget } from "./framework.ts";
import type { BuildContext } from "./framework.ts";
import type { DartList } from "../../foundation/dart-list.ts";
export abstract class SourceListWheelChildDelegate {
    constructor() {
    }
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    abstract build(context: BuildContext, index: number): Widget | null;
    /**
     * @dartReturn int?
     * @dartReturnOrigin explicit
     */
    abstract get estimatedChildCount(): number | null;
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    trueIndexOf(index: number): number {
        checkedInteger(index);
        return checkedInteger(index);
    }
    abstract shouldRebuild(oldDelegate: SourceListWheelChildDelegate): boolean;
}
export class SourceListWheelChildBuilderDelegate extends SourceListWheelChildDelegate {
    /**
     * @dartType Widget? Function(BuildContext, int)
     * @dartTypeOrigin explicit
     */
    readonly builder: (argument0: BuildContext, argument1: number) => Widget | null;
    /**
     * @dartType int?
     * @dartTypeOrigin explicit
     */
    readonly childCount: number | null;
    /**
     * @dartParam builder Widget? Function(BuildContext, int)
     * @dartParamOrigin builder inferred
     * @dartParam childCount int?
     * @dartParamOrigin childCount inferred
     */
    constructor({ builder, childCount = null }: {
        readonly builder: (argument0: BuildContext, argument1: number) => Widget | null;
        readonly childCount?: number | null;
    }) {
        if (childCount !== null)
            checkedInteger(childCount);
        /**
         * @dartType Widget? Function(BuildContext, int)
         * @dartTypeOrigin inferred
         */
        const _initialField0 = builder;
        /**
         * @dartType int?
         * @dartTypeOrigin inferred
         */
        const _initialField1 = childCount;
        super();
        this.builder = _initialField0;
        this.childCount = _initialField1;
        protect(this, ["builder", "childCount"]);
    }
    /**
     * @dartReturn int?
     * @dartReturnOrigin explicit
     */
    override get estimatedChildCount(): number | null {
        return this.childCount;
    }
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    override build(context: BuildContext, index: number): Widget | null {
        checkedInteger(index);
        if (this.childCount === null) {
            const child: Widget | null = this.builder(context, checkedInteger(index));
            return child === null ? null : createWheelIndexedSemantics({ index: checkedInteger(index), child: child });
        }
        if (checkedInteger(index) < 0 || checkedInteger(index) >= checkedInteger((() => {
            const _dartTemporary0 = this.childCount;
            if (_dartTemporary0 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary0!;
        })())) {
            return null;
        }
        return createWheelIndexedSemantics({ index: checkedInteger(index), child: this.builder(context, checkedInteger(index)) });
    }
    override shouldRebuild(oldDelegate: SourceListWheelChildBuilderDelegate): boolean {
        if (!(oldDelegate instanceof SourceListWheelChildBuilderDelegate))
            throw new TypeError("Invalid covariant argument: oldDelegate");
        return this.builder !== oldDelegate.builder || this.childCount !== oldDelegate.childCount;
    }
}
export class SourceListWheelChildListDelegate extends SourceListWheelChildDelegate {
    readonly children: DartList<Widget>;
    constructor({ children }: {
        readonly children: DartList<Widget>;
    }) {
        const _initialField0 = children;
        super();
        this.children = _initialField0;
        protect(this, ["children"]);
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    override get estimatedChildCount(): number {
        return checkedInteger(this.children.length);
    }
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    override build(context: BuildContext, index: number): Widget | null {
        checkedInteger(index);
        if (checkedInteger(index) < 0 || checkedInteger(index) >= checkedInteger(this.children.length)) {
            return null;
        }
        return createWheelIndexedSemantics({ index: checkedInteger(index), child: dartListGet(this.children, checkedInteger(index)) });
    }
    override shouldRebuild(oldDelegate: SourceListWheelChildListDelegate): boolean {
        if (!(oldDelegate instanceof SourceListWheelChildListDelegate))
            throw new TypeError("Invalid covariant argument: oldDelegate");
        return !(this.children === oldDelegate.children);
    }
}
export class SourceListWheelChildLoopingListDelegate extends SourceListWheelChildDelegate {
    readonly children: DartList<Widget>;
    constructor({ children }: {
        readonly children: DartList<Widget>;
    }) {
        const _initialField0 = children;
        super();
        this.children = _initialField0;
        protect(this, ["children"]);
    }
    /**
     * @dartReturn int?
     * @dartReturnOrigin explicit
     */
    override get estimatedChildCount(): number | null {
        return null;
    }
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    override trueIndexOf(index: number): number {
        checkedInteger(index);
        return checkedInteger(dartIntegerModulo(checkedInteger(index), checkedInteger(this.children.length)));
    }
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    override build(context: BuildContext, index: number): Widget | null {
        checkedInteger(index);
        if (dartListIsEmpty(this.children)) {
            return null;
        }
        return createWheelIndexedSemantics({ index: checkedInteger(index), child: dartListGet(this.children, checkedInteger(dartIntegerModulo(checkedInteger(index), checkedInteger(this.children.length)))) });
    }
    override shouldRebuild(oldDelegate: SourceListWheelChildLoopingListDelegate): boolean {
        if (!(oldDelegate instanceof SourceListWheelChildLoopingListDelegate))
            throw new TypeError("Invalid covariant argument: oldDelegate");
        return !(this.children === oldDelegate.children);
    }
}
