// SPDX-License-Identifier: BSD-3-Clause
// Nelyx bounded route ownership, asynchronous Back guards and serializable named stacks.
import { ChangeNotifier } from '../../foundation/notifier.ts';
import { invariant } from '../../foundation/errors.ts';
import { KeyMap, ValueKey } from '../../foundation/key.ts';
import type { Key } from '../../foundation/key.ts';
import { Offstage as CanonicalOffstage } from './offstage.ts';
import type { KeyEvent } from '../../ui/input.ts';
import { StatefulWidget, State, Element, InheritedWidget } from './framework.ts';
import type { Widget, BuildContext } from './framework.ts';
import { Builder } from './basic.ts';
import { OverlayTheater } from './internal/overlay-theater.ts';
import { TickerMode } from './ticker-mode.ts';
import { RestorationOwner, RestorationScope, UnmanagedRestorationScope } from './restoration.ts';
import type { FocusNode } from './focus.ts';
import { FocusScope } from './focus-scope.ts';
import type { Disposable } from '../../foundation/disposable.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import type { RouteTransitionPolicy } from './route-transition-policy.ts';
import { NavigationTransitions } from './navigation-transitions.ts';
import { Page, RouteSettings } from './page-settings.ts';
import { TickerProviderStateMixin } from './ticker-provider.ts';
import { IgnorePointer, AbsorbPointer } from './pointer-blocking.ts';
import { Semantics } from './semantics.ts';
import { SizedBox } from './basic.ts';
import { RepaintBoundary } from './repaint-boundary.ts';
import { Notification } from './notification-listener.ts';

const preparePageUpdate = Symbol('preparePageUpdate');
const reconcilePages = Symbol('reconcilePages');

function copyRouteArguments(value: unknown): unknown {
  const copy = cloneRouteValue(value);
  invariant(
    JSON.stringify(copy).length <= 2 * 1024 * 1024,
    'route-state-budget',
    'Route arguments exceed 2 Mi UTF-16 units',
  );
  return copy;
}

export class Route<_T = unknown> {
  readonly token = Symbol('route');
  private currentSettings: RouteSettings;
  private currentArguments: unknown;
  constructor(
    readonly builder: (context: BuildContext) => Widget,
    name = '',
    argumentsValue: unknown = null,
    private readonly routeOpaque = true,
    settings = new RouteSettings({ name, arguments: argumentsValue }),
  ) {
    this.currentSettings = settings;
    this.currentArguments = copyRouteArguments(settings.arguments);
  }
  get settings(): RouteSettings {
    return this.currentSettings;
  }
  get name(): string {
    return this.currentSettings.name ?? '';
  }
  get argumentsValue(): unknown {
    return this.currentArguments;
  }
  [preparePageUpdate](page: Page): () => void {
    const args = copyRouteArguments(page.arguments);
    return () => {
      this.currentSettings = page;
      this.currentArguments = args;
    };
  }
  get opaque(): boolean {
    return this.routeOpaque;
  }
  get transitionPolicy(): RouteTransitionPolicy | null {
    return null;
  }
  didPop(_result: unknown): boolean {
    return true;
  }
  didComplete(_result: unknown): void {}
  didChangePrevious(_previousRoute: Route | null): void {}
  didChangeNext(_nextRoute: Route | null): void {}
  didPopNext(_nextRoute: Route): void {}
}
export interface RouteEntry {
  readonly token: symbol;
  readonly builder: (context: BuildContext) => Widget;
  readonly name: string;
  readonly argumentsValue: unknown;
  readonly opaque: boolean;
  readonly route: Route;
}
interface Entry extends RouteEntry {
  readonly complete: (value: unknown) => void;
  readonly cancel: () => void;
}
interface PageEntry {
  readonly entry: Entry;
  readonly page: Page;
  readonly attached: Entry[];
}
export interface RouteDescriptor {
  readonly name: string;
  readonly argumentsValue: unknown;
}
export type RouteResolver = (settings: RouteDescriptor) => Route | null;
export type PopGuard = () => boolean | PromiseLike<boolean>;
export type PopPageCallback = (route: Route, result: unknown) => boolean;
export type DidRemovePageCallback = (page: Page) => void;
interface PageCallbacks {
  readonly pop: (route: Route, result: unknown) => boolean;
  readonly didRemove: DidRemovePageCallback;
}
const localHistoryOwners = new WeakMap<LocalHistoryEntry, () => void>();

export class LocalHistoryEntry {
  readonly onRemove: (() => void) | null;
  readonly impliesAppBarDismissal: boolean;

  constructor({
    onRemove = null,
    impliesAppBarDismissal = true,
  }: {
    readonly onRemove?: (() => void) | null;
    readonly impliesAppBarDismissal?: boolean;
  } = {}) {
    this.onRemove = onRemove;
    this.impliesAppBarDismissal = impliesAppBarDismissal;
  }

  remove(): void {
    localHistoryOwners.get(this)?.();
  }
}

export interface RouteTransition {
  readonly from: symbol;
  readonly to: symbol;
  readonly direction: 'push' | 'pop';
  readonly userGesture?: boolean;
}

// Flutter widgets/navigator.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
const observerOwners = new WeakMap<NavigatorObserver, NavigatorState>();
export class NavigatorObserver {
  get navigator(): NavigatorState | null {
    return observerOwners.get(this) ?? null;
  }
  didPush(_route: Route, _previousRoute: Route | null): void {}
  didPop(_route: Route, _previousRoute: Route | null): void {}
  didRemove(_route: Route, _previousRoute: Route | null): void {}
  didReplace(_options: {
    readonly newRoute?: Route | null;
    readonly oldRoute?: Route | null;
  }): void {}
  didChangeTop(_topRoute: Route, _previousTopRoute: Route | null): void {}
  didStartUserGesture(_route: Route, _previousRoute: Route | null): void {}
  didStopUserGesture(): void {}
}

export class NavigationNotification extends Notification {
  constructor({ canHandlePop }: { readonly canHandlePop: boolean }) {
    super();
    this.canHandlePop = canHandlePop;
  }
  readonly canHandlePop: boolean;
}

