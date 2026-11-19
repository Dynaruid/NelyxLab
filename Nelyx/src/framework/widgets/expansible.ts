// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/widgets/expansible.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '../../foundation/errors.ts';
import { ChangeNotifier } from '../../foundation/notifier.ts';
import type { Clip } from '../../ui/clip.ts';
import { AnimationStatus } from '../animation/animation.ts';
import type { Animation } from '../animation/animation.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import type { AnimationStyle } from '../animation/animation-style.ts';
import { CurvedAnimation } from '../animation/animations.ts';
import { Curves } from '../animation/curves.ts';
import type { Curve } from '../animation/curves.ts';
import { Alignment } from '../painting/alignment.ts';
import { Align, Column } from './basic.ts';
import { ClipRect } from './clip.ts';
import { ExcludeFocus } from './focus-scope.ts';
import { StatefulWidget } from './framework.ts';
import type { BuildContext, State, Widget, WidgetOptions } from './framework.ts';
import { ListenableBuilder } from './listenable-builder.ts';
import { Offstage } from './offstage.ts';
import { PageStorage } from './page-storage.ts';
import { TickerMode } from './ticker-mode.ts';
import { SingleTickerProviderStateMixin } from './ticker-provider.ts';
import { MediaQuery } from './app-data.ts';

export class ExpansibleController extends ChangeNotifier {
  private expanded = false;
  get isExpanded(): boolean {
    return this.expanded;
  }
  expand(): void {
    this.update(true);
  }
  collapse(): void {
    this.update(false);
  }
  toggle(): void {
    this.update(!this.expanded);
  }
  private update(expanded: boolean): void {
    this.ensureAlive();
    if (this.expanded === expanded) return;
    this.expanded = expanded;
    this.notifyListeners();
  }
  static maybeOf(context: BuildContext): ExpansibleController | null {
    return context.findAncestorStateOfType(ExpansibleState)?.widget.controller ?? null;
  }
  static of(context: BuildContext): ExpansibleController {
    const controller = this.maybeOf(context);
    invariant(
      controller,
      'missing-expansible',
      'ExpansibleController.of requires an Expansible ancestor',
    );
    return controller;
  }
}

export type ExpansibleComponentBuilder = (
  context: BuildContext,
  animation: Animation<number>,
) => Widget;
export type ExpansibleBuilder = (
  context: BuildContext,
  header: Widget,
  body: Widget,
  animation: Animation<number>,
) => Widget;

export interface ExpansibleOptions extends WidgetOptions {
  readonly controller: ExpansibleController;
  readonly headerBuilder: ExpansibleComponentBuilder;
  readonly bodyBuilder: ExpansibleComponentBuilder;
  readonly expansibleBuilder?: ExpansibleBuilder;
  readonly animationStyle?: AnimationStyle | null;
  readonly duration?: number;
  readonly curve?: Curve;
  readonly reverseCurve?: Curve | null;
  readonly maintainState?: boolean;
  readonly bodyClipBehavior?: Clip;
}

export class Expansible extends StatefulWidget {
  constructor(readonly options: ExpansibleOptions) {
    super(options.key ?? null);
  }
  get controller(): ExpansibleController {
    return this.options.controller;
  }
  override createState(): State<Expansible> {
    return new ExpansibleState();
  }
}

class ExpansibleState extends SingleTickerProviderStateMixin<Expansible> {
  private animation!: AnimationController;
  private height!: CurvedAnimation;
  private get duration(): number {
    return this.widget.options.animationStyle?.duration ?? this.widget.options.duration ?? 200;
  }
  private get curve(): Curve {
    return this.widget.options.animationStyle?.curve ?? this.widget.options.curve ?? Curves.ease;
  }
  private get reverseCurve(): Curve | null {
    return (
      this.widget.options.animationStyle?.reverseCurve ?? this.widget.options.reverseCurve ?? null
    );
  }

  override initState(): void {
    super.initState();
    const saved = PageStorage.maybeOf(this.context)?.readState(this.context);
    const controller = this.widget.controller;
    const expanded = typeof saved === 'boolean' ? saved : controller.isExpanded;
    if (expanded) controller.expand();
    else controller.collapse();
    this.animation = new AnimationController({
      vsync: this,
      duration: this.duration,
      reverseDuration: this.widget.options.animationStyle?.reverseDuration ?? null,
      value: expanded ? 1 : 0,
      disableAnimations: () =>
        this.context.maybeDependOn(MediaQuery)?.data.disableAnimations ?? false,
    });
    this.height = new CurvedAnimation({
      parent: this.animation.view,
      curve: this.curve,
      reverseCurve: this.reverseCurve,
    });
    this.animation.addStatusListener(this.statusChanged);
    controller.addListener(this.expansionChanged);
  }

  override didUpdateWidget(old: Expansible): void {
    super.didUpdateWidget(old);
    this.animation.duration = this.duration;
    this.animation.reverseDuration = this.widget.options.animationStyle?.reverseDuration ?? null;
    this.height.curve = this.curve;
    this.height.reverseCurve = this.reverseCurve;
    if (old.controller !== this.widget.controller) {
      old.controller.removeListener(this.expansionChanged);
      this.widget.controller.addListener(this.expansionChanged);
      if (old.controller.isExpanded !== this.widget.controller.isExpanded) this.expansionChanged();
    }
  }

  private readonly expansionChanged = (): void => {
    const expanded = this.widget.controller.isExpanded;
    this.setState(() => {
      if (expanded) this.animation.forward();
      else this.animation.reverse();
    });
    PageStorage.maybeOf(this.context)?.writeState(this.context, expanded);
  };

  private readonly statusChanged = (status: AnimationStatus): void => {
    if (this.mounted && status === AnimationStatus.dismissed) this.setState(() => {});
  };

  override build(context: BuildContext): Widget {
    const options = this.widget.options;
    const closed = !this.widget.controller.isExpanded && this.animation.isDismissed;
    const animation = this.animation.view;
    const child =
      closed && options.maintainState === false
        ? null
        : new Offstage(
            new ExcludeFocus(new TickerMode(!closed, options.bodyBuilder(context, animation)), {
              excluding: closed,
            }),
            { offstage: closed },
          );
    return new ListenableBuilder({
      listenable: animation,
      child,
      builder: (context, child) => {
        const header = options.headerBuilder(context, animation);
        const body = new ClipRect(
          new Align(child ?? undefined, {
            alignment: Alignment.topCenter,
            heightFactor: this.height.value,
          }),
          { clipBehavior: options.bodyClipBehavior ?? 'hardEdge' },
        );
        return (
          options.expansibleBuilder?.(context, header, body, animation) ??
          new Column([header, body], { mainAxisSize: 'min' })
        );
      },
    });
  }

  override dispose(): void {
    this.widget.controller.removeListener(this.expansionChanged);
    this.animation.removeStatusListener(this.statusChanged);
    this.height.dispose();
    this.animation.dispose();
    super.dispose();
  }
}
