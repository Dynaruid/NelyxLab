// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/overscroll_indicator.dart; SHA256 2d6645b053e3e9c4306331a4f0739663fd378826bd3cc72090c05a6c725d5f28
import { protect } from "../../ui/value-math.ts";
import { invariant } from "../../foundation/errors.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { dartMethodTearOff } from "../../foundation/dart-method-tear-off.ts";
import { dartLateInitialize } from "../../foundation/dart-late.ts";
import { dartStaticRead } from "../../foundation/dart-static-field.ts";
import { dartStaticSeal } from "../../foundation/dart-static-field.ts";
import { AxisDirection } from "../painting/basic-types.ts";
import { clampDouble } from "../../ui/math.ts";
import { State } from "./framework.ts";
import { Widget } from "./framework.ts";
import { Key } from "../../foundation/key.ts";
import { AnimationController } from "../animation/animation-controller.ts";
import { Axis } from "../painting/basic-types.ts";
import { ScrollNotification } from "./scroll-notification.ts";
import { OverscrollNotification } from "./scroll-notification.ts";
import { ScrollEndNotification } from "./scroll-notification.ts";
import { ScrollbarStatefulHost } from "./scrollbar-raw-source-adapter.ts";
import { ScrollbarStateHost } from "./scrollbar-raw-source-adapter.ts";
import { defaultScrollNotificationPredicate } from "./scroll-notification.ts";
import { axisDirectionToAxis } from "../painting/basic-types.ts";
import { scrollbarNotificationListener } from "./scrollbar-raw-source-adapter.ts";
import { applyDartType } from "../../foundation/dart-type-witness.ts";
import { captureDartType } from "../../foundation/dart-type-witness.ts";
import { scrollbarStatefulType } from "./scrollbar-raw-source-adapter.ts";
import { scrollbarStateType } from "./scrollbar-raw-source-adapter.ts";
import { scrollbarTickerStateType } from "./scrollbar-raw-source-adapter.ts";
import { scrollbarRawObjectEquals } from "./scrollbar-raw-source-adapter.ts";
import { StretchEffect } from "./stretch-effect.generated.ts";
import { Listenable } from "../../foundation/notifier.ts";
import { ValueNotifier } from "../../foundation/notifier.ts";
import { OverscrollIndicatorNotification } from "./overscroll-indicator.ts";
import { SizedBox } from "./basic.ts";
import { SpringDescription } from "../physics/spring-simulation.ts";
import { SpringSimulation } from "../physics/spring-simulation.ts";
import { stretchMediaWidth } from "./stretch-source-adapter.ts";
import { stretchMediaHeight } from "./stretch-source-adapter.ts";
import { stretchClip } from "./stretch-source-adapter.ts";
import { stretchConstShrink } from "./stretch-source-adapter.ts";
import { stretchWhenComplete } from "./stretch-source-adapter.ts";
import { sourceEnumProperty } from "../../foundation/dart-diagnostics.ts";
import { stretchAxisDirectionType } from "./stretch-source-adapter.ts";
import { AnimatedBuilder } from "./transitions.ts";
import { stretchListenableType } from "./stretch-source-adapter.ts";
import { stretchNotificationRuntimeType } from "./stretch-source-adapter.ts";
import { stretchIsStart } from "./stretch-source-adapter.ts";
import { stretchIsUpdate } from "./stretch-source-adapter.ts";
import { stretchIsEnd } from "./stretch-source-adapter.ts";
import { stretchIsOverscroll } from "./stretch-source-adapter.ts";
import { ClipRect } from "./clip.ts";
import type { BuildContext } from "./framework.ts";
import type { TickerProvider } from "../animation/ticker.ts";
import type { Simulation } from "../physics/simulation.ts";
import type { Clip } from "../../ui/clip.ts";
import type { DiagnosticPropertiesBuilder } from "../../foundation/diagnostics.ts";
export class StretchingOverscrollIndicator extends ScrollbarStatefulHost {
    readonly axisDirection: AxisDirection;
    readonly notificationPredicate: (argument0: ScrollNotification) => boolean;
    readonly clipBehavior: Clip;
    readonly child: Widget | null;
    constructor({ key = null, axisDirection, notificationPredicate = defaultScrollNotificationPredicate, clipBehavior = "hardEdge", child = null }: {
        readonly key?: Key | null;
        readonly axisDirection: AxisDirection;
        readonly notificationPredicate?: (argument0: ScrollNotification) => boolean;
        readonly clipBehavior?: Clip;
        readonly child?: Widget | null;
    }) {
        const _initialField0 = axisDirection;
        const _initialField1 = notificationPredicate;
        const _initialField2 = clipBehavior;
        const _initialField3 = child;
        super({ key: key });
        captureDartType(this, applyDartType<StretchingOverscrollIndicator>(StretchingOverscrollIndicator, "StretchingOverscrollIndicator", [], [scrollbarStatefulType]));
        this.axisDirection = _initialField0;
        this.notificationPredicate = _initialField1;
        this.clipBehavior = _initialField2;
        this.child = _initialField3;
        protect(this, ["axisDirection", "notificationPredicate", "clipBehavior", "child"]);
    }
    get axis(): Axis {
        return axisDirectionToAxis(this.axisDirection);
    }
    override createState(): State<StretchingOverscrollIndicator> {
        return new SourceStretchingOverscrollIndicatorState();
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        properties.add(sourceEnumProperty<AxisDirection>(stretchAxisDirectionType, "axisDirection", this.axisDirection));
    }
}
export class SourceStretchingOverscrollIndicatorState extends ScrollbarStateHost<StretchingOverscrollIndicator> {
    get _dart_a0c81569a74cec87_stretchController(): SourceStretchController {
        return dartLateInitialize<SourceStretchController>(this, "package:flutter/src/widgets/overscroll_indicator.dart::_StretchingOverscrollIndicatorState._stretchController:FIELD", "_stretchController", () => new SourceStretchController({ vsync: this }), true);
    }
    _dart_a0c81569a74cec87_lastNotification: ScrollNotification | null;
    _dart_a0c81569a74cec87_lastOverscrollNotification: OverscrollNotification | null;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    _dart_a0c81569a74cec87_totalOverscroll: number;
    _dart_a0c81569a74cec87_accepted: boolean;
    constructor() {
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField0 = 0;
        const _initialField1 = true;
        super();
        captureDartType(this, applyDartType<SourceStretchingOverscrollIndicatorState>(SourceStretchingOverscrollIndicatorState, "_StretchingOverscrollIndicatorState", [], [scrollbarStateType<StretchingOverscrollIndicator>(applyDartType<StretchingOverscrollIndicator>(StretchingOverscrollIndicator, "StretchingOverscrollIndicator", [], [scrollbarStatefulType])), scrollbarTickerStateType<StretchingOverscrollIndicator>(applyDartType<StretchingOverscrollIndicator>(StretchingOverscrollIndicator, "StretchingOverscrollIndicator", [], [scrollbarStatefulType]))]));
        this._dart_a0c81569a74cec87_lastNotification = null;
        this._dart_a0c81569a74cec87_lastOverscrollNotification = null;
        this._dart_a0c81569a74cec87_totalOverscroll = _initialField0;
        this._dart_a0c81569a74cec87_accepted = _initialField1;
    }
    _dart_a0c81569a74cec87_handleScrollNotification(notification: ScrollNotification): boolean {
        if (!this.widget.notificationPredicate(notification)) {
            return false;
        }
        if (!scrollbarRawObjectEquals(notification.metrics.axis, this.widget.axis)) {
            return false;
        }
        if (stretchIsStart(notification)) {
            this._dart_a0c81569a74cec87_accepted = true;
            this._dart_a0c81569a74cec87_totalOverscroll = 0;
        }
        else if (stretchIsOverscroll(notification)) {
            this._dart_a0c81569a74cec87_lastOverscrollNotification = notification as OverscrollNotification;
            if (!stretchIsOverscroll(stretchNotificationRuntimeType(this._dart_a0c81569a74cec87_lastNotification))) {
                const confirmationNotification: OverscrollIndicatorNotification = new OverscrollIndicatorNotification({ leading: (notification as OverscrollNotification).overscroll < 0 });
                confirmationNotification.dispatch(this.context);
                this._dart_a0c81569a74cec87_accepted = confirmationNotification.accepted;
            }
            if (this._dart_a0c81569a74cec87_accepted) {
                this._dart_a0c81569a74cec87_totalOverscroll += (notification as OverscrollNotification).overscroll;
                if ((notification as OverscrollNotification).velocity !== 0) {
                    if (FoundationBuildMode.debug)
                        invariant((notification as OverscrollNotification).dragDetails === null, "generated-source-assert", "Pinned Dart assertion failed");
                    this._dart_a0c81569a74cec87_stretchController.absorbImpact((notification as OverscrollNotification).velocity);
                }
                else {
                    if (FoundationBuildMode.debug)
                        invariant((notification as OverscrollNotification).overscroll !== 0, "generated-source-assert", "Pinned Dart assertion failed");
                    if ((notification as OverscrollNotification).dragDetails !== null) {
                        /**
                         * @dartType double
                         * @dartTypeOrigin explicit
                         */
                        const viewportDimension: number = (notification as OverscrollNotification).metrics.viewportDimension;
                        /**
                         * @dartType double
                         * @dartTypeOrigin explicit
                         */
                        const distanceForPull: number = this._dart_a0c81569a74cec87_totalOverscroll / viewportDimension;
                        /**
                         * @dartType double
                         * @dartTypeOrigin explicit
                         */
                        const clampedOverscroll: number = clampDouble(distanceForPull, -1, 1);
                        this._dart_a0c81569a74cec87_stretchController.pull(clampedOverscroll);
                    }
                }
            }
        }
        else if (stretchIsEnd(notification)) {
            /**
             * @dartType double
             * @dartTypeOrigin explicit
             */
            let velocity: number = (() => {
                const _dartTemporary0 = this.widget.axis;
                switch (_dartTemporary0) {
                    case Axis.vertical: return (() => {
                        const _dartTemporary1 = (notification as ScrollEndNotification).dragDetails;
                        if (_dartTemporary1 === null)
                            return null;
                        return _dartTemporary1.velocity.pixelsPerSecond.dy;
                    })() ?? 0;
                    case Axis.horizontal: return (() => {
                        const _dartTemporary2 = (notification as ScrollEndNotification).dragDetails;
                        if (_dartTemporary2 === null)
                            return null;
                        return _dartTemporary2.velocity.pixelsPerSecond.dx;
                    })() ?? 0;
                    default: throw new TypeError("Non-exhaustive Dart switch expression");
                }
            })();
            if (scrollbarRawObjectEquals((notification as ScrollEndNotification).metrics.axisDirection, AxisDirection.left) || scrollbarRawObjectEquals((notification as ScrollEndNotification).metrics.axisDirection, AxisDirection.up)) {
                velocity = -velocity;
            }
            this._dart_a0c81569a74cec87_totalOverscroll = 0;
            if (this._dart_a0c81569a74cec87_accepted) {
                this._dart_a0c81569a74cec87_stretchController.scrollEnd(velocity);
            }
        }
        else if (stretchIsUpdate(notification)) {
            this._dart_a0c81569a74cec87_totalOverscroll = 0;
            this._dart_a0c81569a74cec87_stretchController.scrollEnd(0);
        }
        this._dart_a0c81569a74cec87_lastNotification = notification;
        return false;
    }
    override dispose(): void {
        this._dart_a0c81569a74cec87_stretchController.dispose();
        super.dispose();
    }
    override build(context: BuildContext): Widget {
        return scrollbarNotificationListener({ onNotification: dartMethodTearOff(this, this._dart_a0c81569a74cec87_handleScrollNotification), child: new AnimatedBuilder({ animation: this._dart_a0c81569a74cec87_stretchController, builder: (context: BuildContext, _child: Widget | null): ClipRect => {
                    /**
                     * @dartType double
                     * @dartTypeOrigin explicit
                     */
                    const stretch: number = this._dart_a0c81569a74cec87_stretchController.overscroll;
                    /**
                     * @dartType double
                     * @dartTypeOrigin explicit
                     */
                    let mainAxisSize: number;
                    switch (this.widget.axis) {
                        case Axis.horizontal: {
                            mainAxisSize = stretchMediaWidth(context);
                            break;
                        }
                        case Axis.vertical: {
                            mainAxisSize = stretchMediaHeight(context);
                            break;
                        }
                        default: throw new TypeError("Invalid value outside exhaustive Dart switch");
                    }
                    /**
                     * @dartType double
                     * @dartTypeOrigin explicit
                     */
                    const viewportDimension: number = (() => {
                        const _dartTemporary3 = this._dart_a0c81569a74cec87_lastOverscrollNotification;
                        if (_dartTemporary3 === null)
                            return null;
                        return _dartTemporary3.metrics.viewportDimension;
                    })() ?? mainAxisSize;
                    /**
                     * @dartType double
                     * @dartTypeOrigin explicit
                     */
                    let overscroll: number = -stretch;
                    if (scrollbarRawObjectEquals(this.widget.axisDirection, AxisDirection.up) || scrollbarRawObjectEquals(this.widget.axisDirection, AxisDirection.left)) {
                        overscroll = -overscroll;
                    }
                    const transform: Widget = new StretchEffect({ stretchStrength: overscroll, axis: this.widget.axis, child: this.widget.child ?? stretchConstShrink(SizedBox) });
                    return stretchClip({ clipBehavior: stretch !== 0 && viewportDimension !== mainAxisSize ? this.widget.clipBehavior : "none", child: transform });
                } }) });
    }
}
export class SourceStretchController extends Listenable {
    readonly vsync: TickerProvider;
    _dart_a0c81569a74cec87_controller: AnimationController | null;
    /**
     * @dartType ValueNotifier<double>
     * @dartTypeOrigin explicit
     */
    readonly _dart_a0c81569a74cec87_overscrollNotifier: ValueNotifier<number>;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    _dart_a0c81569a74cec87_interruptedOverscroll: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_a0c81569a74cec87_exponentialScalar: number = 2.718281828459045 / 0.33;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_a0c81569a74cec87_stretchIntensity: number = 0.016;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly minOverscroll: number = -1;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly maxOverscroll: number = 1;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_a0c81569a74cec87_flingVelocityFriction: number = 1 / 6000;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_a0c81569a74cec87_absorbImpactVelocityFriction: number = 1 / 3000;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_a0c81569a74cec87_maxFlingVelocity: number = 0.5;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_a0c81569a74cec87_maxAbsorbImpactVelocity: number = 1.25;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly kNaturalFrequency: number = 24.657;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly kDampingRatio: number = 0.98;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly kTimeCorrectionFactor: number = 0.8;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly kStiffness: number = SourceStretchController.kNaturalFrequency * SourceStretchController.kNaturalFrequency;
    static get _dart_a0c81569a74cec87_kStretchSpringDescription(): SpringDescription {
        return dartStaticRead<SpringDescription>(SourceStretchController, "package:flutter/src/widgets/overscroll_indicator.dart::_StretchController._kStretchSpringDescription:FIELD", (): SpringDescription => SpringDescription.withDampingRatio({ mass: 1, stiffness: SourceStretchController.kStiffness * SourceStretchController.kTimeCorrectionFactor * SourceStretchController.kTimeCorrectionFactor, ratio: SourceStretchController.kDampingRatio }));
    }
    constructor({ vsync }: {
        readonly vsync: TickerProvider;
    }) {
        /**
         * @dartType ValueNotifier<double>
         * @dartTypeOrigin inferred
         */
        const _initialField0 = new ValueNotifier<number>(0);
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField1 = 0;
        const _initialField2 = vsync;
        super();
        captureDartType(this, applyDartType<SourceStretchController>(SourceStretchController, "_StretchController", [], [stretchListenableType]));
        this.vsync = _initialField2;
        this._dart_a0c81569a74cec87_controller = null;
        this._dart_a0c81569a74cec87_overscrollNotifier = _initialField0;
        this._dart_a0c81569a74cec87_interruptedOverscroll = _initialField1;
        protect(this, ["vsync", "_dart_a0c81569a74cec87_overscrollNotifier"]);
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get overscroll(): number {
        return this._dart_a0c81569a74cec87_overscrollNotifier.value;
    }
    /**
     * @dartParam newValue double
     * @dartParamOrigin newValue explicit
     */
    set overscroll(newValue: number) {
        this._dart_a0c81569a74cec87_overscrollNotifier.value = clampDouble(newValue, SourceStretchController.minOverscroll, SourceStretchController.maxOverscroll);
    }
    override addListener(listener: () => void): void {
        this._dart_a0c81569a74cec87_overscrollNotifier.addListener(listener);
    }
    override removeListener(listener: () => void): void {
        this._dart_a0c81569a74cec87_overscrollNotifier.removeListener(listener);
    }
    /**
     * @dartParam velocity double
     * @dartParamOrigin velocity explicit
     */
    _dart_a0c81569a74cec87_createStretchSimulation(velocity: number): SpringSimulation {
        return new SpringSimulation(SourceStretchController._dart_a0c81569a74cec87_kStretchSpringDescription, this.overscroll, 0, velocity * SourceStretchController.kTimeCorrectionFactor);
    }
    /**
     * @dartParam velocity double
     * @dartParamOrigin velocity explicit
     */
    absorbImpact(velocity: number): void {
        if (velocity === 0) {
            return;
        }
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const scaledVelocity: number = clampDouble(velocity * SourceStretchController._dart_a0c81569a74cec87_absorbImpactVelocityFriction, -SourceStretchController._dart_a0c81569a74cec87_maxAbsorbImpactVelocity, SourceStretchController._dart_a0c81569a74cec87_maxAbsorbImpactVelocity);
        this.animate(this._dart_a0c81569a74cec87_createStretchSimulation(scaledVelocity));
    }
    /**
     * @dartParam velocity double
     * @dartParamOrigin velocity explicit
     */
    scrollEnd(velocity: number): void {
        if (velocity === 0 && this.overscroll === 0) {
            return;
        }
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const scaledVelocity: number = clampDouble(-(velocity * SourceStretchController._dart_a0c81569a74cec87_flingVelocityFriction), -SourceStretchController._dart_a0c81569a74cec87_maxFlingVelocity, SourceStretchController._dart_a0c81569a74cec87_maxFlingVelocity);
        if (this._dart_a0c81569a74cec87_controller === null) {
            this.animate(this._dart_a0c81569a74cec87_createStretchSimulation(scaledVelocity));
        }
    }
    animate(simulation: Simulation): void {
        const controller: AnimationController = (() => {
            const _dartTemporary4 = AnimationController.unbounded({ vsync: this.vsync });
            _dartTemporary4.addListener((): void => {
                /**
                 * @dartType double
                 * @dartTypeOrigin explicit
                 */
                const newOverscroll: number = (() => {
                    const _dartTemporary5 = this._dart_a0c81569a74cec87_controller;
                    return _dartTemporary5 === null ? null : _dartTemporary5.value;
                })() ?? 0;
                this.overscroll = newOverscroll;
            });
            return _dartTemporary4;
        })();
        stretchWhenComplete(controller.animateWith(simulation), (): null => {
            if ((() => {
                const _dartTemporary6 = this._dart_a0c81569a74cec87_controller;
                const _dartTemporary7 = controller;
                return _dartTemporary6 === null || _dartTemporary7 === null ? _dartTemporary6 === _dartTemporary7 : scrollbarRawObjectEquals(_dartTemporary6, _dartTemporary7);
            })()) {
                this.overscroll = 0;
                this._dart_a0c81569a74cec87_interruptedOverscroll = 0;
                controller.dispose();
                this._dart_a0c81569a74cec87_controller = null;
            }
            return null;
        });
        void ((this._dart_a0c81569a74cec87_controller?.dispose() ?? null));
        this._dart_a0c81569a74cec87_controller = controller;
    }
    /**
     * @dartParam normalizedOverscroll double
     * @dartParamOrigin normalizedOverscroll explicit
     */
    pull(normalizedOverscroll: number): void {
        if (this._dart_a0c81569a74cec87_controller !== null) {
            this._dart_a0c81569a74cec87_interruptedOverscroll = (() => {
                const _dartTemporary8 = this._dart_a0c81569a74cec87_controller;
                if (_dartTemporary8 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary8!;
            })().value;
            (() => {
                const _dartTemporary9 = this._dart_a0c81569a74cec87_controller;
                if (_dartTemporary9 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary9!;
            })().dispose();
            this._dart_a0c81569a74cec87_controller = null;
        }
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const pullDistance: number = normalizedOverscroll;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const absDistance: number = Math.abs(pullDistance);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const linearIntensity: number = SourceStretchController._dart_a0c81569a74cec87_stretchIntensity * absDistance;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const exponentialIntensity: number = SourceStretchController._dart_a0c81569a74cec87_stretchIntensity * (1 - Math.exp(-absDistance * SourceStretchController._dart_a0c81569a74cec87_exponentialScalar));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const directionSign: number = Math.sign(pullDistance);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const newOverscroll: number = directionSign * (linearIntensity + exponentialIntensity);
        this.overscroll = newOverscroll + this._dart_a0c81569a74cec87_interruptedOverscroll;
    }
    dispose(): void {
        void ((this._dart_a0c81569a74cec87_controller?.dispose() ?? null));
        this._dart_a0c81569a74cec87_controller = null;
        this._dart_a0c81569a74cec87_overscrollNotifier.dispose();
    }
    override toString(): string {
        return "_StretchController()";
    }
}
protect(SourceStretchController, ["_dart_a0c81569a74cec87_exponentialScalar", "_dart_a0c81569a74cec87_stretchIntensity", "minOverscroll", "maxOverscroll", "_dart_a0c81569a74cec87_flingVelocityFriction", "_dart_a0c81569a74cec87_absorbImpactVelocityFriction", "_dart_a0c81569a74cec87_maxFlingVelocity", "_dart_a0c81569a74cec87_maxAbsorbImpactVelocity", "kNaturalFrequency", "kDampingRatio", "kTimeCorrectionFactor", "kStiffness"]);
dartStaticSeal(SourceStretchController, ["_dart_a0c81569a74cec87_kStretchSpringDescription"]);
