// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter widgets/implicit_animations.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { DoubleProperty, IntProperty } from '../../foundation/diagnostic-properties.ts';
import { protect } from '../../ui/value-math.ts';
import { Offset } from '../../ui/offset.ts';
import { Rect } from '../../ui/rect.ts';
import type { FilterQuality } from '../../ui/paint-effects-data.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { Vector3 } from '../../math/vector3.ts';
import { Quaternion } from '../../math/quaternion.ts';
import type { Animation } from '../animation/animation.ts';
import { AnimationStatus } from '../animation/animation.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import { CurvedAnimation } from '../animation/animations.ts';
import { Curves } from '../animation/curves.ts';
import type { Curve } from '../animation/curves.ts';
import { Tween, ColorTween } from '../animation/tween.ts';
import { Color } from '../../ui/color.ts';
import { Alignment, AlignmentGeometry } from '../painting/alignment.ts';
import { EdgeInsets, EdgeInsetsGeometry } from '../painting/edge-insets.ts';
import { Decoration } from '../painting/decoration.ts';
import { BorderRadius } from '../painting/border-radius.ts';
import { Border } from '../painting/box-border.ts';
import { BoxDecoration } from '../painting/box-decoration.ts';
import type { BoxShape } from '../painting/box-border.ts';
import type { Clip } from '../../ui/clip.ts';
import { TextStyle } from '../painting/text-style.ts';
import type { TextAlign, TextHeightBehavior } from '../../ui/typography.ts';
import type { TextOverflow, TextWidthBasis } from '../painting/text-painter.ts';
import { BoxConstraints } from '../rendering/constraints.ts';
import { AlignmentGeometryTween } from '../rendering/tweens.ts';
import { StatefulWidget } from './framework.ts';
import type { Widget, WidgetOptions, BuildContext } from './framework.ts';
import { SingleTickerProviderStateMixin } from './ticker-provider.ts';
import { Align, Padding, Positioned, PhysicalModel } from './basic.ts';
import { FractionallySizedBox } from './overflow-box.ts';
import { Directionality } from './app-data.ts';
import { DefaultTextStyle } from './default-text-style.ts';
import { Container } from './container.ts';
import {
  ScaleTransition,
  RotationTransition,
  SlideTransition,
  FadeTransition,
  SliverFadeTransition,
} from './transitions.ts';

export class BoxConstraintsTween extends Tween<BoxConstraints> {
  override lerp(t: number): BoxConstraints {
    return BoxConstraints.lerp(this.begin, this.end, t)!;
  }
}
export class DecorationTween extends Tween<Decoration> {
  override lerp(t: number): Decoration {
    return Decoration.lerp(this.begin, this.end, t)!;
  }
}
export class EdgeInsetsTween extends Tween<EdgeInsets> {
  override lerp(t: number): EdgeInsets {
    return EdgeInsets.lerp(this.begin, this.end, t)!;
  }
}
export class EdgeInsetsGeometryTween extends Tween<EdgeInsetsGeometry> {
  override lerp(t: number): EdgeInsetsGeometry {
    return EdgeInsetsGeometry.lerp(this.begin, this.end, t)!;
  }
}
export class BorderRadiusTween extends Tween<BorderRadius | null> {
  override lerp(t: number): BorderRadius | null {
    return BorderRadius.lerp(this.begin, this.end, t);
  }
}
export class BorderTween extends Tween<Border | null> {
  override lerp(t: number): Border | null {
    return Border.lerp(this.begin, this.end, t);
  }
}
export class Matrix4Tween extends Tween<Matrix4> {
  override lerp(t: number): Matrix4 {
    invariant(
      this.begin !== null && this.end !== null,
      'null-matrix-tween',
      'Matrix4Tween requires non-null endpoints',
    );
    const beginTranslation = Vector3.zero(),
      endTranslation = Vector3.zero(),
      beginRotation = Quaternion.identity(),
      endRotation = Quaternion.identity(),
      beginScale = Vector3.zero(),
      endScale = Vector3.zero();
    this.begin.decompose(beginTranslation, beginRotation, beginScale);
    this.end.decompose(endTranslation, endRotation, endScale);
    return Matrix4.compose(
      beginTranslation.times(1 - t).plus(endTranslation.times(t)),
      beginRotation
        .scaled(1 - t)
        .plus(endRotation.scaled(t))
        .normalized(),
      beginScale.times(1 - t).plus(endScale.times(t)),
    );
  }
}
export class TextStyleTween extends Tween<TextStyle> {
  override lerp(t: number): TextStyle {
    return TextStyle.lerp(this.begin, this.end, t)!;
  }
}

export interface ImplicitlyAnimatedWidgetOptions extends WidgetOptions {
  readonly curve?: Curve;
  readonly duration: number;
  readonly onEnd?: (() => void) | null;
}
export abstract class ImplicitlyAnimatedWidget extends StatefulWidget {
  readonly curve: Curve;
  readonly duration: number;
  readonly onEnd: (() => void) | null;
  constructor({
    key = null,
    curve = Curves.linear,
    duration,
    onEnd = null,
  }: ImplicitlyAnimatedWidgetOptions) {
    super(key);
    this.curve = curve;
    this.duration = duration;
    this.onEnd = onEnd;
    protect(this, ['curve', 'duration', 'onEnd']);
  }
  abstract override createState(): ImplicitlyAnimatedWidgetState<ImplicitlyAnimatedWidget>;
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new IntProperty('duration', Math.trunc(this.duration), { unit: 'ms' }));
  }
}
export type TweenConstructor<T> = (targetValue: T) => Tween<T>;
/** A rank-two visitor keeps each visited field's concrete type; Dart uses dynamic here. */
export type TweenVisitor = <T>(
  tween: Tween<T> | null,
  targetValue: T | null,
  constructor: TweenConstructor<T>,
) => Tween<T> | null;
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a !== null && typeof a === 'object' && 'equals' in a && typeof a.equals === 'function')
    return (a as { equals(value: unknown): boolean }).equals(b);
  return false;
}
export abstract class ImplicitlyAnimatedWidgetState<
  W extends ImplicitlyAnimatedWidget,
