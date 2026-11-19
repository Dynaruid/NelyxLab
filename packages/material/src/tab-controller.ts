// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '@nelyx/core/foundation/errors';
import { ChangeNotifier } from '@nelyx/core/foundation/notifier';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { Curve } from '@nelyx/core/framework/animation/curves';
import type { TickerProvider } from '@nelyx/core/framework/animation/ticker';
import { InheritedWidget, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  State,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { TickerMode } from '@nelyx/core/framework/widgets/ticker-mode';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { kTabScrollDuration } from './constants.ts';

const transfer = Symbol('DefaultTabController transfer');

export interface TabControllerOptions {
  readonly length: number;
  readonly vsync: TickerProvider;
  readonly initialIndex?: number;
  readonly animationDuration?: number | null;
}

export interface TabAnimateToOptions {
  readonly duration?: number | null;
  readonly curve?: Curve;
}

type ControllerTransfer = TabControllerOptions & {
  readonly [transfer]?: {
    readonly owner: AnimationController;
    readonly previousIndex: number;
  };
};

function tabIndexInRange(index: number, length: number): boolean {
  return Number.isSafeInteger(index) && index >= 0 && (length === 0 || index < length);
}

export class TabController extends ChangeNotifier {
  private owner: AnimationController | null;
  private currentIndex: number;
  private priorIndex: number;
  private changing = 0;
  readonly length: number;
  readonly animationDuration: number;

  constructor(options: TabControllerOptions) {
    super();
    const { vsync, initialIndex = 0, length } = options;
    const duration = options.animationDuration ?? kTabScrollDuration;
    invariant(
      Number.isSafeInteger(length) && length >= 0 && tabIndexInRange(initialIndex, length),
      'invalid-tab-controller-index',
      'TabController requires a valid length and initial selection',
    );
    invariant(
      Number.isFinite(duration) && duration >= 0,
      'invalid-tab-controller-duration',
      'TabController animation duration must be finite and nonnegative',
    );
    const adopted = (options as ControllerTransfer)[transfer];
    this.owner = adopted?.owner ?? AnimationController.unbounded({ vsync, value: initialIndex });
    this.currentIndex = initialIndex;
    this.priorIndex = adopted?.previousIndex ?? initialIndex;
    this.length = length;
    this.animationDuration = duration;
    ChangeNotifier.maybeDispatchObjectCreation(this);
  }

  get animation(): Animation<number> | null {
    return this.owner?.view ?? null;
  }
  get index(): number {
    return this.currentIndex;
  }
  set index(value: number) {
    this.changeIndex(value, 0, Curves.linear);
  }
  get previousIndex(): number {
    return this.priorIndex;
  }
  get indexIsChanging(): boolean {
    return this.changing !== 0;
  }
  get offset(): number {
    this.ensureAlive();
    return this.owner!.value - this.index;
  }
  set offset(value: number) {
    this.ensureAlive();
    invariant(
      Number.isFinite(value) && value >= -1 && value <= 1 && !this.indexIsChanging,
      'invalid-tab-controller-offset',
      'TabController offset must lie in [-1, 1] while no selection animation is running',
    );
    if (this.offset !== value) this.owner!.value = this.index + value;
  }

  animateTo(value: number, { duration, curve = Curves.ease }: TabAnimateToOptions = {}): void {
    this.changeIndex(value, duration ?? this.animationDuration, curve);
  }

  private changeIndex(value: number, duration: number, curve: Curve): void {
    this.ensureAlive();
    invariant(
      tabIndexInRange(value, this.length),
      'invalid-tab-controller-index',
      'Tab index is outside the controller length',
    );
    invariant(
      Number.isFinite(duration) && duration >= 0,
      'invalid-tab-controller-duration',
      'Tab animation duration must be finite and nonnegative',
    );
    if (this.length < 2 || this.currentIndex === value) return;
    this.priorIndex = this.currentIndex;
    this.currentIndex = value;
    const owner = this.owner!;
    this.changing++;
    if (duration === 0) {
      try {
        owner.value = value;
      } finally {
        this.changing--;
      }
      if (this.owner === owner) this.notifyListeners();
      return;
    }
    try {
      this.notifyListeners();
      if (this.owner !== owner) return;
      void owner.animateTo(this.currentIndex, { duration, curve }).whenCompleteOrCancel(() => {
        if (this.owner !== owner) return;
        this.changing--;
        this.notifyListeners();
      });
    } catch (error) {
      this.changing--;
      throw error;
    }
  }

  [transfer](
    length: number,
    animationDuration: number | null,
    vsync: TickerProvider,
  ): TabController {
    this.ensureAlive();
    const owner = this.owner!;
    const clampsIndex = length !== this.length && this.index >= length;
    const index = clampsIndex ? Math.max(0, length - 1) : this.index;
    const options: ControllerTransfer = {
      length,
      initialIndex: index,
      animationDuration,
      vsync,
      [transfer]: { owner, previousIndex: clampsIndex ? this.index : this.previousIndex },
    };
    const replacement = new TabController(options);
    if (clampsIndex) owner.value = index;
    this.owner = null;
    this.dispose();
    return replacement;
  }

  override dispose(): void {
    const owner = this.owner;
    this.owner = null;
    owner?.dispose();
    super.dispose();
  }
}

export interface DefaultTabControllerOptions extends WidgetOptions {
  readonly length: number;
  readonly initialIndex?: number;
  readonly animationDuration?: number | null;
  readonly child: Widget;
}

export class DefaultTabController extends StatefulWidget {
  readonly child: Widget;
  readonly length: number;
  readonly initialIndex: number;
  readonly animationDuration: number | null;

  constructor({
    child,
    length,
    initialIndex = 0,
    animationDuration = null,
    key = null,
  }: DefaultTabControllerOptions) {
    super(key);
    invariant(
      Number.isSafeInteger(length) && length >= 0 && tabIndexInRange(initialIndex, length),
      'invalid-tab-controller-index',
      'DefaultTabController requires a valid length and initial selection',
    );
    this.child = child;
    this.length = length;
    this.initialIndex = initialIndex;
    this.animationDuration = animationDuration;
  }

  static maybeOf(context: BuildContext): TabController | null {
    return context.maybeDependOn(TabControllerScope)?.controller ?? null;
  }

  static of(context: BuildContext): TabController {
    const controller = this.maybeOf(context);
    invariant(
      controller,
      'missing-tab-controller',
      'DefaultTabController.of requires a DefaultTabController ancestor',
    );
    return controller;
  }

  override createState(): State<DefaultTabController> {
    return new DefaultTabControllerState();
  }
}

class TabControllerScope extends InheritedWidget {
  constructor(
    readonly controller: TabController,
    readonly enabled: boolean,
    child: Widget,
  ) {
    super(child);
  }
  override updateShouldNotify(old: TabControllerScope): boolean {
    return old.controller !== this.controller || old.enabled !== this.enabled;
  }
}

class DefaultTabControllerState extends SingleTickerProviderStateMixin<DefaultTabController> {
  private controller!: TabController;
  override initState(): void {
    super.initState();
    const { length, initialIndex, animationDuration } = this.widget;
    this.controller = new TabController({ length, initialIndex, animationDuration, vsync: this });
  }

  override didUpdateWidget(old: DefaultTabController): void {
    super.didUpdateWidget(old);
    const { length, animationDuration } = this.widget;
    if (old.length !== length || old.animationDuration !== animationDuration)
      this.controller = this.controller[transfer](length, animationDuration, this);
  }

  override build(context: BuildContext): Widget {
    return new TabControllerScope(this.controller, TickerMode.of(context), this.widget.child);
  }

  override dispose(): void {
    this.controller.dispose();
    super.dispose();
  }
}
