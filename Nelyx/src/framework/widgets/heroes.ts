// SPDX-License-Identifier: BSD-3-Clause
// Shared-element flights use an explicit visual shuttle; application state stays in its route.
import { StatefulWidget, State, InheritedWidget, Element } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
import { TickerProviderStateMixin } from './ticker-provider.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import { Overlay, OverlayEntry } from './overlay.ts';
import { Opacity } from './opacity.ts';
import { Positioned } from './basic.ts';
import { RenderBox } from '../rendering/object.ts';
import { NavigatorController, routeTokenOf } from './navigation.ts';
import type { RouteTransition } from './navigation.ts';
import type { Rect } from '../../ui/types.ts';
import { invariant } from '../../foundation/errors.ts';
import { bounds } from '../../ui/geometry.ts';
export interface HeroOptions extends WidgetOptions {
  readonly tag: string;
  readonly child: Widget;
  readonly flightShuttleBuilder: (context: BuildContext, direction: 'push' | 'pop') => Widget;
}
export class Hero extends StatefulWidget {
  constructor(readonly options: HeroOptions) {
    super(options.key ?? null);
  }
  createState(): State {
    return new HeroState();
  }
}
class HeroState extends State<Hero> {
  private owner: HeroControllerScopeState | undefined;
  private route: symbol | null = null;
  private hidden = false;
  override didChangeDependencies(): void {
    const owner = this.context.dependOn(HeroScope).owner,
      route = routeTokenOf(this.context);
    invariant(route, 'missing-hero-route', 'Hero requires a Navigator route');
    if (owner !== this.owner || route !== this.route) {
      this.owner?.unregister(this);
      this.owner = owner;
      this.route = route;
      owner.register(this, route);
    }
  }
  get rect(): Rect | null {
    const render = this.context.findRenderObject();
    if (!(render instanceof RenderBox) || !render.hasSize || !render.attached) return null;
    return bounds(render.getTransformTo(null), render.size);
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
    return new Opacity(this.widget.options.child, { opacity: this.hidden ? 0 : 1 });
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
  animation: AnimationController;
  from: HeroState;
  to: HeroState;
}
class HeroControllerScopeState extends TickerProviderStateMixin<HeroControllerScope> {
  private readonly heroes = new Map<symbol, Map<string, HeroState>>();
  private readonly flights = new Set<Flight>();
  private unlisten: (() => void) | undefined;
  private epoch = 0;
  register(hero: HeroState, route: symbol): void {
    const entries = this.heroes.get(route) ?? new Map();
    invariant(
      !entries.has(hero.widget.options.tag) || entries.get(hero.widget.options.tag) === hero,
      'duplicate-hero-tag',
      'Hero tags must be unique within a route',
    );
    entries.set(hero.widget.options.tag, hero);
    this.heroes.set(route, entries);
  }
  unregister(hero: HeroState): void {
    for (const [route, entries] of this.heroes) {
      for (const [tag, value] of entries) if (value === hero) entries.delete(tag);
      if (!entries.size) this.heroes.delete(route);
    }
  }
  private finish(flight: Flight): void {
    if (!this.flights.delete(flight)) return;
    if (flight.entry.overlay) flight.entry.remove();
    flight.entry.dispose();
    flight.animation.dispose();
    flight.from.hide(false);
    flight.to.hide(false);
  }
  private cancel(): void {
    this.epoch++;
    const snapshot = [...this.flights];
    for (const flight of snapshot) this.finish(flight);
  }
  private readonly transition = (change: RouteTransition) => {
    this.cancel();
    const epoch = this.epoch,
      context = this.context;
    invariant(
      context instanceof Element,
      'invalid-hero-context',
      'Hero flights require an Element',
    );
    const starts = [...(this.heroes.get(change.from)?.values() ?? [])].map((hero) => ({
      hero,
      rect: hero.rect,
      builder: hero.widget.options.flightShuttleBuilder,
      tag: hero.widget.options.tag,
    }));
    context.owner.postFrame(() => {
      if (!this.mounted || epoch !== this.epoch) return;
      const overlay = Overlay.maybeOf(this.context);
      if (!overlay) return;
      const render = overlay.context.findRenderObject();
      if (!(render instanceof RenderBox)) return;
      const origin = render.localToGlobal({ x: 0, y: 0 });
      for (const start of starts) {
        const target = this.heroes.get(change.to)?.get(start.tag),
          end = target?.rect;
        if (!start.rect || !target || !end) continue;
        const animation = new AnimationController({
            vsync: this,
            duration: this.widget.options.duration ?? 300,
          }),
          from = start.rect,
          to = end,
          shuttle = start.builder(this.context, change.direction);
        const entry = new OverlayEntry({
            builder: () => {
              const t = animation.value,
                lerp = (a: number, b: number) => a + (b - a) * t;
              return new Positioned(shuttle, {
                left: lerp(from.x, to.x) - origin.x,
                top: lerp(from.y, to.y) - origin.y,
                width: lerp(from.width, to.width),
                height: lerp(from.height, to.height),
              });
            },
          }),
          flight = { entry, animation, from: start.hero, to: target };
        this.flights.add(flight);
        try {
          start.hero.hide(true);
          target.hide(true);
          animation.addListener(() => entry.markNeedsBuild());
          overlay.insert(entry);
          void animation.forward().then(
            () => this.finish(flight),
            () => this.finish(flight),
          );
        } catch (error) {
          this.finish(flight);
          throw error;
        }
      }
    });
  };
  override initState(): void {
    super.initState();
    this.unlisten = this.widget.options.navigator.observeTransitions(this.transition);
  }
  override didUpdateWidget(old: HeroControllerScope): void {
    if (old.options.navigator !== this.widget.options.navigator) {
      this.cancel();
      this.unlisten?.();
      this.unlisten = this.widget.options.navigator.observeTransitions(this.transition);
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
