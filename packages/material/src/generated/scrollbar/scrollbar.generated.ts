// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/scrollbar.dart; SHA256 4f5a94586bc52086f4662e40129015c71a40b7f1aad3dc4b464aaf85abe940b0
import { protect } from "@nelyx/core/internal/ui/value-math";
import { checkedInteger } from "@nelyx/core/internal/ui/value-math";
import { dartLateRead } from "@nelyx/core/internal/foundation/dart-late";
import { dartLateWrite } from "@nelyx/core/internal/foundation/dart-late";
import { dartLateLocal } from "@nelyx/core/internal/foundation/dart-late";
import { Color } from "@nelyx/core/ui/color";
import { Radius } from "@nelyx/core/ui/radius";
import { Offset } from "@nelyx/core/ui/offset";
import { Widget } from "@nelyx/core/framework/widgets/framework";
import { Key } from "@nelyx/core/foundation/key";
import { AnimationController } from "@nelyx/core/framework/animation/animation-controller";
import { DartSet } from "@nelyx/core/internal/foundation/dart-collections";
import { castSourceDartDouble } from "@nelyx/core/internal/foundation/dart-numeric";
import { ScrollController } from "@nelyx/core/framework/widgets/scroll-controller";
import { ScrollNotification } from "@nelyx/core/framework/widgets/scroll-notification";
import { Velocity } from "@nelyx/core/framework/gestures/velocity-tracker";
import { PointerHoverEvent } from "@nelyx/core/framework/gestures/events";
import { PointerExitEvent } from "@nelyx/core/framework/gestures/events";
import { SourceWidgetState } from "@nelyx/core/internal/framework/widgets/widget-state.generated";
import { SourceWidgetStateProperty } from "@nelyx/core/internal/framework/widgets/widget-state.generated";
import { Directionality } from "@nelyx/core/framework/widgets/app-data";
import { defaultScrollNotificationPredicate } from "@nelyx/core/framework/widgets/scroll-notification";
import { scrollbarMediaPadding } from "@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter";
import { emptyWidgetStateSet } from "@nelyx/core/internal/framework/widgets/widget-state-full-collections";
import { applyDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { captureDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { scrollbarRawObjectEquals } from "@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter";
import { constSourceRadiusCircular } from "@nelyx/core/internal/ui/radius-source-adapter";
import { constSourceColor } from "@nelyx/core/internal/ui/color-source-adapter";
import { SourceScrollbarOrientation } from "@nelyx/core/internal/framework/widgets/scrollbar.generated";
import { SourceRawScrollbar } from "@nelyx/core/internal/framework/widgets/scrollbar.generated";
import { SourceRawScrollbarState } from "@nelyx/core/internal/framework/widgets/scrollbar.generated";
import { SourceScrollbarThemeData } from "./scrollbar-theme.generated.ts";
import { SourceScrollbarTheme } from "./scrollbar-theme.generated.ts";
import { SourceCupertinoScrollbar } from "@nelyx/cupertino/internal/scrollbar.generated";
import { boxSourceDartDouble } from "@nelyx/core/internal/foundation/dart-numeric";
import { dartBoolType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { dartDoubleType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { SourceBrightness } from "@nelyx/cupertino/internal/scrollbar-style-source-adapter";
import { ScrollbarMaterialThemeData } from "../../internal/scrollbar/scrollbar-source-adapter.ts";
import { ScrollbarColorScheme } from "../../internal/scrollbar/scrollbar-source-adapter.ts";
import { ScrollbarMaterialTheme } from "../../internal/scrollbar/scrollbar-source-adapter.ts";
import { ScrollbarStatelessHost } from "@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter";
import { scrollbarStatelessType } from "@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter";
import { scrollbarRawWidgetType } from "@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter";
import { scrollbarRawStateType } from "@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter";
import { sourceColorType } from "@nelyx/core/internal/ui/color-source-adapter";
import { sourceColorWithOpacity } from "@nelyx/core/internal/ui/color-source-adapter";
import { sourceColorLerp } from "@nelyx/core/internal/ui/color-source-adapter";
import type { BuildContext } from "@nelyx/core/framework/widgets/framework";
import type { DartDouble } from "@nelyx/core/internal/foundation/dart-numeric";
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kScrollbarThickness: number = 8;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kScrollbarThicknessWithTrack: number = 12;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kScrollbarMargin: number = 2;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kScrollbarMinLength: number = 48;
export const _kScrollbarRadius: Radius = constSourceRadiusCircular(Radius, 8);
export const _kScrollbarFadeDuration: number = 0 + 300 * 1;
export const _kScrollbarTimeToFade: number = 0 + 600 * 1;
export class SourceScrollbar extends ScrollbarStatelessHost {
    readonly child: Widget;
    readonly controller: ScrollController | null;
    readonly thumbVisibility: boolean | null;
    readonly trackVisibility: boolean | null;
    /**
     * @dartType double?
     * @dartTypeOrigin explicit
     */
    readonly thickness: number | null;
    readonly radius: Radius | null;
    readonly interactive: boolean | null;
    readonly notificationPredicate: ((argument0: ScrollNotification) => boolean) | null;
    readonly scrollbarOrientation: SourceScrollbarOrientation | null;
    /**
     * @dartParam thickness double?
     * @dartParamOrigin thickness inferred
     */
    constructor({ key = null, child, controller = null, thumbVisibility = null, trackVisibility = null, thickness = null, radius = null, notificationPredicate = null, interactive = null, scrollbarOrientation = null }: {
        readonly key?: Key | null;
        readonly child: Widget;
        readonly controller?: ScrollController | null;
        readonly thumbVisibility?: boolean | null;
        readonly trackVisibility?: boolean | null;
        readonly thickness?: number | null;
        readonly radius?: Radius | null;
        readonly notificationPredicate?: ((argument0: ScrollNotification) => boolean) | null;
        readonly interactive?: boolean | null;
        readonly scrollbarOrientation?: SourceScrollbarOrientation | null;
    }) {
        const _initialField0 = child;
        const _initialField1 = controller;
        const _initialField2 = thumbVisibility;
        const _initialField3 = trackVisibility;
        /**
         * @dartType double?
         * @dartTypeOrigin inferred
         */
        const _initialField4 = thickness;
        const _initialField5 = radius;
        const _initialField6 = notificationPredicate;
        const _initialField7 = interactive;
        const _initialField8 = scrollbarOrientation;
        super({ key: key });
        captureDartType(this, applyDartType<SourceScrollbar>(SourceScrollbar, "Scrollbar", [], [scrollbarStatelessType]));
        this.child = _initialField0;
        this.controller = _initialField1;
        this.thumbVisibility = _initialField2;
        this.trackVisibility = _initialField3;
        this.thickness = _initialField4;
        this.radius = _initialField5;
        this.interactive = _initialField7;
        this.notificationPredicate = _initialField6;
        this.scrollbarOrientation = _initialField8;
        protect(this, ["child", "controller", "thumbVisibility", "trackVisibility", "thickness", "radius", "interactive", "notificationPredicate", "scrollbarOrientation"]);
    }
    override build(context: BuildContext): Widget {
        if (scrollbarRawObjectEquals(ScrollbarMaterialTheme.of(context).platform, "iOS")) {
            return new SourceCupertinoScrollbar({ thumbVisibility: this.thumbVisibility ?? false, thickness: this.thickness ?? SourceCupertinoScrollbar.defaultThickness, thicknessWhileDragging: this.thickness ?? SourceCupertinoScrollbar.defaultThicknessWhileDragging, radius: this.radius ?? SourceCupertinoScrollbar.defaultRadius, radiusWhileDragging: this.radius ?? SourceCupertinoScrollbar.defaultRadiusWhileDragging, controller: this.controller, notificationPredicate: this.notificationPredicate, scrollbarOrientation: this.scrollbarOrientation, child: this.child });
        }
        return new SourceMaterialScrollbar({ controller: this.controller, thumbVisibility: this.thumbVisibility, trackVisibility: this.trackVisibility, thickness: this.thickness, radius: this.radius, notificationPredicate: this.notificationPredicate, interactive: this.interactive, scrollbarOrientation: this.scrollbarOrientation, child: this.child });
    }
}
export class SourceMaterialScrollbar extends SourceRawScrollbar {
    /**
     * @dartParam thickness double?
     * @dartParamOrigin thickness inferred
     */
    constructor({ child, controller = null, thumbVisibility = null, trackVisibility = null, thickness = null, radius = null, notificationPredicate = null, interactive = null, scrollbarOrientation = null }: {
        readonly child: Widget;
        readonly controller?: ScrollController | null;
        readonly thumbVisibility?: boolean | null;
        readonly trackVisibility?: boolean | null;
        readonly thickness?: number | null;
        readonly radius?: Radius | null;
        readonly notificationPredicate?: ((argument0: ScrollNotification) => boolean) | null;
        readonly interactive?: boolean | null;
        readonly scrollbarOrientation?: SourceScrollbarOrientation | null;
    }) {
        super({ fadeDuration: _kScrollbarFadeDuration, timeToFade: _kScrollbarTimeToFade, pressDuration: 0, notificationPredicate: (() => {
                const _dartTemporary0 = notificationPredicate;
                return _dartTemporary0 === null ? defaultScrollNotificationPredicate : _dartTemporary0;
            })(), child: child, controller: controller, thumbVisibility: thumbVisibility, trackVisibility: trackVisibility, thickness: thickness, radius: radius, interactive: interactive, scrollbarOrientation: scrollbarOrientation });
        captureDartType(this, applyDartType<SourceMaterialScrollbar>(SourceMaterialScrollbar, "_MaterialScrollbar", [], [scrollbarRawWidgetType]));
    }
    override createState(): SourceMaterialScrollbarState {
        return new SourceMaterialScrollbarState();
    }
}
export class SourceMaterialScrollbarState extends SourceRawScrollbarState<SourceMaterialScrollbar> {
    get _dart_f0d1768c7fe64516_hoverAnimationController(): AnimationController {
        return dartLateRead<AnimationController>(this, "package:flutter/src/material/scrollbar.dart::_MaterialScrollbarState._hoverAnimationController:FIELD", "_hoverAnimationController");
    }
    set _dart_f0d1768c7fe64516_hoverAnimationController(value: AnimationController) {
        dartLateWrite<AnimationController>(this, "package:flutter/src/material/scrollbar.dart::_MaterialScrollbarState._hoverAnimationController:FIELD", "_hoverAnimationController", value, false);
    }
    _dart_f0d1768c7fe64516_dragIsActive: boolean;
    _dart_f0d1768c7fe64516_hoverIsActive: boolean;
    get _dart_f0d1768c7fe64516_colorScheme(): ScrollbarColorScheme {
        return dartLateRead<ScrollbarColorScheme>(this, "package:flutter/src/material/scrollbar.dart::_MaterialScrollbarState._colorScheme:FIELD", "_colorScheme");
    }
    set _dart_f0d1768c7fe64516_colorScheme(value: ScrollbarColorScheme) {
        dartLateWrite<ScrollbarColorScheme>(this, "package:flutter/src/material/scrollbar.dart::_MaterialScrollbarState._colorScheme:FIELD", "_colorScheme", value, false);
    }
    get _dart_f0d1768c7fe64516_scrollbarTheme(): SourceScrollbarThemeData {
        return dartLateRead<SourceScrollbarThemeData>(this, "package:flutter/src/material/scrollbar.dart::_MaterialScrollbarState._scrollbarTheme:FIELD", "_scrollbarTheme");
    }
    set _dart_f0d1768c7fe64516_scrollbarTheme(value: SourceScrollbarThemeData) {
        dartLateWrite<SourceScrollbarThemeData>(this, "package:flutter/src/material/scrollbar.dart::_MaterialScrollbarState._scrollbarTheme:FIELD", "_scrollbarTheme", value, false);
    }
    get _dart_f0d1768c7fe64516_useAndroidScrollbar(): boolean {
        return dartLateRead<boolean>(this, "package:flutter/src/material/scrollbar.dart::_MaterialScrollbarState._useAndroidScrollbar:FIELD", "_useAndroidScrollbar");
    }
    set _dart_f0d1768c7fe64516_useAndroidScrollbar(value: boolean) {
        dartLateWrite<boolean>(this, "package:flutter/src/material/scrollbar.dart::_MaterialScrollbarState._useAndroidScrollbar:FIELD", "_useAndroidScrollbar", value, false);
    }
    constructor() {
        const _initialField0 = false;
        const _initialField1 = false;
        super(applyDartType<SourceMaterialScrollbar>(SourceMaterialScrollbar, "_MaterialScrollbar", [], [scrollbarRawWidgetType]));
        captureDartType(this, applyDartType<SourceMaterialScrollbarState>(SourceMaterialScrollbarState, "_MaterialScrollbarState", [], [scrollbarRawStateType<SourceMaterialScrollbar>(applyDartType<SourceMaterialScrollbar>(SourceMaterialScrollbar, "_MaterialScrollbar", [], [scrollbarRawWidgetType]))]));
        this._dart_f0d1768c7fe64516_dragIsActive = _initialField0;
        this._dart_f0d1768c7fe64516_hoverIsActive = _initialField1;
    }
    override get showScrollbar(): boolean {
        return this.widget.thumbVisibility ?? this._dart_f0d1768c7fe64516_scrollbarTheme.thumbVisibility?.resolve(this._dart_f0d1768c7fe64516_states) ?? false;
    }
    override get enableGestures(): boolean {
        return this.widget.interactive ?? this._dart_f0d1768c7fe64516_scrollbarTheme.interactive ?? !this._dart_f0d1768c7fe64516_useAndroidScrollbar;
    }
    get _dart_f0d1768c7fe64516_trackVisibility(): SourceWidgetStateProperty<boolean> {
        return SourceWidgetStateProperty.resolveWith<boolean>(dartBoolType, (states: DartSet<SourceWidgetState>): boolean => {
            return this.widget.trackVisibility ?? this._dart_f0d1768c7fe64516_scrollbarTheme.trackVisibility?.resolve(states) ?? false;
        });
    }
    get _dart_f0d1768c7fe64516_states(): DartSet<SourceWidgetState> {
        return (() => {
            const _dartTemporary1 = emptyWidgetStateSet();
            if (this._dart_f0d1768c7fe64516_dragIsActive)
                _dartTemporary1.add(SourceWidgetState.dragged);
            if (this._dart_f0d1768c7fe64516_hoverIsActive)
                _dartTemporary1.add(SourceWidgetState.hovered);
            return _dartTemporary1;
        })();
    }
    get _dart_f0d1768c7fe64516_thumbColor(): SourceWidgetStateProperty<Color> {
        const onSurface: Color = this._dart_f0d1768c7fe64516_colorScheme.onSurface;
        const brightness: SourceBrightness = this._dart_f0d1768c7fe64516_colorScheme.brightness;
        const dragColor = dartLateLocal<Color>("dragColor", false);
        const hoverColor = dartLateLocal<Color>("hoverColor", false);
        const idleColor = dartLateLocal<Color>("idleColor", false);
        switch (brightness) {
            case SourceBrightness.light: {
                dragColor.value = sourceColorWithOpacity(onSurface, 0.6);
                hoverColor.value = sourceColorWithOpacity(onSurface, 0.5);
                idleColor.value = this._dart_f0d1768c7fe64516_useAndroidScrollbar ? sourceColorWithOpacity(ScrollbarMaterialTheme.of(this.context).highlightColor, 1) : sourceColorWithOpacity(onSurface, 0.1);
                break;
            }
            case SourceBrightness.dark: {
                dragColor.value = sourceColorWithOpacity(onSurface, 0.75);
                hoverColor.value = sourceColorWithOpacity(onSurface, 0.65);
                idleColor.value = this._dart_f0d1768c7fe64516_useAndroidScrollbar ? sourceColorWithOpacity(ScrollbarMaterialTheme.of(this.context).highlightColor, 1) : sourceColorWithOpacity(onSurface, 0.3);
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
        return SourceWidgetStateProperty.resolveWith<Color>(sourceColorType, (states: DartSet<SourceWidgetState>): Color => {
            if (states.contains(SourceWidgetState.dragged)) {
                return this._dart_f0d1768c7fe64516_scrollbarTheme.thumbColor?.resolve(states) ?? dragColor.value;
            }
            if (this._dart_f0d1768c7fe64516_trackVisibility.resolve(states)) {
                return this._dart_f0d1768c7fe64516_scrollbarTheme.thumbColor?.resolve(states) ?? hoverColor.value;
            }
            return (() => {
                const _dartTemporary2 = sourceColorLerp(this._dart_f0d1768c7fe64516_scrollbarTheme.thumbColor?.resolve(states) ?? idleColor.value, this._dart_f0d1768c7fe64516_scrollbarTheme.thumbColor?.resolve(states) ?? hoverColor.value, this._dart_f0d1768c7fe64516_hoverAnimationController.value);
                if (_dartTemporary2 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary2!;
            })();
        });
    }
    get _dart_f0d1768c7fe64516_trackColor(): SourceWidgetStateProperty<Color> {
        const onSurface: Color = this._dart_f0d1768c7fe64516_colorScheme.onSurface;
        const brightness: SourceBrightness = this._dart_f0d1768c7fe64516_colorScheme.brightness;
        return SourceWidgetStateProperty.resolveWith<Color>(sourceColorType, (states: DartSet<SourceWidgetState>): Color => {
            if (this.showScrollbar && this._dart_f0d1768c7fe64516_trackVisibility.resolve(states)) {
                return this._dart_f0d1768c7fe64516_scrollbarTheme.trackColor?.resolve(states) ?? (() => {
                    const _dartTemporary3 = brightness;
                    switch (_dartTemporary3) {
                        case SourceBrightness.light: return sourceColorWithOpacity(onSurface, 0.03);
                        case SourceBrightness.dark: return sourceColorWithOpacity(onSurface, 0.05);
                        default: throw new TypeError("Non-exhaustive Dart switch expression");
                    }
                })();
            }
            return constSourceColor(Color, 0);
        });
    }
    get _dart_f0d1768c7fe64516_trackBorderColor(): SourceWidgetStateProperty<Color> {
        const onSurface: Color = this._dart_f0d1768c7fe64516_colorScheme.onSurface;
        const brightness: SourceBrightness = this._dart_f0d1768c7fe64516_colorScheme.brightness;
        return SourceWidgetStateProperty.resolveWith<Color>(sourceColorType, (states: DartSet<SourceWidgetState>): Color => {
            if (this.showScrollbar && this._dart_f0d1768c7fe64516_trackVisibility.resolve(states)) {
                return this._dart_f0d1768c7fe64516_scrollbarTheme.trackBorderColor?.resolve(states) ?? (() => {
                    const _dartTemporary4 = brightness;
                    switch (_dartTemporary4) {
                        case SourceBrightness.light: return sourceColorWithOpacity(onSurface, 0.1);
                        case SourceBrightness.dark: return sourceColorWithOpacity(onSurface, 0.25);
                        default: throw new TypeError("Non-exhaustive Dart switch expression");
                    }
                })();
            }
            return constSourceColor(Color, 0);
        });
    }
    /**
     * @dartReturn WidgetStateProperty<double>
     * @dartReturnOrigin explicit
     */
    get _dart_f0d1768c7fe64516_thickness(): SourceWidgetStateProperty<DartDouble> {
        return SourceWidgetStateProperty.resolveWith<DartDouble>(dartDoubleType, (states: DartSet<SourceWidgetState>): DartDouble => {
            if (states.contains(SourceWidgetState.hovered) && this._dart_f0d1768c7fe64516_trackVisibility.resolve(states)) {
                return boxSourceDartDouble(this.widget.thickness ?? (() => {
                    const _dartTemporary5 = (this._dart_f0d1768c7fe64516_scrollbarTheme.thickness?.resolve(states) ?? null);
                    return _dartTemporary5 === null ? null : castSourceDartDouble(_dartTemporary5);
                })() ?? _kScrollbarThicknessWithTrack);
            }
            return boxSourceDartDouble(this.widget.thickness ?? (() => {
                const _dartTemporary6 = (this._dart_f0d1768c7fe64516_scrollbarTheme.thickness?.resolve(states) ?? null);
                return _dartTemporary6 === null ? null : castSourceDartDouble(_dartTemporary6);
            })() ?? (_kScrollbarThickness / checkedInteger((checkedInteger(this._dart_f0d1768c7fe64516_useAndroidScrollbar ? 2 : 1)))));
        });
    }
    override initState(): void {
        super.initState();
        this._dart_f0d1768c7fe64516_hoverAnimationController = new AnimationController({ vsync: this, duration: 0 + 200 * 1 });
        this._dart_f0d1768c7fe64516_hoverAnimationController.addListener((): void => {
            this.updateScrollbarPainter();
        });
    }
    override didChangeDependencies(): void {
        const theme: ScrollbarMaterialThemeData = ScrollbarMaterialTheme.of(this.context);
        this._dart_f0d1768c7fe64516_colorScheme = theme.colorScheme;
        this._dart_f0d1768c7fe64516_scrollbarTheme = SourceScrollbarTheme.of(this.context);
        switch (theme.platform) {
            case "android": {
                this._dart_f0d1768c7fe64516_useAndroidScrollbar = true;
                break;
            }
            case "iOS":
            case "linux":
            case "fuchsia":
            case "macOS":
            case "windows": {
                this._dart_f0d1768c7fe64516_useAndroidScrollbar = false;
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
        super.didChangeDependencies();
    }
    override updateScrollbarPainter(): void {
        (() => {
            const _dartTemporary7 = this.scrollbarPainter;
            _dartTemporary7.color = this._dart_f0d1768c7fe64516_thumbColor.resolve(this._dart_f0d1768c7fe64516_states);
            _dartTemporary7.trackColor = this._dart_f0d1768c7fe64516_trackColor.resolve(this._dart_f0d1768c7fe64516_states);
            _dartTemporary7.trackBorderColor = this._dart_f0d1768c7fe64516_trackBorderColor.resolve(this._dart_f0d1768c7fe64516_states);
            _dartTemporary7.textDirection = Directionality.of(this.context);
            _dartTemporary7.thickness = castSourceDartDouble(this._dart_f0d1768c7fe64516_thickness.resolve(this._dart_f0d1768c7fe64516_states));
            _dartTemporary7.radius = this.widget.radius ?? this._dart_f0d1768c7fe64516_scrollbarTheme.radius ?? (this._dart_f0d1768c7fe64516_useAndroidScrollbar ? null : _kScrollbarRadius);
            _dartTemporary7.crossAxisMargin = this._dart_f0d1768c7fe64516_scrollbarTheme.crossAxisMargin ?? (this._dart_f0d1768c7fe64516_useAndroidScrollbar ? 0 : _kScrollbarMargin);
            _dartTemporary7.mainAxisMargin = this._dart_f0d1768c7fe64516_scrollbarTheme.mainAxisMargin ?? 0;
            _dartTemporary7.minLength = this._dart_f0d1768c7fe64516_scrollbarTheme.minThumbLength ?? _kScrollbarMinLength;
            _dartTemporary7.padding = scrollbarMediaPadding(this.context);
            _dartTemporary7.scrollbarOrientation = this.widget.scrollbarOrientation;
            _dartTemporary7.ignorePointer = !this.enableGestures;
            return _dartTemporary7;
        })();
    }
    override handleThumbPressStart(localPosition: Offset): void {
        super.handleThumbPressStart(localPosition);
        this.setState((): void => {
            this._dart_f0d1768c7fe64516_dragIsActive = true;
        });
    }
    override handleThumbPressEnd(localPosition: Offset, velocity: Velocity): void {
        super.handleThumbPressEnd(localPosition, velocity);
        this.setState((): void => {
            this._dart_f0d1768c7fe64516_dragIsActive = false;
        });
    }
    override handleHover(event: PointerHoverEvent): void {
        super.handleHover(event);
        if (this.isPointerOverScrollbar(event.position, event.kind, { forHover: true })) {
            this.setState((): void => {
                this._dart_f0d1768c7fe64516_hoverIsActive = true;
            });
            this._dart_f0d1768c7fe64516_hoverAnimationController.forward();
        }
        else if (this._dart_f0d1768c7fe64516_hoverIsActive) {
            this.setState((): void => {
                this._dart_f0d1768c7fe64516_hoverIsActive = false;
            });
            this._dart_f0d1768c7fe64516_hoverAnimationController.reverse();
        }
    }
    override handleHoverExit(event: PointerExitEvent): void {
        super.handleHoverExit(event);
        this.setState((): void => {
            this._dart_f0d1768c7fe64516_hoverIsActive = false;
        });
        this._dart_f0d1768c7fe64516_hoverAnimationController.reverse();
    }
    override dispose(): void {
        this._dart_f0d1768c7fe64516_hoverAnimationController.dispose();
        super.dispose();
    }
}
