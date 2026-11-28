// SPDX-License-Identifier: BSD-3-Clause
// Own bounded transition lifetime over canonical Route entries and Core tickers.
import type { RouteEntry, Route, NavigatorController } from './navigation.ts';
import { State, StatefulWidget } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import type { TickerProvider } from '../animation/ticker.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import { AnimationStatus } from '../animation/animation.ts';
import type { Animation } from '../animation/animation.ts';
import {
  ProxyAnimation,
  TrainHoppingAnimation,
  kAlwaysDismissedAnimation,
} from '../animation/animations.ts';
import { TickerCanceled } from '../animation/ticker-future.ts';
import type { RouteTransitionPolicy } from './route-transition-policy.ts';
import { invariant } from '../../foundation/errors.ts';
import type { Key } from '../../foundation/key.ts';
import { Builder, ClipRect, ColoredBox, Padding, Positioned, SizedBox, Stack } from './basic.ts';
import { BackdropFilter } from './backdrop-filter.ts';
import { AnimatedBuilder } from './transitions.ts';
import { GestureDetector } from './gesture-detector.ts';
import { ListenableBuilder } from './listenable-builder.ts';
import { Semantics, BlockSemantics, ExcludeSemantics } from './semantics.ts';
import { PlatformViewModalBarrier } from './platform-view.ts';
import { Color } from '../../ui/color.ts';
import { Curves } from '../animation/curves.ts';
import { HitTestBehavior } from '../rendering/pointer-listener.ts';
import { EdgeInsets } from '../painting/edge-insets.ts';
import { FoundationPlatform } from '../../foundation/platform.ts';
import { Listenable } from '../../foundation/notifier.ts';
import { GlobalKey } from './global-key.ts';
import { RepaintBoundary } from './repaint-boundary.ts';
import { RouteContentGeometry } from './route-content-geometry.ts';
import { PrimaryScrollController } from './primary-scroll-controller.ts';
import { ScrollController } from './scroll-controller.ts';

class RoutePrimaryScrollScope extends StatefulWidget {
  constructor(
    readonly builder: (context: BuildContext) => Widget,
    key: Key,
  ) {
    super(key);
  }
  override createState(): State<RoutePrimaryScrollScope> {
    return new RoutePrimaryScrollState();
  }
}

class RoutePrimaryScrollState extends State<RoutePrimaryScrollScope> {
  private readonly controller = new ScrollController();

  override build(): Widget {
    return new PrimaryScrollController({
      controller: this.controller,
      child: new Builder(this.widget.builder),
    });
  }

