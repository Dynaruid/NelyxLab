// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/floating_action_button_location.dart
// @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { Offset } from '@nelyx/core/ui/offset';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import {
  AlwaysStoppedAnimation,
  CompoundAnimation,
  ReverseAnimation,
} from '@nelyx/core/framework/animation/animations';
import { Curves, Interval, Threshold } from '@nelyx/core/framework/animation/curves';
import { CurveTween, Tween } from '@nelyx/core/framework/animation/tween';
import type { ScaffoldPrelayoutGeometry } from './scaffold.ts';

export const kFloatingActionButtonMargin = 16;
export const kFloatingActionButtonSegue = 200;
export const kFloatingActionButtonTurnInterval = 0.125;
export const kMiniButtonOffsetAdjustment = 4;

export abstract class FloatingActionButtonLocation {
  static get startTop(): FloatingActionButtonLocation {
    return locations.startTop;
  }
  static get miniStartTop(): FloatingActionButtonLocation {
    return locations.miniStartTop;
  }
  static get centerTop(): FloatingActionButtonLocation {
    return locations.centerTop;
  }
  static get miniCenterTop(): FloatingActionButtonLocation {
    return locations.miniCenterTop;
  }
  static get endTop(): FloatingActionButtonLocation {
    return locations.endTop;
  }
  static get miniEndTop(): FloatingActionButtonLocation {
    return locations.miniEndTop;
  }
  static get startFloat(): FloatingActionButtonLocation {
    return locations.startFloat;
  }
  static get miniStartFloat(): FloatingActionButtonLocation {
    return locations.miniStartFloat;
  }
  static get centerFloat(): FloatingActionButtonLocation {
    return locations.centerFloat;
  }
  static get miniCenterFloat(): FloatingActionButtonLocation {
    return locations.miniCenterFloat;
  }
  static get endFloat(): FloatingActionButtonLocation {
    return locations.endFloat;
  }
  static get miniEndFloat(): FloatingActionButtonLocation {
    return locations.miniEndFloat;
  }
  static get startDocked(): FloatingActionButtonLocation {
    return locations.startDocked;
  }
  static get miniStartDocked(): FloatingActionButtonLocation {
    return locations.miniStartDocked;
  }
  static get centerDocked(): FloatingActionButtonLocation {
    return locations.centerDocked;
  }
  static get miniCenterDocked(): FloatingActionButtonLocation {
    return locations.miniCenterDocked;
  }
  static get endDocked(): FloatingActionButtonLocation {
    return locations.endDocked;
  }
  static get miniEndDocked(): FloatingActionButtonLocation {
    return locations.miniEndDocked;
  }
  static get endContained(): FloatingActionButtonLocation {
    return locations.endContained;
  }

  abstract getOffset(geometry: ScaffoldPrelayoutGeometry): Offset;

  toString(): string {
    return this.constructor.name;
  }
}

export abstract class StandardFabLocation extends FloatingActionButtonLocation {
  abstract getOffsetX(geometry: ScaffoldPrelayoutGeometry, adjustment: number): number;
  abstract getOffsetY(geometry: ScaffoldPrelayoutGeometry, adjustment: number): number;

  isMini(): boolean {
    return false;
  }

  override getOffset(geometry: ScaffoldPrelayoutGeometry): Offset {
    const adjustment = this.isMini() ? kMiniButtonOffsetAdjustment : 0;
    return new Offset(this.getOffsetX(geometry, adjustment), this.getOffsetY(geometry, adjustment));
  }
}

type Position = (geometry: ScaffoldPrelayoutGeometry, adjustment: number) => number;
type FabLocationConstructor = abstract new (...args: any[]) => StandardFabLocation;

const left: Position = ({ minInsets }, adjustment) =>
  kFloatingActionButtonMargin + minInsets.left - adjustment;
const right: Position = ({ minInsets, scaffoldSize, floatingActionButtonSize }, adjustment) =>
  scaffoldSize.width -
  minInsets.right -
  floatingActionButtonSize.width -
  kFloatingActionButtonMargin +
  adjustment;
const start: Position = (geometry, adjustment) =>
  (geometry.textDirection === 'rtl' ? right : left)(geometry, adjustment);
const end: Position = (geometry, adjustment) =>
  (geometry.textDirection === 'rtl' ? left : right)(geometry, adjustment);
const center: Position = ({ scaffoldSize, floatingActionButtonSize }) =>
  (scaffoldSize.width - floatingActionButtonSize.width) / 2;

const top: Position = ({ contentTop, minViewPadding, floatingActionButtonSize }) =>
  contentTop > minViewPadding.top
    ? contentTop - floatingActionButtonSize.height / 2
    : minViewPadding.top;

