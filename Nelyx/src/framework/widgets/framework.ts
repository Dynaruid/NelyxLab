// SPDX-License-Identifier: BSD-3-Clause
// Reviewed Widget/Element lifetime adaptation; source pins in upstream/framework-imports.json.
import { invariant, exceptionStack } from '../../foundation/errors.ts';
import { sameKey, KeyMap, UniqueKey } from '../../foundation/key.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { ErrorDescription, DiagnosticableTreeNode } from '../../foundation/diagnostics.ts';
import { DiagnosticsProperty, StringProperty } from '../../foundation/diagnostics.ts';
import type {
  DiagnosticPropertiesBuilder,
  DiagnosticsNode,
  DiagnosticsOptions,
} from '../../foundation/diagnostics.ts';
import { Diagnosticable, DiagnosticableTree } from '../../foundation/diagnosticable.ts';
import {
  FlagProperty,
  ObjectFlagProperty,
  EnumProperty,
} from '../../foundation/diagnostic-properties.ts';
import { objectRuntimeType } from '../../foundation/object.ts';
import { describeIdentity } from '../../foundation/diagnostics-identity.ts';
import { DiagnosticsSerializationDelegate } from '../../foundation/diagnostics-serialization.ts';
import type { JsonDiagnosticsNode } from '../../foundation/diagnostics-serialization.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import type { Key } from '../../foundation/key.ts';
import type { ViewControllerContext } from '../../hosting/runtime.ts';
import type { ViewMetrics } from '../../ui/types.ts';
import { ViewWorkBudget } from './view-work-budget.ts';
import { DormantChildCache } from './dormant-child-cache.ts';
import { RenderObject } from '../rendering/object.ts';
import { RenderErrorBox } from '../rendering/error-box.ts';
import { assertOutsideRenderPaint } from '../rendering/phase.ts';
import type { ParentData } from '../rendering/object.ts';
import { GestureArenaManager } from '../gestures/arena.ts';
import type { GestureBinding } from '../gestures/binding.ts';
import type { SemanticsBinding } from '../semantics/binding.ts';
import type { Disposable } from '../../foundation/disposable.ts';
import type { Listenable } from '../../foundation/notifier.ts';
import { FocusScope } from './focus.ts';
import { initializeElementType } from './widget-class-identity.ts';
import type { FocusManagerOptions } from './focus.ts';
import { GlobalKey } from './global-key.ts';
import type { KeyEvent } from '../../ui/input.ts';
import { HardwareKeyboard } from '../../services/hardware-keyboard.ts';
import { RawKeyboard } from '../../services/raw-keyboard.ts';
import type { Notification } from './notification-listener.ts';
import { OwnerTransaction } from '../../runtime/owner-transaction.ts';
import { DependencyScope } from '../../runtime/dependency-scope.ts';
import { DepthQueue } from '../../runtime/depth-queue.ts';

