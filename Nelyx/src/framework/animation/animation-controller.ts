// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Animation, AnimationStatus } from './animation.ts';
import type { AnimationStatusListener } from './animation.ts';
import { Curves } from './curves.ts';
import type { Curve } from './curves.ts';
import { Ticker } from './ticker.ts';
import type { TickerProvider } from './ticker.ts';
import { TickerFuture } from './ticker-future.ts';
import { Simulation } from '../physics/simulation.ts';
import { SpringDescription, SpringSimulation, SpringType } from '../physics/spring-simulation.ts';
import { Tolerance } from '../physics/tolerance.ts';
import { clampDouble } from '../../ui/math.ts';
import { invariant } from '../../foundation/errors.ts';
import {
  AnimationEagerListenerMixin,
  AnimationLocalListenersMixin,
  AnimationLocalStatusListenersMixin,
} from './listener-helpers.ts';
export class AnimationBehavior {
  static readonly normal = new AnimationBehavior(0, 'normal');
  static readonly preserve = new AnimationBehavior(1, 'preserve');
  static readonly values = Object.freeze([this.normal, this.preserve]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'AnimationBehavior.' + this.name;
  }
}
export interface AnimationControllerOptions {
  readonly vsync: TickerProvider;
  readonly value?: number;
  readonly duration?: number | null;
  readonly reverseDuration?: number | null;
  readonly lowerBound?: number;
  readonly upperBound?: number;
  readonly debugLabel?: string | null;
  readonly animationBehavior?: AnimationBehavior;
  /** Per-View accessibility input; never inferred from a process-global binding. */
  readonly disableAnimations?: () => boolean;
}
export interface AnimationToOptions {
  readonly duration?: number | null;
  readonly curve?: Curve;
}
type Direction = 'forward' | 'reverse';
function animationValue(value: number): number {
  invariant(
    typeof value === 'number' && Number.isFinite(value),
    'invalid-animation-value',
    'Animation values and targets must be finite',
  );
  return value;
}
function animationDuration(value: number | null): void {
  invariant(
    value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0),
    'invalid-animation-duration',
    'Animation duration must be finite and nonnegative',
  );
}
const flingSpring = SpringDescription.withDampingRatio({ mass: 1, stiffness: 500 });
const flingTolerance = new Tolerance({ velocity: Infinity, distance: 0.01 });
const AnimationControllerBase = AnimationLocalStatusListenersMixin(
  AnimationLocalListenersMixin(AnimationEagerListenerMixin(Animation)),
);
/** Source milliseconds at the public boundary, seconds inside Simulation. Full class remains PARTIAL. */
export class AnimationController extends AnimationControllerBase {
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly debugLabel: string | null;
  readonly animationBehavior: AnimationBehavior;
  duration: number | null;
  reverseDuration: number | null;
  private ticker: Ticker | null;
  private simulation: Simulation | null = null;
  private currentValue = 0;
  private currentStatus = AnimationStatus.dismissed;
  private direction: Direction = 'forward';
  private elapsed: number | null = null;
  private lastReportedStatus = AnimationStatus.dismissed;
  private revision = 0;
  private readonly disableAnimations: () => boolean;
  private vsyncOwner: TickerProvider;
  constructor({
    vsync,
    value,
    duration = null,
    reverseDuration = null,
    lowerBound = 0,
    upperBound = 1,
    debugLabel = null,
    animationBehavior = AnimationBehavior.normal,
    disableAnimations,
  }: AnimationControllerOptions) {
    super();
    invariant(
      ((Number.isFinite(lowerBound) && Number.isFinite(upperBound)) ||
        (lowerBound === -Infinity && upperBound === Infinity)) &&
        upperBound >= lowerBound,
      'invalid-animation-bounds',
      'Animation bounds must be ordered finite values or the unbounded pair',
    );
    animationValue(value ?? lowerBound);
    animationDuration(duration);
    animationDuration(reverseDuration);
    this.lowerBound = lowerBound;
    this.upperBound = upperBound;
    this.duration = duration;
    this.reverseDuration = reverseDuration;
    this.debugLabel = debugLabel;
    this.animationBehavior = animationBehavior;
    this.vsyncOwner = vsync;
    this.disableAnimations =
      disableAnimations ?? (() => this.vsyncOwner.disableAnimations ?? false);
    this.ticker = vsync.createTicker((elapsed) => this.tick(elapsed));
    this.internalSetValue(value ?? lowerBound);
  }
  static unbounded(
    options: Omit<AnimationControllerOptions, 'lowerBound' | 'upperBound'>,
  ): AnimationController {
    return new AnimationController({
      ...options,
      value: options.value ?? 0,
      lowerBound: -Infinity,
      upperBound: Infinity,
      animationBehavior: options.animationBehavior ?? AnimationBehavior.preserve,
    });
  }
  private ensureAlive(): Ticker {
    invariant(
      this.ticker,
      'disposed-animation-controller',
      'AnimationController used after disposal',
    );
    return this.ticker;
  }
  get view(): Animation<number> {
    return this;
  }
  get value(): number {
    return this.currentValue;
  }
  set value(value: number) {
    animationValue(value);
    this.stop();
    this.internalSetValue(value);
    this.notifyListeners();
    this.checkStatusChanged();
  }
  get status(): AnimationStatus {
    return this.currentStatus;
  }
  override get isAnimating(): boolean {
    return this.ticker?.isActive ?? false;
  }
  get lastElapsedDuration(): number | null {
    return this.elapsed;
  }
  get velocity(): number {
    return this.isAnimating ? this.simulation!.dx(this.elapsed! / 1000) : 0;
  }
  resync(vsync: TickerProvider): void {
    const previous = this.ensureAlive(),
      next = vsync.createTicker((elapsed) => this.tick(elapsed));
    try {
      next.absorbTicker(previous);
    } catch (error) {
      next.dispose();
      throw error;
    }
    this.ticker = next;
    this.vsyncOwner = vsync;
  }
  reset(): void {
    this.value = this.lowerBound;
  }
  private internalSetValue(value: number): void {
    this.currentValue = clampDouble(value, this.lowerBound, this.upperBound);
    this.currentStatus =
      this.currentValue === this.lowerBound
        ? AnimationStatus.dismissed
        : this.currentValue === this.upperBound
          ? AnimationStatus.completed
          : this.direction === 'forward'
            ? AnimationStatus.forward
            : AnimationStatus.reverse;
  }
  private validateTo(
    target: number,
    direction: Direction,
    { duration = null }: AnimationToOptions = {},
  ): void {
    animationValue(target);
    animationDuration(duration);
    animationDuration(this.duration);
    animationDuration(this.reverseDuration);
    invariant(
      duration !== null ||
        (direction === 'reverse' ? (this.reverseDuration ?? this.duration) : this.duration) !==
          null,
      'missing-animation-duration',
      'Animation requires an explicit or default duration',
    );
  }
  forward({ from = null }: { readonly from?: number | null } = {}): TickerFuture {
    this.ensureAlive();
    this.validateTo(this.upperBound, 'forward');
    if (from !== null) animationValue(from);
    this.direction = 'forward';
    if (from !== null) this.value = from;
    return this.animateToInternal(this.upperBound);
  }
  reverse({ from = null }: { readonly from?: number | null } = {}): TickerFuture {
    this.ensureAlive();
    this.validateTo(this.lowerBound, 'reverse');
    if (from !== null) animationValue(from);
    this.direction = 'reverse';
    if (from !== null) this.value = from;
    return this.animateToInternal(this.lowerBound);
  }
  toggle({ from = null }: { readonly from?: number | null } = {}): TickerFuture {
    this.ensureAlive();
    const direction = this.isForwardOrCompleted ? 'reverse' : 'forward';
    this.validateTo(direction === 'forward' ? this.upperBound : this.lowerBound, direction);
    if (from !== null) animationValue(from);
    this.direction = direction;
    if (from !== null) this.value = from;
    return this.animateToInternal(this.direction === 'forward' ? this.upperBound : this.lowerBound);
  }
  animateTo(target: number, options: AnimationToOptions = {}): TickerFuture {
    this.ensureAlive();
    this.validateTo(target, 'forward', options);
    this.direction = 'forward';
    return this.animateToInternal(target, options);
  }
  animateBack(target: number, options: AnimationToOptions = {}): TickerFuture {
    this.ensureAlive();
    this.validateTo(target, 'reverse', options);
    this.direction = 'reverse';
    return this.animateToInternal(target, options);
  }
  private animateToInternal(
    target: number,
    { duration = null, curve = Curves.linear }: AnimationToOptions = {},
  ): TickerFuture {
    this.validateTo(target, this.direction, { duration, curve });
    invariant(
      curve && typeof curve.transform === 'function',
      'invalid-animation-curve',
      'Animation curve requires transform',
    );
    const scale =
      this.animationBehavior === AnimationBehavior.normal && this.disableAnimations() ? 0.05 : 1;
    let simulationDuration = duration;
    if (simulationDuration === null) {
      const range = this.upperBound - this.lowerBound,
        remaining =
          range === 0 ? 0 : Number.isFinite(range) ? Math.abs(target - this.value) / range : 1,
        directionDuration =
          this.direction === 'reverse' && this.reverseDuration !== null
            ? this.reverseDuration
            : this.duration;
      invariant(
        directionDuration !== null,
        'missing-animation-duration',
        'Animation requires an explicit or default duration',
      );
      simulationDuration = directionDuration * remaining;
    } else if (target === this.value) simulationDuration = 0;
    invariant(
      Number.isFinite(simulationDuration) && simulationDuration >= 0,
      'invalid-animation-duration',
      'Animation duration must be finite and nonnegative',
    );
    this.stop();
    if (simulationDuration === 0) {
      const revision = this.revision;
      if (this.value !== target) {
        this.currentValue = clampDouble(target, this.lowerBound, this.upperBound);
        this.notifyListeners();
      }
      if (this.revision !== revision || !this.ticker) {
        const canceled = new TickerFuture();
        canceled.cancel();
        return canceled;
      }
      this.currentStatus =
        this.direction === 'forward' ? AnimationStatus.completed : AnimationStatus.dismissed;
      this.checkStatusChanged();
      return TickerFuture.complete();
    }
    invariant(
      Number.isFinite(simulationDuration) && simulationDuration > 0,
      'invalid-animation-duration',
      'Animation duration must be finite and positive',
    );
    return this.startSimulation(
      new _InterpolationSimulation(this.value, target, simulationDuration, curve, scale),
    );
  }
  repeat({
    min = this.lowerBound,
    max = this.upperBound,
    reverse = false,
    period = this.duration,
    count = null,
  }: {
    readonly min?: number;
    readonly max?: number;
    readonly reverse?: boolean;
    readonly period?: number | null;
    readonly count?: number | null;
  } = {}): TickerFuture {
    this.ensureAlive();
    invariant(
      period !== null &&
        Number.isFinite(period) &&
        period > 0 &&
        Number.isFinite(min) &&
        Number.isFinite(max) &&
        max >= min &&
        max <= this.upperBound &&
        min >= this.lowerBound &&
        (count === null || (Number.isSafeInteger(count) && count > 0)),
      'invalid-animation-repeat',
      'Repeat requires ordered bounds, positive period and optional positive integer count',
    );
    this.stop();
    return this.startSimulation(
      new _RepeatingSimulation(
        this.value,
        min,
        max,
        reverse,
        period,
        (direction) => this.directionSetter(direction),
        count,
      ),
    );
  }
  private directionSetter(direction: Direction): void {
    this.direction = direction;
    this.currentStatus =
      direction === 'forward' ? AnimationStatus.forward : AnimationStatus.reverse;
    this.checkStatusChanged();
  }
  fling({
    velocity = 1,
    springDescription = flingSpring,
    animationBehavior = this.animationBehavior,
  }: {
    readonly velocity?: number;
    readonly springDescription?: SpringDescription;
    readonly animationBehavior?: AnimationBehavior;
  } = {}): TickerFuture {
    this.ensureAlive();
    animationValue(velocity);
    animationValue(this.lowerBound);
    animationValue(this.upperBound);
    this.direction = velocity < 0 ? 'reverse' : 'forward';
    const target =
        velocity < 0
          ? this.lowerBound - flingTolerance.distance
          : this.upperBound + flingTolerance.distance,
      scale = animationBehavior === AnimationBehavior.normal && this.disableAnimations() ? 200 : 1,
      simulation = new SpringSimulation(springDescription, this.value, target, velocity * scale, {
        tolerance: flingTolerance,
      });
    invariant(
      simulation.type !== SpringType.underDamped,
      'underdamped-fling',
      'Use animateWith for an intentionally oscillating spring',
    );
    this.stop();
    return this.startSimulation(simulation);
  }
  animateWith(simulation: Simulation): TickerFuture {
    this.ensureAlive();
    this.stop();
    this.direction = 'forward';
    return this.startSimulation(simulation);
  }
  animateBackWith(simulation: Simulation): TickerFuture {
    this.ensureAlive();
    this.stop();
    this.direction = 'reverse';
    return this.startSimulation(simulation);
  }
  private startSimulation(simulation: Simulation): TickerFuture {
    invariant(
      simulation &&
        typeof simulation.x === 'function' &&
        typeof simulation.dx === 'function' &&
        typeof simulation.isDone === 'function',
      'invalid-animation-simulation',
      'Animation simulation requires x, dx and isDone',
    );
    this.simulation = simulation;
    this.elapsed = 0;
    const revision = this.revision;
    let value: number;
    try {
      value = simulation.x(0);
      if (this.revision !== revision || this.simulation !== simulation || !this.ticker) {
        const canceled = new TickerFuture();
        canceled.cancel();
        return canceled;
      }
      animationValue(value);
    } catch (error) {
      if (this.revision === revision && this.simulation === simulation) {
        this.simulation = null;
        this.elapsed = null;
      }
      throw error;
    }
    this.currentValue = clampDouble(value, this.lowerBound, this.upperBound);
    this.currentStatus =
      this.direction === 'forward' ? AnimationStatus.forward : AnimationStatus.reverse;
    const result = this.ensureAlive().start();
    this.checkStatusChanged();
    return result;
  }
  stop({ canceled = true }: { readonly canceled?: boolean } = {}): void {
    const ticker = this.ensureAlive();
    this.revision++;
    this.simulation = null;
    this.elapsed = null;
    ticker.stop({ canceled });
  }
  private tick(elapsed: number): void {
    const simulation = this.simulation;
    if (!simulation) return;
    const revision = this.revision;
    this.elapsed = elapsed;
    try {
      const value = simulation.x(elapsed / 1000);
      if (this.revision !== revision || this.simulation !== simulation || !this.ticker) return;
      animationValue(value);
      const done = simulation.isDone(elapsed / 1000);
      if (this.revision !== revision || this.simulation !== simulation || !this.ticker) return;
      invariant(
        typeof done === 'boolean',
        'invalid-animation-completion',
        'Simulation completion must be boolean',
      );
      this.currentValue = clampDouble(value, this.lowerBound, this.upperBound);
      if (done) {
        this.currentStatus =
          this.direction === 'forward' ? AnimationStatus.completed : AnimationStatus.dismissed;
        this.stop({ canceled: false });
      }
      this.notifyListeners();
      this.checkStatusChanged();
    } catch (error) {
      if (this.revision === revision && this.simulation === simulation && this.ticker) this.stop();
      throw error;
    }
  }
  private checkStatusChanged(): void {
    if (this.lastReportedStatus !== this.status) {
      this.lastReportedStatus = this.status;
      this.notifyStatusListeners(this.status);
    }
  }
  override addListener(listener: () => void): void {
    this.ensureAlive();
    super.addListener(listener);
  }
  override addStatusListener(listener: AnimationStatusListener): void {
    this.ensureAlive();
    super.addStatusListener(listener);
  }
  override dispose(): void {
    if (!this.ticker) return;
    const ticker = this.ticker;
    this.revision++;
    this.ticker = null;
    this.simulation = null;
    this.elapsed = null;
    try {
      ticker.dispose();
    } finally {
      this.clearListeners();
      this.clearStatusListeners();
      super.dispose();
    }
  }
  override toStringDetails(): string {
    return `${super.toStringDetails()} ${this.value.toFixed(3)}${this.isAnimating ? '' : '; paused'}${this.ticker === null ? '; DISPOSED' : this.ticker.muted ? '; silenced' : ''}${this.debugLabel === null ? '' : '; for ' + this.debugLabel}`;
  }
}
class _InterpolationSimulation extends Simulation {
  private readonly duration: number;
  constructor(
    private readonly begin: number,
    private readonly end: number,
    duration: number,
    private readonly curve: Curve,
    scale: number,
  ) {
    super();
    this.duration = (duration * scale) / 1000;
  }
  x(time: number): number {
    const t = clampDouble(time / this.duration, 0, 1);
    return t === 0
      ? this.begin
      : t === 1
        ? this.end
        : this.begin + (this.end - this.begin) * this.curve.transform(t);
  }
  dx(time: number): number {
    const epsilon = this.tolerance.time;
    return (this.x(time + epsilon) - this.x(time - epsilon)) / (2 * epsilon);
  }
  isDone(time: number): boolean {
    return time > this.duration;
  }
}
class _RepeatingSimulation extends Simulation {
  private readonly period: number;
  private readonly initialT: number;
  constructor(
    value: number,
    private readonly min: number,
    private readonly max: number,
    private readonly reverse: boolean,
    period: number,
    private readonly directionSetter: (direction: Direction) => void,
    private readonly count: number | null,
  ) {
    super();
    this.period = period / 1000;
    this.initialT =
      max === min ? 0 : ((clampDouble(value, min, max) - min) / (max - min)) * this.period;
  }
  private phase(time: number): { fraction: number; reversed: boolean } {
    const cycles = (time + this.initialT) / this.period,
      terminal = this.count !== null && cycles >= this.count,
      index = terminal ? this.count! - 1 : Math.floor(cycles);
    return { fraction: terminal ? 1 : cycles - index, reversed: this.reverse && index % 2 !== 0 };
  }
  x(time: number): number {
    const phase = this.phase(time);
    this.directionSetter(phase.reversed ? 'reverse' : 'forward');
    return phase.reversed
      ? this.max + (this.min - this.max) * phase.fraction
      : this.min + (this.max - this.min) * phase.fraction;
  }
  dx(time: number): number {
    return ((this.phase(time).reversed ? -1 : 1) * (this.max - this.min)) / this.period;
  }
  isDone(time: number): boolean {
    return this.count !== null && time >= this.count * this.period - this.initialT;
  }
}