> extends SingleTickerProviderStateMixin<W> {
  private animationController: AnimationController | null = null;
  private curvedAnimation: CurvedAnimation | null = null;
  protected get controller(): AnimationController {
    return (this.animationController ??= new AnimationController({
      duration: this.widget.duration,
      debugLabel: FoundationBuildMode.debug ? this.widget.toStringShort() : null,
      vsync: this,
    }));
  }
  get animation(): Animation<number> {
    return (this.curvedAnimation ??= this.createCurve());
  }
  private createCurve(): CurvedAnimation {
    return new CurvedAnimation({ parent: this.controller, curve: this.widget.curve });
  }
  override initState(): void {
    super.initState();
    this.controller.addStatusListener((status) => {
      if (status === AnimationStatus.completed) this.widget.onEnd?.();
    });
    this.constructTweens();
    this.didUpdateTweens();
  }
  override didUpdateWidget(oldWidget: W): void {
    super.didUpdateWidget(oldWidget);
    if (!valuesEqual(this.widget.curve, oldWidget.curve)) {
      void this.animation;
      this.curvedAnimation!.dispose();
      this.curvedAnimation = this.createCurve();
    }
    this.controller.duration = this.widget.duration;
    if (this.constructTweens()) {
      this.forEachTween((tween, targetValue) => {
        if (tween !== null) {
          tween.begin = tween.evaluate(this.animation);
          tween.end = targetValue;
        }
        return tween;
      });
      this.controller.forward({ from: 0 });
      this.didUpdateTweens();
    }
  }
  private constructTweens(): boolean {
    let shouldStartAnimation = false;
    this.forEachTween((tween, targetValue, constructor) => {
      if (targetValue !== null) {
        tween ??= constructor(targetValue);
        if (!valuesEqual(targetValue, tween.end ?? tween.begin)) shouldStartAnimation = true;
        else tween.end ??= tween.begin;
      } else tween = null;
      return tween;
    });
    return shouldStartAnimation;
  }
  protected abstract forEachTween(visitor: TweenVisitor): void;
  protected didUpdateTweens(): void {}
  override dispose(): void {
    void this.animation;
    this.curvedAnimation!.dispose();
    this.controller.dispose();
    super.dispose();
  }
}
export abstract class AnimatedWidgetBaseState<
  W extends ImplicitlyAnimatedWidget,
