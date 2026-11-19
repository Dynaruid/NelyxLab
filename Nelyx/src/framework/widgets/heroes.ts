// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flight redirection adapted from packages/flutter/lib/src/widgets/heroes.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
// Shared-element flights use an explicit visual shuttle; application state stays in its route.
import { StatefulWidget, StatelessWidget, State, InheritedWidget, Element } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
import { TickerProviderStateMixin } from './ticker-provider.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import type { Animation } from '../animation/animation.ts';
import { ReverseAnimation } from '../animation/animations.ts';
import { Overlay, OverlayEntry } from './overlay.ts';
import { Opacity } from './opacity.ts';
import { Positioned } from './basic.ts';
import { RenderBox } from '../rendering/object.ts';
import { NavigatorController, routeTokenOf } from './navigation.ts';
import type { RouteTransition } from './navigation.ts';
import { RouteContentGeometry } from './route-content-geometry.ts';
import type { Rect } from '../../ui/types.ts';
import { invariant } from '../../foundation/errors.ts';
import { bounds, multiply } from '../../ui/geometry.ts';
import { ExcludeFocus } from './focus-scope.ts';
import { IgnorePointer } from './pointer-blocking.ts';
import { ExcludeSemantics } from './semantics.ts';

export interface HeroFlightEndpoint {
  readonly context: BuildContext;
  readonly hero: Hero;
  readonly rect: Rect;
}
export interface HeroFlightDetails {
  readonly animation: Animation<number>;
  readonly from: HeroFlightEndpoint;
  readonly to: HeroFlightEndpoint;
  readonly userGesture: boolean;
  onDispose(callback: () => void): void;
}

export class HeroMode extends StatelessWidget {
  constructor(
    readonly options: WidgetOptions & { readonly child: Widget; readonly enabled?: boolean },
  ) {
    super(options.key ?? null);
  }
  build(context: BuildContext): Widget {
    const parent = context.maybeDependOn(HeroModeScope);
    return new HeroModeScope(
      (parent?.enabled ?? true) && (this.options.enabled ?? true),
      this.options.child,
    );
  }
}

class HeroModeScope extends InheritedWidget {
  constructor(
    readonly enabled: boolean,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: this): boolean {
    return old.enabled !== this.enabled;
  }
}