type NavigatorObservation = (observer: NavigatorObserver) => void;
class RouteVisibility extends InheritedWidget {
  constructor(
    child: Widget,
    readonly isCurrent: boolean,
    readonly controller: NavigatorController,
    readonly token: symbol,
    readonly route: Route,
    readonly opaque: boolean,
    readonly isInteractive = isCurrent,
    readonly impliesAppBarDismissal = false,
  ) {
    super(child);
  }
  updateShouldNotify(old: this): boolean {
    return (
      this.isCurrent !== old.isCurrent ||
      this.isInteractive !== old.isInteractive ||
      this.controller !== old.controller ||
      this.token !== old.token ||
      this.route !== old.route ||
      this.opaque !== old.opaque ||
      this.impliesAppBarDismissal !== old.impliesAppBarDismissal
    );
  }
}
/** Actual selected Navigator route state; full source ModalRoute remains separate. */
export function isCurrentRoute(context: BuildContext): boolean {
  return context.maybeDependOn(RouteVisibility)?.isCurrent ?? true;
}
export function routeTokenOf(context: BuildContext): symbol | null {
  return context.maybeDependOn(RouteVisibility)?.token ?? null;
}
/** The route owned by this subtree, including the route retained during pop. */
export function routeOf(context: BuildContext): Route | null {
  return context.maybeDependOn(RouteVisibility)?.route ?? null;
}
/** Opacity of the enclosing mounted entry, including a route retained during pop. */
export function routeOpacityOf(context: BuildContext): boolean | null {
  return context.maybeDependOn(RouteVisibility)?.opaque ?? null;
}
export function routeImpliesAppBarDismissal(context: BuildContext): boolean {
  return context.maybeDependOn(RouteVisibility)?.impliesAppBarDismissal ?? false;
}
export class NavigatorController extends ChangeNotifier {
  private entries: Entry[] = [];
  private disposed = false;
  private revision = 0;
  private consumer: object | undefined;
  get isAttached(): boolean {
    return !this.disposed && this.consumer !== undefined;
  }
  private readonly guards = new Map<symbol, Map<PopGuard, () => boolean>>();
  private readonly localHistory = new Map<symbol, LocalHistoryEntry[]>();
  hasBlockingPopGuard(token: symbol): boolean {
    const page = this.entries.find((entry) => entry.token === token)?.route.settings;
    return (
      (page instanceof Page && !page.canPop) ||
      this.localHistory.has(token) ||
      [...(this.guards.get(token)?.values() ?? [])].some((blocks) => blocks())
    );
  }
  private pendingPop: Promise<boolean> | undefined;
  private readonly transitions = new Map<(transition: RouteTransition) => void, boolean>();
  observeTransitions(
    listener: (transition: RouteTransition) => void,
    { includeUserGestures = false }: { readonly includeUserGestures?: boolean } = {},
  ): () => void {
    this.ensureAlive();
    this.transitions.set(listener, includeUserGestures);
    return () => {
      this.transitions.delete(listener);
    };
  }
  private transition(
    from: symbol | undefined,
    to: symbol | undefined,
    direction: 'push' | 'pop',
    userGesture = false,
  ): void {
    if (!from || !to) return;
    const event: RouteTransition = userGesture
      ? { from, to, direction, userGesture }
      : { from, to, direction };
    for (const [listener, includeUserGestures] of [...this.transitions])
      if ((!userGesture || includeUserGestures) && this.transitions.has(listener))
        try {
          listener(event);
        } catch (exception) {
          FlutterError.reportError(
            new FlutterErrorDetails({ exception, library: 'widgets library' }),
          );
        }
  }
  get routes(): readonly RouteEntry[] {
    return Object.freeze(
      this.entries.map(({ token, builder, name, argumentsValue, opaque, route }) =>
        Object.freeze({ token, builder, name, argumentsValue, opaque, route }),
      ),
    );
  }
  private gestureCount = 0;
  get userGestureInProgress(): boolean {
    return this.gestureCount > 0;
  }
  didStartUserGesture(): void {
    this.ensureAlive();
    this.gestureCount++;
    if (this.gestureCount !== 1) return;
    const route = this.entries.at(-1)?.route;
    const previous = this.entries.at(-2)?.route ?? null;
    this.notifyListeners();
    this.transition(this.entries.at(-1)?.token, this.entries.at(-2)?.token, 'pop', true);
    if (route)
      this.dispatchObservations?.([(observer) => observer.didStartUserGesture(route, previous)]);
  }
  didStopUserGesture(): void {
    this.ensureAlive();
    invariant(this.gestureCount > 0, 'unbalanced-pop-gesture', 'No pop gesture is in progress');
    this.gestureCount--;
    if (this.gestureCount === 0) {
      this.notifyListeners();
      this.dispatchObservations?.([(observer) => observer.didStopUserGesture()]);
    }
  }
  get canPop(): boolean {
    const current = this.entries.at(-1);
    return (
      this.entries.length > 1 || (current !== undefined && this.localHistory.has(current.token))
    );
  }
  get handlesBack(): boolean {
    if (this.canPop) return true;
    const entry = this.entries.at(-1);
    const page = entry?.route.settings;
    return (
      (page instanceof Page && !page.canPop) ||
      (entry !== undefined && !!this.guards.get(entry.token)?.size)
    );
  }
  private namedResolver: RouteResolver | undefined;
  private pageCallbacks: PageCallbacks | undefined;
  private dispatchObservations:
    | ((observations: readonly NavigatorObservation[]) => void)
    | undefined;
  attach(
    owner: object,
    resolver?: RouteResolver,
    pageCallbacks?: PageCallbacks,
    dispatchObservations?: (observations: readonly NavigatorObservation[]) => void,
  ): () => void {
    this.ensureAlive();
    invariant(
      !this.consumer,
      'navigator-in-use',
      'NavigatorController belongs to one mounted Navigator',
    );
    this.consumer = owner;
    this.namedResolver = resolver;
    this.pageCallbacks = pageCallbacks;
    this.dispatchObservations = dispatchObservations;
    let live = true;
    return () => {
      if (live) {
        live = false;
        if (this.consumer === owner) {
          this.consumer = undefined;
          this.namedResolver = undefined;
          this.pageCallbacks = undefined;
          this.dispatchObservations = undefined;
          if (this.gestureCount > 0) {
            this.gestureCount = 0;
            this.notifyListeners();
          }
        }
      }
    };
  }