> extends ImplicitlyAnimatedWidgetState<W> {
  private readonly handleAnimationChanged = () => this.setState(() => {});
  override initState(): void {
    super.initState();
    this.controller.addListener(this.handleAnimationChanged);
  }
}
export interface AnimatedContainerOptions extends ImplicitlyAnimatedWidgetOptions {
  readonly child?: Widget | null;
  readonly alignment?: AlignmentGeometry | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly color?: number | null;
  readonly decoration?: Decoration | null;
  readonly foregroundDecoration?: Decoration | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly constraints?: BoxConstraints | null;
  readonly margin?: EdgeInsetsGeometry | null;
  readonly transform?: Matrix4 | null;
  readonly transformAlignment?: AlignmentGeometry | null;
  readonly clipBehavior?: Clip;
}
export class AnimatedContainer extends ImplicitlyAnimatedWidget {
  readonly child: Widget | null;
  readonly alignment: AlignmentGeometry | null;
  readonly padding: EdgeInsetsGeometry | null;
  readonly decoration: Decoration | null;
  readonly foregroundDecoration: Decoration | null;
  readonly constraints: BoxConstraints | null;
  readonly margin: EdgeInsetsGeometry | null;
  readonly transform: Matrix4 | null;
  readonly transformAlignment: AlignmentGeometry | null;
  readonly clipBehavior: Clip;
  constructor(options: AnimatedContainerOptions) {
    super(options);
    const {
      child = null,
      alignment = null,
      padding = null,
      color = null,
      decoration = null,
      foregroundDecoration = null,
      width = null,
      height = null,
      constraints = null,
      margin = null,
      transform = null,
      transformAlignment = null,
      clipBehavior = 'none',
    } = options;
    if (FoundationBuildMode.debug) {
      invariant(
        margin === null || margin.isNonNegative,
        'negative-animated-margin',
        'AnimatedContainer margin must be nonnegative',
      );
      invariant(
        padding === null || padding.isNonNegative,
        'negative-animated-padding',
        'AnimatedContainer padding must be nonnegative',
      );
      invariant(
        decoration === null || decoration.debugAssertIsValid(),
        'invalid-animated-decoration',
        'AnimatedContainer decoration must be valid',
      );
      constraints?.debugAssertIsValid();
      invariant(
        color === null || decoration === null,
        'ambiguous-animated-color',
        'Choose either color or decoration',
      );
    }
    this.child = child;
    this.alignment = alignment;
    this.padding = padding;
    this.decoration = decoration ?? (color === null ? null : new BoxDecoration({ color }));
    this.foregroundDecoration = foregroundDecoration;
    this.constraints =
      width !== null || height !== null
        ? (constraints?.tighten(width, height) ?? BoxConstraints.tightFor(width, height))
        : constraints;
    this.margin = margin;
    this.transform = transform;
    this.transformAlignment = transformAlignment;
    this.clipBehavior = clipBehavior;
    protect(this, [
      'child',
      'alignment',
      'padding',
      'decoration',
      'foregroundDecoration',
      'constraints',
      'margin',
      'transform',
      'transformAlignment',
      'clipBehavior',
    ]);
  }
  override createState(): ImplicitlyAnimatedWidgetState<AnimatedContainer> {
    return new AnimatedContainerState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    for (const [name, value] of Object.entries({
      alignment: this.alignment,
      padding: this.padding,
      bg: this.decoration,
      fg: this.foregroundDecoration,
      constraints: this.constraints,
      margin: this.margin,
      transform: this.transform,
      transformAlignment: this.transformAlignment,
      clipBehavior: this.clipBehavior,
    }))
      properties.add(new DiagnosticsProperty(name, value, { defaultValue: null }));
  }
}
class AnimatedContainerState extends AnimatedWidgetBaseState<AnimatedContainer> {
  private alignment: Tween<AlignmentGeometry | null> | null = null;
  private padding: Tween<EdgeInsetsGeometry> | null = null;
  private decoration: Tween<Decoration> | null = null;
  private foregroundDecoration: Tween<Decoration> | null = null;
  private constraints: Tween<BoxConstraints> | null = null;
  private margin: Tween<EdgeInsetsGeometry> | null = null;
  private transform: Tween<Matrix4> | null = null;
  private transformAlignment: Tween<AlignmentGeometry | null> | null = null;
  protected forEachTween(visitor: TweenVisitor): void {
    this.alignment = visitor<AlignmentGeometry | null>(
      this.alignment,
      this.widget.alignment,
      (value) => new AlignmentGeometryTween({ begin: value }),
    );
    this.padding = visitor(
      this.padding,
      this.widget.padding,
      (value) => new EdgeInsetsGeometryTween({ begin: value }),
    );
    this.decoration = visitor(
      this.decoration,
      this.widget.decoration,
      (value) => new DecorationTween({ begin: value }),
    );
    this.foregroundDecoration = visitor(
      this.foregroundDecoration,
      this.widget.foregroundDecoration,
      (value) => new DecorationTween({ begin: value }),
    );
    this.constraints = visitor(
      this.constraints,
      this.widget.constraints,
      (value) => new BoxConstraintsTween({ begin: value }),
    );
    this.margin = visitor(
      this.margin,
      this.widget.margin,
      (value) => new EdgeInsetsGeometryTween({ begin: value }),
    );
    this.transform = visitor(
      this.transform,
      this.widget.transform,
      (value) => new Matrix4Tween({ begin: value }),
    );
    this.transformAlignment = visitor<AlignmentGeometry | null>(
      this.transformAlignment,
      this.widget.transformAlignment,
      (value) => new AlignmentGeometryTween({ begin: value }),
    );
  }
  build(_context: BuildContext): Widget {
    const animation = this.animation;
    return new Container({
      alignment: this.alignment?.evaluate(animation) ?? null,
      padding: this.padding?.evaluate(animation) ?? null,
      decoration: this.decoration?.evaluate(animation) ?? null,
      foregroundDecoration: this.foregroundDecoration?.evaluate(animation) ?? null,
      constraints: this.constraints?.evaluate(animation) ?? null,
      margin: this.margin?.evaluate(animation) ?? null,
      transform: this.transform?.evaluate(animation) ?? null,
      transformAlignment: this.transformAlignment?.evaluate(animation) ?? null,
      clipBehavior: this.widget.clipBehavior,
      child: this.widget.child,
    });
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    for (const [name, value] of Object.entries({
      alignment: this.alignment,
      padding: this.padding,
      bg: this.decoration,
      fg: this.foregroundDecoration,
      constraints: this.constraints,
      margin: this.margin,
      transform: this.transform,
      transformAlignment: this.transformAlignment,
    }))
      properties.add(new DiagnosticsProperty(name, value, { defaultValue: null }));
  }
}

