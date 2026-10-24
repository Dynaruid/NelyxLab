// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/scrollbar.dart; SHA256 7ec271ad0cacb5f770c3b7e928acd92d5cba139a125be64c254359d30174ee04
import { protect } from "@nelyx/core/internal/ui/value-math";
import { invariant } from "@nelyx/core/foundation/errors";
import { FoundationBuildMode } from "@nelyx/core/foundation/constants";
import { dartLateRead } from "@nelyx/core/internal/foundation/dart-late";
import { dartLateWrite } from "@nelyx/core/internal/foundation/dart-late";
import { Color } from "@nelyx/core/ui/color";
import { Radius } from "@nelyx/core/ui/radius";
import { Offset } from "@nelyx/core/ui/offset";
import { Widget } from "@nelyx/core/framework/widgets/framework";
import { Key } from "@nelyx/core/foundation/key";
import { AnimationController } from "@nelyx/core/framework/animation/animation-controller";
import { Axis } from "@nelyx/core/framework/painting/basic-types";
import { castSourceDartDouble } from "@nelyx/core/internal/foundation/dart-numeric";
import { ScrollController } from "@nelyx/core/framework/widgets/scroll-controller";
import { ScrollNotification } from "@nelyx/core/framework/widgets/scroll-notification";
import { Velocity } from "@nelyx/core/framework/gestures/velocity-tracker";
import { TapDownDetails } from "@nelyx/core/framework/gestures/tap";
import { Directionality } from "@nelyx/core/framework/widgets/app-data";
import { ScrollConfiguration } from "@nelyx/core/framework/widgets/scroll-configuration";
import { defaultScrollNotificationPredicate } from "@nelyx/core/framework/widgets/scroll-notification";
import { scrollbarMediaPadding } from "@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter";
import { applyDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { captureDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { scrollbarRawObjectEquals } from "@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter";
import { constSourceRadiusCircular } from "@nelyx/core/internal/ui/radius-source-adapter";
import { constSourceColor } from "@nelyx/core/internal/ui/color-source-adapter";
import { SourceScrollbarOrientation } from "@nelyx/core/internal/framework/widgets/scrollbar.generated";
import { SourceRawScrollbar } from "@nelyx/core/internal/framework/widgets/scrollbar.generated";
import { SourceRawScrollbarState } from "@nelyx/core/internal/framework/widgets/scrollbar.generated";
import { boxSourceDartDouble } from "@nelyx/core/internal/foundation/dart-numeric";
import { dartRecord } from "@nelyx/core/internal/foundation/dart-record";
import { dartRecordRead } from "@nelyx/core/internal/foundation/dart-record";
import { CupertinoDynamicColor } from "../colors/dynamic-color.generated.ts";
import { constCupertinoDynamicColorWithBrightness } from "../colors/dynamic-color.generated.ts";
import { scrollbarRawWidgetType } from "@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter";
import { scrollbarRawStateType } from "@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter";
import { scrollbarMediumImpact } from "@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter";
import { scrollbarDoubleAbs } from "@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter";
import type { ScrollbarFuture } from "@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter";
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kScrollbarMinLength: number = 36;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kScrollbarMinOverscrollLength: number = 8;
export const _kScrollbarTimeToFade: number = 0 + 1200 * 1;
export const _kScrollbarFadeDuration: number = 0 + 250 * 1;
export const _kScrollbarResizeDuration: number = 0 + 100 * 1;
export const _kScrollbarColor: Color = constCupertinoDynamicColorWithBrightness({ color: constSourceColor(Color, 1493172224), darkColor: constSourceColor(Color, 2164260863) });
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kScrollbarMainAxisMargin: number = 3;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kScrollbarCrossAxisMargin: number = 3;
export class SourceCupertinoScrollbar extends SourceRawScrollbar {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly thicknessWhileDragging: number;
    readonly radiusWhileDragging: Radius;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly defaultThickness: number = 3;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly defaultThicknessWhileDragging: number = 8;
    static readonly defaultRadius: Radius = constSourceRadiusCircular(Radius, 1.5);
    static readonly defaultRadiusWhileDragging: Radius = constSourceRadiusCircular(Radius, 4);
    /**
     * @dartParam thickness double
     * @dartParamOrigin thickness explicit
     * @dartParam thicknessWhileDragging double
     * @dartParamOrigin thicknessWhileDragging inferred
     * @dartParam mainAxisMargin double
     * @dartParamOrigin mainAxisMargin inferred
     */
    constructor({ key = null, child, controller = null, thumbVisibility = null, thickness = SourceCupertinoScrollbar.defaultThickness, thicknessWhileDragging = SourceCupertinoScrollbar.defaultThicknessWhileDragging, radius = SourceCupertinoScrollbar.defaultRadius, radiusWhileDragging = SourceCupertinoScrollbar.defaultRadiusWhileDragging, notificationPredicate = null, scrollbarOrientation = null, mainAxisMargin = _kScrollbarMainAxisMargin }: {
        readonly key?: Key | null;
        readonly child: Widget;
        readonly controller?: ScrollController | null;
        readonly thumbVisibility?: boolean | null;
        readonly thickness?: number;
        readonly thicknessWhileDragging?: number;
        readonly radius?: Radius;
        readonly radiusWhileDragging?: Radius;
        readonly notificationPredicate?: ((argument0: ScrollNotification) => boolean) | null;
        readonly scrollbarOrientation?: SourceScrollbarOrientation | null;
        readonly mainAxisMargin?: number;
    }) {
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField0 = thicknessWhileDragging;
        const _initialField1 = radiusWhileDragging;
        if (FoundationBuildMode.debug)
            invariant(thickness < Infinity, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(thicknessWhileDragging < Infinity, "generated-source-assert", "Pinned Dart assertion failed");
        super({ thumbVisibility: thumbVisibility ?? false, fadeDuration: _kScrollbarFadeDuration, timeToFade: _kScrollbarTimeToFade, pressDuration: 0 + 100 * 1, notificationPredicate: (() => {
                const _dartTemporary0 = notificationPredicate;
                return _dartTemporary0 === null ? defaultScrollNotificationPredicate : _dartTemporary0;
            })(), key: key, child: child, controller: controller, thickness: thickness, radius: radius, scrollbarOrientation: scrollbarOrientation, mainAxisMargin: mainAxisMargin });
        captureDartType(this, applyDartType<SourceCupertinoScrollbar>(SourceCupertinoScrollbar, "CupertinoScrollbar", [], [scrollbarRawWidgetType]));
        this.thicknessWhileDragging = _initialField0;
        this.radiusWhileDragging = _initialField1;
        protect(this, ["thicknessWhileDragging", "radiusWhileDragging"]);
    }
    override createState(): SourceRawScrollbarState<SourceCupertinoScrollbar> {
        return new SourceCupertinoScrollbarState();
    }
}
protect(SourceCupertinoScrollbar, ["defaultThickness", "defaultThicknessWhileDragging", "defaultRadius", "defaultRadiusWhileDragging"]);
export class SourceCupertinoScrollbarState extends SourceRawScrollbarState<SourceCupertinoScrollbar> {
    get _dart_d0f4a5da96bfd81e_thicknessAnimationController(): AnimationController {
        return dartLateRead<AnimationController>(this, "package:flutter/src/cupertino/scrollbar.dart::_CupertinoScrollbarState._thicknessAnimationController:FIELD", "_thicknessAnimationController");
    }
    set _dart_d0f4a5da96bfd81e_thicknessAnimationController(value: AnimationController) {
        dartLateWrite<AnimationController>(this, "package:flutter/src/cupertino/scrollbar.dart::_CupertinoScrollbarState._thicknessAnimationController:FIELD", "_thicknessAnimationController", value, false);
    }
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    _dart_d0f4a5da96bfd81e_pressStartAxisPosition: number;
    constructor() {
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField0 = 0;
        super(applyDartType<SourceCupertinoScrollbar>(SourceCupertinoScrollbar, "CupertinoScrollbar", [], [scrollbarRawWidgetType]));
        captureDartType(this, applyDartType<SourceCupertinoScrollbarState>(SourceCupertinoScrollbarState, "_CupertinoScrollbarState", [], [scrollbarRawStateType<SourceCupertinoScrollbar>(applyDartType<SourceCupertinoScrollbar>(SourceCupertinoScrollbar, "CupertinoScrollbar", [], [scrollbarRawWidgetType]))]));
        this._dart_d0f4a5da96bfd81e_pressStartAxisPosition = _initialField0;
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get _dart_d0f4a5da96bfd81e_thickness(): number {
        return (() => {
            const _dartTemporary1 = this.widget.thickness;
            if (_dartTemporary1 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary1!;
        })() + this._dart_d0f4a5da96bfd81e_thicknessAnimationController.value * (this.widget.thicknessWhileDragging - (() => {
            const _dartTemporary2 = this.widget.thickness;
            if (_dartTemporary2 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary2!;
        })());
    }
    get _dart_d0f4a5da96bfd81e_radius(): Radius {
        return (() => {
            const _dartTemporary3 = Radius.lerp(this.widget.radius, this.widget.radiusWhileDragging, this._dart_d0f4a5da96bfd81e_thicknessAnimationController.value);
            if (_dartTemporary3 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary3!;
        })();
    }
    override initState(): void {
        super.initState();
        this._dart_d0f4a5da96bfd81e_thicknessAnimationController = new AnimationController({ vsync: this, duration: _kScrollbarResizeDuration });
        this._dart_d0f4a5da96bfd81e_thicknessAnimationController.addListener((): void => {
            this.updateScrollbarPainter();
        });
    }
    override updateScrollbarPainter(): void {
        (() => {
            const _dartTemporary4 = this.scrollbarPainter;
            _dartTemporary4.color = CupertinoDynamicColor.resolve(_kScrollbarColor, this.context);
            _dartTemporary4.textDirection = Directionality.of(this.context);
            _dartTemporary4.thickness = this._dart_d0f4a5da96bfd81e_thickness;
            _dartTemporary4.mainAxisMargin = this.widget.mainAxisMargin;
            _dartTemporary4.crossAxisMargin = _kScrollbarCrossAxisMargin;
            _dartTemporary4.radius = this._dart_d0f4a5da96bfd81e_radius;
            _dartTemporary4.padding = scrollbarMediaPadding(this.context);
            _dartTemporary4.minLength = _kScrollbarMinLength;
            _dartTemporary4.minOverscrollLength = _kScrollbarMinOverscrollLength;
            _dartTemporary4.scrollbarOrientation = this.widget.scrollbarOrientation;
            return _dartTemporary4;
        })();
    }
    override handleThumbPressStart(localPosition: Offset): void {
        super.handleThumbPressStart(localPosition);
        const direction: Axis | null = this.getScrollbarDirection();
        if (direction === null) {
            return;
        }
        this._dart_d0f4a5da96bfd81e_pressStartAxisPosition = (() => {
            const _dartTemporary5 = direction as Axis;
            switch (_dartTemporary5) {
                case Axis.vertical: return localPosition.dy;
                case Axis.horizontal: return localPosition.dx;
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
    }
    override handleThumbPress(): void {
        if (this.getScrollbarDirection() === null) {
            return;
        }
        super.handleThumbPress();
        this._dart_d0f4a5da96bfd81e_thicknessAnimationController.forward().then((_: void): ScrollbarFuture<void> => {
            return scrollbarMediumImpact(this);
        });
    }
    override handleThumbPressEnd(localPosition: Offset, velocity: Velocity): void {
        const direction: Axis | null = this.getScrollbarDirection();
        if (direction === null) {
            return;
        }
        this._dart_d0f4a5da96bfd81e_thicknessAnimationController.reverse();
        super.handleThumbPressEnd(localPosition, velocity);
        const _dartTemporary6 = (() => {
            const _dartTemporary7 = direction as Axis;
            switch (_dartTemporary7) {
                case Axis.horizontal: return dartRecord([boxSourceDartDouble(localPosition.dx), boxSourceDartDouble(velocity.pixelsPerSecond.dx)] as const);
                case Axis.vertical: return dartRecord([boxSourceDartDouble(localPosition.dy), boxSourceDartDouble(velocity.pixelsPerSecond.dy)] as const);
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const axisPosition: number = castSourceDartDouble(dartRecordRead(_dartTemporary6, 0, 2));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const axisVelocity: number = castSourceDartDouble(dartRecordRead(_dartTemporary6, 1, 2));
        if (axisPosition !== this._dart_d0f4a5da96bfd81e_pressStartAxisPosition && scrollbarDoubleAbs(axisVelocity) < 10) {
            scrollbarMediumImpact(this);
        }
    }
    override handleTrackTapDown(details: TapDownDetails): void {
        if (!scrollbarRawObjectEquals(ScrollConfiguration.of(this.context).getPlatform(this.context), "iOS")) {
            super.handleTrackTapDown(details);
        }
    }
    override dispose(): void {
        this._dart_d0f4a5da96bfd81e_thicknessAnimationController.dispose();
        super.dispose();
    }
}