  private notifyNavigationObservers(
    observations: NavigatorObservation[],
    previousTop: Route | null,
    nextTop: Route | null,
  ): void {
    if (nextTop && nextTop !== previousTop)
      observations.push((observer) => observer.didChangeTop(nextTop, previousTop));
    this.dispatchObservations?.(observations);
  }
  private namedRoute(name: string, argumentsValue: unknown): Route {
    this.ensureAlive();
    invariant(
      this.namedResolver,
      'missing-route-resolver',
      'Named navigation requires a mounted Navigator route resolver',
    );
    const route = this.namedResolver({ name, argumentsValue: cloneRouteValue(argumentsValue) });
    invariant(route, 'unknown-named-route', 'No route for ' + name);
    return route;
  }
  pushNamed<T = unknown>(name: string, argumentsValue: unknown = null): Promise<T | undefined> {
    return this.push<T>(this.namedRoute(name, argumentsValue));
  }
  pushReplacement<T = unknown, R = unknown>(route: Route<T>, result?: R): Promise<T | undefined> {
    this.ensureAlive();
    invariant(
      this.entries.length > 0 && !this.entries.some((entry) => entry.token === route.token),
      'invalid-route',
      'Replacement requires a distinct route and initialized Navigator',
    );
    const previous = this.entries.at(-1)!,
      index = this.entries.length - 1;
    const promise = new Promise<T | undefined>((resolve, reject) => {
      this.entries[index] = this.entry(
        route,
        (value) => resolve(value as T | undefined),
        () => reject(new Error('Navigator disposed before route completed')),
      );
    });
    void promise.catch(() => {});
    this.revision++;
    this.transition(previous.token, route.token, 'push');
    try {
      this.notifyListeners();
    } catch (error) {
      const current = this.entries.findIndex((entry) => entry.token === route.token);
      if (current >= 0) {
        this.entries.splice(current, 1)[0]!.cancel();
        if (!this.entries.some((entry) => entry.token === previous.token))
          this.entries.splice(Math.min(index, this.entries.length), 0, previous);
      }
      this.revision++;
      throw error;
    }
    this.guards.delete(previous.token);
    this.detachLocalHistory(previous.token);
    this.notifyNavigationObservers(
      [(observer) => observer.didReplace({ newRoute: route, oldRoute: previous.route })],
      previous.route,
      route,
    );
    previous.complete(result);
    if (previous.route.settings instanceof Page)
      this.pageCallbacks?.didRemove(previous.route.settings);
    return promise;
  }
  pushReplacementNamed<T = unknown, R = unknown>(
    name: string,
    {
      argumentsValue = null,
      result,
    }: { readonly argumentsValue?: unknown; readonly result?: R } = {},
  ): Promise<T | undefined> {
    return this.pushReplacement<T, R>(this.namedRoute(name, argumentsValue), result);
  }
  popAndPushNamed<T = unknown, R = unknown>(
    name: string,
    {
      argumentsValue = null,
      result,
    }: { readonly argumentsValue?: unknown; readonly result?: R } = {},
  ): Promise<T | undefined> {
    const route = this.namedRoute(name, argumentsValue);
    this.pop(result);
    return this.push<T>(route);
  }
  private entry(
    route: Route,
    complete: (value: unknown) => void = () => {},
    cancel: () => void = () => {},
  ): Entry {
    return {
      token: route.token,
      builder: route.builder,
      name: route.name,
      argumentsValue: route.argumentsValue,
      opaque: route.opaque,
      route,
      complete: (value) => {
        route.didComplete(value);
        complete(value);
      },
      cancel,
    };
  }
  initialize(route: Route): void {
    this.ensureAlive();
    invariant(
      !this.entries.length,
      'navigator-initialized',
      'Navigator already has an initial route',
    );
    this.entries = [this.entry(route)];
    this.revision++;
  }
  push<T>(route: Route<T>): Promise<T | undefined> {
    invariant(
      !this.disposed &&
        this.entries.length > 0 &&
        this.entries.length < 32 &&
        !this.entries.some((entry) => entry.token === route.token),
      'invalid-route',
      'Navigator closed, uninitialized, full or route reused',
    );
    const previous = this.entries.at(-1),
      promise = new Promise<T | undefined>((resolve, reject) => {
        this.entries.push(
          this.entry(
            route,
            (value) => resolve(value as T | undefined),
            () => reject(new Error('Navigator disposed before route completed')),
          ),
        );
      });
    void promise.catch(() => {});
    this.revision++;
    this.transition(previous?.token, route.token, 'push');
    try {
      this.notifyListeners();
    } catch (error) {
      const index = this.entries.findIndex((e) => e.token === route.token);
      if (index >= 0) this.entries.splice(index, 1)[0]!.cancel();
      this.revision++;
      throw error;
    }
    const lastRoute = previous?.route ?? null;
    this.notifyNavigationObservers(
      [(observer) => observer.didPush(route, lastRoute)],
      lastRoute,
      route,
    );
    return promise;
  }
  pop<T>(result?: T): boolean {
    if (!this.canPop || this.disposed) return false;
    const entry = this.entries.at(-1)!;
    const local = this.localHistory.get(entry.token)?.at(-1);
    if (local) {
      local.remove();
      return true;
    }
    const page = entry.route.settings instanceof Page ? entry.route.settings : null;
    const popped =
      page && this.pageCallbacks
        ? this.pageCallbacks.pop(entry.route, result)
        : entry.route.didPop(result);
    if (!popped) {
      page?.onPopInvoked(false, result ?? null);
      return false;
    }
    this.entries.pop();
    const previous = this.entries.at(-1)?.route ?? null;
    this.revision++;
    this.guards.delete(entry.token);
    this.transition(entry.token, this.entries.at(-1)?.token, 'pop');
    try {
      this.notifyListeners();
    } finally {
      this.notifyNavigationObservers(
        [(observer) => observer.didPop(entry.route, previous)],
        entry.route,
        previous,
      );
      entry.complete(result);
      page?.onPopInvoked(true, result ?? null);
      if (page) this.pageCallbacks?.didRemove(page);
    }
    return true;
  }