function avoidBottomWidgets(y: number, geometry: ScaffoldPrelayoutGeometry): number {
  const { contentBottom, snackBarSize, bottomSheetSize, floatingActionButtonSize } = geometry;
  const fabHeight = floatingActionButtonSize.height;
  if (snackBarSize.height > 0) {
    y = Math.min(y, contentBottom - snackBarSize.height - fabHeight - kFloatingActionButtonMargin);
  }
  if (bottomSheetSize.height > 0) {
    y = Math.min(y, contentBottom - bottomSheetSize.height - fabHeight / 2);
  }
  return y;
}

const float: Position = (geometry, adjustment) => {
  const { contentBottom, scaffoldSize, minViewPadding, floatingActionButtonSize } = geometry;
  const margin = kFloatingActionButtonMargin;
  const safeMargin =
    margin + Math.max(0, minViewPadding.bottom - (scaffoldSize.height - contentBottom));
  const y = contentBottom - floatingActionButtonSize.height - safeMargin;
  return avoidBottomWidgets(y, geometry) + adjustment;
};

const docked: Position = (geometry) => {
  const { contentBottom, scaffoldSize, minInsets, minViewPadding, floatingActionButtonSize } =
    geometry;
  const fabHeight = floatingActionButtonSize.height;
  const contentMargin = scaffoldSize.height - contentBottom;
  const safeMargin =
    contentMargin > minInsets.bottom + fabHeight / 2
      ? 0
      : minInsets.bottom === 0
        ? minViewPadding.bottom
        : fabHeight / 2 + kFloatingActionButtonMargin;
  const y = avoidBottomWidgets(contentBottom - fabHeight / 2 - safeMargin, geometry);
  return Math.min(scaffoldSize.height - fabHeight - safeMargin, y);
};

const contained: Position = ({
  contentBottom,
  scaffoldSize,
  minViewPadding,
  floatingActionButtonSize,
}) => {
  const fabHeight = floatingActionButtonSize.height;
  const contentMargin = scaffoldSize.height - contentBottom;
  const safeMargin = contentMargin > minViewPadding.bottom + fabHeight ? 0 : minViewPadding.bottom;
  const y = contentBottom + (contentMargin - minViewPadding.bottom - fabHeight) / 2;
  return Math.min(scaffoldSize.height - fabHeight - safeMargin, y);
};

export function FabStartOffsetX<Base extends FabLocationConstructor>(base: Base) {
  abstract class Start extends base {
    override getOffsetX(geometry: ScaffoldPrelayoutGeometry, adjustment: number): number {
      return start(geometry, adjustment);
    }
  }
  return Start;
}

export function FabCenterOffsetX<Base extends FabLocationConstructor>(base: Base) {
  abstract class Center extends base {
    override getOffsetX(geometry: ScaffoldPrelayoutGeometry, adjustment: number): number {
      return center(geometry, adjustment);
    }
  }
  return Center;
}

export function FabEndOffsetX<Base extends FabLocationConstructor>(base: Base) {
  abstract class End extends base {
    override getOffsetX(geometry: ScaffoldPrelayoutGeometry, adjustment: number): number {
      return end(geometry, adjustment);
    }
  }
  return End;
}

export function FabTopOffsetY<Base extends FabLocationConstructor>(base: Base) {
  abstract class Top extends base {
    override getOffsetY(geometry: ScaffoldPrelayoutGeometry, adjustment: number): number {
      return top(geometry, adjustment);
    }
  }
  return Top;
}

export function FabFloatOffsetY<Base extends FabLocationConstructor>(base: Base) {
  abstract class Float extends base {
    override getOffsetY(geometry: ScaffoldPrelayoutGeometry, adjustment: number): number {
      return float(geometry, adjustment);
    }
  }
  return Float;
}

export function FabDockedOffsetY<Base extends FabLocationConstructor>(base: Base) {
  abstract class Docked extends base {
    override getOffsetY(geometry: ScaffoldPrelayoutGeometry, adjustment: number): number {
      return docked(geometry, adjustment);
    }
  }
  return Docked;
}

export function FabContainedOffsetY<Base extends FabLocationConstructor>(base: Base) {
  abstract class Contained extends base {
    override getOffsetY(geometry: ScaffoldPrelayoutGeometry, adjustment: number): number {
      return contained(geometry, adjustment);
    }
  }
  return Contained;
}

export function FabMiniOffsetAdjustment<Base extends FabLocationConstructor>(base: Base) {
  abstract class Mini extends base {
    override isMini(): boolean {
      return true;
    }
  }
  return Mini;
}

class NamedFabLocation extends StandardFabLocation {
  constructor(
    private readonly name: string,
    private readonly horizontal: Position,
    private readonly vertical: Position,
    private readonly mini = false,
  ) {
    super();
    Object.freeze(this);
  }

  override getOffsetX(geometry: ScaffoldPrelayoutGeometry, adjustment: number): number {
    return this.horizontal(geometry, adjustment);
  }

  override getOffsetY(geometry: ScaffoldPrelayoutGeometry, adjustment: number): number {
    return this.vertical(geometry, adjustment);
  }

  override isMini(): boolean {
    return this.mini;
  }

  override toString(): string {
    return 'FloatingActionButtonLocation.' + this.name;
  }
}

