// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional ToggleableState value/position and switch drag contracts on the Core owner.
import { StatefulWidget, State, Element } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import { TickerProviderStateMixin } from './ticker-provider.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import { Curves } from '../animation/curves.ts';
import type { Curve } from '../animation/curves.ts';
import { ControlInteraction } from './control-interaction.ts';
import type { ControlVisualState, ControlInteractionOptions } from './control-interaction.ts';
import { CurvedAnimation } from '../animation/animations.ts';
import { AnimationStatus } from '../animation/animation.ts';
import { Offset } from '../../ui/offset.ts';
import { emptyWidgetStateSet } from './widget-state.ts';
import { WidgetState } from './widget-state.ts';
import { Directionality } from './app-data.ts';
import { invariant } from '../../foundation/errors.ts';
export function nextToggleValue(value: boolean | null, tristate: boolean): boolean | null {
  return value === false ? true : value === true ? (tristate ? null : false) : false;
}
/** Exact pinned Cupertino drag hysteresis; value may change externally during the gesture. */
/** @dartType double */ const cupertinoDragCommitThreshold = 0.7;
/** @dartType double */ const cupertinoDragReverseThreshold = 0.2;
export function cupertinoSwitchDragValue(
  delta: number,
  widgetValue: boolean,
  previousDragValue: boolean,
): boolean {
  const threshold =
    widgetValue !== previousDragValue
      ? cupertinoDragReverseThreshold
      : cupertinoDragCommitThreshold;
  return delta >= (widgetValue ? -threshold : threshold);
}
export interface ToggleableMotion {
  readonly previousValue: boolean | null;
  readonly positionStatus: AnimationStatus;
  readonly reaction: number;
  readonly reactionFocusFade: number;
  readonly reactionHoverFade: number;
  readonly downPosition: Offset | null;
  readonly rawPosition: number;
  readonly colorPosition: number;
  readonly reactionStatus: AnimationStatus;
}
export interface ToggleableMotionProfile {
  readonly duration: number;
  readonly reactionDuration: number;
  readonly curve: Curve;
  readonly reverseCurve: Curve | null;
  readonly colorCurve?: Curve;
  readonly colorReverseCurve?: Curve;
}
export interface ToggleableControlOptions extends Omit<
  ControlInteractionOptions,
  'onPressed' | 'selected' | 'gestures'
