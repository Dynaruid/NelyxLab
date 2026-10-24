// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/scrollable.dart; SHA256 b8f9773bed19bb9d83fae2e253e173dcf1297a14832989cdb01c840dc572e377
import { StatefulWidget } from "./framework.ts";
import { State } from "./framework.ts";
import { InheritedWidget } from "./framework.ts";
import { Scrollable } from "./scrollable.ts";
import { ScrollableState } from "./scrollable.ts";
import { SourceScrollableDetails } from "./scrollable-details.generated.ts";
import { ScrollController } from "./scroll-controller.ts";
import { GlobalKey } from "./global-key.ts";
import { RestorationScope } from "./restoration.ts";
import { Axis } from "../painting/basic-types.ts";
import { AxisDirection } from "../painting/basic-types.ts";
import { axisDirectionToAxis } from "../painting/basic-types.ts";
import { DragStartBehavior } from "../gestures/recognizer.ts";
import { GestureRecognizer } from "../gestures/recognizer.ts";
import { PanGestureRecognizer } from "../gestures/monodrag.ts";
import { DragDownDetails } from "../gestures/drag-details.ts";
import { DragStartDetails } from "../gestures/drag-details.ts";
import { DragUpdateDetails } from "../gestures/drag-details.ts";
import { DragEndDetails } from "../gestures/drag-details.ts";
import { Velocity } from "../gestures/velocity-tracker.ts";
import { HitTestBehavior } from "../rendering/pointer-listener.ts";
import { Curves } from "../animation/curves.ts";
import { ScrollPositionAlignmentPolicy } from "./scroll-position.ts";
import { GestureRecognizerFactory } from "./raw-gesture-detector.ts";
import { GestureRecognizerFactoryWithHandlers } from "./raw-gesture-detector.ts";
import { Offset } from "../../ui/offset.ts";
import { DartMap } from "../../foundation/dart-collections.ts";
import { dartRecord } from "../../foundation/dart-record.ts";
import { dartRecordRead } from "../../foundation/dart-record.ts";
import { dartLateRead } from "../../foundation/dart-late.ts";
import { dartLateWrite } from "../../foundation/dart-late.ts";
import { dartMethodTearOff } from "../../foundation/dart-method-tear-off.ts";
import { protect } from "../../ui/value-math.ts";
import { checkedInteger } from "../../ui/value-math.ts";
import { invariant } from "../../foundation/errors.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { FlutterError } from "../../foundation/flutter-error.ts";
import { ErrorSummary } from "../../foundation/diagnostics.ts";
import { ErrorDescription } from "../../foundation/diagnostics.ts";
import { DiagonalDragBehavior } from "./two-dimensional-scrollable-adapter.ts";
import { TwoAxisStatefulHost } from "./two-dimensional-scrollable-adapter.ts";
import { TwoAxisInheritedHost } from "./two-dimensional-scrollable-adapter.ts";
import { TwoAxisScrollableHost } from "./two-dimensional-scrollable-adapter.ts";
import { TwoAxisScrollableStateHost } from "./two-dimensional-scrollable-adapter.ts";
import { createSourceGestureFactories } from "./two-dimensional-scrollable-adapter.ts";
import { emptySourceGestureFactories } from "./two-dimensional-scrollable-adapter.ts";
import { createSourcePan } from "./two-dimensional-scrollable-adapter.ts";
import { createSourcePanFactory } from "./two-dimensional-scrollable-adapter.ts";
import { createSourceScrollableKey } from "./two-dimensional-scrollable-adapter.ts";
import { sourceCurrentScrollable } from "./two-dimensional-scrollable-adapter.ts";
import { sourceCurrentGestureDetector } from "./two-dimensional-scrollable-adapter.ts";
import { replaceSourceGestureRecognizers } from "./two-dimensional-scrollable-adapter.ts";
import { sourceObjectString } from "./two-dimensional-scrollable-adapter.ts";
import { dependOnSourceTwoAxis } from "./two-dimensional-scrollable-types.ts";
import { isSourceVerticalOuterDimension } from "./two-dimensional-scrollable-types.ts";
import { castSourceVerticalOuterDimension } from "./two-dimensional-scrollable-types.ts";
import { isSourceHorizontalInnerDimension } from "./two-dimensional-scrollable-types.ts";
import { castSourceHorizontalInnerDimension } from "./two-dimensional-scrollable-types.ts";
import { twoAxisSourcePosition } from "./two-dimensional-scrollable-adapter.ts";
import { twoAxisEnsureVisible } from "./two-dimensional-scrollable-adapter.ts";
import type { Widget } from "./framework.ts";
import type { BuildContext } from "./framework.ts";
import type { Curve } from "../animation/curves.ts";
import type { ViewportOffset } from "../rendering/viewport-offset.ts";
import type { ScrollIncrementDetails } from "./scrollable-helpers.ts";
import type { ScrollPhysics } from "./scroll-physics.ts";
import type { PointerEvent } from "../gestures/events.ts";
import type { VelocityTracker } from "../gestures/velocity-tracker.ts";
import type { RenderObject } from "../rendering/object.ts";
import type { Clip } from "../../ui/clip.ts";
import type { DartRecord } from "../../foundation/dart-record.ts";
import type { SourceMutableList } from "./two-dimensional-scrollable-adapter.ts";
import type { SourceGestureType } from "./two-dimensional-scrollable-adapter.ts";
import type { Key } from "../../foundation/key.ts";
import type { SourceFuture } from "./two-dimensional-scrollable-adapter.ts";
export class SourceTwoDimensionalScrollable extends TwoAxisStatefulHost {
    readonly diagonalDragBehavior: DiagonalDragBehavior;
    readonly horizontalDetails: SourceScrollableDetails;
    readonly verticalDetails: SourceScrollableDetails;
    readonly viewportBuilder: (argument0: BuildContext, argument1: ViewportOffset, argument2: ViewportOffset) => Widget;
    /**
     * @dartType double Function(ScrollIncrementDetails)?
     * @dartTypeOrigin explicit
     */
    readonly incrementCalculator: ((argument0: ScrollIncrementDetails) => number) | null;
    readonly restorationId: string | null;
    readonly excludeFromSemantics: boolean;
    readonly hitTestBehavior: HitTestBehavior;
    readonly dragStartBehavior: DragStartBehavior;
    /**
     * @dartParam incrementCalculator double Function(ScrollIncrementDetails)?
     * @dartParamOrigin incrementCalculator inferred
     */
    constructor({ key = null, horizontalDetails, verticalDetails, viewportBuilder, incrementCalculator = null, restorationId = null, excludeFromSemantics = false, diagonalDragBehavior = DiagonalDragBehavior.none, dragStartBehavior = DragStartBehavior.start, hitTestBehavior = HitTestBehavior.opaque }: {
        readonly key?: Key | null;
        readonly horizontalDetails: SourceScrollableDetails;
        readonly verticalDetails: SourceScrollableDetails;
        readonly viewportBuilder: (argument0: BuildContext, argument1: ViewportOffset, argument2: ViewportOffset) => Widget;
        readonly incrementCalculator?: ((argument0: ScrollIncrementDetails) => number) | null;
        readonly restorationId?: string | null;
        readonly excludeFromSemantics?: boolean;
        readonly diagonalDragBehavior?: DiagonalDragBehavior;
        readonly dragStartBehavior?: DragStartBehavior;
        readonly hitTestBehavior?: HitTestBehavior;
    }) {
        const _initialField0 = horizontalDetails;
        const _initialField1 = verticalDetails;
        const _initialField2 = viewportBuilder;
        /**
         * @dartType double Function(ScrollIncrementDetails)?
         * @dartTypeOrigin inferred
         */
        const _initialField3 = incrementCalculator;
        const _initialField4 = restorationId;
        const _initialField5 = excludeFromSemantics;
        const _initialField6 = diagonalDragBehavior;
        const _initialField7 = dragStartBehavior;
        const _initialField8 = hitTestBehavior;
        super({ key: key });
        this.diagonalDragBehavior = _initialField6;
        this.horizontalDetails = _initialField0;
        this.verticalDetails = _initialField1;
        this.viewportBuilder = _initialField2;
        this.incrementCalculator = _initialField3;
        this.restorationId = _initialField4;
        this.excludeFromSemantics = _initialField5;
        this.hitTestBehavior = _initialField8;
        this.dragStartBehavior = _initialField7;
        protect(this, ["diagonalDragBehavior", "horizontalDetails", "verticalDetails", "viewportBuilder", "incrementCalculator", "restorationId", "excludeFromSemantics", "hitTestBehavior", "dragStartBehavior"]);
    }
    override createState(): State<SourceTwoDimensionalScrollable> {
        return new SourceTwoDimensionalScrollableState();
    }
    static maybeOf(context: BuildContext): SourceTwoDimensionalScrollableState | null {
        const widget: SourceTwoDimensionalScrollableScope | null = dependOnSourceTwoAxis(context);
        return (() => {
            const _dartTemporary0 = widget;
            return _dartTemporary0 === null ? null : _dartTemporary0.twoDimensionalScrollable;
        })();
    }
    static of(context: BuildContext): SourceTwoDimensionalScrollableState {
        const scrollableState: SourceTwoDimensionalScrollableState | null = SourceTwoDimensionalScrollable.maybeOf(context);
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                if (scrollableState === null) {
                    (() => {
                        const _dartTemporary1 = FlutterError.fromParts([new ErrorSummary("TwoDimensionalScrollable.of() was called with a context that does not contain a TwoDimensionalScrollable widget.\n"), new ErrorDescription(`No TwoDimensionalScrollable widget ancestor could be found starting from the context that was passed to TwoDimensionalScrollable.of(). This can happen because you are using a widget that looks for a TwoDimensionalScrollable ancestor, but no such ancestor exists.
The context used was:
  ${sourceObjectString(context)}`)]);
                        throw _dartTemporary1;
                    })();
                }
                return true;
            })(), "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
        return (() => {
            const _dartTemporary2 = scrollableState;
            if (_dartTemporary2 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary2!;
        })();
    }
}
export class SourceTwoDimensionalScrollableState extends State<SourceTwoDimensionalScrollable> {
    _dart_538df04f7c78ed0e_verticalFallbackController: ScrollController | null;
    _dart_538df04f7c78ed0e_horizontalFallbackController: ScrollController | null;
    readonly _dart_538df04f7c78ed0e_verticalOuterScrollableKey: GlobalKey<ScrollableState>;
    readonly _dart_538df04f7c78ed0e_horizontalInnerScrollableKey: GlobalKey<ScrollableState>;
    constructor() {
        const _initialField0 = createSourceScrollableKey();
        const _initialField1 = createSourceScrollableKey();
        super();
        this._dart_538df04f7c78ed0e_verticalFallbackController = null;
        this._dart_538df04f7c78ed0e_horizontalFallbackController = null;
        this._dart_538df04f7c78ed0e_verticalOuterScrollableKey = _initialField0;
        this._dart_538df04f7c78ed0e_horizontalInnerScrollableKey = _initialField1;
        protect(this, ["_dart_538df04f7c78ed0e_verticalOuterScrollableKey", "_dart_538df04f7c78ed0e_horizontalInnerScrollableKey"]);
    }
    get verticalScrollable(): ScrollableState {
        if (FoundationBuildMode.debug)
            invariant(sourceCurrentScrollable(this._dart_538df04f7c78ed0e_verticalOuterScrollableKey) !== null, "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
        return (() => {
            const _dartTemporary3 = sourceCurrentScrollable(this._dart_538df04f7c78ed0e_verticalOuterScrollableKey);
            if (_dartTemporary3 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary3!;
        })();
    }
    get horizontalScrollable(): ScrollableState {
        if (FoundationBuildMode.debug)
            invariant(sourceCurrentScrollable(this._dart_538df04f7c78ed0e_horizontalInnerScrollableKey) !== null, "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
        return (() => {
            const _dartTemporary4 = sourceCurrentScrollable(this._dart_538df04f7c78ed0e_horizontalInnerScrollableKey);
            if (_dartTemporary4 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary4!;
        })();
    }
    override initState(): void {
        if (this.widget.verticalDetails.controller === null) {
            this._dart_538df04f7c78ed0e_verticalFallbackController = new ScrollController({});
        }
        if (this.widget.horizontalDetails.controller === null) {
            this._dart_538df04f7c78ed0e_horizontalFallbackController = new ScrollController({});
        }
        super.initState();
    }
    override didUpdateWidget(oldWidget: SourceTwoDimensionalScrollable): void {
        if (!(oldWidget instanceof SourceTwoDimensionalScrollable))
            throw new TypeError("Invalid covariant argument: oldWidget");
        super.didUpdateWidget(oldWidget);
        if (!(oldWidget.verticalDetails.controller === this.widget.verticalDetails.controller)) {
            if (oldWidget.verticalDetails.controller === null) {
                if (FoundationBuildMode.debug)
                    invariant(this._dart_538df04f7c78ed0e_verticalFallbackController !== null, "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
                if (FoundationBuildMode.debug)
                    invariant(this.widget.verticalDetails.controller !== null, "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
                (() => {
                    const _dartTemporary5 = this._dart_538df04f7c78ed0e_verticalFallbackController;
                    if (_dartTemporary5 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary5!;
                })().dispose();
                this._dart_538df04f7c78ed0e_verticalFallbackController = null;
            }
            else if (this.widget.verticalDetails.controller === null) {
                if (FoundationBuildMode.debug)
                    invariant(this._dart_538df04f7c78ed0e_verticalFallbackController === null, "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
                this._dart_538df04f7c78ed0e_verticalFallbackController = new ScrollController({});
            }
        }
        if (!(oldWidget.horizontalDetails.controller === this.widget.horizontalDetails.controller)) {
            if (oldWidget.horizontalDetails.controller === null) {
                if (FoundationBuildMode.debug)
                    invariant(this._dart_538df04f7c78ed0e_horizontalFallbackController !== null, "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
                if (FoundationBuildMode.debug)
                    invariant(this.widget.horizontalDetails.controller !== null, "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
                (() => {
                    const _dartTemporary6 = this._dart_538df04f7c78ed0e_horizontalFallbackController;
                    if (_dartTemporary6 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary6!;
                })().dispose();
                this._dart_538df04f7c78ed0e_horizontalFallbackController = null;
            }
            else if (this.widget.horizontalDetails.controller === null) {
                if (FoundationBuildMode.debug)
                    invariant(this._dart_538df04f7c78ed0e_horizontalFallbackController === null, "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
                this._dart_538df04f7c78ed0e_horizontalFallbackController = new ScrollController({});
            }
        }
    }
    override build(context: BuildContext): Widget {
        if (FoundationBuildMode.debug)
            invariant(axisDirectionToAxis(this.widget.verticalDetails.direction) === Axis.vertical, "source-two-dimensional-scrollable", "TwoDimensionalScrollable.verticalDetails are not Axis.vertical.");
        if (FoundationBuildMode.debug)
            invariant(axisDirectionToAxis(this.widget.horizontalDetails.direction) === Axis.horizontal, "source-two-dimensional-scrollable", "TwoDimensionalScrollable.horizontalDetails are not Axis.horizontal.");
        const result: Widget = new RestorationScope({ restorationId: this.widget.restorationId, child: new SourceVerticalOuterDimension({ key: this._dart_538df04f7c78ed0e_verticalOuterScrollableKey, horizontalKey: this._dart_538df04f7c78ed0e_horizontalInnerScrollableKey, axisDirection: this.widget.verticalDetails.direction, controller: this.widget.verticalDetails.controller ?? (() => {
                    const _dartTemporary7 = this._dart_538df04f7c78ed0e_verticalFallbackController;
                    if (_dartTemporary7 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary7!;
                })(), physics: this.widget.verticalDetails.physics, clipBehavior: this.widget.verticalDetails.clipBehavior ?? this.widget.verticalDetails.decorationClipBehavior ?? "hardEdge", incrementCalculator: this.widget.incrementCalculator, excludeFromSemantics: this.widget.excludeFromSemantics, restorationId: "OuterVerticalTwoDimensionalScrollable", dragStartBehavior: this.widget.dragStartBehavior, diagonalDragBehavior: this.widget.diagonalDragBehavior, hitTestBehavior: this.widget.hitTestBehavior, viewportBuilder: (context: BuildContext, verticalOffset: ViewportOffset): SourceHorizontalInnerDimension => {
                    return new SourceHorizontalInnerDimension({ key: this._dart_538df04f7c78ed0e_horizontalInnerScrollableKey, verticalOuterKey: this._dart_538df04f7c78ed0e_verticalOuterScrollableKey, axisDirection: this.widget.horizontalDetails.direction, controller: this.widget.horizontalDetails.controller ?? (() => {
                            const _dartTemporary8 = this._dart_538df04f7c78ed0e_horizontalFallbackController;
                            if (_dartTemporary8 === null)
                                throw new TypeError("Null check operator used on a null value");
                            return _dartTemporary8!;
                        })(), physics: this.widget.horizontalDetails.physics, clipBehavior: this.widget.horizontalDetails.clipBehavior ?? this.widget.horizontalDetails.decorationClipBehavior ?? "hardEdge", incrementCalculator: this.widget.incrementCalculator, excludeFromSemantics: this.widget.excludeFromSemantics, restorationId: "InnerHorizontalTwoDimensionalScrollable", dragStartBehavior: this.widget.dragStartBehavior, diagonalDragBehavior: this.widget.diagonalDragBehavior, hitTestBehavior: this.widget.hitTestBehavior, viewportBuilder: (context: BuildContext, horizontalOffset: ViewportOffset): Widget => {
                            return this.widget.viewportBuilder(context, verticalOffset, horizontalOffset);
                        } });
                } }) });
        return new SourceTwoDimensionalScrollableScope({ twoDimensionalScrollable: this, child: result });
    }
    override dispose(): void {
        (this._dart_538df04f7c78ed0e_verticalFallbackController?.dispose() ?? null);
        (this._dart_538df04f7c78ed0e_horizontalFallbackController?.dispose() ?? null);
        super.dispose();
    }
}
export class SourceTwoDimensionalScrollableScope extends TwoAxisInheritedHost {
    readonly twoDimensionalScrollable: SourceTwoDimensionalScrollableState;
    constructor({ twoDimensionalScrollable, child }: {
        readonly twoDimensionalScrollable: SourceTwoDimensionalScrollableState;
        readonly child: Widget;
    }) {
        const _initialField0 = twoDimensionalScrollable;
        super({ child: child });
        this.twoDimensionalScrollable = _initialField0;
        protect(this, ["twoDimensionalScrollable"]);
    }
    override updateShouldNotify(old: SourceTwoDimensionalScrollableScope): boolean {
        if (!(old instanceof SourceTwoDimensionalScrollableScope))
            throw new TypeError("Invalid covariant argument: old");
        return false;
    }
}
export class SourceVerticalOuterDimension extends TwoAxisScrollableHost {
    readonly diagonalDragBehavior: DiagonalDragBehavior;
    readonly horizontalKey: GlobalKey<ScrollableState>;
    /**
     * @dartParam incrementCalculator double Function(ScrollIncrementDetails)?
     * @dartParamOrigin incrementCalculator inferred
     */
    constructor({ key = null, horizontalKey, viewportBuilder, axisDirection, controller = null, physics = null, clipBehavior = "hardEdge", incrementCalculator = null, excludeFromSemantics = false, dragStartBehavior = DragStartBehavior.start, restorationId = null, hitTestBehavior = HitTestBehavior.opaque, diagonalDragBehavior = DiagonalDragBehavior.none }: {
        readonly key?: Key | null;
        readonly horizontalKey: GlobalKey<ScrollableState>;
        readonly viewportBuilder: (argument0: BuildContext, argument1: ViewportOffset) => Widget;
        readonly axisDirection: AxisDirection;
        readonly controller?: ScrollController | null;
        readonly physics?: ScrollPhysics | null;
        readonly clipBehavior?: Clip;
        readonly incrementCalculator?: ((argument0: ScrollIncrementDetails) => number) | null;
        readonly excludeFromSemantics?: boolean;
        readonly dragStartBehavior?: DragStartBehavior;
        readonly restorationId?: string | null;
        readonly hitTestBehavior?: HitTestBehavior;
        readonly diagonalDragBehavior?: DiagonalDragBehavior;
    }) {
        const _initialField0 = horizontalKey;
        const _initialField1 = diagonalDragBehavior;
        if (FoundationBuildMode.debug)
            invariant(axisDirection === AxisDirection.up || axisDirection === AxisDirection.down, "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
        super({ key: key, viewportBuilder: viewportBuilder, axisDirection: axisDirection, controller: controller, physics: physics, clipBehavior: clipBehavior, incrementCalculator: incrementCalculator, excludeFromSemantics: excludeFromSemantics, dragStartBehavior: dragStartBehavior, restorationId: restorationId, hitTestBehavior: hitTestBehavior });
        this.diagonalDragBehavior = _initialField1;
        this.horizontalKey = _initialField0;
        protect(this, ["diagonalDragBehavior", "horizontalKey"]);
    }
    override createState(): SourceVerticalOuterDimensionState {
        return new SourceVerticalOuterDimensionState();
    }
}
export class SourceVerticalOuterDimensionState extends TwoAxisScrollableStateHost {
    lockedAxis: Axis | null;
    lastDragOffset: Offset | null;
    constructor() {
        super();
        this.lockedAxis = null;
        this.lastDragOffset = null;
    }
    get diagonalDragBehavior(): DiagonalDragBehavior {
        return (castSourceVerticalOuterDimension(this.widget)).diagonalDragBehavior;
    }
    get horizontalScrollable(): ScrollableState {
        return (() => {
            const _dartTemporary9 = sourceCurrentScrollable((castSourceVerticalOuterDimension(this.widget)).horizontalKey);
            if (_dartTemporary9 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary9!;
        })();
    }
    /**
     * @dartParam alignment double
     * @dartParamOrigin alignment explicit
     */
    override sourcePerformEnsureVisible(object: RenderObject, { alignment = 0, duration = 0, curve = Curves.ease, alignmentPolicy = ScrollPositionAlignmentPolicy.explicit, targetRenderObject = null }: {
        readonly alignment?: number;
        readonly duration?: number;
        readonly curve?: Curve;
        readonly alignmentPolicy?: ScrollPositionAlignmentPolicy;
        readonly targetRenderObject?: RenderObject | null;
    } = {}): DartRecord<[
        SourceMutableList<SourceFuture<void>>,
        ScrollableState
    ]> {
        if (FoundationBuildMode.debug)
            invariant(false, "source-two-dimensional-scrollable", "The _performEnsureVisible method was called for the vertical scrollable of a TwoDimensionalScrollable. This should not happen as the horizontal scrollable handles both axes.");
        return dartRecord([[], this] as const);
    }
    _dart_538df04f7c78ed0e_evaluateLockedAxis(offset: Offset): void {
        if (FoundationBuildMode.debug)
            invariant(this.lastDragOffset !== null, "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
        const offsetDelta: Offset = (() => {
            const _dartTemporary10 = this.lastDragOffset;
            if (_dartTemporary10 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary10!;
        })().subtract(offset);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const axisDifferential: number = Math.abs(offsetDelta.dx) - Math.abs(offsetDelta.dy);
        if (Math.abs(axisDifferential) >= 18) {
            this.lockedAxis = axisDifferential > 0 ? Axis.horizontal : Axis.vertical;
        }
        else {
            this.lockedAxis = null;
        }
    }
    override handleDragDown(details: DragDownDetails): void {
        switch (this.diagonalDragBehavior) {
            case DiagonalDragBehavior.none: {
                break;
                break;
            }
            case DiagonalDragBehavior.weightedEvent:
            case DiagonalDragBehavior.weightedContinuous:
            case DiagonalDragBehavior.free: {
                this.horizontalScrollable.handleDragDown(details);
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
        super.handleDragDown(details);
    }
    override handleDragStart(details: DragStartDetails): void {
        this.lastDragOffset = details.globalPosition;
        switch (this.diagonalDragBehavior) {
            case DiagonalDragBehavior.none: {
                break;
                break;
            }
            case DiagonalDragBehavior.free: {
                this.horizontalScrollable.handleDragStart(details);
                break;
            }
            case DiagonalDragBehavior.weightedEvent:
            case DiagonalDragBehavior.weightedContinuous: {
                this._dart_538df04f7c78ed0e_evaluateLockedAxis(details.globalPosition);
                switch (this.lockedAxis) {
                    case null: {
                        this.horizontalScrollable.handleDragStart(details);
                        break;
                    }
                    case Axis.horizontal: {
                        this.horizontalScrollable.handleDragStart(details);
                        return;
                        break;
                    }
                    case Axis.vertical: break;
                    default: throw new TypeError("Invalid value outside exhaustive Dart switch");
                }
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
        super.handleDragStart(details);
    }
    override handleDragUpdate(details: DragUpdateDetails): void {
        const verticalDragDetails: DragUpdateDetails = new DragUpdateDetails({ sourceTimeStamp: details.sourceTimeStamp, delta: new Offset(0, details.delta.dy), primaryDelta: details.delta.dy, globalPosition: details.globalPosition, localPosition: details.localPosition });
        const horizontalDragDetails: DragUpdateDetails = new DragUpdateDetails({ sourceTimeStamp: details.sourceTimeStamp, delta: new Offset(details.delta.dx, 0), primaryDelta: details.delta.dx, globalPosition: details.globalPosition, localPosition: details.localPosition });
        switch (this.diagonalDragBehavior) {
            case DiagonalDragBehavior.none: {
                super.handleDragUpdate(verticalDragDetails);
                return;
                break;
            }
            case DiagonalDragBehavior.free: {
                this.horizontalScrollable.handleDragUpdate(horizontalDragDetails);
                super.handleDragUpdate(verticalDragDetails);
                return;
                break;
            }
            case DiagonalDragBehavior.weightedContinuous: {
                this._dart_538df04f7c78ed0e_evaluateLockedAxis(details.globalPosition);
                this.lastDragOffset = details.globalPosition;
                break;
            }
            case DiagonalDragBehavior.weightedEvent: {
                if (this.lockedAxis === null && this.lastDragOffset !== null) {
                    this._dart_538df04f7c78ed0e_evaluateLockedAxis(details.globalPosition);
                }
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
        switch (this.lockedAxis) {
            case null: {
                this.horizontalScrollable.handleDragUpdate(horizontalDragDetails);
                break;
            }
            case Axis.horizontal: {
                this.horizontalScrollable.handleDragUpdate(horizontalDragDetails);
                return;
                break;
            }
            case Axis.vertical: break;
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
        super.handleDragUpdate(verticalDragDetails);
    }
    override handleDragEnd(details: DragEndDetails): void {
        this.lastDragOffset = null;
        this.lockedAxis = null;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const dx: number = details.velocity.pixelsPerSecond.dx;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const dy: number = details.velocity.pixelsPerSecond.dy;
        const verticalDragDetails: DragEndDetails = new DragEndDetails({ velocity: new Velocity({ pixelsPerSecond: new Offset(0, dy) }), primaryVelocity: dy });
        const horizontalDragDetails: DragEndDetails = new DragEndDetails({ velocity: new Velocity({ pixelsPerSecond: new Offset(dx, 0) }), primaryVelocity: dx });
        switch (this.diagonalDragBehavior) {
            case DiagonalDragBehavior.none: {
                break;
                break;
            }
            case DiagonalDragBehavior.weightedEvent:
            case DiagonalDragBehavior.weightedContinuous:
            case DiagonalDragBehavior.free: {
                this.horizontalScrollable.handleDragEnd(horizontalDragDetails);
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
        super.handleDragEnd(verticalDragDetails);
    }
    override handleDragCancel(): void {
        this.lastDragOffset = null;
        this.lockedAxis = null;
        switch (this.diagonalDragBehavior) {
            case DiagonalDragBehavior.none: {
                break;
                break;
            }
            case DiagonalDragBehavior.weightedEvent:
            case DiagonalDragBehavior.weightedContinuous:
            case DiagonalDragBehavior.free: {
                this.horizontalScrollable.handleDragCancel();
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
        super.handleDragCancel();
    }
    override setCanDrag(value: boolean): void {
        switch (this.diagonalDragBehavior) {
            case DiagonalDragBehavior.none: {
                super.setCanDrag(value);
                return;
                break;
            }
            case DiagonalDragBehavior.weightedEvent:
            case DiagonalDragBehavior.weightedContinuous:
            case DiagonalDragBehavior.free: {
                if (value) {
                    this.sourceGestureRecognizers = (() => {
                        const _dartTemporary12 = PanGestureRecognizer;
                        const _dartTemporary13 = createSourcePanFactory((): PanGestureRecognizer => {
                            return createSourcePan(this, { supportedDevices: this.sourceConfiguration.dragDevices });
                        }, (instance: PanGestureRecognizer): void => {
                            (() => {
                                const _dartTemporary14 = instance;
                                _dartTemporary14.onDown = dartMethodTearOff(this, this.handleDragDown);
                                _dartTemporary14.onStart = dartMethodTearOff(this, this.handleDragStart);
                                _dartTemporary14.onUpdate = dartMethodTearOff(this, this.handleDragUpdate);
                                _dartTemporary14.onEnd = dartMethodTearOff(this, this.handleDragEnd);
                                _dartTemporary14.onCancel = dartMethodTearOff(this, this.handleDragCancel);
                                _dartTemporary14.minFlingDistance = (() => {
                                    const _dartTemporary15 = this.sourcePhysics;
                                    return _dartTemporary15 === null ? null : _dartTemporary15.minFlingDistance;
                                })();
                                _dartTemporary14.minFlingVelocity = (() => {
                                    const _dartTemporary16 = this.sourcePhysics;
                                    return _dartTemporary16 === null ? null : _dartTemporary16.minFlingVelocity;
                                })();
                                _dartTemporary14.maxFlingVelocity = (() => {
                                    const _dartTemporary17 = this.sourcePhysics;
                                    return _dartTemporary17 === null ? null : _dartTemporary17.maxFlingVelocity;
                                })();
                                _dartTemporary14.velocityTrackerBuilder = this.sourceConfiguration.velocityTrackerBuilder(this.context);
                                _dartTemporary14.dragStartBehavior = this.widget.dragStartBehavior;
                                _dartTemporary14.gestureSettings = this.sourceGestureSettings;
                                return _dartTemporary14;
                            })();
                        });
                        const _dartTemporary11 = createSourceGestureFactories();
                        _dartTemporary11.set(_dartTemporary12, _dartTemporary13);
                        return _dartTemporary11;
                    })();
                    this.handleDragCancel();
                    this.sourceLastCanDrag = value;
                    this.sourceLastAxis = this.widget.axis;
                    if (sourceCurrentScrollable(this.sourceGestureKey) !== null) {
                        replaceSourceGestureRecognizers((() => {
                            const _dartTemporary18 = sourceCurrentScrollable(this.sourceGestureKey);
                            if (_dartTemporary18 === null)
                                throw new TypeError("Null check operator used on a null value");
                            return _dartTemporary18!;
                        })(), this.sourceGestureRecognizers);
                    }
                }
                return;
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
    }
    override buildChrome(context: BuildContext, child: Widget): Widget {
        const details: SourceScrollableDetails = new SourceScrollableDetails({ direction: this.widget.axisDirection, controller: this.sourceEffectiveController, clipBehavior: this.widget.clipBehavior });
        return this.sourceConfiguration.buildOverscrollIndicator(context, child, details);
    }
}
export class SourceHorizontalInnerDimension extends TwoAxisScrollableHost {
    readonly verticalOuterKey: GlobalKey<ScrollableState>;
    readonly diagonalDragBehavior: DiagonalDragBehavior;
    /**
     * @dartParam incrementCalculator double Function(ScrollIncrementDetails)?
     * @dartParamOrigin incrementCalculator inferred
     */
    constructor({ key = null, verticalOuterKey, viewportBuilder, axisDirection, controller = null, physics = null, clipBehavior = "hardEdge", incrementCalculator = null, excludeFromSemantics = false, dragStartBehavior = DragStartBehavior.start, restorationId = null, hitTestBehavior = HitTestBehavior.opaque, diagonalDragBehavior = DiagonalDragBehavior.none }: {
        readonly key?: Key | null;
        readonly verticalOuterKey: GlobalKey<ScrollableState>;
        readonly viewportBuilder: (argument0: BuildContext, argument1: ViewportOffset) => Widget;
        readonly axisDirection: AxisDirection;
        readonly controller?: ScrollController | null;
        readonly physics?: ScrollPhysics | null;
        readonly clipBehavior?: Clip;
        readonly incrementCalculator?: ((argument0: ScrollIncrementDetails) => number) | null;
        readonly excludeFromSemantics?: boolean;
        readonly dragStartBehavior?: DragStartBehavior;
        readonly restorationId?: string | null;
        readonly hitTestBehavior?: HitTestBehavior;
        readonly diagonalDragBehavior?: DiagonalDragBehavior;
    }) {
        const _initialField0 = verticalOuterKey;
        const _initialField1 = diagonalDragBehavior;
        if (FoundationBuildMode.debug)
            invariant(axisDirection === AxisDirection.left || axisDirection === AxisDirection.right, "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
        super({ key: key, viewportBuilder: viewportBuilder, axisDirection: axisDirection, controller: controller, physics: physics, clipBehavior: clipBehavior, incrementCalculator: incrementCalculator, excludeFromSemantics: excludeFromSemantics, dragStartBehavior: dragStartBehavior, restorationId: restorationId, hitTestBehavior: hitTestBehavior });
        this.verticalOuterKey = _initialField0;
        this.diagonalDragBehavior = _initialField1;
        protect(this, ["verticalOuterKey", "diagonalDragBehavior"]);
    }
    override createState(): SourceHorizontalInnerDimensionState {
        return new SourceHorizontalInnerDimensionState();
    }
}
export class SourceHorizontalInnerDimensionState extends TwoAxisScrollableStateHost {
    get verticalScrollable(): ScrollableState {
        return dartLateRead<ScrollableState>(this, "package:flutter/src/widgets/scrollable.dart::_HorizontalInnerDimensionState.verticalScrollable:FIELD", "verticalScrollable");
    }
    set verticalScrollable(value: ScrollableState) {
        dartLateWrite<ScrollableState>(this, "package:flutter/src/widgets/scrollable.dart::_HorizontalInnerDimensionState.verticalScrollable:FIELD", "verticalScrollable", value, false);
    }
    constructor() {
        super();
    }
    get verticalOuterKey(): GlobalKey<ScrollableState> {
        return (castSourceHorizontalInnerDimension(this.widget)).verticalOuterKey;
    }
    get diagonalDragBehavior(): DiagonalDragBehavior {
        return (castSourceHorizontalInnerDimension(this.widget)).diagonalDragBehavior;
    }
    override didChangeDependencies(): void {
        this.verticalScrollable = Scrollable.of(this.context);
        if (FoundationBuildMode.debug)
            invariant(axisDirectionToAxis(this.verticalScrollable.axisDirection) === Axis.vertical, "source-two-dimensional-scrollable", "Pinned two-axis Scrollable assertion failed");
        super.didChangeDependencies();
    }
    /**
     * @dartParam alignment double
     * @dartParamOrigin alignment explicit
     */
    override sourcePerformEnsureVisible(object: RenderObject, { alignment = 0, duration = 0, curve = Curves.ease, alignmentPolicy = ScrollPositionAlignmentPolicy.explicit, targetRenderObject = null }: {
        readonly alignment?: number;
        readonly duration?: number;
        readonly curve?: Curve;
        readonly alignmentPolicy?: ScrollPositionAlignmentPolicy;
        readonly targetRenderObject?: RenderObject | null;
    } = {}): DartRecord<[
        SourceMutableList<SourceFuture<void>>,
        ScrollableState
    ]> {
        const newFutures: SourceMutableList<SourceFuture<void>> = [twoAxisEnsureVisible(this.sourcePosition, object, { alignment: alignment, duration: duration, curve: curve, alignmentPolicy: alignmentPolicy }), twoAxisEnsureVisible(twoAxisSourcePosition(this.verticalScrollable), object, { alignment: alignment, duration: duration, curve: curve, alignmentPolicy: alignmentPolicy })];
        return dartRecord([newFutures, this.verticalScrollable] as const);
    }
    override setCanDrag(value: boolean): void {
        switch (this.diagonalDragBehavior) {
            case DiagonalDragBehavior.none: {
                super.setCanDrag(value);
                return;
                break;
            }
            case DiagonalDragBehavior.weightedEvent:
            case DiagonalDragBehavior.weightedContinuous:
            case DiagonalDragBehavior.free: {
                if (value) {
                    this.sourceGestureRecognizers = emptySourceGestureFactories();
                    (() => {
                        const _dartTemporary19 = sourceCurrentScrollable(this.verticalOuterKey);
                        if (_dartTemporary19 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary19!;
                    })().setCanDrag(value);
                    this.handleDragCancel();
                    this.sourceLastCanDrag = value;
                    this.sourceLastAxis = this.widget.axis;
                    if (sourceCurrentScrollable(this.sourceGestureKey) !== null) {
                        replaceSourceGestureRecognizers((() => {
                            const _dartTemporary20 = sourceCurrentScrollable(this.sourceGestureKey);
                            if (_dartTemporary20 === null)
                                throw new TypeError("Null check operator used on a null value");
                            return _dartTemporary20!;
                        })(), this.sourceGestureRecognizers);
                    }
                }
                return;
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
    }
    override buildChrome(context: BuildContext, child: Widget): Widget {
        const details: SourceScrollableDetails = new SourceScrollableDetails({ direction: this.widget.axisDirection, controller: this.sourceEffectiveController, clipBehavior: this.widget.clipBehavior });
        return this.sourceConfiguration.buildOverscrollIndicator(context, child, details);
    }
}