export abstract class Widget extends DiagnosticableTree {
  constructor(readonly key: Key | null = null) {
    super();
  }
  override toStringShort(): string {
    const type = objectRuntimeType(this, 'Widget');
    return this.key === null ? type : type + '-' + this.key;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.defaultDiagnosticsTreeStyle = 'dense';
  }
  get typeToken(): object {
    return this.constructor;
  }
  static canUpdate(a: Widget, b: Widget): boolean {
    return a.typeToken === b.typeToken && sameKey(a.key, b.key);
  }
  abstract createElement(): Element;
}
export interface WidgetOptions {
  readonly key?: Key | null;
}
export class IndexedSlot<T extends Element | undefined = Element | undefined> {
  readonly typeToken: object | symbol;
  constructor(
    readonly index: number,
    readonly value: T,
    options: { readonly typeToken?: object | symbol } = {},
  ) {
    if (!(Number.isSafeInteger(index) && index >= 0))
      invariant(false, 'invalid-slot-index', 'Slot index must be a nonnegative integer');
    this.typeToken = options.typeToken ?? IndexedSlot;
  }
  equals(other: unknown): boolean {
    return (
      other instanceof IndexedSlot &&
      other.constructor === this.constructor &&
      other.typeToken === this.typeToken &&
      other.index === this.index &&
      other.value === this.value
    );
  }
  get hashCode(): number {
    let identity = 0;
    if (this.value) {
      identity = slotIdentities.get(this.value) ?? ++nextSlotIdentity;
      slotIdentities.set(this.value, identity);
    }
    return (this.index * 31) ^ identity;
  }
}
const slotIdentities = new WeakMap<Element, number>();
let nextSlotIdentity = 0;
function sameSlot(a: unknown, b: unknown): boolean {
  return Object.is(a, b) || (a instanceof IndexedSlot && a.equals(b));
}
type InheritedType<T extends InheritedWidget> = abstract new (...args: never[]) => T;
const widgetTypeGetter = Object.getOwnPropertyDescriptor(Widget.prototype, 'typeToken')!.get;
function indexedInheritedType(widget: Widget): object | undefined {
  // An override may expose a live/instance type token. Keep its existing lookup
  // behavior instead of assuming that it is a stable constructor identity.
  for (
    let prototype: object | null = widget;
    prototype;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'typeToken');
    if (descriptor) return descriptor.get === widgetTypeGetter ? widget.typeToken : undefined;
  }
  return undefined;
}
export interface BuildContext {
  readonly widget: Widget;
  readonly services: ViewControllerContext;
  readonly mounted: boolean;
  dependOn<T extends InheritedWidget>(type: InheritedType<T>, aspect?: unknown): T;
  maybeDependOn<T extends InheritedWidget>(type: InheritedType<T>, aspect?: unknown): T | undefined;
  dependOnInheritedElement<T extends InheritedWidget>(
    ancestor: InheritedElement,
    aspect?: unknown,
  ): T;
  getElementForInheritedWidgetOfExactType<T extends InheritedWidget>(
    type: InheritedType<T>,
  ): InheritedElement | undefined;
  findAncestorWidgetOfExactType<T extends Widget>(
    type: abstract new (...args: never[]) => T,
  ): T | undefined;
  findAncestorStateOfType<T extends State>(
    type: abstract new (...args: never[]) => T,
  ): T | undefined;
  findRenderObject(): RenderObject | undefined;
  visitAncestorElements(visitor: (element: Element) => boolean): void;
  dispatchNotification(notification: Notification): void;
}
export interface NotifiableElementTarget {
  onNotification(notification: Notification): boolean;
}
class _NotificationNode {
  constructor(
    public parent: _NotificationNode | null,
    public current: NotifiableElementTarget | null,
  ) {}
  dispatchNotification(notification: Notification): void {
    if (this.current?.onNotification(notification) ?? true) return;
    this.parent?.dispatchNotification(notification);
  }
}
/** Isolated dirty queue; layout-time builders own a scope for their descendants. */
export class BuildScope {
  readonly scheduleRebuild: (() => void) | undefined;
  /** @internal Intrusive list of this View's nonempty build scopes. */
  _queuedOwner: BuildOwner | undefined;
  _previousDirtyScope: BuildScope | undefined;
  _nextDirtyScope: BuildScope | undefined;
  private _buildScheduled = false;
  private _building = false;
  private readonly queue = new DepthQueue<Element>();
  constructor({ scheduleRebuild }: { readonly scheduleRebuild?: () => void } = {}) {
    this.scheduleRebuild = scheduleRebuild;
  }
  get hasDirty(): boolean {
    return this.queue.size > 0;
  }
  /** @internal BuildOwner uses the source scope scheduling protocol. */
  _scheduleBuildFor(element: Element): void {
    if (!(element.buildScope === this))
      invariant(false, 'wrong-build-scope', 'Dirty element belongs to another build scope');
    if (this._queuedOwner && this._queuedOwner !== element.owner)
      invariant(false, 'foreign-build-scope', 'A pending build scope cannot mix View owners');
    if (element._queuedBuildScope !== this) {
      element._queuedBuildScope?._forget(element);
      this.queue.schedule(element);
      element._queuedBuildScope = this;
      element.owner._didQueueBuild(this);
    } else this.queue.schedule(element);
    if (!this._buildScheduled && !this._building) {
      this._buildScheduled = true;
      this.scheduleRebuild?.();
    }
  }
  /** @internal */
  _forget(element: Element): void {
    if (element._queuedBuildScope !== this) return;
    this.queue.remove(element);
    element._queuedBuildScope = undefined;
    element.owner._didUnqueueBuild(this);
  }
  /** @internal Rebuild only this scope, including newly dirtied shallow ancestors. */
  _flushDirtyElements(
    rebuild: (element: Element) => void,
    callback?: () => void,
    reportError: (details: FlutterErrorDetails) => void = (details) =>
      FlutterError.reportError(details),
  ): void {
    if (this._building)
      invariant(false, 'reentrant-build-scope', 'BuildScope cannot recursively flush itself');
    this._building = true;
    try {
      callback?.();
      let element: Element | undefined;
      while ((element = this.queue.pop())) {
        element._queuedBuildScope = undefined;
        element.owner._didUnqueueBuild(this);
        if (element._buildQueueDepth !== element.depth) {
          this._scheduleBuildFor(element);
          continue;
        }
        const current = element;
        try {
          rebuild(current);
        } catch (exception) {
          reportError(
            new FlutterErrorDetails({
              exception,
              stack: exceptionStack(exception),
              library: 'widgets library',
              context: new ErrorDescription('while rebuilding dirty elements'),
              informationCollector: () => [
                new DiagnosticsProperty(
                  'The element being rebuilt at the time was',
                  current.widget.constructor.name,
                ),
              ],
            }),
          );
        }
      }
    } finally {
      this._building = false;
      this._buildScheduled = false;
    }
  }
  /** @internal */
  _clear(): void {
    let element: Element | undefined;
    while ((element = this.queue.pop())) {
      element._queuedBuildScope = undefined;
      element.owner._didUnqueueBuild(this);
    }
    this._buildScheduled = false;
  }
}
export class BuildOwner {
  private readonly renderChildren = new OwnerTransaction<RenderObjectElement>((element) => {
    if (element.active) element._commitRenderChildren();
  });
  /** @internal One admission per actual render owner, including isolated builds. */
  _scheduleRenderChildren(element: RenderObjectElement): void {
    this.renderChildren.schedule(element);
  }
  /** Commit queued structural work before layout; no root projection traversal. */
  flushRenderTree(): void {
    assertOutsideRenderPaint();
    this.renderChildren.commit();
  }
  private viewWorkBudgetValue: ViewWorkBudget | undefined;
  /** @internal Created only by an explicitly bounded sliver in this View. */
  get viewWorkBudget(): ViewWorkBudget {
    return (this.viewWorkBudgetValue ??= new ViewWorkBudget(this.services.resources));
  }
  /** @internal Legacy trees incur no tracking tables or subtree scans. */
  get maybeViewWorkBudget(): ViewWorkBudget | undefined {
    return this.viewWorkBudgetValue;
  }
  private dormantChildrenValue: DormantChildCache | undefined;
  /** @internal Explicit dormant policy; ordinary trees allocate no cache. */
  get dormantChildren(): DormantChildCache {
    return (this.dormantChildrenValue ??= new DormantChildCache({
      resources: this.services.resources,
      canRetain: (root) => this.isInactiveRoot(root),
      retire: (root) => this.retireDormantRoot(root),
      activate: (root, parent, slot) => this.activateDormantRoot(root, parent, slot),
    }));
  }
  /** @internal */
  get maybeDormantChildren(): DormantChildCache | undefined {
    return this.dormantChildrenValue;
  }
  private isInactiveRoot(root: Element): boolean {
    return (
      !this.disposed &&
      root.owner === this &&
      !root.active &&
      root.mounted &&
      !root.parent &&
      this.inactive.has(root)
    );
  }
  private retireDormantRoot(root: Element): void {
    invariant(
      root.owner === this && !root.active && !root.parent && this.inactive.has(root),
      'invalid-dormant-retirement',
      'Dormant retirement requires an owned inactive root',
    );
    this.inactive.delete(root);
    root.unmount();
  }
  private activateDormantRoot(root: Element, parent: Element, slot: unknown): void {
    invariant(
      this.isInactiveRoot(root) && parent.active && parent.owner === this,
      'invalid-dormant-activation',
      'Dormant activation requires the original View and an active parent',
    );
    this.inactive.delete(root);
    try {
      root.activate(parent);
      root.attachRenderObject(slot);
    } catch (error) {
      const errors = [error];
      if (root.active || root.parent)
        try {
          this.deactivateChild(root);
        } catch (failure) {
          errors.push(failure);
        }
      this.inactive.delete(root);
      try {
        root.unmount();
      } catch (failure) {
        errors.push(failure);
      }
      if (errors.length > 1)
        throw new AggregateError(errors, 'Dormant activation and cleanup failed');
      throw error;
    }
  }
  readonly services: ViewControllerContext;
  private readonly viewMetricsReaders = new Map<Element, Set<keyof ViewMetrics> | null>();
  readonly keyboard: HardwareKeyboard;
  readonly rawKeyboard: RawKeyboard;
  readonly gestures = new GestureArenaManager();
  private pointerBinding: GestureBinding | undefined;
  private semanticsBindingValue: SemanticsBinding | undefined;
  get maybeSemanticsBinding(): SemanticsBinding | undefined {
    return this.semanticsBindingValue;
  }
  get semanticsBinding(): SemanticsBinding {
    if (!this.semanticsBindingValue)
      invariant(
        false,
        'missing-view-semantics-binding',
        "Semantics services require this BuildOwner's actual Root binding",
      );
    return this.semanticsBindingValue;
  }
  bindSemanticsBinding(binding: SemanticsBinding): Disposable {
    if (!(!this.disposed && !this.semanticsBindingValue))
      invariant(
        false,
        'invalid-view-semantics-binding',
        'BuildOwner already has a semantics binding or is closed',
      );
    this.semanticsBindingValue = binding;
    return {
      dispose: () => {
        if (this.semanticsBindingValue === binding) this.semanticsBindingValue = undefined;
      },
    };
  }
  get gestureBinding(): GestureBinding {
    if (!(this.pointerBinding && !this.pointerBinding.isClosed))
      invariant(
        false,
        'missing-view-gesture-binding',
        "Pointer services require this BuildOwner's live Root binding",
      );
    return this.pointerBinding;
  }
  /** The Root owns disposal; standalone BuildOwners do not invent a View provider. */
  bindGestureBinding(binding: GestureBinding): Disposable {
    if (!(!this.disposed && !this.pointerBinding && !binding.isClosed))
      invariant(
        false,
        'invalid-view-gesture-binding',
        'BuildOwner already has a binding or is closed',
      );
    this.pointerBinding = binding;
    return {
      dispose: () => {
        if (this.pointerBinding === binding) this.pointerBinding = undefined;
      },
    };
  }
  readonly focus: FocusScope;
  readonly keyHandlers = new Set<(event: KeyEvent) => boolean>();
  // Element records own membership; nonempty scopes form one intrusive list.
  private dirtyScopes: BuildScope | undefined;
  private queuedBuilds = 0;
  /** @internal BuildScope changes both summaries with its actual queue. */
  _didQueueBuild(scope: BuildScope): void {
    if (!scope._queuedOwner) {
      scope._queuedOwner = this;
      scope._nextDirtyScope = this.dirtyScopes;
      if (this.dirtyScopes) this.dirtyScopes._previousDirtyScope = scope;
      this.dirtyScopes = scope;
    }
    this.queuedBuilds++;
  }
  /** @internal */
  _didUnqueueBuild(scope: BuildScope): void {
    if (!(scope._queuedOwner === this && this.queuedBuilds > 0))
      invariant(false, 'invalid-dirty-owner', 'Dirty scope ownership is inconsistent');
    this.queuedBuilds--;
    if (!scope.hasDirty) {
      const previous = scope._previousDirtyScope,
        next = scope._nextDirtyScope;
      if (previous) previous._nextDirtyScope = next;
      else this.dirtyScopes = next;
      if (next) next._previousDirtyScope = previous;
      scope._queuedOwner = undefined;
      scope._previousDirtyScope = undefined;
      scope._nextDirtyScope = undefined;
    }
  }
  readonly defaultBuildScope = new BuildScope({
    scheduleRebuild: () => {
      if (!this.building) this.invalidate();
    },
  });
  private readonly globals = new KeyMap<Element>();
  private readonly reservations = new KeyMap<{ key: GlobalKey; parents: Set<Element> }>();
  private readonly inactive = new Set<Element>();
  private readonly retakenParents = new Set<Element>();
  currentElement: Element | undefined;
  building = false;
  disposed = false;
  private buildRevisionValue = 0;
  /** Completed rebuilds across the default and layout-owned isolated scopes. */
  get buildRevision(): number {
    return this.buildRevisionValue;
  }
  get hasDirty(): boolean {
    return this.queuedBuilds > 0;
  }
  get globalKeyCount(): number {
    return this.globals.size;
  }
  constructor(
    services: ViewControllerContext,
    readonly invalidate: () => void,
    readonly postFrame: (callback: () => void) => void = (callback) => callback(),
    focusOptions: FocusManagerOptions = {},
    readonly systemFonts: Listenable | null = null,
  ) {
    // Keep one live service facade per owner. A separate extensible target also
    // supports frozen host contexts; methods retain the host receiver/private
    // fields, and captured readMetrics functions record their actual build user.
    const methods = new Map<PropertyKey, { value: Function; bound: Function }>();
    const read = (key: PropertyKey): unknown => {
      const value = Reflect.get(services, key, services);
      if (typeof value !== 'function' || key === 'constructor') return value;
      const previous = methods.get(key);
      if (previous && previous.value === value) return previous.bound;
      const bound =
        key === 'readMetrics'
          ? (...fields: (keyof ViewMetrics)[]) => {
              const element = this.currentElement;
              if (element?.active && element.owner === this) {
                if (!fields.length) this.viewMetricsReaders.set(element, null);
                else if (this.viewMetricsReaders.get(element) !== null) {
                  let observed = this.viewMetricsReaders.get(element);
                  if (!observed) this.viewMetricsReaders.set(element, (observed = new Set()));
                  for (const field of fields) observed.add(field);
                }
              }
              return Reflect.apply(value, services, []);
            }
          : value.bind(services);
      methods.set(key, { value, bound });
      return bound;
    };
    this.services = new Proxy(Object.create(null) as ViewControllerContext, {
      get: (_target, key) => read(key),
      has: (_target, key) => Reflect.has(services, key),
      ownKeys: () => Reflect.ownKeys(services),
      getPrototypeOf: () => Reflect.getPrototypeOf(services),
      getOwnPropertyDescriptor: (_target, key) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(services, key);
        return descriptor
          ? {
              value: read(key),
              enumerable: descriptor.enumerable ?? false,
              configurable: true,
              writable: false,
            }
          : undefined;
      },
      set: () => false,
      defineProperty: () => false,
      deleteProperty: () => false,
      preventExtensions: () => false,
    });
    this.keyboard = services.platformServices?.keyboard ?? new HardwareKeyboard();
    this.rawKeyboard = services.platformServices?.rawKeyboard ?? new RawKeyboard();
    this.focus = new FocusScope(this.keyboard, focusOptions);
  }
  /** @internal Only changed selected fields rebuild their readers. Full reads
   * remain conservative; renderer replacement keeps the Root's full pass. */
  _viewMetricsChanged(previous: ViewMetrics | undefined, next: ViewMetrics): void {
    const snapshot1 = [...this.viewMetricsReaders];
    for (const [element, fields] of snapshot1) {
      if (!element.active || element.owner !== this) {
        this.viewMetricsReaders.delete(element);
        continue;
      }
      if (
        !previous ||
        fields === null ||
        [...fields].some((field) => !Object.is(previous[field], next[field]))
      )
        element.markNeedsBuild();
    }
  }
  /** @internal Deactivation retires dependencies just like inherited lookups. */
  _forgetViewMetricsReader(element: Element): void {
    this.viewMetricsReaders.delete(element);
  }
  /** Global source hook runs first; the owning View may also observe handled errors. */
  reportError(details: FlutterErrorDetails): void {
    FlutterError.reportError(details);
    this.services.reportError?.(details);
  }
  schedule(element: Element): void {
    assertOutsideRenderPaint();
    if (this.disposed) invariant(false, 'closed-build-owner', 'Build after View close');
    if (!element.active) return;
    element.buildScope._scheduleBuildFor(element);
  }
  forget(element: Element): void {
    element._queuedBuildScope?._forget(element);
  }
  register(element: Element): void {
    const key = element.widget.key;
    if (key instanceof GlobalKey) {
      if (!(!this.globals.has(key) && (!key.currentElement || key.currentElement === element)))
        invariant(
          false,
          'duplicate-global-key',
          'GlobalKey is already mounted in this or another View',
        );
      key.bind(element);
      this.globals.set(key, element);
    }
    this.viewWorkBudgetValue?.register(element);
  }
  unregister(element: Element): void {
    if (element instanceof RenderObjectElement) this.renderChildren.forget(element);
    this.viewWorkBudgetValue?.unregister(element);
    this.viewMetricsReaders.delete(element);
    const key = element.widget.key;
    if (!(key instanceof GlobalKey) || this.globals.get(key) !== element) return;
    this.globals.delete(key);
    key.bind(undefined);
  }
  reserve(key: GlobalKey, parent: Element): void {
    const reservation = this.reservations.get(key) ?? { key, parents: new Set<Element>() };
    reservation.parents.add(parent);
    this.reservations.set(key, reservation);
  }
  /** Detach without disposing; finalizeTree retires roots not reclaimed in this frame. */
  deactivateChild(child: Element): void {
    this.deactivateChildren([child]);
  }
  deactivateChildren(children: readonly Element[]): void {
    if (children.length === 0) return;
    const errors: unknown[] = [];
    let renders: readonly RenderObject[] | undefined;
    try {
      renders = childRenderObjects(children);
    } catch (error) {
      errors.push(error);
    }
    for (const child of children)
      try {
        child.detachRenderObject();
      } catch (error) {
        errors.push(error);
      }
    // Normal detachment already removes the exact owned child. Only a custom
    // hook/failure needs recovery; do not snapshot and reset every survivor.
    if (renders)
      for (const render of renders) {
        if (render.parent)
          try {
            RenderObject.prototype.remove.call(render.parent, render);
          } catch (error) {
            errors.push(error);
          }
        if (render.attached)
          try {
            RenderObject.prototype.detach.call(render);
          } catch (error) {
            errors.push(error);
          }
      }
    for (const child of children) {
      child.parent = undefined;
      this.inactive.add(child);
      try {
        child.deactivate();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Child deactivation failed');
  }
  /** @internal Finite streaming layout can retire a detached local subtree
   * before frame end. GlobalKey descendants keep their source retake window. */
  _retireInactiveSubtreeWithoutGlobalKeys(child: Element): boolean {
    if (
      !(
        !this.building &&
        child.owner === this &&
        !child.active &&
        !child.parent &&
        this.inactive.has(child)
      )
    )
      invariant(
        false,
        'invalid-inactive-retirement',
        'Early retirement requires an owned detached inactive root outside build',
      );
    const pending = [child];
    while (pending.length) {
      const current = pending.pop()!;
      if (current.widget.key instanceof GlobalKey) return false;
      pending.push(...current.children);
    }
    this.inactive.delete(child);
    child.unmount();
    return true;
  }
  retake(widget: Widget, parent: Element, slot?: unknown): Element | undefined {
    const key = widget.key;
    if (!(key instanceof GlobalKey)) return undefined;
    const child = this.globals.get(key);
    if (!child) return undefined;
    if (!(child !== parent && !parent.hasAncestor(child)))
      invariant(false, 'global-key-cycle', 'GlobalKey would move an ancestor below its descendant');
    const dormantRoot = this.dormantChildrenValue?.retainedRoot(child);
    try {
      if (child.active || child.parent) {
        const previous = child.parent;
        if (!previous)
          invariant(false, 'global-key-root-move', 'A mounted root cannot be reparented');
        previous.forgetChild(child);
        if (previous !== parent && previous.active) this.retakenParents.add(previous);
        this.deactivateChild(child);
      }
    } catch (error) {
      if (dormantRoot)
        try {
          this.dormantChildrenValue!.releaseRetaken(dormantRoot, child);
        } catch (cleanup) {
          throw new AggregateError(
            [error, cleanup],
            'GlobalKey extraction and dormant retirement failed',
          );
        }
      throw error;
    }
    if (dormantRoot) this.dormantChildrenValue!.releaseRetaken(dormantRoot, child);
    this.inactive.delete(child);
    try {
      if (!Widget.canUpdate(child.widget, widget)) {
        child.unmount();
        return undefined;
      }
      child.activate(parent);
      child.attachRenderObject(slot);
      return child;
    } catch (error) {
      // A user activation/attachment callback can fail after the old parent
      // released the subtree. Keep it in the canonical retirement owner.
      try {
        if (child.mounted) this.deactivateChild(child);
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'GlobalKey activation and deactivation failed');
      }
      throw error;
    }
  }
  parentRebuilt(parent: Element): void {
    this.buildRevisionValue++;
    this.retakenParents.delete(parent);
  }
  flushBuild(): void {
    assertOutsideRenderPaint();
    this.flushScope(this.defaultBuildScope);
  }
  /** Rebuild the context's isolated scope during an authorized layout callback. */
  buildScope(context: Element, callback?: () => void): void {
    if (!(context.active && context.owner === this))
      invariant(
        false,
        'invalid-build-scope-root',
        'Build scope requires an active context in this owner',
      );
    this.flushScope(context.buildScope, context, callback);
  }
  private flushScope(scope: BuildScope, context?: Element, callback?: () => void): void {
    assertOutsideRenderPaint();
    if (!(!this.building && !this.disposed))
      invariant(false, 'reentrant-build', 'BuildOwner is already building or closed');
    this.building = true;
    this.currentElement = context;
    let failed = false,
      failure: unknown;
    try {
      scope._flushDirtyElements(
        (element) => {
          if (!element.active) return;
          if (element.buildScope !== scope) {
            if (element.dirty) this.schedule(element);
            return;
          }
          if (!(!context || element === context || element._hasBuildScopeAncestor(context)))
            invariant(
              false,
              'wrong-build-scope-root',
              'Dirty element is outside the requested subtree',
            );
          if (element.dirty) {
            this.currentElement = element;
            element.rebuild();
          }
        },
        callback,
        (details) => this.reportError(details),
      );
    } catch (error) {
      failed = true;
      failure = error;
    } finally {
      this.currentElement = undefined;
      this.building = false;
    }
    try {
      this.flushRenderTree();
    } catch (error) {
      if (failed)
        throw new AggregateError([failure, error], 'Build and render owner commit failed');
      throw error;
    }
    if (failed) throw failure;
  }
  finalizeTree(): void {
    if (this.building) invariant(false, 'finalize-during-build', 'Cannot finalize during build');
    const errors: unknown[] = [];
    const snapshot2 = [...this.inactive];
    for (const root of snapshot2) {
      if (this.dormantChildrenValue?.has(root)) continue;
      this.inactive.delete(root);
      if (!root.active)
        try {
          root.unmount();
        } catch (error) {
          errors.push(error);
        }
    }
    // Reparenting can reserve a key under successive live parents in one frame.
    // Verify completed ownership, as source does, after all parents rebuild.
    for (const { key, parents } of this.reservations.values())
      if (
        [...parents].filter(
          (parent) =>
            parent.active &&
            parent.children.some(
              (child) => child.parent === parent && sameKey(child.widget.key, key),
            ),
        ).length > 1
      )
        errors.push(new Error('Multiple active parents retained the same GlobalKey'));
    for (const parent of this.retakenParents)
      if (parent.active)
        errors.push(
          new Error(
            `Duplicate GlobalKey: previous parent ${parent.widget.constructor.name} did not rebuild after its child was moved`,
          ),
        );
    this.retakenParents.clear();
    this.reservations.clear();
    if (errors.length) throw new AggregateError(errors, 'Finalizing widget tree failed');
  }
  dispose(): void {
    assertOutsideRenderPaint();
    if (this.disposed) return;
    this.disposed = true;
    this.pointerBinding = undefined;
    const errors: unknown[] = [];
    for (const dispose of [
      () => this.dormantChildrenValue?.dispose(),
      () => this.finalizeTree(),
      () => this.gestures.dispose(),
      () => this.focus.dispose(),
      () => {
        if (!this.services.platformServices) this.keyboard.dispose();
      },
    ])
      try {
        dispose();
      } catch (error) {
        errors.push(error);
      }
    const snapshot3 = [...this.globals.values()];
    for (const element of snapshot3)
      try {
        element.unmount();
      } catch (error) {
        errors.push(error);
      }
    if (!this.services.platformServices)
      try {
        this.rawKeyboard.dispose();
      } catch (error) {
        errors.push(error);
      }
    this.globals.clear();
    while (this.dirtyScopes) this.dirtyScopes._clear();
    this.defaultBuildScope._clear();
    this.renderChildren.dispose();
    this.keyHandlers.clear();
    this.viewMetricsReaders.clear();
    try {
      this.viewWorkBudgetValue?.assertDrained();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'BuildOwner teardown failed');
  }
}
const emptyRenderObjects: readonly RenderObject[] = Object.freeze([]);
function childRenderObjects(children: readonly Element[]): readonly RenderObject[] {
  // A component chain can forward its readonly projection without flattening
  // another array at every wrapper. Virtual child getters still run each time.
  if (children.length === 0) return emptyRenderObjects;
  if (children.length === 1) return children[0]!.renderObjects;
  return children.flatMap((child) => child.renderObjects);
}
export abstract class Element extends DiagnosticableTree implements BuildContext {
  private _notificationTree: _NotificationNode | null = null;
  private inheritedIndex: DependencyScope<InheritedElement> | undefined;
  private indexedType: object | undefined;
  private dynamicInheritedTypes = false;
  private updateInheritedTypes(): void {
    const incoming = this.parent?.inheritedIndex;
    this.indexedType =
      this instanceof InheritedElement ? indexedInheritedType(this.widget) : undefined;
    this.dynamicInheritedTypes =
      (this.parent?.dynamicInheritedTypes ?? false) ||
      (this instanceof InheritedElement && this.indexedType === undefined);
    this.inheritedIndex = this.dynamicInheritedTypes
      ? undefined
      : this instanceof InheritedElement
        ? new DependencyScope(incoming, this.indexedType!, this)
        : incoming;
  }
  private refreshInheritedTypes(): void {
    this.updateInheritedTypes();
    for (const child of this.children) if (child.active) child.refreshInheritedTypes();
  }
  protected attachNotificationTree(): void {
    this._notificationTree = this.parent?._notificationTree ?? null;
  }
  protected attachNotificationTarget(target: NotifiableElementTarget): void {
    this._notificationTree = new _NotificationNode(this.parent?._notificationTree ?? null, target);
  }
  dispatchNotification(notification: Notification): void {
    if (!this.mounted)
      invariant(
        false,
        'unmounted-notification-context',
        'Cannot dispatch a notification from a closed Element',
      );
    this._notificationTree?.dispatchNotification(notification);
  }
  parent: Element | undefined;
  owner!: BuildOwner;
  depth = 0;
  private lifecycle: 'initial' | 'active' | 'inactive' | 'defunct' = 'initial';
  dirty = true;
  /** @internal Intrusive dirty record, never reused for another Element. */
  _buildQueueIndex = -1;
  _buildQueueDepth = 0;
  _buildQueueOrder = 0;
  _queuedBuildScope: BuildScope | undefined;
  /** The nearest render owner is refreshed only at mount/GlobalKey activation. */
  protected parentRenderOwner: RenderObjectElement | undefined;
  /** @internal Shared ParentData link; widget getters are read at application. */
  _parentDataScope: ParentDataElement | null = null;
  private markRenderTreeSyncDirty(): void {
    const render = this instanceof RenderObjectElement ? this : this.parentRenderOwner;
    if (render) this.owner._scheduleRenderChildren(render);
  }
  private rebuilding = false;
  private dependencies: Set<InheritedElement> | undefined;
  private hadDependencies = false;
  // Source Element._parentBuildScope: scope ancestry changes at mount/retake,
  // not for every scheduling/check operation in a deep lazy child subtree.
  private parentBuildScope: BuildScope | undefined;
  private parentScopeAncestor: Element | undefined;
  private inheritBuildScope(parent: Element | undefined, owner: BuildOwner): void {
    const scope = parent?.buildScope ?? owner.defaultBuildScope;
    this.parentBuildScope = scope;
    // Cache an actual ancestor reached through parent links, not an assumed
    // owner for a scope. Distinct roots can legitimately share a BuildScope.
    this.parentScopeAncestor =
      parent && scope !== parent.parentBuildScope ? parent : parent?.parentScopeAncestor;
  }
  /** @internal Lazy build admission otherwise walks the same ancestor chain
   * for every new descendant. Mount/GlobalKey activation refresh this cache. */
  _hasBuildScopeAncestor(context: Element): boolean {
    const hasAncestor = this.hasAncestor;
    return (
      (hasAncestor === Element.prototype.hasAncestor && this.parentScopeAncestor === context) ||
      hasAncestor.call(this, context)
    );
  }
  protected currentSlot: unknown;
  get slot(): unknown {
    return this.currentSlot;
  }
  children: Element[] = [];
  constructor(public widget: Widget) {
    super();
  }
  get debugIsDefunct(): boolean {
    return this.lifecycle === 'defunct';
  }
  override toStringShort(): string {
    return this.debugIsDefunct ? describeIdentity(this) + '(DEFUNCT)' : this.widget.toStringShort();
  }
  override toDiagnosticsNode(o: DiagnosticsOptions = {}): DiagnosticsNode {
    return new _ElementDiagnosticableTreeNode(this, o);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.defaultDiagnosticsTreeStyle = 'dense';
    if (this.lifecycle !== 'initial')
      properties.add(new ObjectFlagProperty('depth', this.depth, { ifNull: 'no depth' }));
    const widget = this.debugIsDefunct ? null : this.widget;
    properties.add(new ObjectFlagProperty('widget', widget, { ifNull: 'no widget' }));
    properties.add(
      new DiagnosticsProperty('key', widget?.key ?? null, {
        showName: false,
        defaultValue: null,
        level: 'hidden',
      }),
    );
    widget?.debugFillProperties(properties);
    properties.add(new FlagProperty('dirty', this.dirty, { ifTrue: 'dirty' }));
    if (this.dependencies?.size) {
      const nodes = Array.from(this.dependencies)
        .sort((a, b) =>
          a.toStringShort() < b.toStringShort()
            ? -1
            : a.toStringShort() > b.toStringShort()
              ? 1
              : 0,
        )
        .map((element) => element.widget.toDiagnosticsNode({ style: 'sparse' }));
      properties.add(
        new DiagnosticsProperty('dependencies', this.dependencies, {
          description: '[' + nodes.join(', ') + ']',
        }),
      );
    }
  }
  visitChildren(visitor: (child: Element) => void): void {
    for (const child of this.children) visitor(child);
  }
  /** Source hook lets lazy parents retire their slot map during GlobalKey moves. */
  forgetChild(child: Element): void {
    if (!(child.parent === this))
      invariant(false, 'invalid-forgotten-child', 'Only this Element child can be forgotten');
    this.children = this.children.filter((value) => value !== child);
    this.markRenderTreeSyncDirty();
  }
  override debugDescribeChildren(): readonly DiagnosticsNode[] {
    const children: DiagnosticsNode[] = [];
    this.visitChildren((child) => children.push(child.toDiagnosticsNode()));
    return children;
  }
  get active(): boolean {
    return this.lifecycle === 'active';
  }
  get mounted(): boolean {
    return this.lifecycle === 'active' || this.lifecycle === 'inactive';
  }
  get stateObject(): State | undefined {
    return undefined;
  }
  get services(): ViewControllerContext {
    return this.owner.services;
  }
  get buildScope(): BuildScope {
    return this.parentBuildScope ?? this.owner.defaultBuildScope;
  }
  get renderObjects(): readonly RenderObject[] {
    return childRenderObjects(this.children);
  }
  hasAncestor(element: Element): boolean {
    let parent = this.parent;
    while (parent) {
      if (parent === element) return true;
      parent = parent.parent;
    }
    return false;
  }
  mount(parent: Element | undefined, owner: BuildOwner, slot?: unknown): void {
    if (!(this.lifecycle === 'initial'))
      invariant(false, 'double-mount', 'Element can only be mounted once');
    this.parent = parent;
    this.inheritBuildScope(parent, owner);
    this.parentRenderOwner =
      parent instanceof RenderObjectElement ? parent : parent?.parentRenderOwner;
    this._parentDataScope =
      parent instanceof RenderObjectElement
        ? null
        : parent instanceof ParentDataElement
          ? parent
          : (parent?._parentDataScope ?? null);
    this.currentSlot = slot;
    this.depth = (parent?.depth ?? -1) + 1;
    this.owner = owner;
    this.lifecycle = 'active';
    this.markRenderTreeSyncDirty();
    this.updateInheritedTypes();
    owner.register(this);
    this.attachNotificationTree();
    owner.schedule(this);
  }
  update(widget: Widget): void {
    assertOutsideRenderPaint();
    if (!(this.active && Widget.canUpdate(this.widget, widget)))
      invariant(false, 'invalid-widget-update', 'Widget type/key changed or Element is inactive');
    this.widget = widget;
    if (this instanceof InheritedElement && indexedInheritedType(widget) !== this.indexedType)
      this.refreshInheritedTypes();
    this.markNeedsBuild();
  }
  markNeedsBuild(): void {
    assertOutsideRenderPaint();
    if (!this.mounted) invariant(false, 'unmounted-element', 'Rebuild after unmount');
    this.dirty = true;
    if (this.active) this.owner.schedule(this);
  }
  dependOn<T extends InheritedWidget>(type: InheritedType<T>, aspect?: unknown): T {
    const inherited = this.maybeDependOn(type, aspect);
    if (inherited) return inherited;
    throw new Error(`Missing inherited data above ${this.widget.constructor.name}`);
  }
  maybeDependOn<T extends InheritedWidget>(
    type: InheritedType<T>,
    aspect?: unknown,
  ): T | undefined {
    const ancestor = this.getElementForInheritedWidgetOfExactType(type);
    return ancestor ? this.dependOnInheritedElement<T>(ancestor, aspect) : undefined;
  }
  dependOnInheritedElement<T extends InheritedWidget>(
    ancestor: InheritedElement,
    aspect?: unknown,
  ): T {
    if (
      !(
        this.active &&
        ancestor.active &&
        ancestor.owner === this.owner &&
        (this.parent?.inheritedIndex?.get(ancestor.widget.typeToken) === ancestor ||
          this.hasAncestor(ancestor))
      )
    )
      invariant(
        false,
        'invalid-inherited-element',
        'Dependency must refer to an active ancestor in this View',
      );
    ancestor.addDependent(this, aspect);
    (this.dependencies ??= new Set()).add(ancestor);
    return ancestor.widget as T;
  }
  getElementForInheritedWidgetOfExactType<T extends InheritedWidget>(
    type: InheritedType<T>,
  ): InheritedElement | undefined {
    if (!this.active)
      invariant(false, 'inactive-context', 'Ancestor lookup requires an active Element');
    const parent = this.parent;
    if (!parent?.dynamicInheritedTypes) return parent?.inheritedIndex?.get(type);
    let ancestor: Element | undefined = parent;
    while (ancestor) {
      if (ancestor instanceof InheritedElement && ancestor.widget.typeToken === type)
        return ancestor;
      ancestor = ancestor.parent;
    }
    return undefined;
  }
  visitAncestorElements(visitor: (element: Element) => boolean): void {
    if (!this.active)
      invariant(false, 'inactive-context', 'Ancestor lookup requires an active Element');
    let ancestor = this.parent;
    while (ancestor) {
      if (!visitor(ancestor)) break;
      ancestor = ancestor.parent;
    }
  }
  findAncestorWidgetOfExactType<T extends Widget>(
    type: abstract new (...args: never[]) => T,
  ): T | undefined {
    let result: T | undefined;
    this.visitAncestorElements((element) => {
      if (element.widget.typeToken !== type) return true;
      result = element.widget as T;
      return false;
    });
    return result;
  }
  findAncestorStateOfType<T extends State>(
    type: abstract new (...args: never[]) => T,
  ): T | undefined {
    let result: T | undefined;
    this.visitAncestorElements((element) => {
      if (!(element.stateObject instanceof type)) return true;
      result = element.stateObject;
      return false;
    });
    return result;
  }
  findRenderObject(): RenderObject | undefined {
    if (!this.active)
      invariant(false, 'inactive-context', 'Render lookup requires an active Element');
    return this.renderObjects[0];
  }
  updateSlot(slot: unknown): void {
    if (!this.active)
      invariant(false, 'inactive-element', 'Slot update requires an active Element');
    this.currentSlot = slot;
    this.markRenderTreeSyncDirty();
  }
  updateSlotForChild(child: Element, slot: unknown): void {
    if (!(this.active && child.parent === this))
      invariant(false, 'invalid-slot-child', 'Slot update requires a child of this Element');
    const visit = (element: Element) => {
      element.updateSlot(slot);
      if (!(element instanceof RenderObjectElement))
        for (const descendant of element.children) visit(descendant);
    };
    visit(child);
  }
  attachRenderObject(slot: unknown): void {
    if (!this.active)
      invariant(false, 'inactive-element', 'Render attachment requires an active Element');
    this.currentSlot = slot;
    for (const child of this.children) child.attachRenderObject(slot);
  }
  detachRenderObject(): void {
    const errors: unknown[] = [];
    for (const child of this.children)
      try {
        child.detachRenderObject();
      } catch (error) {
        errors.push(error);
      }
    this.currentSlot = undefined;
    if (errors.length)
      throw new AggregateError(errors, 'Detaching component render children failed');
  }
  protected slotForChild(_index: number, _previous: Element | undefined): unknown {
    return this.slot;
  }
  dependenciesChanged(): void {
    this.markNeedsBuild();
  }
  rebuild(): void {
    if (!this.active || this.rebuilding)
      invariant(false, 'reentrant-build', `Reentrant build: ${this.widget.constructor.name}`);
    this.rebuilding = true;
    this.markRenderTreeSyncDirty();
    const previous = this.owner.currentElement;
    this.owner.currentElement = this;
    try {
      this.performRebuild();
      this.owner.parentRebuilt(this);
    } finally {
      this.owner.currentElement = previous;
      this.rebuilding = false;
    }
  }
  protected performRebuild(): void {
    this.dirty = false;
    this.children = this.reconcile(this.children, this.build());
  }
  protected buildErrorWidget(exception: unknown): Widget {
    const details = new FlutterErrorDetails({
      exception,
      stack: exceptionStack(exception),
      library: 'widgets library',
      context: new ErrorDescription('building ' + this.widget.constructor.name),
      informationCollector: () => [new DiagnosticsProperty('Widget', this.widget.constructor.name)],
    });
    this.owner.reportError(details);
    const widget = ErrorWidget.builder(details);
    if (!(widget instanceof Widget))
      invariant(false, 'invalid-error-widget', 'ErrorWidget.builder must return a Widget');
    return widget;
  }
  protected abstract build(): readonly Widget[];
  protected reconcile(previous: readonly Element[], widgets: readonly Widget[]): Element[] {
    const next: Element[] = [];
    try {
      // Components and single-child render objects do not have sibling keys to
      // index. Keep their normal slot, GlobalKey and failure-cleanup protocol
      // without allocating the maps/sets needed by a multi-child update.
      if (previous.length <= 1 && widgets.length <= 1) {
        const old = previous[0],
          widget = widgets[0];
        if (!widget) {
          if (old?.parent === this) this.owner.deactivateChild(old);
          return next;
        }
        if (widget.key instanceof GlobalKey) this.owner.reserve(widget.key, this);
        const slot = this.slotForChild(0, undefined);
        let child = old && Widget.canUpdate(old.widget, widget) ? old : undefined;
        if (!child) {
          if (old?.parent === this) this.owner.deactivateChild(old);
          child = this.owner.retake(widget, this, slot);
        }
        if (child) {
          next.push(child);
          if (!sameSlot(child.slot, slot)) this.updateSlotForChild(child, slot);
          if (child.widget !== widget) child.update(widget);
        } else {
          child = widget.createElement();
          next.push(child);
          child.mount(this, this.owner, slot);
        }
        return next;
      }
      const keys = new KeyMap<boolean>();
      for (const widget of widgets)
        if (widget.key) {
          if (keys.has(widget.key))
            invariant(
              false,
              'duplicate-key',
              `Duplicate sibling key in ${this.widget.constructor.name}`,
            );
          keys.set(widget.key, true);
        }
      const keyed = new KeyMap<Element>();
      for (const child of previous) if (child.widget.key) keyed.set(child.widget.key, child);
      const remaining = new Set(previous);
      for (let index = 0; index < widgets.length; index++) {
        const widget = widgets[index]!;
        if (widget.key instanceof GlobalKey) this.owner.reserve(widget.key, this);
        const slot = this.slotForChild(index, next.at(-1));
        let child = widget.key ? keyed.get(widget.key) : previous[index];
        if (!child || !remaining.has(child) || !Widget.canUpdate(child.widget, widget))
          child = undefined;
        if (child) remaining.delete(child);
        else {
          if (widgets.length === 1) {
            for (const old of remaining) if (old.parent === this) this.owner.deactivateChild(old);
            remaining.clear();
          }
          child = this.owner.retake(widget, this, slot);
        }
        if (child) {
          next.push(child);
          if (!sameSlot(child.slot, slot)) this.updateSlotForChild(child, slot);
          if (child.widget !== widget) child.update(widget);
        } else {
          child = widget.createElement();
          next.push(child);
          child.mount(this, this.owner, slot);
        }
      }
      this.owner.deactivateChildren([...remaining].filter((child) => child.parent === this));
      return next;
    } catch (error) {
      const errors: unknown[] = [error];
      for (const created of next)
        if (!previous.includes(created) && created.parent === this)
          try {
            created.unmount();
          } catch (failure) {
            errors.push(failure);
          }
      if (errors.length > 1)
        throw new AggregateError(errors, 'Reconciliation and new child cleanup failed');
      throw error;
    }
  }
  /** Explicit boundary for custom callers; built-in build scopes commit once. */
  syncRenderTree(): void {
    this.owner.flushRenderTree();
  }
  private clearDependencies(): void {
    this.owner._forgetViewMetricsReader(this);
    const dependencies = this.dependencies;
    if (!dependencies) return;
    this.hadDependencies ||= dependencies.size > 0;
    for (const dependency of dependencies) dependency.removeDependent(this);
    dependencies.clear();
  }
  deactivate(): void {
    if (!this.active) return;
    this.lifecycle = 'inactive';
    this.parentScopeAncestor = undefined;
    this.owner.forget(this);
    this.clearDependencies();
    this.inheritedIndex = undefined;
    this.indexedType = undefined;
    this.dynamicInheritedTypes = false;
    this._notificationTree = null;
    let errors: unknown[] | undefined;
    for (const child of this.children)
      try {
        child.deactivate();
      } catch (error) {
        (errors ??= []).push(error);
      }
    if (errors) throw new AggregateError(errors, 'Subtree deactivation failed');
  }
  activate(parent: Element): void {
    if (!(this.lifecycle === 'inactive' && parent.owner === this.owner))
      invariant(
        false,
        'invalid-activation',
        'Only an inactive subtree in the same View can be activated',
      );
    this.parent = parent;
    this.inheritBuildScope(parent, this.owner);
    this.parentRenderOwner =
      parent instanceof RenderObjectElement ? parent : parent.parentRenderOwner;
    this._parentDataScope =
      parent instanceof RenderObjectElement
        ? null
        : parent instanceof ParentDataElement
          ? parent
          : (parent?._parentDataScope ?? null);
    this.markRenderTreeSyncDirty();
    this.depth = parent.depth + 1;
    this.lifecycle = 'active';
    this.owner.maybeViewWorkBudget?.activate(this);
    this.updateInheritedTypes();
    this.attachNotificationTree();
    if (this.hadDependencies) {
      this.hadDependencies = false;
      this.dependenciesChanged();
    } else this.markNeedsBuild();
    for (const child of this.children) child.activate(this);
  }
  unmount(): void {
    if (this.lifecycle === 'defunct' || this.lifecycle === 'initial') return;
    let errors: unknown[] | undefined;
    try {
      if (this.active) this.deactivate();
    } catch (error) {
      (errors ??= []).push(error);
    }
    this.lifecycle = 'defunct';
    this.owner.forget(this);
    for (const child of this.children)
      try {
        child.unmount();
      } catch (error) {
        (errors ??= []).push(error);
      }
    this.children = [];
    this.clearDependencies();
    this.owner.unregister(this);
    this.parent = undefined;
    this.parentRenderOwner = undefined;
    this._parentDataScope = null;
    this.parentBuildScope = undefined;
    this.parentScopeAncestor = undefined;
    this.currentSlot = undefined;
    this._notificationTree = null;
    if (errors) throw new AggregateError(errors, 'Element child teardown failed');
  }
}
initializeElementType(Element);
export type ElementConstructor = abstract new (...args: any[]) => Element;
type NotifiableElementConstructor<Base extends ElementConstructor> = abstract new (
  ...args: ConstructorParameters<Base>
) => InstanceType<Base> & NotifiableElementTarget;
/** Source notification nodes attach at mount/activation and share the current
 * parent's tree; the notification type is a type-only dependency here. */
