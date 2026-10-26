// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/slider_parts.dart; SHA256 979903ffb98a806de501088274cf8822b3a87cfaee79d794bac67143351cdbb8
import { protect } from "@nelyx/core/internal/ui/value-math";
import { invariant } from "@nelyx/core/foundation/errors";
import { FoundationBuildMode } from "@nelyx/core/foundation/constants";
import { dartStaticRead } from "@nelyx/core/internal/foundation/dart-static-field";
import { dartStaticSeal } from "@nelyx/core/internal/foundation/dart-static-field";
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
import { emptyWidgetStateSet } from "@nelyx/core/framework/widgets/widget-state";
import { applyDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { captureDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { scrollbarRawObjectEquals } from "@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter";
import { constSourceRadiusCircular } from "@nelyx/core/internal/ui/radius-source-adapter";
import { boxSourceDartInt } from "@nelyx/core/foundation/dart-numeric";
import { boxSourceDartDouble } from "@nelyx/core/internal/foundation/dart-numeric";
import { dartRecord } from "@nelyx/core/internal/foundation/dart-record";
import { dartRecordRead } from "@nelyx/core/internal/foundation/dart-record";
import { sliderShapeIsNegative } from "../../internal/slider/slider-shapes-source-adapter.ts";
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
import { Colors } from "../../colors.ts";
import { ColorTween } from "@nelyx/core/framework/animation/tween";
import { hasCapturedDartType } from "@nelyx/core/foundation/dart-type-witness";
import { SliderComponentShape } from "./slider-value-indicator-shape.generated.ts";
import { sliderComponentShapeType } from "./slider-value-indicator-shape.generated.ts";
import type { Animation } from "../../internal/slider/slider-shapes-source-adapter.ts";
import type { ScrollbarTextDirection } from "@nelyx/core/internal/framework/widgets/scrollbar-painter-source-adapter";
import type { DartDouble } from "@nelyx/core/foundation/dart-numeric";
import type { DartRecord } from "@nelyx/core/internal/foundation/dart-record";
import type { SliderShapeTween } from "../../internal/slider/slider-shapes-source-adapter.ts";
import type { SliderThemeData } from "../../slider-theme.ts";
export abstract class SliderTickMarkShape {
    static get noTickMark(): SliderTickMarkShape {
        return dartStaticRead<SliderTickMarkShape>(SliderTickMarkShape, "package:flutter/src/material/slider_parts.dart::SliderTickMarkShape.noTickMark:FIELD", (): SliderTickMarkShape => new _EmptySliderTickMarkShape());
    }
    constructor() {
        captureDartType(this, applyDartType<SliderTickMarkShape>(SliderTickMarkShape, "SliderTickMarkShape", [], []));
    }
    abstract getPreferredSize(options: {
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled: boolean;
    }): Size;
    /**
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     */
    abstract paint(context: PaintingContext, center: Offset, options: {
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly enableAnimation: Animation<DartDouble>;
        readonly thumbCenter: Offset;
        readonly isEnabled: boolean;
        readonly textDirection: ScrollbarTextDirection;
    }): void;
}
dartStaticSeal(SliderTickMarkShape, ["noTickMark"]);
export abstract class SliderTrackShape {
    constructor() {
        captureDartType(this, applyDartType<SliderTrackShape>(SliderTrackShape, "SliderTrackShape", [], []));
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
        readonly thumbCenter: Offset;
        readonly secondaryOffset?: Offset | null;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
        readonly textDirection: ScrollbarTextDirection;
    }): void;
    get isRounded(): boolean {
        return false;
    }
}
const _dartTemporary0: Function[] = [];
export abstract class BaseSliderTrackShape {
    abstract getPreferredRect(options: {
        readonly parentBox: RenderBox;
        readonly offset?: Offset;
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
    }): Rect;
    abstract get isRounded(): boolean;
    static [globalThis.Symbol.hasInstance](_dartTemporary1: unknown): boolean {
        return _dartTemporary0.some(_dartTemporary2 => hasCapturedDartType(_dartTemporary1, _dartTemporary2));
    }
    private constructor() {
        throw new TypeError("A source mixin cannot be instantiated");
    }
}
abstract class _MixinApplication_ef1f6d17e00cd8be extends SliderTrackShape implements BaseSliderTrackShape {
    constructor() {
        super();
        captureDartType(this, applyDartType<_MixinApplication_ef1f6d17e00cd8be>(_MixinApplication_ef1f6d17e00cd8be, "_MixinApplication_ef1f6d17e00cd8be", [], [applyDartType<SliderTrackShape>(SliderTrackShape, "SliderTrackShape", [], []), applyDartType<BaseSliderTrackShape>(BaseSliderTrackShape, "BaseSliderTrackShape", [], [])]));
        if (hasCapturedDartType(this, BaseSliderTrackShape)) {
        }
        else {
            captureDartType(this, applyDartType<BaseSliderTrackShape>(BaseSliderTrackShape, "BaseSliderTrackShape", [], []));
        }
    }
    getPreferredRect({ parentBox, offset = Offset.zero, sliderTheme, isEnabled = false, isDiscrete = false }: {
        readonly parentBox: RenderBox;
        readonly offset?: Offset;
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
    }): Rect {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const thumbWidth: number = (() => {
            const _dartTemporary3 = sliderTheme.thumbShape;
            if (_dartTemporary3 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary3!;
        })().getPreferredSize(isEnabled, isDiscrete).width;
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
        const trackLeft: number = castSourceDartDouble(sourceDartNumAdd(boxSourceDartDouble(offset.dx), (sliderTheme.padding === null ? sliderShapeMathMax(boxSourceDartDouble(overlayWidth / 2), boxSourceDartDouble(thumbWidth / 2)) : boxSourceDartInt(0))));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackTop: number = offset.dy + (parentBox.size.height - trackHeight) / 2;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackRight: number = castSourceDartDouble(sourceDartNumSubtract(boxSourceDartDouble(trackLeft + parentBox.size.width), (sliderTheme.padding === null ? sliderShapeMathMax(boxSourceDartDouble(thumbWidth), boxSourceDartDouble(overlayWidth)) : boxSourceDartInt(0))));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackBottom: number = trackTop + trackHeight;
        return Rect.fromLTRB(castSourceDartDouble(sliderShapeMathMin(boxSourceDartDouble(trackLeft), boxSourceDartDouble(trackRight))), trackTop, castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(trackLeft), boxSourceDartDouble(trackRight))), trackBottom);
    }
    get isRounded(): boolean {
        return false;
    }
}
_dartTemporary0.push(_MixinApplication_ef1f6d17e00cd8be);
export class RectangularSliderTrackShape extends _MixinApplication_ef1f6d17e00cd8be {
    constructor() {
        super();
        captureDartType(this, applyDartType<RectangularSliderTrackShape>(RectangularSliderTrackShape, "RectangularSliderTrackShape", [], [applyDartType<_MixinApplication_ef1f6d17e00cd8be>(_MixinApplication_ef1f6d17e00cd8be, "_MixinApplication_ef1f6d17e00cd8be", [], [applyDartType<SliderTrackShape>(SliderTrackShape, "SliderTrackShape", [], []), applyDartType<BaseSliderTrackShape>(BaseSliderTrackShape, "BaseSliderTrackShape", [], [])])]));
    }
    /**
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     */
    override paint(context: PaintingContext, offset: Offset, { parentBox, sliderTheme, enableAnimation, textDirection, thumbCenter, secondaryOffset = null, isDiscrete = false, isEnabled = false }: {
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly enableAnimation: Animation<DartDouble>;
        readonly textDirection: ScrollbarTextDirection;
        readonly thumbCenter: Offset;
        readonly secondaryOffset?: Offset | null;
        readonly isDiscrete?: boolean;
        readonly isEnabled?: boolean;
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
            invariant(sliderTheme.thumbShape !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if ((() => {
            const _dartTemporary10 = sliderTheme.trackHeight;
            if (_dartTemporary10 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary10!;
        })() <= 0) {
            return;
        }
        const activeTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledActiveTrackColor, end: sliderTheme.activeTrackColor });
        const inactiveTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledInactiveTrackColor, end: sliderTheme.inactiveTrackColor });
        const activePaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary11 = new ScrollbarSourcePaint();
            _dartTemporary11.sourceColor = (() => {
                const _dartTemporary12 = sliderShapeTweenEvaluate(activeTrackColorTween, enableAnimation);
                if (_dartTemporary12 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary12!;
            })();
            return _dartTemporary11;
        })();
        const inactivePaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary13 = new ScrollbarSourcePaint();
            _dartTemporary13.sourceColor = (() => {
                const _dartTemporary14 = sliderShapeTweenEvaluate(inactiveTrackColorTween, enableAnimation);
                if (_dartTemporary14 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary14!;
            })();
            return _dartTemporary13;
        })();
        const _dartTemporary15 = (() => {
            const _dartTemporary16 = textDirection;
            switch (_dartTemporary16) {
                case "ltr": return dartRecord([activePaint, inactivePaint] as const);
                case "rtl": return dartRecord([inactivePaint, activePaint] as const);
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        const leftTrackPaint: ScrollbarSourcePaint = dartRecordRead(_dartTemporary15, 0, 2);
        const rightTrackPaint: ScrollbarSourcePaint = dartRecordRead(_dartTemporary15, 1, 2);
        const trackRect: Rect = this.getPreferredRect({ parentBox: parentBox, offset: offset, sliderTheme: sliderTheme, isEnabled: isEnabled, isDiscrete: isDiscrete });
        const leftTrackSegment: Rect = Rect.fromLTRB(trackRect.left, trackRect.top, thumbCenter.dx, trackRect.bottom);
        if (!leftTrackSegment.isEmpty) {
            context.canvas.drawRect(leftTrackSegment, leftTrackPaint);
        }
        const rightTrackSegment: Rect = Rect.fromLTRB(thumbCenter.dx, trackRect.top, trackRect.right, trackRect.bottom);
        if (!rightTrackSegment.isEmpty) {
            context.canvas.drawRect(rightTrackSegment, rightTrackPaint);
        }
        const showSecondaryTrack: boolean = secondaryOffset !== null && (() => {
            const _dartTemporary17 = textDirection;
            switch (_dartTemporary17) {
                case "rtl": return (secondaryOffset as Offset).dx < thumbCenter.dx;
                case "ltr": return (secondaryOffset as Offset).dx > thumbCenter.dx;
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        if (showSecondaryTrack) {
            const secondaryTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledSecondaryActiveTrackColor, end: sliderTheme.secondaryActiveTrackColor });
            const secondaryTrackPaint: ScrollbarSourcePaint = (() => {
                const _dartTemporary18 = new ScrollbarSourcePaint();
                _dartTemporary18.sourceColor = (() => {
                    const _dartTemporary19 = sliderShapeTweenEvaluate(secondaryTrackColorTween, enableAnimation);
                    if (_dartTemporary19 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary19!;
                })();
                return _dartTemporary18;
            })();
            const secondaryTrackSegment: Rect = (() => {
                const _dartTemporary20 = textDirection;
                switch (_dartTemporary20) {
                    case "rtl": return Rect.fromLTRB((secondaryOffset as Offset).dx, trackRect.top, thumbCenter.dx, trackRect.bottom);
                    case "ltr": return Rect.fromLTRB(thumbCenter.dx, trackRect.top, (secondaryOffset as Offset).dx, trackRect.bottom);
                    default: throw new TypeError("Non-exhaustive Dart switch expression");
                }
            })();
            if (!secondaryTrackSegment.isEmpty) {
                context.canvas.drawRect(secondaryTrackSegment, secondaryTrackPaint);
            }
        }
    }
}
abstract class _MixinApplication_5b1ea75c0de1a30b extends SliderTrackShape implements BaseSliderTrackShape {
    constructor() {
        super();
        captureDartType(this, applyDartType<_MixinApplication_5b1ea75c0de1a30b>(_MixinApplication_5b1ea75c0de1a30b, "_MixinApplication_5b1ea75c0de1a30b", [], [applyDartType<SliderTrackShape>(SliderTrackShape, "SliderTrackShape", [], []), applyDartType<BaseSliderTrackShape>(BaseSliderTrackShape, "BaseSliderTrackShape", [], [])]));
        if (hasCapturedDartType(this, BaseSliderTrackShape)) {
        }
        else {
            captureDartType(this, applyDartType<BaseSliderTrackShape>(BaseSliderTrackShape, "BaseSliderTrackShape", [], []));
        }
    }
    getPreferredRect({ parentBox, offset = Offset.zero, sliderTheme, isEnabled = false, isDiscrete = false }: {
        readonly parentBox: RenderBox;
        readonly offset?: Offset;
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
    }): Rect {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const thumbWidth: number = (() => {
            const _dartTemporary21 = sliderTheme.thumbShape;
            if (_dartTemporary21 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary21!;
        })().getPreferredSize(isEnabled, isDiscrete).width;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const overlayWidth: number = (() => {
            const _dartTemporary22 = sliderTheme.overlayShape;
            if (_dartTemporary22 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary22!;
        })().getPreferredSize(isEnabled, isDiscrete).width;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        let trackHeight: number = (() => {
            const _dartTemporary23 = sliderTheme.trackHeight;
            if (_dartTemporary23 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary23!;
        })();
        if (FoundationBuildMode.debug)
            invariant(overlayWidth >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(trackHeight >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if ((() => {
            const _dartTemporary24 = sliderTheme.activeTrackColor;
            const _dartTemporary25 = Colors.transparent;
            return _dartTemporary24 === null || _dartTemporary25 === null ? _dartTemporary24 === _dartTemporary25 : scrollbarValueEquals(_dartTemporary24, _dartTemporary25);
        })() && (() => {
            const _dartTemporary26 = sliderTheme.inactiveTrackColor;
            const _dartTemporary27 = Colors.transparent;
            return _dartTemporary26 === null || _dartTemporary27 === null ? _dartTemporary26 === _dartTemporary27 : scrollbarValueEquals(_dartTemporary26, _dartTemporary27);
        })()) {
            trackHeight = 0;
        }
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackLeft: number = castSourceDartDouble(sourceDartNumAdd(boxSourceDartDouble(offset.dx), (sliderTheme.padding === null ? sliderShapeMathMax(boxSourceDartDouble(overlayWidth / 2), boxSourceDartDouble(thumbWidth / 2)) : boxSourceDartInt(0))));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackTop: number = offset.dy + (parentBox.size.height - trackHeight) / 2;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackRight: number = castSourceDartDouble(sourceDartNumSubtract(boxSourceDartDouble(trackLeft + parentBox.size.width), (sliderTheme.padding === null ? sliderShapeMathMax(boxSourceDartDouble(thumbWidth), boxSourceDartDouble(overlayWidth)) : boxSourceDartInt(0))));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackBottom: number = trackTop + trackHeight;
        return Rect.fromLTRB(castSourceDartDouble(sliderShapeMathMin(boxSourceDartDouble(trackLeft), boxSourceDartDouble(trackRight))), trackTop, castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(trackLeft), boxSourceDartDouble(trackRight))), trackBottom);
    }
    get isRounded(): boolean {
        return false;
    }
}
_dartTemporary0.push(_MixinApplication_5b1ea75c0de1a30b);
export class RoundedRectSliderTrackShape extends _MixinApplication_5b1ea75c0de1a30b {
    constructor() {
        super();
        captureDartType(this, applyDartType<RoundedRectSliderTrackShape>(RoundedRectSliderTrackShape, "RoundedRectSliderTrackShape", [], [applyDartType<_MixinApplication_5b1ea75c0de1a30b>(_MixinApplication_5b1ea75c0de1a30b, "_MixinApplication_5b1ea75c0de1a30b", [], [applyDartType<SliderTrackShape>(SliderTrackShape, "SliderTrackShape", [], []), applyDartType<BaseSliderTrackShape>(BaseSliderTrackShape, "BaseSliderTrackShape", [], [])])]));
    }
    /**
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     * @dartParam additionalActiveTrackHeight double
     * @dartParamOrigin additionalActiveTrackHeight explicit
     */
    override paint(context: PaintingContext, offset: Offset, { parentBox, sliderTheme, enableAnimation, textDirection, thumbCenter, secondaryOffset = null, isDiscrete = false, isEnabled = false, additionalActiveTrackHeight = 2 }: {
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly enableAnimation: Animation<DartDouble>;
        readonly textDirection: ScrollbarTextDirection;
        readonly thumbCenter: Offset;
        readonly secondaryOffset?: Offset | null;
        readonly isDiscrete?: boolean;
        readonly isEnabled?: boolean;
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
            invariant(sliderTheme.thumbShape !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (sliderTheme.trackHeight === null || (() => {
            const _dartTemporary28 = sliderTheme.trackHeight;
            if (_dartTemporary28 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary28!;
        })() <= 0) {
            return;
        }
        const activeTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledActiveTrackColor, end: sliderTheme.activeTrackColor });
        const inactiveTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledInactiveTrackColor, end: sliderTheme.inactiveTrackColor });
        const activePaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary29 = new ScrollbarSourcePaint();
            _dartTemporary29.sourceColor = (() => {
                const _dartTemporary30 = sliderShapeTweenEvaluate(activeTrackColorTween, enableAnimation);
                if (_dartTemporary30 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary30!;
            })();
            return _dartTemporary29;
        })();
        const inactivePaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary31 = new ScrollbarSourcePaint();
            _dartTemporary31.sourceColor = (() => {
                const _dartTemporary32 = sliderShapeTweenEvaluate(inactiveTrackColorTween, enableAnimation);
                if (_dartTemporary32 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary32!;
            })();
            return _dartTemporary31;
        })();
        const _dartTemporary33 = (() => {
            const _dartTemporary34 = textDirection;
            switch (_dartTemporary34) {
                case "ltr": return dartRecord([activePaint, inactivePaint] as const);
                case "rtl": return dartRecord([inactivePaint, activePaint] as const);
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        const leftTrackPaint: ScrollbarSourcePaint = dartRecordRead(_dartTemporary33, 0, 2);
        const rightTrackPaint: ScrollbarSourcePaint = dartRecordRead(_dartTemporary33, 1, 2);
        const trackRect: Rect = this.getPreferredRect({ parentBox: parentBox, offset: offset, sliderTheme: sliderTheme, isEnabled: isEnabled, isDiscrete: isDiscrete });
        const trackRadius: Radius = Radius.circular(trackRect.height / 2);
        const activeTrackRadius: Radius = Radius.circular((trackRect.height + additionalActiveTrackHeight) / 2);
        const isLTR: boolean = scrollbarRawObjectEquals(textDirection, "ltr");
        const isRTL: boolean = scrollbarRawObjectEquals(textDirection, "rtl");
        const drawInactiveTrack: boolean = thumbCenter.dx < (trackRect.right - ((() => {
            const _dartTemporary35 = sliderTheme.trackHeight;
            if (_dartTemporary35 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary35!;
        })() / 2));
        if (drawInactiveTrack) {
            context.canvas.drawRRect(RRect.fromLTRBR(thumbCenter.dx - ((() => {
                const _dartTemporary36 = sliderTheme.trackHeight;
                if (_dartTemporary36 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary36!;
            })() / 2), isRTL ? trackRect.top - (additionalActiveTrackHeight / 2) : trackRect.top, trackRect.right, isRTL ? trackRect.bottom + (additionalActiveTrackHeight / 2) : trackRect.bottom, isLTR ? trackRadius : activeTrackRadius), rightTrackPaint);
        }
        const drawActiveTrack: boolean = thumbCenter.dx > (trackRect.left + ((() => {
            const _dartTemporary37 = sliderTheme.trackHeight;
            if (_dartTemporary37 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary37!;
        })() / 2));
        if (drawActiveTrack) {
            context.canvas.drawRRect(RRect.fromLTRBR(trackRect.left, isLTR ? trackRect.top - (additionalActiveTrackHeight / 2) : trackRect.top, thumbCenter.dx + ((() => {
                const _dartTemporary38 = sliderTheme.trackHeight;
                if (_dartTemporary38 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary38!;
            })() / 2), isLTR ? trackRect.bottom + (additionalActiveTrackHeight / 2) : trackRect.bottom, isLTR ? activeTrackRadius : trackRadius), leftTrackPaint);
        }
        const showSecondaryTrack: boolean = (secondaryOffset !== null) && (isLTR ? ((secondaryOffset as Offset).dx > thumbCenter.dx) : ((secondaryOffset as Offset).dx < thumbCenter.dx));
        if (showSecondaryTrack) {
            const secondaryTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledSecondaryActiveTrackColor, end: sliderTheme.secondaryActiveTrackColor });
            const secondaryTrackPaint: ScrollbarSourcePaint = (() => {
                const _dartTemporary39 = new ScrollbarSourcePaint();
                _dartTemporary39.sourceColor = (() => {
                    const _dartTemporary40 = sliderShapeTweenEvaluate(secondaryTrackColorTween, enableAnimation);
                    if (_dartTemporary40 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary40!;
                })();
                return _dartTemporary39;
            })();
            if (isLTR) {
                context.canvas.drawRRect(RRect.fromLTRBAndCorners(thumbCenter.dx, trackRect.top, (secondaryOffset as Offset).dx, trackRect.bottom, { topRight: trackRadius, bottomRight: trackRadius }), secondaryTrackPaint);
            }
            else {
                context.canvas.drawRRect(RRect.fromLTRBAndCorners((secondaryOffset as Offset).dx, trackRect.top, thumbCenter.dx, trackRect.bottom, { topLeft: trackRadius, bottomLeft: trackRadius }), secondaryTrackPaint);
            }
        }
    }
    override get isRounded(): boolean {
        return true;
    }
}
export class RoundSliderTickMarkShape extends SliderTickMarkShape {
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
        captureDartType(this, applyDartType<RoundSliderTickMarkShape>(RoundSliderTickMarkShape, "RoundSliderTickMarkShape", [], [applyDartType<SliderTickMarkShape>(SliderTickMarkShape, "SliderTickMarkShape", [], [])]));
        this.tickMarkRadius = _initialField0;
        protect(this, ["tickMarkRadius"]);
    }
    override getPreferredSize({ sliderTheme, isEnabled }: {
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled: boolean;
    }): Size {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.trackHeight !== null, "generated-source-assert", "Pinned Dart assertion failed");
        return Size.fromRadius(this.tickMarkRadius ?? (() => {
            const _dartTemporary41 = sliderTheme.trackHeight;
            if (_dartTemporary41 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary41!;
        })() / 4);
    }
    /**
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     */
    override paint(context: PaintingContext, center: Offset, { parentBox, sliderTheme, enableAnimation, textDirection, thumbCenter, isEnabled }: {
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly enableAnimation: Animation<DartDouble>;
        readonly textDirection: ScrollbarTextDirection;
        readonly thumbCenter: Offset;
        readonly isEnabled: boolean;
    }): void {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledActiveTickMarkColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledInactiveTickMarkColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.activeTickMarkColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.inactiveTickMarkColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const xOffset: number = center.dx - thumbCenter.dx;
        const _dartTemporary42 = ((): DartRecord<[
            Color | null,
            Color | null
        ]> => {
            const _dartTemporary43 = textDirection;
            const _dartTemporary44 = (() => {
                if (!("ltr" === _dartTemporary43))
                    return null;
                if (!(xOffset > 0))
                    return null;
                return {};
            })();
            if (_dartTemporary44 !== null) {
                return dartRecord([sliderTheme.disabledInactiveTickMarkColor, sliderTheme.inactiveTickMarkColor] as const);
            }
            const _dartTemporary45 = (() => {
                if (!("rtl" === _dartTemporary43))
                    return null;
                if (!(xOffset < 0))
                    return null;
                return {};
            })();
            if (_dartTemporary45 !== null) {
                return dartRecord([sliderTheme.disabledInactiveTickMarkColor, sliderTheme.inactiveTickMarkColor] as const);
            }
            const _dartTemporary46 = (() => {
                if (!((() => {
                    if (!("ltr" === _dartTemporary43))
                        return null;
                    return {};
                })() !== null || (() => {
                    if (!("rtl" === _dartTemporary43))
                        return null;
                    return {};
                })() !== null))
                    return null;
                return {};
            })();
            if (_dartTemporary46 !== null) {
                return dartRecord([sliderTheme.disabledActiveTickMarkColor, sliderTheme.activeTickMarkColor] as const);
            }
            throw new TypeError("Non-exhaustive Dart pattern switch");
        })();
        const begin: Color | null = dartRecordRead(_dartTemporary42, 0, 2);
        const end: Color | null = dartRecordRead(_dartTemporary42, 1, 2);
        const paint: ScrollbarSourcePaint = (() => {
            const _dartTemporary47 = new ScrollbarSourcePaint();
            _dartTemporary47.sourceColor = (() => {
                const _dartTemporary48 = sliderShapeTweenEvaluate(new ColorTween({ begin: begin, end: end }), enableAnimation);
                if (_dartTemporary48 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary48!;
            })();
            return _dartTemporary47;
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
export class _EmptySliderTickMarkShape extends SliderTickMarkShape {
    constructor() {
        super();
        captureDartType(this, applyDartType<_EmptySliderTickMarkShape>(_EmptySliderTickMarkShape, "_EmptySliderTickMarkShape", [], [applyDartType<SliderTickMarkShape>(SliderTickMarkShape, "SliderTickMarkShape", [], [])]));
    }
    override getPreferredSize({ sliderTheme, isEnabled }: {
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled: boolean;
    }): Size {
        return Size.zero;
    }
    /**
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     */
    override paint(context: PaintingContext, center: Offset, { parentBox, sliderTheme, enableAnimation, thumbCenter, isEnabled, textDirection }: {
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly enableAnimation: Animation<DartDouble>;
        readonly thumbCenter: Offset;
        readonly isEnabled: boolean;
        readonly textDirection: ScrollbarTextDirection;
    }): void {
    }
}
export class RoundSliderThumbShape extends SliderComponentShape {
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
        captureDartType(this, applyDartType<RoundSliderThumbShape>(RoundSliderThumbShape, "RoundSliderThumbShape", [], [sliderComponentShapeType]));
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
    get _dart_866204def9702129_disabledThumbRadius(): number {
        return this.disabledThumbRadius ?? this.enabledThumbRadius;
    }
    override getPreferredSize(isEnabled: boolean, isDiscrete: boolean): Size {
        return Size.fromRadius(isEnabled ? this.enabledThumbRadius : this._dart_866204def9702129_disabledThumbRadius);
    }
    /**
     * @dartParam activationAnimation Animation<double>
     * @dartParamOrigin activationAnimation explicit
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     * @dartParam value double
     * @dartParamOrigin value explicit
     * @dartParam textScaleFactor double
     * @dartParamOrigin textScaleFactor explicit
     */
    override paint(context: PaintingContext, center: Offset, { activationAnimation, enableAnimation, isDiscrete, labelPainter, parentBox, sliderTheme, textDirection, value, textScaleFactor, sizeWithOverflow }: {
        readonly activationAnimation: Animation<DartDouble>;
        readonly enableAnimation: Animation<DartDouble>;
        readonly isDiscrete: boolean;
        readonly labelPainter: TextPainter;
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly textDirection: ScrollbarTextDirection;
        readonly value: number;
        readonly textScaleFactor: number;
        readonly sizeWithOverflow: Size;
    }): void {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledThumbColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.thumbColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        const canvas: Canvas = context.canvas;
        /**
         * @dartType Tween<double>
         * @dartTypeOrigin inferred
         */
        const radiusTween: SliderShapeTween<DartDouble> = sliderShapeDoubleTween({ begin: boxSourceDartDouble(this._dart_866204def9702129_disabledThumbRadius), end: boxSourceDartDouble(this.enabledThumbRadius) });
        const colorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledThumbColor, end: sliderTheme.thumbColor });
        const color: Color = (() => {
            const _dartTemporary49 = sliderShapeTweenEvaluate(colorTween, enableAnimation);
            if (_dartTemporary49 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary49!;
        })();
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
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const evaluatedElevation: number = castSourceDartDouble(sliderShapeTweenEvaluate(elevationTween, activationAnimation));
        const path: Path = (() => {
            const _dartTemporary50 = new Path();
            _dartTemporary50.addArc(Rect.fromCenter({ center: center, width: 2 * radius, height: 2 * radius }), 0, 3.141592653589793 * 2);
            return _dartTemporary50;
        })();
        let paintShadows: boolean = true;
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                if (sliderShapeDebugShadows()) {
                    _debugDrawShadow(canvas, path, evaluatedElevation);
                    paintShadows = false;
                }
                return true;
            })(), "generated-source-assert", "Pinned Dart assertion failed");
        if (paintShadows) {
            sliderShapeDrawShadow(canvas, path, Colors.black, evaluatedElevation, true);
        }
        canvas.drawCircle(center, radius, (() => {
            const _dartTemporary51 = new ScrollbarSourcePaint();
            _dartTemporary51.sourceColor = color;
            return _dartTemporary51;
        })());
    }
}
export class _DropSliderValueIndicatorPathPainter {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_triangleHeight: number = 10;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_labelPadding: number = 8;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_preferredHeight: number = 32;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_minLabelWidth: number = 20;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_minRectHeight: number = 28;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_rectYOffset: number = 6;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_bottomTipYOffset: number = 16;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_preferredHalfHeight: number = _DropSliderValueIndicatorPathPainter._dart_866204def9702129_preferredHeight / 2;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_upperRectRadius: number = 4;
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
        const width: number = castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(_DropSliderValueIndicatorPathPainter._dart_866204def9702129_minLabelWidth), boxSourceDartDouble(labelPainter.width))) + _DropSliderValueIndicatorPathPainter._dart_866204def9702129_labelPadding * 2 * textScaleFactor;
        return new Size(width, _DropSliderValueIndicatorPathPainter._dart_866204def9702129_preferredHeight * textScaleFactor);
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
        const rectangleWidth: number = this._dart_866204def9702129_upperRectangleWidth(labelPainter, scale);
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
    _dart_866204def9702129_upperRectangleWidth(labelPainter: TextPainter, scale: number): number {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const unscaledWidth: number = castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(_DropSliderValueIndicatorPathPainter._dart_866204def9702129_minLabelWidth), boxSourceDartDouble(labelPainter.width))) + _DropSliderValueIndicatorPathPainter._dart_866204def9702129_labelPadding;
        return unscaledWidth * scale;
    }
    _dart_866204def9702129_adjustBorderRadius(rect: Rect): BorderRadius {
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const rectness: number = 0;
        return (() => {
            const _dartTemporary52 = BorderRadius.lerp(sliderShapeConstBorderRadiusAll(BorderRadius, constSourceRadiusCircular(Radius, _DropSliderValueIndicatorPathPainter._dart_866204def9702129_upperRectRadius)), BorderRadius.all(Radius.circular(rect.shortestSide / 2)), 1 - rectness);
            if (_dartTemporary52 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary52!;
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
        const rectangleWidth: number = this._dart_866204def9702129_upperRectangleWidth(labelPainter, scale);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const horizontalShift: number = this.getHorizontalShift({ parentBox: parentBox, center: center, labelPainter: labelPainter, textScaleFactor: textScaleFactor, sizeWithOverflow: sizeWithOverflow, scale: scale });
        const upperRect: Rect = Rect.fromLTWH(-rectangleWidth / 2 + horizontalShift, -_DropSliderValueIndicatorPathPainter._dart_866204def9702129_rectYOffset - _DropSliderValueIndicatorPathPainter._dart_866204def9702129_minRectHeight, rectangleWidth, _DropSliderValueIndicatorPathPainter._dart_866204def9702129_minRectHeight);
        const fillPaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary53 = new ScrollbarSourcePaint();
            _dartTemporary53.sourceColor = backgroundPaintColor;
            return _dartTemporary53;
        })();
        canvas.save();
        canvas.translate(center.dx, center.dy - _DropSliderValueIndicatorPathPainter._dart_866204def9702129_bottomTipYOffset);
        canvas.scale(scale, scale);
        const adjustedBorderRadius: BorderRadius = this._dart_866204def9702129_adjustBorderRadius(upperRect);
        const borderRect: RRect = adjustedBorderRadius.resolve(labelPainter.textDirection).toRRect(upperRect);
        const trianglePath: Path = (() => {
            const _dartTemporary54 = new Path();
            _dartTemporary54.lineTo(-_DropSliderValueIndicatorPathPainter._dart_866204def9702129_triangleHeight, -_DropSliderValueIndicatorPathPainter._dart_866204def9702129_triangleHeight);
            _dartTemporary54.lineTo(_DropSliderValueIndicatorPathPainter._dart_866204def9702129_triangleHeight, -_DropSliderValueIndicatorPathPainter._dart_866204def9702129_triangleHeight);
            _dartTemporary54.close();
            return _dartTemporary54;
        })();
        trianglePath.addRRect(borderRect);
        if (strokePaintColor !== null) {
            const strokePaint: ScrollbarSourcePaint = (() => {
                const _dartTemporary55 = new ScrollbarSourcePaint();
                _dartTemporary55.sourceColor = strokePaintColor as Color;
                _dartTemporary55.strokeWidth = 1;
                _dartTemporary55.style = "stroke";
                return _dartTemporary55;
            })();
            canvas.drawPath(trianglePath, strokePaint);
        }
        canvas.drawPath(trianglePath, fillPaint);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const bottomTipToUpperRectTranslateY: number = -_DropSliderValueIndicatorPathPainter._dart_866204def9702129_preferredHalfHeight / 2 - upperRect.height;
        canvas.translate(0, bottomTipToUpperRectTranslateY);
        const boxCenter: Offset = new Offset(horizontalShift, upperRect.height / 1.75);
        const halfLabelPainterOffset: Offset = new Offset(labelPainter.width / 2, labelPainter.height / 2);
        const labelOffset: Offset = boxCenter.subtract(halfLabelPainterOffset);
        labelPainter.paint(canvas, labelOffset);
        canvas.restore();
    }
}
protect(_DropSliderValueIndicatorPathPainter, ["_dart_866204def9702129_triangleHeight", "_dart_866204def9702129_labelPadding", "_dart_866204def9702129_preferredHeight", "_dart_866204def9702129_minLabelWidth", "_dart_866204def9702129_minRectHeight", "_dart_866204def9702129_rectYOffset", "_dart_866204def9702129_bottomTipYOffset", "_dart_866204def9702129_preferredHalfHeight", "_dart_866204def9702129_upperRectRadius"]);
export class DropSliderValueIndicatorShape extends SliderComponentShape {
    static readonly _dart_866204def9702129_pathPainter: _DropSliderValueIndicatorPathPainter = canonicalDartObject<_DropSliderValueIndicatorPathPainter>(_DropSliderValueIndicatorPathPainter, applyDartType<_DropSliderValueIndicatorPathPainter>(_DropSliderValueIndicatorPathPainter, "_DropSliderValueIndicatorPathPainter", [], []), [], () => new _DropSliderValueIndicatorPathPainter(), true);
    constructor() {
        super();
        captureDartType(this, applyDartType<DropSliderValueIndicatorShape>(DropSliderValueIndicatorShape, "DropSliderValueIndicatorShape", [], [sliderComponentShapeType]));
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
        return DropSliderValueIndicatorShape._dart_866204def9702129_pathPainter.getPreferredSize((() => {
            const _dartTemporary56 = labelPainter;
            if (_dartTemporary56 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary56!;
        })(), (() => {
            const _dartTemporary57 = textScaleFactor;
            if (_dartTemporary57 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary57!;
        })());
    }
    /**
     * @dartParam activationAnimation Animation<double>
     * @dartParamOrigin activationAnimation explicit
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     * @dartParam value double
     * @dartParamOrigin value explicit
     * @dartParam textScaleFactor double
     * @dartParamOrigin textScaleFactor explicit
     */
    override paint(context: PaintingContext, center: Offset, { activationAnimation, enableAnimation, isDiscrete, labelPainter, parentBox, sliderTheme, textDirection, value, textScaleFactor, sizeWithOverflow }: {
        readonly activationAnimation: Animation<DartDouble>;
        readonly enableAnimation: Animation<DartDouble>;
        readonly isDiscrete: boolean;
        readonly labelPainter: TextPainter;
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly textDirection: ScrollbarTextDirection;
        readonly value: number;
        readonly textScaleFactor: number;
        readonly sizeWithOverflow: Size;
    }): void {
        const canvas: Canvas = context.canvas;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const scale: number = castSourceDartDouble(sliderShapeAnimationValue(activationAnimation));
        DropSliderValueIndicatorShape._dart_866204def9702129_pathPainter.paint({ parentBox: parentBox, canvas: canvas, center: center, scale: scale, labelPainter: labelPainter, textScaleFactor: textScaleFactor, sizeWithOverflow: sizeWithOverflow, backgroundPaintColor: (() => {
                const _dartTemporary58 = sliderTheme.valueIndicatorColor;
                if (_dartTemporary58 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary58!;
            })(), strokePaintColor: sliderTheme.valueIndicatorStrokeColor });
    }
}
protect(DropSliderValueIndicatorShape, ["_dart_866204def9702129_pathPainter"]);
export class HandleThumbShape extends SliderComponentShape {
    constructor() {
        super();
        captureDartType(this, applyDartType<HandleThumbShape>(HandleThumbShape, "HandleThumbShape", [], [sliderComponentShapeType]));
    }
    override getPreferredSize(isEnabled: boolean, isDiscrete: boolean): Size {
        return constSourceSize(Size, 4, 44);
    }
    /**
     * @dartParam activationAnimation Animation<double>
     * @dartParamOrigin activationAnimation explicit
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     * @dartParam value double
     * @dartParamOrigin value explicit
     * @dartParam textScaleFactor double
     * @dartParamOrigin textScaleFactor explicit
     */
    override paint(context: PaintingContext, center: Offset, { activationAnimation, enableAnimation, isDiscrete, labelPainter, parentBox, sliderTheme, textDirection, value, textScaleFactor, sizeWithOverflow }: {
        readonly activationAnimation: Animation<DartDouble>;
        readonly enableAnimation: Animation<DartDouble>;
        readonly isDiscrete: boolean;
        readonly labelPainter: TextPainter;
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly textDirection: ScrollbarTextDirection;
        readonly value: number;
        readonly textScaleFactor: number;
        readonly sizeWithOverflow: Size;
    }): void {
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.disabledThumbColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.thumbColor !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.thumbSize !== null, "generated-source-assert", "Pinned Dart assertion failed");
        const colorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledThumbColor, end: sliderTheme.thumbColor });
        const color: Color = (() => {
            const _dartTemporary59 = sliderShapeTweenEvaluate(colorTween, enableAnimation);
            if (_dartTemporary59 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary59!;
        })();
        const canvas: Canvas = context.canvas;
        const thumbSize: Size = (() => {
            const _dartTemporary62 = (() => {
                const _dartTemporary61 = sliderTheme.thumbSize;
                if (_dartTemporary61 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary61!;
            })().resolve((() => {
                const _dartTemporary60 = emptyWidgetStateSet();
                return _dartTemporary60;
            })());
            if (_dartTemporary62 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary62!;
        })();
        const rrect: RRect = RRect.fromRectAndRadius(Rect.fromCenter({ center: center, width: thumbSize.width, height: thumbSize.height }), Radius.circular(thumbSize.shortestSide / 2));
        canvas.drawRRect(rrect, (() => {
            const _dartTemporary63 = new ScrollbarSourcePaint();
            _dartTemporary63.sourceColor = color;
            return _dartTemporary63;
        })());
    }
}
abstract class _MixinApplication_6f14494c1741304d extends SliderTrackShape implements BaseSliderTrackShape {
    constructor() {
        super();
        captureDartType(this, applyDartType<_MixinApplication_6f14494c1741304d>(_MixinApplication_6f14494c1741304d, "_MixinApplication_6f14494c1741304d", [], [applyDartType<SliderTrackShape>(SliderTrackShape, "SliderTrackShape", [], []), applyDartType<BaseSliderTrackShape>(BaseSliderTrackShape, "BaseSliderTrackShape", [], [])]));
        if (hasCapturedDartType(this, BaseSliderTrackShape)) {
        }
        else {
            captureDartType(this, applyDartType<BaseSliderTrackShape>(BaseSliderTrackShape, "BaseSliderTrackShape", [], []));
        }
    }
    getPreferredRect({ parentBox, offset = Offset.zero, sliderTheme, isEnabled = false, isDiscrete = false }: {
        readonly parentBox: RenderBox;
        readonly offset?: Offset;
        readonly sliderTheme: SliderThemeData;
        readonly isEnabled?: boolean;
        readonly isDiscrete?: boolean;
    }): Rect {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const thumbWidth: number = (() => {
            const _dartTemporary64 = sliderTheme.thumbShape;
            if (_dartTemporary64 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary64!;
        })().getPreferredSize(isEnabled, isDiscrete).width;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const overlayWidth: number = (() => {
            const _dartTemporary65 = sliderTheme.overlayShape;
            if (_dartTemporary65 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary65!;
        })().getPreferredSize(isEnabled, isDiscrete).width;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        let trackHeight: number = (() => {
            const _dartTemporary66 = sliderTheme.trackHeight;
            if (_dartTemporary66 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary66!;
        })();
        if (FoundationBuildMode.debug)
            invariant(overlayWidth >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(trackHeight >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        if ((() => {
            const _dartTemporary67 = sliderTheme.activeTrackColor;
            const _dartTemporary68 = Colors.transparent;
            return _dartTemporary67 === null || _dartTemporary68 === null ? _dartTemporary67 === _dartTemporary68 : scrollbarValueEquals(_dartTemporary67, _dartTemporary68);
        })() && (() => {
            const _dartTemporary69 = sliderTheme.inactiveTrackColor;
            const _dartTemporary70 = Colors.transparent;
            return _dartTemporary69 === null || _dartTemporary70 === null ? _dartTemporary69 === _dartTemporary70 : scrollbarValueEquals(_dartTemporary69, _dartTemporary70);
        })()) {
            trackHeight = 0;
        }
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackLeft: number = castSourceDartDouble(sourceDartNumAdd(boxSourceDartDouble(offset.dx), (sliderTheme.padding === null ? sliderShapeMathMax(boxSourceDartDouble(overlayWidth / 2), boxSourceDartDouble(thumbWidth / 2)) : boxSourceDartInt(0))));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackTop: number = offset.dy + (parentBox.size.height - trackHeight) / 2;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackRight: number = castSourceDartDouble(sourceDartNumSubtract(boxSourceDartDouble(trackLeft + parentBox.size.width), (sliderTheme.padding === null ? sliderShapeMathMax(boxSourceDartDouble(thumbWidth), boxSourceDartDouble(overlayWidth)) : boxSourceDartInt(0))));
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackBottom: number = trackTop + trackHeight;
        return Rect.fromLTRB(castSourceDartDouble(sliderShapeMathMin(boxSourceDartDouble(trackLeft), boxSourceDartDouble(trackRight))), trackTop, castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(trackLeft), boxSourceDartDouble(trackRight))), trackBottom);
    }
    get isRounded(): boolean {
        return false;
    }
}
_dartTemporary0.push(_MixinApplication_6f14494c1741304d);
export class GappedSliderTrackShape extends _MixinApplication_6f14494c1741304d {
    constructor() {
        super();
        captureDartType(this, applyDartType<GappedSliderTrackShape>(GappedSliderTrackShape, "GappedSliderTrackShape", [], [applyDartType<_MixinApplication_6f14494c1741304d>(_MixinApplication_6f14494c1741304d, "_MixinApplication_6f14494c1741304d", [], [applyDartType<SliderTrackShape>(SliderTrackShape, "SliderTrackShape", [], []), applyDartType<BaseSliderTrackShape>(BaseSliderTrackShape, "BaseSliderTrackShape", [], [])])]));
    }
    /**
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     * @dartParam additionalActiveTrackHeight double
     * @dartParamOrigin additionalActiveTrackHeight explicit
     */
    override paint(context: PaintingContext, offset: Offset, { parentBox, sliderTheme, enableAnimation, textDirection, thumbCenter, secondaryOffset = null, isDiscrete = false, isEnabled = false, additionalActiveTrackHeight = 2 }: {
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly enableAnimation: Animation<DartDouble>;
        readonly textDirection: ScrollbarTextDirection;
        readonly thumbCenter: Offset;
        readonly secondaryOffset?: Offset | null;
        readonly isDiscrete?: boolean;
        readonly isEnabled?: boolean;
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
            invariant(sliderTheme.thumbShape !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(sliderTheme.trackGap !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(!sliderShapeIsNegative((() => {
                const _dartTemporary71 = sliderTheme.trackGap;
                if (_dartTemporary71 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary71!;
            })()), "generated-source-assert", "Pinned Dart assertion failed");
        if (sliderTheme.trackHeight === null || (() => {
            const _dartTemporary72 = sliderTheme.trackHeight;
            if (_dartTemporary72 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary72!;
        })() <= 0) {
            return;
        }
        const activeTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledActiveTrackColor, end: sliderTheme.activeTrackColor });
        const inactiveTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledInactiveTrackColor, end: sliderTheme.inactiveTrackColor });
        const activePaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary73 = new ScrollbarSourcePaint();
            _dartTemporary73.sourceColor = (() => {
                const _dartTemporary74 = sliderShapeTweenEvaluate(activeTrackColorTween, enableAnimation);
                if (_dartTemporary74 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary74!;
            })();
            return _dartTemporary73;
        })();
        const inactivePaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary75 = new ScrollbarSourcePaint();
            _dartTemporary75.sourceColor = (() => {
                const _dartTemporary76 = sliderShapeTweenEvaluate(inactiveTrackColorTween, enableAnimation);
                if (_dartTemporary76 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary76!;
            })();
            return _dartTemporary75;
        })();
        let leftTrackPaint: ScrollbarSourcePaint;
        let rightTrackPaint: ScrollbarSourcePaint;
        switch (textDirection) {
            case "ltr": {
                leftTrackPaint = activePaint;
                rightTrackPaint = inactivePaint;
                break;
            }
            case "rtl": {
                leftTrackPaint = inactivePaint;
                rightTrackPaint = activePaint;
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const trackGap: number = (() => {
            const _dartTemporary77 = sliderTheme.trackGap;
            if (_dartTemporary77 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary77!;
        })();
        const trackRect: Rect = this.getPreferredRect({ parentBox: parentBox, offset: offset, sliderTheme: sliderTheme, isEnabled: isEnabled, isDiscrete: isDiscrete });
        const trackCornerRadius: Radius = Radius.circular(trackRect.shortestSide / 2);
        const trackInsideCornerRadius: Radius = constSourceRadiusCircular(Radius, 2);
        const trackRRect: RRect = RRect.fromRectAndCorners(trackRect, { topLeft: trackCornerRadius, bottomLeft: trackCornerRadius, topRight: trackCornerRadius, bottomRight: trackCornerRadius });
        const leftRRect: RRect = RRect.fromLTRBAndCorners(trackRect.left, trackRect.top, castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(trackRect.left), boxSourceDartDouble(thumbCenter.dx - trackGap))), trackRect.bottom, { topLeft: trackCornerRadius, bottomLeft: trackCornerRadius, topRight: trackInsideCornerRadius, bottomRight: trackInsideCornerRadius });
        const rightRRect: RRect = RRect.fromLTRBAndCorners(thumbCenter.dx + trackGap, trackRect.top, trackRect.right, trackRect.bottom, { topRight: trackCornerRadius, bottomRight: trackCornerRadius, topLeft: trackInsideCornerRadius, bottomLeft: trackInsideCornerRadius });
        (() => {
            const _dartTemporary78 = context.canvas;
            _dartTemporary78.save();
            _dartTemporary78.clipRRect(trackRRect);
            return _dartTemporary78;
        })();
        const drawLeftTrack: boolean = thumbCenter.dx > (leftRRect.left + ((() => {
            const _dartTemporary79 = sliderTheme.trackHeight;
            if (_dartTemporary79 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary79!;
        })() / 2));
        const drawRightTrack: boolean = thumbCenter.dx < (rightRRect.right - ((() => {
            const _dartTemporary80 = sliderTheme.trackHeight;
            if (_dartTemporary80 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary80!;
        })() / 2));
        if (drawLeftTrack) {
            context.canvas.drawRRect(leftRRect, leftTrackPaint);
        }
        if (drawRightTrack) {
            context.canvas.drawRRect(rightRRect, rightTrackPaint);
        }
        const isLTR: boolean = scrollbarRawObjectEquals(textDirection, "ltr");
        const showSecondaryTrack: boolean = (secondaryOffset !== null) && (() => {
            const _dartTemporary81 = isLTR;
            switch (_dartTemporary81) {
                case true: return (secondaryOffset as Offset).dx > thumbCenter.dx + trackGap;
                case false: return (secondaryOffset as Offset).dx < thumbCenter.dx - trackGap;
                default: throw new TypeError("Non-exhaustive Dart switch expression");
            }
        })();
        if (showSecondaryTrack) {
            const secondaryTrackColorTween: ColorTween = new ColorTween({ begin: sliderTheme.disabledSecondaryActiveTrackColor, end: sliderTheme.secondaryActiveTrackColor });
            const secondaryTrackPaint: ScrollbarSourcePaint = (() => {
                const _dartTemporary82 = new ScrollbarSourcePaint();
                _dartTemporary82.sourceColor = (() => {
                    const _dartTemporary83 = sliderShapeTweenEvaluate(secondaryTrackColorTween, enableAnimation);
                    if (_dartTemporary83 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary83!;
                })();
                return _dartTemporary82;
            })();
            if (isLTR) {
                context.canvas.drawRRect(RRect.fromLTRBAndCorners(thumbCenter.dx + trackGap, trackRect.top, (secondaryOffset as Offset).dx, trackRect.bottom, { topLeft: trackInsideCornerRadius, bottomLeft: trackInsideCornerRadius, topRight: trackCornerRadius, bottomRight: trackCornerRadius }), secondaryTrackPaint);
            }
            else {
                context.canvas.drawRRect(RRect.fromLTRBAndCorners((secondaryOffset as Offset).dx - trackGap, trackRect.top, thumbCenter.dx, trackRect.bottom, { topLeft: trackInsideCornerRadius, bottomLeft: trackInsideCornerRadius, topRight: trackCornerRadius, bottomRight: trackCornerRadius }), secondaryTrackPaint);
            }
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
            const _dartTemporary84 = sliderTheme.trackHeight;
            if (_dartTemporary84 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary84!;
        })() / 2;
        const stopIndicatorOffset: Offset = new Offset((scrollbarRawObjectEquals(textDirection, "ltr")) ? trackRect.centerRight.dx - stopIndicatorTrailingSpace : trackRect.centerLeft.dx + stopIndicatorTrailingSpace, trackRect.center.dy);
        const showStopIndicator: boolean = (scrollbarRawObjectEquals(textDirection, "ltr")) ? thumbCenter.dx < stopIndicatorOffset.dx : thumbCenter.dx > stopIndicatorOffset.dx;
        if (showStopIndicator && !isDiscrete) {
            const stopIndicatorRect: Rect = Rect.fromCircle({ center: stopIndicatorOffset, radius: stopIndicatorRadius });
            context.canvas.drawCircle(stopIndicatorRect.center, stopIndicatorRadius, activePaint);
        }
    }
    override get isRounded(): boolean {
        return true;
    }
}
export class _RoundedRectSliderValueIndicatorPathPainter {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_labelPadding: number = 10;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_preferredHeight: number = 32;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_minLabelWidth: number = 16;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_rectYOffset: number = 10;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_bottomTipYOffset: number = 16;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    static readonly _dart_866204def9702129_preferredHalfHeight: number = _RoundedRectSliderValueIndicatorPathPainter._dart_866204def9702129_preferredHeight / 2;
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
        const width: number = castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(_RoundedRectSliderValueIndicatorPathPainter._dart_866204def9702129_minLabelWidth), boxSourceDartDouble(labelPainter.width))) + (_RoundedRectSliderValueIndicatorPathPainter._dart_866204def9702129_labelPadding * 2) * textScaleFactor;
        return new Size(width, _RoundedRectSliderValueIndicatorPathPainter._dart_866204def9702129_preferredHeight * textScaleFactor);
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
        const rectangleWidth: number = this._dart_866204def9702129_upperRectangleWidth(labelPainter, scale);
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
    _dart_866204def9702129_upperRectangleWidth(labelPainter: TextPainter, scale: number): number {
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const unscaledWidth: number = castSourceDartDouble(sliderShapeMathMax(boxSourceDartDouble(_RoundedRectSliderValueIndicatorPathPainter._dart_866204def9702129_minLabelWidth), boxSourceDartDouble(labelPainter.width))) + (_RoundedRectSliderValueIndicatorPathPainter._dart_866204def9702129_labelPadding * 2);
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
        const rectangleWidth: number = this._dart_866204def9702129_upperRectangleWidth(labelPainter, scale);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const horizontalShift: number = this.getHorizontalShift({ parentBox: parentBox, center: center, labelPainter: labelPainter, textScaleFactor: textScaleFactor, sizeWithOverflow: sizeWithOverflow, scale: scale });
        const upperRect: Rect = Rect.fromLTWH(-rectangleWidth / 2 + horizontalShift, -_RoundedRectSliderValueIndicatorPathPainter._dart_866204def9702129_rectYOffset - _RoundedRectSliderValueIndicatorPathPainter._dart_866204def9702129_preferredHeight, rectangleWidth, _RoundedRectSliderValueIndicatorPathPainter._dart_866204def9702129_preferredHeight);
        const fillPaint: ScrollbarSourcePaint = (() => {
            const _dartTemporary85 = new ScrollbarSourcePaint();
            _dartTemporary85.sourceColor = backgroundPaintColor;
            return _dartTemporary85;
        })();
        canvas.save();
        canvas.translate(center.dx, center.dy - _RoundedRectSliderValueIndicatorPathPainter._dart_866204def9702129_bottomTipYOffset);
        canvas.scale(scale, scale);
        const rrect: RRect = RRect.fromRectAndRadius(upperRect, Radius.circular(upperRect.height / 2));
        if (strokePaintColor !== null) {
            const strokePaint: ScrollbarSourcePaint = (() => {
                const _dartTemporary86 = new ScrollbarSourcePaint();
                _dartTemporary86.sourceColor = strokePaintColor as Color;
                _dartTemporary86.strokeWidth = 1;
                _dartTemporary86.style = "stroke";
                return _dartTemporary86;
            })();
            canvas.drawRRect(rrect, strokePaint);
        }
        canvas.drawRRect(rrect, fillPaint);
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const bottomTipToUpperRectTranslateY: number = -_RoundedRectSliderValueIndicatorPathPainter._dart_866204def9702129_preferredHalfHeight / 2 - upperRect.height;
        canvas.translate(0, bottomTipToUpperRectTranslateY);
        const boxCenter: Offset = new Offset(horizontalShift, upperRect.height / 2.3);
        const halfLabelPainterOffset: Offset = new Offset(labelPainter.width / 2, labelPainter.height / 2);
        const labelOffset: Offset = boxCenter.subtract(halfLabelPainterOffset);
        labelPainter.paint(canvas, labelOffset);
        canvas.restore();
    }
}
protect(_RoundedRectSliderValueIndicatorPathPainter, ["_dart_866204def9702129_labelPadding", "_dart_866204def9702129_preferredHeight", "_dart_866204def9702129_minLabelWidth", "_dart_866204def9702129_rectYOffset", "_dart_866204def9702129_bottomTipYOffset", "_dart_866204def9702129_preferredHalfHeight"]);
export class RoundedRectSliderValueIndicatorShape extends SliderComponentShape {
    static readonly _dart_866204def9702129_pathPainter: _RoundedRectSliderValueIndicatorPathPainter = canonicalDartObject<_RoundedRectSliderValueIndicatorPathPainter>(_RoundedRectSliderValueIndicatorPathPainter, applyDartType<_RoundedRectSliderValueIndicatorPathPainter>(_RoundedRectSliderValueIndicatorPathPainter, "_RoundedRectSliderValueIndicatorPathPainter", [], []), [], () => new _RoundedRectSliderValueIndicatorPathPainter(), true);
    constructor() {
        super();
        captureDartType(this, applyDartType<RoundedRectSliderValueIndicatorShape>(RoundedRectSliderValueIndicatorShape, "RoundedRectSliderValueIndicatorShape", [], [sliderComponentShapeType]));
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
        return RoundedRectSliderValueIndicatorShape._dart_866204def9702129_pathPainter.getPreferredSize((() => {
            const _dartTemporary87 = labelPainter;
            if (_dartTemporary87 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary87!;
        })(), (() => {
            const _dartTemporary88 = textScaleFactor;
            if (_dartTemporary88 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary88!;
        })());
    }
    /**
     * @dartParam activationAnimation Animation<double>
     * @dartParamOrigin activationAnimation explicit
     * @dartParam enableAnimation Animation<double>
     * @dartParamOrigin enableAnimation explicit
     * @dartParam value double
     * @dartParamOrigin value explicit
     * @dartParam textScaleFactor double
     * @dartParamOrigin textScaleFactor explicit
     */
    override paint(context: PaintingContext, center: Offset, { activationAnimation, enableAnimation, isDiscrete, labelPainter, parentBox, sliderTheme, textDirection, value, textScaleFactor, sizeWithOverflow }: {
        readonly activationAnimation: Animation<DartDouble>;
        readonly enableAnimation: Animation<DartDouble>;
        readonly isDiscrete: boolean;
        readonly labelPainter: TextPainter;
        readonly parentBox: RenderBox;
        readonly sliderTheme: SliderThemeData;
        readonly textDirection: ScrollbarTextDirection;
        readonly value: number;
        readonly textScaleFactor: number;
        readonly sizeWithOverflow: Size;
    }): void {
        const canvas: Canvas = context.canvas;
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const scale: number = castSourceDartDouble(sliderShapeAnimationValue(activationAnimation));
        RoundedRectSliderValueIndicatorShape._dart_866204def9702129_pathPainter.paint({ parentBox: parentBox, canvas: canvas, center: center, scale: scale, labelPainter: labelPainter, textScaleFactor: textScaleFactor, sizeWithOverflow: sizeWithOverflow, backgroundPaintColor: (() => {
                const _dartTemporary89 = sliderTheme.valueIndicatorColor;
                if (_dartTemporary89 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary89!;
            })(), strokePaintColor: sliderTheme.valueIndicatorStrokeColor });
    }
}
protect(RoundedRectSliderValueIndicatorShape, ["_dart_866204def9702129_pathPainter"]);
/**
 * @dartParam elevation double
 * @dartParamOrigin elevation explicit
 */
export function _debugDrawShadow(canvas: Canvas, path: Path, elevation: number): void {
    if (elevation > 0) {
        canvas.drawPath(path, (() => {
            const _dartTemporary90 = new ScrollbarSourcePaint();
            _dartTemporary90.sourceColor = Colors.black;
            _dartTemporary90.style = "stroke";
            _dartTemporary90.strokeWidth = elevation * 2;
            return _dartTemporary90;
        })());
    }
}
