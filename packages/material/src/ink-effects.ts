// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Original highlight/splash/ripple timing and paint decisions on actual Core animation owners.
import { InteractiveInkFeature, InteractiveInkFeatureFactory } from './ink-feature.ts';
import type { InteractiveInkFeatureOptions, InkFactoryOptions, RectCallback } from './ink-feature.ts';
import { materialDefaultSplashRadius } from "./internal/material/material-ink-owner.ts";
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { Tween, IntTween, CurveTween } from '@nelyx/core/framework/animation/tween';
import { Curves, Interval } from '@nelyx/core/framework/animation/curves';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { Paint } from '@nelyx/core/ui/paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Matrix4 } from '@nelyx/core/math/matrix4';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { MatrixUtils } from '@nelyx/core/framework/painting/matrix-utils';
import { invariant } from '@nelyx/core/foundation/errors';
export interface InkHighlightOptions extends InteractiveInkFeatureOptions {
    readonly textDirection: 'ltr' | 'rtl';
    readonly shape?: 'rectangle' | 'circle'; /** @dartType double? */
    readonly radius?: number | null;
    readonly borderRadius?: BorderRadius | null;
    readonly rectCallback?: RectCallback | null;
    readonly fadeDuration?: number;
}
export class InkHighlight extends InteractiveInkFeature {
    private readonly alphaController: AnimationController;
    private readonly alpha: Animation<number>;
    private emphasized = true;
    private readonly shape: 'rectangle' | 'circle';
    private readonly radius: number | null;
    private readonly border: BorderRadius;
    private readonly rectCallback: RectCallback | null;
    private readonly direction: 'ltr' | 'rtl';
    constructor({ textDirection, shape = 'rectangle', radius = null, borderRadius = null, rectCallback = null, fadeDuration = 200, ...options }: InkHighlightOptions) {
        super(options);
        validRadius(radius);
        validDuration(fadeDuration);
        this.shape = shape;
        this.radius = radius;
        this.border = borderRadius ?? BorderRadius.zero;
        this.rectCallback = rectCallback;
        this.direction = textDirection;
        this.alphaController = new AnimationController({ duration: fadeDuration, vsync: this.controller.vsync });
        this.alphaController.addListener(() => this.controller.markNeedsPaint());
        this.alphaController.addStatusListener(status => {
            if (status === AnimationStatus.dismissed && !this.emphasized)
                this.dispose();
        });
        this.alpha = this.alphaController.drive(new IntTween({ begin: 0, end: this.color.alpha }));
        this.controller.addInkFeature(this);
        this.alphaController.forward();
    }
    get active(): boolean {
        return this.emphasized;
    }
    activate(): void {
        if (this.debugDisposed)
            return;
        this.emphasized = true;
        this.alphaController.forward();
    }
    deactivate(): void {
        if (this.debugDisposed)
            return;
        this.emphasized = false;
        this.alphaController.reverse();
    }
    private paintHighlight(canvas: Canvas, rect: Rect, paint: Paint): void {
        canvas.save();
        try {
            if (this.customBorder !== null)
                canvas.clipPath(this.customBorder.getOuterPath(rect, { textDirection: this.direction }));
            if (this.shape === 'circle')
                canvas.drawCircle(rect.center, this.radius ?? materialDefaultSplashRadius, paint);
            else if (!this.border.equals(BorderRadius.zero))
                canvas.drawRRect(this.border.toRRect(rect), paint);
            else
                canvas.drawRect(rect, paint);
        }
        finally {
            canvas.restore();
        }
    }
    protected paintFeature(canvas: Canvas, transform: Matrix4): void {
        const paint = new Paint({ color: this.color.withAlpha(this.alpha.value).toARGB32() }), origin = MatrixUtils.getAsTranslation(transform), rect = this.rectCallback?.() ?? Rect.fromLTWH(0, 0, this.referenceBox.size.width, this.referenceBox.size.height);
        if (origin === null) {
            canvas.save();
            try {
                canvas.transform(transform.storage);
                this.paintHighlight(canvas, rect, paint);
            }
            finally {
                canvas.restore();
            }
        }
        else
            this.paintHighlight(canvas, rect.shift(origin), paint);
    }
    override dispose(): void {
        if (this.debugDisposed)
            return;
        try {
            this.alphaController.dispose();
        }
        finally {
            super.dispose();
        }
    }
}
export interface InkSplashOptions extends Omit<InkFactoryOptions, 'position'> {
    readonly position?: Offset | null;
}
function validDuration(value: number): void {
    invariant(Number.isFinite(value) && value >= 0, 'invalid-ink-duration', 'Ink duration must be finite and nonnegative');
}
function validRadius(value: number | null): void {
    invariant(value === null || Number.isFinite(value) && value >= 0, 'invalid-ink-radius', 'Ink radius must be finite and nonnegative');
}
function clipFor(reference: InkFactoryOptions['referenceBox'], contained: boolean, rect: RectCallback | null): RectCallback | null {
    invariant(rect === null || contained, 'uncontained-ink-rect', 'An explicit ink rect requires containedInkWell');
    return rect ?? (contained ? () => Rect.fromLTWH(0, 0, reference.size.width, reference.size.height) : null);
}
class SplashFactory extends InteractiveInkFeatureFactory {
    create(options: InkFactoryOptions): InkSplash {
        return new InkSplash(options);
    }
}
class RippleFactory extends InteractiveInkFeatureFactory {
    create(options: InkFactoryOptions): InkRipple {
        return new InkRipple(options);
    }
}
export class InkSplash extends InteractiveInkFeature {
    static readonly splashFactory: InteractiveInkFeatureFactory = Object.freeze(new SplashFactory());
    private readonly position: Offset;
    private readonly border: BorderRadius;
    private readonly targetRadius: number;
    private readonly clip: RectCallback | null;
    private readonly reposition: boolean;
    private readonly direction: 'ltr' | 'rtl';
    private readonly radiusController: AnimationController;
    private readonly alphaController: AnimationController;
    private readonly radiusAnimation: Animation<number>;
    private readonly alpha: Animation<number>;
    constructor({ position = null, textDirection, containedInkWell = false, rectCallback = null, borderRadius = null, radius = null, ...options }: InkSplashOptions) {
        super(options);
        invariant(position instanceof Offset, 'missing-ink-position', 'InkSplash needs an actual Offset before animation starts');
        validRadius(radius);
        this.position = position;
        this.border = borderRadius ?? BorderRadius.zero;
        this.clip = clipFor(this.referenceBox, containedInkWell, rectCallback);
        this.reposition = !containedInkWell;
        this.direction = textDirection;
        this.targetRadius = radius ?? (containedInkWell ? (() => {
            const size = rectCallback?.().size ?? this.referenceBox.size;
            return Math.ceil(Math.max(position.distance, position.subtract(new Offset(size.width, 0)).distance, position.subtract(new Offset(0, size.height)).distance, position.subtract(new Offset(size.width, size.height)).distance));
        })() : materialDefaultSplashRadius);
        this.radiusController = new AnimationController({ duration: 1000, vsync: this.controller.vsync });
        this.radiusController.addListener(() => this.controller.markNeedsPaint());
        this.radiusAnimation = this.radiusController.drive(new Tween({ begin: 0, end: this.targetRadius }));
        this.alphaController = new AnimationController({ duration: 200, vsync: this.controller.vsync });
        this.alphaController.addListener(() => this.controller.markNeedsPaint());
        this.alphaController.addStatusListener(status => {
            if (status === AnimationStatus.completed)
                this.dispose();
        });
        this.alpha = this.alphaController.drive(new IntTween({ begin: this.color.alpha, end: 0 }));
        this.controller.addInkFeature(this);
        this.radiusController.forward();
    }
    override confirm(): void {
        if (this.debugDisposed)
            return;
        this.radiusController.duration = Math.floor(this.targetRadius);
        this.radiusController.forward();
        this.alphaController.forward();
    }
    override cancel(): void {
        if (!this.debugDisposed)
            this.alphaController.forward();
    }
    protected paintFeature(canvas: Canvas, transform: Matrix4): void {
        const center = this.reposition ? Offset.lerp(this.position, new Offset(this.referenceBox.size.width / 2, this.referenceBox.size.height / 2), this.radiusController.value)! : this.position;
        this.paintInkCircle({
            canvas, transform, paint: new Paint({ color: this.color.withAlpha(this.alpha.value).toARGB32() }), center, radius: this.radiusAnimation.value, textDirection: this.direction, customBorder: this.customBorder, borderRadius: this.border, clipCallback: this.clip
        });
    }
    override dispose(): void {
        if (this.debugDisposed)
            return;
        try {
            this.radiusController.dispose();
            this.alphaController.dispose();
        }
        finally {
            super.dispose();
        }
    }
}
export class InkRipple extends InteractiveInkFeature {
    static readonly splashFactory: InteractiveInkFeatureFactory = Object.freeze(new RippleFactory());
    private readonly position: Offset;
    private readonly border: BorderRadius;
    private readonly targetRadius: number;
    private readonly clip: RectCallback | null;
    private readonly direction: 'ltr' | 'rtl';
    private readonly radiusController: AnimationController;
    private readonly fadeInController: AnimationController;
    private readonly fadeOutController: AnimationController;
    private readonly radiusAnimation: Animation<number>;
    private readonly fadeIn: Animation<number>;
    private readonly fadeOut: Animation<number>;
    constructor({ position, textDirection, containedInkWell = false, rectCallback = null, borderRadius = null, radius = null, ...options }: InkFactoryOptions) {
        super(options);
        validRadius(radius);
        this.position = position;
        this.direction = textDirection;
        this.border = borderRadius ?? BorderRadius.zero;
        this.clip = clipFor(this.referenceBox, containedInkWell, rectCallback);
        this.targetRadius = radius ?? (() => {
            const size = rectCallback?.().size ?? this.referenceBox.size;
            return new Offset(size.width, size.height).distance / 2;
        })();
        this.fadeInController = new AnimationController({ duration: 75, vsync: this.controller.vsync });
        this.fadeInController.addListener(() => this.controller.markNeedsPaint());
        this.fadeIn = this.fadeInController.drive(new IntTween({ begin: 0, end: this.color.alpha }));
        this.radiusController = new AnimationController({ duration: 1000, vsync: this.controller.vsync });
        this.radiusController.addListener(() => this.controller.markNeedsPaint());
        this.radiusAnimation = this.radiusController.drive(new Tween({ begin: this.targetRadius * .30, end: this.targetRadius + 5 }).chain(new CurveTween({ curve: Curves.ease })));
        this.fadeOutController = new AnimationController({ duration: 375, vsync: this.controller.vsync });
        this.fadeOutController.addListener(() => this.controller.markNeedsPaint());
        this.fadeOutController.addStatusListener(status => {
            if (status === AnimationStatus.completed)
                this.dispose();
        });
        this.fadeOut = this.fadeOutController.drive(new IntTween({ begin: this.color.alpha, end: 0 }).chain(new CurveTween({ curve: new Interval(225 / 375, 1) })));
        this.controller.addInkFeature(this);
        this.fadeInController.forward();
        this.radiusController.forward();
    }
    override confirm(): void {
        if (this.debugDisposed)
            return;
        this.radiusController.duration = 225;
        this.radiusController.forward();
        this.fadeInController.forward();
        this.fadeOutController.animateTo(1, { duration: 375 });
    }
    override cancel(): void {
        if (this.debugDisposed)
            return;
        this.fadeInController.stop();
        const value = 1 - this.fadeInController.value;
        this.fadeOutController.value = value;
        if (value < 1)
            this.fadeOutController.animateTo(1, { duration: 75 });
    }
    protected paintFeature(canvas: Canvas, transform: Matrix4): void {
        const alpha = this.fadeInController.isAnimating ? this.fadeIn.value : this.fadeOut.value, rect = this.clip?.(), center = Offset.lerp(this.position, rect?.center ?? new Offset(this.referenceBox.size.width / 2, this.referenceBox.size.height / 2), Curves.ease.transform(this.radiusController.value))!;
        this.paintInkCircle({
            canvas, transform, paint: new Paint({ color: this.color.withAlpha(alpha).toARGB32() }), center, radius: this.radiusAnimation.value, textDirection: this.direction, customBorder: this.customBorder, borderRadius: this.border, clipCallback: this.clip
        });
    }
    override dispose(): void {
        if (this.debugDisposed)
            return;
        try {
            this.radiusController.dispose();
            this.fadeInController.dispose();
            this.fadeOutController.dispose();
        }
        finally {
            super.dispose();
        }
    }
}
