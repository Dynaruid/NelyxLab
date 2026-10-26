// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/two_dimensional_scroll_view.dart; SHA256 518f7e9ce9cd58b2a364e6998184b2cf938d069cab753940caac101197c06d64
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
import { dependOnSourceTwoAxis } from "./two-dimensional-scrollable.generated.ts";
import { isSourceVerticalOuterDimension } from "./two-dimensional-scrollable.generated.ts";
import { castSourceVerticalOuterDimension } from "./two-dimensional-scrollable.generated.ts";
import { isSourceHorizontalInnerDimension } from "./two-dimensional-scrollable.generated.ts";
import { castSourceHorizontalInnerDimension } from "./two-dimensional-scrollable.generated.ts";
import { StatelessWidget } from "./framework.ts";
import { TwoAxisStatelessHost } from "./two-dimensional-scroll-view-adapter.ts";
import { createTwoAxisUpdateListener } from "./two-dimensional-scroll-view-adapter.ts";
import { currentTwoAxisFocusManager } from "./two-dimensional-scroll-view-adapter.ts";
import { SourceTwoDimensionalScrollable } from "./two-dimensional-scrollable.generated.ts";
import { SourceTwoDimensionalChildDelegate } from "./two-dimensional-delegate.generated.ts";
import { constantVerticalDetails } from "./scrollable-details-constants.ts";
import { constantHorizontalDetails } from "./scrollable-details-constants.ts";
import { ScrollCacheExtent } from "../rendering/viewport.ts";
import { CacheExtentStyle } from "../rendering/viewport.ts";
import { PrimaryScrollController } from "./primary-scroll-controller.ts";
import { ScrollViewKeyboardDismissBehavior } from "./scroll-view.ts";
import { ScrollConfiguration } from "./scroll-configuration.ts";
import { NotificationListener } from "./notification-listener.ts";
import { ScrollUpdateNotification } from "./scroll-notification.ts";
import { FocusScope } from "./focus-scope.ts";
import { FocusManager } from "./focus.ts";
import { FocusScopeNode } from "./focus.ts";
import { DiagnosticPropertiesBuilder } from "../../foundation/diagnostics.ts";
import { DiagnosticsProperty } from "../../foundation/diagnostics.ts";
import { EnumProperty } from "../../foundation/diagnostic-properties.ts";
import { FlagProperty } from "../../foundation/diagnostic-properties.ts";
import { createTwoAxisFlag } from "./two-dimensional-scroll-view-adapter.ts";
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
export abstract class SourceTwoDimensionalScrollView extends TwoAxisStatelessHost {
    readonly delegate: SourceTwoDimensionalChildDelegate;
    /**
     * @dartType double?
     * @dartTypeOrigin explicit
     */
    readonly cacheExtent: number | null;
    readonly cacheExtentStyle: CacheExtentStyle | null;
    readonly scrollCacheExtent: ScrollCacheExtent | null;
    readonly diagonalDragBehavior: DiagonalDragBehavior;
    readonly primary: boolean | null;
    readonly mainAxis: Axis;
    readonly verticalDetails: SourceScrollableDetails;
    readonly horizontalDetails: SourceScrollableDetails;
    readonly dragStartBehavior: DragStartBehavior;
    readonly keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior | null;
    readonly hitTestBehavior: HitTestBehavior;
    readonly clipBehavior: Clip;
    /**
     * @dartParam cacheExtent double?
     * @dartParamOrigin cacheExtent inferred
     */
    constructor({ key = null, primary = null, mainAxis = Axis.vertical, verticalDetails = constantVerticalDetails(SourceScrollableDetails, {}), horizontalDetails = constantHorizontalDetails(SourceScrollableDetails, {}), delegate, cacheExtent = null, cacheExtentStyle = null, scrollCacheExtent = null, diagonalDragBehavior = DiagonalDragBehavior.none, dragStartBehavior = DragStartBehavior.start, keyboardDismissBehavior = null, clipBehavior = "hardEdge", hitTestBehavior = HitTestBehavior.opaque }: {
        readonly key?: Key | null;
        readonly primary?: boolean | null;
        readonly mainAxis?: Axis;
        readonly verticalDetails?: SourceScrollableDetails;
        readonly horizontalDetails?: SourceScrollableDetails;
        readonly delegate: SourceTwoDimensionalChildDelegate;
        readonly cacheExtent?: number | null;
        readonly cacheExtentStyle?: CacheExtentStyle | null;
        readonly scrollCacheExtent?: ScrollCacheExtent | null;
        readonly diagonalDragBehavior?: DiagonalDragBehavior;
        readonly dragStartBehavior?: DragStartBehavior;
        readonly keyboardDismissBehavior?: ScrollViewKeyboardDismissBehavior | null;
        readonly clipBehavior?: Clip;
        readonly hitTestBehavior?: HitTestBehavior;
    }) {
        const _initialField0 = primary;
        const _initialField1 = mainAxis;
        const _initialField2 = verticalDetails;
        const _initialField3 = horizontalDetails;
        const _initialField4 = delegate;
        /**
         * @dartType double?
         * @dartTypeOrigin inferred
         */
        const _initialField5 = cacheExtent;
        const _initialField6 = cacheExtentStyle;
        const _initialField7 = scrollCacheExtent;
        const _initialField8 = diagonalDragBehavior;
        const _initialField9 = dragStartBehavior;
        const _initialField10 = keyboardDismissBehavior;
        const _initialField11 = clipBehavior;
        const _initialField12 = hitTestBehavior;
        super({ key: key });
        this.delegate = _initialField4;
        this.cacheExtent = _initialField5;
        this.cacheExtentStyle = _initialField6;
        this.scrollCacheExtent = _initialField7;
        this.diagonalDragBehavior = _initialField8;
        this.primary = _initialField0;
        this.mainAxis = _initialField1;
        this.verticalDetails = _initialField2;
        this.horizontalDetails = _initialField3;
        this.dragStartBehavior = _initialField9;
        this.keyboardDismissBehavior = _initialField10;
        this.hitTestBehavior = _initialField12;
        this.clipBehavior = _initialField11;
        protect(this, ["delegate", "cacheExtent", "cacheExtentStyle", "scrollCacheExtent", "diagonalDragBehavior", "primary", "mainAxis", "verticalDetails", "horizontalDetails", "dragStartBehavior", "keyboardDismissBehavior", "hitTestBehavior", "clipBehavior"]);
    }
    abstract buildViewport(context: BuildContext, verticalOffset: ViewportOffset, horizontalOffset: ViewportOffset): Widget;
    override sourceBuild(context: BuildContext): Widget {
        if (FoundationBuildMode.debug)
            invariant(axisDirectionToAxis(this.verticalDetails.direction) === Axis.vertical, "source-two-dimensional-scrollable", "TwoDimensionalScrollView.verticalDetails are not Axis.vertical.");
        if (FoundationBuildMode.debug)
            invariant(axisDirectionToAxis(this.horizontalDetails.direction) === Axis.horizontal, "source-two-dimensional-scrollable", "TwoDimensionalScrollView.horizontalDetails are not Axis.horizontal.");
        let mainAxisDetails: SourceScrollableDetails = (() => {
            const _dartTemporary0 = this.mainAxis;
            switch (_dartTemporary0) {
                case Axis.vertical: return this.verticalDetails;
                case Axis.horizontal: return this.horizontalDetails;
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        const effectivePrimary: boolean = this.primary ?? (mainAxisDetails.controller === null && PrimaryScrollController.shouldInherit(context, this.mainAxis));
        if (effectivePrimary) {
            if (FoundationBuildMode.debug)
                invariant(mainAxisDetails.controller === null, "source-two-dimensional-scrollable", "TwoDimensionalScrollView.primary was explicitly set to true, but a ScrollController was provided in the ScrollableDetails of the TwoDimensionalScrollView.mainAxis.");
            mainAxisDetails = mainAxisDetails.copyWith({ controller: PrimaryScrollController.of(context) });
        }
        const scrollable: SourceTwoDimensionalScrollable = new SourceTwoDimensionalScrollable({ horizontalDetails: (() => {
                const _dartTemporary1 = this.mainAxis;
                switch (_dartTemporary1) {
                    case Axis.horizontal: return mainAxisDetails;
                    case Axis.vertical: return this.horizontalDetails;
                    default: throw new TypeError("Non-exhaustive Dart switch expression");
                }
            })(), verticalDetails: (() => {
                const _dartTemporary2 = this.mainAxis;
                switch (_dartTemporary2) {
                    case Axis.vertical: return mainAxisDetails;
                    case Axis.horizontal: return this.verticalDetails;
                    default: throw new TypeError("Non-exhaustive Dart switch expression");
                }
            })(), diagonalDragBehavior: this.diagonalDragBehavior, viewportBuilder: dartMethodTearOff(this, this.buildViewport), dragStartBehavior: this.dragStartBehavior, hitTestBehavior: this.hitTestBehavior });
        const scrollableResult: Widget = effectivePrimary ? PrimaryScrollController.none({ child: scrollable }) : scrollable;
        const effectiveKeyboardDismissBehavior: ScrollViewKeyboardDismissBehavior = this.keyboardDismissBehavior ?? ScrollConfiguration.of(context).getKeyboardDismissBehavior(context);
        if (effectiveKeyboardDismissBehavior === ScrollViewKeyboardDismissBehavior.onDrag) {
            return createTwoAxisUpdateListener({ child: scrollableResult, onNotification: (notification: ScrollUpdateNotification): boolean => {
                    const currentScope: FocusScopeNode = FocusScope.of(context);
                    if (notification.dragDetails !== null && !currentScope.hasPrimaryFocus && currentScope.hasFocus) {
                        (currentTwoAxisFocusManager(FocusManager).primaryFocus?.unfocus() ?? null);
                    }
                    return false;
                } });
        }
        return scrollableResult;
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        properties.add(new EnumProperty("mainAxis", this.mainAxis));
        properties.add(new EnumProperty("diagonalDragBehavior", this.diagonalDragBehavior));
        properties.add(createTwoAxisFlag("primary", { value: this.primary, ifTrue: "using primary controller", showName: true }));
        properties.add(new DiagnosticsProperty("verticalDetails", this.verticalDetails, { showName: false }));
        properties.add(new DiagnosticsProperty("horizontalDetails", this.horizontalDetails, { showName: false }));
    }
}
