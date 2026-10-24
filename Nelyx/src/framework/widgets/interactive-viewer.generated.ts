// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/interactive_viewer.dart; SHA256 c25d99ee34d7eaf0d9f0cbd6579ff6130ce5c7062b701462db93b4c455eaaa08
import { checkedInteger } from "../../ui/value-math.ts";
import { protect } from "../../ui/value-math.ts";
import { Widget } from "./framework.ts";
import { StatefulWidget } from "./framework.ts";
import { StatelessWidget } from "./framework.ts";
import { State } from "./framework.ts";
import { Key } from "../../foundation/key.ts";
import { GlobalKey } from "./global-key.ts";
import { PointerDeviceKind } from "../../ui/pointer.ts";
import { Offset } from "../../ui/offset.ts";
import { Rect } from "../../ui/rect.ts";
import { Size } from "../../ui/size.ts";
import { Matrix4 } from "../../math/matrix4.ts";
import { Vector3 } from "../../math/vector3.ts";
import { SourceQuad } from "../../math/quad.generated.ts";
import { SourceTriangle } from "../../math/triangle.generated.ts";
import { Animation } from "../animation/animation.ts";
import { AnimationController } from "../animation/animation-controller.ts";
import { Animatable } from "../animation/tween.ts";
import { Tween } from "../animation/tween.ts";
import { CurveTween } from "../animation/tween.ts";
import { Curves } from "../animation/curves.ts";
import { Axis } from "../painting/basic-types.ts";
import { Alignment } from "../painting/alignment.ts";
import { EdgeInsets } from "../painting/edge-insets.ts";
import { BoxConstraints } from "../rendering/constraints.ts";
import { RenderBox } from "../rendering/object.ts";
import { HitTestBehavior } from "../rendering/pointer-listener.ts";
import { PointerEvent } from "../gestures/events.ts";
import { PointerSignalEvent } from "../gestures/events.ts";
import { PointerScaleEvent } from "../gestures/events.ts";
import { PointerScrollEvent } from "../gestures/events.ts";
import { ScaleStartDetails } from "../gestures/scale.ts";
import { ScaleUpdateDetails } from "../gestures/scale.ts";
import { ScaleEndDetails } from "../gestures/scale.ts";
import { FrictionSimulation } from "../physics/friction-simulation.ts";
import { ValueNotifier } from "../../foundation/notifier.ts";
import { ViewerStatefulHost } from "./viewer-widget-source-adapter.ts";
import { ViewerStateHost } from "./viewer-widget-source-adapter.ts";
import { ViewerValueNotifierHost } from "./viewer-widget-source-adapter.ts";
import { dartLateRead } from "../../foundation/dart-late.ts";
import { dartLateWrite } from "../../foundation/dart-late.ts";
import { dartLateInitialize } from "../../foundation/dart-late.ts";
import { dartLateLocal } from "../../foundation/dart-late.ts";
import { dartMethodTearOff } from "../../foundation/dart-method-tear-off.ts";
import { dartStaticRead } from "../../foundation/dart-static-field.ts";
import { dartStaticWrite } from "../../foundation/dart-static-field.ts";
import { dartStaticSeal } from "../../foundation/dart-static-field.ts";
import { invariant } from "../../foundation/errors.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { kMinFlingVelocity } from "../gestures/constants.ts";
import { kDefaultMouseScrollToScaleFactor } from "../gestures/scale.ts";
import { roundInteger } from "../../ui/value-math.ts";
import { clamp } from "../../ui/value-math.ts";
import { KeyedSubtree } from "./basic.ts";
import { viewerGlobalKey } from "./viewer-widget-source-adapter.ts";
import { viewerNumberTween } from "./viewer-widget-source-adapter.ts";
import { viewerOffsetTween } from "./viewer-widget-source-adapter.ts";
import { viewerLayoutBuilder } from "./viewer-widget-source-adapter.ts";
import { viewerListener } from "./viewer-widget-source-adapter.ts";
import { viewerGestureDetector } from "./viewer-widget-source-adapter.ts";
import { viewerTransform } from "./viewer-widget-source-adapter.ts";
import { viewerOverflowBox } from "./viewer-widget-source-adapter.ts";
import { viewerClipRect } from "./viewer-widget-source-adapter.ts";
import { viewerOffsetRect } from "./viewer-widget-source-adapter.ts";
import { viewerIsInfinite } from "./viewer-widget-source-adapter.ts";
import { viewerFixed } from "./viewer-widget-source-adapter.ts";
import { viewerParseDouble } from "./viewer-widget-source-adapter.ts";
import { viewerKeyContext } from "./viewer-widget-source-adapter.ts";
import { viewerEventTransform } from "./viewer-widget-source-adapter.ts";
import { viewerIsRenderBox } from "./viewer-widget-source-adapter.ts";
import { viewerCastRenderBox } from "./viewer-widget-source-adapter.ts";
import { viewerIsScrollEvent } from "./viewer-widget-source-adapter.ts";
import { viewerCastScrollEvent } from "./viewer-widget-source-adapter.ts";
import { viewerIsScaleEvent } from "./viewer-widget-source-adapter.ts";
import { viewerCastScaleEvent } from "./viewer-widget-source-adapter.ts";
import { viewerDouble } from "./viewer-widget-source-adapter.ts";
import { viewerTransformDelta } from "./viewer-widget-source-adapter.ts";
import { viewerRenderSize } from "./viewer-widget-source-adapter.ts";
import type { ViewerSourceList } from "./viewer-widget-source-adapter.ts";
import type { Clip } from "../../ui/clip.ts";
import type { BuildContext } from "./framework.ts";
const _dartTemporary0 = Symbol();
export class SourceGestureType {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly index: number;
    private readonly _dartTemporary1!: void;
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    private constructor(index: number, readonly name: string, token: typeof _dartTemporary0) {
        if (token !== _dartTemporary0)
            throw new TypeError("Enum values cannot be constructed");
        this.index = index;
        Object.freeze(this);
    }
    static readonly pan: SourceGestureType = new SourceGestureType(0, "pan", _dartTemporary0);
    static readonly scale: SourceGestureType = new SourceGestureType(1, "scale", _dartTemporary0);
    static readonly rotate: SourceGestureType = new SourceGestureType(2, "rotate", _dartTemporary0);
    static readonly values: ReadonlyArray<SourceGestureType> = Object.freeze([SourceGestureType.pan, SourceGestureType.scale, SourceGestureType.rotate]);
    toString(): string {
        return "_GestureType." + this.name;
    }
}
Object.freeze(SourceGestureType.prototype);
Object.freeze(SourceGestureType);
const _dartTemporary2 = Symbol();
export class SourcePanAxis {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly index: number;
    private readonly _dartTemporary3!: void;
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    private constructor(index: number, readonly name: string, token: typeof _dartTemporary2) {
        if (token !== _dartTemporary2)
            throw new TypeError("Enum values cannot be constructed");
        this.index = index;
        Object.freeze(this);
    }
    static readonly horizontal: SourcePanAxis = new SourcePanAxis(0, "horizontal", _dartTemporary2);
    static readonly vertical: SourcePanAxis = new SourcePanAxis(1, "vertical", _dartTemporary2);
    static readonly aligned: SourcePanAxis = new SourcePanAxis(2, "aligned", _dartTemporary2);
    static readonly free: SourcePanAxis = new SourcePanAxis(3, "free", _dartTemporary2);
    static readonly values: ReadonlyArray<SourcePanAxis> = Object.freeze([SourcePanAxis.horizontal, SourcePanAxis.vertical, SourcePanAxis.aligned, SourcePanAxis.free]);
    toString(): string {
        return "PanAxis." + this.name;
    }
}
Object.freeze(SourcePanAxis.prototype);
Object.freeze(SourcePanAxis);
export class SourceInteractiveViewer extends ViewerStatefulHost {
    readonly alignment: Alignment | null;
    readonly clipBehavior: Clip;
    readonly panAxis: SourcePanAxis;
    readonly boundaryMargin: EdgeInsets;
    readonly builder: ((argument0: BuildContext, argument1: SourceQuad) => Widget) | null;
    readonly child: Widget | null;
    readonly constrained: boolean;
    readonly panEnabled: boolean;
    readonly scaleEnabled: boolean;
    readonly trackpadScrollCausesScale: boolean;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly scaleFactor: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly maxScale: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly minScale: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly interactionEndFrictionCoefficient: number;
    readonly onInteractionEnd: ((argument0: ScaleEndDetails) => void) | null;
    readonly onInteractionStart: ((argument0: ScaleStartDetails) => void) | null;
    readonly onInteractionUpdate: ((argument0: ScaleUpdateDetails) => void) | null;
    readonly transformationController: SourceTransformationController | null;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_bb3c6814efa30c40_kDrag: number = 0.0000135;
    /**
     * @dartParam maxScale double
     * @dartParamOrigin maxScale inferred
     * @dartParam minScale double
     * @dartParamOrigin minScale inferred
     * @dartParam interactionEndFrictionCoefficient double
     * @dartParamOrigin interactionEndFrictionCoefficient inferred
     * @dartParam scaleFactor double
     * @dartParamOrigin scaleFactor inferred
     */
    constructor({ key = null, clipBehavior = "hardEdge", panAxis = SourcePanAxis.free, boundaryMargin = EdgeInsets.zero, constrained = true, maxScale = 2.5, minScale = 0.8, interactionEndFrictionCoefficient = SourceInteractiveViewer._dart_bb3c6814efa30c40_kDrag, onInteractionEnd = null, onInteractionStart = null, onInteractionUpdate = null, panEnabled = true, scaleEnabled = true, scaleFactor = kDefaultMouseScrollToScaleFactor, transformationController = null, alignment = null, trackpadScrollCausesScale = false, child }: {
        readonly key?: Key | null;
        readonly clipBehavior?: Clip;
        readonly panAxis?: SourcePanAxis;
        readonly boundaryMargin?: EdgeInsets;
        readonly constrained?: boolean;
        readonly maxScale?: number;
        readonly minScale?: number;
        readonly interactionEndFrictionCoefficient?: number;
        readonly onInteractionEnd?: ((argument0: ScaleEndDetails) => void) | null;
        readonly onInteractionStart?: ((argument0: ScaleStartDetails) => void) | null;
        readonly onInteractionUpdate?: ((argument0: ScaleUpdateDetails) => void) | null;
        readonly panEnabled?: boolean;
        readonly scaleEnabled?: boolean;
        readonly scaleFactor?: number;
        readonly transformationController?: SourceTransformationController | null;
        readonly alignment?: Alignment | null;
        readonly trackpadScrollCausesScale?: boolean;
        readonly child: Widget;
    }) {
        const _initialField0 = clipBehavior;
        const _initialField1 = panAxis;
        const _initialField2 = boundaryMargin;
        const _initialField3 = constrained;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField4 = maxScale;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField5 = minScale;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField6 = interactionEndFrictionCoefficient;
        const _initialField7 = onInteractionEnd;
        const _initialField8 = onInteractionStart;
        const _initialField9 = onInteractionUpdate;
        const _initialField10 = panEnabled;
        const _initialField11 = scaleEnabled;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField12 = scaleFactor;
        const _initialField13 = transformationController;
        const _initialField14 = alignment;
        const _initialField15 = trackpadScrollCausesScale;
        const _initialField16 = child;
        if (FoundationBuildMode.debug)
            invariant(minScale > 0, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(interactionEndFrictionCoefficient > 0, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(Number.isFinite(minScale), "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(maxScale > 0, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(!Number.isNaN(maxScale), "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(maxScale >= minScale, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant((viewerIsInfinite(boundaryMargin.horizontal) && viewerIsInfinite(boundaryMargin.vertical)) || (Number.isFinite(boundaryMargin.top) && Number.isFinite(boundaryMargin.right) && Number.isFinite(boundaryMargin.bottom) && Number.isFinite(boundaryMargin.left)), "generated-source-assert", "Pinned Dart assertion failed");
        const _initialField17 = null;
        super({ key: key });
        this.alignment = _initialField14;
        this.clipBehavior = _initialField0;
        this.panAxis = _initialField1;
        this.boundaryMargin = _initialField2;
        this.builder = _initialField17;
        this.child = _initialField16;
        this.constrained = _initialField3;
        this.panEnabled = _initialField10;
        this.scaleEnabled = _initialField11;
        this.trackpadScrollCausesScale = _initialField15;
        this.scaleFactor = _initialField12;
        this.maxScale = _initialField4;
        this.minScale = _initialField5;
        this.interactionEndFrictionCoefficient = _initialField6;
        this.onInteractionEnd = _initialField7;
        this.onInteractionStart = _initialField8;
        this.onInteractionUpdate = _initialField9;
        this.transformationController = _initialField13;
        protect(this, ["alignment", "clipBehavior", "panAxis", "boundaryMargin", "builder", "child", "constrained", "panEnabled", "scaleEnabled", "trackpadScrollCausesScale", "scaleFactor", "maxScale", "minScale", "interactionEndFrictionCoefficient", "onInteractionEnd", "onInteractionStart", "onInteractionUpdate", "transformationController"]);
    }
    static getNearestPointOnLine(point: Vector3, l1: Vector3, l2: Vector3): Vector3 {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const lengthSquared: number = viewerDouble(Math.pow(l2.x - l1.x, 2)) + viewerDouble(Math.pow(l2.y - l1.y, 2));
        if (lengthSquared === 0) {
            return l1;
        }
        const l1P: Vector3 = point.minus(l1);
        const l1L2: Vector3 = l2.minus(l1);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const fraction: number = clamp(l1P.dot(l1L2) / lengthSquared, 0, 1);
        return l1.plus(l1L2.scaled(fraction));
    }
    static getAxisAlignedBoundingBox(quad: SourceQuad): SourceQuad {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const minX: number = Math.min(quad.point0.x, Math.min(quad.point1.x, Math.min(quad.point2.x, quad.point3.x)));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const minY: number = Math.min(quad.point0.y, Math.min(quad.point1.y, Math.min(quad.point2.y, quad.point3.y)));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const maxX: number = Math.max(quad.point0.x, Math.max(quad.point1.x, Math.max(quad.point2.x, quad.point3.x)));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const maxY: number = Math.max(quad.point0.y, Math.max(quad.point1.y, Math.max(quad.point2.y, quad.point3.y)));
        return SourceQuad.points(new Vector3(minX, minY, 0), new Vector3(maxX, minY, 0), new Vector3(maxX, maxY, 0), new Vector3(minX, maxY, 0));
    }
    static pointIsInside(point: Vector3, quad: SourceQuad): boolean {
        const aM: Vector3 = point.minus(quad.point0);
        const aB: Vector3 = quad.point1.minus(quad.point0);
        const aD: Vector3 = quad.point3.minus(quad.point0);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const aMAB: number = aM.dot(aB);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const aBAB: number = aB.dot(aB);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const aMAD: number = aM.dot(aD);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const aDAD: number = aD.dot(aD);
        return 0 <= aMAB && aMAB <= aBAB && 0 <= aMAD && aMAD <= aDAD;
    }
    static getNearestPointInside(point: Vector3, quad: SourceQuad): Vector3 {
        if (SourceInteractiveViewer.pointIsInside(point, quad)) {
            return point;
        }
        const closestPoints: ViewerSourceList<Vector3> = [SourceInteractiveViewer.getNearestPointOnLine(point, quad.point0, quad.point1), SourceInteractiveViewer.getNearestPointOnLine(point, quad.point1, quad.point2), SourceInteractiveViewer.getNearestPointOnLine(point, quad.point2, quad.point3), SourceInteractiveViewer.getNearestPointOnLine(point, quad.point3, quad.point0)];
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        let minDistance: number = Infinity;
        const closestOverall = dartLateLocal<Vector3>("closestOverall", false);
        for (const _dartTemporary4 of closestPoints) {
            const closePoint: Vector3 = _dartTemporary4;
            {
                /**
                 * @dartType double
                 * @dartTypeOrigin explicit
                 */
                const distance: number = Math.sqrt(Math.pow(point.x - closePoint.x, 2) + Math.pow(point.y - closePoint.y, 2));
                if (distance < minDistance) {
                    minDistance = distance;
                    closestOverall.value = closePoint;
                }
            }
        }
        return closestOverall.value;
    }
    override createState(): State<SourceInteractiveViewer> {
        return new SourceInteractiveViewerState();
    }
    /**
     * @dartParam maxScale double
     * @dartParamOrigin maxScale inferred
     * @dartParam minScale double
     * @dartParamOrigin minScale inferred
     * @dartParam interactionEndFrictionCoefficient double
     * @dartParamOrigin interactionEndFrictionCoefficient inferred
     * @dartParam scaleFactor double
     * @dartParamOrigin scaleFactor inferred
     */
    static builder({ key = null, clipBehavior = "hardEdge", panAxis = SourcePanAxis.free, boundaryMargin = EdgeInsets.zero, maxScale = 2.5, minScale = 0.8, interactionEndFrictionCoefficient = SourceInteractiveViewer._dart_bb3c6814efa30c40_kDrag, onInteractionEnd = null, onInteractionStart = null, onInteractionUpdate = null, panEnabled = true, scaleEnabled = true, scaleFactor = 200, transformationController = null, alignment = null, trackpadScrollCausesScale = false, builder }: {
        readonly key?: Key | null;
        readonly clipBehavior?: Clip;
        readonly panAxis?: SourcePanAxis;
        readonly boundaryMargin?: EdgeInsets;
        readonly maxScale?: number;
        readonly minScale?: number;
        readonly interactionEndFrictionCoefficient?: number;
        readonly onInteractionEnd?: ((argument0: ScaleEndDetails) => void) | null;
        readonly onInteractionStart?: ((argument0: ScaleStartDetails) => void) | null;
        readonly onInteractionUpdate?: ((argument0: ScaleUpdateDetails) => void) | null;
        readonly panEnabled?: boolean;
        readonly scaleEnabled?: boolean;
        readonly scaleFactor?: number;
        readonly transformationController?: SourceTransformationController | null;
        readonly alignment?: Alignment | null;
        readonly trackpadScrollCausesScale?: boolean;
        readonly builder: (argument0: BuildContext, argument1: SourceQuad) => Widget;
    }): SourceInteractiveViewer {
        return _dartTemporary5({ key, clipBehavior, panAxis, boundaryMargin, maxScale, minScale, interactionEndFrictionCoefficient, onInteractionEnd, onInteractionStart, onInteractionUpdate, panEnabled, scaleEnabled, scaleFactor, transformationController, alignment, trackpadScrollCausesScale, builder });
    }
}
protect(SourceInteractiveViewer, ["_dart_bb3c6814efa30c40_kDrag"]);
function _dartTemporary5({ key = null, clipBehavior = "hardEdge", panAxis = SourcePanAxis.free, boundaryMargin = EdgeInsets.zero, maxScale = 2.5, minScale = 0.8, interactionEndFrictionCoefficient = SourceInteractiveViewer._dart_bb3c6814efa30c40_kDrag, onInteractionEnd = null, onInteractionStart = null, onInteractionUpdate = null, panEnabled = true, scaleEnabled = true, scaleFactor = 200, transformationController = null, alignment = null, trackpadScrollCausesScale = false, builder }: {
    readonly key?: Key | null;
    readonly clipBehavior?: Clip;
    readonly panAxis?: SourcePanAxis;
    readonly boundaryMargin?: EdgeInsets;
    readonly maxScale?: number;
    readonly minScale?: number;
    readonly interactionEndFrictionCoefficient?: number;
    readonly onInteractionEnd?: ((argument0: ScaleEndDetails) => void) | null;
    readonly onInteractionStart?: ((argument0: ScaleStartDetails) => void) | null;
    readonly onInteractionUpdate?: ((argument0: ScaleUpdateDetails) => void) | null;
    readonly panEnabled?: boolean;
    readonly scaleEnabled?: boolean;
    readonly scaleFactor?: number;
    readonly transformationController?: SourceTransformationController | null;
    readonly alignment?: Alignment | null;
    readonly trackpadScrollCausesScale?: boolean;
    readonly builder: (argument0: BuildContext, argument1: SourceQuad) => Widget;
}): SourceInteractiveViewer {
    const _initialField0 = clipBehavior;
    const _initialField1 = panAxis;
    const _initialField2 = boundaryMargin;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField3 = maxScale;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField4 = minScale;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField5 = interactionEndFrictionCoefficient;
    const _initialField6 = onInteractionEnd;
    const _initialField7 = onInteractionStart;
    const _initialField8 = onInteractionUpdate;
    const _initialField9 = panEnabled;
    const _initialField10 = scaleEnabled;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField11 = scaleFactor;
    const _initialField12 = transformationController;
    const _initialField13 = alignment;
    const _initialField14 = trackpadScrollCausesScale;
    const _initialField15 = builder;
    if (FoundationBuildMode.debug)
        invariant(minScale > 0, "generated-source-assert", "Pinned Dart assertion failed");
    if (FoundationBuildMode.debug)
        invariant(interactionEndFrictionCoefficient > 0, "generated-source-assert", "Pinned Dart assertion failed");
    if (FoundationBuildMode.debug)
        invariant(Number.isFinite(minScale), "generated-source-assert", "Pinned Dart assertion failed");
    if (FoundationBuildMode.debug)
        invariant(maxScale > 0, "generated-source-assert", "Pinned Dart assertion failed");
    if (FoundationBuildMode.debug)
        invariant(!Number.isNaN(maxScale), "generated-source-assert", "Pinned Dart assertion failed");
    if (FoundationBuildMode.debug)
        invariant(maxScale >= minScale, "generated-source-assert", "Pinned Dart assertion failed");
    if (FoundationBuildMode.debug)
        invariant((viewerIsInfinite(boundaryMargin.horizontal) && viewerIsInfinite(boundaryMargin.vertical)) || (Number.isFinite(boundaryMargin.top) && Number.isFinite(boundaryMargin.right) && Number.isFinite(boundaryMargin.bottom) && Number.isFinite(boundaryMargin.left)), "generated-source-assert", "Pinned Dart assertion failed");
    const _initialField16 = false;
    const _initialField17 = null;
    const _dartTemporary6: InstanceType<typeof ViewerStatefulHost> & {
        alignment: Alignment | null;
        clipBehavior: Clip;
        panAxis: SourcePanAxis;
        boundaryMargin: EdgeInsets;
        builder: ((argument0: BuildContext, argument1: SourceQuad) => Widget) | null;
        child: Widget | null;
        constrained: boolean;
        panEnabled: boolean;
        scaleEnabled: boolean;
        trackpadScrollCausesScale: boolean;
        scaleFactor: number;
        maxScale: number;
        minScale: number;
        interactionEndFrictionCoefficient: number;
        onInteractionEnd: ((argument0: ScaleEndDetails) => void) | null;
        onInteractionStart: ((argument0: ScaleStartDetails) => void) | null;
        onInteractionUpdate: ((argument0: ScaleUpdateDetails) => void) | null;
        transformationController: SourceTransformationController | null;
    } = Reflect.construct(ViewerStatefulHost, [{ key: key }] satisfies ConstructorParameters<typeof ViewerStatefulHost>, SourceInteractiveViewer) as InstanceType<typeof ViewerStatefulHost> & {
        alignment: Alignment | null;
        clipBehavior: Clip;
        panAxis: SourcePanAxis;
        boundaryMargin: EdgeInsets;
        builder: ((argument0: BuildContext, argument1: SourceQuad) => Widget) | null;
        child: Widget | null;
        constrained: boolean;
        panEnabled: boolean;
        scaleEnabled: boolean;
        trackpadScrollCausesScale: boolean;
        scaleFactor: number;
        maxScale: number;
        minScale: number;
        interactionEndFrictionCoefficient: number;
        onInteractionEnd: ((argument0: ScaleEndDetails) => void) | null;
        onInteractionStart: ((argument0: ScaleStartDetails) => void) | null;
        onInteractionUpdate: ((argument0: ScaleUpdateDetails) => void) | null;
        transformationController: SourceTransformationController | null;
    };
    _dartTemporary6.alignment = _initialField13;
    _dartTemporary6.clipBehavior = _initialField0;
    _dartTemporary6.panAxis = _initialField1;
    _dartTemporary6.boundaryMargin = _initialField2;
    _dartTemporary6.builder = _initialField15;
    _dartTemporary6.child = _initialField17;
    _dartTemporary6.constrained = _initialField16;
    _dartTemporary6.panEnabled = _initialField9;
    _dartTemporary6.scaleEnabled = _initialField10;
    _dartTemporary6.trackpadScrollCausesScale = _initialField14;
    _dartTemporary6.scaleFactor = _initialField11;
    _dartTemporary6.maxScale = _initialField3;
    _dartTemporary6.minScale = _initialField4;
    _dartTemporary6.interactionEndFrictionCoefficient = _initialField5;
    _dartTemporary6.onInteractionEnd = _initialField6;
    _dartTemporary6.onInteractionStart = _initialField7;
    _dartTemporary6.onInteractionUpdate = _initialField8;
    _dartTemporary6.transformationController = _initialField12;
    protect(_dartTemporary6, ["alignment", "clipBehavior", "panAxis", "boundaryMargin", "builder", "child", "constrained", "panEnabled", "scaleEnabled", "trackpadScrollCausesScale", "scaleFactor", "maxScale", "minScale", "interactionEndFrictionCoefficient", "onInteractionEnd", "onInteractionStart", "onInteractionUpdate", "transformationController"]);
    return _dartTemporary6 as SourceInteractiveViewer;
}
export class SourceInteractiveViewerState extends ViewerStateHost<SourceInteractiveViewer> {
    get _dart_bb3c6814efa30c40_transformer(): SourceTransformationController {
        return dartLateInitialize<SourceTransformationController>(this, "package:flutter/src/widgets/interactive_viewer.dart::_InteractiveViewerState._transformer:FIELD", "_transformer", () => this.widget.transformationController ?? new SourceTransformationController(), false);
    }
    set _dart_bb3c6814efa30c40_transformer(value: SourceTransformationController) {
        dartLateWrite<SourceTransformationController>(this, "package:flutter/src/widgets/interactive_viewer.dart::_InteractiveViewerState._transformer:FIELD", "_transformer", value, false);
    }
    readonly _dart_bb3c6814efa30c40_childKey: GlobalKey<State<StatefulWidget>>;
    readonly _dart_bb3c6814efa30c40_parentKey: GlobalKey<State<StatefulWidget>>;
    _dart_bb3c6814efa30c40_animation: Animation<Offset> | null;
    /**
     * @dartType Animation<double>?
     * @dartTypeOrigin explicit
     */
    _dart_bb3c6814efa30c40_scaleAnimation: Animation<number> | null;
    get _dart_bb3c6814efa30c40_scaleAnimationFocalPoint(): Offset {
        return dartLateRead<Offset>(this, "package:flutter/src/widgets/interactive_viewer.dart::_InteractiveViewerState._scaleAnimationFocalPoint:FIELD", "_scaleAnimationFocalPoint");
    }
    set _dart_bb3c6814efa30c40_scaleAnimationFocalPoint(value: Offset) {
        dartLateWrite<Offset>(this, "package:flutter/src/widgets/interactive_viewer.dart::_InteractiveViewerState._scaleAnimationFocalPoint:FIELD", "_scaleAnimationFocalPoint", value, false);
    }
    get _dart_bb3c6814efa30c40_controller(): AnimationController {
        return dartLateRead<AnimationController>(this, "package:flutter/src/widgets/interactive_viewer.dart::_InteractiveViewerState._controller:FIELD", "_controller");
    }
    set _dart_bb3c6814efa30c40_controller(value: AnimationController) {
        dartLateWrite<AnimationController>(this, "package:flutter/src/widgets/interactive_viewer.dart::_InteractiveViewerState._controller:FIELD", "_controller", value, false);
    }
    get _dart_bb3c6814efa30c40_scaleController(): AnimationController {
        return dartLateRead<AnimationController>(this, "package:flutter/src/widgets/interactive_viewer.dart::_InteractiveViewerState._scaleController:FIELD", "_scaleController");
    }
    set _dart_bb3c6814efa30c40_scaleController(value: AnimationController) {
        dartLateWrite<AnimationController>(this, "package:flutter/src/widgets/interactive_viewer.dart::_InteractiveViewerState._scaleController:FIELD", "_scaleController", value, false);
    }
    _dart_bb3c6814efa30c40_currentAxis: Axis | null;
    _dart_bb3c6814efa30c40_referenceFocalPoint: Offset | null;
    /**
     * @dartType double?
     * @dartTypeOrigin explicit
     */
    _dart_bb3c6814efa30c40_scaleStart: number | null;
    /**
     * @dartType double?
     * @dartTypeOrigin explicit
     */
    _dart_bb3c6814efa30c40_rotationStart: number | null;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    _dart_bb3c6814efa30c40_currentRotation: number;
    _dart_bb3c6814efa30c40_gestureType: SourceGestureType | null;
    readonly _dart_bb3c6814efa30c40_rotateEnabled: boolean;
    constructor() {
        const _initialField0 = viewerGlobalKey();
        const _initialField1 = viewerGlobalKey();
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField2 = 0;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField3 = 0;
        const _initialField4 = false;
        super();
        this._dart_bb3c6814efa30c40_childKey = _initialField0;
        this._dart_bb3c6814efa30c40_parentKey = _initialField1;
        this._dart_bb3c6814efa30c40_animation = null;
        this._dart_bb3c6814efa30c40_scaleAnimation = null;
        this._dart_bb3c6814efa30c40_currentAxis = null;
        this._dart_bb3c6814efa30c40_referenceFocalPoint = null;
        this._dart_bb3c6814efa30c40_scaleStart = null;
        this._dart_bb3c6814efa30c40_rotationStart = _initialField2;
        this._dart_bb3c6814efa30c40_currentRotation = _initialField3;
        this._dart_bb3c6814efa30c40_gestureType = null;
        this._dart_bb3c6814efa30c40_rotateEnabled = _initialField4;
        protect(this, ["_dart_bb3c6814efa30c40_childKey", "_dart_bb3c6814efa30c40_parentKey", "_dart_bb3c6814efa30c40_rotateEnabled"]);
    }
    get _dart_bb3c6814efa30c40_boundaryRect(): Rect {
        if (FoundationBuildMode.debug)
            invariant(viewerKeyContext(this._dart_bb3c6814efa30c40_childKey) !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(!Number.isNaN(this.widget.boundaryMargin.left), "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(!Number.isNaN(this.widget.boundaryMargin.right), "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(!Number.isNaN(this.widget.boundaryMargin.top), "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(!Number.isNaN(this.widget.boundaryMargin.bottom), "generated-source-assert", "Pinned Dart assertion failed");
        const childRenderBox: RenderBox = viewerCastRenderBox((() => {
            const _dartTemporary8 = (() => {
                const _dartTemporary7 = viewerKeyContext(this._dart_bb3c6814efa30c40_childKey);
                if (_dartTemporary7 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary7!;
            })().findRenderObject();
            if (_dartTemporary8 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary8!;
        })());
        const childSize: Size = viewerRenderSize(childRenderBox);
        const boundaryRect: Rect = this.widget.boundaryMargin.inflateRect(viewerOffsetRect(Offset.zero, childSize));
        if (FoundationBuildMode.debug)
            invariant(!boundaryRect.isEmpty, "generated-source-assert", "InteractiveViewer's child must have nonzero dimensions.");
        if (FoundationBuildMode.debug)
            invariant(boundaryRect.isFinite || (viewerIsInfinite(boundaryRect.left) && viewerIsInfinite(boundaryRect.top) && viewerIsInfinite(boundaryRect.right) && viewerIsInfinite(boundaryRect.bottom)), "generated-source-assert", "boundaryRect must either be infinite in all directions or finite in all directions.");
        return boundaryRect;
    }
    get _dart_bb3c6814efa30c40_viewport(): Rect {
        if (FoundationBuildMode.debug)
            invariant(viewerKeyContext(this._dart_bb3c6814efa30c40_parentKey) !== null, "generated-source-assert", "Pinned Dart assertion failed");
        const parentRenderBox: RenderBox = viewerCastRenderBox((() => {
            const _dartTemporary10 = (() => {
                const _dartTemporary9 = viewerKeyContext(this._dart_bb3c6814efa30c40_parentKey);
                if (_dartTemporary9 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary9!;
            })().findRenderObject();
            if (_dartTemporary10 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary10!;
        })());
        return viewerOffsetRect(Offset.zero, viewerRenderSize(parentRenderBox));
    }
    _dart_bb3c6814efa30c40_matrixTranslate(matrix: Matrix4, translation: Offset): Matrix4 {
        if (translation.equals(Offset.zero)) {
            return matrix.clone();
        }
        let alignedTranslation: Offset;
        if (this._dart_bb3c6814efa30c40_currentAxis !== null) {
            alignedTranslation = (() => {
                const _dartTemporary11 = this.widget.panAxis;
                switch (_dartTemporary11) {
                    case SourcePanAxis.horizontal: return _alignAxis(translation, Axis.horizontal);
                    case SourcePanAxis.vertical: return _alignAxis(translation, Axis.vertical);
                    case SourcePanAxis.aligned: return _alignAxis(translation, (() => {
                        const _dartTemporary12 = this._dart_bb3c6814efa30c40_currentAxis;
                        if (_dartTemporary12 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary12!;
                    })());
                    case SourcePanAxis.free: return translation;
                    default: throw new TypeError("Non-exhaustive Dart switch expression");
                }
            })();
        }
        else {
            alignedTranslation = translation;
        }
        const nextMatrix: Matrix4 = (() => {
            const _dartTemporary13 = matrix.clone();
            _dartTemporary13.translateByDouble(alignedTranslation.dx, alignedTranslation.dy, 0, 1);
            return _dartTemporary13;
        })();
        const nextViewport: SourceQuad = _transformViewport(nextMatrix, this._dart_bb3c6814efa30c40_viewport);
        if (this._dart_bb3c6814efa30c40_boundaryRect.isInfinite) {
            return nextMatrix;
        }
        const boundariesAabbQuad: SourceQuad = _getAxisAlignedBoundingBoxWithRotation(this._dart_bb3c6814efa30c40_boundaryRect, this._dart_bb3c6814efa30c40_currentRotation);
        const offendingDistance: Offset = _exceedsBy(boundariesAabbQuad, nextViewport);
        if (offendingDistance.equals(Offset.zero)) {
            return nextMatrix;
        }
        const nextTotalTranslation: Offset = _getMatrixTranslation(nextMatrix);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const currentScale: number = matrix.getMaxScaleOnAxis();
        const correctedTotalTranslation: Offset = new Offset(nextTotalTranslation.dx - offendingDistance.dx * currentScale, nextTotalTranslation.dy - offendingDistance.dy * currentScale);
        const correctedMatrix: Matrix4 = (() => {
            const _dartTemporary14 = matrix.clone();
            _dartTemporary14.setTranslation(new Vector3(correctedTotalTranslation.dx, correctedTotalTranslation.dy, 0));
            return _dartTemporary14;
        })();
        const correctedViewport: SourceQuad = _transformViewport(correctedMatrix, this._dart_bb3c6814efa30c40_viewport);
        const offendingCorrectedDistance: Offset = _exceedsBy(boundariesAabbQuad, correctedViewport);
        if (offendingCorrectedDistance.equals(Offset.zero)) {
            return correctedMatrix;
        }
        if (offendingCorrectedDistance.dx !== 0 && offendingCorrectedDistance.dy !== 0) {
            return matrix.clone();
        }
        const unidirectionalCorrectedTotalTranslation: Offset = new Offset(offendingCorrectedDistance.dx === 0 ? correctedTotalTranslation.dx : 0, offendingCorrectedDistance.dy === 0 ? correctedTotalTranslation.dy : 0);
        return (() => {
            const _dartTemporary15 = matrix.clone();
            _dartTemporary15.setTranslation(new Vector3(unidirectionalCorrectedTotalTranslation.dx, unidirectionalCorrectedTotalTranslation.dy, 0));
            return _dartTemporary15;
        })();
    }
    /**
     * @dartParam scale double
     * @dartParamOrigin scale explicit
     */
    _dart_bb3c6814efa30c40_matrixScale(matrix: Matrix4, scale: number): Matrix4 {
        if (scale === 1) {
            return matrix.clone();
        }
        if (FoundationBuildMode.debug)
            invariant(scale !== 0, "generated-source-assert", "Pinned Dart assertion failed");
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const currentScale: number = this._dart_bb3c6814efa30c40_transformer.value.getMaxScaleOnAxis();
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const totalScale: number = Math.max(currentScale * scale, Math.max(this._dart_bb3c6814efa30c40_viewport.width / this._dart_bb3c6814efa30c40_boundaryRect.width, this._dart_bb3c6814efa30c40_viewport.height / this._dart_bb3c6814efa30c40_boundaryRect.height));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const clampedTotalScale: number = clamp(totalScale, this.widget.minScale, this.widget.maxScale);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const clampedScale: number = clampedTotalScale / currentScale;
        return (() => {
            const _dartTemporary16 = matrix.clone();
            _dartTemporary16.scaleByDouble(clampedScale, clampedScale, clampedScale, 1);
            return _dartTemporary16;
        })();
    }
    /**
     * @dartParam rotation double
     * @dartParamOrigin rotation explicit
     */
    _dart_bb3c6814efa30c40_matrixRotate(matrix: Matrix4, rotation: number, focalPoint: Offset): Matrix4 {
        if (rotation === 0) {
            return matrix.clone();
        }
        const focalPointScene: Offset = this._dart_bb3c6814efa30c40_transformer.toScene(focalPoint);
        return (() => {
            const _dartTemporary17 = matrix.clone();
            _dartTemporary17.translateByDouble(focalPointScene.dx, focalPointScene.dy, 0, 1);
            _dartTemporary17.rotateZ(-rotation);
            _dartTemporary17.translateByDouble(-focalPointScene.dx, -focalPointScene.dy, 0, 1);
            return _dartTemporary17;
        })();
    }
    _dart_bb3c6814efa30c40_gestureIsSupported(gestureType: SourceGestureType | null): boolean {
        return (() => {
            const _dartTemporary18 = gestureType;
            switch (_dartTemporary18) {
                case SourceGestureType.rotate: return this._dart_bb3c6814efa30c40_rotateEnabled;
                case SourceGestureType.scale: return this.widget.scaleEnabled;
                case SourceGestureType.pan: return this.widget.panEnabled;
                case null: return this.widget.panEnabled;
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
    }
    _dart_bb3c6814efa30c40_getGestureType(details: ScaleUpdateDetails): SourceGestureType {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const scale: number = !this.widget.scaleEnabled ? 1 : details.scale;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const rotation: number = !this._dart_bb3c6814efa30c40_rotateEnabled ? 0 : details.rotation;
        if (Math.abs((scale - 1)) > Math.abs(rotation)) {
            return SourceGestureType.scale;
        }
        else if (rotation !== 0) {
            return SourceGestureType.rotate;
        }
        else {
            return SourceGestureType.pan;
        }
    }
    _dart_bb3c6814efa30c40_onScaleStart(details: ScaleStartDetails): void {
        (() => {
            const _dartTemporary19 = this.widget.onInteractionStart;
            if (_dartTemporary19 === null)
                return null;
            return _dartTemporary19!(details);
        })();
        if (this._dart_bb3c6814efa30c40_controller.isAnimating) {
            this._dart_bb3c6814efa30c40_controller.stop();
            this._dart_bb3c6814efa30c40_controller.reset();
            (this._dart_bb3c6814efa30c40_animation?.removeListener(dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleInertiaAnimation)) ?? null);
            this._dart_bb3c6814efa30c40_animation = null;
        }
        if (this._dart_bb3c6814efa30c40_scaleController.isAnimating) {
            this._dart_bb3c6814efa30c40_scaleController.stop();
            this._dart_bb3c6814efa30c40_scaleController.reset();
            (this._dart_bb3c6814efa30c40_scaleAnimation?.removeListener(dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleScaleAnimation)) ?? null);
            this._dart_bb3c6814efa30c40_scaleAnimation = null;
        }
        this._dart_bb3c6814efa30c40_gestureType = null;
        this._dart_bb3c6814efa30c40_currentAxis = null;
        this._dart_bb3c6814efa30c40_scaleStart = this._dart_bb3c6814efa30c40_transformer.value.getMaxScaleOnAxis();
        this._dart_bb3c6814efa30c40_referenceFocalPoint = this._dart_bb3c6814efa30c40_transformer.toScene(details.localFocalPoint);
        this._dart_bb3c6814efa30c40_rotationStart = this._dart_bb3c6814efa30c40_currentRotation;
    }
    _dart_bb3c6814efa30c40_onScaleUpdate(details: ScaleUpdateDetails): void {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const scale: number = this._dart_bb3c6814efa30c40_transformer.value.getMaxScaleOnAxis();
        this._dart_bb3c6814efa30c40_scaleAnimationFocalPoint = details.localFocalPoint;
        const focalPointScene: Offset = this._dart_bb3c6814efa30c40_transformer.toScene(details.localFocalPoint);
        if (this._dart_bb3c6814efa30c40_gestureType === SourceGestureType.pan) {
            this._dart_bb3c6814efa30c40_gestureType = this._dart_bb3c6814efa30c40_getGestureType(details);
        }
        else {
            this._dart_bb3c6814efa30c40_gestureType ??= this._dart_bb3c6814efa30c40_getGestureType(details);
        }
        if (!this._dart_bb3c6814efa30c40_gestureIsSupported(this._dart_bb3c6814efa30c40_gestureType)) {
            (() => {
                const _dartTemporary20 = this.widget.onInteractionUpdate;
                if (_dartTemporary20 === null)
                    return null;
                return _dartTemporary20!(details);
            })();
            return;
        }
        switch ((() => {
            const _dartTemporary29 = this._dart_bb3c6814efa30c40_gestureType;
            if (_dartTemporary29 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary29!;
        })()) {
            case SourceGestureType.scale: {
                if (FoundationBuildMode.debug)
                    invariant(this._dart_bb3c6814efa30c40_scaleStart !== null, "generated-source-assert", "Pinned Dart assertion failed");
                const /**
                 * @dartType double
                 * @dartTypeOrigin explicit
                 */
                desiredScale: number = (() => {
                    const _dartTemporary21 = this._dart_bb3c6814efa30c40_scaleStart;
                    if (_dartTemporary21 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary21!;
                })() * details.scale;
                const /**
                 * @dartType double
                 * @dartTypeOrigin explicit
                 */
                scaleChange: number = desiredScale / scale;
                this._dart_bb3c6814efa30c40_transformer.value = this._dart_bb3c6814efa30c40_matrixScale(this._dart_bb3c6814efa30c40_transformer.value, scaleChange);
                const focalPointSceneScaled: Offset = this._dart_bb3c6814efa30c40_transformer.toScene(details.localFocalPoint);
                this._dart_bb3c6814efa30c40_transformer.value = this._dart_bb3c6814efa30c40_matrixTranslate(this._dart_bb3c6814efa30c40_transformer.value, focalPointSceneScaled.subtract((() => {
                    const _dartTemporary22 = this._dart_bb3c6814efa30c40_referenceFocalPoint;
                    if (_dartTemporary22 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary22!;
                })()));
                const focalPointSceneCheck: Offset = this._dart_bb3c6814efa30c40_transformer.toScene(details.localFocalPoint);
                if (!_round((() => {
                    const _dartTemporary23 = this._dart_bb3c6814efa30c40_referenceFocalPoint;
                    if (_dartTemporary23 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary23!;
                })()).equals(_round(focalPointSceneCheck))) {
                    this._dart_bb3c6814efa30c40_referenceFocalPoint = focalPointSceneCheck;
                }
                break;
            }
            case SourceGestureType.rotate: {
                if (details.rotation === 0) {
                    (() => {
                        const _dartTemporary24 = this.widget.onInteractionUpdate;
                        if (_dartTemporary24 === null)
                            return null;
                        return _dartTemporary24!(details);
                    })();
                    return;
                }
                const /**
                 * @dartType double
                 * @dartTypeOrigin explicit
                 */
                desiredRotation: number = (() => {
                    const _dartTemporary25 = this._dart_bb3c6814efa30c40_rotationStart;
                    if (_dartTemporary25 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary25!;
                })() + details.rotation;
                this._dart_bb3c6814efa30c40_transformer.value = this._dart_bb3c6814efa30c40_matrixRotate(this._dart_bb3c6814efa30c40_transformer.value, this._dart_bb3c6814efa30c40_currentRotation - desiredRotation, details.localFocalPoint);
                this._dart_bb3c6814efa30c40_currentRotation = desiredRotation;
                break;
            }
            case SourceGestureType.pan: {
                if (FoundationBuildMode.debug)
                    invariant(this._dart_bb3c6814efa30c40_referenceFocalPoint !== null, "generated-source-assert", "Pinned Dart assertion failed");
                if (details.scale !== 1) {
                    (() => {
                        const _dartTemporary26 = this.widget.onInteractionUpdate;
                        if (_dartTemporary26 === null)
                            return null;
                        return _dartTemporary26!(details);
                    })();
                    return;
                }
                this._dart_bb3c6814efa30c40_currentAxis ??= _getPanAxis((() => {
                    const _dartTemporary27 = this._dart_bb3c6814efa30c40_referenceFocalPoint;
                    if (_dartTemporary27 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary27!;
                })(), focalPointScene);
                const translationChange: Offset = focalPointScene.subtract((() => {
                    const _dartTemporary28 = this._dart_bb3c6814efa30c40_referenceFocalPoint;
                    if (_dartTemporary28 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary28!;
                })());
                this._dart_bb3c6814efa30c40_transformer.value = this._dart_bb3c6814efa30c40_matrixTranslate(this._dart_bb3c6814efa30c40_transformer.value, translationChange);
                this._dart_bb3c6814efa30c40_referenceFocalPoint = this._dart_bb3c6814efa30c40_transformer.toScene(details.localFocalPoint);
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
        (() => {
            const _dartTemporary30 = this.widget.onInteractionUpdate;
            if (_dartTemporary30 === null)
                return null;
            return _dartTemporary30!(details);
        })();
    }
    _dart_bb3c6814efa30c40_onScaleEnd(details: ScaleEndDetails): void {
        (() => {
            const _dartTemporary31 = this.widget.onInteractionEnd;
            if (_dartTemporary31 === null)
                return null;
            return _dartTemporary31!(details);
        })();
        this._dart_bb3c6814efa30c40_scaleStart = null;
        this._dart_bb3c6814efa30c40_rotationStart = null;
        this._dart_bb3c6814efa30c40_referenceFocalPoint = null;
        (this._dart_bb3c6814efa30c40_animation?.removeListener(dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleInertiaAnimation)) ?? null);
        (this._dart_bb3c6814efa30c40_scaleAnimation?.removeListener(dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleScaleAnimation)) ?? null);
        this._dart_bb3c6814efa30c40_controller.reset();
        this._dart_bb3c6814efa30c40_scaleController.reset();
        if (!this._dart_bb3c6814efa30c40_gestureIsSupported(this._dart_bb3c6814efa30c40_gestureType)) {
            this._dart_bb3c6814efa30c40_currentAxis = null;
            return;
        }
        switch (this._dart_bb3c6814efa30c40_gestureType) {
            case SourceGestureType.pan: {
                if (details.velocity.pixelsPerSecond.distance < kMinFlingVelocity) {
                    this._dart_bb3c6814efa30c40_currentAxis = null;
                    return;
                }
                const translationVector: Vector3 = this._dart_bb3c6814efa30c40_transformer.value.getTranslation();
                const translation: Offset = new Offset(translationVector.x, translationVector.y);
                const frictionSimulationX: FrictionSimulation = new FrictionSimulation(this.widget.interactionEndFrictionCoefficient, translation.dx, details.velocity.pixelsPerSecond.dx);
                const frictionSimulationY: FrictionSimulation = new FrictionSimulation(this.widget.interactionEndFrictionCoefficient, translation.dy, details.velocity.pixelsPerSecond.dy);
                const /**
                 * @dartType double
                 * @dartTypeOrigin explicit
                 */
                tFinal: number = _getFinalTime(details.velocity.pixelsPerSecond.distance, this.widget.interactionEndFrictionCoefficient);
                this._dart_bb3c6814efa30c40_animation = viewerOffsetTween({ begin: translation, end: new Offset(frictionSimulationX.finalX, frictionSimulationY.finalX) }).chain(new CurveTween({ curve: Curves.decelerate })).animate(this._dart_bb3c6814efa30c40_controller);
                this._dart_bb3c6814efa30c40_controller.duration = 0 + checkedInteger(roundInteger((tFinal * 1000))) * 1;
                (() => {
                    const _dartTemporary32 = this._dart_bb3c6814efa30c40_animation;
                    if (_dartTemporary32 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary32!;
                })().addListener(dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleInertiaAnimation));
                this._dart_bb3c6814efa30c40_controller.forward();
                break;
            }
            case SourceGestureType.scale: {
                if (Math.abs(details.scaleVelocity) < 0.1) {
                    this._dart_bb3c6814efa30c40_currentAxis = null;
                    return;
                }
                const /**
                 * @dartType double
                 * @dartTypeOrigin explicit
                 */
                scale: number = this._dart_bb3c6814efa30c40_transformer.value.getMaxScaleOnAxis();
                const frictionSimulation: FrictionSimulation = new FrictionSimulation(this.widget.interactionEndFrictionCoefficient * this.widget.scaleFactor, scale, details.scaleVelocity / 10);
                const /**
                 * @dartType double
                 * @dartTypeOrigin explicit
                 */
                tFinal: number = _getFinalTime(Math.abs(details.scaleVelocity), this.widget.interactionEndFrictionCoefficient, { effectivelyMotionless: 0.1 });
                this._dart_bb3c6814efa30c40_scaleAnimation = viewerNumberTween({ begin: scale, end: frictionSimulation.x(tFinal) }).chain(new CurveTween({ curve: Curves.decelerate })).animate(this._dart_bb3c6814efa30c40_scaleController);
                this._dart_bb3c6814efa30c40_scaleController.duration = 0 + checkedInteger(roundInteger((tFinal * 1000))) * 1;
                (() => {
                    const _dartTemporary33 = this._dart_bb3c6814efa30c40_scaleAnimation;
                    if (_dartTemporary33 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary33!;
                })().addListener(dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleScaleAnimation));
                this._dart_bb3c6814efa30c40_scaleController.forward();
                break;
            }
            case SourceGestureType.rotate: {
                break;
                break;
            }
            case null: {
                break;
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
    }
    _dart_bb3c6814efa30c40_receivedPointerSignal(event: PointerSignalEvent): void {
        const local: Offset = event.localPosition;
        const global: Offset = event.position;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        let scaleChange: number;
        if (viewerIsScrollEvent(event)) {
            if ((event as PointerScrollEvent).kind === PointerDeviceKind.trackpad && !this.widget.trackpadScrollCausesScale) {
                (() => {
                    const _dartTemporary34 = this.widget.onInteractionStart;
                    if (_dartTemporary34 === null)
                        return null;
                    return _dartTemporary34!(new ScaleStartDetails({ focalPoint: global, localFocalPoint: local }));
                })();
                const localDelta: Offset = viewerTransformDelta({ untransformedEndPosition: global.add((event as PointerScrollEvent).scrollDelta), untransformedDelta: (event as PointerScrollEvent).scrollDelta, transform: viewerEventTransform(event as PointerScrollEvent) });
                if (!this._dart_bb3c6814efa30c40_gestureIsSupported(SourceGestureType.pan)) {
                    (() => {
                        const _dartTemporary35 = this.widget.onInteractionUpdate;
                        if (_dartTemporary35 === null)
                            return null;
                        return _dartTemporary35!(new ScaleUpdateDetails({ focalPoint: global.subtract((event as PointerScrollEvent).scrollDelta), localFocalPoint: local.subtract((event as PointerScrollEvent).scrollDelta), focalPointDelta: localDelta.negate() }));
                    })();
                    (() => {
                        const _dartTemporary36 = this.widget.onInteractionEnd;
                        if (_dartTemporary36 === null)
                            return null;
                        return _dartTemporary36!(new ScaleEndDetails({}));
                    })();
                    return;
                }
                const focalPointScene: Offset = this._dart_bb3c6814efa30c40_transformer.toScene(local);
                const newFocalPointScene: Offset = this._dart_bb3c6814efa30c40_transformer.toScene(local.subtract(localDelta));
                this._dart_bb3c6814efa30c40_transformer.value = this._dart_bb3c6814efa30c40_matrixTranslate(this._dart_bb3c6814efa30c40_transformer.value, newFocalPointScene.subtract(focalPointScene));
                (() => {
                    const _dartTemporary37 = this.widget.onInteractionUpdate;
                    if (_dartTemporary37 === null)
                        return null;
                    return _dartTemporary37!(new ScaleUpdateDetails({ focalPoint: global.subtract((event as PointerScrollEvent).scrollDelta), localFocalPoint: local.subtract(localDelta), focalPointDelta: localDelta.negate() }));
                })();
                (() => {
                    const _dartTemporary38 = this.widget.onInteractionEnd;
                    if (_dartTemporary38 === null)
                        return null;
                    return _dartTemporary38!(new ScaleEndDetails({}));
                })();
                return;
            }
            if ((event as PointerScrollEvent).scrollDelta.dy === 0) {
                return;
            }
            scaleChange = Math.exp(-(event as PointerScrollEvent).scrollDelta.dy / this.widget.scaleFactor);
        }
        else if (viewerIsScaleEvent(event)) {
            scaleChange = (event as PointerScaleEvent).scale;
        }
        else {
            return;
        }
        (() => {
            const _dartTemporary39 = this.widget.onInteractionStart;
            if (_dartTemporary39 === null)
                return null;
            return _dartTemporary39!(new ScaleStartDetails({ focalPoint: global, localFocalPoint: local }));
        })();
        if (!this._dart_bb3c6814efa30c40_gestureIsSupported(SourceGestureType.scale)) {
            (() => {
                const _dartTemporary40 = this.widget.onInteractionUpdate;
                if (_dartTemporary40 === null)
                    return null;
                return _dartTemporary40!(new ScaleUpdateDetails({ focalPoint: global, localFocalPoint: local, scale: scaleChange }));
            })();
            (() => {
                const _dartTemporary41 = this.widget.onInteractionEnd;
                if (_dartTemporary41 === null)
                    return null;
                return _dartTemporary41!(new ScaleEndDetails({}));
            })();
            return;
        }
        const focalPointScene: Offset = this._dart_bb3c6814efa30c40_transformer.toScene(local);
        this._dart_bb3c6814efa30c40_transformer.value = this._dart_bb3c6814efa30c40_matrixScale(this._dart_bb3c6814efa30c40_transformer.value, scaleChange);
        const focalPointSceneScaled: Offset = this._dart_bb3c6814efa30c40_transformer.toScene(local);
        this._dart_bb3c6814efa30c40_transformer.value = this._dart_bb3c6814efa30c40_matrixTranslate(this._dart_bb3c6814efa30c40_transformer.value, focalPointSceneScaled.subtract(focalPointScene));
        (() => {
            const _dartTemporary42 = this.widget.onInteractionUpdate;
            if (_dartTemporary42 === null)
                return null;
            return _dartTemporary42!(new ScaleUpdateDetails({ focalPoint: global, localFocalPoint: local, scale: scaleChange }));
        })();
        (() => {
            const _dartTemporary43 = this.widget.onInteractionEnd;
            if (_dartTemporary43 === null)
                return null;
            return _dartTemporary43!(new ScaleEndDetails({}));
        })();
    }
    _dart_bb3c6814efa30c40_handleInertiaAnimation(): void {
        if (!this._dart_bb3c6814efa30c40_controller.isAnimating) {
            this._dart_bb3c6814efa30c40_currentAxis = null;
            (this._dart_bb3c6814efa30c40_animation?.removeListener(dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleInertiaAnimation)) ?? null);
            this._dart_bb3c6814efa30c40_animation = null;
            this._dart_bb3c6814efa30c40_controller.reset();
            return;
        }
        const translationVector: Vector3 = this._dart_bb3c6814efa30c40_transformer.value.getTranslation();
        const translation: Offset = new Offset(translationVector.x, translationVector.y);
        this._dart_bb3c6814efa30c40_transformer.value = this._dart_bb3c6814efa30c40_matrixTranslate(this._dart_bb3c6814efa30c40_transformer.value, this._dart_bb3c6814efa30c40_transformer.toScene((() => {
            const _dartTemporary44 = this._dart_bb3c6814efa30c40_animation;
            if (_dartTemporary44 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary44!;
        })().value).subtract(this._dart_bb3c6814efa30c40_transformer.toScene(translation)));
    }
    _dart_bb3c6814efa30c40_handleScaleAnimation(): void {
        if (!this._dart_bb3c6814efa30c40_scaleController.isAnimating) {
            this._dart_bb3c6814efa30c40_currentAxis = null;
            (this._dart_bb3c6814efa30c40_scaleAnimation?.removeListener(dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleScaleAnimation)) ?? null);
            this._dart_bb3c6814efa30c40_scaleAnimation = null;
            this._dart_bb3c6814efa30c40_scaleController.reset();
            return;
        }
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const desiredScale: number = (() => {
            const _dartTemporary45 = this._dart_bb3c6814efa30c40_scaleAnimation;
            if (_dartTemporary45 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary45!;
        })().value;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const scaleChange: number = desiredScale / this._dart_bb3c6814efa30c40_transformer.value.getMaxScaleOnAxis();
        const referenceFocalPoint: Offset = this._dart_bb3c6814efa30c40_transformer.toScene(this._dart_bb3c6814efa30c40_scaleAnimationFocalPoint);
        this._dart_bb3c6814efa30c40_transformer.value = this._dart_bb3c6814efa30c40_matrixScale(this._dart_bb3c6814efa30c40_transformer.value, scaleChange);
        const focalPointSceneScaled: Offset = this._dart_bb3c6814efa30c40_transformer.toScene(this._dart_bb3c6814efa30c40_scaleAnimationFocalPoint);
        this._dart_bb3c6814efa30c40_transformer.value = this._dart_bb3c6814efa30c40_matrixTranslate(this._dart_bb3c6814efa30c40_transformer.value, focalPointSceneScaled.subtract(referenceFocalPoint));
    }
    _dart_bb3c6814efa30c40_handleTransformation(): void {
        this.setState((): void => {
        });
    }
    override initState(): void {
        super.initState();
        this._dart_bb3c6814efa30c40_controller = new AnimationController({ vsync: this });
        this._dart_bb3c6814efa30c40_scaleController = new AnimationController({ vsync: this });
        this._dart_bb3c6814efa30c40_transformer.addListener(dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleTransformation));
    }
    override didUpdateWidget(oldWidget: SourceInteractiveViewer): void {
        if (!(oldWidget instanceof SourceInteractiveViewer))
            throw new TypeError("Invalid covariant argument: oldWidget");
        super.didUpdateWidget(oldWidget);
        const newController: SourceTransformationController | null = this.widget.transformationController;
        if (newController === oldWidget.transformationController) {
            return;
        }
        this._dart_bb3c6814efa30c40_transformer.removeListener(dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleTransformation));
        if (oldWidget.transformationController === null) {
            this._dart_bb3c6814efa30c40_transformer.dispose();
        }
        this._dart_bb3c6814efa30c40_transformer = newController ?? new SourceTransformationController();
        this._dart_bb3c6814efa30c40_transformer.addListener(dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleTransformation));
    }
    override dispose(): void {
        this._dart_bb3c6814efa30c40_controller.dispose();
        this._dart_bb3c6814efa30c40_scaleController.dispose();
        this._dart_bb3c6814efa30c40_transformer.removeListener(dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleTransformation));
        if (this.widget.transformationController === null) {
            this._dart_bb3c6814efa30c40_transformer.dispose();
        }
        super.dispose();
    }
    override build(context: BuildContext): Widget {
        let child: Widget;
        if (this.widget.child !== null) {
            child = new SourceInteractiveViewerBuilt({ childKey: this._dart_bb3c6814efa30c40_childKey, clipBehavior: this.widget.clipBehavior, constrained: this.widget.constrained, matrix: this._dart_bb3c6814efa30c40_transformer.value, alignment: this.widget.alignment, child: (() => {
                    const _dartTemporary46 = this.widget.child;
                    if (_dartTemporary46 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary46!;
                })() });
        }
        else {
            if (FoundationBuildMode.debug)
                invariant(this.widget.builder !== null, "generated-source-assert", "Pinned Dart assertion failed");
            if (FoundationBuildMode.debug)
                invariant(!this.widget.constrained, "generated-source-assert", "Pinned Dart assertion failed");
            child = viewerLayoutBuilder({ builder: (context: BuildContext, constraints: BoxConstraints): SourceInteractiveViewerBuilt => {
                    const matrix: Matrix4 = this._dart_bb3c6814efa30c40_transformer.value;
                    return new SourceInteractiveViewerBuilt({ childKey: this._dart_bb3c6814efa30c40_childKey, clipBehavior: this.widget.clipBehavior, constrained: this.widget.constrained, alignment: this.widget.alignment, matrix: matrix, child: (() => {
                            const _dartTemporary47 = this.widget.builder;
                            if (_dartTemporary47 === null)
                                throw new TypeError("Null check operator used on a null value");
                            return _dartTemporary47!;
                        })()(context, _transformViewport(matrix, viewerOffsetRect(Offset.zero, constraints.biggest))) });
                } });
        }
        return viewerListener({ key: this._dart_bb3c6814efa30c40_parentKey, onPointerSignal: dartMethodTearOff(this, this._dart_bb3c6814efa30c40_receivedPointerSignal), child: viewerGestureDetector({ behavior: HitTestBehavior.opaque, onScaleEnd: dartMethodTearOff(this, this._dart_bb3c6814efa30c40_onScaleEnd), onScaleStart: dartMethodTearOff(this, this._dart_bb3c6814efa30c40_onScaleStart), onScaleUpdate: dartMethodTearOff(this, this._dart_bb3c6814efa30c40_onScaleUpdate), trackpadScrollCausesScale: this.widget.trackpadScrollCausesScale, trackpadScrollToScaleFactor: new Offset(0, checkedInteger(-1) / this.widget.scaleFactor), child: child }) });
    }
}
export class SourceInteractiveViewerBuilt extends StatelessWidget {
    readonly child: Widget;
    readonly childKey: GlobalKey<State<StatefulWidget>>;
    readonly clipBehavior: Clip;
    readonly constrained: boolean;
    readonly matrix: Matrix4;
    readonly alignment: Alignment | null;
    constructor({ child, childKey, clipBehavior, constrained, matrix, alignment }: {
        readonly child: Widget;
        readonly childKey: GlobalKey<State<StatefulWidget>>;
        readonly clipBehavior: Clip;
        readonly constrained: boolean;
        readonly matrix: Matrix4;
        readonly alignment: Alignment | null;
    }) {
        const _initialField0 = child;
        const _initialField1 = childKey;
        const _initialField2 = clipBehavior;
        const _initialField3 = constrained;
        const _initialField4 = matrix;
        const _initialField5 = alignment;
        super();
        this.child = _initialField0;
        this.childKey = _initialField1;
        this.clipBehavior = _initialField2;
        this.constrained = _initialField3;
        this.matrix = _initialField4;
        this.alignment = _initialField5;
        protect(this, ["child", "childKey", "clipBehavior", "constrained", "matrix", "alignment"]);
    }
    override build(context: BuildContext): Widget {
        let child: Widget = viewerTransform({ transform: this.matrix, alignment: this.alignment, child: new KeyedSubtree({ key: this.childKey, child: this.child }) });
        if (!this.constrained) {
            child = viewerOverflowBox({ alignment: Alignment.topLeft, minWidth: 0, minHeight: 0, maxWidth: Infinity, maxHeight: Infinity, child: child });
        }
        return viewerClipRect({ clipBehavior: this.clipBehavior, child: child });
    }
}
export class SourceTransformationController extends ViewerValueNotifierHost<Matrix4> {
    constructor(value: Matrix4 | null = null) {
        super(value ?? Matrix4.identity());
    }
    toScene(viewportPoint: Offset): Offset {
        const inverseMatrix: Matrix4 = Matrix4.inverted(this.value);
        const untransformed: Vector3 = inverseMatrix.transform3(new Vector3(viewportPoint.dx, viewportPoint.dy, 0));
        return new Offset(untransformed.x, untransformed.y);
    }
}
/**
 * @dartParam velocity double
 * @dartParamOrigin velocity explicit
 * @dartParam drag double
 * @dartParamOrigin drag explicit
 * @dartParam effectivelyMotionless double
 * @dartParamOrigin effectivelyMotionless explicit
 * @dartReturn double
 * @dartReturnOrigin explicit
 */
export function _getFinalTime(velocity: number, drag: number, { effectivelyMotionless = 10 }: {
    readonly effectivelyMotionless?: number;
} = {}): number {
    return Math.log(effectivelyMotionless / velocity) / Math.log(drag / 100);
}
export function _getMatrixTranslation(matrix: Matrix4): Offset {
    const nextTranslation: Vector3 = matrix.getTranslation();
    return new Offset(nextTranslation.x, nextTranslation.y);
}
export function _transformViewport(matrix: Matrix4, viewport: Rect): SourceQuad {
    const inverseMatrix: Matrix4 = (() => {
        const _dartTemporary48 = matrix.clone();
        _dartTemporary48.invert();
        return _dartTemporary48;
    })();
    return SourceQuad.points(inverseMatrix.transform3(new Vector3(viewport.topLeft.dx, viewport.topLeft.dy, 0)), inverseMatrix.transform3(new Vector3(viewport.topRight.dx, viewport.topRight.dy, 0)), inverseMatrix.transform3(new Vector3(viewport.bottomRight.dx, viewport.bottomRight.dy, 0)), inverseMatrix.transform3(new Vector3(viewport.bottomLeft.dx, viewport.bottomLeft.dy, 0)));
}
/**
 * @dartParam rotation double
 * @dartParamOrigin rotation explicit
 */
export function _getAxisAlignedBoundingBoxWithRotation(rect: Rect, rotation: number): SourceQuad {
    const rotationMatrix: Matrix4 = (() => {
        const _dartTemporary49 = Matrix4.identity();
        _dartTemporary49.translateByDouble(rect.size.width / 2, rect.size.height / 2, 0, 1);
        _dartTemporary49.rotateZ(rotation);
        _dartTemporary49.translateByDouble(-rect.size.width / 2, -rect.size.height / 2, 0, 1);
        return _dartTemporary49;
    })();
    const boundariesRotated: SourceQuad = SourceQuad.points(rotationMatrix.transform3(new Vector3(rect.left, rect.top, 0)), rotationMatrix.transform3(new Vector3(rect.right, rect.top, 0)), rotationMatrix.transform3(new Vector3(rect.right, rect.bottom, 0)), rotationMatrix.transform3(new Vector3(rect.left, rect.bottom, 0)));
    return SourceInteractiveViewer.getAxisAlignedBoundingBox(boundariesRotated);
}
export function _exceedsBy(boundary: SourceQuad, viewport: SourceQuad): Offset {
    const viewportPoints: ViewerSourceList<Vector3> = [viewport.point0, viewport.point1, viewport.point2, viewport.point3];
    let largestExcess: Offset = Offset.zero;
    for (const _dartTemporary50 of viewportPoints) {
        const point: Vector3 = _dartTemporary50;
        {
            const pointInside: Vector3 = SourceInteractiveViewer.getNearestPointInside(point, boundary);
            const excess: Offset = new Offset(pointInside.x - point.x, pointInside.y - point.y);
            if (Math.abs(excess.dx) > Math.abs(largestExcess.dx)) {
                largestExcess = new Offset(excess.dx, largestExcess.dy);
            }
            if (Math.abs(excess.dy) > Math.abs(largestExcess.dy)) {
                largestExcess = new Offset(largestExcess.dx, excess.dy);
            }
        }
    }
    return _round(largestExcess);
}
export function _round(offset: Offset): Offset {
    return new Offset(viewerParseDouble(viewerFixed(offset.dx, 9)), viewerParseDouble(viewerFixed(offset.dy, 9)));
}
export function _alignAxis(offset: Offset, axis: Axis): Offset {
    return (() => {
        const _dartTemporary51 = axis;
        switch (_dartTemporary51) {
            case Axis.horizontal: return new Offset(offset.dx, 0);
            case Axis.vertical: return new Offset(0, offset.dy);
            default: throw new TypeError("Non-exhaustive Dart switch expression");
        }
    })();
}
export function _getPanAxis(point1: Offset, point2: Offset): Axis | null {
    if (point1.equals(point2)) {
        return null;
    }
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const x: number = point2.dx - point1.dx;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const y: number = point2.dy - point1.dy;
    return Math.abs(x) > Math.abs(y) ? Axis.horizontal : Axis.vertical;
}
