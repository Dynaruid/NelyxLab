// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/two_dimensional_viewport.dart; SHA256 a3bca9a23d5367265ebb00bf6618ac912a74c4b008568ba0d0da1364a66cf69e
import { createWheelClipHandle } from "../rendering/list-wheel-renderer-adapter.ts";
import { wheelBoxSize } from "../rendering/list-wheel-renderer-adapter.ts";
import { wheelConstraintsBiggest } from "../rendering/list-wheel-renderer-adapter.ts";
import { wheelParentData } from "../rendering/list-wheel-renderer-adapter.ts";
import { wheelParent } from "../rendering/list-wheel-renderer-adapter.ts";
import { wheelPaintBounds } from "../rendering/list-wheel-renderer-adapter.ts";
import { wheelPushClipRect } from "../rendering/list-wheel-renderer-adapter.ts";
import { wheelPaintChild } from "../rendering/list-wheel-renderer-adapter.ts";
import { wheelGetTransform } from "../rendering/list-wheel-renderer-adapter.ts";
import { wheelBoxHitTest } from "../rendering/list-wheel-renderer-adapter.ts";
import { isWheelBox } from "../rendering/list-wheel-renderer-adapter.ts";
import { castWheelBox } from "../rendering/list-wheel-renderer-adapter.ts";
import { isWheelConstraints } from "../rendering/list-wheel-renderer-adapter.ts";
import { RenderBox } from "../rendering/object.ts";
import { RenderObject } from "../rendering/object.ts";
import { BoxConstraints } from "../rendering/constraints.ts";
import { LayerHandle } from "../rendering/layer.ts";
import { Offset } from "../../ui/offset.ts";
import { Size } from "../../ui/size.ts";
import { Rect } from "../../ui/rect.ts";
import { Matrix4 } from "../../math/matrix4.ts";
import { MatrixUtils } from "../painting/matrix-utils.ts";
import { Curves } from "../animation/curves.ts";
import { FlutterError } from "../../foundation/flutter-error.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { invariant } from "../../foundation/errors.ts";
import { protect } from "../../ui/value-math.ts";
import { checkedInteger } from "../../ui/value-math.ts";
import { dartMethodTearOff } from "../../foundation/dart-method-tear-off.ts";
import { createWheelRevealedOffset } from "../rendering/list-wheel-renderer-adapter.ts";
import { isChildVicinity } from "./child-vicinity-adapter.ts";
import { castChildVicinity } from "./child-vicinity-adapter.ts";
import { integerString } from "./child-vicinity-adapter.ts";
import { ErrorDescription } from "../../foundation/diagnostics.ts";
import { ChildVicinity } from "./child-vicinity.generated.ts";
import { DartMap } from "../../foundation/dart-collections.ts";
import { dartMapRead } from "../../foundation/dart-collections.ts";
import { dartMapWrite } from "../../foundation/dart-collections.ts";
import { isTwoDimensionalChildDelegate } from "./two-dimensional-delegate-adapter.ts";
import { Element } from "./framework.ts";
import { RenderObjectElement } from "./framework.ts";
import { RenderObjectWidget } from "./framework.ts";
import { Key } from "../../foundation/key.ts";
import { CacheExtentStyle } from "../rendering/viewport.ts";
import { ScrollCacheExtent } from "../rendering/viewport.ts";
import { SourceTwoDimensionalChildDelegate } from "./two-dimensional-delegate.generated.ts";
import { dartRecord } from "../../foundation/dart-record.ts";
import { dartRecordRead } from "../../foundation/dart-record.ts";
import { Exception } from "./two-dimensional-viewport-adapter.ts";
import { TwoDimensionalRenderHost } from "./two-dimensional-viewport-adapter.ts";
import { TwoDimensionalElementHost } from "./two-dimensional-viewport-adapter.ts";
import { TwoDimensionalWidgetHost } from "./two-dimensional-viewport-adapter.ts";
import { TwoDimensionalParentDataHost } from "./two-dimensional-viewport-adapter.ts";
import { TwoDimensionalHitTestResult } from "./two-dimensional-viewport-adapter.ts";
import { createChildVicinityElementMap } from "./two-dimensional-viewport-adapter.ts";
import { createKeyElementMap } from "./two-dimensional-viewport-adapter.ts";
import { createChildVicinityRenderBoxMap } from "./two-dimensional-viewport-adapter.ts";
import { twoDimensionalListAdd } from "./two-dimensional-viewport-adapter.ts";
import { twoDimensionalListRemove } from "./two-dimensional-viewport-adapter.ts";
import { twoDimensionalListClear } from "./two-dimensional-viewport-adapter.ts";
import { twoDimensionalListSort } from "./two-dimensional-viewport-adapter.ts";
import { twoDimensionalIterableIsEmpty } from "./two-dimensional-viewport-adapter.ts";
import { twoDimensionalNumberCompare } from "./two-dimensional-viewport-adapter.ts";
import { twoDimensionalObjectString } from "./two-dimensional-viewport-adapter.ts";
import { twoDimensionalBuildScope } from "./two-dimensional-viewport-adapter.ts";
import { twoDimensionalElementSlot } from "./two-dimensional-viewport-adapter.ts";
import { castSourceTwoDimensionalViewport } from "./two-dimensional-viewport-types.ts";
import { castSourceRenderTwoDimensionalViewport } from "./two-dimensional-viewport-types.ts";
import { isSourceTwoDimensionalViewportParentData } from "./two-dimensional-viewport-types.ts";
import { castSourceTwoDimensionalViewportParentData } from "./two-dimensional-viewport-types.ts";
import { castScrollPosition } from "./two-dimensional-viewport-types.ts";
import { ErrorSummary } from "../../foundation/diagnostics.ts";
import { ErrorHint } from "../../foundation/diagnostics.ts";
import { DiagnosticsNode } from "../../foundation/diagnostics.ts";
import { AxisDirection } from "../painting/basic-types.ts";
import { dartLateRead } from "../../foundation/dart-late.ts";
import { dartLateWrite } from "../../foundation/dart-late.ts";
import { constantPixelCacheExtent } from "./two-dimensional-viewport-constants.ts";
import { Axis } from "../painting/basic-types.ts";
import { debugCheckHasBoundedAxis } from "./two-dimensional-viewport-adapter.ts";
import { RevealedOffset } from "../rendering/viewport.ts";
import { twoDimensionalTypeString } from "./two-dimensional-viewport-adapter.ts";
import { ParentData } from "../rendering/object.ts";
import { twoDimensionalRuntimeType } from "./two-dimensional-viewport-adapter.ts";
import { twoDimensionalContainsBox } from "./two-dimensional-viewport-adapter.ts";
import { twoDimensionalMoveTo } from "./two-dimensional-viewport-adapter.ts";
import type { PipelineOwner } from "../rendering/object.ts";
import type { ViewportOffset } from "../rendering/viewport-offset.ts";
import type { ClipRectLayer } from "../rendering/layer.ts";
import type { PaintingContext } from "../painting/context.ts";
import type { Clip } from "../../ui/clip.ts";
import type { Curve } from "../animation/curves.ts";
import type { Widget } from "./framework.ts";
import type { BuildContext } from "./framework.ts";
import type { DartMutableList } from "./two-dimensional-viewport-adapter.ts";
import type { TwoDimensionalViewportContract } from "./two-dimensional-viewport-adapter.ts";
import type { DartRecord } from "../../foundation/dart-record.ts";
export abstract class SourceTwoDimensionalViewport extends TwoDimensionalWidgetHost {
    readonly verticalOffset: ViewportOffset;
    readonly verticalAxisDirection: AxisDirection;
    readonly horizontalOffset: ViewportOffset;
    readonly horizontalAxisDirection: AxisDirection;
    readonly mainAxis: Axis;
    /**
     * @dartType double?
     * @dartTypeOrigin explicit
     */
    readonly cacheExtent: number | null;
    readonly cacheExtentStyle: CacheExtentStyle | null;
    readonly scrollCacheExtent: ScrollCacheExtent | null;
    readonly clipBehavior: Clip;
    readonly delegate: SourceTwoDimensionalChildDelegate;
    /**
     * @dartParam cacheExtent double?
     * @dartParamOrigin cacheExtent inferred
     */
    constructor({ key = null, verticalOffset, verticalAxisDirection, horizontalOffset, horizontalAxisDirection, delegate, mainAxis, cacheExtent = null, cacheExtentStyle = null, scrollCacheExtent = null, clipBehavior = "hardEdge" }: {
        readonly key?: Key | null;
        readonly verticalOffset: ViewportOffset;
        readonly verticalAxisDirection: AxisDirection;
        readonly horizontalOffset: ViewportOffset;
        readonly horizontalAxisDirection: AxisDirection;
        readonly delegate: SourceTwoDimensionalChildDelegate;
        readonly mainAxis: Axis;
        readonly cacheExtent?: number | null;
        readonly cacheExtentStyle?: CacheExtentStyle | null;
        readonly scrollCacheExtent?: ScrollCacheExtent | null;
        readonly clipBehavior?: Clip;
    }) {
        const _initialField0 = verticalOffset;
        const _initialField1 = verticalAxisDirection;
        const _initialField2 = horizontalOffset;
        const _initialField3 = horizontalAxisDirection;
        const _initialField4 = delegate;
        const _initialField5 = mainAxis;
        /**
         * @dartType double?
         * @dartTypeOrigin inferred
         */
        const _initialField6 = cacheExtent;
        const _initialField7 = cacheExtentStyle;
        const _initialField8 = scrollCacheExtent;
        const _initialField9 = clipBehavior;
        if (FoundationBuildMode.debug)
            invariant(verticalAxisDirection === AxisDirection.down || verticalAxisDirection === AxisDirection.up, "source-two-dimensional-viewport", "TwoDimensionalViewport.verticalAxisDirection is not Axis.vertical.");
        if (FoundationBuildMode.debug)
            invariant(horizontalAxisDirection === AxisDirection.left || horizontalAxisDirection === AxisDirection.right, "source-two-dimensional-viewport", "TwoDimensionalViewport.horizontalAxisDirection is not Axis.horizontal.");
        super({ key: key });
        this.verticalOffset = _initialField0;
        this.verticalAxisDirection = _initialField1;
        this.horizontalOffset = _initialField2;
        this.horizontalAxisDirection = _initialField3;
        this.mainAxis = _initialField5;
        this.cacheExtent = _initialField6;
        this.cacheExtentStyle = _initialField7;
        this.scrollCacheExtent = _initialField8;
        this.clipBehavior = _initialField9;
        this.delegate = _initialField4;
        protect(this, ["verticalOffset", "verticalAxisDirection", "horizontalOffset", "horizontalAxisDirection", "mainAxis", "cacheExtent", "cacheExtentStyle", "scrollCacheExtent", "clipBehavior", "delegate"]);
    }
    override createElement(): RenderObjectElement {
        return new SourceTwoDimensionalViewportElement(this);
    }
    abstract override createRenderObject(context: BuildContext): SourceRenderTwoDimensionalViewport;
    abstract override updateRenderObject(context: BuildContext, renderObject: SourceRenderTwoDimensionalViewport): void;
}
export class SourceTwoDimensionalViewportElement extends TwoDimensionalElementHost implements SourceTwoDimensionalChildManager {
    sourceVicinityToChild: DartMap<ChildVicinity, Element>;
    sourceKeyToChild: DartMap<Key, Element>;
    sourceNewVicinityToChild: DartMap<ChildVicinity, Element> | null;
    sourceNewKeyToChild: DartMap<Key, Element> | null;
    constructor(widget: RenderObjectWidget) {
        const _initialField0 = (() => {
            const _dartTemporary0 = createChildVicinityElementMap();
            return _dartTemporary0;
        })();
        const _initialField1 = (() => {
            const _dartTemporary1 = createKeyElementMap();
            return _dartTemporary1;
        })();
        super(widget);
        this.sourceVicinityToChild = _initialField0;
        this.sourceKeyToChild = _initialField1;
        this.sourceNewVicinityToChild = null;
        this.sourceNewKeyToChild = null;
    }
    override get sourceRenderObject(): SourceRenderTwoDimensionalViewport {
        return castSourceRenderTwoDimensionalViewport(super.sourceRenderObject);
    }
    override sourcePerformRebuild(): void {
        super.performRebuildBase();
        this.sourceRenderObject.markNeedsLayout({ withDelegateRebuild: true });
    }
    override forgetChild(child: Element): void {
        if (FoundationBuildMode.debug)
            invariant(!this._dart_d3f54e1615a1e8f2_debugIsDoingLayout, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        super.forgetChild(child);
        this.sourceVicinityToChild.remove(twoDimensionalElementSlot(child));
        if (child.widget.key !== null) {
            this.sourceKeyToChild.remove(child.widget.key);
        }
    }
    override sourceInsertRenderObjectChild(child: RenderBox, slot: ChildVicinity): void {
        if (!(isWheelBox(child)))
            throw new TypeError("Invalid covariant argument: child");
        if (!(isChildVicinity(slot)))
            throw new TypeError("Invalid covariant argument: slot");
        this.sourceRenderObject._dart_d3f54e1615a1e8f2_insertChild(child, slot);
    }
    override sourceMoveRenderObjectChild(child: RenderBox, oldSlot: ChildVicinity, newSlot: ChildVicinity): void {
        if (!(isWheelBox(child)))
            throw new TypeError("Invalid covariant argument: child");
        if (!(isChildVicinity(oldSlot)))
            throw new TypeError("Invalid covariant argument: oldSlot");
        if (!(isChildVicinity(newSlot)))
            throw new TypeError("Invalid covariant argument: newSlot");
        this.sourceRenderObject._dart_d3f54e1615a1e8f2_moveChild(child, { from: oldSlot, to: newSlot });
    }
    override sourceRemoveRenderObjectChild(child: RenderBox, slot: ChildVicinity): void {
        if (!(isWheelBox(child)))
            throw new TypeError("Invalid covariant argument: child");
        if (!(isChildVicinity(slot)))
            throw new TypeError("Invalid covariant argument: slot");
        this.sourceRenderObject._dart_d3f54e1615a1e8f2_removeChild(child, slot);
    }
    override visitChildren(visitor: (argument0: Element) => void): void {
        this.sourceVicinityToChild.values.forEach(visitor);
    }
    override debugDescribeChildren(): DartMutableList<DiagnosticsNode> {
        const children: DartMutableList<Element> = (() => {
            const _dartTemporary2 = this.sourceVicinityToChild.values.toList();
            twoDimensionalListSort(_dartTemporary2, SourceTwoDimensionalViewportElement._dart_d3f54e1615a1e8f2_compareChildren);
            return _dartTemporary2;
        })();
        return (() => {
            const _dartTemporary3: DiagnosticsNode[] = [];
            for (const _dartTemporary4 of children) {
                const child: Element = _dartTemporary4;
                _dartTemporary3.push(child.toDiagnosticsNode({ name: twoDimensionalObjectString(twoDimensionalElementSlot(child)) }));
            }
            return _dartTemporary3;
        })();
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    static _dart_d3f54e1615a1e8f2_compareChildren(a: Element, b: Element): number {
        const aSlot: ChildVicinity = castChildVicinity((() => {
            const _dartTemporary5 = twoDimensionalElementSlot(a);
            if (_dartTemporary5 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary5!;
        })());
        const bSlot: ChildVicinity = castChildVicinity((() => {
            const _dartTemporary6 = twoDimensionalElementSlot(b);
            if (_dartTemporary6 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary6!;
        })());
        return checkedInteger(aSlot.compareTo(bSlot));
    }
    get _dart_d3f54e1615a1e8f2_debugIsDoingLayout(): boolean {
        return this.sourceNewKeyToChild !== null && this.sourceNewVicinityToChild !== null;
    }
    _dart_d3f54e1615a1e8f2_startLayout(): void {
        if (FoundationBuildMode.debug)
            invariant(!this._dart_d3f54e1615a1e8f2_debugIsDoingLayout, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        this.sourceNewVicinityToChild = (() => {
            const _dartTemporary7 = createChildVicinityElementMap();
            return _dartTemporary7;
        })();
        this.sourceNewKeyToChild = (() => {
            const _dartTemporary8 = createKeyElementMap();
            return _dartTemporary8;
        })();
    }
    _dart_d3f54e1615a1e8f2_buildChild(vicinity: ChildVicinity): void {
        if (FoundationBuildMode.debug)
            invariant(this._dart_d3f54e1615a1e8f2_debugIsDoingLayout, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        twoDimensionalBuildScope((() => {
            const _dartTemporary22 = this.owner;
            if (_dartTemporary22 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary22!;
        })(), this, (): void => {
            const newWidget: Widget | null = (castSourceTwoDimensionalViewport(this.widget)).delegate.build(this, vicinity);
            if (newWidget === null) {
                return;
            }
            const oldElement: Element | null = this._dart_d3f54e1615a1e8f2_retrieveOldElement(newWidget as Widget, vicinity);
            const newChild: Element | null = this.updateChild(oldElement, newWidget as Widget, vicinity);
            if (FoundationBuildMode.debug)
                invariant(newChild !== null, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            if (FoundationBuildMode.debug)
                invariant(dartMapRead((() => {
                    const _dartTemporary9 = this.sourceNewVicinityToChild;
                    if (_dartTemporary9 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary9!;
                })(), vicinity) === null, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            (() => {
                const _dartTemporary13 = (() => {
                    const _dartTemporary12 = this.sourceNewVicinityToChild;
                    if (_dartTemporary12 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary12!;
                })();
                const _dartTemporary10 = vicinity;
                const _dartTemporary11 = (() => {
                    const _dartTemporary14 = newChild;
                    if (_dartTemporary14 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary14!;
                })();
                dartMapWrite(_dartTemporary13, _dartTemporary10, _dartTemporary11);
                return _dartTemporary11;
            })();
            if ((newWidget as Widget).key !== null) {
                if (FoundationBuildMode.debug)
                    invariant(dartMapRead((() => {
                        const _dartTemporary16 = this.sourceNewKeyToChild;
                        if (_dartTemporary16 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary16!;
                    })(), (() => {
                        const _dartTemporary15 = (newWidget as Widget).key;
                        if (_dartTemporary15 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary15!;
                    })()) === null, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
                (() => {
                    const _dartTemporary20 = (() => {
                        const _dartTemporary19 = this.sourceNewKeyToChild;
                        if (_dartTemporary19 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary19!;
                    })();
                    const _dartTemporary17 = (() => {
                        const _dartTemporary21 = (newWidget as Widget).key;
                        if (_dartTemporary21 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary21!;
                    })();
                    const _dartTemporary18 = newChild as Element;
                    dartMapWrite(_dartTemporary20, _dartTemporary17, _dartTemporary18);
                    return _dartTemporary18;
                })();
            }
        });
    }
    _dart_d3f54e1615a1e8f2_retrieveOldElement(newWidget: Widget, vicinity: ChildVicinity): Element | null {
        if (newWidget.key !== null) {
            const result: Element | null = this.sourceKeyToChild.remove(newWidget.key);
            if (result !== null) {
                this.sourceVicinityToChild.remove(twoDimensionalElementSlot(result as Element));
            }
            return result;
        }
        const potentialOldElement: Element | null = dartMapRead(this.sourceVicinityToChild, vicinity);
        if (potentialOldElement !== null && (potentialOldElement as Element).widget.key === null) {
            return this.sourceVicinityToChild.remove(vicinity);
        }
        return null;
    }
    _dart_d3f54e1615a1e8f2_reuseChild(vicinity: ChildVicinity): void {
        if (FoundationBuildMode.debug)
            invariant(this._dart_d3f54e1615a1e8f2_debugIsDoingLayout, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        const elementToReuse: Element | null = this.sourceVicinityToChild.remove(vicinity);
        if (FoundationBuildMode.debug)
            invariant(elementToReuse !== null, "source-two-dimensional-viewport", `Expected to re-use an element at ${twoDimensionalObjectString(vicinity)}, but none was found.`);
        (() => {
            const _dartTemporary26 = (() => {
                const _dartTemporary25 = this.sourceNewVicinityToChild;
                if (_dartTemporary25 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary25!;
            })();
            const _dartTemporary23 = vicinity;
            const _dartTemporary24 = (() => {
                const _dartTemporary27 = elementToReuse;
                if (_dartTemporary27 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary27!;
            })();
            dartMapWrite(_dartTemporary26, _dartTemporary23, _dartTemporary24);
            return _dartTemporary24;
        })();
        if ((elementToReuse as Element).widget.key !== null) {
            if (FoundationBuildMode.debug)
                invariant(this.sourceKeyToChild.containsKey((elementToReuse as Element).widget.key), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            if (FoundationBuildMode.debug)
                invariant(dartMapRead(this.sourceKeyToChild, (elementToReuse as Element).widget.key) === elementToReuse as Element, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            (() => {
                const _dartTemporary31 = (() => {
                    const _dartTemporary30 = this.sourceNewKeyToChild;
                    if (_dartTemporary30 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary30!;
                })();
                const _dartTemporary28 = (() => {
                    const _dartTemporary32 = (elementToReuse as Element).widget.key;
                    if (_dartTemporary32 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary32!;
                })();
                const _dartTemporary29 = (() => {
                    const _dartTemporary33 = this.sourceKeyToChild.remove((elementToReuse as Element).widget.key);
                    if (_dartTemporary33 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary33!;
                })();
                dartMapWrite(_dartTemporary31, _dartTemporary28, _dartTemporary29);
                return _dartTemporary29;
            })();
        }
    }
    _dart_d3f54e1615a1e8f2_endLayout(): void {
        if (FoundationBuildMode.debug)
            invariant(this._dart_d3f54e1615a1e8f2_debugIsDoingLayout, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        for (const _dartTemporary34 of this.sourceVicinityToChild.values) {
            const element: Element = _dartTemporary34;
            {
                if (element.widget.key === null) {
                    this.updateChild(element, null, null);
                }
                else {
                    if (FoundationBuildMode.debug)
                        invariant(this.sourceKeyToChild.containsValue(element), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
                }
            }
        }
        for (const _dartTemporary35 of this.sourceKeyToChild.values) {
            const element: Element = _dartTemporary35;
            {
                if (FoundationBuildMode.debug)
                    invariant(element.widget.key !== null, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
                this.updateChild(element, null, null);
            }
        }
        this.sourceVicinityToChild = (() => {
            const _dartTemporary36 = this.sourceNewVicinityToChild;
            if (_dartTemporary36 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary36!;
        })();
        this.sourceKeyToChild = (() => {
            const _dartTemporary37 = this.sourceNewKeyToChild;
            if (_dartTemporary37 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary37!;
        })();
        this.sourceNewVicinityToChild = null;
        this.sourceNewKeyToChild = null;
        if (FoundationBuildMode.debug)
            invariant(!this._dart_d3f54e1615a1e8f2_debugIsDoingLayout, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
    }
}
export class SourceTwoDimensionalViewportParentData extends TwoDimensionalParentDataHost {
    layoutOffset: Offset | null;
    vicinity: ChildVicinity;
    _dart_d3f54e1615a1e8f2_paintExtent: Size | null;
    _dart_d3f54e1615a1e8f2_previousSibling: RenderBox | null;
    _dart_d3f54e1615a1e8f2_nextSibling: RenderBox | null;
    paintOffset: Offset | null;
    constructor() {
        const _initialField0 = ChildVicinity.invalid;
        super();
        this.layoutOffset = null;
        this.vicinity = _initialField0;
        this._dart_d3f54e1615a1e8f2_paintExtent = null;
        this._dart_d3f54e1615a1e8f2_previousSibling = null;
        this._dart_d3f54e1615a1e8f2_nextSibling = null;
        this.paintOffset = null;
    }
    get isVisible(): boolean {
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                if (this._dart_d3f54e1615a1e8f2_paintExtent === null) {
                    (() => {
                        const _dartTemporary38 = FlutterError.fromParts([new ErrorSummary("The paint extent of the child has not been determined yet."), new ErrorDescription("The paint extent, and therefore the visibility, of a child of a RenderTwoDimensionalViewport is computed after RenderTwoDimensionalViewport.layoutChildSequence.")]);
                        throw _dartTemporary38;
                    })();
                }
                return true;
            })(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return !(() => {
            const _dartTemporary39 = this._dart_d3f54e1615a1e8f2_paintExtent;
            const _dartTemporary40 = Size.zero;
            return _dartTemporary39 === null || _dartTemporary40 === null ? _dartTemporary39 === _dartTemporary40 : _dartTemporary39.equals(_dartTemporary40);
        })() || (() => {
            const _dartTemporary41 = this._dart_d3f54e1615a1e8f2_paintExtent;
            if (_dartTemporary41 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary41!;
        })().height !== 0 || (() => {
            const _dartTemporary42 = this._dart_d3f54e1615a1e8f2_paintExtent;
            if (_dartTemporary42 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary42!;
        })().width !== 0;
    }
    override get keptAlive(): boolean {
        return this.keepAlive && !this.isVisible;
    }
    override toString(): string {
        return `vicinity=${twoDimensionalObjectString(this.vicinity)}; layoutOffset=${(() => {
            const _dartTemporary43 = this.layoutOffset;
            return _dartTemporary43 === null ? "null" : twoDimensionalObjectString(_dartTemporary43);
        })()}; paintOffset=${(() => {
            const _dartTemporary44 = this.paintOffset;
            return _dartTemporary44 === null ? "null" : twoDimensionalObjectString(_dartTemporary44);
        })()}; ${this._dart_d3f54e1615a1e8f2_paintExtent === null ? "not visible; " : `${!this.isVisible ? "not " : ""}visible - paintExtent=${(() => {
            const _dartTemporary45 = this._dart_d3f54e1615a1e8f2_paintExtent;
            return _dartTemporary45 === null ? "null" : twoDimensionalObjectString(_dartTemporary45);
        })()}; `}${this.keepAlive ? "keepAlive; " : ""}`;
    }
}
export abstract class SourceRenderTwoDimensionalViewport extends TwoDimensionalRenderHost implements TwoDimensionalViewportContract {
    _dart_d3f54e1615a1e8f2_horizontalOffset: ViewportOffset;
    _dart_d3f54e1615a1e8f2_horizontalAxisDirection: AxisDirection;
    _dart_d3f54e1615a1e8f2_verticalOffset: ViewportOffset;
    _dart_d3f54e1615a1e8f2_verticalAxisDirection: AxisDirection;
    _dart_d3f54e1615a1e8f2_delegate: SourceTwoDimensionalChildDelegate;
    _dart_d3f54e1615a1e8f2_mainAxis: Axis;
    _dart_d3f54e1615a1e8f2_scrollCacheExtent: ScrollCacheExtent;
    _dart_d3f54e1615a1e8f2_clipBehavior: Clip;
    readonly _dart_d3f54e1615a1e8f2_childManager: SourceTwoDimensionalChildManager;
    readonly sourceChildren: DartMap<ChildVicinity, RenderBox>;
    readonly sourceActiveChildren: DartMap<ChildVicinity, RenderBox>;
    readonly sourceKeepAliveBucket: DartMap<ChildVicinity, RenderBox>;
    get sourceDanglingKeepAlives(): DartMutableList<RenderBox> {
        return dartLateRead<DartMutableList<RenderBox>>(this, "package:flutter/src/widgets/two_dimensional_viewport.dart::RenderTwoDimensionalViewport._debugDanglingKeepAlives:FIELD", "_debugDanglingKeepAlives");
    }
    set sourceDanglingKeepAlives(value: DartMutableList<RenderBox>) {
        dartLateWrite<DartMutableList<RenderBox>>(this, "package:flutter/src/widgets/two_dimensional_viewport.dart::RenderTwoDimensionalViewport._debugDanglingKeepAlives:FIELD", "_debugDanglingKeepAlives", value, false);
    }
    _dart_d3f54e1615a1e8f2_hasVisualOverflow: boolean;
    readonly _dart_d3f54e1615a1e8f2_clipRectLayer: LayerHandle<ClipRectLayer>;
    readonly sourceCurrentVicinities: DartMutableList<ChildVicinity>;
    sourceFirstChild: RenderBox | null;
    sourceLastChild: RenderBox | null;
    sourceDidResize: boolean;
    sourceNeedsDelegateRebuild: boolean;
    sourceDebugOrphans: DartMutableList<RenderBox> | null;
    /**
     * @dartParam cacheExtent double?
     * @dartParamOrigin cacheExtent explicit
     */
    constructor({ horizontalOffset, horizontalAxisDirection, verticalOffset, verticalAxisDirection, delegate, mainAxis, childManager, cacheExtent = null, cacheExtentStyle = null, scrollCacheExtent = null, clipBehavior = "hardEdge" }: {
        readonly horizontalOffset: ViewportOffset;
        readonly horizontalAxisDirection: AxisDirection;
        readonly verticalOffset: ViewportOffset;
        readonly verticalAxisDirection: AxisDirection;
        readonly delegate: SourceTwoDimensionalChildDelegate;
        readonly mainAxis: Axis;
        readonly childManager: SourceTwoDimensionalChildManager;
        readonly cacheExtent?: number | null;
        readonly cacheExtentStyle?: CacheExtentStyle | null;
        readonly scrollCacheExtent?: ScrollCacheExtent | null;
        readonly clipBehavior?: Clip;
    }) {
        const _initialField0 = (() => {
            const _dartTemporary46 = createChildVicinityRenderBoxMap();
            return _dartTemporary46;
        })();
        const _initialField1 = (() => {
            const _dartTemporary47 = createChildVicinityRenderBoxMap();
            return _dartTemporary47;
        })();
        const _initialField2 = (() => {
            const _dartTemporary48 = createChildVicinityRenderBoxMap();
            return _dartTemporary48;
        })();
        const _initialField3 = false;
        const _initialField4 = createWheelClipHandle();
        const _initialField5: DartMutableList<ChildVicinity> = [];
        const _initialField6 = true;
        const _initialField7 = true;
        const _initialField8 = horizontalOffset;
        const _initialField9 = verticalOffset;
        const _initialField10 = delegate;
        const _initialField11 = mainAxis;
        const _initialField12 = childManager;
        const _initialField13 = clipBehavior;
        if (FoundationBuildMode.debug)
            invariant(verticalAxisDirection === AxisDirection.down || verticalAxisDirection === AxisDirection.up, "source-two-dimensional-viewport", "TwoDimensionalViewport.verticalAxisDirection is not Axis.vertical.");
        if (FoundationBuildMode.debug)
            invariant(horizontalAxisDirection === AxisDirection.left || horizontalAxisDirection === AxisDirection.right, "source-two-dimensional-viewport", "TwoDimensionalViewport.horizontalAxisDirection is not Axis.horizontal.");
        const _initialField14 = horizontalAxisDirection;
        const _initialField15 = verticalAxisDirection;
        const _initialField16 = scrollCacheExtent ?? (cacheExtent !== null ? (() => {
            const _dartTemporary49 = cacheExtentStyle;
            switch (_dartTemporary49) {
                case CacheExtentStyle.pixel: return ScrollCacheExtent.pixels(cacheExtent as number);
                case null: return ScrollCacheExtent.pixels(cacheExtent as number);
                case CacheExtentStyle.viewport: return ScrollCacheExtent.viewport(cacheExtent as number);
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })() : constantPixelCacheExtent(ScrollCacheExtent, 250));
        super();
        this._dart_d3f54e1615a1e8f2_horizontalOffset = _initialField8;
        this._dart_d3f54e1615a1e8f2_horizontalAxisDirection = _initialField14;
        this._dart_d3f54e1615a1e8f2_verticalOffset = _initialField9;
        this._dart_d3f54e1615a1e8f2_verticalAxisDirection = _initialField15;
        this._dart_d3f54e1615a1e8f2_delegate = _initialField10;
        this._dart_d3f54e1615a1e8f2_mainAxis = _initialField11;
        this._dart_d3f54e1615a1e8f2_scrollCacheExtent = _initialField16;
        this._dart_d3f54e1615a1e8f2_clipBehavior = _initialField13;
        this._dart_d3f54e1615a1e8f2_childManager = _initialField12;
        this.sourceChildren = _initialField0;
        this.sourceActiveChildren = _initialField1;
        this.sourceKeepAliveBucket = _initialField2;
        this._dart_d3f54e1615a1e8f2_hasVisualOverflow = _initialField3;
        this._dart_d3f54e1615a1e8f2_clipRectLayer = _initialField4;
        this.sourceCurrentVicinities = _initialField5;
        this.sourceFirstChild = null;
        this.sourceLastChild = null;
        this.sourceDidResize = _initialField6;
        this.sourceNeedsDelegateRebuild = _initialField7;
        this.sourceDebugOrphans = null;
        protect(this, ["_dart_d3f54e1615a1e8f2_childManager", "sourceChildren", "sourceActiveChildren", "sourceKeepAliveBucket", "_dart_d3f54e1615a1e8f2_clipRectLayer", "sourceCurrentVicinities"]);
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                this.sourceDanglingKeepAlives = [];
                return true;
            })(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
    }
    get horizontalOffset(): ViewportOffset {
        return this._dart_d3f54e1615a1e8f2_horizontalOffset;
    }
    set horizontalOffset(value: ViewportOffset) {
        if (this._dart_d3f54e1615a1e8f2_horizontalOffset === value) {
            return;
        }
        if (this.attached) {
            this._dart_d3f54e1615a1e8f2_horizontalOffset.removeListener(dartMethodTearOff(this, this.markNeedsLayout));
        }
        this._dart_d3f54e1615a1e8f2_horizontalOffset = value;
        if (this.attached) {
            this._dart_d3f54e1615a1e8f2_horizontalOffset.addListener(dartMethodTearOff(this, this.markNeedsLayout));
        }
        this.markNeedsLayout();
    }
    get horizontalAxisDirection(): AxisDirection {
        return this._dart_d3f54e1615a1e8f2_horizontalAxisDirection;
    }
    set horizontalAxisDirection(value: AxisDirection) {
        if (this._dart_d3f54e1615a1e8f2_horizontalAxisDirection === value) {
            return;
        }
        this._dart_d3f54e1615a1e8f2_horizontalAxisDirection = value;
        this.markNeedsLayout();
    }
    get verticalOffset(): ViewportOffset {
        return this._dart_d3f54e1615a1e8f2_verticalOffset;
    }
    set verticalOffset(value: ViewportOffset) {
        if (this._dart_d3f54e1615a1e8f2_verticalOffset === value) {
            return;
        }
        if (this.attached) {
            this._dart_d3f54e1615a1e8f2_verticalOffset.removeListener(dartMethodTearOff(this, this.markNeedsLayout));
        }
        this._dart_d3f54e1615a1e8f2_verticalOffset = value;
        if (this.attached) {
            this._dart_d3f54e1615a1e8f2_verticalOffset.addListener(dartMethodTearOff(this, this.markNeedsLayout));
        }
        this.markNeedsLayout();
    }
    get verticalAxisDirection(): AxisDirection {
        return this._dart_d3f54e1615a1e8f2_verticalAxisDirection;
    }
    set verticalAxisDirection(value: AxisDirection) {
        if (this._dart_d3f54e1615a1e8f2_verticalAxisDirection === value) {
            return;
        }
        this._dart_d3f54e1615a1e8f2_verticalAxisDirection = value;
        this.markNeedsLayout();
    }
    get delegate(): SourceTwoDimensionalChildDelegate {
        return this._dart_d3f54e1615a1e8f2_delegate;
    }
    set delegate(value: SourceTwoDimensionalChildDelegate) {
        if (!(isTwoDimensionalChildDelegate(value)))
            throw new TypeError("Invalid covariant argument: value");
        if (this._dart_d3f54e1615a1e8f2_delegate === value) {
            return;
        }
        if (this.attached) {
            this._dart_d3f54e1615a1e8f2_delegate.removeListener(dartMethodTearOff(this, this._dart_d3f54e1615a1e8f2_handleDelegateNotification));
        }
        const oldDelegate: SourceTwoDimensionalChildDelegate = this._dart_d3f54e1615a1e8f2_delegate;
        this._dart_d3f54e1615a1e8f2_delegate = value;
        if (this.attached) {
            this._dart_d3f54e1615a1e8f2_delegate.addListener(dartMethodTearOff(this, this._dart_d3f54e1615a1e8f2_handleDelegateNotification));
        }
        if (!(twoDimensionalRuntimeType(this._dart_d3f54e1615a1e8f2_delegate) === twoDimensionalRuntimeType(oldDelegate)) || this._dart_d3f54e1615a1e8f2_delegate.shouldRebuild(oldDelegate)) {
            this._dart_d3f54e1615a1e8f2_handleDelegateNotification();
        }
    }
    get mainAxis(): Axis {
        return this._dart_d3f54e1615a1e8f2_mainAxis;
    }
    set mainAxis(value: Axis) {
        if (this._dart_d3f54e1615a1e8f2_mainAxis === value) {
            return;
        }
        this._dart_d3f54e1615a1e8f2_mainAxis = value;
        this.markNeedsLayout();
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get cacheExtent(): number {
        return this._dart_d3f54e1615a1e8f2_scrollCacheExtent.value;
    }
    /**
     * @dartParam value double?
     * @dartParamOrigin value explicit
     */
    set cacheExtent(value: number | null) {
        if (value === this.cacheExtent) {
            return;
        }
        if (value === null) {
            this._dart_d3f54e1615a1e8f2_scrollCacheExtent = constantPixelCacheExtent(ScrollCacheExtent, 250);
        }
        else {
            this._dart_d3f54e1615a1e8f2_scrollCacheExtent = (() => {
                const _dartTemporary50 = this.cacheExtentStyle;
                switch (_dartTemporary50) {
                    case CacheExtentStyle.pixel: return ScrollCacheExtent.pixels(value as number);
                    case CacheExtentStyle.viewport: return ScrollCacheExtent.viewport(value as number);
                    default: throw new TypeError("Non-exhaustive Dart switch expression");
                }
            })();
        }
        this.markNeedsLayout();
    }
    get cacheExtentStyle(): CacheExtentStyle {
        return this._dart_d3f54e1615a1e8f2_scrollCacheExtent.style;
    }
    set cacheExtentStyle(value: CacheExtentStyle | null) {
        if (value === this.cacheExtentStyle) {
            return;
        }
        if (value === null) {
            this._dart_d3f54e1615a1e8f2_scrollCacheExtent = ScrollCacheExtent.pixels(this.cacheExtent);
        }
        else {
            this._dart_d3f54e1615a1e8f2_scrollCacheExtent = (() => {
                const _dartTemporary51 = value as CacheExtentStyle;
                switch (_dartTemporary51) {
                    case CacheExtentStyle.pixel: return ScrollCacheExtent.pixels(this.cacheExtent);
                    case CacheExtentStyle.viewport: return ScrollCacheExtent.viewport(this.cacheExtent);
                    default: throw new TypeError("Non-exhaustive Dart switch expression");
                }
            })();
        }
        this.markNeedsLayout();
    }
    get scrollCacheExtent(): ScrollCacheExtent {
        return this._dart_d3f54e1615a1e8f2_scrollCacheExtent;
    }
    set scrollCacheExtent(value: ScrollCacheExtent | null) {
        if (this._dart_d3f54e1615a1e8f2_scrollCacheExtent === value) {
            return;
        }
        if (value === null) {
            this._dart_d3f54e1615a1e8f2_scrollCacheExtent = constantPixelCacheExtent(ScrollCacheExtent, 250);
        }
        else {
            this._dart_d3f54e1615a1e8f2_scrollCacheExtent = value as ScrollCacheExtent;
        }
        this.markNeedsLayout();
    }
    get clipBehavior(): Clip {
        return this._dart_d3f54e1615a1e8f2_clipBehavior;
    }
    set clipBehavior(value: Clip) {
        if (this._dart_d3f54e1615a1e8f2_clipBehavior === value) {
            return;
        }
        this._dart_d3f54e1615a1e8f2_clipBehavior = value;
        this.markNeedsPaint();
        this.markNeedsSemanticsUpdate();
    }
    override get isRepaintBoundary(): boolean {
        return true;
    }
    override get sizedByParent(): boolean {
        return true;
    }
    get firstChild(): RenderBox | null {
        return this.sourceFirstChild;
    }
    get lastChild(): RenderBox | null {
        return this.sourceLastChild;
    }
    childBefore(child: RenderBox): RenderBox | null {
        if (FoundationBuildMode.debug)
            invariant(wheelParent(child) === this, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return this.parentDataOf(child)._dart_d3f54e1615a1e8f2_previousSibling;
    }
    childAfter(child: RenderBox): RenderBox | null {
        if (FoundationBuildMode.debug)
            invariant(wheelParent(child) === this, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return this.parentDataOf(child)._dart_d3f54e1615a1e8f2_nextSibling;
    }
    _dart_d3f54e1615a1e8f2_handleDelegateNotification(): void {
        return this.markNeedsLayout({ withDelegateRebuild: true });
    }
    override setupParentData(child: RenderBox): void {
        if (!(isWheelBox(child)))
            throw new TypeError("Invalid covariant argument: child");
        if (!isSourceTwoDimensionalViewportParentData(wheelParentData(child))) {
            child.parentData = new SourceTwoDimensionalViewportParentData();
        }
    }
    parentDataOf(child: RenderBox): SourceTwoDimensionalViewportParentData {
        if (FoundationBuildMode.debug)
            invariant(this.sourceChildren.containsValue(child) || this.sourceKeepAliveBucket.containsValue(child) || twoDimensionalContainsBox((() => {
                const _dartTemporary52 = this.sourceDebugOrphans;
                if (_dartTemporary52 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary52!;
            })(), child), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return castSourceTwoDimensionalViewportParentData((() => {
            const _dartTemporary53 = wheelParentData(child);
            if (_dartTemporary53 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary53!;
        })());
    }
    getChildFor(vicinity: ChildVicinity): RenderBox | null {
        if (!(isChildVicinity(vicinity)))
            throw new TypeError("Invalid covariant argument: vicinity");
        return dartMapRead(this.sourceChildren, vicinity);
    }
    override attach(owner: PipelineOwner): void {
        super.attach(owner);
        this._dart_d3f54e1615a1e8f2_horizontalOffset.addListener(dartMethodTearOff(this, this.markNeedsLayout));
        this._dart_d3f54e1615a1e8f2_verticalOffset.addListener(dartMethodTearOff(this, this.markNeedsLayout));
        this._dart_d3f54e1615a1e8f2_delegate.addListener(dartMethodTearOff(this, this._dart_d3f54e1615a1e8f2_handleDelegateNotification));
        for (const _dartTemporary54 of this.sourceChildren.values) {
            const child: RenderBox = _dartTemporary54;
            {
                child.attach(owner);
            }
        }
        for (const _dartTemporary55 of this.sourceKeepAliveBucket.values) {
            const child: RenderBox = _dartTemporary55;
            {
                child.attach(owner);
            }
        }
    }
    override detach(): void {
        super.detach();
        this._dart_d3f54e1615a1e8f2_horizontalOffset.removeListener(dartMethodTearOff(this, this.markNeedsLayout));
        this._dart_d3f54e1615a1e8f2_verticalOffset.removeListener(dartMethodTearOff(this, this.markNeedsLayout));
        this._dart_d3f54e1615a1e8f2_delegate.removeListener(dartMethodTearOff(this, this._dart_d3f54e1615a1e8f2_handleDelegateNotification));
        for (const _dartTemporary56 of this.sourceChildren.values) {
            const child: RenderBox = _dartTemporary56;
            {
                child.detach();
            }
        }
        for (const _dartTemporary57 of this.sourceKeepAliveBucket.values) {
            const child: RenderBox = _dartTemporary57;
            {
                child.detach();
            }
        }
    }
    override redepthChildren(): void {
        for (const _dartTemporary58 of this.sourceChildren.values) {
            const child: RenderBox = _dartTemporary58;
            {
                child.redepthChildren();
            }
        }
        this.sourceKeepAliveBucket.values.forEach(dartMethodTearOff(this, this.sourceRedepthChild));
    }
    override visitChildren(visitor: (argument0: RenderObject) => void): void {
        let child: RenderBox | null = this.sourceFirstChild;
        while (child !== null) {
            visitor(child as RenderBox);
            child = this.parentDataOf(child as RenderBox)._dart_d3f54e1615a1e8f2_nextSibling;
        }
        this.sourceKeepAliveBucket.values.forEach(visitor);
    }
    override visitChildrenForSemantics(visitor: (argument0: RenderObject) => void): void {
        let child: RenderBox | null = this.sourceFirstChild;
        while (child !== null) {
            const childParentData: SourceTwoDimensionalViewportParentData = this.parentDataOf(child as RenderBox);
            visitor(child as RenderBox);
            child = childParentData._dart_d3f54e1615a1e8f2_nextSibling;
        }
    }
    override debugDescribeChildren(): DartMutableList<DiagnosticsNode> {
        const debugChildren: DartMutableList<DiagnosticsNode> = (() => {
            const _dartTemporary59: DiagnosticsNode[] = [];
            {
                const _dartTemporary60 = this.sourceChildren.keys.map((vicinity: ChildVicinity): DiagnosticsNode => {
                    return (() => {
                        const _dartTemporary62 = dartMapRead(this.sourceChildren, vicinity);
                        if (_dartTemporary62 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary62!;
                    })().toDiagnosticsNode({ name: vicinity.toString() });
                });
                for (const _dartTemporary61 of _dartTemporary60)
                    _dartTemporary59.push(_dartTemporary61);
            }
            return _dartTemporary59;
        })();
        return debugChildren;
    }
    override computeDryLayout(constraints: BoxConstraints): Size {
        if (!(isWheelConstraints(constraints)))
            throw new TypeError("Invalid covariant argument: constraints");
        if (FoundationBuildMode.debug)
            invariant(debugCheckHasBoundedAxis(Axis.vertical, constraints), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        if (FoundationBuildMode.debug)
            invariant(debugCheckHasBoundedAxis(Axis.horizontal, constraints), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return wheelConstraintsBiggest(constraints);
    }
    override sourceHitTestChildren(result: TwoDimensionalHitTestResult, { position }: {
        readonly position: Offset;
    }): boolean {
        for (const _dartTemporary64 of this.sourceChildren.values) {
            const child: RenderBox = _dartTemporary64;
            {
                const childParentData: SourceTwoDimensionalViewportParentData = this.parentDataOf(child);
                if (!childParentData.isVisible) {
                    continue;
                }
                const isHit: boolean = result.addWithPaintOffset({ offset: childParentData.paintOffset, position: position, hitTest: (result: TwoDimensionalHitTestResult, transformed: Offset): boolean => {
                        if (FoundationBuildMode.debug)
                            invariant(transformed.equals(position.subtract((() => {
                                const _dartTemporary63 = childParentData.paintOffset;
                                if (_dartTemporary63 === null)
                                    throw new TypeError("Null check operator used on a null value");
                                return _dartTemporary63!;
                            })())), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
                        return wheelBoxHitTest(child, result, { position: transformed });
                    } });
                if (isHit) {
                    return true;
                }
            }
        }
        return false;
    }
    get viewportDimension(): Size {
        if (FoundationBuildMode.debug)
            invariant(this.hasSize, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return this.sourceSize;
    }
    override performResize(): void {
        const oldSize: Size | null = this.hasSize ? this.sourceSize : null;
        super.performResize();
        this.horizontalOffset.applyViewportDimension(this.sourceSize.width);
        this.verticalOffset.applyViewportDimension(this.sourceSize.height);
        if (!(() => {
            const _dartTemporary65 = oldSize;
            const _dartTemporary66 = this.sourceSize;
            return _dartTemporary65 === null || _dartTemporary66 === null ? _dartTemporary65 === _dartTemporary66 : _dartTemporary65.equals(_dartTemporary66);
        })()) {
            this.sourceDidResize = true;
        }
    }
    /**
     * @dartParam alignment double
     * @dartParamOrigin alignment explicit
     */
    sourceGetOffsetToReveal(target: RenderObject, alignment: number, { rect = null, axis = null }: {
        readonly rect?: Rect | null;
        readonly axis?: Axis | null;
    } = {}): RevealedOffset {
        axis ??= this.mainAxis;
        const _dartTemporary67 = (() => {
            const _dartTemporary68 = axis as Axis;
            switch (_dartTemporary68) {
                case Axis.vertical: return dartRecord([this.verticalOffset.pixels, this.verticalAxisDirection] as const);
                case Axis.horizontal: return dartRecord([this.horizontalOffset.pixels, this.horizontalAxisDirection] as const);
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const offset: number = dartRecordRead(_dartTemporary67, 0, 2);
        const axisDirection: AxisDirection = dartRecordRead(_dartTemporary67, 1, 2);
        rect ??= wheelPaintBounds(target);
        let child: RenderObject = target;
        while (!(wheelParent(child) === this)) {
            child = (() => {
                const _dartTemporary69 = wheelParent(child);
                if (_dartTemporary69 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary69!;
            })();
        }
        if (FoundationBuildMode.debug)
            invariant(wheelParent(child) === this, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        const box: RenderBox = castWheelBox(child);
        const rectLocal: Rect = MatrixUtils.transformRect(wheelGetTransform(target, child as RenderBox), rect as Rect);
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        let leadingScrollOffset: number = offset;
        leadingScrollOffset += (() => {
            const _dartTemporary70 = axisDirection;
            switch (_dartTemporary70) {
                case AxisDirection.up: return wheelBoxSize(child as RenderBox).height - rectLocal.bottom;
                case AxisDirection.left: return wheelBoxSize(child as RenderBox).width - rectLocal.right;
                case AxisDirection.right: return rectLocal.left;
                case AxisDirection.down: return rectLocal.top;
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        const paintOffset: Offset = (() => {
            const _dartTemporary71 = this.parentDataOf(box).paintOffset;
            if (_dartTemporary71 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary71!;
        })();
        leadingScrollOffset += (() => {
            const _dartTemporary72 = axisDirection;
            switch (_dartTemporary72) {
                case AxisDirection.up: return this.viewportDimension.height - paintOffset.dy - wheelBoxSize(box).height;
                case AxisDirection.left: return this.viewportDimension.width - paintOffset.dx - wheelBoxSize(box).width;
                case AxisDirection.right: return paintOffset.dx;
                case AxisDirection.down: return paintOffset.dy;
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        const transform: Matrix4 = wheelGetTransform(target, this);
        let targetRect: Rect = MatrixUtils.transformRect(transform, rect as Rect);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const mainAxisExtentDifference: number = (() => {
            const _dartTemporary73 = axis as Axis;
            switch (_dartTemporary73) {
                case Axis.horizontal: return this.viewportDimension.width - rectLocal.width;
                case Axis.vertical: return this.viewportDimension.height - rectLocal.height;
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const targetOffset: number = leadingScrollOffset - mainAxisExtentDifference * alignment;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const offsetDifference: number = (() => {
            const _dartTemporary74 = axis as Axis;
            switch (_dartTemporary74) {
                case Axis.horizontal: return this.horizontalOffset.pixels - targetOffset;
                case Axis.vertical: return this.verticalOffset.pixels - targetOffset;
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        targetRect = (() => {
            const _dartTemporary75 = axisDirection;
            switch (_dartTemporary75) {
                case AxisDirection.up: return targetRect.translate(0, -offsetDifference);
                case AxisDirection.down: return targetRect.translate(0, offsetDifference);
                case AxisDirection.left: return targetRect.translate(-offsetDifference, 0);
                case AxisDirection.right: return targetRect.translate(offsetDifference, 0);
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        const revealedOffset: RevealedOffset = createWheelRevealedOffset({ offset: targetOffset, rect: targetRect });
        return revealedOffset;
    }
    override sourceShowOnScreen({ descendant = null, rect = null, duration = 0, curve = Curves.ease }: {
        readonly descendant?: RenderObject | null;
        readonly rect?: Rect | null;
        readonly duration?: number;
        readonly curve?: Curve;
    } = {}): void {
        const allowHorizontal: boolean = this.horizontalOffset.allowImplicitScrolling;
        const allowVertical: boolean = this.verticalOffset.allowImplicitScrolling;
        let axisDirection: AxisDirection | null = null;
        {
            const _dartTemporary76 = dartRecord([allowHorizontal, allowVertical] as const);
            switch (true) {
                case true && dartRecordRead(_dartTemporary76, 0, 2) === true && dartRecordRead(_dartTemporary76, 1, 2) === true: {
                    break;
                    break;
                }
                case true && dartRecordRead(_dartTemporary76, 0, 2) === false && dartRecordRead(_dartTemporary76, 1, 2) === true: {
                    axisDirection = this.verticalAxisDirection;
                    break;
                }
                case true && dartRecordRead(_dartTemporary76, 0, 2) === true && dartRecordRead(_dartTemporary76, 1, 2) === false: {
                    axisDirection = this.horizontalAxisDirection;
                    break;
                }
                case true && dartRecordRead(_dartTemporary76, 0, 2) === false && dartRecordRead(_dartTemporary76, 1, 2) === false: {
                    return super.sourceForwardShowOnScreen({ descendant: descendant, rect: rect, duration: duration, curve: curve });
                    break;
                }
            }
        }
        const newRect: Rect | null = SourceRenderTwoDimensionalViewport.showInViewport({ descendant: descendant, viewport: this, axisDirection: axisDirection, rect: rect, duration: duration, curve: curve });
        super.sourceForwardShowOnScreen({ rect: newRect, duration: duration, curve: curve });
    }
    static showInViewport({ descendant = null, rect = null, viewport, duration = 0, curve = Curves.ease, axisDirection = null }: {
        readonly descendant?: RenderObject | null;
        readonly rect?: Rect | null;
        readonly viewport: SourceRenderTwoDimensionalViewport;
        readonly duration?: number;
        readonly curve?: Curve;
        readonly axisDirection?: AxisDirection | null;
    }): Rect | null {
        if (descendant === null) {
            return rect;
        }
        const showVertical: (argument0: Rect | null) => Rect | null = (rect: Rect | null): Rect | null => {
            return SourceRenderTwoDimensionalViewport._dart_d3f54e1615a1e8f2_showInViewportForAxisDirection({ descendant: descendant as RenderObject, viewport: viewport, axis: Axis.vertical, rect: rect, duration: duration, curve: curve });
        };
        const showHorizontal: (argument0: Rect | null) => Rect | null = (rect: Rect | null): Rect | null => {
            return SourceRenderTwoDimensionalViewport._dart_d3f54e1615a1e8f2_showInViewportForAxisDirection({ descendant: descendant as RenderObject, viewport: viewport, axis: Axis.horizontal, rect: rect, duration: duration, curve: curve });
        };
        switch (axisDirection) {
            case AxisDirection.left:
            case AxisDirection.right: {
                return showHorizontal(rect);
                break;
            }
            case AxisDirection.up:
            case AxisDirection.down: {
                return showVertical(rect);
                break;
            }
            case null: {
                rect = showHorizontal(rect) ?? rect;
                rect = showVertical(rect);
                if (rect === null) {
                    if (FoundationBuildMode.debug)
                        invariant(wheelParent(viewport) !== null, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
                    const transform: Matrix4 = wheelGetTransform(descendant as RenderObject, wheelParent(viewport));
                    return MatrixUtils.transformRect(transform, rect ?? wheelPaintBounds(descendant as RenderObject));
                }
                return rect as Rect;
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
    }
    static _dart_d3f54e1615a1e8f2_showInViewportForAxisDirection({ descendant, rect = null, viewport, axis, duration = 0, curve = Curves.ease }: {
        readonly descendant: RenderObject;
        readonly rect?: Rect | null;
        readonly viewport: SourceRenderTwoDimensionalViewport;
        readonly axis: Axis;
        readonly duration?: number;
        readonly curve?: Curve;
    }): Rect | null {
        const offset: ViewportOffset = (() => {
            const _dartTemporary77 = axis;
            switch (_dartTemporary77) {
                case Axis.vertical: return viewport.verticalOffset;
                case Axis.horizontal: return viewport.horizontalOffset;
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        const leadingEdgeOffset: RevealedOffset = viewport.sourceGetOffsetToReveal(descendant, 0, { rect: rect, axis: axis });
        const trailingEdgeOffset: RevealedOffset = viewport.sourceGetOffsetToReveal(descendant, 1, { rect: rect, axis: axis });
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const currentOffset: number = offset.pixels;
        const targetOffset: RevealedOffset | null = RevealedOffset.clampOffset({ leadingEdgeOffset: leadingEdgeOffset, trailingEdgeOffset: trailingEdgeOffset, currentOffset: currentOffset });
        if (targetOffset === null) {
            return null;
        }
        twoDimensionalMoveTo(offset, (targetOffset as RevealedOffset).offset, { duration: duration, curve: curve });
        return (targetOffset as RevealedOffset).rect;
    }
    get didResize(): boolean {
        return this.sourceDidResize;
    }
    get needsDelegateRebuild(): boolean {
        return this.sourceNeedsDelegateRebuild;
    }
    override markNeedsLayout({ withDelegateRebuild = false }: {
        readonly withDelegateRebuild?: boolean;
    } = {}): void {
        this.sourceNeedsDelegateRebuild = this.sourceNeedsDelegateRebuild || withDelegateRebuild;
        super.markNeedsLayout();
    }
    abstract layoutChildSequence(): void;
    override sourcePerformLayout(): void {
        this.sourceFirstChild = null;
        this.sourceLastChild = null;
        this.sourceActiveChildren.clear();
        this._dart_d3f54e1615a1e8f2_childManager._dart_d3f54e1615a1e8f2_startLayout();
        this.layoutChildSequence();
        if (FoundationBuildMode.debug)
            invariant(this._dart_d3f54e1615a1e8f2_debugCheckContentDimensions(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        this.sourceDidResize = false;
        this.sourceNeedsDelegateRebuild = false;
        this._dart_d3f54e1615a1e8f2_cacheKeepAlives();
        this.sourceInvokeLayout((_: BoxConstraints): void => {
            this._dart_d3f54e1615a1e8f2_childManager._dart_d3f54e1615a1e8f2_endLayout();
            if (FoundationBuildMode.debug)
                invariant((() => {
                    const _dartTemporary78 = this.sourceDebugOrphans;
                    return _dartTemporary78 === null ? null : twoDimensionalIterableIsEmpty(_dartTemporary78);
                })() ?? true, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            if (FoundationBuildMode.debug)
                invariant(twoDimensionalIterableIsEmpty(this.sourceDanglingKeepAlives), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            if (FoundationBuildMode.debug)
                invariant(twoDimensionalIterableIsEmpty(this.sourceKeepAliveBucket.values.where((child: RenderBox): boolean => {
                    return !this.parentDataOf(child).keepAlive;
                })), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            this._dart_d3f54e1615a1e8f2_reifyChildren();
        });
    }
    _dart_d3f54e1615a1e8f2_cacheKeepAlives(): void {
        const remainingChildren: DartMutableList<RenderBox> = this.sourceChildren.values.toSet().difference(this.sourceActiveChildren.values.toSet()).toList();
        for (const _dartTemporary82 of remainingChildren) {
            const child: RenderBox = _dartTemporary82;
            {
                const childParentData: SourceTwoDimensionalViewportParentData = this.parentDataOf(child);
                if (childParentData.keepAlive) {
                    (() => {
                        const _dartTemporary81 = this.sourceKeepAliveBucket;
                        const _dartTemporary79 = childParentData.vicinity;
                        const _dartTemporary80 = child;
                        dartMapWrite(_dartTemporary81, _dartTemporary79, _dartTemporary80);
                        return _dartTemporary80;
                    })();
                    this._dart_d3f54e1615a1e8f2_childManager._dart_d3f54e1615a1e8f2_reuseChild(childParentData.vicinity);
                }
            }
        }
    }
    _dart_d3f54e1615a1e8f2_sortByYIndex(): void {
        twoDimensionalListSort(this.sourceCurrentVicinities, (a: ChildVicinity, b: ChildVicinity): number => {
            /**
             * @dartType int
             * @dartTypeOrigin explicit
             */
            const yComparison: number = checkedInteger(twoDimensionalNumberCompare(checkedInteger(a.yIndex), checkedInteger(b.yIndex)));
            if (checkedInteger(yComparison) !== 0) {
                return checkedInteger(yComparison);
            }
            return checkedInteger(twoDimensionalNumberCompare(checkedInteger(a.xIndex), checkedInteger(b.xIndex)));
        });
    }
    _dart_d3f54e1615a1e8f2_sortByXIndex(): void {
        twoDimensionalListSort(this.sourceCurrentVicinities);
    }
    _dart_d3f54e1615a1e8f2_reifyChildren(): void {
        if (FoundationBuildMode.debug)
            invariant(this.sourceFirstChild === null, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        if (FoundationBuildMode.debug)
            invariant(this.sourceLastChild === null, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        let previousChild: RenderBox | null = null;
        switch (this.mainAxis) {
            case Axis.vertical: {
                this._dart_d3f54e1615a1e8f2_sortByYIndex();
                break;
            }
            case Axis.horizontal: {
                this._dart_d3f54e1615a1e8f2_sortByXIndex();
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
        for (const _dartTemporary83 of this.sourceCurrentVicinities) {
            const vicinity: ChildVicinity = _dartTemporary83;
            {
                previousChild = this._dart_d3f54e1615a1e8f2_completeChildParentData(vicinity, { previousChild: previousChild }) ?? previousChild;
            }
        }
        this.sourceLastChild = previousChild;
        if (this.sourceLastChild !== null) {
            this.parentDataOf((() => {
                const _dartTemporary84 = this.sourceLastChild;
                if (_dartTemporary84 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary84!;
            })())._dart_d3f54e1615a1e8f2_nextSibling = null;
        }
        twoDimensionalListClear(this.sourceCurrentVicinities);
    }
    _dart_d3f54e1615a1e8f2_completeChildParentData(vicinity: ChildVicinity, { previousChild = null }: {
        readonly previousChild?: RenderBox | null;
    } = {}): RenderBox | null {
        if (FoundationBuildMode.debug)
            invariant(!vicinity.equals(ChildVicinity.invalid), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        if (this.sourceChildren.containsKey(vicinity)) {
            const child: RenderBox = (() => {
                const _dartTemporary85 = dartMapRead(this.sourceChildren, vicinity);
                if (_dartTemporary85 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary85!;
            })();
            if (FoundationBuildMode.debug)
                invariant(this.parentDataOf(child).vicinity.equals(vicinity), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            this.updateChildPaintData(child);
            if (previousChild === null) {
                if (FoundationBuildMode.debug)
                    invariant(this.sourceFirstChild === null, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
                this.sourceFirstChild = child;
            }
            else {
                this.parentDataOf(previousChild as RenderBox)._dart_d3f54e1615a1e8f2_nextSibling = child;
                this.parentDataOf(child)._dart_d3f54e1615a1e8f2_previousSibling = previousChild as RenderBox;
            }
            return child;
        }
        return null;
    }
    _dart_d3f54e1615a1e8f2_debugCheckContentDimensions(): boolean {
        const hint: string = "Subclasses should call applyContentDimensions on the verticalOffset and horizontalOffset to set the min and max scroll offset. If the contents exceed one or both sides of the viewportDimension, ensure the viewportDimension height or width is subtracted in that axis for the correct extent.";
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                if (!(castScrollPosition(this.verticalOffset)).hasContentDimensions) {
                    (() => {
                        const _dartTemporary86 = FlutterError.fromParts([new ErrorSummary("The verticalOffset was not given content dimensions during layoutChildSequence."), new ErrorHint(hint)]);
                        throw _dartTemporary86;
                    })();
                }
                return true;
            })(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                if (!(castScrollPosition(this.horizontalOffset)).hasContentDimensions) {
                    (() => {
                        const _dartTemporary87 = FlutterError.fromParts([new ErrorSummary("The horizontalOffset was not given content dimensions during layoutChildSequence."), new ErrorHint(hint)]);
                        throw _dartTemporary87;
                    })();
                }
                return true;
            })(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return true;
    }
    buildOrObtainChildFor(vicinity: ChildVicinity): RenderBox | null {
        if (FoundationBuildMode.debug)
            invariant(!vicinity.equals(ChildVicinity.invalid), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        if (FoundationBuildMode.debug)
            invariant(this.debugDoingThisLayout, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        if (this.sourceNeedsDelegateRebuild || (!this.sourceChildren.containsKey(vicinity) && !this.sourceKeepAliveBucket.containsKey(vicinity))) {
            this.sourceInvokeLayout((_: BoxConstraints): void => {
                this._dart_d3f54e1615a1e8f2_childManager._dart_d3f54e1615a1e8f2_buildChild(vicinity);
            });
        }
        else {
            this.sourceKeepAliveBucket.remove(vicinity);
            this._dart_d3f54e1615a1e8f2_childManager._dart_d3f54e1615a1e8f2_reuseChild(vicinity);
        }
        if (!this.sourceChildren.containsKey(vicinity)) {
            return null;
        }
        if (FoundationBuildMode.debug)
            invariant(this.sourceChildren.containsKey(vicinity), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        const child: RenderBox = (() => {
            const _dartTemporary88 = dartMapRead(this.sourceChildren, vicinity);
            if (_dartTemporary88 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary88!;
        })();
        (() => {
            const _dartTemporary91 = this.sourceActiveChildren;
            const _dartTemporary89 = vicinity;
            const _dartTemporary90 = child;
            dartMapWrite(_dartTemporary91, _dartTemporary89, _dartTemporary90);
            return _dartTemporary90;
        })();
        this.parentDataOf(child).vicinity = vicinity;
        twoDimensionalListAdd(this.sourceCurrentVicinities, vicinity);
        return child;
    }
    updateChildPaintData(child: RenderBox): void {
        const childParentData: SourceTwoDimensionalViewportParentData = this.parentDataOf(child);
        if (FoundationBuildMode.debug)
            invariant(childParentData.layoutOffset !== null, "source-two-dimensional-viewport", `The child with ChildVicinity(xIndex: ${integerString(checkedInteger(childParentData.vicinity.xIndex))}, yIndex: ${integerString(checkedInteger(childParentData.vicinity.yIndex))}) was not provided a layoutOffset. This should be set during layoutChildSequence, representing the position of the child.`);
        if (FoundationBuildMode.debug)
            invariant(child.hasSize, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        childParentData._dart_d3f54e1615a1e8f2_paintExtent = this.computeChildPaintExtent((() => {
            const _dartTemporary92 = childParentData.layoutOffset;
            if (_dartTemporary92 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary92!;
        })(), wheelBoxSize(child));
        childParentData.paintOffset = this.computeAbsolutePaintOffsetFor(child, { layoutOffset: (() => {
                const _dartTemporary93 = childParentData.layoutOffset;
                if (_dartTemporary93 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary93!;
            })() });
        this._dart_d3f54e1615a1e8f2_hasVisualOverflow = this._dart_d3f54e1615a1e8f2_hasVisualOverflow || !(() => {
            const _dartTemporary94 = childParentData.layoutOffset;
            const _dartTemporary95 = childParentData._dart_d3f54e1615a1e8f2_paintExtent;
            return _dartTemporary94 === null || _dartTemporary95 === null ? _dartTemporary94 as unknown === _dartTemporary95 : _dartTemporary94.equals(_dartTemporary95);
        })() || !childParentData.isVisible;
    }
    computeChildPaintExtent(layoutOffset: Offset, childSize: Size): Size {
        if (childSize.equals(Size.zero) || childSize.height === 0 || childSize.width === 0) {
            return Size.zero;
        }
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        let width: number;
        if (layoutOffset.dx < 0) {
            if (layoutOffset.dx + childSize.width <= 0) {
                return Size.zero;
            }
            width = layoutOffset.dx + childSize.width;
        }
        else if (layoutOffset.dx >= this.viewportDimension.width) {
            return Size.zero;
        }
        else {
            if (FoundationBuildMode.debug)
                invariant(layoutOffset.dx >= 0 && layoutOffset.dx < this.viewportDimension.width, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            if (layoutOffset.dx + childSize.width > this.viewportDimension.width) {
                width = this.viewportDimension.width - layoutOffset.dx;
            }
            else {
                if (FoundationBuildMode.debug)
                    invariant(layoutOffset.dx + childSize.width <= this.viewportDimension.width, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
                width = childSize.width;
            }
        }
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        let height: number;
        if (layoutOffset.dy < 0) {
            if (layoutOffset.dy + childSize.height <= 0) {
                return Size.zero;
            }
            height = layoutOffset.dy + childSize.height;
        }
        else if (layoutOffset.dy >= this.viewportDimension.height) {
            return Size.zero;
        }
        else {
            if (FoundationBuildMode.debug)
                invariant(layoutOffset.dy >= 0 && layoutOffset.dy < this.viewportDimension.height, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            if (layoutOffset.dy + childSize.height > this.viewportDimension.height) {
                height = this.viewportDimension.height - layoutOffset.dy;
            }
            else {
                if (FoundationBuildMode.debug)
                    invariant(layoutOffset.dy + childSize.height <= this.viewportDimension.height, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
                height = childSize.height;
            }
        }
        return new Size(width, height);
    }
    computeAbsolutePaintOffsetFor(child: RenderBox, { layoutOffset }: {
        readonly layoutOffset: Offset;
    }): Offset {
        if (FoundationBuildMode.debug)
            invariant(this.hasSize, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        if (FoundationBuildMode.debug)
            invariant(child.hasSize, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const xOffset: number = (() => {
            const _dartTemporary96 = this.horizontalAxisDirection;
            switch (_dartTemporary96) {
                case AxisDirection.right: return layoutOffset.dx;
                case AxisDirection.left: return this.viewportDimension.width - (layoutOffset.dx + wheelBoxSize(child).width);
                case AxisDirection.up: return (() => {
                    const _dartTemporary97 = new Exception("This should not happen");
                    throw _dartTemporary97;
                })();
                case AxisDirection.down: return (() => {
                    const _dartTemporary98 = new Exception("This should not happen");
                    throw _dartTemporary98;
                })();
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const yOffset: number = (() => {
            const _dartTemporary99 = this.verticalAxisDirection;
            switch (_dartTemporary99) {
                case AxisDirection.up: return this.viewportDimension.height - (layoutOffset.dy + wheelBoxSize(child).height);
                case AxisDirection.down: return layoutOffset.dy;
                case AxisDirection.right: return (() => {
                    const _dartTemporary100 = new Exception("This should not happen");
                    throw _dartTemporary100;
                })();
                case AxisDirection.left: return (() => {
                    const _dartTemporary101 = new Exception("This should not happen");
                    throw _dartTemporary101;
                })();
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        return new Offset(xOffset, yOffset);
    }
    override sourcePaint(context: PaintingContext, offset: Offset): void {
        if (this.sourceChildren.isEmpty) {
            return;
        }
        if (this._dart_d3f54e1615a1e8f2_hasVisualOverflow && !(this.clipBehavior === "none")) {
            this._dart_d3f54e1615a1e8f2_clipRectLayer.layer = wheelPushClipRect(context, this.needsCompositing, offset, Offset.zero.and(this.viewportDimension), dartMethodTearOff(this, this._dart_d3f54e1615a1e8f2_paintChildren), { clipBehavior: this.clipBehavior, oldLayer: this._dart_d3f54e1615a1e8f2_clipRectLayer.layer });
        }
        else {
            this._dart_d3f54e1615a1e8f2_clipRectLayer.layer = null;
            this._dart_d3f54e1615a1e8f2_paintChildren(context, offset);
        }
    }
    _dart_d3f54e1615a1e8f2_paintChildren(context: PaintingContext, offset: Offset): void {
        let child: RenderBox | null = this.sourceFirstChild;
        while (child !== null) {
            const childParentData: SourceTwoDimensionalViewportParentData = this.parentDataOf(child as RenderBox);
            if (childParentData.isVisible) {
                wheelPaintChild(context, child as RenderBox, offset.add((() => {
                    const _dartTemporary102 = childParentData.paintOffset;
                    if (_dartTemporary102 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary102!;
                })()));
            }
            child = childParentData._dart_d3f54e1615a1e8f2_nextSibling;
        }
    }
    _dart_d3f54e1615a1e8f2_insertChild(child: RenderBox, slot: ChildVicinity): void {
        if (FoundationBuildMode.debug)
            invariant(this._dart_d3f54e1615a1e8f2_debugTrackOrphans({ newOrphan: dartMapRead(this.sourceChildren, slot) }), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        if (FoundationBuildMode.debug)
            invariant(!this.sourceKeepAliveBucket.containsValue(child), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        (() => {
            const _dartTemporary105 = this.sourceChildren;
            const _dartTemporary103 = slot;
            const _dartTemporary104 = child;
            dartMapWrite(_dartTemporary105, _dartTemporary103, _dartTemporary104);
            return _dartTemporary104;
        })();
        this.sourceAdoptChild(child);
    }
    _dart_d3f54e1615a1e8f2_moveChild(child: RenderBox, { from, to }: {
        readonly from: ChildVicinity;
        readonly to: ChildVicinity;
    }): void {
        const childParentData: SourceTwoDimensionalViewportParentData = this.parentDataOf(child);
        if (!childParentData.keptAlive) {
            if (dartMapRead(this.sourceChildren, from) === child) {
                this.sourceChildren.remove(from);
            }
            if (FoundationBuildMode.debug)
                invariant(this._dart_d3f54e1615a1e8f2_debugTrackOrphans({ newOrphan: dartMapRead(this.sourceChildren, to), noLongerOrphan: child }), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            (() => {
                const _dartTemporary108 = this.sourceChildren;
                const _dartTemporary106 = to;
                const _dartTemporary107 = child;
                dartMapWrite(_dartTemporary108, _dartTemporary106, _dartTemporary107);
                return _dartTemporary107;
            })();
            return;
        }
        if (dartMapRead(this.sourceKeepAliveBucket, childParentData.vicinity) === child) {
            this.sourceKeepAliveBucket.remove(childParentData.vicinity);
        }
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                twoDimensionalListRemove(this.sourceDanglingKeepAlives, child);
                return true;
            })(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                if (this.sourceKeepAliveBucket.containsKey(childParentData.vicinity)) {
                    twoDimensionalListAdd(this.sourceDanglingKeepAlives, (() => {
                        const _dartTemporary109 = dartMapRead(this.sourceKeepAliveBucket, childParentData.vicinity);
                        if (_dartTemporary109 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary109!;
                    })());
                }
                return true;
            })(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        (() => {
            const _dartTemporary112 = this.sourceKeepAliveBucket;
            const _dartTemporary110 = childParentData.vicinity;
            const _dartTemporary111 = child;
            dartMapWrite(_dartTemporary112, _dartTemporary110, _dartTemporary111);
            return _dartTemporary111;
        })();
    }
    _dart_d3f54e1615a1e8f2_removeChild(child: RenderBox, slot: ChildVicinity): void {
        const childParentData: SourceTwoDimensionalViewportParentData = this.parentDataOf(child);
        if (!childParentData.keptAlive) {
            if (dartMapRead(this.sourceChildren, slot) === child) {
                this.sourceChildren.remove(slot);
            }
            if (FoundationBuildMode.debug)
                invariant(this._dart_d3f54e1615a1e8f2_debugTrackOrphans({ noLongerOrphan: child }), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            if (dartMapRead(this.sourceKeepAliveBucket, childParentData.vicinity) === child) {
                this.sourceKeepAliveBucket.remove(childParentData.vicinity);
            }
            if (FoundationBuildMode.debug)
                invariant(!(dartMapRead(this.sourceKeepAliveBucket, childParentData.vicinity) === child), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
            this.sourceDropChild(child);
            return;
        }
        if (FoundationBuildMode.debug)
            invariant(dartMapRead(this.sourceKeepAliveBucket, childParentData.vicinity) === child, "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                twoDimensionalListRemove(this.sourceDanglingKeepAlives, child);
                return true;
            })(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        this.sourceKeepAliveBucket.remove(childParentData.vicinity);
        this.sourceDropChild(child);
    }
    _dart_d3f54e1615a1e8f2_debugTrackOrphans({ newOrphan = null, noLongerOrphan = null }: {
        readonly newOrphan?: RenderBox | null;
        readonly noLongerOrphan?: RenderBox | null;
    } = {}): boolean {
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                this.sourceDebugOrphans ??= [];
                if (newOrphan !== null) {
                    twoDimensionalListAdd((() => {
                        const _dartTemporary113 = this.sourceDebugOrphans;
                        if (_dartTemporary113 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary113!;
                    })(), newOrphan as RenderBox);
                }
                if (noLongerOrphan !== null) {
                    twoDimensionalListRemove((() => {
                        const _dartTemporary114 = this.sourceDebugOrphans;
                        if (_dartTemporary114 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary114!;
                    })(), noLongerOrphan as RenderBox);
                }
                return true;
            })(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return true;
    }
    debugThrowIfNotCheckingIntrinsics(): boolean {
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                if (!RenderObject.debugCheckingIntrinsics) {
                    (() => {
                        const _dartTemporary115 = FlutterError.fromParts([new ErrorSummary(`${twoDimensionalTypeString(this.sourceRuntimeType)} does not support returning intrinsic dimensions.`), new ErrorDescription("Calculating the intrinsic dimensions would require instantiating every child of the viewport, which defeats the point of viewports being lazy.")]);
                        throw _dartTemporary115;
                    })();
                }
                return true;
            })(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return true;
    }
    /**
     * @dartParam height double
     * @dartParamOrigin height explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    override computeMinIntrinsicWidth(height: number): number {
        if (FoundationBuildMode.debug)
            invariant(this.debugThrowIfNotCheckingIntrinsics(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return 0;
    }
    /**
     * @dartParam height double
     * @dartParamOrigin height explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    override computeMaxIntrinsicWidth(height: number): number {
        if (FoundationBuildMode.debug)
            invariant(this.debugThrowIfNotCheckingIntrinsics(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return 0;
    }
    /**
     * @dartParam width double
     * @dartParamOrigin width explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    override computeMinIntrinsicHeight(width: number): number {
        if (FoundationBuildMode.debug)
            invariant(this.debugThrowIfNotCheckingIntrinsics(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return 0;
    }
    /**
     * @dartParam width double
     * @dartParamOrigin width explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    override computeMaxIntrinsicHeight(width: number): number {
        if (FoundationBuildMode.debug)
            invariant(this.debugThrowIfNotCheckingIntrinsics(), "source-two-dimensional-viewport", "Pinned two-dimensional viewport assertion failed");
        return 0;
    }
    override applyPaintTransform(child: RenderBox, transform: Matrix4): void {
        if (!(isWheelBox(child)))
            throw new TypeError("Invalid covariant argument: child");
        const paintOffset: Offset = (() => {
            const _dartTemporary116 = this.parentDataOf(child).paintOffset;
            if (_dartTemporary116 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary116!;
        })();
        transform.translate(paintOffset.dx, paintOffset.dy);
    }
    override dispose(): void {
        this._dart_d3f54e1615a1e8f2_clipRectLayer.layer = null;
        super.dispose();
    }
}
export abstract class SourceTwoDimensionalChildManager {
    constructor() {
    }
    abstract _dart_d3f54e1615a1e8f2_startLayout(): void;
    abstract _dart_d3f54e1615a1e8f2_buildChild(vicinity: ChildVicinity): void;
    abstract _dart_d3f54e1615a1e8f2_reuseChild(vicinity: ChildVicinity): void;
    abstract _dart_d3f54e1615a1e8f2_endLayout(): void;
}