> {
  readonly value: boolean | null;
  readonly tristate?: boolean;
  readonly onChanged: ((value: boolean | null) => void) | null;
  readonly switchDrag?: {
    readonly policy: 'material' | 'cupertino';
    readonly extent: number;
    readonly deferSettleToBuild?: boolean;
  };
  /** Source Cupertino drag crossing feedback and direct commit; Core owns the gesture. */
  readonly onSwitchDragValueChanged?: () => void;
  readonly onSwitchDragCommit?: (value: boolean) => void;
  readonly motion?: 'source';
  readonly animateValueChanges?: boolean;
  readonly motionProfile?: ToggleableMotionProfile;
  readonly builder: (
    context: BuildContext,
    state: ControlVisualState,
    position: number,
    motion: ToggleableMotion,
  ) => Widget;
}
export class ToggleableControl extends StatefulWidget {
  constructor(readonly options: ToggleableControlOptions) {
    super(options.key ?? null);
    invariant(
      typeof options.value === 'boolean' || (options.value === null && options.tristate === true),
      'invalid-toggle-value',
      'Nullable toggle values require tristate',
    );
    if (options.switchDrag)
      invariant(
        typeof options.value === 'boolean' &&
          Number.isFinite(options.switchDrag.extent) &&
          options.switchDrag.extent > 0,
        'invalid-toggle-drag',
        'Switch drag needs a boolean value and a positive extent',
      );
  }
  createState(): State {
    return new ToggleableControlState();
  }
}
class ToggleableControlState extends TickerProviderStateMixin<ToggleableControl> {
  private colorCurve: CurvedAnimation | null = null;
  private needsPositionAnimation = false;
  private position!: AnimationController;
  private curved!: CurvedAnimation;
  private reaction!: AnimationController;
  private focusFade!: AnimationController;
  private hoverFade!: AnimationController;
  private focusHighlight = false;
  private hoverHighlight = false;
  private previousValue: boolean | null = null;
  private downPosition: Offset | null = null;
  private dragValue: boolean | null = null;
  private dragDelta = 0;
  private downX: number | null = null;
  private dragging = false;
  private retired = false;
  private suspended = false;
  private get live(): boolean {
    return this.mounted && !this.retired && !this.suspended && (this.context as Element).active;
  }
  private get interactive(): boolean {
    return (
      this.live && this.widget.options.onChanged !== null && (this.widget.options.enabled ?? true)
    );
  }
  private readonly positionChanged = () => {
    if (this.live) this.setState(() => {});
  };
  private target(): number {
    return this.widget.options.value === false ? 0 : 1;
  }
  private sourceStates(disabled: boolean) {
    const result = emptyWidgetStateSet();
    if (disabled) result.add(WidgetState.disabled);
    if (this.hoverHighlight) result.add(WidgetState.hovered);
    if (this.focusHighlight) result.add(WidgetState.focused);
    if (this.widget.options.value !== false) result.add(WidgetState.selected);
    return result;
  }
  private get sourceMotion(): boolean {
    return this.widget.options.motion === 'source';
  }
  private settle(): void {
    if (this.sourceMotion) {
      if (this.widget.options.tristate && this.widget.options.value === null)
        this.position.value = 0;
      if (this.target() === 1) this.position.forward();
      else this.position.reverse();
      return;
    }
    this.position.animateTo(this.target(), { duration: 200, curve: Curves.easeInOut });
  }
  private configureMotion(): void {
    const p = this.widget.options.motionProfile;
    if (!p) return;
    this.position.duration = p.duration;
    this.reaction.duration = p.reactionDuration;
    if (!this.dragging && (this.position.value === 0 || this.position.value === 1)) {
      this.curved.curve = p.curve;
      this.curved.reverseCurve = p.reverseCurve;
    }
    if (p.colorCurve) {
      if (!this.colorCurve)
        this.colorCurve = new CurvedAnimation({
          parent: this.position,
          curve: p.colorCurve,
          reverseCurve: p.colorReverseCurve ?? null,
        });
      else {
        this.colorCurve.curve = p.colorCurve;
        this.colorCurve.reverseCurve = p.colorReverseCurve ?? null;
      }
    }
  }
  override initState(): void {
    super.initState();
    this.position = new AnimationController({ vsync: this, value: this.target(), duration: 200 });
    this.position.addListener(this.positionChanged);
    this.previousValue = this.widget.options.value;
    this.curved = new CurvedAnimation({
      parent: this.position,
      curve: Curves.easeIn,
      reverseCurve: Curves.easeOut,
    });
    this.reaction = new AnimationController({ vsync: this, duration: 100 });
    this.focusFade = new AnimationController({ vsync: this, duration: 50 });
    this.hoverFade = new AnimationController({ vsync: this, duration: 50 });
    for (const c of [this.reaction, this.focusFade, this.hoverFade])
      c.addListener(this.positionChanged);
    this.configureMotion();
  }
  override didUpdateWidget(old: ToggleableControl): void {
    super.didUpdateWidget(old);
    this.configureMotion();
    if (!this.interactive && this.dragging) this.cancel();
    if (old.options.value !== this.widget.options.value) {
      this.previousValue = old.options.value;
      if (
        (!this.dragging || this.widget.options.switchDrag?.policy === 'cupertino') &&
        this.widget.options.animateValueChanges !== false
      )
        this.settle();
    }
  }
  private select(): void {
    if (this.interactive)
      this.widget.options.onChanged!(
        nextToggleValue(this.widget.options.value, this.widget.options.tristate ?? false),
      );
  }
  private start(globalX: number): void {
    if (!this.interactive) return;
    const policy = this.widget.options.switchDrag!;
    this.dragging = true;
    this.dragValue = this.widget.options.value as boolean;
    this.dragDelta =
      policy.policy === 'cupertino' && this.downX !== null
        ? ((globalX - this.downX) / policy.extent) *
          (Directionality.of(this.context) === 'rtl' ? -1 : 1)
        : 0;
    if (this.sourceMotion) this.reaction.forward();
    if (policy.policy === 'material') this.position.stop();
  }
  private updateDrag(dx: number): void {
    if (!this.interactive || !this.dragging) return;
    const policy = this.widget.options.switchDrag!,
      delta = (dx / policy.extent) * (Directionality.of(this.context) === 'rtl' ? -1 : 1);
    if (policy.policy === 'cupertino') {
      this.dragDelta += delta;
      const next = cupertinoSwitchDragValue(
        this.dragDelta,
        this.widget.options.value as boolean,
        this.dragValue!,
      );
      if (next !== this.dragValue) {
        this.widget.options.onSwitchDragValueChanged?.();
        if (this.sourceMotion) {
          if (next) this.position.forward();
          else this.position.reverse();
        } else this.position.animateTo(next ? 1 : 0, { duration: 200, curve: Curves.easeInOut });
        this.dragValue = next;
      }
    } else {
      if (policy.deferSettleToBuild) {
        this.curved.curve = Curves.linear;
        this.curved.reverseCurve = null;
      }
      this.position.value = Math.max(0, Math.min(1, this.position.value + delta));
    }
  }
  private end(): void {
    if (!this.dragging) return;
    const policy = this.widget.options.switchDrag!,
      next = policy.policy === 'cupertino' ? this.dragValue! : this.position.value >= 0.5,
      changed = this.interactive && next !== this.widget.options.value;
    this.dragging = false;
    this.dragValue = null;
    this.downX = null;
    this.dragDelta = 0;
    try {
      if (changed) {
        if (this.widget.options.onSwitchDragCommit) this.widget.options.onSwitchDragCommit(next);
        else this.widget.options.onChanged!(next);
      }
    } finally {
      if (this.live) {
        if (this.sourceMotion) this.reaction.reverse();
        if (changed && policy.deferSettleToBuild)
          this.setState(() => {
            this.needsPositionAnimation = true;
          });
        else this.settle();
      }
    }
  }
  private cancel(): void {
    this.dragging = false;
    this.dragValue = null;
    this.downX = null;
    this.dragDelta = 0;
    if (this.live) {
      if (this.sourceMotion) this.reaction.reverse();
      this.settle();
    }
  }
  override deactivate(): void {
    this.suspended = true;
    if (this.sourceMotion) {
      super.deactivate();
      return;
    }
    this.dragging = false;
    this.dragValue = null;
    this.downX = null;
    this.dragDelta = 0;
    try {
      this.position.stop();
      this.position.value = this.target();
      for (const c of [this.reaction, this.focusFade, this.hoverFade]) {
        c.stop();
        c.value = 0;
      }
      this.downPosition = null;
      this.focusHighlight = false;
      this.hoverHighlight = false;
    } finally {
      super.deactivate();
    }
  }
  override activate(): void {
    super.activate();
    this.suspended = false;
  }
  override dispose(): void {
    this.retired = true;
    try {
      this.colorCurve?.dispose();
      this.curved.dispose();
      for (const c of [this.position, this.reaction, this.focusFade, this.hoverFade]) c.dispose();
    } finally {
      super.dispose();
    }
  }
  build(): Widget {
    if (this.needsPositionAnimation) {
      this.needsPositionAnimation = false;
      this.settle();
    }
    const options = this.widget.options,
      {
        key: _,
        builder,
        value: __,
        onChanged: ___,
        tristate: ____,
        switchDrag: _____,
        motion: ______,
        animateValueChanges: _______,
        motionProfile: ________,
        onSwitchDragValueChanged: _________,
        onSwitchDragCommit: __________,
        ...interaction
      } = options;
    const source = this.sourceMotion;
    return new ControlInteraction(
      (context, state) => {
        const states = emptyWidgetStateSet();
        if (state.states.contains(WidgetState.disabled)) states.add(WidgetState.disabled);
        if (state.showHoverHighlight) states.add(WidgetState.hovered);
        if (state.showFocusHighlight) states.add(WidgetState.focused);
        if (options.value !== false) states.add(WidgetState.selected);
        const visual = source ? Object.freeze({ ...state, states }) : state;
        return builder(
          context,
          visual,
          source ? this.curved.value : this.position.value,
          Object.freeze({
            previousValue: this.previousValue,
            positionStatus: this.position.status,
            reaction: Curves.fastOutSlowIn.transform(this.reaction.value),
            reactionFocusFade: Curves.fastOutSlowIn.transform(this.focusFade.value),
            reactionHoverFade: Curves.fastOutSlowIn.transform(this.hoverFade.value),
            downPosition: this.downPosition,
            rawPosition: this.position.value,
            colorPosition: this.colorCurve?.value ?? this.position.value,
            reactionStatus: this.reaction.status,
          }),
        );
      },
      {
        ...interaction,
        enabled: options.onChanged !== null && (options.enabled ?? true),
        selected: options.value !== false,
        onPressed: () => this.select(),
        ...(source
          ? {
              requestFocusOnPointer: false,
              preserveInteractionOnDeactivate: true,
              ...(options.mouseCursorResolver
                ? {
                    mouseCursorResolver: (states) =>
                      options.mouseCursorResolver!(
                        this.sourceStates(states.contains(WidgetState.disabled)),
                      ),
                  }
                : {}),
              onHighlightChanged: (pressed: boolean) => {
                if (!pressed) this.downPosition = null;
                if (pressed) this.reaction.forward();
                else this.reaction.reverse();
                options.onHighlightChanged?.(pressed);
              },
              onShowFocusHighlight: (focused: boolean) => {
                this.focusHighlight = focused;
                if (focused) this.focusFade.forward();
                else this.focusFade.reverse();
                options.onShowFocusHighlight?.(focused);
              },
              onShowHoverHighlight: (hovered: boolean) => {
                this.hoverHighlight = hovered;
                if (hovered) this.hoverFade.forward();
                else this.hoverFade.reverse();
                options.onShowHoverHighlight?.(hovered);
              },
              gestures: {
                onTapDown: (details) => {
                  this.downPosition = details.localPosition;
                },
              },
            }
          : {}),
        ...(options.switchDrag
          ? {
              gestures: {
                onTapDown: (details) => {
                  this.downX = details.globalPosition.dx;
                  if (source) this.downPosition = details.localPosition;
                },
                onHorizontalDragStart: (details) => this.start(details.globalPosition.dx),
                onHorizontalDragUpdate: (details) =>
                  this.updateDrag(details.primaryDelta ?? details.delta.dx),
                onHorizontalDragEnd: () => this.end(),
                onHorizontalDragCancel: () => this.cancel(),
              },
            }
          : {}),
      },
    );
  }
}