  removeRoute<T>(route: Route<T>, result?: T): boolean {
    this.ensureAlive();
    const index = this.entries.findIndex((entry) => entry.route === route);
    if (index < 0 || this.entries.length === 1) return false;
    const oldTop = this.entries.at(-1)?.route ?? null;
    const previous = index > 0 ? this.entries[index - 1]!.route : null;
    const removed = this.entries.splice(index, 1)[0]!;
    const newTop = this.entries.at(-1)?.route ?? null;
    this.revision++;
    this.guards.delete(removed.token);
    this.detachLocalHistory(removed.token);
    this.notifyNavigationObservers(
      [(observer) => observer.didRemove(route, previous)],
      oldTop,
      newTop,
    );
    try {
      removed.complete(result);
    } finally {
      this.notifyListeners();
      if (route.settings instanceof Page) this.pageCallbacks?.didRemove(route.settings);
    }
    return true;
  }
  addLocalHistoryEntry(token: symbol, entry: LocalHistoryEntry): void {
    this.ensureAlive();
    invariant(
      this.entries.some((route) => route.token === token) && !localHistoryOwners.has(entry),
      'invalid-local-history-entry',
      'Local history requires a live route and an unattached entry',
    );
    const history = this.localHistory.get(token) ?? [];
    history.push(entry);
    this.localHistory.set(token, history);
    localHistoryOwners.set(entry, () => {
      history.splice(history.indexOf(entry), 1);
      localHistoryOwners.delete(entry);
      if (!history.length) this.localHistory.delete(token);
      this.localHistoryChanged();
      entry.onRemove?.();
    });
    this.localHistoryChanged();
  }

  routeImpliesAppBarDismissal(token: symbol): boolean {
    return (
      this.entries.findIndex((entry) => entry.token === token) > 0 ||
      (this.localHistory.get(token)?.some((entry) => entry.impliesAppBarDismissal) ?? false)
    );
  }

  private localHistoryChanged(): void {
    this.revision++;
    void Promise.resolve()
      .then(() => {
        if (!this.disposed) this.notifyListeners();
      })
      .catch((exception) =>
        FlutterError.reportError(
          new FlutterErrorDetails({ exception, library: 'widgets navigation' }),
        ),
      );
  }

  private detachLocalHistory(token: symbol): void {
    for (const entry of this.localHistory.get(token) ?? []) localHistoryOwners.delete(entry);
    this.localHistory.delete(token);
  }
  /** A stale/denied Back is consumed; it must never pop a replacement route or escape to a parent. */
  maybePop<T>(result?: T): Promise<boolean> {
    if (this.pendingPop) return this.pendingPop;
    if (this.disposed) return Promise.resolve(false);
    const entry = this.entries.at(-1),
      revision = this.revision,
      guards = entry ? [...(this.guards.get(entry.token)?.keys() ?? [])].reverse() : [];
    if (!entry || !this.handlesBack) return Promise.resolve(false);
    const operation = (async () => {
      for (const guard of guards) {
        if (!this.guards.get(entry.token)?.has(guard)) continue;
        if (!(await guard())) {
          const page = entry.route.settings;
          if (!this.disposed && revision === this.revision && page instanceof Page)
            page.onPopInvoked(false, result ?? null);
          return true;
        }
        if (this.disposed || revision !== this.revision) return true;
      }
      if (this.disposed || revision !== this.revision) return true;
      const page = entry.route.settings;
      if (page instanceof Page && !page.canPop) {
        page.onPopInvoked(false, result ?? null);
        return true;
      }
      return this.pop(result);
    })();
    this.pendingPop = operation;
    void operation
      .finally(() => {
        if (this.pendingPop === operation) this.pendingPop = undefined;
      })
      .catch(() => {});
    return operation;
  }
  registerPopGuard(
    token: symbol,
    guard: PopGuard,
    { blocksGesture = () => true }: { readonly blocksGesture?: () => boolean } = {},
  ): () => void {
    this.ensureAlive();
    invariant(
      this.entries.some((e) => e.token === token),
      'unknown-route',
      'Pop guard requires a live route',
    );
    const guards = this.guards.get(token) ?? new Map<PopGuard, () => boolean>();
    guards.set(guard, blocksGesture);
    this.guards.set(token, guards);
    const changed = () => {
      void Promise.resolve()
        .then(() => {
          if (!this.disposed) this.notifyListeners();
        })
        .catch((exception) =>
          FlutterError.reportError(
            new FlutterErrorDetails({ exception, library: 'widgets navigation' }),
          ),
        );
    };
    changed();
    let live = true;
    return () => {
      if (!live) return;
      live = false;
      guards.delete(guard);
      if (!guards.size) this.guards.delete(token);
      changed();
    };
  }
  replaceStack(
    routes: readonly Route[],
    { preserveCommonPrefix = false }: { readonly preserveCommonPrefix?: boolean } = {},
  ): void {
    this.ensureAlive();
    invariant(
      routes.length > 0 &&
        routes.length <= 32 &&
        new Set(routes.map((r) => r.token)).size === routes.length,
      'invalid-route-stack',
      'Route stack requires 1..32 distinct routes',
    );
    const old = this.entries;
    let prefix = preserveCommonPrefix;
    const next = routes.map((route, index) => {
      const previous = old[index];
      prefix =
        prefix &&
        !!previous &&
        previous.name === route.name &&
        JSON.stringify(cloneRouteValue(previous.argumentsValue)) ===
          JSON.stringify(cloneRouteValue(route.argumentsValue));
      return prefix
        ? { ...previous!, builder: route.builder, opaque: route.opaque }
        : (old.find((e) => e.token === route.token) ?? this.entry(route));
    });
    invariant(
      new Set(next.map((e) => e.token)).size === next.length,
      'invalid-route-stack',
      'Route prefix preservation would duplicate a route',
    );
    this.installStack(next, true);
  }