export function NotifiableElementMixin<Base extends ElementConstructor>(
  Base: Base,
): NotifiableElementConstructor<Base> {
  abstract class NotifiableElement extends Base implements NotifiableElementTarget {
    constructor(...args: any[]) {
      super(...args);
    }
    abstract onNotification(notification: Notification): boolean;
    protected override attachNotificationTree(): void {
      this.attachNotificationTarget(this);
    }
  }
  return NotifiableElement as unknown as NotifiableElementConstructor<Base>;
}
class _ElementDiagnosticableTreeNode extends DiagnosticableTreeNode {
  constructor(
    value: Element,
    o: DiagnosticsOptions = {},
    readonly stateful = false,
  ) {
    super(value, o);
  }
  override toJsonMap(
    delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate(),
  ): JsonDiagnosticsNode {
    const json = super.toJsonMap(delegate),
      element = this.value as Element;
    if (!element.debugIsDefunct) json.widgetRuntimeType = element.widget.constructor.name;
    json.stateful = this.stateful;
    return json;
  }
}
export abstract class StatelessWidget extends Widget {
  abstract build(context: BuildContext): Widget;
  createElement(): Element {
    return new StatelessElement(this);
  }
}
export abstract class ComponentElement extends Element {
  protected override performRebuild(): void {
    let widgets: readonly Widget[];
    try {
      widgets = this.build();
      if (!(widgets.length === 1 && widgets[0] instanceof Widget))
        invariant(
          false,
          'invalid-widget-builder-result',
          'A component must synchronously build one Widget',
        );
    } catch (exception) {
      widgets = [this.buildErrorWidget(exception)];
    } finally {
      this.dirty = false;
    }
    try {
      this.children = this.reconcile(this.children, widgets);
    } catch (exception) {
      const replacement = this.buildErrorWidget(exception);
      try {
        this.owner.deactivateChildren(this.children);
      } catch {
        /* Source attempts to retire the broken old subtree before inserting the replacement. */
      }
      this.children = [];
      this.children = this.reconcile([], [replacement]);
    }
  }
}
class StatelessElement extends ComponentElement {
  protected build(): readonly Widget[] {
    return [(this.widget as StatelessWidget).build(this)];
  }
}
export abstract class StatefulWidget extends Widget {
  abstract createState(): State;
  createElement(): Element {
    return new StatefulElement(this);
  }
}
export abstract class State<W extends StatefulWidget = StatefulWidget> extends Diagnosticable(
  class {},
) {
  private diagnosticLifecycle: 'created' | 'initialized' | 'ready' | 'defunct' = 'created';
  /** @internal The owning element advances debug lifecycle after callbacks return. */
  _debugSetLifecycle(value: 'initialized' | 'ready'): void {
    this.diagnosticLifecycle = value;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    if (FoundationBuildMode.debug)
      properties.add(
        new EnumProperty('lifecycle state', this.diagnosticLifecycle, {
          defaultValue: 'ready',
          typeName: '_StateLifecycle',
        }),
      );
    properties.add(
      new ObjectFlagProperty('_widget', this.configuration ?? null, { ifNull: 'no widget' }),
    );
    properties.add(
      new ObjectFlagProperty('_element', this.element ?? null, { ifNull: 'not mounted' }),
    );
  }
  private element: StatefulElement | undefined;
  private configuration: W | undefined;
  get mounted(): boolean {
    return this.element !== undefined;
  }
  get widget(): W {
    if (!this.configuration) invariant(false, 'unmounted-state', 'Widget after State disposal');
    return this.configuration;
  }
  get context(): BuildContext {
    if (!this.element) invariant(false, 'unmounted-state', 'Context after State disposal');
    return this.element;
  }
  attach(element: StatefulElement, widget: W): void {
    if (this.element)
      invariant(false, 'state-reused', 'State instance cannot belong to two Elements');
    this.element = element;
    this.configuration = widget;
  }
  update(widget: W): void {
    const old = this.widget;
    this.configuration = widget;
    this.didUpdateWidget(old);
  }
  detach(): void {
    this.diagnosticLifecycle = 'defunct';
    this.element = undefined;
    this.configuration = undefined;
  }
  initState(): void {}
  didUpdateWidget(_old: W): void {}
  didChangeDependencies(): void {}
  deactivate(): void {}
  activate(): void {}
  dispose(): void {}
  setState(change: () => void): void {
    assertOutsideRenderPaint();
    const element = this.element;
    if (!element?.mounted) invariant(false, 'disposed-state', 'setState after dispose');
    const current = element.owner.currentElement;
    if (
      !(
        !element.owner.building ||
        current === element ||
        (!!current && element.hasAncestor(current))
      )
    )
      invariant(false, 'set-state-during-build', 'setState during an unrelated build');
    const result: unknown = change();
    if (!(!result || typeof (result as { then?: unknown }).then !== 'function'))
      invariant(false, 'async-set-state', 'setState callback must be synchronous');
    element.markNeedsBuild();
  }
  abstract build(context: BuildContext): Widget;
}
export class StatefulElement extends ComponentElement {
  private state: State | undefined;
  private dependenciesPending = false;
  override get stateObject(): State | undefined {
    return this.state;
  }
  override toDiagnosticsNode(o: DiagnosticsOptions = {}): DiagnosticsNode {
    return new _ElementDiagnosticableTreeNode(this, o, true);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('state', this.state ?? null, { defaultValue: null }));
  }
  override mount(parent: Element | undefined, owner: BuildOwner, slot?: unknown): void {
    super.mount(parent, owner, slot);
    const state = (this.state = (this.widget as StatefulWidget).createState());
    state.attach(this, this.widget as StatefulWidget);
    state.initState();
    state._debugSetLifecycle('initialized');
    this.dependenciesPending = true;
  }
  override update(widget: Widget): void {
    super.update(widget);
    this.state!.update(widget as StatefulWidget);
  }
  override dependenciesChanged(): void {
    this.dependenciesPending = true;
    super.dependenciesChanged();
  }
  protected build(): readonly Widget[] {
    if (this.dependenciesPending) {
      this.dependenciesPending = false;
      this.state!.didChangeDependencies();
      this.state!._debugSetLifecycle('ready');
    }
    return [this.state!.build(this)];
  }
  override deactivate(): void {
    if (!this.active) return;
    try {
      this.state?.deactivate();
    } finally {
      super.deactivate();
    }
  }
  override activate(parent: Element): void {
    super.activate(parent);
    this.state?.activate();
    this.markNeedsBuild();
  }
  override unmount(): void {
    if (!this.mounted) return;
    const state = this.state;
    try {
      super.unmount();
    } finally {
      this.state = undefined;
      try {
        state?.dispose();
      } finally {
        state?.detach();
      }
    }
  }
}
export abstract class ProxyWidget extends Widget {
  constructor(
    readonly child: Widget,
    options: WidgetOptions = {},
  ) {
    super(options.key ?? null);
  }
}
export abstract class ProxyElement extends ComponentElement {
  protected build(): readonly Widget[] {
    return [(this.widget as ProxyWidget).child];
  }
  override update(widget: Widget): void {
    const old = this.widget as ProxyWidget;
    super.update(widget);
    this.updated(old);
  }
  protected updated(old: ProxyWidget): void {
    this.notifyClients(old);
  }
  protected abstract notifyClients(old: ProxyWidget): void;
}
export type ParentDataType<T extends ParentData> = abstract new (...args: never[]) => T;
export abstract class ParentDataWidget<T extends ParentData> extends ProxyWidget {
  abstract readonly parentDataType: ParentDataType<T>;
  abstract get debugTypicalAncestorWidgetClass(): Function;
  get debugTypicalAncestorWidgetDescription(): string {
    return this.debugTypicalAncestorWidgetClass.name;
  }
  debugIsValidRenderObject(render: RenderObject): boolean {
    return render.parentData instanceof this.parentDataType;
  }
  debugCanApplyOutOfTurn(): boolean {
    return false;
  }
  abstract applyParentData(render: RenderObject): void;
  createElement(): ParentDataElement<T> {
    return new ParentDataElement(this);
  }
}
export class ParentDataElement<T extends ParentData = ParentData> extends ProxyElement {
  constructor(widget: ParentDataWidget<T>) {
    super(widget);
  }
  get debugParentDataType(): ParentDataType<T> {
    return (this.widget as ParentDataWidget<T>).parentDataType;
  }
  private visitRenderChildren(visitor: (child: RenderObjectElement) => void): void {
    const visit = (child: Element) => {
      if (child instanceof RenderObjectElement) visitor(child);
      else for (const descendant of child.children) visit(descendant);
    };
    for (const child of this.children) visit(child);
  }
  protected notifyClients(_old: ProxyWidget): void {
    this.visitRenderChildren((child) => child.applyParentDataFromAncestors());
  }
  applyWidgetOutOfTurn(widget: ParentDataWidget<T>): void {
    if (!(this.active && widget.debugCanApplyOutOfTurn()))
      invariant(
        false,
        'invalid-parent-data-update',
        'Out-of-turn parent data must be explicitly allowed on an active Element',
      );
    if (
      !(
        widget.child === (this.widget as ParentDataWidget<T>).child &&
        widget.parentDataType === this.debugParentDataType
      )
    )
      invariant(
        false,
        'invalid-parent-data-update',
        'Out-of-turn data requires the same child and parent data type',
      );
    this.visitRenderChildren((child) => child.applyParentDataWidget(widget));
  }
}
export abstract class InheritedWidget extends ProxyWidget {
  constructor(child: Widget, key: Key | null = null) {
    super(child, { key });
  }
  abstract updateShouldNotify(old: this): boolean;
  createElement(): Element {
    return new InheritedElement(this);
  }
}
export class InheritedElement extends ProxyElement {
  readonly dependents = new Map<Element, Set<unknown> | null>();
  addDependent(element: Element, aspect?: unknown): void {
    if (aspect === undefined) {
      this.dependents.set(element, null);
      return;
    }
    if (this.dependents.get(element) === null) return;
    const aspects = this.dependents.get(element) ?? new Set<unknown>();
    aspects.add(aspect);
    this.dependents.set(element, aspects);
  }
  removeDependent(element: Element): void {
    this.dependents.delete(element);
  }
  notifyDependent(_old: InheritedWidget, dependent: Element): void {
    dependent.dependenciesChanged();
  }
  notifyClients(old: InheritedWidget): void {
    const snapshot4 = [...this.dependents.keys()];
    for (const dependent of snapshot4) if (dependent.active) this.notifyDependent(old, dependent);
  }
  protected override updated(old: ProxyWidget): void {
    if ((this.widget as InheritedWidget).updateShouldNotify(old as InheritedWidget))
      this.notifyClients(old as InheritedWidget);
  }
  protected build(): readonly Widget[] {
    return [(this.widget as InheritedWidget).child];
  }
  override unmount(): void {
    try {
      super.unmount();
    } finally {
      this.dependents.clear();
    }
  }
}
export abstract class RenderObjectWidget extends Widget {
  abstract createRenderObject(context: BuildContext): RenderObject;
  /** Optional configuration and unmount hooks follow the upstream base widget. */
  updateRenderObject(_context: BuildContext, _renderObject: RenderObject): void {}
  didUnmountRenderObject(_renderObject: RenderObject): void {}
  abstract get childWidgets(): readonly Widget[];
  createElement(): Element {
    return new RenderObjectElement(this);
  }
}
const emptyParentDataWidgets: readonly ParentDataWidget<ParentData>[] = Object.freeze([]);
export class RenderObjectElement extends Element {
  private render: RenderObject | undefined;
  private renderProjection: readonly RenderObject[] = emptyRenderObjects;
  private ancestor: RenderObjectElement | undefined;
  private appliedData: ParentData | undefined;
  private appliedWidgets: readonly ParentDataWidget<ParentData>[] | undefined;
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new DiagnosticsProperty('renderObject', this.render ?? null, { defaultValue: null }),
    );
  }
  get renderObject(): RenderObject {
    if (!this.render)
      invariant(false, 'unmounted-render-element', 'RenderObjectElement has no live render object');
    return this.render;
  }
  override get renderObjects(): readonly RenderObject[] {
    return this.renderProjection;
  }
  protected override slotForChild(index: number, previous: Element | undefined): unknown {
    return new IndexedSlot(index, previous);
  }
  override mount(parent: Element | undefined, owner: BuildOwner, slot?: unknown): void {
    super.mount(parent, owner, slot);
    this.render = (this.widget as RenderObjectWidget).createRenderObject(this);
    this.renderProjection = Object.freeze([this.render]);
    this.attachRenderObject(slot);
  }
  protected build(): readonly Widget[] {
    (this.widget as RenderObjectWidget).updateRenderObject(this, this.render!);
    return (this.widget as RenderObjectWidget).childWidgets;
  }
  private previousRender(slot: unknown, child: RenderObject): RenderObject | undefined {
    const previous = slot instanceof IndexedSlot ? slot.value?.renderObjects.at(-1) : undefined;
    return previous && previous !== child && previous.parent === this.renderObject
      ? previous
      : undefined;
  }
  insertRenderObjectChild(child: RenderObject, slot: unknown): void {
    this.renderObject.insert(child, this.previousRender(slot, child));
  }
  moveRenderObjectChild(child: RenderObject, _oldSlot: unknown, newSlot: unknown): void {
    this.renderObject.move(child, this.previousRender(newSlot, child));
  }
  removeRenderObjectChild(child: RenderObject, _slot: unknown): void {
    this.renderObject.remove(child);
  }
  override updateSlot(slot: unknown): void {
    const old = this.slot;
    super.updateSlot(slot);
    if (!sameSlot(old, slot)) this.ancestor?.moveRenderObjectChild(this.renderObject, old, slot);
  }
  override attachRenderObject(slot: unknown): void {
    if (this.ancestor)
      invariant(
        false,
        'double-render-attachment',
        'Render object already has an ancestor attachment',
      );
    this.currentSlot = slot;
    this.ancestor = this.parentRenderOwner;
    try {
      this.ancestor?.insertRenderObjectChild(this.renderObject, slot);
      if (this.ancestor) this.owner._scheduleRenderChildren(this.ancestor);
      this.applyParentDataFromAncestors();
    } catch (error) {
      const errors = [error];
      try {
        this.detachRenderObject();
      } catch (failure) {
        errors.push(failure);
      }
      if (errors.length > 1)
        throw new AggregateError(errors, 'Render attachment and rollback failed');
      throw error;
    }
  }
  override detachRenderObject(): void {
    let errors: unknown[] | undefined;
    try {
      if (this.render) {
        try {
          if (this.ancestor) this.ancestor.removeRenderObjectChild(this.render, this.slot);
          else if (this.render.attached) this.render.detach();
        } catch (error) {
          (errors ??= []).push(error);
        }
        if (this.render.parent)
          try {
            RenderObject.prototype.remove.call(this.render.parent, this.render);
          } catch (error) {
            (errors ??= []).push(error);
          }
        if (this.render.attached)
          try {
            RenderObject.prototype.detach.call(this.render);
          } catch (error) {
            (errors ??= []).push(error);
          }
      }
    } finally {
      this.ancestor = undefined;
      this.currentSlot = undefined;
      this.appliedData = undefined;
      this.appliedWidgets = undefined;
    }
    if (errors) throw new AggregateError(errors, 'Detaching render element failed');
  }
  applyParentDataWidget(widget: ParentDataWidget<ParentData>): void {
    if (!widget.debugIsValidRenderObject(this.renderObject))
      invariant(
        false,
        'invalid-parent-data',
        `${widget.constructor.name} requires ${widget.parentDataType.name} from ${widget.debugTypicalAncestorWidgetDescription}; nearest render widget is ${this.ancestor?.widget.constructor.name ?? 'the root'} and data is ${this.renderObject.parentData?.constructor.name ?? 'absent'}`,
      );
    widget.applyParentData(this.renderObject);
  }
  applyParentDataFromAncestors(): void {
    let widgets: ParentDataWidget<ParentData>[] | undefined,
      types: Set<Function> | undefined,
      classes: Set<Function> | undefined;
    for (let parent = this._parentDataScope; parent; parent = parent._parentDataScope) {
      widgets ??= [];
      types ??= new Set<Function>();
      classes ??= new Set<Function>();
      const widget = parent.widget as ParentDataWidget<ParentData>;
      if (types.has(widget.parentDataType) || classes.has(widget.constructor))
        invariant(
          false,
          'conflicting-parent-data',
          `Competing ${widget.constructor.name} widgets provide the same parent data`,
        );
      types.add(widget.parentDataType);
      classes.add(widget.constructor);
      widgets.push(widget);
    }
    const captured = widgets ?? emptyParentDataWidgets;
    if (
      this.appliedData === this.renderObject.parentData &&
      captured.length === this.appliedWidgets?.length &&
      captured.every((widget, index) => widget === this.appliedWidgets![index])
    )
      return;
    for (const widget of captured)
      if (!widget.debugIsValidRenderObject(this.renderObject))
        invariant(
          false,
          'invalid-parent-data',
          `${widget.constructor.name} requires ${widget.parentDataType.name} from ${widget.debugTypicalAncestorWidgetDescription}; nearest render widget is ${this.ancestor?.widget.constructor.name ?? 'the root'}`,
        );
    for (const widget of captured) this.applyParentDataWidget(widget);
    this.appliedData = this.renderObject.parentData;
    this.appliedWidgets = captured;
  }
  /** Normalize after queued component builds, which can create a previous sibling later. */
  protected synchronizeRenderObjectChildren(): void {
    const expected = childRenderObjects(this.children),
      actual = this.renderObject.children;
    if (
      expected.length === actual.length &&
      expected.every((child, index) => child === actual[index])
    )
      return;
    this.renderObject.setChildren(expected);
  }
  /** @internal Invoked once per dirty owner, after queued sibling builds. */
  _commitRenderChildren(): void {
    this.synchronizeRenderObjectChildren();
  }
  override unmount(): void {
    if (!this.mounted) return;
    let errors: unknown[] | undefined;
    // Keep every retirement stage and its live receiver even after a failure,
    // without allocating five callbacks and empty error arrays for each leaf.
    try {
      this.detachRenderObject();
    } catch (error) {
      (errors ??= []).push(error);
    }
    try {
      super.unmount();
    } catch (error) {
      (errors ??= []).push(error);
    }
    try {
      if (this.render) (this.widget as RenderObjectWidget).didUnmountRenderObject(this.render);
    } catch (error) {
      (errors ??= []).push(error);
    }
    try {
      this.render?.setChildren([]);
    } catch (error) {
      (errors ??= []).push(error);
    }
    try {
      this.render?.dispose();
    } catch (error) {
      (errors ??= []).push(error);
    }
    this.render = undefined;
    this.renderProjection = emptyRenderObjects;
    if (errors) throw new AggregateError(errors, 'RenderObjectElement teardown failed');
  }
}
export abstract class LeafRenderObjectWidget extends RenderObjectWidget {
  get childWidgets(): readonly Widget[] {
    return [];
  }
  override createElement(): LeafRenderObjectElement {
    return new LeafRenderObjectElement(this);
  }
}
export abstract class SingleChildRenderObjectWidget extends RenderObjectWidget {
  constructor(
    readonly child: Widget | undefined,
    options: WidgetOptions = {},
  ) {
    super(options.key ?? null);
  }
  get childWidgets(): readonly Widget[] {
    return this.child ? [this.child] : [];
  }
  override createElement(): SingleChildRenderObjectElement {
    return new SingleChildRenderObjectElement(this);
  }
}
export abstract class MultiChildRenderObjectWidget extends RenderObjectWidget {
  readonly childWidgets: readonly Widget[];
  constructor(children: readonly Widget[], options: WidgetOptions = {}) {
    super(options.key ?? null);
    this.childWidgets = Object.freeze([...children]);
  }
  override createElement(): MultiChildRenderObjectElement {
    return new MultiChildRenderObjectElement(this);
  }
}
export class LeafRenderObjectElement extends RenderObjectElement {
  override debugDescribeChildren(): readonly DiagnosticsNode[] {
    return this.debugIsDefunct ? [] : this.widget.debugDescribeChildren();
  }
  override insertRenderObjectChild(_child: RenderObject, _slot: unknown): void {
    throw new Error('LeafRenderObjectElement cannot have render children');
  }
  override moveRenderObjectChild(_child: RenderObject, _oldSlot: unknown, _newSlot: unknown): void {
    throw new Error('LeafRenderObjectElement cannot move render children');
  }
  override removeRenderObjectChild(_child: RenderObject, _slot: unknown): void {
    throw new Error('LeafRenderObjectElement cannot remove render children');
  }
  protected override synchronizeRenderObjectChildren(): void {
    if (!(this.children.length === 0))
      invariant(
        false,
        'invalid-render-child',
        'LeafRenderObjectElement cannot have widget children',
      );
    super.synchronizeRenderObjectChildren();
  }
}
export type ErrorWidgetBuilder = (details: FlutterErrorDetails) => Widget;
/** Emergency replacement lives with the framework base classes, avoiding an ESM initialization cycle. */
export class ErrorWidget extends LeafRenderObjectWidget {
  readonly message: string;
  private readonly _flutterError: FlutterError | null;
  constructor(exception: unknown) {
    super(new UniqueKey());
    this.message = ErrorWidget._stringify(exception);
    this._flutterError = exception instanceof FlutterError ? exception : null;
  }
  static withDetails({
    message = '',
    error = null,
  }: { readonly message?: string; readonly error?: FlutterError | null } = {}): ErrorWidget {
    const widget = new ErrorWidget(error);
    Object.defineProperty(widget, 'message', {
      value: message,
      writable: false,
      enumerable: true,
      configurable: false,
    });
    return widget;
  }
  static builder: ErrorWidgetBuilder = (details) => ErrorWidget._defaultErrorWidgetBuilder(details);
  private static _defaultErrorWidgetBuilder(details: FlutterErrorDetails): Widget {
    return ErrorWidget.withDetails({
      message: FlutterError.debugMode
        ? ErrorWidget._stringify(details.exception) +
          '\nSee also: https://docs.flutter.dev/testing/errors'
        : '',
      error: details.exception instanceof FlutterError ? details.exception : null,
    });
  }
  private static _stringify(exception: unknown): string {
    try {
      return String(exception);
    } catch {
      return 'Error';
    }
  }
  override createRenderObject(context: BuildContext): RenderErrorBox {
    return new RenderErrorBox(this.message, {
      text: context.services.text,
      resources: context.services.resources,
      scale: context.services.readMetrics().scale,
      ...(context.services.defaultFont ? { font: context.services.defaultFont } : {}),
    });
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    if (this._flutterError)
      properties.add(this._flutterError.toDiagnosticsNode({ style: 'whitespace' }));
    else properties.add(new StringProperty('message', this.message, { quoted: false }));
  }
}
export class SingleChildRenderObjectElement extends RenderObjectElement {
  protected override slotForChild(): unknown {
    return undefined;
  }
  override insertRenderObjectChild(child: RenderObject, slot: unknown): void {
    if (!(slot === undefined && this.renderObject.children.length === 0))
      invariant(
        false,
        'invalid-render-slot',
        'Single-child element requires an empty child and no slot',
      );
    super.insertRenderObjectChild(child, slot);
  }
  override moveRenderObjectChild(_child: RenderObject, _oldSlot: unknown, _newSlot: unknown): void {
    throw new Error('SingleChildRenderObjectElement cannot move render children');
  }
  override removeRenderObjectChild(child: RenderObject, slot: unknown): void {
    if (!(slot === undefined))
      invariant(false, 'invalid-render-slot', 'Single-child element requires no removal slot');
    super.removeRenderObjectChild(child, slot);
  }
  protected override synchronizeRenderObjectChildren(): void {
    if (!(this.children.length <= 1))
      invariant(
        false,
        'invalid-render-child',
        'SingleChildRenderObjectElement requires at most one widget child',
      );
    super.synchronizeRenderObjectChildren();
  }
}
export class MultiChildRenderObjectElement extends RenderObjectElement {
  override insertRenderObjectChild(child: RenderObject, slot: unknown): void {
    if (!(slot instanceof IndexedSlot))
      invariant(false, 'invalid-render-slot', 'Multi-child element requires an IndexedSlot');
    super.insertRenderObjectChild(child, slot);
  }
  override moveRenderObjectChild(child: RenderObject, oldSlot: unknown, newSlot: unknown): void {
    if (!(oldSlot instanceof IndexedSlot && newSlot instanceof IndexedSlot))
      invariant(false, 'invalid-render-slot', 'Multi-child element requires IndexedSlot moves');
    super.moveRenderObjectChild(child, oldSlot, newSlot);
  }
}