  override dispose(): void {
    this.controller.dispose();
    super.dispose();
  }
}
interface Motion {
  readonly policy: RouteTransitionPolicy;
  readonly primary: AnimationController;
  readonly releasePrimary: () => void;
  readonly secondary: ProxyAnimation;
  readonly changed: () => void;
  readonly barrierId: string;
  readonly retirementListeners: Set<() => void>;
  secondaryTarget: symbol | null;
  removeTrainHopping: (() => void) | null;
}
let nextNavigationIdentity = 0;
const borrowedRouteControllers = new WeakSet<AnimationController>();
export class NavigationTransitions {
  private readonly identity = ++nextNavigationIdentity;
  private nextBarrierIdentity = 0;
  private live: readonly RouteEntry[] = [];
  private rendered: readonly RouteEntry[] = [];
  private readonly exiting = new Set<symbol>();
  private readonly motions = new Map<symbol, Motion>();
  private pageRevision = 0;
  private readonly pages = new Map<
    symbol,
    { readonly builder: RouteEntry['builder']; readonly revision: number; readonly widget: Widget }
  >();
  private readonly adjacencies = new Map<
    symbol,
    {
      readonly previous: Route | null;
      readonly previousSettings: Route['settings'] | null;
      readonly next: Route | null;
    }
  >();
  private readonly pendingRetirements = new Set<symbol>();
  private closed = false;
  constructor(
    private readonly vsync: TickerProvider,
    private readonly changed: () => void,
    private readonly gesture: () => boolean,
    private readonly canPopGesture: (token: symbol) => boolean,
    private readonly reportError: (error: unknown) => void,
    private readonly navigator: () => NavigatorController,
  ) {}
  reconcile(entries: readonly RouteEntry[], context: BuildContext, initial = false): void {
    invariant(!this.closed, 'closed-route-transitions', 'Navigator transition owner is closed');
    const previous = this.live,
      oldRendered = this.rendered,
      nextTokens = new Set(entries.map((e) => e.token)),
      removedTop = previous.at(-1)?.token,
      simplePop =
        previous.length > entries.length && entries.every((e, i) => previous[i]?.token === e.token);
    this.live = entries;
    // Retired routes keep their original keyed subtree until reverse finishes.
    for (const old of previous)
      if (!nextTokens.has(old.token)) {
        const motion = this.motions.get(old.token);
        if (simplePop && old.token === removedTop && motion) {
          this.exiting.add(old.token);
          entries.at(-1)?.route.didPopNext(old.route);
          this.animate(motion, false);
          if (motion.primary.isDismissed) this.queueRetirement(old.token);
        } else this.release(old.token);
      }
    const fresh: Motion[] = [];
    for (const entry of entries) {
      const policy = entry.route.transitionPolicy;
      if (!policy) continue;
      const existing = this.motions.get(entry.token);
      if (existing) {
        invariant(
          existing.policy === policy,
          'route-policy-change',
          'A retained route token cannot change transition owner',
        );
        continue;
      }
      const provided = policy.transitionAnimationController ?? null;
      invariant(
        provided === null ||
          (provided.lowerBound === 0 &&
            provided.upperBound === 1 &&
            !borrowedRouteControllers.has(provided)),
        'invalid-route-animation-controller',
        'A provided route animation controller must cover [0, 1] and belong to one route at a time',
      );
      const initialValue = initial || previous.length === 0 ? 1 : 0;
      const originalDuration = provided?.duration ?? null;
      const originalReverseDuration = provided?.reverseDuration ?? null;
      const primary =
          provided ??
          new AnimationController({
            vsync: this.vsync,
            value: initialValue,
            duration: 300,
            reverseDuration: 300,
            debugLabel: 'Navigator route ' + entry.name,
          }),
        secondary = new ProxyAnimation(kAlwaysDismissedAnimation),
        retirementListeners = new Set<() => void>(),
        changed = () => {
          if (primary.isDismissed && this.exiting.has(entry.token))
            this.queueRetirement(entry.token);
          this.changed();
        };
      const releasePrimary = (): void => {
        if (!provided) {
          primary.dispose();
          return;
        }
        try {
          if (provided.isAnimating) provided.stop();
        } finally {
          provided.duration = originalDuration;
          provided.reverseDuration = originalReverseDuration;
          borrowedRouteControllers.delete(provided);
        }
      };
      if (provided) borrowedRouteControllers.add(provided);
      let attached = false;
      try {
        policy.attach({
          animation: primary,
          secondaryAnimation: secondary,
          context,
          navigator: this.navigator(),
          isCurrent: () => this.live.at(-1)?.token === entry.token,
          isActive: () => this.live.some((e) => e.token === entry.token),
          isFirst: () => this.live[0]?.token === entry.token,
          popGestureInProgress: this.gesture,
          canPopGesture: () => this.canPopGesture(entry.token),
          addRetirementListener: (listener) => {
            retirementListeners.add(listener);
            return () => {
              retirementListeners.delete(listener);
            };
          },
        });
        attached = true;
        primary.duration = originalDuration ?? policy.transitionDuration(context);
        primary.reverseDuration =
          originalReverseDuration ?? originalDuration ?? policy.reverseTransitionDuration(context);
        invariant(
          [primary.duration, primary.reverseDuration].every(
            (v) => v !== null && Number.isFinite(v) && v >= 0,
          ),
          'invalid-route-duration',
          'Route durations must be finite nonnegative milliseconds',
        );
        if (provided) primary.value = initialValue;
        primary.addStatusListener(changed);
        const motion: Motion = {
          policy,
          primary,
          releasePrimary,
          secondary,
          changed,
          retirementListeners,
          barrierId: 'navigator-' + this.identity + '-barrier-' + ++this.nextBarrierIdentity,
          secondaryTarget: null,
          removeTrainHopping: null,
        };
        this.motions.set(entry.token, motion);
        if (primary.value === 0) fresh.push(motion);
      } catch (error) {
        secondary.parent = null;
        releasePrimary();
        if (attached)
          try {
            policy.detach();
          } catch (cleanup) {
            throw new AggregateError([error, cleanup], 'Route transition admission failed');
          }
        throw error;
      }
    }
    const rendered = [...entries];
    for (const old of oldRendered)
      if (this.exiting.has(old.token) && !nextTokens.has(old.token))
        rendered.splice(Math.min(oldRendered.indexOf(old), rendered.length), 0, old);
    this.rendered = rendered;
    for (const motion of fresh) this.animate(motion, true);
    this.coordinate();
  }
  private animate(motion: Motion, forward: boolean): void {
    try {
      const simulation = motion.policy.createSimulation?.(forward);
      const future = simulation
        ? forward
          ? motion.primary.animateWith(simulation)
          : motion.primary.animateBackWith(simulation)
        : forward
          ? motion.primary.forward()
          : motion.primary.reverse();
      void future.orCancel.catch((error) => {
        if (!(error instanceof TickerCanceled)) this.reportError(error);
      });
    } catch (error) {
      this.reportError(error);
      motion.primary.value = forward ? 1 : 0;
    }
  }
  private coordinate(): void {
    for (const [i, entry] of this.live.entries()) {
      const nextEntry =
        this.live[i + 1] ??
        this.rendered
          .slice(this.rendered.findIndex((e) => e.token === entry.token) + 1)
          .find((e) => this.exiting.has(e.token));
      const previous = this.live[i - 1]?.route ?? null,
        nextRoute = nextEntry?.route ?? null,
        old = this.adjacencies.get(entry.token);
      const previousSettings = previous?.settings ?? null;
      if (!old || old.previous !== previous || old.previousSettings !== previousSettings)
        entry.route.didChangePrevious(previous);
      if (!old || old.next !== nextRoute) entry.route.didChangeNext(nextRoute);
      this.adjacencies.set(entry.token, { previous, previousSettings, next: nextRoute });
      const motion = this.motions.get(entry.token);
      if (!motion) continue;
      const next = nextEntry && this.motions.get(nextEntry.token),
        allowed =
          next &&
          motion.policy.canTransitionTo(next.policy) &&
          next.policy.canTransitionFrom(motion.policy);
      this.updateSecondary(
        motion,
        allowed ? nextEntry!.token : null,
        allowed ? next.primary : null,
      );
    }
  }
  private queueRetirement(token: symbol): void {
    if (this.closed || this.pendingRetirements.has(token)) return;
    this.pendingRetirements.add(token);
    void Promise.resolve()
      .then(() => {
        this.pendingRetirements.delete(token);
        const motion = this.motions.get(token);
        if (
          this.closed ||
          !this.exiting.has(token) ||
          !motion ||
          !motion.primary.isDismissed ||
          motion.primary.isAnimating
        )
          return;
        this.release(token);
        this.rendered = this.rendered.filter((e) => e.token !== token);
        this.coordinate();
        this.changed();
      })
      .catch(this.reportError);
  }
  // Source TransitionRoute's train handoff over the existing canonical owner.
  // A newly pushed route can replace a still reversing secondary transition.
  private updateSecondary(
    motion: Motion,
    target: symbol | null,
    next: Animation<number> | null,
  ): void {
    if (motion.secondaryTarget === target) return;
    const previousRemover = motion.removeTrainHopping;
    motion.removeTrainHopping = null;
    motion.secondaryTarget = target;
    try {
      const current = motion.secondary.parent,
        currentTrain = current instanceof TrainHoppingAnimation ? current.currentTrain : current;
      if (next === null) {
        motion.secondary.parent = kAlwaysDismissedAnimation;
        return;
      }
      if (currentTrain === null || currentTrain.value === next.value || !next.isAnimating) {
        motion.secondary.parent = next;
        return;
      }
      let hopping: TrainHoppingAnimation | null = null,
        removed = false;
      const remove = () => {
        if (removed) return;
        removed = true;
        next.removeStatusListener(jumpOnEnd);
        hopping?.dispose();
      };
      const finish = () => {
        if (this.closed || motion.removeTrainHopping !== remove) return;
        motion.secondary.parent = next;
        motion.removeTrainHopping = null;
        remove();
      };
      const jumpOnEnd = (status: AnimationStatus) => {
        if (!status.isAnimating) finish();
      };
      motion.removeTrainHopping = remove;
      next.addStatusListener(jumpOnEnd);
      hopping = new TrainHoppingAnimation(currentTrain, next, { onSwitchedTrain: finish });
      motion.secondary.parent = hopping;
    } finally {
      previousRemover?.();
    }
  }
  get entries(): readonly RouteEntry[] {
    return this.rendered;
  }
  /** Parent configuration changes rebuild pages without replacing their Element identity. */
  refreshPages(): void {
    ++this.pageRevision;
  }
  page(entry: RouteEntry): Widget {
    let page = this.pages.get(entry.token);
    if (!page || page.builder !== entry.builder || page.revision !== this.pageRevision) {
      const key = page?.widget.key ?? new GlobalKey();
      const builder = (context: BuildContext) =>
        new RepaintBoundary(
          entry.route.transitionPolicy?.buildPage(context) ?? entry.builder(context),
        );
      page = {
        builder: entry.builder,
        revision: this.pageRevision,
        widget:
          FoundationPlatform.defaultTargetPlatform === 'iOS' && !FoundationPlatform.isWeb
            ? new RoutePrimaryScrollScope(builder, key)
            : new Builder(builder, { key }),
      };
      this.pages.set(entry.token, page);
    }
    return page.widget;
  }
  firstVisibleIndex(): number {
    for (let i = this.rendered.length - 1; i >= 0; i--) {
      const entry = this.rendered[i]!,
        motion = this.motions.get(entry.token);
      if (i === this.rendered.length - 1 && this.gesture() && i > 0) continue;
      if (
        entry.opaque &&
        (!motion ||
          (motion.primary.status === AnimationStatus.completed &&
            !motion.primary.isAnimating &&
            !this.exiting.has(entry.token)))
      )
        return i;
    }
    return 0;
  }
  wrap(entry: RouteEntry, context: BuildContext, child: Widget, onDismiss: () => void): Widget {
    const motion = this.motions.get(entry.token);
    if (!motion) return child;
    const policy = motion.policy,
      dismissible = policy.barrierDismissible && this.live.at(-1)?.token === entry.token,
      semanticsDismissible =
        dismissible &&
        (policy.semanticsDismissible ??
          ['android', 'iOS', 'macOS'].includes(FoundationPlatform.defaultTargetPlatform)),
      action = semanticsDismissible && policy.barrierLabel !== null ? onDismiss : null,
      bottomInset = policy.barrierSemanticsBottomInset;
    const semantics = (child: Widget) =>
      new Semantics({
        ...(bottomInset ? { container: true } : {}),
        transportId: motion.barrierId,
        label: semanticsDismissible ? policy.barrierLabel : null,
        onTap: action,
        onDismiss: action,
        onTapHint: action ? (policy.barrierOnTapHint ?? null) : null,
        child,
      });
    const hitTarget = new GestureDetector(SizedBox.expand(), {
      behavior: HitTestBehavior.opaque,
      ...(bottomInset ? { excludeFromSemantics: true } : {}),
      ...(dismissible ? { onTap: onDismiss } : {}),
    });
    const content =
      bottomInset && semanticsDismissible
        ? new Stack([
            hitTarget,
            Positioned.fill(
              new ListenableBuilder(
                bottomInset,
                () =>
                  new Padding(
                    EdgeInsets.only({ bottom: bottomInset.value }),
                    semantics(SizedBox.expand()),
                  ),
              ),
            ),
          ])
        : semantics(hitTarget);
    const barrierContent = new BlockSemantics({
      child: new ExcludeSemantics({ excluding: !semanticsDismissible, child: content }),
    });
    const barrier = new AnimatedBuilder({
      animation: motion.primary,
      child: context.services.platformViews
        ? new PlatformViewModalBarrier(barrierContent)
        : barrierContent,
      builder: (_context, child) =>
        new ColoredBox({
          color:
            Color.lerp(
              null,
              policy.barrierColor,
              Curves.ease.transform(motion.primary.value),
            )?.toARGB32() ?? 0,
          child,
        }),
    });
    const transitions = new AnimatedBuilder({
      animation: Listenable.merge([motion.primary, motion.secondary]),
      child: new Builder(
        (inside) => new RouteContentGeometry(context, inside, motion.primary, child),
      ),
      builder: (context, child) =>
        motion.policy.buildTransitions(context, motion.primary, motion.secondary, child!),
    });
    const filteredBarrier = policy.barrierFilter
      ? new ClipRect(new BackdropFilter({ filter: policy.barrierFilter, child: barrier }))
      : barrier;
    return new Stack([filteredBarrier, transitions]);
  }
  private release(token: symbol): void {
    this.exiting.delete(token);
    this.pages.delete(token);
    this.adjacencies.delete(token);
    this.pendingRetirements.delete(token);
    const motion = this.motions.get(token);
    if (!motion) return;
    this.motions.delete(token);
    const errors: unknown[] = [];
    const snapshot = [...motion.retirementListeners];
    for (const listener of snapshot)
      try {
        listener();
      } catch (error) {
        errors.push(error);
      }
    motion.retirementListeners.clear();
    for (const other of this.motions.values())
      if (other.secondaryTarget === token)
        try {
          other.secondary.parent = kAlwaysDismissedAnimation;
          other.secondaryTarget = null;
          const remove = other.removeTrainHopping;
          other.removeTrainHopping = null;
          remove?.();
        } catch (error) {
          errors.push(error);
        }
    for (const cleanup of [
      () => motion.primary.removeStatusListener(motion.changed),
      () => {
        motion.secondary.parent = null;
      },
      () => {
        const remove = motion.removeTrainHopping;
        motion.removeTrainHopping = null;
        remove?.();
      },
      () => motion.policy.detach(),
      motion.releasePrimary,
    ])
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Route transition retirement failed');
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    const errors: unknown[] = [];
    const snapshot1 = [...this.motions.keys()];
    for (const token of snapshot1)
      try {
        this.release(token);
      } catch (error) {
        errors.push(error);
      }
    this.live = [];
    this.rendered = [];
    this.pages.clear();
    this.adjacencies.clear();
    this.pendingRetirements.clear();
    if (errors.length) throw new AggregateError(errors, 'Navigator transition teardown failed');
  }
}