export interface HeroOptions extends WidgetOptions {
  readonly tag: NonNullable<unknown>;
  readonly child: Widget;
  readonly flightShuttleBuilder: (
    context: BuildContext,
    direction: 'push' | 'pop',
    details: HeroFlightDetails,
  ) => Widget | null;
  readonly createRectTween?: (from: Rect, to: Rect) => (progress: number) => Rect;
  /** Measure anchors in their route layout before the route's paint transform. */
  readonly useRouteLayout?: boolean;
  readonly useRouteAnimation?: boolean;
  readonly transitionOnUserGestures?: boolean;
}
export class Hero extends StatefulWidget {
  constructor(readonly options: HeroOptions) {
    super(options.key ?? null);
  }
  createState(): State {
    return new HeroState();
  }
  static hasController(context: BuildContext, navigator: NavigatorController): boolean {
    return context.maybeDependOn(HeroScope)?.owner.widget.options.navigator === navigator;
  }
}
class HeroState extends State<Hero> {
  private owner: HeroControllerScopeState | undefined;
  private route: symbol | null = null;
  private geometry: RouteContentGeometry | undefined;
  private hidden = false;
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    if (this.context.maybeDependOn(HeroModeScope)?.enabled === false) {
      this.owner?.unregister(this, true);
      this.owner = undefined;
      this.route = null;
      this.hidden = false;
      return;
    }
    const owner = this.context.dependOn(HeroScope).owner,
      route = routeTokenOf(this.context);
    invariant(route, 'missing-hero-route', 'Hero requires a Navigator route');
    this.geometry = this.context.maybeDependOn(RouteContentGeometry);
    if (owner !== this.owner || route !== this.route) {
      this.owner?.unregister(this);
      this.owner = owner;
      this.route = route;
      owner.register(this, route);
    }
  }
  get registered(): boolean {
    return this.owner !== undefined;
  }
  get rect(): Rect | null {
    const render = this.context.findRenderObject();
    if (!(render instanceof RenderBox) || !render.hasSize || !render.attached) return null;
    if (this.widget.options.useRouteLayout && this.geometry) {
      const outside = this.geometry.outside.findRenderObject();
      const inside = this.geometry.inside.findRenderObject();
      if (outside?.attached && inside?.attached)
        return bounds(
          multiply(outside.getTransformTo(null), render.getTransformTo(inside)),
          render.size,
        );
    }
    return bounds(render.getTransformTo(null), render.size);
  }
  get routeAnimation(): Animation<number> | null {
    return this.geometry?.animation ?? null;
  }
  hide(hidden: boolean): void {
    if (this.mounted && this.hidden !== hidden)
      this.setState(() => {
        this.hidden = hidden;
      });
  }
  override didUpdateWidget(old: Hero): void {
    invariant(
      old.options.tag === this.widget.options.tag,
      'hero-tag-change',
      'Changing Hero tag requires a new key',
    );
  }
  override deactivate(): void {
    this.owner?.unregister(this);
    this.owner = undefined;
    this.route = null;
    super.deactivate();
  }
  override dispose(): void {
    this.owner?.unregister(this);
    super.dispose();
  }
  build(): Widget {
    return new Opacity(
      new ExcludeFocus(
        new ExcludeSemantics({
          excluding: this.hidden,
          child: new IgnorePointer(this.widget.options.child, { ignoring: this.hidden }),
        }),
        { excluding: this.hidden },
      ),
      { opacity: this.hidden ? 0 : 1 },
    );
  }
}
export interface HeroControllerScopeOptions extends WidgetOptions {
  readonly navigator: NavigatorController;
  readonly child: Widget;
  readonly duration?: number;
}
export class HeroControllerScope extends StatefulWidget {
  constructor(readonly options: HeroControllerScopeOptions) {
    super(options.key ?? null);
    invariant(
      Number.isFinite(options.duration ?? 300) && (options.duration ?? 300) >= 0,
      'invalid-hero-duration',
      'Hero duration must be nonnegative milliseconds',
    );
  }
  createState(): State {
    return new HeroControllerScopeState();
  }
}
class HeroScope extends InheritedWidget {
  constructor(
    readonly owner: HeroControllerScopeState,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: this): boolean {
    return old.owner !== this.owner;
  }
}
interface Flight {
  entry: OverlayEntry;
  animation: Animation<number>;
  from: HeroState;
  to: HeroState;
  routeTransition: RouteTransition;
  routeDriven: boolean;
  reversing: boolean;
  userGesture: boolean;
  currentRect: () => Rect;
  release: () => void;
}
class HeroControllerScopeState extends TickerProviderStateMixin<HeroControllerScope> {
  private readonly heroes = new Map<symbol, Set<HeroState>>();
  private readonly flights = new Set<Flight>();
  private unlisten: (() => void) | undefined;
  private epoch = 0;
  private gestureTransition: RouteTransition | null = null;
  register(hero: HeroState, route: symbol): void {
    const entries = this.heroes.get(route) ?? new Set<HeroState>();
    entries.add(hero);
    this.heroes.set(route, entries);
  }
  unregister(hero: HeroState, cancelFlights = false): void {
    for (const [route, entries] of this.heroes) {
      entries.delete(hero);
      if (!entries.size) this.heroes.delete(route);
    }
    if (cancelFlights) {
      const affected = [...this.flights].filter(
        (flight) => flight.from === hero || flight.to === hero,
      );
      if (affected.length)
        (this.context as Element).owner.postFrame(() => {
          for (const flight of affected) this.finish(flight);
        });
    }
  }
  private heroesFor(route: symbol): Map<NonNullable<unknown>, HeroState> {
    const result = new Map<NonNullable<unknown>, HeroState>();
    for (const hero of this.heroes.get(route) ?? []) {
      const tag = hero.widget.options.tag;
      invariant(!result.has(tag), 'duplicate-hero-tag', 'Hero tags must be unique within a route');
      result.set(tag, hero);
    }
    return result;
  }
  private finish(flight: Flight): void {
    if (!this.flights.delete(flight)) return;
    if (flight.entry.overlay) flight.entry.remove();
    flight.entry.dispose();
    flight.release();
    flight.from.hide(false);
    flight.to.hide(false);
  }
  private cancel(): void {
    this.epoch++;
    this.gestureTransition = null;
    const snapshot = [...this.flights];
    for (const flight of snapshot) this.finish(flight);
  }
  private readonly navigationChanged = () => {
    if (this.widget.options.navigator.userGestureInProgress || this.gestureTransition === null)
      return;
    this.gestureTransition = null;
    for (const flight of [...this.flights])
      if (flight.userGesture && flight.animation.isDismissed) this.finish(flight);
  };
  private readonly transition = (change: RouteTransition) => {
    const gesture = change.userGesture === true;
    const continuingGesture =
      !gesture &&
      this.gestureTransition?.from === change.from &&
      this.gestureTransition.to === change.to;
    const redirected = new Map<NonNullable<unknown>, Rect>();
    const reversing = new Set<NonNullable<unknown>>();
    if (!continuingGesture) {
      this.epoch++;
      this.gestureTransition = gesture ? change : null;
      for (const flight of [...this.flights]) {
        const previous = flight.routeTransition;
        const tag = flight.from.widget.options.tag;
        if (
          !gesture &&
          change.direction === 'pop' &&
          previous.direction === 'push' &&
          flight.routeDriven &&
          previous.from === change.to &&
          previous.to === change.from
        ) {
          // The outgoing route is reversing the animation already driving this
          // shuttle. Keep its visual and play its geometry backwards.
          flight.reversing = true;
          reversing.add(tag);
          continue;
        }
        if (previous.from === change.from || previous.to === change.from)
          redirected.set(tag, flight.currentRect());
        this.finish(flight);
      }
    }
    const epoch = this.epoch,
      context = this.context;
    invariant(
      context instanceof Element,
      'invalid-hero-context',
      'Hero flights require an Element',
    );
    const starts = [...this.heroesFor(change.from).values()]
      .filter((hero) => {
        if (reversing.has(hero.widget.options.tag)) return false;
        const interactive = hero.widget.options.transitionOnUserGestures === true;
        return gesture ? interactive : !continuingGesture || !interactive;
      })
      .map((hero) => ({ hero, rect: hero.rect, widget: hero.widget }));
    context.owner.postFrame(() => {
      const navigator = this.widget.options.navigator;
      if (!this.mounted || epoch !== this.epoch || (gesture && !navigator.userGestureInProgress))
        return;
      const overlay = Overlay.maybeOf(this.context);
      if (!overlay) return;
      const render = overlay.context.findRenderObject();
      if (!(render instanceof RenderBox)) return;
      const origin = render.localToGlobal({ x: 0, y: 0 });
      const targets = this.heroesFor(change.to);
      for (const start of starts) {
        const target = targets.get(start.widget.options.tag),
          end = target?.rect;
        if (!start.hero.registered || !start.rect || !target || !end) continue;
        if (gesture && target.widget.options.transitionOnUserGestures !== true) continue;
        const movingHero = change.direction === 'push' ? target : start.hero;
        const routeAnimation =
          gesture || movingHero.widget.options.useRouteAnimation === true
            ? movingHero.routeAnimation
            : null;
        if (gesture && routeAnimation === null) continue;
        const controller =
          routeAnimation === null
            ? new AnimationController({
                vsync: this,
                duration: this.widget.options.duration ?? 300,
              })
            : null;
        const animation =
          routeAnimation === null
            ? controller!
            : change.direction === 'push'
              ? routeAnimation
              : new ReverseAnimation(routeAnimation);
        if (routeAnimation !== null && animation.isCompleted) continue;
        const from = redirected.get(start.widget.options.tag) ?? start.rect;
        const to = end;
        let shuttle: Widget | null;
        let tween: (value: number) => Rect;
        const cleanups: (() => void)[] = [];
        const disposeShuttle = () => {
          for (const cleanup of cleanups.splice(0).reverse()) cleanup();
        };
        try {
          tween =
            (target.widget.options.createRectTween ?? start.widget.options.createRectTween)?.(
              from,
              to,
            ) ??
            ((t) => ({
              x: from.x + (to.x - from.x) * t,
              y: from.y + (to.y - from.y) * t,
              width: from.width + (to.width - from.width) * t,
              height: from.height + (to.height - from.height) * t,
            }));
          shuttle = start.widget.options.flightShuttleBuilder(this.context, change.direction, {
            animation,
            from: { context: start.hero.context, hero: start.widget, rect: start.rect },
            to: { context: target.context, hero: target.widget, rect: to },
            userGesture: gesture,
            onDispose: (callback) => cleanups.push(callback),
          });
        } catch (error) {
          controller?.dispose();
          disposeShuttle();
          throw error;
        }
        if (shuttle === null) {
          controller?.dispose();
          disposeShuttle();
          continue;
        }
        const visual = shuttle;
        const currentRect = () => tween(animation.value);
        const entry = new OverlayEntry({
          builder: () => {
            const rect = currentRect();
            return new Positioned(visual, {
              left: rect.x - origin.x,
              top: rect.y - origin.y,
              width: rect.width,
              height: rect.height,
            });
          },
        });
        const repaint = () => entry.markNeedsBuild();
        const reachedEnd = () => {
          if (
            flight.reversing
              ? animation.isDismissed
              : animation.isCompleted ||
                (gesture && animation.isDismissed && !navigator.userGestureInProgress)
          )
            this.finish(flight);
        };
        let listeningForPaint = false;
        let listeningForEnd = false;
        const flight: Flight = {
          entry,
          animation,
          from: start.hero,
          to: target,
          routeTransition: change,
          routeDriven: routeAnimation !== null,
          reversing: false,
          userGesture: gesture,
          currentRect,
          release: () => {
            if (listeningForPaint) animation.removeListener(repaint);
            if (listeningForEnd) animation.removeStatusListener(reachedEnd);
            controller?.dispose();
            disposeShuttle();
          },
        };
        this.flights.add(flight);
        try {
          start.hero.hide(true);
          target.hide(true);
          animation.addListener(repaint);
          listeningForPaint = true;
          overlay.insert(entry);
          if (controller)
            void controller.forward().then(
              () => this.finish(flight),
              () => this.finish(flight),
            );
          else {
            animation.addStatusListener(reachedEnd);
            listeningForEnd = true;
          }
        } catch (error) {
          this.finish(flight);
          throw error;
        }
      }
    });
  };
  override initState(): void {
    super.initState();
    this.listenTo(this.widget.options.navigator);
  }
  private listenTo(navigator: NavigatorController): void {
    const removeTransition = navigator.observeTransitions(this.transition, {
      includeUserGestures: true,
    });
    navigator.addListener(this.navigationChanged);
    this.unlisten = () => {
      removeTransition();
      navigator.removeListener(this.navigationChanged);
    };
  }
  override didUpdateWidget(old: HeroControllerScope): void {
    if (old.options.navigator !== this.widget.options.navigator) {
      this.cancel();
      this.unlisten?.();
      this.listenTo(this.widget.options.navigator);
    }
  }
  override dispose(): void {
    this.unlisten?.();
    this.cancel();
    this.heroes.clear();
    super.dispose();
  }
  build(): Widget {
    return new HeroScope(this, this.widget.options.child);
  }
}