  [reconcilePages](pages: readonly Page[], context: BuildContext): void {
    this.ensureAlive();
    const keys = new KeyMap<Page>();
    const restorationIds = new Set<string>();
    for (const page of pages) {
      if (page.key !== null) {
        invariant(!keys.has(page.key), 'duplicate-page-key', 'Navigator page keys must be unique');
        keys.set(page.key, page);
      }
      if (page.restorationId !== null) {
        invariant(
          page.restorationId.length > 0 && !restorationIds.has(page.restorationId),
          'duplicate-page-restoration-id',
          'Navigator page restoration IDs must be nonempty and unique',
        );
        restorationIds.add(page.restorationId);
      }
    }
    const unowned: Entry[] = [];
    const previous: PageEntry[] = [];
    for (const entry of this.entries) {
      const settings = entry.route.settings;
      if (settings instanceof Page) previous.push({ entry, page: settings, attached: [] });
      else (previous.at(-1)?.attached ?? unowned).push(entry);
    }

    const matches: (PageEntry | undefined)[] = Array.from({ length: pages.length });
    let left = 0,
      oldRight = previous.length - 1,
      right = pages.length - 1;
    while (left <= oldRight && left <= right && previous[left]!.page.canUpdate(pages[left]!)) {
      matches[left] = previous[left];
      left++;
    }
    while (oldRight >= left && right >= left && previous[oldRight]!.page.canUpdate(pages[right]!)) {
      matches[right--] = previous[oldRight--];
    }
    const keyed = new KeyMap<PageEntry>();
    for (const item of previous.slice(left, oldRight + 1)) {
      if (item.page.key !== null) keyed.set(item.page.key, item);
    }
    const next = [...unowned];
    const updates: (() => void)[] = [];
    for (const [index, page] of pages.entries()) {
      const match = matches[index] ?? (page.key === null ? undefined : keyed.get(page.key));
      if (match && match.page.canUpdate(page)) {
        const { entry } = match;
        next.push(entry, ...match.attached);
        if (match.page !== page) {
          const update = entry.route[preparePageUpdate](page);
          const position = next.length - match.attached.length - 1;
          updates.push(() => {
            update();
            next[position] = {
              ...entry,
              name: entry.route.name,
              argumentsValue: entry.route.argumentsValue,
              opaque: entry.route.opaque,
            };
          });
        }
      } else {
        const route = page.createRoute(context);
        invariant(
          route.settings === page,
          'invalid-page-route',
          'A page must create a route that uses its settings',
        );
        next.push(this.entry(route));
      }
    }
    invariant(
      next.length > 0 &&
        next.length <= 32 &&
        new Set(next.map((entry) => entry.token)).size === next.length,
      'invalid-route-stack',
      'Route stack requires 1..32 distinct routes',
    );
    for (const update of updates) update();
    if (
      next.length !== this.entries.length ||
      next.some((entry, index) => entry !== this.entries[index])
    )
      this.installStack(next, false);
  }

  private installStack(next: Entry[], notifyRemovedPages: boolean): void {
    const tokens = new Set(next.map((entry) => entry.token));
    const previous = this.entries;
    const removed = previous.filter((entry) => !tokens.has(entry.token));
    this.entries = next;
    this.revision++;
    for (const entry of removed) {
      this.guards.delete(entry.token);
      this.detachLocalHistory(entry.token);
      entry.complete(undefined);
    }
    if (!notifyRemovedPages) {
      const from = previous.at(-1),
        to = next.at(-1);
      if (from && to && from.token !== to.token) {
        if (!previous.some((entry) => entry.token === to.token))
          this.transition(from.token, to.token, 'push');
        else if (!tokens.has(from.token)) this.transition(from.token, to.token, 'pop');
      }
    }
    try {
      this.notifyListeners();
    } finally {
      if (this.dispatchObservations) {
        const previousTokens = new Set(previous.map((entry) => entry.token));
        const observations: NavigatorObservation[] = [];
        for (const entry of [...removed].reverse()) {
          const below = previous
            .slice(0, previous.indexOf(entry))
            .reverse()
            .find((route) => tokens.has(route.token));
          observations.push((observer) => observer.didRemove(entry.route, below?.route ?? null));
        }
        next.forEach((entry, index) => {
          if (!previousTokens.has(entry.token))
            observations.push((observer) =>
              observer.didPush(entry.route, next[index - 1]?.route ?? null),
            );
        });
        this.notifyNavigationObservers(
          observations,
          previous.at(-1)?.route ?? null,
          next.at(-1)?.route ?? null,
        );
      }
      if (notifyRemovedPages)
        for (const { route } of removed)
          if (route.settings instanceof Page) this.pageCallbacks?.didRemove(route.settings);
    }
  }
  snapshot(): string {
    const snapshot = JSON.stringify({
      version: 1,
      routes: this.entries.map((e) => ({
        name: e.name,
        argumentsValue: cloneRouteValue(e.argumentsValue),
      })),
    });
    invariant(
      snapshot.length <= 2 * 1024 * 1024,
      'route-snapshot-budget',
      'Route snapshot exceeds 2 Mi UTF-16 units',
    );
    return snapshot;
  }
  restore(snapshot: string, resolver: RouteResolver): void {
    invariant(
      snapshot.length <= 2 * 1024 * 1024,
      'route-snapshot-budget',
      'Route snapshot exceeds 2 Mi UTF-16 units',
    );
    const decoded: unknown = JSON.parse(snapshot);
    invariant(
      !!decoded &&
        typeof decoded === 'object' &&
        'version' in decoded &&
        decoded.version === 1 &&
        'routes' in decoded &&
        Array.isArray(decoded.routes) &&
        decoded.routes.length > 0 &&
        decoded.routes.length <= 32,
      'invalid-route-snapshot',
      'Expected route snapshot v1',
    );
    const routes = decoded.routes.map((entry: unknown) => {
      invariant(
        !!entry && typeof entry === 'object' && 'name' in entry && typeof entry.name === 'string',
        'invalid-route-snapshot',
        'Route needs a name',
      );
      const route = resolver({
        name: entry.name,
        argumentsValue: cloneRouteValue('argumentsValue' in entry ? entry.argumentsValue : null),
      });
      invariant(route, 'unknown-restored-route', 'No route for restored name ' + entry.name);
      return route;
    });
    this.replaceStack(routes);
  }
  override dispose(): void {
    if (this.disposed) return;
    invariant(
      !this.consumer,
      'navigator-in-use',
      'Unmount Navigator before disposing its controller',
    );
    super.dispose();
    this.disposed = true;
    this.revision++;
    const entries = this.entries;
    this.entries = [];
    this.guards.clear();
    this.transitions.clear();
    for (const entry of entries) {
      this.detachLocalHistory(entry.token);
      entry.cancel();
    }
  }
}
/** Browser history and route restoration accept bounded JSON data, not object identities. */
export function cloneRouteValue(value: unknown, depth = 0): unknown {
  invariant(depth <= 32, 'route-state-depth', 'Route state is too deeply nested');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    invariant(Number.isFinite(value), 'invalid-route-number', 'Route state numbers must be finite');
    return value;
  }
  if (Array.isArray(value))
    return Object.freeze(value.map((item) => cloneRouteValue(item, depth + 1)));
  invariant(
    !!value &&
      typeof value === 'object' &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
    'invalid-route-state',
    'Route state must contain JSON values',
  );
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, item] of Object.entries(value)) result[key] = cloneRouteValue(item, depth + 1);
  return Object.freeze(result);
}
export interface NavigatorOptions {
  readonly restorationId?: string;
  readonly onGenerateRoute?: RouteResolver;
  readonly enabled?: boolean;
  readonly pages?: readonly Page[];
  readonly observers?: readonly NavigatorObserver[];
  readonly onDidRemovePage?: DidRemovePageCallback;
  /** @deprecated Use onDidRemovePage. */
  readonly onPopPage?: PopPageCallback;
}

