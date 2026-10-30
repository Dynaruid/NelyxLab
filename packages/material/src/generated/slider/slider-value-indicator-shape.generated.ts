// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/slider_value_indicator_shape.dart; SHA256 1ad7bd327ccf1210d37832edb7c68340e854b7a168fad85fb1c7d73ffb2a343d
import { protect } from '@nelyx/core/internal/ui/value-math';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { dartStaticRead } from '@nelyx/core/internal/foundation/dart-static-field';
import { dartStaticSeal } from '@nelyx/core/internal/foundation/dart-static-field';
import { Color } from '@nelyx/core/ui/color';
import { Radius } from '@nelyx/core/ui/radius';
import { Canvas } from '@nelyx/core/ui/canvas';
import { Offset } from '@nelyx/core/ui/offset';
import { Size } from '@nelyx/core/ui/size';
import { Rect } from '@nelyx/core/ui/rect';
import { RRect } from '@nelyx/core/ui/rrect';
import { Path } from '@nelyx/core/ui/path';
import { clampDouble } from '@nelyx/core/ui/math';
import { ScrollbarSourcePaint } from '@nelyx/core/internal/framework/widgets/scrollbar-painter-source-adapter';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { castSourceDartDouble } from '@nelyx/core/foundation/dart-numeric';
import { scrollbarLocalToGlobal } from '@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter';
import { applyDartType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { captureDartType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { constSourceRadiusCircular } from '@nelyx/core/internal/ui/radius-source-adapter';
import { constSourceColor } from '@nelyx/core/internal/ui/color-source-adapter';
import { boxSourceDartInt } from '@nelyx/core/foundation/dart-numeric';
import { boxSourceDartDouble } from '@nelyx/core/internal/foundation/dart-numeric';
import { unwrapSourceDartNum } from '@nelyx/core/foundation/dart-numeric';
import { sourceDartNumSubtract } from '@nelyx/core/foundation/dart-numeric';
import { sliderShapeSqrt } from '../../internal/slider/slider-shapes-source-adapter.ts';
import { sliderShapeAtan } from '../../internal/slider/slider-shapes-source-adapter.ts';
import { sliderShapeCos } from '../../internal/slider/slider-shapes-source-adapter.ts';
import { sliderShapeMathPow } from '../../internal/slider/slider-shapes-source-adapter.ts';
import { constSourceOffset } from '@nelyx/core/ui/offset-source';
import { canonicalDartObject } from '@nelyx/core/internal/foundation/dart-const';
import { sliderShapeMathMax } from '../../internal/slider/slider-shapes-source-adapter.ts';
import { sliderShapeMathMin } from '../../internal/slider/slider-shapes-source-adapter.ts';
import { sliderShapeDoubleTween } from '../../internal/slider/slider-shapes-source-adapter.ts';
import { sliderShapeAnimationValue } from '../../internal/slider/slider-shapes-source-adapter.ts';
import { sliderShapeTweenEvaluate } from '../../internal/slider/slider-shapes-source-adapter.ts';
import { PaintingContext } from '@nelyx/core/framework/painting/context';
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { Thumb } from './slider-theme-values.generated.ts';
import { ColorTween } from '@nelyx/core/framework/animation/tween';
import { RangeSliderValueIndicatorShape } from './range-slider-parts.generated.ts';
import { rangeSliderValueIndicatorShapeType } from './range-slider-parts.generated.ts';
import type { Animation } from '../../internal/slider/slider-shapes-source-adapter.ts';
import type { ScrollbarTextDirection } from '@nelyx/core/internal/framework/widgets/scrollbar-painter-source-adapter';
import type { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import type { SliderShapeTween } from '../../internal/slider/slider-shapes-source-adapter.ts';
import type { SliderThemeData } from '../../slider-theme.ts';
export abstract class SliderComponentShape {
  static get noThumb(): SliderComponentShape {
    return dartStaticRead<SliderComponentShape>(
      SliderComponentShape,
      'package:flutter/src/material/slider_value_indicator_shape.dart::SliderComponentShape.noThumb:FIELD',
      (): SliderComponentShape => new _EmptySliderComponentShape(),
    );
  }
  static get noOverlay(): SliderComponentShape {
    return dartStaticRead<SliderComponentShape>(
      SliderComponentShape,
      'package:flutter/src/material/slider_value_indicator_shape.dart::SliderComponentShape.noOverlay:FIELD',
      (): SliderComponentShape => new _EmptySliderComponentShape(),
    );
  }
  constructor() {
    captureDartType(
      this,
      applyDartType<SliderComponentShape>(SliderComponentShape, 'SliderComponentShape', [], []),
    );
  }
  abstract getPreferredSize(isEnabled: boolean, isDiscrete: boolean): Size;
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
  abstract paint(
    context: PaintingContext,
    center: Offset,
    options: {
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
    },
  ): void;
}
dartStaticSeal(SliderComponentShape, ['noThumb', 'noOverlay']);
export class _EmptySliderComponentShape extends SliderComponentShape {
  constructor() {
    super();
    captureDartType(
      this,
      applyDartType<_EmptySliderComponentShape>(
        _EmptySliderComponentShape,
        '_EmptySliderComponentShape',
        [],
        [applyDartType<SliderComponentShape>(SliderComponentShape, 'SliderComponentShape', [], [])],
      ),
    );
  }
  override getPreferredSize(isEnabled: boolean, isDiscrete: boolean): Size {
    return Size.zero;
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
  override paint(
    context: PaintingContext,
    center: Offset,
    {
      activationAnimation,
      enableAnimation,
      isDiscrete,
      labelPainter,
      parentBox,
      sliderTheme,
      textDirection,
      value,
      textScaleFactor,
      sizeWithOverflow,
    }: {
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
    },
  ): void {}
}
export class RoundSliderOverlayShape extends SliderComponentShape {
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  readonly overlayRadius: number;
  /**
   * @dartParam overlayRadius double
   * @dartParamOrigin overlayRadius inferred
   */
  constructor({
    overlayRadius = 24,
  }: {
    readonly overlayRadius?: number;
  } = {}) {
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField0 = overlayRadius;
    super();
    captureDartType(
      this,
      applyDartType<RoundSliderOverlayShape>(
        RoundSliderOverlayShape,
        'RoundSliderOverlayShape',
        [],
        [applyDartType<SliderComponentShape>(SliderComponentShape, 'SliderComponentShape', [], [])],
      ),
    );
    this.overlayRadius = _initialField0;
    protect(this, ['overlayRadius']);
  }
  override getPreferredSize(isEnabled: boolean, isDiscrete: boolean): Size {
    return Size.fromRadius(this.overlayRadius);
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
  override paint(
    context: PaintingContext,
    center: Offset,
    {
      activationAnimation,
      enableAnimation,
      isDiscrete,
      labelPainter,
      parentBox,
      sliderTheme,
      textDirection,
      value,
      textScaleFactor,
      sizeWithOverflow,
    }: {
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
    },
  ): void {
    const canvas: Canvas = context.canvas;
    /**
     * @dartType Tween<double>
     * @dartTypeOrigin inferred
     */
    const radiusTween: SliderShapeTween<DartDouble> = sliderShapeDoubleTween({
      begin: boxSourceDartDouble(0),
      end: boxSourceDartDouble(this.overlayRadius),
    });
    canvas.drawCircle(
      center,
      castSourceDartDouble(sliderShapeTweenEvaluate(radiusTween, activationAnimation)),
      (() => {
        const _dartTemporary0 = new ScrollbarSourcePaint();
        _dartTemporary0.sourceColor = (() => {
          const _dartTemporary1 = sliderTheme.overlayColor;
          if (_dartTemporary1 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary1!;
        })();
        return _dartTemporary0;
      })(),
    );
  }
}
export class _RectangularSliderValueIndicatorPathPainter {
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_triangleHeight: number = 8;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_labelPadding: number = 16;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_preferredHeight: number = 32;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_minLabelWidth: number = 16;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_bottomTipYOffset: number = 14;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_preferredHalfHeight: number =
    _RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_preferredHeight / 2;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_upperRectRadius: number = 4;
  constructor() {
    captureDartType(
      this,
      applyDartType<_RectangularSliderValueIndicatorPathPainter>(
        _RectangularSliderValueIndicatorPathPainter,
        '_RectangularSliderValueIndicatorPathPainter',
        [],
        [],
      ),
    );
  }
  /**
   * @dartParam textScaleFactor double
   * @dartParamOrigin textScaleFactor explicit
   */
  getPreferredSize(labelPainter: TextPainter, textScaleFactor: number): Size {
    return new Size(
      this._dart_cce8a1855e0152c7_upperRectangleWidth(labelPainter, 1, textScaleFactor),
      labelPainter.height +
        _RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_labelPadding,
    );
  }
  /**
   * @dartParam textScaleFactor double
   * @dartParamOrigin textScaleFactor explicit
   * @dartParam scale double
   * @dartParamOrigin scale explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  getHorizontalShift({
    parentBox,
    center,
    labelPainter,
    textScaleFactor,
    sizeWithOverflow,
    scale,
  }: {
    readonly parentBox: RenderBox;
    readonly center: Offset;
    readonly labelPainter: TextPainter;
    readonly textScaleFactor: number;
    readonly sizeWithOverflow: Size;
    readonly scale: number;
  }): number {
    if (FoundationBuildMode.debug)
      invariant(
        !sizeWithOverflow.isEmpty,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const edgePadding: number = 8;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const rectangleWidth: number = this._dart_cce8a1855e0152c7_upperRectangleWidth(
      labelPainter,
      scale,
      textScaleFactor,
    );
    const globalCenter: Offset = scrollbarLocalToGlobal(parentBox, center);
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const overflowLeft: number = castSourceDartDouble(
      sliderShapeMathMax(
        boxSourceDartDouble(0),
        boxSourceDartDouble(rectangleWidth / 2 - globalCenter.dx + edgePadding),
      ),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const overflowRight: number = castSourceDartDouble(
      sliderShapeMathMax(
        boxSourceDartDouble(0),
        boxSourceDartDouble(
          rectangleWidth / 2 - (sizeWithOverflow.width - globalCenter.dx - edgePadding),
        ),
      ),
    );
    if (rectangleWidth < sizeWithOverflow.width) {
      return overflowLeft - overflowRight;
    } else if (overflowLeft - overflowRight > 0) {
      return overflowLeft - edgePadding * textScaleFactor;
    } else {
      return -overflowRight + edgePadding * textScaleFactor;
    }
  }
  /**
   * @dartParam scale double
   * @dartParamOrigin scale explicit
   * @dartParam textScaleFactor double
   * @dartParamOrigin textScaleFactor explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  _dart_cce8a1855e0152c7_upperRectangleWidth(
    labelPainter: TextPainter,
    scale: number,
    textScaleFactor: number,
  ): number {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const unscaledWidth: number =
      castSourceDartDouble(
        sliderShapeMathMax(
          boxSourceDartDouble(
            _RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_minLabelWidth *
              textScaleFactor,
          ),
          boxSourceDartDouble(labelPainter.width),
        ),
      ) +
      _RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_labelPadding * 2;
    return unscaledWidth * scale;
  }
  /**
   * @dartParam scale double
   * @dartParamOrigin scale explicit
   * @dartParam textScaleFactor double
   * @dartParamOrigin textScaleFactor explicit
   */
  paint({
    parentBox,
    canvas,
    center,
    scale,
    labelPainter,
    textScaleFactor,
    sizeWithOverflow,
    backgroundPaintColor,
    strokePaintColor = null,
  }: {
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
      invariant(
        !sizeWithOverflow.isEmpty,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const rectangleWidth: number = this._dart_cce8a1855e0152c7_upperRectangleWidth(
      labelPainter,
      scale,
      textScaleFactor,
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const horizontalShift: number = this.getHorizontalShift({
      parentBox: parentBox,
      center: center,
      labelPainter: labelPainter,
      textScaleFactor: textScaleFactor,
      sizeWithOverflow: sizeWithOverflow,
      scale: scale,
    });
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const rectHeight: number =
      labelPainter.height +
      _RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_labelPadding;
    const upperRect: Rect = Rect.fromLTWH(
      -rectangleWidth / 2 + horizontalShift,
      -_RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_triangleHeight -
        rectHeight,
      rectangleWidth,
      rectHeight,
    );
    const trianglePath: Path = (() => {
      const _dartTemporary2 = new Path();
      _dartTemporary2.lineTo(
        -_RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_triangleHeight,
        -_RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_triangleHeight,
      );
      _dartTemporary2.lineTo(
        _RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_triangleHeight,
        -_RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_triangleHeight,
      );
      _dartTemporary2.close();
      return _dartTemporary2;
    })();
    const fillPaint: ScrollbarSourcePaint = (() => {
      const _dartTemporary3 = new ScrollbarSourcePaint();
      _dartTemporary3.sourceColor = backgroundPaintColor;
      return _dartTemporary3;
    })();
    const upperRRect: RRect = RRect.fromRectAndRadius(
      upperRect,
      constSourceRadiusCircular(
        Radius,
        _RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_upperRectRadius,
      ),
    );
    trianglePath.addRRect(upperRRect);
    canvas.save();
    canvas.translate(
      center.dx,
      center.dy -
        _RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_bottomTipYOffset,
    );
    canvas.scale(scale, scale);
    if (strokePaintColor !== null) {
      const strokePaint: ScrollbarSourcePaint = (() => {
        const _dartTemporary4 = new ScrollbarSourcePaint();
        _dartTemporary4.sourceColor = strokePaintColor as Color;
        _dartTemporary4.strokeWidth = 1;
        _dartTemporary4.style = 'stroke';
        return _dartTemporary4;
      })();
      canvas.drawPath(trianglePath, strokePaint);
    }
    canvas.drawPath(trianglePath, fillPaint);
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const bottomTipToUpperRectTranslateY: number =
      -_RectangularSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_preferredHalfHeight / 2 -
      upperRect.height;
    canvas.translate(0, bottomTipToUpperRectTranslateY);
    const boxCenter: Offset = new Offset(horizontalShift, upperRect.height / 2);
    const halfLabelPainterOffset: Offset = new Offset(
      labelPainter.width / 2,
      labelPainter.height / 2,
    );
    const labelOffset: Offset = boxCenter.subtract(halfLabelPainterOffset);
    labelPainter.paint(canvas, labelOffset);
    canvas.restore();
  }
}
protect(_RectangularSliderValueIndicatorPathPainter, [
  '_dart_cce8a1855e0152c7_triangleHeight',
  '_dart_cce8a1855e0152c7_labelPadding',
  '_dart_cce8a1855e0152c7_preferredHeight',
  '_dart_cce8a1855e0152c7_minLabelWidth',
  '_dart_cce8a1855e0152c7_bottomTipYOffset',
  '_dart_cce8a1855e0152c7_preferredHalfHeight',
  '_dart_cce8a1855e0152c7_upperRectRadius',
]);
export class RectangularSliderValueIndicatorShape extends SliderComponentShape {
  static readonly _dart_cce8a1855e0152c7_pathPainter: _RectangularSliderValueIndicatorPathPainter =
    canonicalDartObject<_RectangularSliderValueIndicatorPathPainter>(
      _RectangularSliderValueIndicatorPathPainter,
      applyDartType<_RectangularSliderValueIndicatorPathPainter>(
        _RectangularSliderValueIndicatorPathPainter,
        '_RectangularSliderValueIndicatorPathPainter',
        [],
        [],
      ),
      [],
      () => new _RectangularSliderValueIndicatorPathPainter(),
      true,
    );
  constructor() {
    super();
    captureDartType(
      this,
      applyDartType<RectangularSliderValueIndicatorShape>(
        RectangularSliderValueIndicatorShape,
        'RectangularSliderValueIndicatorShape',
        [],
        [applyDartType<SliderComponentShape>(SliderComponentShape, 'SliderComponentShape', [], [])],
      ),
    );
  }
  /**
   * @dartParam textScaleFactor double?
   * @dartParamOrigin textScaleFactor explicit
   */
  override getPreferredSize(
    isEnabled: boolean,
    isDiscrete: boolean,
    {
      labelPainter = null,
      textScaleFactor = null,
    }: {
      readonly labelPainter?: TextPainter | null;
      readonly textScaleFactor?: number | null;
    } = {},
  ): Size {
    if (FoundationBuildMode.debug)
      invariant(labelPainter !== null, 'generated-source-assert', 'Pinned Dart assertion failed');
    if (FoundationBuildMode.debug)
      invariant(
        textScaleFactor !== null && (textScaleFactor as number) >= 0,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    return RectangularSliderValueIndicatorShape._dart_cce8a1855e0152c7_pathPainter.getPreferredSize(
      (() => {
        const _dartTemporary5 = labelPainter;
        if (_dartTemporary5 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary5!;
      })(),
      (() => {
        const _dartTemporary6 = textScaleFactor;
        if (_dartTemporary6 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary6!;
      })(),
    );
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
  override paint(
    context: PaintingContext,
    center: Offset,
    {
      activationAnimation,
      enableAnimation,
      isDiscrete,
      labelPainter,
      parentBox,
      sliderTheme,
      textDirection,
      value,
      textScaleFactor,
      sizeWithOverflow,
    }: {
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
    },
  ): void {
    const canvas: Canvas = context.canvas;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const scale: number = castSourceDartDouble(sliderShapeAnimationValue(activationAnimation));
    RectangularSliderValueIndicatorShape._dart_cce8a1855e0152c7_pathPainter.paint({
      parentBox: parentBox,
      canvas: canvas,
      center: center,
      scale: scale,
      labelPainter: labelPainter,
      textScaleFactor: textScaleFactor,
      sizeWithOverflow: sizeWithOverflow,
      backgroundPaintColor: (() => {
        const _dartTemporary7 = sliderTheme.valueIndicatorColor;
        if (_dartTemporary7 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary7!;
      })(),
      strokePaintColor: sliderTheme.valueIndicatorStrokeColor,
    });
  }
}
protect(RectangularSliderValueIndicatorShape, ['_dart_cce8a1855e0152c7_pathPainter']);
export class RectangularRangeSliderValueIndicatorShape extends RangeSliderValueIndicatorShape {
  static readonly _dart_cce8a1855e0152c7_pathPainter: _RectangularSliderValueIndicatorPathPainter =
    canonicalDartObject<_RectangularSliderValueIndicatorPathPainter>(
      _RectangularSliderValueIndicatorPathPainter,
      applyDartType<_RectangularSliderValueIndicatorPathPainter>(
        _RectangularSliderValueIndicatorPathPainter,
        '_RectangularSliderValueIndicatorPathPainter',
        [],
        [],
      ),
      [],
      () => new _RectangularSliderValueIndicatorPathPainter(),
      true,
    );
  constructor() {
    super();
    captureDartType(
      this,
      applyDartType<RectangularRangeSliderValueIndicatorShape>(
        RectangularRangeSliderValueIndicatorShape,
        'RectangularRangeSliderValueIndicatorShape',
        [],
        [rangeSliderValueIndicatorShapeType],
      ),
    );
  }
  /**
   * @dartParam textScaleFactor double
   * @dartParamOrigin textScaleFactor explicit
   */
  override getPreferredSize(
    isEnabled: boolean,
    isDiscrete: boolean,
    {
      labelPainter,
      textScaleFactor,
    }: {
      readonly labelPainter: TextPainter;
      readonly textScaleFactor: number;
    },
  ): Size {
    if (FoundationBuildMode.debug)
      invariant(textScaleFactor >= 0, 'generated-source-assert', 'Pinned Dart assertion failed');
    return RectangularRangeSliderValueIndicatorShape._dart_cce8a1855e0152c7_pathPainter.getPreferredSize(
      labelPainter,
      textScaleFactor,
    );
  }
  /**
   * @dartParam activationAnimation Animation<double>?
   * @dartParamOrigin activationAnimation explicit
   * @dartParam textScaleFactor double?
   * @dartParamOrigin textScaleFactor explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  override getHorizontalShift({
    parentBox = null,
    center = null,
    labelPainter = null,
    activationAnimation = null,
    textScaleFactor = null,
    sizeWithOverflow = null,
  }: {
    readonly parentBox?: RenderBox | null;
    readonly center?: Offset | null;
    readonly labelPainter?: TextPainter | null;
    readonly activationAnimation?: Animation<DartDouble> | null;
    readonly textScaleFactor?: number | null;
    readonly sizeWithOverflow?: Size | null;
  } = {}): number {
    return RectangularRangeSliderValueIndicatorShape._dart_cce8a1855e0152c7_pathPainter.getHorizontalShift(
      {
        parentBox: (() => {
          const _dartTemporary8 = parentBox;
          if (_dartTemporary8 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary8!;
        })(),
        center: (() => {
          const _dartTemporary9 = center;
          if (_dartTemporary9 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary9!;
        })(),
        labelPainter: (() => {
          const _dartTemporary10 = labelPainter;
          if (_dartTemporary10 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary10!;
        })(),
        textScaleFactor: (() => {
          const _dartTemporary11 = textScaleFactor;
          if (_dartTemporary11 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary11!;
        })(),
        sizeWithOverflow: (() => {
          const _dartTemporary12 = sizeWithOverflow;
          if (_dartTemporary12 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary12!;
        })(),
        scale: castSourceDartDouble(
          sliderShapeAnimationValue(
            (() => {
              const _dartTemporary13 = activationAnimation;
              if (_dartTemporary13 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary13!;
            })(),
          ),
        ),
      },
    );
  }
  /**
   * @dartParam activationAnimation Animation<double>?
   * @dartParamOrigin activationAnimation explicit
   * @dartParam enableAnimation Animation<double>?
   * @dartParamOrigin enableAnimation explicit
   * @dartParam textScaleFactor double?
   * @dartParamOrigin textScaleFactor explicit
   * @dartParam value double?
   * @dartParamOrigin value explicit
   */
  override paint(
    context: PaintingContext,
    center: Offset,
    {
      activationAnimation = null,
      enableAnimation = null,
      isDiscrete = null,
      isOnTop = null,
      labelPainter = null,
      textScaleFactor = null,
      sizeWithOverflow = null,
      parentBox = null,
      sliderTheme = null,
      textDirection = null,
      value = null,
      thumb = null,
    }: {
      readonly activationAnimation?: Animation<DartDouble> | null;
      readonly enableAnimation?: Animation<DartDouble> | null;
      readonly isDiscrete?: boolean | null;
      readonly isOnTop?: boolean | null;
      readonly labelPainter?: TextPainter | null;
      readonly textScaleFactor?: number | null;
      readonly sizeWithOverflow?: Size | null;
      readonly parentBox?: RenderBox | null;
      readonly sliderTheme?: SliderThemeData | null;
      readonly textDirection?: ScrollbarTextDirection | null;
      readonly value?: number | null;
      readonly thumb?: Thumb | null;
    } = {},
  ): void {
    const canvas: Canvas = context.canvas;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const scale: number = castSourceDartDouble(
      sliderShapeAnimationValue(
        (() => {
          const _dartTemporary14 = activationAnimation;
          if (_dartTemporary14 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary14!;
        })(),
      ),
    );
    RectangularRangeSliderValueIndicatorShape._dart_cce8a1855e0152c7_pathPainter.paint({
      parentBox: (() => {
        const _dartTemporary15 = parentBox;
        if (_dartTemporary15 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary15!;
      })(),
      canvas: canvas,
      center: center,
      scale: scale,
      labelPainter: (() => {
        const _dartTemporary16 = labelPainter;
        if (_dartTemporary16 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary16!;
      })(),
      textScaleFactor: (() => {
        const _dartTemporary17 = textScaleFactor;
        if (_dartTemporary17 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary17!;
      })(),
      sizeWithOverflow: (() => {
        const _dartTemporary18 = sizeWithOverflow;
        if (_dartTemporary18 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary18!;
      })(),
      backgroundPaintColor: (() => {
        const _dartTemporary20 = (() => {
          const _dartTemporary19 = sliderTheme;
          if (_dartTemporary19 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary19!;
        })().valueIndicatorColor;
        if (_dartTemporary20 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary20!;
      })(),
      strokePaintColor: (() => {
        const _dartTemporary21 = isOnTop;
        if (_dartTemporary21 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary21!;
      })()
        ? (sliderTheme as SliderThemeData).overlappingShapeStrokeColor
        : (sliderTheme as SliderThemeData).valueIndicatorStrokeColor,
    });
  }
}
protect(RectangularRangeSliderValueIndicatorShape, ['_dart_cce8a1855e0152c7_pathPainter']);
export class _PaddleSliderValueIndicatorPathPainter {
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_topLobeRadius: number = 16;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_minLabelWidth: number = 16;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_bottomLobeRadius: number = 10;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_labelPadding: number = 8;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_distanceBetweenTopBottomCenters: number = 40;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_middleNeckWidth: number = 3;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_bottomNeckRadius: number = 4.5;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_topNeckRadius: number = 13;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_neckTriangleBase: number =
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topNeckRadius +
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_middleNeckWidth / 2;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_rightBottomNeckCenterX: number =
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_middleNeckWidth / 2 +
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_bottomNeckRadius;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_rightBottomNeckAngleStart: number = 3.141592653589793;
  static readonly _dart_cce8a1855e0152c7_topLobeCenter: Offset = constSourceOffset(
    Offset,
    0,
    -_PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_distanceBetweenTopBottomCenters,
  );
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_neckTriangleHypotenuse: number =
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius +
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topNeckRadius;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_twoSeventyDegrees: number = (3 * 3.141592653589793) / 2;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_ninetyDegrees: number = 3.141592653589793 / 2;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_thirtyDegrees: number = 3.141592653589793 / 6;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_cce8a1855e0152c7_preferredHeight: number =
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_distanceBetweenTopBottomCenters +
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius +
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_bottomLobeRadius;
  static readonly _dart_cce8a1855e0152c7_debuggingLabelLocation: boolean = false;
  constructor() {
    captureDartType(
      this,
      applyDartType<_PaddleSliderValueIndicatorPathPainter>(
        _PaddleSliderValueIndicatorPathPainter,
        '_PaddleSliderValueIndicatorPathPainter',
        [],
        [],
      ),
    );
  }
  /**
   * @dartParam textScaleFactor double
   * @dartParamOrigin textScaleFactor explicit
   */
  getPreferredSize(labelPainter: TextPainter, textScaleFactor: number): Size {
    if (FoundationBuildMode.debug)
      invariant(textScaleFactor >= 0, 'generated-source-assert', 'Pinned Dart assertion failed');
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const width: number =
      castSourceDartDouble(
        sliderShapeMathMax(
          boxSourceDartDouble(
            _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_minLabelWidth *
              textScaleFactor,
          ),
          boxSourceDartDouble(labelPainter.width),
        ),
      ) +
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_labelPadding *
        2 *
        textScaleFactor;
    return new Size(
      width,
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_preferredHeight *
        textScaleFactor,
    );
  }
  /**
   * @dartParam radius double
   * @dartParamOrigin radius explicit
   * @dartParam startAngle double
   * @dartParamOrigin startAngle explicit
   * @dartParam endAngle double
   * @dartParamOrigin endAngle explicit
   */
  static _dart_cce8a1855e0152c7_addArc(
    path: Path,
    center: Offset,
    radius: number,
    startAngle: number,
    endAngle: number,
  ): void {
    if (FoundationBuildMode.debug)
      invariant(center.isFinite, 'generated-source-assert', 'Pinned Dart assertion failed');
    const arcRect: Rect = Rect.fromCircle({ center: center, radius: radius });
    path.arcTo(arcRect, startAngle, endAngle - startAngle, false);
  }
  /**
   * @dartParam scale double
   * @dartParamOrigin scale explicit
   * @dartParam textScaleFactor double
   * @dartParamOrigin textScaleFactor explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  getHorizontalShift({
    center,
    labelPainter,
    scale,
    textScaleFactor,
    sizeWithOverflow,
  }: {
    readonly center: Offset;
    readonly labelPainter: TextPainter;
    readonly scale: number;
    readonly textScaleFactor: number;
    readonly sizeWithOverflow: Size;
  }): number {
    if (FoundationBuildMode.debug)
      invariant(
        !sizeWithOverflow.isEmpty,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const inverseTextScale: number = textScaleFactor !== 0 ? 1 / textScaleFactor : 0;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const labelHalfWidth: number = labelPainter.width / 2;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const halfWidthNeeded: number = castSourceDartDouble(
      sliderShapeMathMax(
        boxSourceDartDouble(0),
        boxSourceDartDouble(
          inverseTextScale * labelHalfWidth -
            (_PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius -
              _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_labelPadding),
        ),
      ),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const shift: number = this._dart_cce8a1855e0152c7_getIdealOffset(
      halfWidthNeeded,
      textScaleFactor * scale,
      center,
      sizeWithOverflow.width,
    );
    return shift * textScaleFactor;
  }
  /**
   * @dartParam halfWidthNeeded double
   * @dartParamOrigin halfWidthNeeded explicit
   * @dartParam scale double
   * @dartParamOrigin scale explicit
   * @dartParam widthWithOverflow double
   * @dartParamOrigin widthWithOverflow explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  _dart_cce8a1855e0152c7_getIdealOffset(
    halfWidthNeeded: number,
    scale: number,
    center: Offset,
    widthWithOverflow: number,
  ): number {
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const edgeMargin: number = 8;
    const topLobeRect: Rect = Rect.fromLTWH(
      -_PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius -
        halfWidthNeeded,
      -_PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius -
        _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_distanceBetweenTopBottomCenters,
      2 *
        (_PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius +
          halfWidthNeeded),
      2 * _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius,
    );
    const topLeft: Offset = topLobeRect.topLeft.multiply(scale).add(center);
    const bottomRight: Offset = topLobeRect.bottomRight.multiply(scale).add(center);
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    let shift: number = 0;
    if (topLeft.dx < edgeMargin) {
      shift = edgeMargin - topLeft.dx;
    }
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const endGlobal: number = widthWithOverflow;
    if (bottomRight.dx > endGlobal - edgeMargin) {
      shift = endGlobal - edgeMargin - bottomRight.dx;
    }
    shift = scale === 0 ? 0 : shift / scale;
    if (shift < 0) {
      shift = castSourceDartDouble(
        sliderShapeMathMax(boxSourceDartDouble(shift), boxSourceDartDouble(-halfWidthNeeded)),
      );
    } else {
      shift = castSourceDartDouble(
        sliderShapeMathMin(boxSourceDartDouble(shift), boxSourceDartDouble(halfWidthNeeded)),
      );
    }
    return shift;
  }
  /**
   * @dartParam scale double
   * @dartParamOrigin scale explicit
   * @dartParam textScaleFactor double
   * @dartParamOrigin textScaleFactor explicit
   */
  paint(
    canvas: Canvas,
    center: Offset,
    paint: ScrollbarSourcePaint,
    scale: number,
    labelPainter: TextPainter,
    textScaleFactor: number,
    sizeWithOverflow: Size,
    strokePaintColor: Color | null,
  ): void {
    if (scale === 0) {
      return;
    }
    if (FoundationBuildMode.debug)
      invariant(
        !sizeWithOverflow.isEmpty,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const overallScale: number = scale * textScaleFactor;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const inverseTextScale: number = textScaleFactor !== 0 ? 1 / textScaleFactor : 0;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const labelHalfWidth: number = labelPainter.width / 2;
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.scale(overallScale, overallScale);
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const bottomNeckTriangleHypotenuse: number =
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_bottomNeckRadius +
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_bottomLobeRadius / overallScale;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const rightBottomNeckCenterY: number = -sliderShapeSqrt(
      unwrapSourceDartNum(
        sourceDartNumSubtract(
          sliderShapeMathPow(
            boxSourceDartDouble(bottomNeckTriangleHypotenuse),
            boxSourceDartInt(2),
          ),
          sliderShapeMathPow(
            boxSourceDartDouble(
              _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_rightBottomNeckCenterX,
            ),
            boxSourceDartInt(2),
          ),
        ),
      ),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const rightBottomNeckAngleEnd: number =
      3.141592653589793 +
      sliderShapeAtan(
        rightBottomNeckCenterY /
          _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_rightBottomNeckCenterX,
      );
    const path: Path = (() => {
      const _dartTemporary22 = new Path();
      _dartTemporary22.moveTo(
        _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_middleNeckWidth / 2,
        rightBottomNeckCenterY,
      );
      return _dartTemporary22;
    })();
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_addArc(
      path,
      new Offset(
        _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_rightBottomNeckCenterX,
        rightBottomNeckCenterY,
      ),
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_bottomNeckRadius,
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_rightBottomNeckAngleStart,
      rightBottomNeckAngleEnd,
    );
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_addArc(
      path,
      Offset.zero,
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_bottomLobeRadius / overallScale,
      rightBottomNeckAngleEnd - 3.141592653589793,
      2 * 3.141592653589793 - rightBottomNeckAngleEnd,
    );
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_addArc(
      path,
      new Offset(
        -_PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_rightBottomNeckCenterX,
        rightBottomNeckCenterY,
      ),
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_bottomNeckRadius,
      3.141592653589793 - rightBottomNeckAngleEnd,
      0,
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const halfWidthNeeded: number = castSourceDartDouble(
      sliderShapeMathMax(
        boxSourceDartDouble(0),
        boxSourceDartDouble(
          inverseTextScale * labelHalfWidth -
            (_PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius -
              _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_labelPadding),
        ),
      ),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const shift: number = this._dart_cce8a1855e0152c7_getIdealOffset(
      halfWidthNeeded,
      overallScale,
      center,
      sizeWithOverflow.width,
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const leftWidthNeeded: number = halfWidthNeeded - shift;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const rightWidthNeeded: number = halfWidthNeeded + shift;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const leftAmount: number = castSourceDartDouble(
      sliderShapeMathMax(
        boxSourceDartDouble(0),
        boxSourceDartDouble(
          castSourceDartDouble(
            sliderShapeMathMin(
              boxSourceDartDouble(1),
              boxSourceDartDouble(
                leftWidthNeeded /
                  _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_neckTriangleBase,
              ),
            ),
          ),
        ),
      ),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const rightAmount: number = castSourceDartDouble(
      sliderShapeMathMax(
        boxSourceDartDouble(0),
        boxSourceDartDouble(
          castSourceDartDouble(
            sliderShapeMathMin(
              boxSourceDartDouble(1),
              boxSourceDartDouble(
                rightWidthNeeded /
                  _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_neckTriangleBase,
              ),
            ),
          ),
        ),
      ),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const leftTheta: number =
      (1 - leftAmount) *
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_thirtyDegrees;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const rightTheta: number =
      (1 - rightAmount) *
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_thirtyDegrees;
    const leftTopNeckCenter: Offset = new Offset(
      -_PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_neckTriangleBase,
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeCenter.dy +
        sliderShapeCos(leftTheta) *
          _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_neckTriangleHypotenuse,
    );
    const neckRightCenter: Offset = new Offset(
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_neckTriangleBase,
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeCenter.dy +
        sliderShapeCos(rightTheta) *
          _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_neckTriangleHypotenuse,
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const leftNeckArcAngle: number =
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_ninetyDegrees - leftTheta;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const rightNeckArcAngle: number =
      3.141592653589793 +
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_ninetyDegrees -
      rightTheta;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const neckStretchBaseline: number = castSourceDartDouble(
      sliderShapeMathMax(
        boxSourceDartDouble(0),
        boxSourceDartDouble(
          castSourceDartDouble(
            sourceDartNumSubtract(
              boxSourceDartDouble(rightBottomNeckCenterY),
              sliderShapeMathMax(
                boxSourceDartDouble(leftTopNeckCenter.dy),
                boxSourceDartDouble(neckRightCenter.dy),
              ),
            ),
          ),
        ),
      ),
    );
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const t: number = castSourceDartDouble(
      sliderShapeMathPow(boxSourceDartDouble(inverseTextScale), boxSourceDartDouble(3)),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const stretch: number = clampDouble(neckStretchBaseline * t, 0, 10 * neckStretchBaseline);
    const neckStretch: Offset = new Offset(0, neckStretchBaseline - stretch);
    if (FoundationBuildMode.debug)
      invariant(
        !_PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_debuggingLabelLocation ||
          ((): boolean => {
            const leftCenter: Offset =
              _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeCenter
                .subtract(new Offset(leftWidthNeeded, 0))
                .add(neckStretch);
            const rightCenter: Offset =
              _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeCenter
                .add(new Offset(rightWidthNeeded, 0))
                .add(neckStretch);
            const valueRect: Rect = Rect.fromLTRB(
              leftCenter.dx -
                _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius,
              leftCenter.dy -
                _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius,
              rightCenter.dx +
                _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius,
              rightCenter.dy +
                _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius,
            );
            const outlinePaint: ScrollbarSourcePaint = (() => {
              const _dartTemporary23 = new ScrollbarSourcePaint();
              _dartTemporary23.sourceColor = constSourceColor(Color, 4294901760);
              _dartTemporary23.style = 'stroke';
              _dartTemporary23.strokeWidth = 1;
              return _dartTemporary23;
            })();
            canvas.drawRect(valueRect, outlinePaint);
            return true;
          })(),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_addArc(
      path,
      leftTopNeckCenter.add(neckStretch),
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topNeckRadius,
      0,
      -leftNeckArcAngle,
    );
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_addArc(
      path,
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeCenter
        .subtract(new Offset(leftWidthNeeded, 0))
        .add(neckStretch),
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius,
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_ninetyDegrees + leftTheta,
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_twoSeventyDegrees,
    );
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_addArc(
      path,
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeCenter
        .add(new Offset(rightWidthNeeded, 0))
        .add(neckStretch),
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topLobeRadius,
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_twoSeventyDegrees,
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_twoSeventyDegrees +
        3.141592653589793 -
        rightTheta,
    );
    _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_addArc(
      path,
      neckRightCenter.add(neckStretch),
      _PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_topNeckRadius,
      rightNeckArcAngle,
      3.141592653589793,
    );
    if (strokePaintColor !== null) {
      const strokePaint: ScrollbarSourcePaint = (() => {
        const _dartTemporary24 = new ScrollbarSourcePaint();
        _dartTemporary24.sourceColor = strokePaintColor as Color;
        _dartTemporary24.strokeWidth = 1;
        _dartTemporary24.style = 'stroke';
        return _dartTemporary24;
      })();
      canvas.drawPath(path, strokePaint);
    }
    canvas.drawPath(path, paint);
    canvas.save();
    canvas.translate(
      shift,
      -_PaddleSliderValueIndicatorPathPainter._dart_cce8a1855e0152c7_distanceBetweenTopBottomCenters +
        neckStretch.dy,
    );
    canvas.scale(inverseTextScale, inverseTextScale);
    labelPainter.paint(
      canvas,
      Offset.zero.subtract(new Offset(labelHalfWidth, labelPainter.height / 2)),
    );
    canvas.restore();
    canvas.restore();
  }
}
protect(_PaddleSliderValueIndicatorPathPainter, [
  '_dart_cce8a1855e0152c7_topLobeRadius',
  '_dart_cce8a1855e0152c7_minLabelWidth',
  '_dart_cce8a1855e0152c7_bottomLobeRadius',
  '_dart_cce8a1855e0152c7_labelPadding',
  '_dart_cce8a1855e0152c7_distanceBetweenTopBottomCenters',
  '_dart_cce8a1855e0152c7_middleNeckWidth',
  '_dart_cce8a1855e0152c7_bottomNeckRadius',
  '_dart_cce8a1855e0152c7_neckTriangleBase',
  '_dart_cce8a1855e0152c7_rightBottomNeckCenterX',
  '_dart_cce8a1855e0152c7_rightBottomNeckAngleStart',
  '_dart_cce8a1855e0152c7_topLobeCenter',
  '_dart_cce8a1855e0152c7_topNeckRadius',
  '_dart_cce8a1855e0152c7_neckTriangleHypotenuse',
  '_dart_cce8a1855e0152c7_twoSeventyDegrees',
  '_dart_cce8a1855e0152c7_ninetyDegrees',
  '_dart_cce8a1855e0152c7_thirtyDegrees',
  '_dart_cce8a1855e0152c7_preferredHeight',
  '_dart_cce8a1855e0152c7_debuggingLabelLocation',
]);
export class PaddleSliderValueIndicatorShape extends SliderComponentShape {
  static readonly _dart_cce8a1855e0152c7_pathPainter: _PaddleSliderValueIndicatorPathPainter =
    canonicalDartObject<_PaddleSliderValueIndicatorPathPainter>(
      _PaddleSliderValueIndicatorPathPainter,
      applyDartType<_PaddleSliderValueIndicatorPathPainter>(
        _PaddleSliderValueIndicatorPathPainter,
        '_PaddleSliderValueIndicatorPathPainter',
        [],
        [],
      ),
      [],
      () => new _PaddleSliderValueIndicatorPathPainter(),
      true,
    );
  constructor() {
    super();
    captureDartType(
      this,
      applyDartType<PaddleSliderValueIndicatorShape>(
        PaddleSliderValueIndicatorShape,
        'PaddleSliderValueIndicatorShape',
        [],
        [applyDartType<SliderComponentShape>(SliderComponentShape, 'SliderComponentShape', [], [])],
      ),
    );
  }
  /**
   * @dartParam textScaleFactor double?
   * @dartParamOrigin textScaleFactor explicit
   */
  override getPreferredSize(
    isEnabled: boolean,
    isDiscrete: boolean,
    {
      labelPainter = null,
      textScaleFactor = null,
    }: {
      readonly labelPainter?: TextPainter | null;
      readonly textScaleFactor?: number | null;
    } = {},
  ): Size {
    if (FoundationBuildMode.debug)
      invariant(labelPainter !== null, 'generated-source-assert', 'Pinned Dart assertion failed');
    if (FoundationBuildMode.debug)
      invariant(
        textScaleFactor !== null && (textScaleFactor as number) >= 0,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    return PaddleSliderValueIndicatorShape._dart_cce8a1855e0152c7_pathPainter.getPreferredSize(
      (() => {
        const _dartTemporary25 = labelPainter;
        if (_dartTemporary25 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary25!;
      })(),
      (() => {
        const _dartTemporary26 = textScaleFactor;
        if (_dartTemporary26 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary26!;
      })(),
    );
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
  override paint(
    context: PaintingContext,
    center: Offset,
    {
      activationAnimation,
      enableAnimation,
      isDiscrete,
      labelPainter,
      parentBox,
      sliderTheme,
      textDirection,
      value,
      textScaleFactor,
      sizeWithOverflow,
    }: {
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
    },
  ): void {
    if (FoundationBuildMode.debug)
      invariant(
        !sizeWithOverflow.isEmpty,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    const enableColor: ColorTween = new ColorTween({
      begin: sliderTheme.disabledThumbColor,
      end: sliderTheme.valueIndicatorColor,
    });
    PaddleSliderValueIndicatorShape._dart_cce8a1855e0152c7_pathPainter.paint(
      context.canvas,
      center,
      (() => {
        const _dartTemporary27 = new ScrollbarSourcePaint();
        _dartTemporary27.sourceColor = (() => {
          const _dartTemporary28 = sliderShapeTweenEvaluate(enableColor, enableAnimation);
          if (_dartTemporary28 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary28!;
        })();
        return _dartTemporary27;
      })(),
      castSourceDartDouble(sliderShapeAnimationValue(activationAnimation)),
      labelPainter,
      textScaleFactor,
      sizeWithOverflow,
      sliderTheme.valueIndicatorStrokeColor,
    );
  }
}
protect(PaddleSliderValueIndicatorShape, ['_dart_cce8a1855e0152c7_pathPainter']);
export class PaddleRangeSliderValueIndicatorShape extends RangeSliderValueIndicatorShape {
  static readonly _dart_cce8a1855e0152c7_pathPainter: _PaddleSliderValueIndicatorPathPainter =
    canonicalDartObject<_PaddleSliderValueIndicatorPathPainter>(
      _PaddleSliderValueIndicatorPathPainter,
      applyDartType<_PaddleSliderValueIndicatorPathPainter>(
        _PaddleSliderValueIndicatorPathPainter,
        '_PaddleSliderValueIndicatorPathPainter',
        [],
        [],
      ),
      [],
      () => new _PaddleSliderValueIndicatorPathPainter(),
      true,
    );
  constructor() {
    super();
    captureDartType(
      this,
      applyDartType<PaddleRangeSliderValueIndicatorShape>(
        PaddleRangeSliderValueIndicatorShape,
        'PaddleRangeSliderValueIndicatorShape',
        [],
        [rangeSliderValueIndicatorShapeType],
      ),
    );
  }
  /**
   * @dartParam textScaleFactor double
   * @dartParamOrigin textScaleFactor explicit
   */
  override getPreferredSize(
    isEnabled: boolean,
    isDiscrete: boolean,
    {
      labelPainter,
      textScaleFactor,
    }: {
      readonly labelPainter: TextPainter;
      readonly textScaleFactor: number;
    },
  ): Size {
    if (FoundationBuildMode.debug)
      invariant(textScaleFactor >= 0, 'generated-source-assert', 'Pinned Dart assertion failed');
    return PaddleRangeSliderValueIndicatorShape._dart_cce8a1855e0152c7_pathPainter.getPreferredSize(
      labelPainter,
      textScaleFactor,
    );
  }
  /**
   * @dartParam activationAnimation Animation<double>?
   * @dartParamOrigin activationAnimation explicit
   * @dartParam textScaleFactor double?
   * @dartParamOrigin textScaleFactor explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  override getHorizontalShift({
    parentBox = null,
    center = null,
    labelPainter = null,
    activationAnimation = null,
    textScaleFactor = null,
    sizeWithOverflow = null,
  }: {
    readonly parentBox?: RenderBox | null;
    readonly center?: Offset | null;
    readonly labelPainter?: TextPainter | null;
    readonly activationAnimation?: Animation<DartDouble> | null;
    readonly textScaleFactor?: number | null;
    readonly sizeWithOverflow?: Size | null;
  } = {}): number {
    return PaddleRangeSliderValueIndicatorShape._dart_cce8a1855e0152c7_pathPainter.getHorizontalShift(
      {
        center: (() => {
          const _dartTemporary29 = center;
          if (_dartTemporary29 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary29!;
        })(),
        labelPainter: (() => {
          const _dartTemporary30 = labelPainter;
          if (_dartTemporary30 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary30!;
        })(),
        scale: castSourceDartDouble(
          sliderShapeAnimationValue(
            (() => {
              const _dartTemporary31 = activationAnimation;
              if (_dartTemporary31 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary31!;
            })(),
          ),
        ),
        textScaleFactor: (() => {
          const _dartTemporary32 = textScaleFactor;
          if (_dartTemporary32 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary32!;
        })(),
        sizeWithOverflow: (() => {
          const _dartTemporary33 = sizeWithOverflow;
          if (_dartTemporary33 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary33!;
        })(),
      },
    );
  }
  /**
   * @dartParam activationAnimation Animation<double>
   * @dartParamOrigin activationAnimation explicit
   * @dartParam enableAnimation Animation<double>
   * @dartParamOrigin enableAnimation explicit
   * @dartParam value double?
   * @dartParamOrigin value explicit
   * @dartParam textScaleFactor double?
   * @dartParamOrigin textScaleFactor explicit
   */
  override paint(
    context: PaintingContext,
    center: Offset,
    {
      activationAnimation,
      enableAnimation,
      isDiscrete = null,
      isOnTop = false,
      labelPainter,
      parentBox,
      sliderTheme,
      textDirection = null,
      thumb = null,
      value = null,
      textScaleFactor = null,
      sizeWithOverflow = null,
    }: {
      readonly activationAnimation: Animation<DartDouble>;
      readonly enableAnimation: Animation<DartDouble>;
      readonly isDiscrete?: boolean | null;
      readonly isOnTop?: boolean;
      readonly labelPainter: TextPainter;
      readonly parentBox: RenderBox;
      readonly sliderTheme: SliderThemeData;
      readonly textDirection?: ScrollbarTextDirection | null;
      readonly thumb?: Thumb | null;
      readonly value?: number | null;
      readonly textScaleFactor?: number | null;
      readonly sizeWithOverflow?: Size | null;
    },
  ): void {
    if (FoundationBuildMode.debug)
      invariant(
        !(() => {
          const _dartTemporary34 = sizeWithOverflow;
          if (_dartTemporary34 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary34!;
        })().isEmpty,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    const enableColor: ColorTween = new ColorTween({
      begin: sliderTheme.disabledThumbColor,
      end: sliderTheme.valueIndicatorColor,
    });
    PaddleRangeSliderValueIndicatorShape._dart_cce8a1855e0152c7_pathPainter.paint(
      context.canvas,
      center,
      (() => {
        const _dartTemporary35 = new ScrollbarSourcePaint();
        _dartTemporary35.sourceColor = (() => {
          const _dartTemporary36 = sliderShapeTweenEvaluate(enableColor, enableAnimation);
          if (_dartTemporary36 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary36!;
        })();
        return _dartTemporary35;
      })(),
      castSourceDartDouble(sliderShapeAnimationValue(activationAnimation)),
      labelPainter,
      (() => {
        const _dartTemporary37 = textScaleFactor;
        if (_dartTemporary37 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary37!;
      })(),
      (() => {
        const _dartTemporary38 = sizeWithOverflow;
        if (_dartTemporary38 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary38!;
      })(),
      isOnTop ? sliderTheme.overlappingShapeStrokeColor : sliderTheme.valueIndicatorStrokeColor,
    );
  }
}
protect(PaddleRangeSliderValueIndicatorShape, ['_dart_cce8a1855e0152c7_pathPainter']);

// Composed manual declarations: .tmp\work8\w11-material-shape-modules\slider_value_indicator_shape-witness.ts
export const sliderComponentShapeType = applyDartType<SliderComponentShape>(
  SliderComponentShape,
  'SliderComponentShape',
  [],
  [],
);