export interface AnimatedPaddingOptions extends ImplicitlyAnimatedWidgetOptions {
  readonly padding: EdgeInsetsGeometry;
  readonly child?: Widget | null;
}
export class AnimatedPadding extends ImplicitlyAnimatedWidget {
  readonly padding: EdgeInsetsGeometry;
  readonly child: Widget | null;
  constructor(options: AnimatedPaddingOptions) {
    super(options);
    this.padding = options.padding;
    this.child = options.child ?? null;
    if (FoundationBuildMode.debug)
      invariant(
        this.padding.isNonNegative,
        'negative-animated-padding',
        'AnimatedPadding requires nonnegative padding',
      );
    protect(this, ['padding', 'child']);
  }
  override createState(): ImplicitlyAnimatedWidgetState<AnimatedPadding> {
    return new AnimatedPaddingState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('padding', this.padding));
  }
}
class AnimatedPaddingState extends AnimatedWidgetBaseState<AnimatedPadding> {
  private padding: Tween<EdgeInsetsGeometry> | null = null;
  protected forEachTween(visitor: TweenVisitor): void {
    this.padding = visitor(
      this.padding,
      this.widget.padding,
      (value) => new EdgeInsetsGeometryTween({ begin: value }),
    );
  }
  build(_context: BuildContext): Widget {
    return new Padding(
      this.padding!.evaluate(this.animation).clamp(EdgeInsets.zero, EdgeInsetsGeometry.infinity),
      this.widget.child ?? undefined,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('padding', this.padding, { defaultValue: null }));
  }
}
export interface AnimatedAlignOptions extends ImplicitlyAnimatedWidgetOptions {
  readonly alignment: AlignmentGeometry;
  readonly child?: Widget | null;
  readonly heightFactor?: number | null;
  readonly widthFactor?: number | null;
}
export class AnimatedAlign extends ImplicitlyAnimatedWidget {
  readonly alignment: AlignmentGeometry;
  readonly child: Widget | null;
  readonly heightFactor: number | null;
  readonly widthFactor: number | null;
  constructor(options: AnimatedAlignOptions) {
    super(options);
    this.alignment = options.alignment;
    this.child = options.child ?? null;
    this.heightFactor = options.heightFactor ?? null;
    this.widthFactor = options.widthFactor ?? null;
    checkFactors(this.widthFactor, this.heightFactor);
    protect(this, ['alignment', 'child', 'heightFactor', 'widthFactor']);
  }
  override createState(): ImplicitlyAnimatedWidgetState<AnimatedAlign> {
    return new AnimatedAlignState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('alignment', this.alignment));
  }
}
function checkFactors(width: number | null, height: number | null): void {
  if (FoundationBuildMode.debug)
    invariant(
      (width === null || width >= 0) && (height === null || height >= 0),
      'negative-animated-factor',
      'Animated size factors must be nonnegative',
    );
}
class AnimatedAlignState extends AnimatedWidgetBaseState<AnimatedAlign> {
  protected alignment: Tween<AlignmentGeometry | null> | null = null;
  protected heightFactorTween: Tween<number> | null = null;
  protected widthFactorTween: Tween<number> | null = null;
  protected forEachTween(visitor: TweenVisitor): void {
    this.alignment = visitor<AlignmentGeometry | null>(
      this.alignment,
      this.widget.alignment,
      (value) => new AlignmentGeometryTween({ begin: value }),
    );
    // The pinned source deliberately skips nullable factors instead of clearing their tweens.
    if (this.widget.heightFactor !== null)
      this.heightFactorTween = visitor(
        this.heightFactorTween,
        this.widget.heightFactor,
        (value) => new Tween({ begin: value }),
      );
    if (this.widget.widthFactor !== null)
      this.widthFactorTween = visitor(
        this.widthFactorTween,
        this.widget.widthFactor,
        (value) => new Tween({ begin: value }),
      );
  }
  build(_context: BuildContext): Widget {
    return new Align(this.widget.child ?? undefined, {
      alignment: this.alignment!.evaluate(this.animation)!,
      ...(this.heightFactorTween === null
        ? {}
        : { heightFactor: this.heightFactorTween.evaluate(this.animation) }),
      ...(this.widthFactorTween === null
        ? {}
        : { widthFactor: this.widthFactorTween.evaluate(this.animation) }),
    });
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('alignment', this.alignment, { defaultValue: null }));
    properties.add(
      new DiagnosticsProperty('widthFactor', this.widthFactorTween, { defaultValue: null }),
    );
    properties.add(
      new DiagnosticsProperty('heightFactor', this.heightFactorTween, { defaultValue: null }),
    );
  }
}
export interface AnimatedPositionedOptions extends ImplicitlyAnimatedWidgetOptions {
  readonly child: Widget;
  readonly left?: number | null;
  readonly top?: number | null;
  readonly right?: number | null;
  readonly bottom?: number | null;
  readonly width?: number | null;
  readonly height?: number | null;
}
export class AnimatedPositioned extends ImplicitlyAnimatedWidget {
  readonly child: Widget;
  readonly left: number | null;
  readonly top: number | null;
  readonly right: number | null;
  readonly bottom: number | null;
  readonly width: number | null;
  readonly height: number | null;
  constructor(options: AnimatedPositionedOptions) {
    super(options);
    this.child = options.child;
    this.left = options.left ?? null;
    this.top = options.top ?? null;
    this.right = options.right ?? null;
    this.bottom = options.bottom ?? null;
    this.width = options.width ?? null;
    this.height = options.height ?? null;
    checkPosition(this.left, this.right, this.width, this.top, this.bottom, this.height);
    protect(this, ['child', 'left', 'top', 'right', 'bottom', 'width', 'height']);
  }
  static fromRect({
    rect,
    ...options
  }: Omit<AnimatedPositionedOptions, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'> & {
    readonly rect: Rect;
  }): AnimatedPositioned {
    return new AnimatedPositioned({
      ...options,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }
  override createState(): ImplicitlyAnimatedWidgetState<AnimatedPositioned> {
    return new AnimatedPositionedState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    positionProperties(this, properties, ['left', 'top', 'right', 'bottom', 'width', 'height']);
  }
}
function checkPosition(
  leading: number | null,
  trailing: number | null,
  width: number | null,
  top: number | null,
  bottom: number | null,
  height: number | null,
): void {
  if (FoundationBuildMode.debug)
    invariant(
      (leading === null || trailing === null || width === null) &&
        (top === null || bottom === null || height === null),
      'overconstrained-animated-position',
      'Each positioned axis accepts at most two edges/extent',
    );
}
function positionProperties<T>(
  owner: T,
  properties: DiagnosticPropertiesBuilder,
  names: readonly (keyof T)[],
): void {
  for (const name of names)
    properties.add(
      new DoubleProperty(String(name), owner[name] as number | null, { defaultValue: null }),
    );
}
class AnimatedPositionedState extends AnimatedWidgetBaseState<AnimatedPositioned> {
  private left: Tween<number> | null = null;
  private top: Tween<number> | null = null;
  private right: Tween<number> | null = null;
  private bottom: Tween<number> | null = null;
  private width: Tween<number> | null = null;
  private height: Tween<number> | null = null;
  protected forEachTween(visitor: TweenVisitor): void {
    for (const name of ['left', 'top', 'right', 'bottom', 'width', 'height'] as const)
      this[name] = visitor(this[name], this.widget[name], (value) => new Tween({ begin: value }));
  }
  build(_context: BuildContext): Widget {
    return new Positioned(this.widget.child, {
      ...(this.left === null ? {} : { left: this.left.evaluate(this.animation) }),
      ...(this.top === null ? {} : { top: this.top.evaluate(this.animation) }),
      ...(this.right === null ? {} : { right: this.right.evaluate(this.animation) }),
      ...(this.bottom === null ? {} : { bottom: this.bottom.evaluate(this.animation) }),
      ...(this.width === null ? {} : { width: this.width.evaluate(this.animation) }),
      ...(this.height === null ? {} : { height: this.height.evaluate(this.animation) }),
    });
  }
}
export interface AnimatedPositionedDirectionalOptions extends Omit<
  AnimatedPositionedOptions,
  'left' | 'right'
> {
  readonly start?: number | null;
  readonly end?: number | null;
}
export class AnimatedPositionedDirectional extends ImplicitlyAnimatedWidget {
  readonly child: Widget;
  readonly start: number | null;
  readonly top: number | null;
  readonly end: number | null;
  readonly bottom: number | null;
  readonly width: number | null;
  readonly height: number | null;
  constructor(options: AnimatedPositionedDirectionalOptions) {
    super(options);
    this.child = options.child;
    this.start = options.start ?? null;
    this.top = options.top ?? null;
    this.end = options.end ?? null;
    this.bottom = options.bottom ?? null;
    this.width = options.width ?? null;
    this.height = options.height ?? null;
    checkPosition(this.start, this.end, this.width, this.top, this.bottom, this.height);
    protect(this, ['child', 'start', 'top', 'end', 'bottom', 'width', 'height']);
  }
  override createState(): ImplicitlyAnimatedWidgetState<AnimatedPositionedDirectional> {
    return new AnimatedPositionedDirectionalState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    positionProperties(this, properties, ['start', 'top', 'end', 'bottom', 'width', 'height']);
  }
}
class AnimatedPositionedDirectionalState extends AnimatedWidgetBaseState<AnimatedPositionedDirectional> {
  private start: Tween<number> | null = null;
  private top: Tween<number> | null = null;
  private end: Tween<number> | null = null;
  private bottom: Tween<number> | null = null;
  private width: Tween<number> | null = null;
  private height: Tween<number> | null = null;
  protected forEachTween(visitor: TweenVisitor): void {
    for (const name of ['start', 'top', 'end', 'bottom', 'width', 'height'] as const)
      this[name] = visitor(this[name], this.widget[name], (value) => new Tween({ begin: value }));
  }
  build(context: BuildContext): Widget {
    return Positioned.directional(this.widget.child, {
      textDirection: Directionality.of(context),
      ...(this.start === null ? {} : { start: this.start.evaluate(this.animation) }),
      ...(this.top === null ? {} : { top: this.top.evaluate(this.animation) }),
      ...(this.end === null ? {} : { end: this.end.evaluate(this.animation) }),
      ...(this.bottom === null ? {} : { bottom: this.bottom.evaluate(this.animation) }),
      ...(this.width === null ? {} : { width: this.width.evaluate(this.animation) }),
      ...(this.height === null ? {} : { height: this.height.evaluate(this.animation) }),
    });
  }
}
export interface AnimatedScaleOptions extends ImplicitlyAnimatedWidgetOptions {
  readonly child?: Widget | null;
  readonly scale: number;
  readonly alignment?: Alignment;
  readonly filterQuality?: FilterQuality | null;
}
export class AnimatedScale extends ImplicitlyAnimatedWidget {
  readonly child: Widget | null;
  readonly scale: number;
  readonly alignment: Alignment;
  readonly filterQuality: FilterQuality | null;
  constructor(options: AnimatedScaleOptions) {
    super(options);
    this.child = options.child ?? null;
    this.scale = options.scale;
    this.alignment = options.alignment ?? Alignment.center;
    this.filterQuality = options.filterQuality ?? null;
    protect(this, ['child', 'scale', 'alignment', 'filterQuality']);
  }
  override createState(): ImplicitlyAnimatedWidgetState<AnimatedScale> {
    return new AnimatedScaleState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DoubleProperty('scale', this.scale));
    properties.add(
      new DiagnosticsProperty('alignment', this.alignment, { defaultValue: Alignment.center }),
    );
    properties.add(
      new DiagnosticsProperty('filterQuality', this.filterQuality, { defaultValue: null }),
    );
  }
}
class AnimatedScaleState extends ImplicitlyAnimatedWidgetState<AnimatedScale> {
  private scale: Tween<number> | null = null;
  private scaleAnimation!: Animation<number>;
  protected forEachTween(visitor: TweenVisitor): void {
    this.scale = visitor(this.scale, this.widget.scale, (value) => new Tween({ begin: value }));
  }
  protected override didUpdateTweens(): void {
    this.scaleAnimation = this.animation.drive(this.scale!);
  }
  build(_context: BuildContext): Widget {
    return new ScaleTransition({
      scale: this.scaleAnimation,
      alignment: this.widget.alignment,
      filterQuality: this.widget.filterQuality,
      child: this.widget.child,
    });
  }
}
export interface AnimatedRotationOptions extends Omit<AnimatedScaleOptions, 'scale'> {
  readonly turns: number;
}
export class AnimatedRotation extends ImplicitlyAnimatedWidget {
  readonly child: Widget | null;
  readonly turns: number;
  readonly alignment: Alignment;
  readonly filterQuality: FilterQuality | null;
  constructor(options: AnimatedRotationOptions) {
    super(options);
    this.child = options.child ?? null;
    this.turns = options.turns;
    this.alignment = options.alignment ?? Alignment.center;
    this.filterQuality = options.filterQuality ?? null;
    protect(this, ['child', 'turns', 'alignment', 'filterQuality']);
  }
  override createState(): ImplicitlyAnimatedWidgetState<AnimatedRotation> {
    return new AnimatedRotationState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DoubleProperty('turns', this.turns));
    properties.add(
      new DiagnosticsProperty('alignment', this.alignment, { defaultValue: Alignment.center }),
    );
    properties.add(
      new DiagnosticsProperty('filterQuality', this.filterQuality, { defaultValue: null }),
    );
  }
}
class AnimatedRotationState extends ImplicitlyAnimatedWidgetState<AnimatedRotation> {
  private turns: Tween<number> | null = null;
  private turnsAnimation!: Animation<number>;
  protected forEachTween(visitor: TweenVisitor): void {
    this.turns = visitor(this.turns, this.widget.turns, (value) => new Tween({ begin: value }));
  }
  protected override didUpdateTweens(): void {
    this.turnsAnimation = this.animation.drive(this.turns!);
  }
  build(_context: BuildContext): Widget {
    return new RotationTransition({
      turns: this.turnsAnimation,
      alignment: this.widget.alignment,
      filterQuality: this.widget.filterQuality,
      child: this.widget.child,
    });
  }
}
export interface AnimatedSlideOptions extends ImplicitlyAnimatedWidgetOptions {
  readonly child?: Widget | null;
  readonly offset: Offset;
}
export class AnimatedSlide extends ImplicitlyAnimatedWidget {
  readonly child: Widget | null;
  readonly offset: Offset;
  constructor(options: AnimatedSlideOptions) {
    super(options);
    this.child = options.child ?? null;
    this.offset = options.offset;
    protect(this, ['child', 'offset']);
  }
  override createState(): ImplicitlyAnimatedWidgetState<AnimatedSlide> {
    return new AnimatedSlideState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('offset', this.offset));
  }
}
class AnimatedSlideState extends ImplicitlyAnimatedWidgetState<AnimatedSlide> {
  private offset: Tween<Offset> | null = null;
  private offsetAnimation!: Animation<Offset>;
  protected forEachTween(visitor: TweenVisitor): void {
    this.offset = visitor(this.offset, this.widget.offset, (value) => new Tween({ begin: value }));
  }
  protected override didUpdateTweens(): void {
    this.offsetAnimation = this.animation.drive(this.offset!);
  }
  build(_context: BuildContext): Widget {
    return new SlideTransition({ position: this.offsetAnimation, child: this.widget.child });
  }
}
export interface AnimatedOpacityOptions extends ImplicitlyAnimatedWidgetOptions {
  readonly child?: Widget | null;
  readonly opacity: number;
  readonly alwaysIncludeSemantics?: boolean;
}
export class AnimatedOpacity extends ImplicitlyAnimatedWidget {
  readonly child: Widget | null;
  readonly opacity: number;
  readonly alwaysIncludeSemantics: boolean;
  constructor(options: AnimatedOpacityOptions) {
    super(options);
    this.child = options.child ?? null;
    this.opacity = options.opacity;
    this.alwaysIncludeSemantics = options.alwaysIncludeSemantics ?? false;
    checkOpacity(this.opacity);
    protect(this, ['child', 'opacity', 'alwaysIncludeSemantics']);
  }
  override createState(): ImplicitlyAnimatedWidgetState<AnimatedOpacity> {
    return new AnimatedOpacityState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DoubleProperty('opacity', this.opacity));
  }
}
function checkOpacity(value: number): void {
  if (FoundationBuildMode.debug)
    invariant(
      value >= 0 && value <= 1,
      'invalid-animated-opacity',
      'Animated opacity must be within 0..1',
    );
}
class AnimatedOpacityState extends ImplicitlyAnimatedWidgetState<AnimatedOpacity> {
  private opacity: Tween<number> | null = null;
  private opacityAnimation!: Animation<number>;
  protected forEachTween(visitor: TweenVisitor): void {
    this.opacity = visitor(
      this.opacity,
      this.widget.opacity,
      (value) => new Tween({ begin: value }),
    );
  }
  protected override didUpdateTweens(): void {
    this.opacityAnimation = this.animation.drive(this.opacity!);
  }
  build(_context: BuildContext): Widget {
    return new FadeTransition({
      opacity: this.opacityAnimation,
      alwaysIncludeSemantics: this.widget.alwaysIncludeSemantics,
      child: this.widget.child,
    });
  }
}
export interface SliverAnimatedOpacityOptions extends Omit<AnimatedOpacityOptions, 'child'> {
  readonly sliver?: Widget | null;
}
export class SliverAnimatedOpacity extends ImplicitlyAnimatedWidget {
  readonly sliver: Widget | null;
  readonly opacity: number;
  readonly alwaysIncludeSemantics: boolean;
  constructor(options: SliverAnimatedOpacityOptions) {
    super(options);
    this.sliver = options.sliver ?? null;
    this.opacity = options.opacity;
    this.alwaysIncludeSemantics = options.alwaysIncludeSemantics ?? false;
    checkOpacity(this.opacity);
    protect(this, ['sliver', 'opacity', 'alwaysIncludeSemantics']);
  }
  override createState(): ImplicitlyAnimatedWidgetState<SliverAnimatedOpacity> {
    return new SliverAnimatedOpacityState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DoubleProperty('opacity', this.opacity));
  }
}
class SliverAnimatedOpacityState extends ImplicitlyAnimatedWidgetState<SliverAnimatedOpacity> {
  private opacity: Tween<number> | null = null;
  private opacityAnimation!: Animation<number>;
  protected forEachTween(visitor: TweenVisitor): void {
    this.opacity = visitor(
      this.opacity,
      this.widget.opacity,
      (value) => new Tween({ begin: value }),
    );
  }
  protected override didUpdateTweens(): void {
    this.opacityAnimation = this.animation.drive(this.opacity!);
  }
  build(_context: BuildContext): Widget {
    return new SliverFadeTransition({
      opacity: this.opacityAnimation,
      alwaysIncludeSemantics: this.widget.alwaysIncludeSemantics,
      sliver: this.widget.sliver,
    });
  }
}
export interface AnimatedFractionallySizedBoxOptions extends Omit<
  AnimatedAlignOptions,
  'alignment'