export class Navigator extends StatefulWidget {
  constructor(
    readonly controller: NavigatorController,
    readonly initialRoute: Route | null,
    key: Key | null = null,
    readonly options: NavigatorOptions = {},
  ) {
    super(key);
    invariant(
      options.pages === undefined ? initialRoute !== null : options.pages.length > 0,
      'missing-initial-route',
      'Navigator requires an initial route or a nonempty pages list',
    );
    invariant(
      options.restorationId === undefined || options.pages !== undefined || options.onGenerateRoute,
      'missing-route-resolver',
      'Restorable Navigator requires a route resolver',
    );
    invariant(
      !options.onDidRemovePage || !options.onPopPage,
      'conflicting-page-callbacks',
      'Navigator accepts either onDidRemovePage or onPopPage',
    );
  }
  static maybeOf(
    context: BuildContext,
    { rootNavigator = false }: { readonly rootNavigator?: boolean } = {},
  ): NavigatorController | null {
    let result =
      context instanceof Element && context.stateObject instanceof NavigatorState
        ? context.stateObject.widget.controller
        : null;
    if (result === null || rootNavigator)
      context.visitAncestorElements((element) => {
        if (element.stateObject instanceof NavigatorState) {
          result = element.stateObject.widget.controller;
          return rootNavigator;
        }
        return true;
      });
    return result;
  }
  static of(
    context: BuildContext,
    options: { readonly rootNavigator?: boolean } = {},
  ): NavigatorController {
    const controller = this.maybeOf(context, options);
    invariant(controller, 'missing-navigator', 'Navigator.of requires a Navigator ancestor');
    return controller;
  }
  createState(): State {
    return new NavigatorState();
  }
}
export class NavigatorState extends TickerProviderStateMixin<Navigator> {
  get controller(): NavigatorController {
    return this.widget.controller;
  }
  canPop(): boolean {
    return this.controller.canPop;
  }
  push<T>(route: Route<T>): Promise<T | undefined> {
    return this.controller.push(route);
  }
  pushNamed<T>(name: string, argumentsValue?: unknown): Promise<T | undefined> {
    return this.controller.pushNamed<T>(name, argumentsValue);
  }
  pop<T>(result?: T): boolean {
    return this.controller.pop(result);
  }
  maybePop<T>(result?: T): Promise<boolean> {
    return this.controller.maybePop(result);
  }
  removeRoute<T>(route: Route<T>, result?: T): boolean {
    return this.controller.removeRoute(route, result);
  }
  private readonly transitionOwner = new NavigationTransitions(
    this,
    () => {
      if (this.mounted) {
        this.updateSystemBack(
          this.active && (this.reversing || this.widget.controller.handlesBack),
        );
        this.setState(() => {});
      }
    },
    () => this.widget.controller.userGestureInProgress,
    (token) => this.widget.controller.canPop && !this.widget.controller.hasBlockingPopGuard(token),
    (exception) =>
      FlutterError.reportError(
        new FlutterErrorDetails({ exception, library: 'widgets navigation transitions' }),
      ),
    () => this.widget.controller,
  );
  private restoring = false;
  private readonly persistence = new RestorationOwner(this, (bucket, _initial, needsRestore) => {
    if (this.widget.options.pages !== undefined) return;
    const snapshot = bucket?.read('routes');
    if (needsRestore && snapshot !== null && snapshot !== undefined) {
      invariant(
        typeof snapshot === 'string',
        'invalid-route-snapshot',
        'Stored route stack must be a string',
      );
      this.restoring = true;
      try {
        this.widget.controller.restore(snapshot, this.widget.options.onGenerateRoute!);
      } finally {
        this.restoring = false;
      }
    }
    if (bucket) bucket.write('routes', this.widget.controller.snapshot());
  });
  private releaseController: (() => void) | undefined;
  private routeObservers: readonly NavigatorObserver[] = [];
  private navigationScheduled = false;
  private updateObservers(observers: readonly NavigatorObserver[]): void {
    const next = new Set(observers);
    invariant(
      next.size === observers.length,
      'duplicate-navigator-observer',
      'Observers must be distinct',
    );
    for (const observer of observers) {
      const owner = observer.navigator;
      invariant(
        !owner ||
          owner === this ||
          !owner.mounted ||
          (owner.context instanceof Element && !owner.context.active),
        'navigator-observer-in-use',
        'An observer belongs to one mounted Navigator',
      );
    }
    for (const observer of this.routeObservers)
      if (!next.has(observer) && observerOwners.get(observer) === this)
        observerOwners.delete(observer);
    for (const observer of observers) observerOwners.set(observer, this);
    this.routeObservers = [...observers];
  }

  private readonly observeRouteEvents = (observations: readonly NavigatorObservation[]): void => {
    if (!observations.length || !this.routeObservers.length || !(this.context instanceof Element))
      return;
    const context = this.context;
    const observers = this.routeObservers;
    context.owner.postFrame(() => {
      if (!this.mounted || !context.active) return;
      for (const observation of observations) {
        for (const observer of observers) {
          if (observerOwners.get(observer) !== this) continue;
          try {
            observation(observer);
          } catch (exception) {
            FlutterError.reportError(
              new FlutterErrorDetails({ exception, library: 'widgets navigation observers' }),
            );
          }
        }
      }
    });
  };

