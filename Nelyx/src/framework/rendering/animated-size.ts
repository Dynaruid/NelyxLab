// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned rendering/animated_size.dart, with returned-size layout and owned layer adapters.
import { RenderAligningShiftedBox } from './shifted-box.ts';
import type { RenderAligningShiftedBoxOptions } from './shifted-box.ts';
import type { PipelineOwner, TextBaseline } from './object.ts';
import { BoxConstraints } from './constraints.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import { CurvedAnimation } from '../animation/animations.ts';
import { AnimationStatus } from '../animation/animation.ts';
import { Curves } from '../animation/curves.ts';
import type { Curve } from '../animation/curves.ts';
import type { TickerProvider } from '../animation/ticker.ts';
import { LayerHandle, ClipRectLayer } from './layer.ts';
import type { PaintingContext } from '../painting/context.ts';
import { Offset } from '../../ui/offset.ts';
import type { Size } from '../../ui/geometry.ts';
import type { Clip } from '../../ui/clip.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
export class RenderAnimatedSizeState {
  static readonly start = new RenderAnimatedSizeState(0, 'start');
  static readonly stable = new RenderAnimatedSizeState(1, 'stable');
  static readonly changed = new RenderAnimatedSizeState(2, 'changed');
  static readonly unstable = new RenderAnimatedSizeState(3, 'unstable');
  static readonly values = Object.freeze([this.start, this.stable, this.changed, this.unstable]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'RenderAnimatedSizeState.' + this.name;
  }
}
export interface RenderAnimatedSizeOptions extends RenderAligningShiftedBoxOptions {
  readonly vsync: TickerProvider;
  readonly duration: number;
  readonly reverseDuration?: number | null;
  readonly curve?: Curve;
  readonly clipBehavior?: Clip;
  readonly onEnd?: (() => void) | null;
}
const equal = (a: Size | null, b: Size) =>
  a !== null && a.width === b.width && a.height === b.height;