> {
  readonly alignment?: AlignmentGeometry;
}
export class AnimatedFractionallySizedBox extends ImplicitlyAnimatedWidget {
  readonly alignment: AlignmentGeometry;
  readonly child: Widget | null;
  readonly heightFactor: number | null;
  readonly widthFactor: number | null;
  constructor(options: AnimatedFractionallySizedBoxOptions) {
    super(options);
    this.alignment = options.alignment ?? Alignment.center;
    this.child = options.child ?? null;
    this.heightFactor = options.heightFactor ?? null;
    this.widthFactor = options.widthFactor ?? null;
    checkFactors(this.widthFactor, this.heightFactor);
    protect(this, ['alignment', 'child', 'heightFactor', 'widthFactor']);
  }
  override createState(): ImplicitlyAnimatedWidgetState<AnimatedFractionallySizedBox> {
    return new AnimatedFractionallySizedBoxState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('alignment', this.alignment));
    properties.add(new DoubleProperty('widthFactor', this.widthFactor));
    properties.add(new DoubleProperty('heightFactor', this.heightFactor));
  }
}
class AnimatedFractionallySizedBoxState extends AnimatedWidgetBaseState<AnimatedFractionallySizedBox> {
  private alignment: Tween<AlignmentGeometry | null> | null = null;
  private heightFactorTween: Tween<number> | null = null;
  private widthFactorTween: Tween<number> | null = null;
  protected forEachTween(visitor: TweenVisitor): void {
    this.alignment = visitor<AlignmentGeometry | null>(
      this.alignment,
      this.widget.alignment,
      (value) => new AlignmentGeometryTween({ begin: value }),
    );
    if (this.widget.heightFactor !== null)
      this.heightFactorTween = visitor(
        this.heightFactorTween,
        this.widget.heightFactor,
        (value) => new Tween({ begin: value }),
      );
    if (this.widget.widthFactor !== null)
      this.widthFactorTween = visitor(
        this.widthFactorTween,
        this.widget.widthFactor,
        (value) => new Tween({ begin: value }),
      );
  }
  build(_context: BuildContext): Widget {
    return new FractionallySizedBox(this.widget.child ?? undefined, {
      alignment: this.alignment!.evaluate(this.animation)!,
      heightFactor: this.heightFactorTween?.evaluate(this.animation) ?? null,
      widthFactor: this.widthFactorTween?.evaluate(this.animation) ?? null,
    });
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('alignment', this.alignment, { defaultValue: null }));
    properties.add(
      new DiagnosticsProperty('widthFactor', this.widthFactorTween, { defaultValue: null }),
    );
    properties.add(
      new DiagnosticsProperty('heightFactor', this.heightFactorTween, { defaultValue: null }),
    );
  }
}
export interface AnimatedDefaultTextStyleOptions extends ImplicitlyAnimatedWidgetOptions {
  readonly child: Widget;
  readonly style: TextStyle;
  readonly textAlign?: TextAlign | null;
  readonly softWrap?: boolean;
  readonly overflow?: TextOverflow;
  readonly maxLines?: number | null;
  readonly textWidthBasis?: TextWidthBasis;
  readonly textHeightBehavior?: TextHeightBehavior | null;
}
export class AnimatedDefaultTextStyle extends ImplicitlyAnimatedWidget {
  readonly child: Widget;
  readonly style: TextStyle;
  readonly textAlign: TextAlign | null;
  readonly softWrap: boolean;
  readonly overflow: TextOverflow;
  readonly maxLines: number | null;
  readonly textWidthBasis: TextWidthBasis;
  readonly textHeightBehavior: TextHeightBehavior | null;
  constructor(options: AnimatedDefaultTextStyleOptions) {
    super(options);
    this.child = options.child;
    this.style = options.style;
    this.textAlign = options.textAlign ?? null;
    this.softWrap = options.softWrap ?? true;
    this.overflow = options.overflow ?? 'clip';
    this.maxLines = options.maxLines ?? null;
    this.textWidthBasis = options.textWidthBasis ?? 'parent';
    this.textHeightBehavior = options.textHeightBehavior ?? null;
    if (FoundationBuildMode.debug)
      invariant(
        this.maxLines === null || this.maxLines > 0,
        'invalid-animated-text-lines',
        'AnimatedDefaultTextStyle maxLines must be positive',
      );
    protect(this, [
      'child',
      'style',
      'textAlign',
      'softWrap',
      'overflow',
      'maxLines',
      'textWidthBasis',
      'textHeightBehavior',
    ]);
  }
  override createState(): ImplicitlyAnimatedWidgetState<AnimatedDefaultTextStyle> {
    return new AnimatedDefaultTextStyleState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('style', this.style));
    properties.add(new DiagnosticsProperty('textAlign', this.textAlign, { defaultValue: null }));
    properties.add(new DiagnosticsProperty('softWrap', this.softWrap));
    properties.add(new DiagnosticsProperty('overflow', this.overflow));
    properties.add(new IntProperty('maxLines', this.maxLines, { defaultValue: null }));
    properties.add(
      new DiagnosticsProperty('textWidthBasis', this.textWidthBasis, { defaultValue: 'parent' }),
    );
    properties.add(
      new DiagnosticsProperty('textHeightBehavior', this.textHeightBehavior, {
        defaultValue: null,
      }),
    );
  }
}
class AnimatedDefaultTextStyleState extends AnimatedWidgetBaseState<AnimatedDefaultTextStyle> {
  private style: Tween<TextStyle> | null = null;
  protected forEachTween(visitor: TweenVisitor): void {
    this.style = visitor(
      this.style,
      this.widget.style,
      (value) => new TextStyleTween({ begin: value }),
    );
  }
  build(_context: BuildContext): Widget {
    return new DefaultTextStyle(this.style!.evaluate(this.animation), this.widget.child, {
      textAlign: this.widget.textAlign,
      softWrap: this.widget.softWrap,
      overflow: this.widget.overflow,
      maxLines: this.widget.maxLines,
      textWidthBasis: this.widget.textWidthBasis,
      textHeightBehavior: this.widget.textHeightBehavior,
    });
  }
}

