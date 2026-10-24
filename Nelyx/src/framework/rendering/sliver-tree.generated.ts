// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/rendering/sliver_tree.dart; SHA256 8296931c4f365bf4dee6fb15ddf7d3281beeb604364c2c2b56384323319672f5
import { UniqueKey } from "../../foundation/key.ts";
import { RenderObject } from "../rendering/object.ts";
import { RenderBox } from "../rendering/object.ts";
import { SliverMultiBoxAdaptorParentData } from "../rendering/sliver-multi-box-adaptor.ts";
import { RenderSliverBoxChildManager } from "../rendering/sliver-multi-box-adaptor.ts";
import { Offset } from "../../ui/offset.ts";
import { Rect } from "../../ui/rect.ts";
import { DartMap } from "../../foundation/dart-collections.ts";
import { checkedInteger } from "../../ui/value-math.ts";
import { protect } from "../../ui/value-math.ts";
import { invariant } from "../../foundation/errors.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { dartNamedRecord } from "../../foundation/dart-named-record.ts";
import { dartNamedRecordRead } from "../../foundation/dart-named-record.ts";
import { treeIndentationConstant } from "../widgets/tree-sliver-source-adapter.ts";
import { LayerHandle } from "./layer.ts";
import { ClipRectLayer } from "./layer.ts";
import { SliverLayoutDimensions } from "./sliver.ts";
import { TreeRenderHost } from "./tree-sliver-source-adapter.ts";
import { treeIndexKeyMap } from "./tree-sliver-source-adapter.ts";
import { treeKeyOffsetMap } from "./tree-sliver-source-adapter.ts";
import { treeKeyClipMap } from "./tree-sliver-source-adapter.ts";
import { treeClipHandle } from "./tree-sliver-source-adapter.ts";
import { treeMapRemoveWhere } from "./tree-sliver-source-adapter.ts";
import { treeListAdd } from "./tree-sliver-source-adapter.ts";
import { treeListRemoveAt } from "./tree-sliver-source-adapter.ts";
import { treeSortIndices } from "./tree-sliver-source-adapter.ts";
import { treeListNotEmpty } from "./tree-sliver-source-adapter.ts";
import { treeAxisString } from "./tree-sliver-source-adapter.ts";
import { dartMapRead } from "../../foundation/dart-collections.ts";
import { dartMapWrite } from "../../foundation/dart-collections.ts";
import { wheelPaintChild } from "./list-wheel-renderer-adapter.ts";
import { AxisDirection } from "../painting/basic-types.ts";
import { isTreeParentData } from "./tree-sliver-source-types.ts";
import { castTreeParentData } from "./tree-sliver-source-types.ts";
import { isWheelBox } from "./list-wheel-renderer-adapter.ts";
import { isWheelRenderObject } from "./list-wheel-renderer-adapter.ts";
import { treePushClipRect } from "./tree-sliver-source-adapter.ts";
import { treePaintAnimationIndices } from "./tree-sliver-source-adapter.ts";
import { boxSourceDartInt } from "../../foundation/dart-numeric.ts";
import { boxSourceDartDouble } from "../../foundation/dart-numeric.ts";
import { castSourceDartInt } from "../../foundation/dart-numeric.ts";
import { castSourceDartDouble } from "../../foundation/dart-numeric.ts";
import { maxSourceDartNum } from "../../foundation/dart-numeric-math.ts";
import type { DartNamedRecord } from "../../foundation/dart-named-record.ts";
import type { PaintingContext } from "../painting/context.ts";
import type { DartInt } from "../../foundation/dart-numeric.ts";
import type { DartDouble } from "../../foundation/dart-numeric.ts";
import type { DartMutableList } from "../../foundation/dart-mutable-list.ts";
export class SourceTreeSliverNodeParentData extends SliverMultiBoxAdaptorParentData {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    depth: number;
    constructor() {
        /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        const _initialField0 = 0;
        super();
        this.depth = _initialField0;
    }
}
export class SourceTreeSliverIndentationType {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly _dart_7b9586d3cedbce5e_value!: number;
    static readonly standard: SourceTreeSliverIndentationType = treeIndentationConstant(SourceTreeSliverIndentationType, SourceTreeSliverIndentationType._dart_7b9586d3cedbce5e_internal, 10);
    static readonly none: SourceTreeSliverIndentationType = treeIndentationConstant(SourceTreeSliverIndentationType, SourceTreeSliverIndentationType._dart_7b9586d3cedbce5e_internal, 0);
    private constructor() {
        throw new TypeError("Named-only source class has no unnamed constructor");
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get value(): number {
        return this._dart_7b9586d3cedbce5e_value;
    }
    /**
     * @dartParam value double
     * @dartParamOrigin value explicit
     */
    static custom(value: number): SourceTreeSliverIndentationType {
        if (FoundationBuildMode.debug)
            invariant(value >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        return SourceTreeSliverIndentationType._dart_7b9586d3cedbce5e_internal(value);
    }
    /**
     * @dartParam value double
     * @dartParamOrigin value explicit
     */
    static _dart_7b9586d3cedbce5e_internal(value: number): SourceTreeSliverIndentationType {
        return _dartTemporary0(SourceTreeSliverIndentationType, value);
    }
}
protect(SourceTreeSliverIndentationType, ["standard", "none"]);
function _dartTemporary0(_dartTemporary2: typeof SourceTreeSliverIndentationType, value: number): SourceTreeSliverIndentationType {
    const _dartTemporary1: InstanceType<typeof Object> & {
        _dart_7b9586d3cedbce5e_value: number;
    } = Reflect.construct(Object, [] satisfies ConstructorParameters<typeof Object>, _dartTemporary2) as InstanceType<typeof Object> & {
        _dart_7b9586d3cedbce5e_value: number;
    };
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField0 = value;
    _dartTemporary1._dart_7b9586d3cedbce5e_value = _initialField0;
    protect(_dartTemporary1, ["_dart_7b9586d3cedbce5e_value"]);
    return _dartTemporary1 as SourceTreeSliverIndentationType;
}
export class SourceRenderTreeSliver extends TreeRenderHost {
    /**
     * @dartType Map<UniqueKey, ({int fromIndex, int toIndex, double value})>
     * @dartTypeOrigin explicit
     */
    _dart_7b9586d3cedbce5e_activeAnimations: DartMap<UniqueKey, TreeSliverNodesAnimation>;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    _dart_7b9586d3cedbce5e_indentation: number;
    /**
     * @dartType Map<int, UniqueKey>
     * @dartTypeOrigin explicit
     */
    readonly _dart_7b9586d3cedbce5e_animationLeadingIndices: DartMap<DartInt, UniqueKey>;
    /**
     * @dartType Map<UniqueKey, double>
     * @dartTypeOrigin explicit
     */
    readonly _dart_7b9586d3cedbce5e_animationOffsets: DartMap<UniqueKey, DartDouble>;
    readonly _dart_7b9586d3cedbce5e_clipHandles: DartMap<UniqueKey, LayerHandle<ClipRectLayer>>;
    /**
     * @dartParam itemExtentBuilder double? Function(int, SliverLayoutDimensions)
     * @dartParamOrigin itemExtentBuilder inferred
     * @dartParam activeAnimations Map<UniqueKey, ({int fromIndex, int toIndex, double value})>
     * @dartParamOrigin activeAnimations inferred
     * @dartParam indentation double
     * @dartParamOrigin indentation inferred
     */
    constructor({ childManager, itemExtentBuilder, activeAnimations, indentation }: {
        readonly childManager: RenderSliverBoxChildManager;
        readonly itemExtentBuilder: (argument0: number, argument1: SliverLayoutDimensions) => number | null;
        readonly activeAnimations: DartMap<UniqueKey, TreeSliverNodesAnimation>;
        readonly indentation: number;
    }) {
        /**
         * @dartType Map<int, UniqueKey>
         * @dartTypeOrigin inferred
         */
        const _initialField0 = (() => {
            const _dartTemporary3 = treeIndexKeyMap();
            return _dartTemporary3;
        })();
        /**
         * @dartType Map<UniqueKey, double>
         * @dartTypeOrigin inferred
         */
        const _initialField1 = (() => {
            const _dartTemporary4 = treeKeyOffsetMap();
            return _dartTemporary4;
        })();
        const _initialField2 = (() => {
            const _dartTemporary5 = treeKeyClipMap();
            return _dartTemporary5;
        })();
        /**
         * @dartType Map<UniqueKey, ({int fromIndex, int toIndex, double value})>
         * @dartTypeOrigin inferred
         */
        const _initialField3 = activeAnimations;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField4 = indentation;
        super({ childManager: childManager, itemExtentBuilder: itemExtentBuilder });
        this._dart_7b9586d3cedbce5e_activeAnimations = _initialField3;
        this._dart_7b9586d3cedbce5e_indentation = _initialField4;
        this._dart_7b9586d3cedbce5e_animationLeadingIndices = _initialField0;
        this._dart_7b9586d3cedbce5e_animationOffsets = _initialField1;
        this._dart_7b9586d3cedbce5e_clipHandles = _initialField2;
        protect(this, ["_dart_7b9586d3cedbce5e_animationLeadingIndices", "_dart_7b9586d3cedbce5e_animationOffsets", "_dart_7b9586d3cedbce5e_clipHandles"]);
    }
    /**
     * @dartReturn Map<UniqueKey, ({int fromIndex, int toIndex, double value})>
     * @dartReturnOrigin explicit
     */
    get activeAnimations(): DartMap<UniqueKey, TreeSliverNodesAnimation> {
        return this._dart_7b9586d3cedbce5e_activeAnimations;
    }
    /**
     * @dartParam value Map<UniqueKey, ({int fromIndex, int toIndex, double value})>
     * @dartParamOrigin value explicit
     */
    set activeAnimations(value: DartMap<UniqueKey, TreeSliverNodesAnimation>) {
        if (this._dart_7b9586d3cedbce5e_activeAnimations === value) {
            return;
        }
        this._dart_7b9586d3cedbce5e_activeAnimations = value;
        this.markNeedsLayout();
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get indentation(): number {
        return this._dart_7b9586d3cedbce5e_indentation;
    }
    /**
     * @dartParam value double
     * @dartParamOrigin value explicit
     */
    set indentation(value: number) {
        if (this._dart_7b9586d3cedbce5e_indentation === value) {
            return;
        }
        if (FoundationBuildMode.debug)
            invariant(this.indentation >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        this._dart_7b9586d3cedbce5e_indentation = value;
        this.markNeedsLayout();
    }
    _dart_7b9586d3cedbce5e_updateAnimationCache(): void {
        this._dart_7b9586d3cedbce5e_animationLeadingIndices.clear();
        this._dart_7b9586d3cedbce5e_activeAnimations.forEach((key: UniqueKey, animation: TreeSliverNodesAnimation): void => {
            (() => {
                const _dartTemporary8 = this._dart_7b9586d3cedbce5e_animationLeadingIndices;
                const _dartTemporary6 = boxSourceDartInt(checkedInteger(checkedInteger(castSourceDartInt(dartNamedRecordRead(animation, "fromIndex", 0, ["fromIndex", "toIndex", "value"]))) - 1));
                const _dartTemporary7 = key;
                dartMapWrite(_dartTemporary8, _dartTemporary6, _dartTemporary7);
                return _dartTemporary7;
            })();
        });
        treeMapRemoveWhere(this._dart_7b9586d3cedbce5e_animationOffsets, (key: UniqueKey, _dartTemporary9: DartDouble): boolean => {
            /**
             * @dartType double
             * @dartTypeOrigin inferred
             */
            let _: number = castSourceDartDouble(_dartTemporary9);
            return !this._dart_7b9586d3cedbce5e_activeAnimations.keys.contains(key);
        });
        treeMapRemoveWhere(this._dart_7b9586d3cedbce5e_clipHandles, (key: UniqueKey, handle: LayerHandle<ClipRectLayer>): boolean => {
            if (!this._dart_7b9586d3cedbce5e_activeAnimations.keys.contains(key)) {
                handle.layer = null;
                return true;
            }
            return false;
        });
    }
    override setupParentData(child: RenderBox): void {
        if (!(isWheelBox(child)))
            throw new TypeError("Invalid covariant argument: child");
        if (!isTreeParentData(child.parentData)) {
            child.parentData = new SourceTreeSliverNodeParentData();
        }
    }
    override dispose(): void {
        treeMapRemoveWhere(this._dart_7b9586d3cedbce5e_clipHandles, (key: UniqueKey, handle: LayerHandle<ClipRectLayer>): boolean => {
            handle.layer = null;
            return true;
        });
        super.dispose();
    }
    override performLayout(): void {
        if (FoundationBuildMode.debug)
            invariant(this.constraints.axisDirection === AxisDirection.down, "generated-source-assert", `TreeSliver is only supported in Viewports with an AxisDirection.down. The current axis direction is: ${treeAxisString(this.constraints.axisDirection)}.`);
        this._dart_7b9586d3cedbce5e_updateAnimationCache();
        super.performLayout();
    }
    /**
     * @dartParam scrollOffset double
     * @dartParamOrigin scrollOffset explicit
     * @dartParam itemExtent double
     * @dartParamOrigin itemExtent explicit
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    override getMinChildIndexForScrollOffset(scrollOffset: number, itemExtent: number): number {
        return checkedInteger(this._dart_7b9586d3cedbce5e_getChildIndexForScrollOffset(scrollOffset));
    }
    /**
     * @dartParam scrollOffset double
     * @dartParamOrigin scrollOffset explicit
     * @dartParam itemExtent double
     * @dartParamOrigin itemExtent explicit
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    override getMaxChildIndexForScrollOffset(scrollOffset: number, itemExtent: number): number {
        return checkedInteger(this._dart_7b9586d3cedbce5e_getChildIndexForScrollOffset(scrollOffset));
    }
    /**
     * @dartParam scrollOffset double
     * @dartParamOrigin scrollOffset explicit
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    _dart_7b9586d3cedbce5e_getChildIndexForScrollOffset(scrollOffset: number): number {
        if (scrollOffset === 0) {
            return 0;
        }
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        let position: number = 0;
        /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        let index: number = 0;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        let totalAnimationOffset: number = 0;
        /**
         * @dartType double?
         * @dartTypeOrigin explicit
         */
        let itemExtent: number | null = null;
        /**
         * @dartType int?
         * @dartTypeOrigin explicit
         */
        const childCount: number | null = this.childManager.estimatedChildCount;
        while (position < scrollOffset) {
            if (childCount !== null && checkedInteger(index) > checkedInteger(checkedInteger(childCount as number) - 1)) {
                break;
            }
            itemExtent = this.itemExtentBuilder(checkedInteger(index), this.layoutDimensions);
            if (itemExtent === null) {
                break;
            }
            if (this._dart_7b9586d3cedbce5e_animationLeadingIndices.keys.contains(boxSourceDartInt(checkedInteger(index)))) {
                const animationKey: UniqueKey = (() => {
                    const _dartTemporary10 = dartMapRead(this._dart_7b9586d3cedbce5e_animationLeadingIndices, boxSourceDartInt(checkedInteger(index)));
                    if (_dartTemporary10 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary10!;
                })();
                if ((() => {
                    const _dartTemporary11 = dartMapRead(this._dart_7b9586d3cedbce5e_animationOffsets, animationKey);
                    return _dartTemporary11 === null ? null : castSourceDartDouble(_dartTemporary11);
                })() === null) {
                    this._dart_7b9586d3cedbce5e_computeAnimationOffsetFor(animationKey, position);
                }
                totalAnimationOffset += (() => {
                    const _dartTemporary13 = (() => {
                        const _dartTemporary12 = dartMapRead(this._dart_7b9586d3cedbce5e_animationOffsets, animationKey);
                        return _dartTemporary12 === null ? null : castSourceDartDouble(_dartTemporary12);
                    })();
                    if (_dartTemporary13 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary13!;
                })() * (1 - castSourceDartDouble(dartNamedRecordRead((() => {
                    const _dartTemporary14 = dartMapRead(this._dart_7b9586d3cedbce5e_activeAnimations, animationKey);
                    if (_dartTemporary14 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary14!;
                })(), "value", 0, ["fromIndex", "toIndex", "value"])));
            }
            position += (itemExtent as number) - totalAnimationOffset;
            checkedInteger((() => {
                const _dartTemporary15 = checkedInteger(index);
                const _dartTemporary16 = checkedInteger(_dartTemporary15 + 1);
                index = _dartTemporary16;
                return _dartTemporary16;
            })());
        }
        return checkedInteger(checkedInteger(index) - 1);
    }
    /**
     * @dartParam position double
     * @dartParamOrigin position explicit
     */
    _dart_7b9586d3cedbce5e_computeAnimationOffsetFor(key: UniqueKey, position: number): void {
        if (FoundationBuildMode.debug)
            invariant(dartMapRead(this._dart_7b9586d3cedbce5e_activeAnimations, key) !== null, "generated-source-assert", "Pinned Dart assertion failed");
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const targetPosition: number = this.constraints.scrollOffset + this.constraints.remainingCacheExtent;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        let currentPosition: number = position;
        /**
         * @dartType int
         * @dartTypeOrigin explicit
         */
        const startingIndex: number = checkedInteger(castSourceDartInt(dartNamedRecordRead((() => {
            const _dartTemporary17 = dartMapRead(this._dart_7b9586d3cedbce5e_activeAnimations, key);
            if (_dartTemporary17 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary17!;
        })(), "fromIndex", 0, ["fromIndex", "toIndex", "value"])));
        /**
         * @dartType int
         * @dartTypeOrigin explicit
         */
        const lastIndex: number = checkedInteger(castSourceDartInt(dartNamedRecordRead((() => {
            const _dartTemporary18 = dartMapRead(this._dart_7b9586d3cedbce5e_activeAnimations, key);
            if (_dartTemporary18 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary18!;
        })(), "toIndex", 0, ["fromIndex", "toIndex", "value"])));
        /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        let currentIndex: number = checkedInteger(startingIndex);
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        let totalAnimatingOffset: number = 0;
        while (checkedInteger(currentIndex) <= checkedInteger(lastIndex) && currentPosition < targetPosition) {
            /**
             * @dartType double
             * @dartTypeOrigin explicit
             */
            const itemExtent: number = (() => {
                const _dartTemporary19 = this.itemExtentBuilder(checkedInteger(currentIndex), this.layoutDimensions);
                if (_dartTemporary19 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary19!;
            })();
            totalAnimatingOffset += itemExtent;
            currentPosition += itemExtent;
            checkedInteger((() => {
                const _dartTemporary20 = checkedInteger(currentIndex);
                const _dartTemporary21 = checkedInteger(_dartTemporary20 + 1);
                currentIndex = _dartTemporary21;
                return _dartTemporary20;
            })());
        }
        castSourceDartDouble((() => {
            const _dartTemporary24 = this._dart_7b9586d3cedbce5e_animationOffsets;
            const _dartTemporary22 = key;
            const _dartTemporary23 = boxSourceDartDouble(totalAnimatingOffset);
            dartMapWrite(_dartTemporary24, _dartTemporary22, _dartTemporary23);
            return _dartTemporary23;
        })());
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    override childCrossAxisPosition(child: RenderObject): number {
        if (!(isWheelRenderObject(child)))
            throw new TypeError("Invalid covariant argument: child");
        const parentData: SourceTreeSliverNodeParentData = castTreeParentData((() => {
            const _dartTemporary25 = child.parentData;
            if (_dartTemporary25 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary25!;
        })());
        return checkedInteger(parentData.depth) * this.indentation;
    }
    /**
     * @dartParam itemExtent double
     * @dartParamOrigin itemExtent explicit
     * @dartParam index int
     * @dartParamOrigin index explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    override indexToLayoutOffset(itemExtent: number, index: number): number {
        checkedInteger(index);
        {
            /**
             * @dartType double
             * @dartTypeOrigin inferred
             */
            let position: number = 0;
            /**
             * @dartType int
             * @dartTypeOrigin inferred
             */
            let currentIndex: number = 0;
            /**
             * @dartType double
             * @dartTypeOrigin inferred
             */
            let totalAnimationOffset: number = 0;
            /**
             * @dartType double?
             * @dartTypeOrigin explicit
             */
            let itemExtent: number | null = null;
            /**
             * @dartType int?
             * @dartTypeOrigin explicit
             */
            const childCount: number | null = this.childManager.estimatedChildCount;
            while (checkedInteger(currentIndex) < checkedInteger(index)) {
                if (childCount !== null && checkedInteger(currentIndex) > checkedInteger(checkedInteger(childCount as number) - 1)) {
                    break;
                }
                itemExtent = this.itemExtentBuilder(checkedInteger(currentIndex), this.layoutDimensions);
                if (itemExtent === null) {
                    break;
                }
                if (this._dart_7b9586d3cedbce5e_animationLeadingIndices.keys.contains(boxSourceDartInt(checkedInteger(currentIndex)))) {
                    const animationKey: UniqueKey = (() => {
                        const _dartTemporary26 = dartMapRead(this._dart_7b9586d3cedbce5e_animationLeadingIndices, boxSourceDartInt(checkedInteger(currentIndex)));
                        if (_dartTemporary26 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary26!;
                    })();
                    if (FoundationBuildMode.debug)
                        invariant((() => {
                            const _dartTemporary27 = dartMapRead(this._dart_7b9586d3cedbce5e_animationOffsets, animationKey);
                            return _dartTemporary27 === null ? null : castSourceDartDouble(_dartTemporary27);
                        })() !== null, "generated-source-assert", "Pinned Dart assertion failed");
                    totalAnimationOffset += (() => {
                        const _dartTemporary29 = (() => {
                            const _dartTemporary28 = dartMapRead(this._dart_7b9586d3cedbce5e_animationOffsets, animationKey);
                            return _dartTemporary28 === null ? null : castSourceDartDouble(_dartTemporary28);
                        })();
                        if (_dartTemporary29 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary29!;
                    })() * (1 - castSourceDartDouble(dartNamedRecordRead((() => {
                        const _dartTemporary30 = dartMapRead(this._dart_7b9586d3cedbce5e_activeAnimations, animationKey);
                        if (_dartTemporary30 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary30!;
                    })(), "value", 0, ["fromIndex", "toIndex", "value"])));
                }
                position += itemExtent as number;
                checkedInteger((() => {
                    const _dartTemporary31 = checkedInteger(currentIndex);
                    const _dartTemporary32 = checkedInteger(_dartTemporary31 + 1);
                    currentIndex = _dartTemporary32;
                    return _dartTemporary31;
                })());
            }
            return position - totalAnimationOffset;
        }
    }
    override sourcePaint(context: PaintingContext, offset: Offset): void {
        if (this.firstChild === null) {
            return;
        }
        let nextChild: RenderBox | null = this.firstChild;
        /**
         * @dartType void Function(int, RenderBox?, PaintingContext, Offset)
         * @dartTypeOrigin explicit
         */
        const paintUpTo: (argument0: number, argument1: RenderBox | null, argument2: PaintingContext, argument3: Offset) => void = (index: number, startWith: RenderBox | null, context: PaintingContext, offset: Offset): void => {
            checkedInteger(index);
            let child: RenderBox | null = startWith;
            while (child !== null && checkedInteger(this.indexOf(child as RenderBox)) <= checkedInteger(index)) {
                /**
                 * @dartType double
                 * @dartTypeOrigin explicit
                 */
                const mainAxisDelta: number = this.childMainAxisPosition(child as RenderBox);
                const parentData: SourceTreeSliverNodeParentData = castTreeParentData((() => {
                    const _dartTemporary33 = (child as RenderBox).parentData;
                    if (_dartTemporary33 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary33!;
                })());
                const childOffset: Offset = new Offset(checkedInteger(parentData.depth) * this.indentation, (() => {
                    const _dartTemporary34 = parentData.layoutOffset;
                    if (_dartTemporary34 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary34!;
                })() - this.constraints.scrollOffset).add(offset);
                if (mainAxisDelta < this.constraints.remainingPaintExtent && mainAxisDelta + this.paintExtentOf(child as RenderBox) > 0) {
                    wheelPaintChild(context, child as RenderBox, childOffset);
                }
                child = this.childAfter(child as RenderBox);
            }
            nextChild = child;
        };
        if (this._dart_7b9586d3cedbce5e_animationLeadingIndices.isEmpty) {
            paintUpTo(checkedInteger(this.indexOf((() => {
                const _dartTemporary35 = this.lastChild;
                if (_dartTemporary35 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary35!;
            })())), this.firstChild, context, offset);
            return;
        }
        /**
         * @dartType int
         * @dartTypeOrigin explicit
         */
        let leadingIndex: number = checkedInteger(this.indexOf((() => {
            const _dartTemporary36 = this.firstChild;
            if (_dartTemporary36 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary36!;
        })()));
        /**
         * @dartType List<int>
         * @dartTypeOrigin explicit
         */
        const animationIndices: DartMutableList<DartInt> = (() => {
            const _dartTemporary37 = treePaintAnimationIndices(this._dart_7b9586d3cedbce5e_animationLeadingIndices.keys);
            treeSortIndices(_dartTemporary37);
            return _dartTemporary37;
        })();
        /**
         * @dartType List<({int leadingIndex, int trailingIndex})>
         * @dartTypeOrigin inferred
         */
        const paintSegments: DartMutableList<_PaintSegment> = [];
        while (treeListNotEmpty(animationIndices)) {
            /**
             * @dartType int
             * @dartTypeOrigin explicit
             */
            const trailingIndex: number = checkedInteger(castSourceDartInt(treeListRemoveAt(animationIndices, 0)));
            treeListAdd(paintSegments, dartNamedRecord<[
            ], {
                readonly "leadingIndex": DartInt;
                readonly "trailingIndex": DartInt;
            }>(0, ["leadingIndex", "trailingIndex"], [["leadingIndex", boxSourceDartInt(checkedInteger(leadingIndex))] as const, ["trailingIndex", boxSourceDartInt(checkedInteger(trailingIndex))] as const]));
            checkedInteger(leadingIndex = checkedInteger(checkedInteger(trailingIndex) + 1));
        }
        treeListAdd(paintSegments, dartNamedRecord<[
        ], {
            readonly "leadingIndex": DartInt;
            readonly "trailingIndex": DartInt;
        }>(0, ["leadingIndex", "trailingIndex"], [["leadingIndex", boxSourceDartInt(checkedInteger(leadingIndex))] as const, ["trailingIndex", boxSourceDartInt(checkedInteger(this.indexOf((() => {
                    const _dartTemporary38 = this.lastChild;
                    if (_dartTemporary38 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary38!;
                })())))] as const]));
        paintUpTo(checkedInteger(castSourceDartInt(dartNamedRecordRead(treeListRemoveAt(paintSegments, 0), "trailingIndex", 0, ["leadingIndex", "trailingIndex"]))), nextChild, context, offset);
        while (treeListNotEmpty(paintSegments)) {
            /**
             * @dartType ({int leadingIndex, int trailingIndex})
             * @dartTypeOrigin explicit
             */
            const segment: _PaintSegment = treeListRemoveAt(paintSegments, 0);
            /**
             * @dartType int
             * @dartTypeOrigin explicit
             */
            const parentIndex: number = checkedInteger(castSourceDartInt(maxSourceDartNum(boxSourceDartInt(checkedInteger(checkedInteger(castSourceDartInt(dartNamedRecordRead(segment, "leadingIndex", 0, ["leadingIndex", "trailingIndex"]))) - 1)), boxSourceDartInt(0))));
            /**
             * @dartType double
             * @dartTypeOrigin explicit
             */
            const leadingOffset: number = this.indexToLayoutOffset(0, checkedInteger(parentIndex)) + (() => {
                const _dartTemporary39 = this.itemExtentBuilder(checkedInteger(parentIndex), this.layoutDimensions);
                if (_dartTemporary39 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary39!;
            })();
            /**
             * @dartType double
             * @dartTypeOrigin explicit
             */
            const trailingOffset: number = this.indexToLayoutOffset(0, checkedInteger(castSourceDartInt(dartNamedRecordRead(segment, "trailingIndex", 0, ["leadingIndex", "trailingIndex"])))) + (() => {
                const _dartTemporary40 = this.itemExtentBuilder(checkedInteger(castSourceDartInt(dartNamedRecordRead(segment, "trailingIndex", 0, ["leadingIndex", "trailingIndex"]))), this.layoutDimensions);
                if (_dartTemporary40 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary40!;
            })();
            const rect: Rect = Rect.fromPoints(new Offset(0, leadingOffset), new Offset(this.constraints.crossAxisExtent, trailingOffset));
            const key: UniqueKey = (() => {
                const _dartTemporary41 = dartMapRead(this._dart_7b9586d3cedbce5e_animationLeadingIndices, boxSourceDartInt(checkedInteger(parentIndex)));
                if (_dartTemporary41 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary41!;
            })();
            (() => {
                const _dartTemporary45 = this._dart_7b9586d3cedbce5e_clipHandles;
                const _dartTemporary42 = key;
                const _dartTemporary43 = dartMapRead(_dartTemporary45, _dartTemporary42);
                if (_dartTemporary43 !== null)
                    return _dartTemporary43;
                const _dartTemporary44 = treeClipHandle();
                dartMapWrite(_dartTemporary45, _dartTemporary42, _dartTemporary44);
                return _dartTemporary44;
            })();
            (() => {
                const _dartTemporary46 = dartMapRead(this._dart_7b9586d3cedbce5e_clipHandles, key);
                if (_dartTemporary46 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary46!;
            })().layer = treePushClipRect(context, this.needsCompositing, offset, rect, (context: PaintingContext, offset: Offset): void => {
                paintUpTo(checkedInteger(castSourceDartInt(dartNamedRecordRead(segment, "trailingIndex", 0, ["leadingIndex", "trailingIndex"]))), nextChild, context, offset);
            }, { oldLayer: (() => {
                    const _dartTemporary47 = dartMapRead(this._dart_7b9586d3cedbce5e_clipHandles, key);
                    if (_dartTemporary47 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary47!;
                })().layer });
        }
    }
}
/**
 * @dartType ({int fromIndex, int toIndex, double value})
 * @dartTypeOrigin explicit
 */
export type TreeSliverNodesAnimation = DartNamedRecord<[
], {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly "fromIndex": DartInt;
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly "toIndex": DartInt;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly "value": DartDouble;
}>;
/**
 * @dartType ({int leadingIndex, int trailingIndex})
 * @dartTypeOrigin explicit
 */
export type _PaintSegment = DartNamedRecord<[
], {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly "leadingIndex": DartInt;
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly "trailingIndex": DartInt;
}>;