export class RenderAnimatedSize extends RenderAligningShiftedBox {
  private readonly controller: AnimationController;
  private readonly animation: CurvedAnimation;
  private readonly clipLayer = new LayerHandle<ClipRectLayer>();
  private provider: TickerProvider;
  private clipping: Clip;
  private completion: (() => void) | null;
  private currentState = RenderAnimatedSizeState.start;
  private begin: Size | null = null;
  private end: Size | null = null;
  private current: Size = { width: 0, height: 0 };
  private lastValue: number | null = null;
  private overflow = false;
  private retired = false;
  constructor({
    vsync,
    duration,
    reverseDuration = null,
    curve = Curves.linear,
    clipBehavior = 'hardEdge',
    onEnd = null,
    ...options
  }: RenderAnimatedSizeOptions) {
    super(options);
    this.provider = vsync;
    this.clipping = clipBehavior;
    this.completion = onEnd;
    this.controller = new AnimationController({ vsync, duration, reverseDuration });
    this.controller.addListener(this.changed);
    this.animation = new CurvedAnimation({ parent: this.controller, curve });
  }
  private readonly changed = () => {
    if (this.controller.value !== this.lastValue) this.markNeedsLayout();
  };
  private readonly statusChanged = (status: AnimationStatus) => {
    if (status === AnimationStatus.completed) this.completion?.();
  };
  get debugController(): AnimationController | null {
    return FoundationBuildMode.debug ? this.controller : null;
  }
  get debugAnimation(): CurvedAnimation | null {
    return FoundationBuildMode.debug ? this.animation : null;
  }
  get state(): RenderAnimatedSizeState {
    return this.currentState;
  }
  get isAnimating(): boolean {
    return this.controller.isAnimating;
  }
  get duration(): number {
    return this.controller.duration!;
  }
  set duration(value: number) {
    this.controller.duration = value;
  }
  get reverseDuration(): number | null {
    return this.controller.reverseDuration;
  }
  set reverseDuration(value: number | null) {
    this.controller.reverseDuration = value;
  }
  get curve(): Curve {
    return this.animation.curve;
  }
  set curve(value: Curve) {
    this.animation.curve = value;
  }
  get clipBehavior(): Clip {
    return this.clipping;
  }
  set clipBehavior(value: Clip) {
    this.assertCanMutateLayoutProperty();
    if (value !== this.clipping) {
      this.clipping = value;
      this.markNeedsPaint();
      this.markNeedsSemanticsUpdate();
    }
  }
  get vsync(): TickerProvider {
    return this.provider;
  }
  set vsync(value: TickerProvider) {
    if (value !== this.provider) {
      this.provider = value;
      this.controller.resync(value);
    }
  }
  get onEnd(): (() => void) | null {
    return this.completion;
  }
  set onEnd(value: (() => void) | null) {
    this.completion = value;
  }
  override get clips(): boolean {
    return this.overflow && this.clipping !== 'none';
  }
  override attach(owner: PipelineOwner): void {
    super.attach(owner);
    if (
      this.currentState === RenderAnimatedSizeState.changed ||
      this.currentState === RenderAnimatedSizeState.unstable
    )
      this.markNeedsLayout();
    this.controller.addStatusListener(this.statusChanged);
  }
  override detach(): void {
    this.controller.stop();
    this.controller.removeStatusListener(this.statusChanged);
    try {
      super.detach();
    } finally {
      if (!this.attached) this.clipLayer.dispose();
    }
  }
  private get animatedSize(): Size {
    const value = this.animation.value;
    return {
      width: this.begin!.width * (1 - value) + this.end!.width * value,
      height: this.begin!.height * (1 - value) + this.end!.height * value,
    };
  }
  private restart(): void {
    this.lastValue = 0;
    this.controller.forward({ from: 0 });
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    this.lastValue = this.controller.value;
    this.overflow = false;
    const child = this.child;
    if (!child || constraints.isTight) {
      this.controller.stop();
      this.current = this.begin = this.end = constraints.smallest;
      this.currentState = RenderAnimatedSizeState.start;
      child?.layout(constraints);
      return this.current;
    }
    child.layout(constraints, { parentUsesSize: true });
    const childSize = child.size;
    switch (this.currentState) {
      case RenderAnimatedSizeState.start:
        this.begin = this.end = childSize;
        this.currentState = RenderAnimatedSizeState.stable;
        break;
      case RenderAnimatedSizeState.stable:
        if (!equal(this.end, childSize)) {
          this.begin = this.current;
          this.end = childSize;
          this.restart();
          this.currentState = RenderAnimatedSizeState.changed;
        } else if (this.controller.value === this.controller.upperBound) {
          this.begin = this.end = childSize;
        } else if (!this.controller.isAnimating) this.controller.forward();
        break;
      case RenderAnimatedSizeState.changed:
        if (!equal(this.end, childSize)) {
          this.begin = this.end = childSize;
          this.restart();
          this.currentState = RenderAnimatedSizeState.unstable;
        } else {
          this.currentState = RenderAnimatedSizeState.stable;
          if (!this.controller.isAnimating) this.controller.forward();
        }
        break;
      case RenderAnimatedSizeState.unstable:
        if (!equal(this.end, childSize)) {
          this.begin = this.end = childSize;
          this.restart();
        } else {
          this.controller.stop();
          this.currentState = RenderAnimatedSizeState.stable;
        }
        break;
    }
    this.current = constraints.constrain(this.animatedSize);
    child.layoutOffset = this.resolvedAlignment.alongOffset(
      new Offset(this.current.width - childSize.width, this.current.height - childSize.height),
    );
    this.overflow = this.current.width < this.end!.width || this.current.height < this.end!.height;
    return this.current;
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    if (!this.child || constraints.isTight) return constraints.smallest;
    const child = this.child.getDryLayout(constraints);
    switch (this.currentState) {
      case RenderAnimatedSizeState.start:
        return constraints.constrain(child);
      case RenderAnimatedSizeState.stable:
        if (!equal(this.end, child)) return constraints.constrain(this.current);
        if (this.controller.value === this.controller.upperBound)
          return constraints.constrain(child);
        break;
      case RenderAnimatedSizeState.changed:
      case RenderAnimatedSizeState.unstable:
        if (!equal(this.end, child)) return constraints.constrain(child);
        break;
    }
    return constraints.constrain(this.animatedSize);
  }
  protected override computeDryBaseline(
    constraints: BoxConstraints,
    baseline: TextBaseline,
  ): number | null {
    if (!this.child) return null;
    const result = this.child.getDryBaseline(constraints, baseline);
    if (result === null) return null;
    const child = this.child.getDryLayout(constraints),
      size = this.getDryLayout(constraints);
    return (
      result +
      this.resolvedAlignment.alongOffset(
        new Offset(size.width - child.width, size.height - child.height),
      ).dy
    );
  }
  override paint(context: PaintingContext): void {
    if (this.child && this.clips) {
      const layer =
        this.clipLayer.layer ??
        new ClipRectLayer({ clipRect: { x: 0, y: 0, ...this.size }, clipBehavior: this.clipping });
      this.clipLayer.layer = layer;
      layer.clipRect = { x: 0, y: 0, ...this.size };
      layer.clipBehavior = this.clipping;
      context.pushLayer(layer, (child) => super.paint(child));
    } else {
      this.clipLayer.dispose();
      super.paint(context);
    }
  }
  override dispose(): void {
    if (this.retired) return;
    this.retired = true;
    const errors: unknown[] = [];
    for (const close of [
      () => this.clipLayer.dispose(),
      () => this.controller.dispose(),
      () => this.animation.dispose(),
      () => super.dispose(),
    ])
      try {
        close();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'AnimatedSize retirement failed');
  }
}