const locations = {
  startTop: new NamedFabLocation('startTop', start, top),
  miniStartTop: new NamedFabLocation('miniStartTop', start, top, true),
  centerTop: new NamedFabLocation('centerTop', center, top),
  miniCenterTop: new NamedFabLocation('miniCenterTop', center, top, true),
  endTop: new NamedFabLocation('endTop', end, top),
  miniEndTop: new NamedFabLocation('miniEndTop', end, top, true),
  startFloat: new NamedFabLocation('startFloat', start, float),
  miniStartFloat: new NamedFabLocation('miniStartFloat', start, float, true),
  centerFloat: new NamedFabLocation('centerFloat', center, float),
  miniCenterFloat: new NamedFabLocation('miniCenterFloat', center, float, true),
  endFloat: new NamedFabLocation('endFloat', end, float),
  miniEndFloat: new NamedFabLocation('miniEndFloat', end, float, true),
  startDocked: new NamedFabLocation('startDocked', start, docked),
  miniStartDocked: new NamedFabLocation('miniStartDocked', start, docked, true),
  centerDocked: new NamedFabLocation('centerDocked', center, docked),
  miniCenterDocked: new NamedFabLocation('miniCenterDocked', center, docked, true),
  endDocked: new NamedFabLocation('endDocked', end, docked),
  miniEndDocked: new NamedFabLocation('miniEndDocked', end, docked, true),
  endContained: new NamedFabLocation('endContained', end, contained),
};

/** @internal Floating snack bars stay at the bottom for built-in top FAB locations. */
export function isTopFabLocation(location: FloatingActionButtonLocation): boolean {
  return (
    location === locations.startTop ||
    location === locations.miniStartTop ||
    location === locations.centerTop ||
    location === locations.miniCenterTop ||
    location === locations.endTop ||
    location === locations.miniEndTop
  );
}

export interface FabAnimationOffsetOptions {
  readonly begin: Offset;
  readonly end: Offset;
  readonly progress: number;
}

export abstract class FloatingActionButtonAnimator {
  static get scaling(): FloatingActionButtonAnimator {
    return scalingAnimator;
  }

  static get noAnimation(): FloatingActionButtonAnimator {
    return instantAnimator;
  }

  abstract getOffset(options: FabAnimationOffsetOptions): Offset;
  abstract getScaleAnimation(options: { readonly parent: Animation<number> }): Animation<number>;
  abstract getRotationAnimation(options: { readonly parent: Animation<number> }): Animation<number>;

  getAnimationRestart(_previousValue: number): number {
    return 0;
  }

  toString(): string {
    return this.constructor.name;
  }
}

class AnimationSwap<T> extends CompoundAnimation<T> {
  constructor(
    first: Animation<T>,
    next: Animation<T>,
    private readonly parentAnimation: Animation<number>,
    private readonly threshold: number,
  ) {
    super({ first, next });
  }

  override get value(): T {
    return this.parentAnimation.value < this.threshold ? this.first.value : this.next.value;
  }
}

const halfScaleCurve = new Interval(0.5, 1, { curve: Curves.ease });
const scaleOut = new CurveTween({ curve: halfScaleCurve.flipped });
const scaleIn = new CurveTween({ curve: halfScaleCurve });
const rotationAtStart = new Tween({ begin: 1 - kFloatingActionButtonTurnInterval * 2, end: 1 });
const rotationThreshold = new CurveTween({ curve: new Threshold(0.5) });
const stoppedFabAnimation = new AlwaysStoppedAnimation(1);

class ScalingFabMotionAnimator extends FloatingActionButtonAnimator {
  override getOffset({ begin, end, progress }: FabAnimationOffsetOptions): Offset {
    return progress < 0.5 ? begin : end;
  }

  override getScaleAnimation({
    parent,
  }: {
    readonly parent: Animation<number>;
  }): Animation<number> {
    return new AnimationSwap(
      new ReverseAnimation(parent.drive(scaleOut)),
      parent.drive(scaleIn),
      parent,
      0.5,
    );
  }

  override getRotationAnimation({
    parent,
  }: {
    readonly parent: Animation<number>;
  }): Animation<number> {
    return new AnimationSwap(
      parent.drive(rotationAtStart),
      new ReverseAnimation(parent.drive(rotationThreshold)),
      parent,
      0.5,
    );
  }

  override getAnimationRestart(previousValue: number): number {
    return Math.min(1 - previousValue, previousValue);
  }
}

class NoAnimationFabMotionAnimator extends FloatingActionButtonAnimator {
  override getOffset({ end }: FabAnimationOffsetOptions): Offset {
    return end;
  }

  override getScaleAnimation(): Animation<number> {
    return stoppedFabAnimation;
  }

  override getRotationAnimation(): Animation<number> {
    return stoppedFabAnimation;
  }
}

const scalingAnimator = Object.freeze(new ScalingFabMotionAnimator());
const instantAnimator = Object.freeze(new NoAnimationFabMotionAnimator());
