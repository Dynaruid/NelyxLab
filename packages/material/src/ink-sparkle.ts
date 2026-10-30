// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional port of pinned Flutter material/ink_sparkle.dart on Nelyx owners.
import { InteractiveInkFeature, InteractiveInkFeatureFactory } from './ink-feature.ts';
import type { InkFactoryOptions, RectCallback } from './ink-feature.ts';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { Tween, ConstantTween, CurveTween } from '@nelyx/core/framework/animation/tween';
import { TweenSequence } from '@nelyx/core/framework/animation/tween-sequence';
import { TweenSequenceItem } from '@nelyx/core/framework/animation/tween-sequence-item';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { invariant } from '@nelyx/core/foundation/errors';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { Color } from '@nelyx/core/ui/color';
import { Paint } from '@nelyx/core/ui/paint';
import { RuntimeShader } from '@nelyx/core/ui/shader';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Matrix4 } from '@nelyx/core/math/matrix4';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { MatrixUtils } from '@nelyx/core/framework/painting/matrix-utils';
import inkSparkleShaderSource from '../assets/shaders/ink_sparkle.sksl';
export interface InkSparkleOptions extends InkFactoryOptions {
  /** @dartType double? @dartTypeOrigin explicit */ readonly turbulenceSeed?: number | null;
}
const radiusSequence = new TweenSequence([
  new TweenSequenceItem({ tween: new CurveTween({ curve: Curves.fastOutSlowIn }), weight: 75 }),
  new TweenSequenceItem({ tween: new ConstantTween(1), weight: 25 }),
]);
function alphaSequence(last: number): TweenSequence<number> {
  return new TweenSequence([
    new TweenSequenceItem({ tween: new Tween({ begin: 0, end: 1 }), weight: 13 }),
    new TweenSequenceItem({ tween: new ConstantTween(1), weight: 27 }),
    new TweenSequenceItem({ tween: new Tween({ begin: 1, end: 0 }), weight: last }),
  ]);
}
const alpha = alphaSequence(60),
  sparkleAlpha = alphaSequence(50);
class SparkleFactory extends InteractiveInkFeatureFactory {
  constructor(private readonly seed: number | null = null) {
    super();
  }
  create(options: InkFactoryOptions): InkSparkle {
    return new InkSparkle({
      ...options,
      containedInkWell: options.containedInkWell ?? false,
      turbulenceSeed: this.seed,
    });
  }
}
export class InkSparkle extends InteractiveInkFeature {
  static readonly splashFactory: InteractiveInkFeatureFactory = Object.freeze(new SparkleFactory());
  static readonly constantTurbulenceSeedSplashFactory: InteractiveInkFeatureFactory = Object.freeze(
    new SparkleFactory(1337),
  );
  private readonly animation: AnimationController;
  private readonly originalColor: Color;
  private readonly position: Offset;
  private readonly targetRadius: number;
  private readonly clip: RectCallback | null;
  private readonly border: BorderRadius;
  private readonly direction: 'ltr' | 'rtl';
  private readonly seed: number;
  /** @dartParam radius double? @dartParam turbulenceSeed double? */
  constructor({
    position,
    textDirection,
    containedInkWell = true,
    rectCallback = null,
    borderRadius = null,
    radius = null,
    turbulenceSeed = null,
    ...options
  }: InkSparkleOptions) {
    super(options);
    invariant(
      containedInkWell || rectCallback === null,
      'uncontained-ink-rect',
      'An explicit ink rect requires containedInkWell',
    );
    invariant(
      radius === null || (Number.isFinite(radius) && radius >= 0),
      'invalid-ink-radius',
      'Ink radius must be finite and nonnegative',
    );
    invariant(
      turbulenceSeed === null || Number.isFinite(turbulenceSeed),
      'invalid-ink-seed',
      'Ink seed must be finite',
    );
    this.originalColor = options.color;
    this.position = position;
    this.direction = textDirection;
    this.border = borderRadius ?? BorderRadius.zero;
    const size = radius === null ? (rectCallback?.().size ?? this.referenceBox.size) : null;
    this.targetRadius = (radius ?? Math.hypot(size!.width, size!.height) / 2) * 2.3;
    this.clip =
      rectCallback ??
      (containedInkWell
        ? () => Rect.fromLTWH(0, 0, this.referenceBox.size.width, this.referenceBox.size.height)
        : null);
    this.seed = turbulenceSeed ?? (FoundationBuildMode.debug ? 1337 : Math.random() * 1000);
    this.animation = new AnimationController({ duration: 617, vsync: this.controller.vsync });
    this.animation.addListener(() => this.controller.markNeedsPaint());
    this.animation.addStatusListener((status) => {
      if (status === AnimationStatus.completed) this.dispose();
    });
    this.controller.addInkFeature(this);
    this.animation.forward();
  }
  protected paintFeature(canvas: Canvas, transform: Matrix4): void {
    const width = this.referenceBox.size.width,
      height = this.referenceBox.size.height;
    // A zero-area render box has no visible pixels and reciprocal uniforms are undefined.
    if (width <= 0 || height <= 0) return;
    const time = this.animation.value,
      radius = radiusSequence.transform(time),
      phase = this.seed + radius;
    const center = Offset.lerp(
      this.position,
      new Offset(width / 2, height / 2),
      Math.min(radius * 2, 1),
    )!;
    const color = this.originalColor,
      rotate = phase * Math.PI * 0.0078125;
    const rotations = [rotate + 1.7 * Math.PI, -rotate + 2 * Math.PI, rotate + 2.75 * Math.PI];
    const uniforms = [
      color.red / 255,
      color.green / 255,
      color.blue / 255,
      color.alpha / 255,
      alpha.transform(time),
      sparkleAlpha.transform(time),
      1,
      radius,
      center.x,
      center.y,
      this.targetRadius,
      1 / width,
      1 / height,
      2.1 / width,
      2.1 / height,
      phase / 1000,
      0.75 + phase * 0.01 * Math.cos(1.5 * 0.55),
      0.75 + phase * 0.01 * Math.sin(1.5 * 0.55),
      0.3 + phase * -0.0066 * Math.cos(1.5 * 0.45),
      0.3 + phase * -0.0066 * Math.sin(1.5 * 0.45),
      1.5 + phase * -0.0066 * Math.cos(1.5 * 0.35),
      1.5 + phase * -0.0066 * Math.sin(1.5 * 0.35),
      ...rotations.flatMap((value) => [Math.cos(value), Math.sin(value)]),
    ];
    const shader = new RuntimeShader(inkSparkleShaderSource, uniforms),
      paint = new Paint({ shader });
    canvas.save();
    try {
      const origin = MatrixUtils.getAsTranslation(transform);
      if (origin === null) canvas.transform(transform.storage);
      else canvas.translate(origin.x, origin.y);
      if (this.clip !== null) {
        const rect = this.clip();
        if (this.customBorder !== null)
          canvas.clipPath(this.customBorder.getOuterPath(rect, { textDirection: this.direction }));
        else if (!this.border.equals(BorderRadius.zero))
          canvas.clipRRect(this.border.toRRect(rect));
        else canvas.clipRect(rect);
        canvas.drawRect(this.clip(), paint);
      } else canvas.drawPaint(paint);
    } finally {
      canvas.restore();
      shader.dispose();
    }
  }
  override dispose(): void {
    if (this.debugDisposed) return;
    try {
      this.animation.dispose();
    } finally {
      super.dispose();
    }
  }
}
