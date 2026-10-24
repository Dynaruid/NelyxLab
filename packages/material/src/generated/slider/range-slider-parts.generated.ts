// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/range_slider_parts.dart; SHA256 40edf0ec91169c78111e2cfb226456f056e9bb3d418b33bcb5e99d660308056e
import { protect } from "@nelyx/core/internal/ui/value-math";
import { invariant } from "@nelyx/core/foundation/errors";
import { FoundationBuildMode } from "@nelyx/core/foundation/constants";
import { Color } from "@nelyx/core/ui/color";
import { Radius } from "@nelyx/core/ui/radius";
import { Canvas } from "@nelyx/core/ui/canvas";
import { Offset } from "@nelyx/core/ui/offset";
import { Size } from "@nelyx/core/ui/size";
import { Rect } from "@nelyx/core/ui/rect";
import { RRect } from "@nelyx/core/ui/rrect";
import { Path } from "@nelyx/core/ui/path";
import { ScrollbarSourcePaint } from "@nelyx/core/internal/framework/widgets/scrollbar-painter-source-adapter";
import { scrollbarValueEquals } from "@nelyx/core/internal/framework/widgets/scrollbar-painter-source-adapter";
import { RenderBox } from "@nelyx/core/framework/rendering/object";
import { castSourceDartDouble } from "@nelyx/core/foundation/dart-numeric";
import { scrollbarLocalToGlobal } from "@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter";
import { emptyWidgetStateSet } from "@nelyx/core/internal/framework/widgets/widget-state-full-collections";
import { applyDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { captureDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { constSourceRadiusCircular } from "@nelyx/core/internal/ui/radius-source-adapter";
import { boxSourceDartDouble } from "@nelyx/core/internal/foundation/dart-numeric";
import { dartRecord } from "@nelyx/core/internal/foundation/dart-record";
import { dartRecordRead } from "@nelyx/core/internal/foundation/dart-record";
import { sourceDartNumAdd } from "@nelyx/core/foundation/dart-numeric";
import { sourceDartNumSubtract } from "@nelyx/core/foundation/dart-numeric";
import { constSourceSize } from "@nelyx/core/ui/size-source";
import { sliderShapeConstBorderRadiusAll } from "../../internal/slider/slider-shapes-source-adapter.ts";
import { BorderRadius } from "@nelyx/core/framework/painting/border-radius";
import { canonicalDartObject } from "@nelyx/core/internal/foundation/dart-const";
import { sliderShapeDebugShadows } from "../../internal/slider/slider-shapes-source-adapter.ts";
import { sliderShapeDrawShadow } from "../../internal/slider/slider-shapes-source-adapter.ts";
import { sliderShapeMathMax } from "../../internal/slider/slider-shapes-source-adapter.ts";
import { sliderShapeMathMin } from "../../internal/slider/slider-shapes-source-adapter.ts";
import { sliderShapeDoubleTween } from "../../internal/slider/slider-shapes-source-adapter.ts";
import { sliderShapeAnimationValue } from "../../internal/slider/slider-shapes-source-adapter.ts";
import { sliderShapeTweenEvaluate } from "../../internal/slider/slider-shapes-source-adapter.ts";
import { PaintingContext } from "@nelyx/core/framework/painting/context";
import { TextPainter } from "@nelyx/core/framework/painting/text-painter";
import { Thumb } from "./slider-theme-values.generated.ts";
import { Colors } from "../../colors.ts";
import { ColorTween } from "@nelyx/core/framework/animation/tween";
import { hasCapturedDartType } from "@nelyx/core/foundation/dart-type-witness";
import type { Animation } from "../../internal/slider/slider-shapes-source-adapter.ts";
import type { ScrollbarTextDirection } from "@nelyx/core/internal/framework/widgets/scrollbar-painter-source-adapter";
import type { DartDouble } from "@nelyx/core/foundation/dart-numeric";
import type { SliderShapeTween } from "../../internal/slider/slider-shapes-source-adapter.ts";
import type { SliderThemeData } from "../../slider-theme.ts";
export abstract class RangeSliderThumbShape {
    constructor() {
        captureDartType(this, applyDartType<RangeSliderThumbShape>(RangeSliderThumbShape, "RangeSliderThumbShape", [], []));
    }
    abstract getPreferredSize(isEnabled: boolean, isDiscrete: boolean): Size;
    /**
     * @dartParam activationAnimation Animation<double>
     * @dartParamOrigin activationAnimation explicit
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     */
    abstract paint(context: PaintingContext, center: Offset, options: {
        readonly activationAnimation: Animation<DartDouble>;
        readonly enableAnimation: Animation<DartDouble>;
        readonly isDiscrete?: boolean;
        readonly isEnabled?: boolean;
        readonly isOnTop?: boolean;
        readonly textDirection?: ScrollbarTextDirection;
        readonly sliderTheme: SliderThemeData;
        readonly thumb?: Thumb;
        readonly isPressed?: boolean;
    }): void;
}
export abstract class RangeSliderValueIndicatorShape {
    constructor() {
        captureDartType(this, applyDartType<RangeSliderValueIndicatorShape>(RangeSliderValueIndicatorShape, "RangeSliderValueIndicatorShape", [], []));
    }
    /**
     * @dartParam textScaleFactor double
     * @dartParamOrigin textScaleFactor explicit
     */
    abstract getPreferredSize(isEnabled: boolean, isDiscrete: boolean, options: {
        readonly labelPainter: TextPainter;
        readonly textScaleFactor: number;
    }): Size;
    /**
     * @dartParam activationAnimation Animation<double>?
     * @dartParamOrigin activationAnimation explicit
     * @dartParam textScaleFactor double?
     * @dartParamOrigin textScaleFactor explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    getHorizontalShift({ parentBox = null, center = null, labelPainter = null, activationAnimation = null, textScaleFactor = null, sizeWithOverflow = null }: {
        readonly parentBox?: RenderBox | null;
        readonly center?: Offset | null;
        readonly labelPainter?: TextPainter | null;
        readonly activationAnimation?: Animation<DartDouble> | null;
        readonly textScaleFactor?: number | null;
        readonly sizeWithOverflow?: Size | null;
    } = {}): number {
        return 0;
    }
    /**
     * @dartParam activationAnimation Animation<double>
     * @dartParamOrigin activationAnimation explicit
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     * @dartParam textScaleFactor double
     * @dartParamOrigin textScaleFactor explicit
     * @dartParam value double
     * @dartParamOrigin value explicit
     */
    abstract paint(context: PaintingContext, center: Offset, options: {
        readonly activationAnimation: Animation<DartDouble>;
        readonly enableAnimation: Animation<DartDouble>;
        readonly isDiscrete?: boolean;
        readonly isOnTop?: boolean;
        readonly labelPainter: TextPainter;
        readonly textScaleFactor?: number;
        readonly sizeWithOverflow?: Size;
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly textDirection?: ScrollbarTextDirection;
        readonly value?: number;
        readonly thumb?: Thumb;
    }): void;
}
export abstract class RangeSliderTickMarkShape {
    constructor() {
        captureDartType(this, applyDartType<RangeSliderTickMarkShape>(RangeSliderTickMarkShape, "RangeSliderTickMarkShape", [], []));
    }
    abstract getPreferredSize(options: {
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled?: boolean;
    }): Size;
    /**
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     */
    abstract paint(context: PaintingContext, center: Offset, options: {
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly enableAnimation: Animation<DartDouble>;
        readonly startThumbCenter: Offset;
        readonly endThumbCenter: Offset;
        readonly isEnabled?: boolean;
        readonly textDirection: ScrollbarTextDirection;
    }): void;
}
export abstract class RangeSliderTrackShape {
    constructor() {
        captureDartType(this, applyDartType<RangeSliderTrackShape>(RangeSliderTrackShape, "RangeSliderTrackShape", [], []));
    }
    abstract getPreferredRect(options: {
        readonly parentBox: RenderBox;
        readonly offset?: Offset;
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
    }): Rect;
    /**
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     */
    abstract paint(context: PaintingContext, offset: Offset, options: {
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly enableAnimation: Animation<DartDouble>;
        readonly startThumbCenter: Offset;
        readonly endThumbCenter: Offset;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
        readonly textDirection: ScrollbarTextDirection;
    }): void;
    get isRounded(): boolean {
        return false;
    }
}
const _dartTemporary0: Function[] = [];
export abstract class BaseRangeSliderTrackShape {
    abstract getPreferredRect(options: {
        readonly parentBox: RenderBox;
        readonly offset?: Offset;
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
    }): Rect;
    static [globalThis.Symbol.hasInstance](_dartTemporary1: unknown): boolean {
        return _dartTemporary0.some(_dartTemporary2 => hasCapturedDartType(_dartTemporary1, _dartTemporary2));
    }
    private constructor() {
        throw new TypeError("A source mixin cannot be instantiated");
    }
}
abstract class _MixinApplication_af140f3af22d07bf extends RangeSliderTrackShape implements BaseRangeSliderTrackShape {
    constructor() {
        super();
        captureDartType(this, applyDartType<_MixinApplication_af140f3af22d07bf>(_MixinApplication_af140f3af22d07bf, "_MixinApplication_af140f3af22d07bf", [], [applyDartType<RangeSliderTrackShape>(RangeSliderTrackShape, "RangeSliderTrackShape", [], []), applyDartType<BaseRangeSliderTrackShape>(BaseRangeSliderTrackShape, "BaseRangeSliderTrackShape", [], [])]));
        if (hasCapturedDartType(this, BaseRangeSliderTrackShape)) {
        }
        else {
            captureDartType(this, applyDartType<BaseRangeSliderTrackShape>(BaseRangeSliderTrackShape, "BaseRangeSliderTrackShape", [], []));
        }
    }
    getPreferredRect({ parentBox, offset = Offset.zero, sliderTheme, isEnabled = false, isDiscrete = false }: {
        readonly parentBox: RenderBox;
        readonly offset?: Offset;
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
    }): Rect {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.rangeThumbShape !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.overlayShape !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.trackHeight !== null, "generated-source-assert", "Pinned Dart assertion failed");
        const thumbSize: Size = (() => {
            const _dartTemporary3 = sliderTheme.rangeThumbShape;
            if (_dartTemporary3 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary3!;
        })().getPreferredSize(isEnabled, isDiscrete);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const overlayWidth: number = (() => {
            const _dartTemporary4 = sliderTheme.overlayShape;
            if (_dartTemporary4 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary4!;
        })().getPreferredSize(isEnabled, isDiscrete).width;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        let trackHeight: number = (() => {
            const _dartTemporary5 = sliderTheme.trackHeight;
            if (_dartTemporary5 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary5!;
        })();
        if (FoundationBuildMode.debug)
            invariant(overlayWidth >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(trackHeight >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if ((() => {
            const _dartTemporary6 = sliderTheme.activeTrackColor;
            const _dartTemporary7 = Colors.transparent;
            return _dartTemporary6 === null || _dartTemporary7 === null ? _dartTemporary6 === _dartTemporary7 : scrollbarValueEquals(_dartTemporary6, _dartTemporary7);
        })() && (() => {
            const _dartTemporary8 = sliderTheme.inactiveTrackColor;
            const _dartTemporary9 = Colors.transparent;
            return _dartTemporary8 === null || _dartTemporary9 === null ? _dartTemporary8 === _dartTemporary9 : scrollbarValueEquals(_dartTemporary8, _dartTemporary9);
        })()) {
            trackHeight = 0;
        }
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackLeft: number = castSourceDartDouble(sourceDartNumAdd(boxSourceDartDouble(offset.dx), (sliderTheme.padding === null ? sliderShapeMathMax(boxSourceDartDouble(overlayWidth / 2), boxSourceDartDouble(thumbSize.width / 2)) : (boxSourceDartDouble(thumbSize.width / 2)))));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackTop: number = offset.dy + (parentBox.size.height - trackHeight) / 2;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackRight: number = castSourceDartDouble(sourceDartNumSubtract(boxSourceDartDouble(trackLeft + parentBox.size.width), (sliderTheme.padding === null ? sliderShapeMathMax(boxSourceDartDouble(thumbSize.width), boxSourceDartDouble(overlayWidth)) : boxSourceDartDouble(thumbSize.width))));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackBottom: number = trackTop + trackHeight;
        return Rect.fromLTRB(castSourceDartDouble(sliderShapeMathMin(boxSourceDartDouble(trackLeft), boxSourceDartDouble(trackRight))), trackTop, castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(trackLeft), boxSourceDartDouble(trackRight))), trackBottom);
    }
}
_dartTemporary0.push(_MixinApplication_af140f3af22d07bf);
export class RectangularRangeSliderTrackShape extends _MixinApplication_af140f3af22d07bf {
    constructor() {
        super();
        captureDartType(this, applyDartType<RectangularRangeSliderTrackShape>(RectangularRangeSliderTrackShape, "RectangularRangeSliderTrackShape", [], [applyDartType<_MixinApplication_af140f3af22d07bf>(_MixinApplication_af140f3af22d07bf, "_MixinApplication_af140f3af22d07bf", [], [applyDartType<RangeSliderTrackShape>(RangeSliderTrackShape, "RangeSliderTrackShape", [], []), applyDartType<BaseRangeSliderTrackShape>(BaseRangeSliderTrackShape, "BaseRangeSliderTrackShape", [], [])])]));
    }
    /**
     * @dartParam enableAnimation Animation<double>?
     * @dartParamOrigin enableAnimation explicit
     */
    override paint(context: PaintingContext, offset: Offset, { parentBox, sliderTheme, enableAnimation, startThumbCenter, endThumbCenter, isEnabled = false, isDiscrete = false, textDirection }: {
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly enableAnimation: Animation<DartDouble> | null;
        readonly startThumbCenter: Offset;
        readonly endThumbCenter: Offset;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
        readonly textDirection: ScrollbarTextDirection;
    }): void {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledActiveTrackColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledInactiveTrackColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.activeTrackColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.inactiveTrackColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.rangeThumbShape !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(enableAnimation !== null, "generated-source-assert", "Pinned Dart assertion failed");
        const activeTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledActiveTrackColor, end: sliderTheme.activeTrackColor });
        const inactiveTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledInactiveTrackColor, end: sliderTheme.inactiveTrackColor });
        const activePaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary10 = new ScrollbarSourcePaint();
            _dartTemporary10.sourceColor = (() => {
                const _dartTemporary12 = sliderShapeTweenEvaluate(activeTrackColorTween, (() => {
                    const _dartTemporary11 = enableAnimation;
                    if (_dartTemporary11 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary11!;
                })());
                if (_dartTemporary12 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary12!;
            })();
            return _dartTemporary10;
        })();
        const inactivePaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary13 = new ScrollbarSourcePaint();
            _dartTemporary13.sourceColor = (() => {
                const _dartTemporary14 = sliderShapeTweenEvaluate(inactiveTrackColorTween, enableAnimation as Animation<DartDouble>);
                if (_dartTemporary14 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary14!;
            })();
            return _dartTemporary13;
        })();
        const _dartTemporary15 = (() => {
            const _dartTemporary16 = textDirection;
            switch (_dartTemporary16) {
                case "ltr": return dartRecord([startThumbCenter, endThumbCenter] as const);
                case "rtl": return dartRecord([endThumbCenter, startThumbCenter] as const);
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        const leftThumbOffset: Offset = dartRecordRead(_dartTemporary15, 0, 2);
        const rightThumbOffset: Offset = dartRecordRead(_dartTemporary15, 1, 2);
        const trackRect: Rect = this.getPreferredRect({ parentBox: parentBox, offset: offset, sliderTheme: sliderTheme, isEnabled: isEnabled, isDiscrete: isDiscrete });
        const leftTrackSegment: Rect = Rect.fromLTRB(trackRect.left, trackRect.top, leftThumbOffset.dx, trackRect.bottom);
        if (!leftTrackSegment.isEmpty) {
            context.canvas.drawRect(leftTrackSegment, inactivePaint);
        }
        const middleTrackSegment: Rect = Rect.fromLTRB(leftThumbOffset.dx, trackRect.top, rightThumbOffset.dx, trackRect.bottom);
        if (!middleTrackSegment.isEmpty) {
            context.canvas.drawRect(middleTrackSegment, activePaint);
        }
        const rightTrackSegment: Rect = Rect.fromLTRB(rightThumbOffset.dx, trackRect.top, trackRect.right, trackRect.bottom);
        if (!rightTrackSegment.isEmpty) {
            context.canvas.drawRect(rightTrackSegment, inactivePaint);
        }
    }
}
abstract class _MixinApplication_59ba9c6d1a7553dc extends RangeSliderTrackShape implements BaseRangeSliderTrackShape {
    constructor() {
        super();
        captureDartType(this, applyDartType<_MixinApplication_59ba9c6d1a7553dc>(_MixinApplication_59ba9c6d1a7553dc, "_MixinApplication_59ba9c6d1a7553dc", [], [applyDartType<RangeSliderTrackShape>(RangeSliderTrackShape, "RangeSliderTrackShape", [], []), applyDartType<BaseRangeSliderTrackShape>(BaseRangeSliderTrackShape, "BaseRangeSliderTrackShape", [], [])]));
        if (hasCapturedDartType(this, BaseRangeSliderTrackShape)) {
        }
        else {
            captureDartType(this, applyDartType<BaseRangeSliderTrackShape>(BaseRangeSliderTrackShape, "BaseRangeSliderTrackShape", [], []));
        }
    }
    getPreferredRect({ parentBox, offset = Offset.zero, sliderTheme, isEnabled = false, isDiscrete = false }: {
        readonly parentBox: RenderBox;
        readonly offset?: Offset;
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
    }): Rect {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.rangeThumbShape !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.overlayShape !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.trackHeight !== null, "generated-source-assert", "Pinned Dart assertion failed");
        const thumbSize: Size = (() => {
            const _dartTemporary17 = sliderTheme.rangeThumbShape;
            if (_dartTemporary17 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary17!;
        })().getPreferredSize(isEnabled, isDiscrete);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const overlayWidth: number = (() => {
            const _dartTemporary18 = sliderTheme.overlayShape;
            if (_dartTemporary18 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary18!;
        })().getPreferredSize(isEnabled, isDiscrete).width;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        let trackHeight: number = (() => {
            const _dartTemporary19 = sliderTheme.trackHeight;
            if (_dartTemporary19 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary19!;
        })();
        if (FoundationBuildMode.debug)
            invariant(overlayWidth >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(trackHeight >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if ((() => {
            const _dartTemporary20 = sliderTheme.activeTrackColor;
            const _dartTemporary21 = Colors.transparent;
            return _dartTemporary20 === null || _dartTemporary21 === null ? _dartTemporary20 === _dartTemporary21 : scrollbarValueEquals(_dartTemporary20, _dartTemporary21);
        })() && (() => {
            const _dartTemporary22 = sliderTheme.inactiveTrackColor;
            const _dartTemporary23 = Colors.transparent;
            return _dartTemporary22 === null || _dartTemporary23 === null ? _dartTemporary22 === _dartTemporary23 : scrollbarValueEquals(_dartTemporary22, _dartTemporary23);
        })()) {
            trackHeight = 0;
        }
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackLeft: number = castSourceDartDouble(sourceDartNumAdd(boxSourceDartDouble(offset.dx), (sliderTheme.padding === null ? sliderShapeMathMax(boxSourceDartDouble(overlayWidth / 2), boxSourceDartDouble(thumbSize.width / 2)) : (boxSourceDartDouble(thumbSize.width / 2)))));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackTop: number = offset.dy + (parentBox.size.height - trackHeight) / 2;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackRight: number = castSourceDartDouble(sourceDartNumSubtract(boxSourceDartDouble(trackLeft + parentBox.size.width), (sliderTheme.padding === null ? sliderShapeMathMax(boxSourceDartDouble(thumbSize.width), boxSourceDartDouble(overlayWidth)) : boxSourceDartDouble(thumbSize.width))));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackBottom: number = trackTop + trackHeight;
        return Rect.fromLTRB(castSourceDartDouble(sliderShapeMathMin(boxSourceDartDouble(trackLeft), boxSourceDartDouble(trackRight))), trackTop, castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(trackLeft), boxSourceDartDouble(trackRight))), trackBottom);
    }
}
_dartTemporary0.push(_MixinApplication_59ba9c6d1a7553dc);
export class RoundedRectRangeSliderTrackShape extends _MixinApplication_59ba9c6d1a7553dc {
    constructor() {
        super();
        captureDartType(this, applyDartType<RoundedRectRangeSliderTrackShape>(RoundedRectRangeSliderTrackShape, "RoundedRectRangeSliderTrackShape", [], [applyDartType<_MixinApplication_59ba9c6d1a7553dc>(_MixinApplication_59ba9c6d1a7553dc, "_MixinApplication_59ba9c6d1a7553dc", [], [applyDartType<RangeSliderTrackShape>(RangeSliderTrackShape, "RangeSliderTrackShape", [], []), applyDartType<BaseRangeSliderTrackShape>(BaseRangeSliderTrackShape, "BaseRangeSliderTrackShape", [], [])])]));
    }
    /**
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     * @dartParam additionalActiveTrackHeight double
     * @dartParamOrigin additionalActiveTrackHeight explicit
     */
    override paint(context: PaintingContext, offset: Offset, { parentBox, sliderTheme, enableAnimation, startThumbCenter, endThumbCenter, isEnabled = false, isDiscrete = false, textDirection, additionalActiveTrackHeight = 2 }: {
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly enableAnimation: Animation<DartDouble>;
        readonly startThumbCenter: Offset;
        readonly endThumbCenter: Offset;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
        readonly textDirection: ScrollbarTextDirection;
        readonly additionalActiveTrackHeight?: number;
    }): void {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledActiveTrackColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledInactiveTrackColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.activeTrackColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.inactiveTrackColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.rangeThumbShape !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (sliderTheme.trackHeight === null || (() => {
            const _dartTemporary24 = sliderTheme.trackHeight;
            if (_dartTemporary24 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary24!;
        })() <= 0) {
            return;
        }
        const activeTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledActiveTrackColor, end: sliderTheme.activeTrackColor });
        const inactiveTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledInactiveTrackColor, end: sliderTheme.inactiveTrackColor });
        const activePaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary25 = new ScrollbarSourcePaint();
            _dartTemporary25.sourceColor = (() => {
                const _dartTemporary26 = sliderShapeTweenEvaluate(activeTrackColorTween, enableAnimation);
                if (_dartTemporary26 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary26!;
            })();
            return _dartTemporary25;
        })();
        const inactivePaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary27 = new ScrollbarSourcePaint();
            _dartTemporary27.sourceColor = (() => {
                const _dartTemporary28 = sliderShapeTweenEvaluate(inactiveTrackColorTween, enableAnimation);
                if (_dartTemporary28 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary28!;
            })();
            return _dartTemporary27;
        })();
        const _dartTemporary29 = (() => {
            const _dartTemporary30 = textDirection;
            switch (_dartTemporary30) {
                case "ltr": return dartRecord([startThumbCenter, endThumbCenter] as const);
                case "rtl": return dartRecord([endThumbCenter, startThumbCenter] as const);
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        const leftThumbOffset: Offset = dartRecordRead(_dartTemporary29, 0, 2);
        const rightThumbOffset: Offset = dartRecordRead(_dartTemporary29, 1, 2);
        const thumbSize: Size = (() => {
            const _dartTemporary31 = sliderTheme.rangeThumbShape;
            if (_dartTemporary31 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary31!;
        })().getPreferredSize(isEnabled, isDiscrete);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const thumbRadius: number = thumbSize.width / 2;
        if (FoundationBuildMode.debug)
            invariant(thumbRadius > 0, "generated-source-assert", "Pinned Dart assertion failed");
        const trackRect: Rect = this.getPreferredRect({ parentBox: parentBox, offset: offset, sliderTheme: sliderTheme, isEnabled: isEnabled, isDiscrete: isDiscrete });
        const trackRadius: Radius = Radius.circular(trackRect.height / 2);
        context.canvas.drawRRect(RRect.fromLTRBAndCorners(trackRect.left, trackRect.top, leftThumbOffset.dx, trackRect.bottom, { topLeft: trackRadius, bottomLeft: trackRadius }), inactivePaint);
        context.canvas.drawRRect(RRect.fromLTRBAndCorners(rightThumbOffset.dx, trackRect.top, trackRect.right, trackRect.bottom, { topRight: trackRadius, bottomRight: trackRadius }), inactivePaint);
        context.canvas.drawRRect(RRect.fromLTRBR(leftThumbOffset.dx - ((() => {
            const _dartTemporary32 = sliderTheme.trackHeight;
            if (_dartTemporary32 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary32!;
        })() / 2), trackRect.top - (additionalActiveTrackHeight / 2), rightThumbOffset.dx + ((() => {
            const _dartTemporary33 = sliderTheme.trackHeight;
            if (_dartTemporary33 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary33!;
        })() / 2), trackRect.bottom + (additionalActiveTrackHeight / 2), trackRadius), activePaint);
    }
    override get isRounded(): boolean {
        return true;
    }
}
export class RoundRangeSliderTickMarkShape extends RangeSliderTickMarkShape {
    /**
     * @dartType double?
     * @dartTypeOrigin explicit
     */
    readonly tickMarkRadius: number | null;
    /**
     * @dartParam tickMarkRadius double?
     * @dartParamOrigin tickMarkRadius inferred
     */
    constructor({ tickMarkRadius = null }: {
        readonly tickMarkRadius?: number | null;
    } = {}) {
        /**
         * @dartType double?
         * @dartTypeOrigin inferred
         */
        const _initialField0 = tickMarkRadius;
        super();
        captureDartType(this, applyDartType<RoundRangeSliderTickMarkShape>(RoundRangeSliderTickMarkShape, "RoundRangeSliderTickMarkShape", [], [applyDartType<RangeSliderTickMarkShape>(RangeSliderTickMarkShape, "RangeSliderTickMarkShape", [], [])]));
        this.tickMarkRadius = _initialField0;
        protect(this, ["tickMarkRadius"]);
    }
    override getPreferredSize({ sliderTheme, isEnabled = false }: {
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled?: boolean;
    }): Size {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.trackHeight !== null, "generated-source-assert", "Pinned Dart assertion failed");
        return Size.fromRadius(this.tickMarkRadius ?? (() => {
            const _dartTemporary34 = sliderTheme.trackHeight;
            if (_dartTemporary34 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary34!;
        })() / 4);
    }
    /**
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     */
    override paint(context: PaintingContext, center: Offset, { parentBox, sliderTheme, enableAnimation, startThumbCenter, endThumbCenter, isEnabled = false, textDirection }: {
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly enableAnimation: Animation<DartDouble>;
        readonly startThumbCenter: Offset;
        readonly endThumbCenter: Offset;
        readonly isEnabled?: boolean;
        readonly textDirection: ScrollbarTextDirection;
    }): void {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledActiveTickMarkColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledInactiveTickMarkColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.activeTickMarkColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.inactiveTickMarkColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        const hasGap: boolean = sliderTheme.trackGap !== null && (() => {
            const _dartTemporary35 = sliderTheme.trackGap;
            if (_dartTemporary35 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary35!;
        })() > 0;
        const underThumb: boolean = startThumbCenter.dx === center.dx || endThumbCenter.dx === center.dx;
        if (hasGap && underThumb) {
            return;
        }
        const isBetweenThumbs: boolean = (() => {
            const _dartTemporary36 = textDirection;
            switch (_dartTemporary36) {
                case "ltr": return startThumbCenter.dx < center.dx && center.dx < endThumbCenter.dx;
                case "rtl": return endThumbCenter.dx < center.dx && center.dx < startThumbCenter.dx;
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        const begin: Color | null = isBetweenThumbs ? sliderTheme.disabledActiveTickMarkColor : sliderTheme.disabledInactiveTickMarkColor;
        const end: Color | null = isBetweenThumbs ? sliderTheme.activeTickMarkColor : sliderTheme.inactiveTickMarkColor;
        const paint: ScrollbarSourcePaint = (() => {
            const _dartTemporary37 = new ScrollbarSourcePaint();
            _dartTemporary37.sourceColor = (() => {
                const _dartTemporary38 = sliderShapeTweenEvaluate(new ColorTween({ begin: begin, end: end }), enableAnimation);
                if (_dartTemporary38 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary38!;
            })();
            return _dartTemporary37;
        })();
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const tickMarkRadius: number = this.getPreferredSize({ isEnabled: isEnabled, sliderTheme: sliderTheme }).width / 2;
        if (tickMarkRadius > 0) {
            context.canvas.drawCircle(center, tickMarkRadius, paint);
        }
    }
}
export class RoundRangeSliderThumbShape extends RangeSliderThumbShape {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly enabledThumbRadius: number;
    /**
     * @dartType double?
     * @dartTypeOrigin explicit
     */
    readonly disabledThumbRadius: number | null;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly elevation: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly pressedElevation: number;
    /**
     * @dartParam enabledThumbRadius double
     * @dartParamOrigin enabledThumbRadius inferred
     * @dartParam disabledThumbRadius double?
     * @dartParamOrigin disabledThumbRadius inferred
     * @dartParam elevation double
     * @dartParamOrigin elevation inferred
     * @dartParam pressedElevation double
     * @dartParamOrigin pressedElevation inferred
     */
    constructor({ enabledThumbRadius = 10, disabledThumbRadius = null, elevation = 1, pressedElevation = 6 }: {
        readonly enabledThumbRadius?: number;
        readonly disabledThumbRadius?: number | null;
        readonly elevation?: number;
        readonly pressedElevation?: number;
    } = {}) {
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField0 = enabledThumbRadius;
        /**
         * @dartType double?
         * @dartTypeOrigin inferred
         */
        const _initialField1 = disabledThumbRadius;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField2 = elevation;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField3 = pressedElevation;
        super();
        captureDartType(this, applyDartType<RoundRangeSliderThumbShape>(RoundRangeSliderThumbShape, "RoundRangeSliderThumbShape", [], [applyDartType<RangeSliderThumbShape>(RangeSliderThumbShape, "RangeSliderThumbShape", [], [])]));
        this.enabledThumbRadius = _initialField0;
        this.disabledThumbRadius = _initialField1;
        this.elevation = _initialField2;
        this.pressedElevation = _initialField3;
        protect(this, ["enabledThumbRadius", "disabledThumbRadius", "elevation", "pressedElevation"]);
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get _dart_1a96388ea076334f_disabledThumbRadius(): number {
        return this.disabledThumbRadius ?? this.enabledThumbRadius;
    }
    override getPreferredSize(isEnabled: boolean, isDiscrete: boolean): Size {
        return Size.fromRadius(isEnabled ? this.enabledThumbRadius : this._dart_1a96388ea076334f_disabledThumbRadius);
    }
    /**
     * @dartParam activationAnimation Animation<double>
     * @dartParamOrigin activationAnimation explicit
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     */
    override paint(context: PaintingContext, center: Offset, { activationAnimation, enableAnimation, isDiscrete = false, isEnabled = false, isOnTop = null, sliderTheme, textDirection = null, thumb = null, isPressed = null }: {
        readonly activationAnimation: Animation<DartDouble>;
        readonly enableAnimation: Animation<DartDouble>;
        readonly isDiscrete?: boolean;
        readonly isEnabled?: boolean;
        readonly isOnTop?: boolean | null;
        readonly sliderTheme: SliderThemeData;
        readonly textDirection?: ScrollbarTextDirection | null;
        readonly thumb?: Thumb | null;
        readonly isPressed?: boolean | null;
    }): void {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.showValueIndicator !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.overlappingShapeStrokeColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        const canvas: Canvas = context.canvas;
        /**
         * @dartType Tween<double>
         * @dartTypeOrigin inferred
         */
        const radiusTween: SliderShapeTween<DartDouble> = sliderShapeDoubleTween({ begin: boxSourceDartDouble(this._dart_1a96388ea076334f_disabledThumbRadius), end: boxSourceDartDouble(this.enabledThumbRadius) });
        const colorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledThumbColor, end: sliderTheme.thumbColor });
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const radius: number = castSourceDartDouble(sliderShapeTweenEvaluate(radiusTween, enableAnimation));
        /**
         * @dartType Tween<double>
         * @dartTypeOrigin inferred
         */
        const elevationTween: SliderShapeTween<DartDouble> = sliderShapeDoubleTween({ begin: boxSourceDartDouble(this.elevation), end: boxSourceDartDouble(this.pressedElevation) });
        if (isOnTop ?? false) {
            const strokePaint: ScrollbarSourcePaint = (() => {
                const _dartTemporary39 = new ScrollbarSourcePaint();
                _dartTemporary39.sourceColor = (() => {
                    const _dartTemporary40 = sliderTheme.overlappingShapeStrokeColor;
                    if (_dartTemporary40 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary40!;
                })();
                _dartTemporary39.strokeWidth = 1;
                _dartTemporary39.style = "stroke";
                return _dartTemporary39;
            })();
            canvas.drawCircle(center, radius, strokePaint);
        }
        const color: Color = (() => {
            const _dartTemporary41 = sliderShapeTweenEvaluate(colorTween, enableAnimation);
            if (_dartTemporary41 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary41!;
        })();
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const evaluatedElevation: number = (() => {
            const _dartTemporary42 = isPressed;
            if (_dartTemporary42 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary42!;
        })() ? castSourceDartDouble(sliderShapeTweenEvaluate(elevationTween, activationAnimation)) : this.elevation;
        const shadowPath: Path = (() => {
            const _dartTemporary43 = new Path();
            _dartTemporary43.addArc(Rect.fromCenter({ center: center, width: 2 * radius, height: 2 * radius }), 0, 3.141592653589793 * 2);
            return _dartTemporary43;
        })();
        let paintShadows: boolean = true;
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                if (sliderShapeDebugShadows()) {
                    _debugDrawShadow(canvas, shadowPath, evaluatedElevation);
                    paintShadows = false;
                }
                return true;
            })(), "generated-source-assert", "Pinned Dart assertion failed");
        if (paintShadows) {
            sliderShapeDrawShadow(canvas, shadowPath, Colors.black, evaluatedElevation, true);
        }
        canvas.drawCircle(center, radius, (() => {
            const _dartTemporary44 = new ScrollbarSourcePaint();
            _dartTemporary44.sourceColor = color;
            return _dartTemporary44;
        })());
    }
}
abstract class _MixinApplication_8f30846da95b5293 extends RangeSliderTrackShape implements BaseRangeSliderTrackShape {
    constructor() {
        super();
        captureDartType(this, applyDartType<_MixinApplication_8f30846da95b5293>(_MixinApplication_8f30846da95b5293, "_MixinApplication_8f30846da95b5293", [], [applyDartType<RangeSliderTrackShape>(RangeSliderTrackShape, "RangeSliderTrackShape", [], []), applyDartType<BaseRangeSliderTrackShape>(BaseRangeSliderTrackShape, "BaseRangeSliderTrackShape", [], [])]));
        if (hasCapturedDartType(this, BaseRangeSliderTrackShape)) {
        }
        else {
            captureDartType(this, applyDartType<BaseRangeSliderTrackShape>(BaseRangeSliderTrackShape, "BaseRangeSliderTrackShape", [], []));
        }
    }
    getPreferredRect({ parentBox, offset = Offset.zero, sliderTheme, isEnabled = false, isDiscrete = false }: {
        readonly parentBox: RenderBox;
        readonly offset?: Offset;
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
    }): Rect {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.rangeThumbShape !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.overlayShape !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.trackHeight !== null, "generated-source-assert", "Pinned Dart assertion failed");
        const thumbSize: Size = (() => {
            const _dartTemporary45 = sliderTheme.rangeThumbShape;
            if (_dartTemporary45 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary45!;
        })().getPreferredSize(isEnabled, isDiscrete);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const overlayWidth: number = (() => {
            const _dartTemporary46 = sliderTheme.overlayShape;
            if (_dartTemporary46 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary46!;
        })().getPreferredSize(isEnabled, isDiscrete).width;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        let trackHeight: number = (() => {
            const _dartTemporary47 = sliderTheme.trackHeight;
            if (_dartTemporary47 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary47!;
        })();
        if (FoundationBuildMode.debug)
            invariant(overlayWidth >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(trackHeight >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if ((() => {
            const _dartTemporary48 = sliderTheme.activeTrackColor;
            const _dartTemporary49 = Colors.transparent;
            return _dartTemporary48 === null || _dartTemporary49 === null ? _dartTemporary48 === _dartTemporary49 : scrollbarValueEquals(_dartTemporary48, _dartTemporary49);
        })() && (() => {
            const _dartTemporary50 = sliderTheme.inactiveTrackColor;
            const _dartTemporary51 = Colors.transparent;
            return _dartTemporary50 === null || _dartTemporary51 === null ? _dartTemporary50 === _dartTemporary51 : scrollbarValueEquals(_dartTemporary50, _dartTemporary51);
        })()) {
            trackHeight = 0;
        }
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackLeft: number = castSourceDartDouble(sourceDartNumAdd(boxSourceDartDouble(offset.dx), (sliderTheme.padding === null ? sliderShapeMathMax(boxSourceDartDouble(overlayWidth / 2), boxSourceDartDouble(thumbSize.width / 2)) : (boxSourceDartDouble(thumbSize.width / 2)))));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackTop: number = offset.dy + (parentBox.size.height - trackHeight) / 2;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackRight: number = castSourceDartDouble(sourceDartNumSubtract(boxSourceDartDouble(trackLeft + parentBox.size.width), (sliderTheme.padding === null ? sliderShapeMathMax(boxSourceDartDouble(thumbSize.width), boxSourceDartDouble(overlayWidth)) : boxSourceDartDouble(thumbSize.width))));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackBottom: number = trackTop + trackHeight;
        return Rect.fromLTRB(castSourceDartDouble(sliderShapeMathMin(boxSourceDartDouble(trackLeft), boxSourceDartDouble(trackRight))), trackTop, castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(trackLeft), boxSourceDartDouble(trackRight))), trackBottom);
    }
}
_dartTemporary0.push(_MixinApplication_8f30846da95b5293);
export class GappedRangeSliderTrackShape extends _MixinApplication_8f30846da95b5293 {
    constructor() {
        super();
        captureDartType(this, applyDartType<GappedRangeSliderTrackShape>(GappedRangeSliderTrackShape, "GappedRangeSliderTrackShape", [], [applyDartType<_MixinApplication_8f30846da95b5293>(_MixinApplication_8f30846da95b5293, "_MixinApplication_8f30846da95b5293", [], [applyDartType<RangeSliderTrackShape>(RangeSliderTrackShape, "RangeSliderTrackShape", [], []), applyDartType<BaseRangeSliderTrackShape>(BaseRangeSliderTrackShape, "BaseRangeSliderTrackShape", [], [])])]));
    }
    /**
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     * @dartParam additionalActiveTrackHeight double
     * @dartParamOrigin additionalActiveTrackHeight explicit
     */
    override paint(context: PaintingContext, offset: Offset, { parentBox, sliderTheme, enableAnimation, startThumbCenter, endThumbCenter, isEnabled = false, isDiscrete = false, textDirection, additionalActiveTrackHeight = 2 }: {
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly enableAnimation: Animation<DartDouble>;
        readonly startThumbCenter: Offset;
        readonly endThumbCenter: Offset;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
        readonly textDirection: ScrollbarTextDirection;
        readonly additionalActiveTrackHeight?: number;
    }): void {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledActiveTrackColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledInactiveTrackColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.activeTrackColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.inactiveTrackColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.rangeThumbShape !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (sliderTheme.trackHeight === null || (() => {
            const _dartTemporary52 = sliderTheme.trackHeight;
            if (_dartTemporary52 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary52!;
        })() <= 0) {
            return;
        }
        const activeTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledActiveTrackColor, end: sliderTheme.activeTrackColor });
        const inactiveTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledInactiveTrackColor, end: sliderTheme.inactiveTrackColor });
        const activePaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary53 = new ScrollbarSourcePaint();
            _dartTemporary53.sourceColor = (() => {
                const _dartTemporary54 = sliderShapeTweenEvaluate(activeTrackColorTween, enableAnimation);
                if (_dartTemporary54 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary54!;
            })();
            return _dartTemporary53;
        })();
        const inactivePaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary55 = new ScrollbarSourcePaint();
            _dartTemporary55.sourceColor = (() => {
                const _dartTemporary56 = sliderShapeTweenEvaluate(inactiveTrackColorTween, enableAnimation);
                if (_dartTemporary56 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary56!;
            })();
            return _dartTemporary55;
        })();
        const trackRect: Rect = this.getPreferredRect({ parentBox: parentBox, offset: offset, sliderTheme: sliderTheme, isEnabled: isEnabled, isDiscrete: isDiscrete });
        const trackCornerRadius: Radius = Radius.circular(trackRect.shortestSide / 2);
        const trackInsideCornerRadius: Radius = constSourceRadiusCircular(Radius, 2);
        const _dartTemporary57 = (() => {
            const _dartTemporary58 = textDirection;
            switch (_dartTemporary58) {
                case "ltr": return dartRecord([startThumbCenter, endThumbCenter] as const);
                case "rtl": return dartRecord([endThumbCenter, startThumbCenter] as const);
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        const leftThumbOffset: Offset = dartRecordRead(_dartTemporary57, 0, 2);
        const rightThumbOffset: Offset = dartRecordRead(_dartTemporary57, 1, 2);
        const thumbSize: Size = (() => {
            const _dartTemporary59 = sliderTheme.rangeThumbShape;
            if (_dartTemporary59 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary59!;
        })().getPreferredSize(isEnabled, isDiscrete);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const thumbRadius: number = thumbSize.width / 2;
        if (FoundationBuildMode.debug)
            invariant(thumbRadius > 0, "generated-source-assert", "Pinned Dart assertion failed");
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackGap: number = (() => {
            const _dartTemporary60 = sliderTheme.trackGap;
            if (_dartTemporary60 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary60!;
        })();
        const trackRRect: RRect = RRect.fromRectAndCorners(trackRect, { topLeft: trackCornerRadius, bottomLeft: trackCornerRadius, topRight: trackCornerRadius, bottomRight: trackCornerRadius });
        const leftRRect: RRect = RRect.fromLTRBAndCorners(trackRect.left, trackRect.top, leftThumbOffset.dx - trackGap, trackRect.bottom, { topLeft: trackCornerRadius, bottomLeft: trackCornerRadius, topRight: trackInsideCornerRadius, bottomRight: trackInsideCornerRadius });
        const rightRRect: RRect = RRect.fromLTRBAndCorners(rightThumbOffset.dx + trackGap, trackRect.top, trackRect.right, trackRect.bottom, { topLeft: trackInsideCornerRadius, bottomLeft: trackInsideCornerRadius, topRight: trackCornerRadius, bottomRight: trackCornerRadius });
        (() => {
            const _dartTemporary61 = context.canvas;
            _dartTemporary61.save();
            _dartTemporary61.clipRRect(trackRRect);
            return _dartTemporary61;
        })();
        const drawLeftTrack: boolean = startThumbCenter.dx > (leftRRect.left + ((() => {
            const _dartTemporary62 = sliderTheme.trackHeight;
            if (_dartTemporary62 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary62!;
        })() / 2));
        const drawRightTrack: boolean = endThumbCenter.dx < (rightRRect.right - ((() => {
            const _dartTemporary63 = sliderTheme.trackHeight;
            if (_dartTemporary63 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary63!;
        })() / 2));
        if (drawLeftTrack) {
            context.canvas.drawRRect(leftRRect, inactivePaint);
        }
        if (drawRightTrack) {
            context.canvas.drawRRect(rightRRect, inactivePaint);
        }
        if (leftThumbOffset.dx + trackGap < rightThumbOffset.dx - trackGap) {
            context.canvas.drawRRect(RRect.fromLTRBR(leftThumbOffset.dx + trackGap, trackRect.top, rightThumbOffset.dx - trackGap, trackRect.bottom, trackInsideCornerRadius), activePaint);
        }
        context.canvas.restore();
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const stopIndicatorRadius: number = 2;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const stopIndicatorTrailingSpace: number = (() => {
            const _dartTemporary64 = sliderTheme.trackHeight;
            if (_dartTemporary64 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary64!;
        })() / 2;
        const startStopIndicatorOffset: Offset = new Offset(trackRect.centerLeft.dx + stopIndicatorTrailingSpace, trackRect.center.dy);
        const endStopIndicatorOffset: Offset = new Offset(trackRect.centerRight.dx - stopIndicatorTrailingSpace, trackRect.center.dy);
        const showStartStopIndicator: boolean = startThumbCenter.dx > startStopIndicatorOffset.dx;
        if (showStartStopIndicator && !isDiscrete) {
            const stopIndicatorRect: Rect = Rect.fromCircle({ center: startStopIndicatorOffset, radius: stopIndicatorRadius });
            context.canvas.drawCircle(stopIndicatorRect.center, stopIndicatorRadius, activePaint);
        }
        const showEndStopIndicator: boolean = endThumbCenter.dx < endStopIndicatorOffset.dx;
        if (showEndStopIndicator && !isDiscrete) {
            const stopIndicatorRect: Rect = Rect.fromCircle({ center: endStopIndicatorOffset, radius: stopIndicatorRadius });
            context.canvas.drawCircle(stopIndicatorRect.center, stopIndicatorRadius, activePaint);
        }
    }
    override get isRounded(): boolean {
        return true;
    }
}
export class HandleRangeSliderThumbShape extends RangeSliderThumbShape {
    constructor() {
        super();
        captureDartType(this, applyDartType<HandleRangeSliderThumbShape>(HandleRangeSliderThumbShape, "HandleRangeSliderThumbShape", [], [applyDartType<RangeSliderThumbShape>(RangeSliderThumbShape, "RangeSliderThumbShape", [], [])]));
    }
    override getPreferredSize(isEnabled: boolean, isDiscrete: boolean): Size {
        return constSourceSize(Size, 4, 44);
    }
    /**
     * @dartParam activationAnimation Animation<double>
     * @dartParamOrigin activationAnimation explicit
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     */
    override paint(context: PaintingContext, center: Offset, { activationAnimation, enableAnimation, isDiscrete = false, isEnabled = false, isOnTop = null, sliderTheme, textDirection = null, thumb = null, isPressed = null }: {
        readonly activationAnimation: Animation<DartDouble>;
        readonly enableAnimation: Animation<DartDouble>;
        readonly isDiscrete?: boolean;
        readonly isEnabled?: boolean;
        readonly isOnTop?: boolean | null;
        readonly sliderTheme: SliderThemeData;
        readonly textDirection?: ScrollbarTextDirection | null;
        readonly thumb?: Thumb | null;
        readonly isPressed?: boolean | null;
    }): void {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.showValueIndicator !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.overlappingShapeStrokeColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledThumbColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.thumbColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.thumbSize !== null, "generated-source-assert", "Pinned Dart assertion failed");
        const colorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledThumbColor, end: sliderTheme.thumbColor });
        const color: Color = (() => {
            const _dartTemporary65 = sliderShapeTweenEvaluate(colorTween, enableAnimation);
            if (_dartTemporary65 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary65!;
        })();
        const canvas: Canvas = context.canvas;
        const thumbSize: Size = (() => {
            const _dartTemporary68 = (() => {
                const _dartTemporary67 = sliderTheme.thumbSize;
                if (_dartTemporary67 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary67!;
            })().resolve((() => {
                const _dartTemporary66 = emptyWidgetStateSet();
                return _dartTemporary66;
            })());
            if (_dartTemporary68 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary68!;
        })();
        const rrect: RRect = RRect.fromRectAndRadius(Rect.fromCenter({ center: center, width: thumbSize.width, height: thumbSize.height }), Radius.circular(thumbSize.shortestSide / 2));
        canvas.drawRRect(rrect, (() => {
            const _dartTemporary69 = new ScrollbarSourcePaint();
            _dartTemporary69.sourceColor = color;
            return _dartTemporary69;
        })());
    }
}
export class _RoundedRectSliderValueIndicatorPathPainter {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_labelPadding: number = 10;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_preferredHeight: number = 32;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_minLabelWidth: number = 16;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_rectYOffset: number = 10;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_bottomTipYOffset: number = 16;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_preferredHalfHeight: number = _RoundedRectSliderValueIndicatorPathPainter._dart_1a96388ea076334f_preferredHeight / 2;
    constructor() {
        captureDartType(this, applyDartType<_RoundedRectSliderValueIndicatorPathPainter>(_RoundedRectSliderValueIndicatorPathPainter, "_RoundedRectSliderValueIndicatorPathPainter", [], []));
    }
    /**
     * @dartParam textScaleFactor double
     * @dartParamOrigin textScaleFactor explicit
     */
    getPreferredSize(labelPainter: TextPainter, textScaleFactor: number): Size {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const width: number = castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(_RoundedRectSliderValueIndicatorPathPainter._dart_1a96388ea076334f_minLabelWidth), boxSourceDartDouble(labelPainter.width))) + (_RoundedRectSliderValueIndicatorPathPainter._dart_1a96388ea076334f_labelPadding * 2) * textScaleFactor;
        return new Size(width, _RoundedRectSliderValueIndicatorPathPainter._dart_1a96388ea076334f_preferredHeight * textScaleFactor);
    }
    /**
     * @dartParam textScaleFactor double
     * @dartParamOrigin textScaleFactor explicit
     * @dartParam scale double
     * @dartParamOrigin scale explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    getHorizontalShift({ parentBox, center, labelPainter, textScaleFactor, sizeWithOverflow, scale }: {
        readonly parentBox: RenderBox;
        readonly center: Offset;
        readonly labelPainter: TextPainter;
        readonly textScaleFactor: number;
        readonly sizeWithOverflow: Size;
        readonly scale: number;
    }): number {
        if (FoundationBuildMode.debug)
            invariant(!sizeWithOverflow.isEmpty, "generated-source-assert", "Pinned Dart assertion failed");
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const edgePadding: number = 8;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const rectangleWidth: number = this._dart_1a96388ea076334f_upperRectangleWidth(labelPainter, scale);
        const globalCenter: Offset = scrollbarLocalToGlobal(parentBox, center);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const overflowLeft: number = castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(0), boxSourceDartDouble(rectangleWidth / 2 - globalCenter.dx + edgePadding)));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const overflowRight: number = castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(0), boxSourceDartDouble(rectangleWidth / 2 - (sizeWithOverflow.width - globalCenter.dx - edgePadding))));
        if (rectangleWidth < sizeWithOverflow.width) {
            return overflowLeft - overflowRight;
        }
        else if (overflowLeft - overflowRight > 0) {
            return overflowLeft - (edgePadding * textScaleFactor);
        }
        else {
            return -overflowRight + (edgePadding * textScaleFactor);
        }
    }
    /**
     * @dartParam scale double
     * @dartParamOrigin scale explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    _dart_1a96388ea076334f_upperRectangleWidth(labelPainter: TextPainter, scale: number): number {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const unscaledWidth: number = castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(_RoundedRectSliderValueIndicatorPathPainter._dart_1a96388ea076334f_minLabelWidth), boxSourceDartDouble(labelPainter.width))) + (_RoundedRectSliderValueIndicatorPathPainter._dart_1a96388ea076334f_labelPadding * 2);
        return unscaledWidth * scale;
    }
    /**
     * @dartParam scale double
     * @dartParamOrigin scale explicit
     * @dartParam textScaleFactor double
     * @dartParamOrigin textScaleFactor explicit
     */
    paint({ parentBox, canvas, center, scale, labelPainter, textScaleFactor, sizeWithOverflow, backgroundPaintColor, strokePaintColor = null }: {
        readonly parentBox: RenderBox;
        readonly canvas: Canvas;
        readonly center: Offset;
        readonly scale: number;
        readonly labelPainter: TextPainter;
        readonly textScaleFactor: number;
        readonly sizeWithOverflow: Size;
        readonly backgroundPaintColor: Color;
        readonly strokePaintColor?: Color | null;
    }): void {
        if (scale === 0) {
            return;
        }
        if (FoundationBuildMode.debug)
            invariant(!sizeWithOverflow.isEmpty, "generated-source-assert", "Pinned Dart assertion failed");
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const rectangleWidth: number = this._dart_1a96388ea076334f_upperRectangleWidth(labelPainter, scale);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const horizontalShift: number = this.getHorizontalShift({ parentBox: parentBox, center: center, labelPainter: labelPainter, textScaleFactor: textScaleFactor, sizeWithOverflow: sizeWithOverflow, scale: scale });
        const upperRect: Rect = Rect.fromLTWH(-rectangleWidth / 2 + horizontalShift, -_RoundedRectSliderValueIndicatorPathPainter._dart_1a96388ea076334f_rectYOffset - _RoundedRectSliderValueIndicatorPathPainter._dart_1a96388ea076334f_preferredHeight, rectangleWidth, _RoundedRectSliderValueIndicatorPathPainter._dart_1a96388ea076334f_preferredHeight);
        const fillPaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary70 = new ScrollbarSourcePaint();
            _dartTemporary70.sourceColor = backgroundPaintColor;
            return _dartTemporary70;
        })();
        canvas.save();
        canvas.translate(center.dx, center.dy - _RoundedRectSliderValueIndicatorPathPainter._dart_1a96388ea076334f_bottomTipYOffset);
        canvas.scale(scale, scale);
        const rrect: RRect = RRect.fromRectAndRadius(upperRect, Radius.circular(upperRect.height / 2));
        if (strokePaintColor !== null) {
            const strokePaint: ScrollbarSourcePaint = (() => {
                const _dartTemporary71 = new ScrollbarSourcePaint();
                _dartTemporary71.sourceColor = strokePaintColor as Color;
                _dartTemporary71.strokeWidth = 1;
                _dartTemporary71.style = "stroke";
                return _dartTemporary71;
            })();
            canvas.drawRRect(rrect, strokePaint);
        }
        canvas.drawRRect(rrect, fillPaint);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const bottomTipToUpperRectTranslateY: number = -_RoundedRectSliderValueIndicatorPathPainter._dart_1a96388ea076334f_preferredHalfHeight / 2 - upperRect.height;
        canvas.translate(0, bottomTipToUpperRectTranslateY);
        const boxCenter: Offset = new Offset(horizontalShift, upperRect.height / 2.3);
        const halfLabelPainterOffset: Offset = new Offset(labelPainter.width / 2, labelPainter.height / 2);
        const labelOffset: Offset = boxCenter.subtract(halfLabelPainterOffset);
        labelPainter.paint(canvas, labelOffset);
        canvas.restore();
    }
}
protect(_RoundedRectSliderValueIndicatorPathPainter, ["_dart_1a96388ea076334f_labelPadding", "_dart_1a96388ea076334f_preferredHeight", "_dart_1a96388ea076334f_minLabelWidth", "_dart_1a96388ea076334f_rectYOffset", "_dart_1a96388ea076334f_bottomTipYOffset", "_dart_1a96388ea076334f_preferredHalfHeight"]);
export class RoundedRectRangeSliderValueIndicatorShape extends RangeSliderValueIndicatorShape {
    static readonly _dart_1a96388ea076334f_pathPainter: _RoundedRectSliderValueIndicatorPathPainter = canonicalDartObject<_RoundedRectSliderValueIndicatorPathPainter>(_RoundedRectSliderValueIndicatorPathPainter, applyDartType<_RoundedRectSliderValueIndicatorPathPainter>(_RoundedRectSliderValueIndicatorPathPainter, "_RoundedRectSliderValueIndicatorPathPainter", [], []), [], () => new _RoundedRectSliderValueIndicatorPathPainter(), true);
    constructor() {
        super();
        captureDartType(this, applyDartType<RoundedRectRangeSliderValueIndicatorShape>(RoundedRectRangeSliderValueIndicatorShape, "RoundedRectRangeSliderValueIndicatorShape", [], [applyDartType<RangeSliderValueIndicatorShape>(RangeSliderValueIndicatorShape, "RangeSliderValueIndicatorShape", [], [])]));
    }
    /**
     * @dartParam textScaleFactor double?
     * @dartParamOrigin textScaleFactor explicit
     */
    override getPreferredSize(isEnabled: boolean, isDiscrete: boolean, { labelPainter = null, textScaleFactor = null }: {
        readonly labelPainter?: TextPainter | null;
        readonly textScaleFactor?: number | null;
    } = {}): Size {
        if (FoundationBuildMode.debug)
            invariant(labelPainter !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(textScaleFactor !== null && textScaleFactor as number >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        return RoundedRectRangeSliderValueIndicatorShape._dart_1a96388ea076334f_pathPainter.getPreferredSize((() => {
            const _dartTemporary72 = labelPainter;
            if (_dartTemporary72 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary72!;
        })(), (() => {
            const _dartTemporary73 = textScaleFactor;
            if (_dartTemporary73 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary73!;
        })());
    }
    /**
     * @dartParam activationAnimation Animation<double>
     * @dartParamOrigin activationAnimation explicit
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     * @dartParam textScaleFactor double?
     * @dartParamOrigin textScaleFactor explicit
     * @dartParam value double?
     * @dartParamOrigin value explicit
     */
    override paint(context: PaintingContext, center: Offset, { activationAnimation, enableAnimation, isDiscrete = null, isOnTop = null, labelPainter, textScaleFactor = null, sizeWithOverflow = null, parentBox, sliderTheme, textDirection = null, value = null, thumb = null }: {
        readonly activationAnimation: Animation<DartDouble>;
        readonly enableAnimation: Animation<DartDouble>;
        readonly isDiscrete?: boolean | null;
        readonly isOnTop?: boolean | null;
        readonly labelPainter: TextPainter;
        readonly textScaleFactor?: number | null;
        readonly sizeWithOverflow?: Size | null;
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly textDirection?: ScrollbarTextDirection | null;
        readonly value?: number | null;
        readonly thumb?: Thumb | null;
    }): void {
        if (FoundationBuildMode.debug)
            invariant(textScaleFactor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sizeWithOverflow !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.valueIndicatorColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        const canvas: Canvas = context.canvas;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const scale: number = castSourceDartDouble(sliderShapeAnimationValue(activationAnimation));
        RoundedRectRangeSliderValueIndicatorShape._dart_1a96388ea076334f_pathPainter.paint({ parentBox: parentBox, canvas: canvas, center: center, scale: scale, labelPainter: labelPainter, textScaleFactor: (() => {
                const _dartTemporary74 = textScaleFactor;
                if (_dartTemporary74 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary74!;
            })(), sizeWithOverflow: (() => {
                const _dartTemporary75 = sizeWithOverflow;
                if (_dartTemporary75 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary75!;
            })(), backgroundPaintColor: (() => {
                const _dartTemporary76 = sliderTheme.valueIndicatorColor;
                if (_dartTemporary76 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary76!;
            })(), strokePaintColor: (() => {
                const _dartTemporary77 = isOnTop;
                if (_dartTemporary77 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary77!;
            })() ? sliderTheme.overlappingShapeStrokeColor : sliderTheme.valueIndicatorStrokeColor });
    }
}
protect(RoundedRectRangeSliderValueIndicatorShape, ["_dart_1a96388ea076334f_pathPainter"]);
export class _DropSliderValueIndicatorPathPainter {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_triangleHeight: number = 10;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_labelPadding: number = 8;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_preferredHeight: number = 32;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_minLabelWidth: number = 20;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_minRectHeight: number = 28;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_rectYOffset: number = 6;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_bottomTipYOffset: number = 16;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_preferredHalfHeight: number = _DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_preferredHeight / 2;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_1a96388ea076334f_upperRectRadius: number = 4;
    constructor() {
        captureDartType(this, applyDartType<_DropSliderValueIndicatorPathPainter>(_DropSliderValueIndicatorPathPainter, "_DropSliderValueIndicatorPathPainter", [], []));
    }
    /**
     * @dartParam textScaleFactor double
     * @dartParamOrigin textScaleFactor explicit
     */
    getPreferredSize(labelPainter: TextPainter, textScaleFactor: number): Size {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const width: number = castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(_DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_minLabelWidth), boxSourceDartDouble(labelPainter.width))) + _DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_labelPadding * 2 * textScaleFactor;
        return new Size(width, _DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_preferredHeight * textScaleFactor);
    }
    /**
     * @dartParam textScaleFactor double
     * @dartParamOrigin textScaleFactor explicit
     * @dartParam scale double
     * @dartParamOrigin scale explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    getHorizontalShift({ parentBox, center, labelPainter, textScaleFactor, sizeWithOverflow, scale }: {
        readonly parentBox: RenderBox;
        readonly center: Offset;
        readonly labelPainter: TextPainter;
        readonly textScaleFactor: number;
        readonly sizeWithOverflow: Size;
        readonly scale: number;
    }): number {
        if (FoundationBuildMode.debug)
            invariant(!sizeWithOverflow.isEmpty, "generated-source-assert", "Pinned Dart assertion failed");
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const edgePadding: number = 8;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const rectangleWidth: number = this._dart_1a96388ea076334f_upperRectangleWidth(labelPainter, scale);
        const globalCenter: Offset = scrollbarLocalToGlobal(parentBox, center);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const overflowLeft: number = castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(0), boxSourceDartDouble(rectangleWidth / 2 - globalCenter.dx + edgePadding)));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const overflowRight: number = castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(0), boxSourceDartDouble(rectangleWidth / 2 - (sizeWithOverflow.width - globalCenter.dx - edgePadding))));
        if (rectangleWidth < sizeWithOverflow.width) {
            return overflowLeft - overflowRight;
        }
        else if (overflowLeft - overflowRight > 0) {
            return overflowLeft - (edgePadding * textScaleFactor);
        }
        else {
            return -overflowRight + (edgePadding * textScaleFactor);
        }
    }
    /**
     * @dartParam scale double
     * @dartParamOrigin scale explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    _dart_1a96388ea076334f_upperRectangleWidth(labelPainter: TextPainter, scale: number): number {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const unscaledWidth: number = castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(_DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_minLabelWidth), boxSourceDartDouble(labelPainter.width))) + _DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_labelPadding;
        return unscaledWidth * scale;
    }
    _dart_1a96388ea076334f_adjustBorderRadius(rect: Rect): BorderRadius {
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const rectness: number = 0;
        return (() => {
            const _dartTemporary78 = BorderRadius.lerp(sliderShapeConstBorderRadiusAll(BorderRadius, constSourceRadiusCircular(Radius, _DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_upperRectRadius)), BorderRadius.all(Radius.circular(rect.shortestSide / 2)), 1 - rectness);
            if (_dartTemporary78 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary78!;
        })();
    }
    /**
     * @dartParam scale double
     * @dartParamOrigin scale explicit
     * @dartParam textScaleFactor double
     * @dartParamOrigin textScaleFactor explicit
     */
    paint({ parentBox, canvas, center, scale, labelPainter, textScaleFactor, sizeWithOverflow, backgroundPaintColor, strokePaintColor = null }: {
        readonly parentBox: RenderBox;
        readonly canvas: Canvas;
        readonly center: Offset;
        readonly scale: number;
        readonly labelPainter: TextPainter;
        readonly textScaleFactor: number;
        readonly sizeWithOverflow: Size;
        readonly backgroundPaintColor: Color;
        readonly strokePaintColor?: Color | null;
    }): void {
        if (scale === 0) {
            return;
        }
        if (FoundationBuildMode.debug)
            invariant(!sizeWithOverflow.isEmpty, "generated-source-assert", "Pinned Dart assertion failed");
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const rectangleWidth: number = this._dart_1a96388ea076334f_upperRectangleWidth(labelPainter, scale);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const horizontalShift: number = this.getHorizontalShift({ parentBox: parentBox, center: center, labelPainter: labelPainter, textScaleFactor: textScaleFactor, sizeWithOverflow: sizeWithOverflow, scale: scale });
        const upperRect: Rect = Rect.fromLTWH(-rectangleWidth / 2 + horizontalShift, -_DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_rectYOffset - _DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_minRectHeight, rectangleWidth, _DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_minRectHeight);
        const fillPaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary79 = new ScrollbarSourcePaint();
            _dartTemporary79.sourceColor = backgroundPaintColor;
            return _dartTemporary79;
        })();
        canvas.save();
        canvas.translate(center.dx, center.dy - _DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_bottomTipYOffset);
        canvas.scale(scale, scale);
        const adjustedBorderRadius: BorderRadius = this._dart_1a96388ea076334f_adjustBorderRadius(upperRect);
        const borderRect: RRect = adjustedBorderRadius.resolve(labelPainter.textDirection).toRRect(upperRect);
        const trianglePath: Path = (() => {
            const _dartTemporary80 = new Path();
            _dartTemporary80.lineTo(-_DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_triangleHeight, -_DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_triangleHeight);
            _dartTemporary80.lineTo(_DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_triangleHeight, -_DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_triangleHeight);
            _dartTemporary80.close();
            return _dartTemporary80;
        })();
        trianglePath.addRRect(borderRect);
        if (strokePaintColor !== null) {
            const strokePaint: ScrollbarSourcePaint = (() => {
                const _dartTemporary81 = new ScrollbarSourcePaint();
                _dartTemporary81.sourceColor = strokePaintColor as Color;
                _dartTemporary81.strokeWidth = 1;
                _dartTemporary81.style = "stroke";
                return _dartTemporary81;
            })();
            canvas.drawPath(trianglePath, strokePaint);
        }
        canvas.drawPath(trianglePath, fillPaint);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const bottomTipToUpperRectTranslateY: number = -_DropSliderValueIndicatorPathPainter._dart_1a96388ea076334f_preferredHalfHeight / 2 - upperRect.height;
        canvas.translate(0, bottomTipToUpperRectTranslateY);
        const boxCenter: Offset = new Offset(horizontalShift, upperRect.height / 1.75);
        const halfLabelPainterOffset: Offset = new Offset(labelPainter.width / 2, labelPainter.height / 2);
        const labelOffset: Offset = boxCenter.subtract(halfLabelPainterOffset);
        labelPainter.paint(canvas, labelOffset);
        canvas.restore();
    }
}
protect(_DropSliderValueIndicatorPathPainter, ["_dart_1a96388ea076334f_triangleHeight", "_dart_1a96388ea076334f_labelPadding", "_dart_1a96388ea076334f_preferredHeight", "_dart_1a96388ea076334f_minLabelWidth", "_dart_1a96388ea076334f_minRectHeight", "_dart_1a96388ea076334f_rectYOffset", "_dart_1a96388ea076334f_bottomTipYOffset", "_dart_1a96388ea076334f_preferredHalfHeight", "_dart_1a96388ea076334f_upperRectRadius"]);
export class DropRangeSliderValueIndicatorShape extends RangeSliderValueIndicatorShape {
    static readonly _dart_1a96388ea076334f_pathPainter: _DropSliderValueIndicatorPathPainter = canonicalDartObject<_DropSliderValueIndicatorPathPainter>(_DropSliderValueIndicatorPathPainter, applyDartType<_DropSliderValueIndicatorPathPainter>(_DropSliderValueIndicatorPathPainter, "_DropSliderValueIndicatorPathPainter", [], []), [], () => new _DropSliderValueIndicatorPathPainter(), true);
    constructor() {
        super();
        captureDartType(this, applyDartType<DropRangeSliderValueIndicatorShape>(DropRangeSliderValueIndicatorShape, "DropRangeSliderValueIndicatorShape", [], [applyDartType<RangeSliderValueIndicatorShape>(RangeSliderValueIndicatorShape, "RangeSliderValueIndicatorShape", [], [])]));
    }
    /**
     * @dartParam textScaleFactor double?
     * @dartParamOrigin textScaleFactor explicit
     */
    override getPreferredSize(isEnabled: boolean, isDiscrete: boolean, { labelPainter = null, textScaleFactor = null }: {
        readonly labelPainter?: TextPainter | null;
        readonly textScaleFactor?: number | null;
    } = {}): Size {
        if (FoundationBuildMode.debug)
            invariant(labelPainter !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(textScaleFactor !== null && textScaleFactor as number >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        return DropRangeSliderValueIndicatorShape._dart_1a96388ea076334f_pathPainter.getPreferredSize((() => {
            const _dartTemporary82 = labelPainter;
            if (_dartTemporary82 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary82!;
        })(), (() => {
            const _dartTemporary83 = textScaleFactor;
            if (_dartTemporary83 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary83!;
        })());
    }
    /**
     * @dartParam activationAnimation Animation<double>
     * @dartParamOrigin activationAnimation explicit
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     * @dartParam textScaleFactor double?
     * @dartParamOrigin textScaleFactor explicit
     * @dartParam value double?
     * @dartParamOrigin value explicit
     */
    override paint(context: PaintingContext, center: Offset, { activationAnimation, enableAnimation, isDiscrete = null, isOnTop = null, labelPainter, textScaleFactor = null, sizeWithOverflow = null, parentBox, sliderTheme, textDirection = null, value = null, thumb = null }: {
        readonly activationAnimation: Animation<DartDouble>;
        readonly enableAnimation: Animation<DartDouble>;
        readonly isDiscrete?: boolean | null;
        readonly isOnTop?: boolean | null;
        readonly labelPainter: TextPainter;
        readonly textScaleFactor?: number | null;
        readonly sizeWithOverflow?: Size | null;
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly textDirection?: ScrollbarTextDirection | null;
        readonly value?: number | null;
        readonly thumb?: Thumb | null;
    }): void {
        const canvas: Canvas = context.canvas;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const scale: number = castSourceDartDouble(sliderShapeAnimationValue(activationAnimation));
        DropRangeSliderValueIndicatorShape._dart_1a96388ea076334f_pathPainter.paint({ parentBox: parentBox, canvas: canvas, center: center, scale: scale, labelPainter: labelPainter, textScaleFactor: (() => {
                const _dartTemporary84 = textScaleFactor;
                if (_dartTemporary84 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary84!;
            })(), sizeWithOverflow: (() => {
                const _dartTemporary85 = sizeWithOverflow;
                if (_dartTemporary85 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary85!;
            })(), backgroundPaintColor: (() => {
                const _dartTemporary86 = sliderTheme.valueIndicatorColor;
                if (_dartTemporary86 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary86!;
            })(), strokePaintColor: (() => {
                const _dartTemporary87 = isOnTop;
                if (_dartTemporary87 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary87!;
            })() ? sliderTheme.overlappingShapeStrokeColor : sliderTheme.valueIndicatorStrokeColor });
    }
}
protect(DropRangeSliderValueIndicatorShape, ["_dart_1a96388ea076334f_pathPainter"]);
/**
 * @dartParam elevation double
 * @dartParamOrigin elevation explicit
 */
export function _debugDrawShadow(canvas: Canvas, path: Path, elevation: number): void {
    if (elevation > 0) {
        canvas.drawPath(path, (() => {
            const _dartTemporary88 = new ScrollbarSourcePaint();
            _dartTemporary88.sourceColor = Colors.black;
            _dartTemporary88.style = "stroke";
            _dartTemporary88.strokeWidth = elevation * 2;
            return _dartTemporary88;
        })());
    }
}

// Composed manual declarations: .tmp\work8\w11-material-shape-modules\range_slider_parts-witness.ts
export const rangeSliderValueIndicatorShapeType=applyDartType<RangeSliderValueIndicatorShape>(RangeSliderValueIndicatorShape,'RangeSliderValueIndicatorShape',[],[]);
