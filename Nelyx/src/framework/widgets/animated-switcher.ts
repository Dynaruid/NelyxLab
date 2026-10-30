// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Complete pinned AnimatedSwitcher lifecycle on the current Core widget/ticker owners.
import { Widget, StatefulWidget } from './framework.ts';
import type { BuildContext, WidgetOptions, State } from './framework.ts';
import { TickerProviderStateMixin } from './ticker-provider.ts';
import { KeyedSubtree, Stack } from './basic.ts';
import { FadeTransition } from './transitions.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import { AnimationStatus } from '../animation/animation.ts';
import type { Animation } from '../animation/animation.ts';
import { CurvedAnimation } from '../animation/animations.ts';
import { Curves } from '../animation/curves.ts';
import type { Curve } from '../animation/curves.ts';
import { Key, ValueKey, sameKey } from '../../foundation/key.ts';
import { Alignment } from '../painting/alignment.ts';
import { IntProperty } from '../../foundation/diagnostic-properties.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { invariant } from '../../foundation/errors.ts';
export type AnimatedSwitcherTransitionBuilder = (
  child: Widget,
  animation: Animation<number>,
) => Widget;
export type AnimatedSwitcherLayoutBuilder = (
  currentChild: Widget | null,
  previousChildren: Widget[],
) => Widget;
export interface AnimatedSwitcherOptions extends WidgetOptions {
  readonly child?: Widget | null;
  readonly duration: number;
  readonly reverseDuration?: number | null;
  readonly switchInCurve?: Curve;
  readonly switchOutCurve?: Curve;
  readonly transitionBuilder?: AnimatedSwitcherTransitionBuilder;
  readonly layoutBuilder?: AnimatedSwitcherLayoutBuilder;
}
export class AnimatedSwitcher extends StatefulWidget {
  readonly child: Widget | null;
  readonly duration: number;
  readonly reverseDuration: number | null;
  readonly switchInCurve: Curve;
  readonly switchOutCurve: Curve;
  readonly transitionBuilder: AnimatedSwitcherTransitionBuilder;
  readonly layoutBuilder: AnimatedSwitcherLayoutBuilder;
  constructor({
    key = null,
    child = null,
    duration,
    reverseDuration = null,
    switchInCurve = Curves.linear,
    switchOutCurve = Curves.linear,
    transitionBuilder = AnimatedSwitcher.defaultTransitionBuilder,
    layoutBuilder = AnimatedSwitcher.defaultLayoutBuilder,
  }: AnimatedSwitcherOptions) {
    super(key);
    this.child = child;
    this.duration = duration;
    this.reverseDuration = reverseDuration;
    this.switchInCurve = switchInCurve;
    this.switchOutCurve = switchOutCurve;
    this.transitionBuilder = transitionBuilder;
    this.layoutBuilder = layoutBuilder;
  }
  static defaultTransitionBuilder(child: Widget, animation: Animation<number>): Widget {
    return new FadeTransition({
      key: new ValueKey<Key | null>(child.key, Key, sameKey, (k) => k?.hashCode ?? null),
      opacity: animation,
      child,
    });
  }
  static defaultLayoutBuilder(currentChild: Widget | null, previousChildren: Widget[]): Widget {
    return new Stack([...previousChildren, ...(currentChild ? [currentChild] : [])], {
      alignment: Alignment.center,
    });
  }
  createState(): State {
    return new AnimatedSwitcherState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new IntProperty('duration', Math.trunc(this.duration), { unit: 'ms' }));
    properties.add(
      new IntProperty(
        'reverseDuration',
        this.reverseDuration === null ? null : Math.trunc(this.reverseDuration),
        { unit: 'ms', defaultValue: null },
      ),
    );
  }
}
interface ChildEntry {
  readonly controller: AnimationController;
  readonly animation: CurvedAnimation;
  transition: Widget;
  widgetChild: Widget;
}
class AnimatedSwitcherState extends TickerProviderStateMixin<AnimatedSwitcher> {
  private current: ChildEntry | null = null;
  private readonly outgoing = new Set<ChildEntry>();
  private cached: readonly Widget[] | null = [];
  /** @dartType int */ private childNumber = 0;
  override initState(): void {
    super.initState();
    this.addEntry(false);
  }
  override didUpdateWidget(old: AnimatedSwitcher): void {
    super.didUpdateWidget(old);
    if (this.widget.transitionBuilder !== old.transitionBuilder) {
      for (const entry of this.outgoing) this.updateTransition(entry);
      if (this.current) this.updateTransition(this.current);
      this.cached = null;
    }
    const child = this.widget.child;
    if (
      (child !== null) !== (this.current !== null) ||
      (child !== null &&
        this.current !== null &&
        !Widget.canUpdate(child, this.current.widgetChild))
    ) {
      this.childNumber++;
      this.addEntry(true);
    } else if (this.current && child) {
      this.current.widgetChild = child;
      this.updateTransition(this.current);
      this.cached = null;
    }
  }
  private addEntry(animate: boolean): void {
    if (this.current) {
      const outgoing = this.current;
      this.outgoing.add(outgoing);
      outgoing.controller.reverse();
      this.cached = null;
      this.current = null;
    }
    const child = this.widget.child;
    if (child === null) return;
    const controller = new AnimationController({
        vsync: this,
        duration: this.widget.duration,
        reverseDuration: this.widget.reverseDuration,
      }),
      animation = new CurvedAnimation({
        parent: controller,
        curve: this.widget.switchInCurve,
        reverseCurve: this.widget.switchOutCurve,
      }),
      entry: ChildEntry = {
        controller,
        animation,
        widgetChild: child,
        transition: KeyedSubtree.wrap(
          this.widget.transitionBuilder(child, animation),
          this.childNumber,
        ),
      };
    animation.addStatusListener((status) => {
      if (status !== AnimationStatus.dismissed) return;
      invariant(
        this.mounted && this.outgoing.has(entry),
        'invalid-switcher-retirement',
        'Only live outgoing children may retire',
      );
      this.setState(() => {
        this.outgoing.delete(entry);
        this.cached = null;
      });
      controller.dispose();
      animation.dispose();
    });
    this.current = entry;
    if (animate) controller.forward();
    else controller.value = 1;
  }
  private updateTransition(entry: ChildEntry): void {
    entry.transition = new KeyedSubtree({
      key: entry.transition.key,
      child: this.widget.transitionBuilder(entry.widgetChild, entry.animation),
    });
  }
  override dispose(): void {
    this.current?.controller.dispose();
    this.current?.animation.dispose();
    for (const entry of this.outgoing) {
      entry.controller.dispose();
      entry.animation.dispose();
    }
    this.current = null;
    this.outgoing.clear();
    this.cached = null;
    super.dispose();
  }
  build(_context: BuildContext): Widget {
    this.cached ??= Object.freeze([...this.outgoing].map((entry) => entry.transition));
    return this.widget.layoutBuilder(this.current?.transition ?? null, [
      ...new Set(
        this.cached.filter(
          (outgoing) => !sameKey(outgoing.key, this.current?.transition.key ?? null),
        ),
      ),
    ]);
  }
}