export interface AnimatedPhysicalModelOptions extends ImplicitlyAnimatedWidgetOptions {
  readonly child: Widget;
  readonly shape?: BoxShape;
  readonly clipBehavior?: Clip;
  readonly borderRadius?: BorderRadius | null;
  readonly elevation?: number;
  readonly color: number;
  readonly animateColor?: boolean;
  readonly shadowColor: number;
  readonly animateShadowColor?: boolean;
}
export class AnimatedPhysicalModel extends ImplicitlyAnimatedWidget {
  readonly child: Widget;
  readonly shape: BoxShape;
  readonly clipBehavior: Clip;
  readonly borderRadius: BorderRadius | null;
  readonly elevation: number;
  readonly color: number;
  readonly animateColor: boolean;
  readonly shadowColor: number;
  readonly animateShadowColor: boolean;
  constructor(options: AnimatedPhysicalModelOptions) {
    super(options);
    this.child = options.child;
    this.shape = options.shape ?? 'rectangle';
    this.clipBehavior = options.clipBehavior ?? 'none';
    this.borderRadius = options.borderRadius ?? null;
    this.elevation = options.elevation ?? 0;
    this.color = options.color;
    this.animateColor = options.animateColor ?? true;
    this.shadowColor = options.shadowColor;
    this.animateShadowColor = options.animateShadowColor ?? true;
    if (FoundationBuildMode.debug)
      invariant(
        this.elevation >= 0,
        'invalid-elevation',
        'AnimatedPhysicalModel elevation must be nonnegative',
      );
    protect(this, [
      'child',
      'shape',
      'clipBehavior',
      'borderRadius',
      'elevation',
      'color',
      'animateColor',
      'shadowColor',
      'animateShadowColor',
    ]);
  }
  override createState(): ImplicitlyAnimatedWidgetState<AnimatedPhysicalModel> {
    return new AnimatedPhysicalModelState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('shape', this.shape));
    properties.add(new DiagnosticsProperty('borderRadius', this.borderRadius));
    properties.add(new DoubleProperty('elevation', this.elevation));
    properties.add(new DiagnosticsProperty('color', this.color));
    properties.add(new DiagnosticsProperty('animateColor', this.animateColor));
    properties.add(new DiagnosticsProperty('shadowColor', this.shadowColor));
    properties.add(new DiagnosticsProperty('animateShadowColor', this.animateShadowColor));
  }
}
class AnimatedPhysicalModelState extends AnimatedWidgetBaseState<AnimatedPhysicalModel> {
  private borderRadiusTween: Tween<BorderRadius | null> | null = null;
  private elevationTween: Tween<number> | null = null;
  private colorTween: Tween<Color | null> | null = null;
  private shadowColorTween: Tween<Color | null> | null = null;
  protected forEachTween(visitor: TweenVisitor): void {
    this.borderRadiusTween = visitor<BorderRadius | null>(
      this.borderRadiusTween,
      this.widget.borderRadius ?? BorderRadius.zero,
      (value) => new BorderRadiusTween({ begin: value }),
    );
    this.elevationTween = visitor(
      this.elevationTween,
      this.widget.elevation,
      (value) => new Tween({ begin: value }),
    );
    this.colorTween = visitor<Color | null>(
      this.colorTween,
      new Color(this.widget.color),
      (value) => new ColorTween({ begin: value }),
    );
    this.shadowColorTween = visitor<Color | null>(
      this.shadowColorTween,
      new Color(this.widget.shadowColor),
      (value) => new ColorTween({ begin: value }),
    );
  }
  build(_context: BuildContext): Widget {
    return new PhysicalModel({
      shape: this.widget.shape,
      clipBehavior: this.widget.clipBehavior,
      borderRadius: this.borderRadiusTween!.evaluate(this.animation),
      elevation: this.elevationTween!.evaluate(this.animation),
      color: this.widget.animateColor
        ? this.colorTween!.evaluate(this.animation)!.toARGB32()
        : this.widget.color,
      shadowColor: this.widget.animateShadowColor
        ? this.shadowColorTween!.evaluate(this.animation)!.toARGB32()
        : this.widget.shadowColor,
      child: this.widget.child,
    });
  }
}