  private scheduleNavigationNotification(): void {
    if (this.navigationScheduled || !(this.context instanceof Element)) return;
    this.navigationScheduled = true;
    const context = this.context;
    context.owner.postFrame(() => {
      this.navigationScheduled = false;
      if (!this.mounted || !context.active) return;
      new NavigationNotification({ canHandlePop: this.controller.handlesBack }).dispatch(context);
    });
  }
  private active = true;
  private systemBack: Disposable | undefined;
  private updateSystemBack(handles: boolean | null): void {
    const services = this.context.services.platformServices;
    if (!services || services.isClosed) return;
    void services
      .updateBackOwner(this, handles)
      .catch((exception) =>
        FlutterError.reportError(
          new FlutterErrorDetails({ exception, library: 'widgets library' }),
        ),
      );
  }
  private previous: readonly symbol[] = [];
  private restoration = new Map<symbol, FocusNode>();
  private pendingRestoration: { readonly token: symbol; readonly focus: FocusNode } | undefined;
  private get reversing(): boolean {
    return (
      this.transitionOwner.entries.at(-1)?.token !== this.widget.controller.routes.at(-1)?.token
    );
  }
  private handleBack(): Promise<boolean> {
    return this.reversing ? Promise.resolve(true) : this.widget.controller.maybePop();
  }
  private readonly routesChanged = () => {
    this.transitionOwner.reconcile(this.widget.controller.routes, this.context);
    if (this.context instanceof Element) {
      const routes = this.widget.controller.routes,
        tokens = routes.map((entry) => entry.token),
        owner = this.context.owner;
      if (tokens.length > this.previous.length) {
        this.pendingRestoration = undefined;
        const focus = owner.focus.primaryFocus ?? owner.focus.lastFocus;
        if (focus) this.restoration.set(tokens[tokens.length - 1]!, focus);
      } else if (tokens.length < this.previous.length) {
        const token = this.previous[this.previous.length - 1]!,
          focus = this.restoration.get(token);
        this.restoration.delete(token);
        this.pendingRestoration =
          focus && tokens.length ? { token: tokens[tokens.length - 1]!, focus } : undefined;
      }
      this.previous = tokens;
      for (const token of this.restoration.keys()) {
        if (!tokens.includes(token)) this.restoration.delete(token);
      }
    }
    if (!this.restoring && this.widget.options.pages === undefined)
      this.persistence.bucket?.write('routes', this.widget.controller.snapshot());
    this.updateSystemBack(this.active && (this.reversing || this.widget.controller.handlesBack));
    this.scheduleNavigationNotification();
    this.setState(() => {});
  };
  private readonly back = (event: KeyEvent) => {
    if (
      !this.active ||
      event.kind !== 'down' ||
      event.repeat ||
      !['Escape', 'BrowserBack', 'GoBack'].includes(event.key) ||
      !(this.reversing || this.widget.controller.handlesBack)
    )
      return false;
    void this.handleBack().catch((exception) =>
      FlutterError.reportError(new FlutterErrorDetails({ exception, library: 'widgets library' })),
    );
    return true;
  };
  override initState(): void {
    try {
      this.active = this.widget.options.enabled !== false;
      this.releaseController = this.widget.controller.attach(
        this,
        (settings) => this.widget.options.onGenerateRoute?.(settings) ?? null,
        {
          pop: (route, result) =>
            this.widget.options.onPopPage?.(route, result) ?? route.didPop(result),
          didRemove: (page) => this.widget.options.onDidRemovePage?.(page),
        },
        this.observeRouteEvents,
      );
      const pages = this.widget.options.pages;
      if (pages !== undefined) this.controller[reconcilePages](pages, this.context);
      else if (!this.controller.routes.length)
        this.controller.initialize(this.widget.initialRoute!);
      this.previous = this.widget.controller.routes.map((entry) => entry.token);
      this.transitionOwner.reconcile(this.widget.controller.routes, this.context, true);
      this.updateObservers(this.widget.options.observers ?? []);
      const initial = this.controller.routes;
      const top = initial.at(-1)?.route;
      if (top && this.routeObservers.length) {
        const observations = initial.map(
          ({ route }, index) =>
            (observer: NavigatorObserver) =>
              observer.didPush(route, initial[index - 1]?.route ?? null),
        );
        observations.push((observer) => observer.didChangeTop(top, null));
        this.observeRouteEvents(observations);
      }
      this.scheduleNavigationNotification();
      this.widget.controller.addListener(this.routesChanged);
      invariant(this.context instanceof Element, 'invalid-context', 'Navigator requires Element');
      this.context.owner.keyHandlers.add(this.back);
      this.systemBack = this.context.services.platformServices?.addObserver({
        didPopRoute: () => (this.active ? this.handleBack() : false),
      });
      this.updateSystemBack(this.active && this.widget.controller.handlesBack);
    } catch (error) {
      try {
        this.dispose();
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Navigator initialization cleanup failed');
      }
      throw error;
    }
  }
  override didChangeDependencies(): void {
    this.updateActivation();
    this.persistence.update(this.context, this.widget.options.restorationId ?? null);
  }
  private updateActivation(): void {
    const parentActive = this.context.maybeDependOn(RouteVisibility)?.isInteractive ?? true;
    this.active = parentActive && this.widget.options.enabled !== false;
    this.updateSystemBack(this.active && (this.reversing || this.widget.controller.handlesBack));
  }
  override didUpdateWidget(old: Navigator): void {
    invariant(
      old.controller === this.widget.controller,
      'navigator-controller-change',
      'Changing NavigatorController requires remount',
    );
    if (old.options.observers !== this.widget.options.observers)
      this.updateObservers(this.widget.options.observers ?? []);
    if (old.options.enabled !== this.widget.options.enabled) this.updateActivation();
    this.transitionOwner.refreshPages();
    const pages = this.widget.options.pages;
    if (pages !== old.options.pages) {
      if (pages !== undefined) this.controller[reconcilePages](pages, this.context);
      else this.controller.replaceStack([this.widget.initialRoute!]);
    }
    this.persistence.update(this.context, this.widget.options.restorationId ?? null);
  }
  override dispose(): void {
    const back = this.systemBack,
      release = this.releaseController;
    this.systemBack = undefined;
    this.releaseController = undefined;
    const errors: unknown[] = [];
    for (const cleanup of [
      () => this.widget.controller.removeListener(this.routesChanged),
      () => this.updateObservers([]),
      () => back?.dispose(),
      () => this.updateSystemBack(null),
      () => {
        this.restoration.clear();
        this.pendingRestoration = undefined;
      },
      () => {
        if (this.context instanceof Element) this.context.owner.keyHandlers.delete(this.back);
      },
      () => release?.(),
      () => this.persistence.dispose(),
      () => this.transitionOwner.dispose(),
      () => super.dispose(),
    ])
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Navigator cleanup failed');
  }
  build(): Widget {
    const live = this.widget.controller.routes;
    const routes = this.transitionOwner.entries,
      firstVisible = this.transitionOwner.firstVisibleIndex(),
      current = live.at(-1)?.token,
      top = routes.at(-1)?.token;
    const declarative = this.widget.options.pages !== undefined;
    const restorationEnabled = this.widget.options.restorationId !== undefined;
    const restorationOwners = new Map<string, symbol>();
    if (declarative && restorationEnabled) {
      for (const { route, token } of live) {
        const settings = route.settings;
        if (settings instanceof Page && settings.restorationId !== null)
          restorationOwners.set(settings.restorationId, token);
      }
    }
    const pending = this.pendingRestoration;
    if (
      pending &&
      top === current &&
      pending.token === current &&
      this.context instanceof Element
    ) {
      this.pendingRestoration = undefined;
      this.context.owner.postFrame(() => {
        if (
          this.mounted &&
          !this.reversing &&
          this.widget.controller.routes.at(-1)?.token === pending.token &&
          pending.focus.attached
        )
          pending.focus.requestFocus();
      });
    }
    const tree = new OverlayTheater(
      routes.map((entry, index) => {
        const active = this.active && entry.token === current,
          interactive = active && entry.token === top,
          offstage = index < firstVisible,
          policy = entry.route.transitionPolicy;
        let child: Widget =
          offstage && policy?.maintainState === false
            ? new SizedBox()
            : this.transitionOwner.page(entry);
        if (restorationEnabled || declarative) {
          const settings = entry.route.settings;
          const restorationId = !restorationEnabled
            ? null
            : !declarative
              ? 'route-' + index
              : settings instanceof Page
                ? settings.restorationId
                : null;
          // Exit animations can overlap a fresh page with the same restoration ID.
          const owner = restorationId === null ? undefined : restorationOwners.get(restorationId);
          child = new RestorationScope({
            restorationId: owner !== undefined && owner !== entry.token ? null : restorationId,
            child,
          });
        }
        const page = child;
        child = new Builder((context) =>
          this.transitionOwner.wrap(entry, context, page, () => {
            void this.widget.controller
              .maybePop()
              .catch((exception) =>
                FlutterError.reportError(
                  new FlutterErrorDetails({ exception, library: 'widgets route barrier' }),
                ),
              );
          }),
        );
        // A popped route keeps paint ownership through reverse. Its absorption
        // barrier stays above the underlay while all route actions/focus retire.
        child = new IgnorePointer(
          new AbsorbPointer(new Semantics({ excludeSemantics: !interactive, child }), {
            absorbing: entry.token === top && entry.token !== current,
          }),
          { ignoring: !this.active || entry.token !== top },
        );
        // Keep route motion local. Outside Offstage, the boundary can also replace
        // its recording with an empty one when a covered route hides its snapshots.
        return new RepaintBoundary(
          new Offstage(
            new RouteVisibility(
              new TickerMode(
                policy ? this.active && !offstage : active,
                new FocusScope(child, {
                  autofocus: interactive && policy?.requestFocus !== false,
                  canRequestFocus: interactive,
                  descendantsAreFocusable: interactive,
                  descendantsAreTraversable: interactive,
                  skipTraversal: true,
                  includeSemantics: false,
                  traversalEdgeBehavior: policy?.traversalEdgeBehavior ?? null,
                  directionalTraversalEdgeBehavior:
                    policy?.directionalTraversalEdgeBehavior ?? null,
                }),
              ),
              active,
              this.widget.controller,
              entry.token,
              entry.route,
              entry.opaque,
              interactive,
              this.widget.controller.routeImpliesAppBarDismissal(entry.token),
            ),
            offstage,
          ),
          new SymbolKey(entry.token),
        );
      }),
      firstVisible,
      'hardEdge',
    );
    return this.widget.options.restorationId === undefined
      ? tree
      : new UnmanagedRestorationScope({ bucket: this.persistence.bucket, child: tree });
  }
}
export class PopScope extends StatefulWidget {
  constructor(
    readonly options: {
      readonly child: Widget;
      readonly canPop?: boolean;
      readonly onWillPop?: PopGuard;
      readonly key?: Key | null;
    },
  ) {
    super(options.key ?? null);
  }
  createState(): State {
    return new PopScopeState();
  }
}
class PopScopeState extends State<PopScope> {
  private release: (() => void) | undefined;
  private route: RouteVisibility | undefined;
  private readonly guard = () =>
    this.widget.options.canPop === false ? false : (this.widget.options.onWillPop?.() ?? true);
  override didChangeDependencies(): void {
    const route = this.context.dependOn(RouteVisibility);
    if (this.route?.token === route.token && this.route.controller === route.controller) return;
    this.release?.();
    this.route = route;
    this.release = route.controller.registerPopGuard(route.token, this.guard, {
      blocksGesture: () =>
        this.widget.options.canPop === false || this.widget.options.onWillPop !== undefined,
    });
  }
  override deactivate(): void {
    this.release?.();
    this.release = undefined;
    this.route = undefined;
    super.deactivate();
  }
  override dispose(): void {
    this.release?.();
    super.dispose();
  }
  build(): Widget {
    return this.widget.options.child;
  }
}
class SymbolKey extends ValueKey<string> {
  constructor(readonly token: symbol) {
    super('route', token);
  }
}
/** Legacy navigation constructor; uses the canonical source-backed offstage renderer. */
export class Offstage extends CanonicalOffstage {
  constructor(child: Widget, offstage: boolean, key: Key | null = null) {
    super(child, { offstage, key });
  }
}
