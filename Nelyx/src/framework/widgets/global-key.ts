// SPDX-License-Identifier: BSD-3-Clause
import { Key } from '../../foundation/key.ts';
import { invariant } from '../../foundation/errors.ts';
import type { BuildContext, Element, State, Widget } from './framework.ts';

/** Identity key. A mounted key belongs to exactly one View's BuildOwner. */
export class GlobalKey<S extends State = State> extends Key {
  private static nextId = 0;
  private readonly diagnosticId = (++GlobalKey.nextId).toString(16).padStart(5, '0');
  private element: Element | undefined;
  constructor(
    readonly debugLabel?: string,
    readonly stateType?: abstract new (...args: never[]) => S,
  ) {
    super();
  }
  equals(other: Key): boolean {
    return this === other;
  }
  override get hashCode(): unknown {
    return this;
  }
  get currentContext(): BuildContext | undefined {
    return this.currentElement;
  }
  get currentWidget(): Widget | undefined {
    return this.currentElement?.widget;
  }
  get currentState(): S | undefined {
    const state = this.currentElement?.stateObject;
    return state && (!this.stateType || state instanceof this.stateType) ? (state as S) : undefined;
  }
  /** Framework registry access; callers must not bind keys themselves. */
  get currentElement(): Element | undefined {
    return this.element;
  }
  bind(element: Element | undefined): void {
    invariant(
      !element || !this.element || this.element === element,
      'duplicate-global-key',
      'GlobalKey is already mounted',
    );
    this.element = element;
  }
  toString(): string {
    return `[${this.constructor.name}#${this.diagnosticId}${this.debugLabel ? ` ${this.debugLabel}` : ''}]`;
  }
}
export class LabeledGlobalKey<S extends State = State> extends GlobalKey<S> {}
const frameworkAnchors = new WeakSet<GlobalKey>();
/** @internal Framework-owned geometry/semantics anchors, never app State keys. */
export function createFrameworkAnchorKey(debugLabel?: string): GlobalKey {
  const key = new GlobalKey(debugLabel);
  frameworkAnchors.add(key);
  return key;
}
/** @internal Only keys created by the framework anchor factory qualify. */
export function isFrameworkAnchorKey(key: GlobalKey): boolean {
  return frameworkAnchors.has(key);
}
export type ObjectIdentity = object | string | number | boolean | symbol | bigint;
type Bindings = Map<object, Map<object | undefined, Element>>;
const objects = new WeakMap<object, Bindings>(),
  primitives = new Map<unknown, Bindings>(),
  negativeZero = Symbol('negative zero identity');
function objectLike(value: ObjectIdentity): value is object {
  return typeof value === 'object' || typeof value === 'function';
}
function primitiveIdentity(value: ObjectIdentity): unknown {
  return Object.is(value, -0) ? negativeZero : value;
}
function readBindings(value: ObjectIdentity): Bindings | undefined {
  return objectLike(value) ? objects.get(value) : primitives.get(primitiveIdentity(value));
}
function storeBindings(value: ObjectIdentity, bindings: Bindings | undefined): void {
  if (objectLike(value)) {
    if (bindings) objects.set(value, bindings);
    else objects.delete(value);
  } else {
    const key = primitiveIdentity(value);
    if (bindings) primitives.set(key, bindings);
    else primitives.delete(key);
  }
}
export class GlobalObjectKey<S extends State = State> extends GlobalKey<S> {
  constructor(
    readonly value: ObjectIdentity,
    stateType?: abstract new (...args: never[]) => S,
  ) {
    super(undefined, stateType);
    invariant(
      value != null,
      'invalid-global-object-key',
      'GlobalObjectKey requires a non-null identity',
    );
  }
  override equals(other: Key): boolean {
    return (
      other instanceof GlobalObjectKey &&
      this.constructor === other.constructor &&
      this.stateType === other.stateType &&
      Object.is(this.value, other.value)
    );
  }
  override get hashCode(): unknown {
    return this.value;
  }
  override get currentElement(): Element | undefined {
    return readBindings(this.value)?.get(this.constructor)?.get(this.stateType);
  }
  override bind(element: Element | undefined): void {
    const bindings =
        readBindings(this.value) ?? new Map<object, Map<object | undefined, Element>>(),
      entries = bindings.get(this.constructor) ?? new Map<object | undefined, Element>(),
      current = entries.get(this.stateType);
    invariant(
      !element || !current || current === element,
      'duplicate-global-key',
      'GlobalObjectKey is already mounted',
    );
    if (element) {
      entries.set(this.stateType, element);
      bindings.set(this.constructor, entries);
      storeBindings(this.value, bindings);
    } else {
      entries.delete(this.stateType);
      if (!entries.size) bindings.delete(this.constructor);
      if (!bindings.size) storeBindings(this.value, undefined);
    }
  }
}
