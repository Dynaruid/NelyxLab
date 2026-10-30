// SPDX-License-Identifier: BSD-3-Clause
import { AutomaticKeepAliveClientMixin } from './automatic-keep-alive.ts';
import { SelectionContainer } from './selection-container.ts';
import type { StatefulWidget, BuildContext } from './framework.ts';
import type { Selectable, SelectionRegistrar } from '../rendering/selection.ts';
import type { DartMap, DartSet } from '../../foundation/dart-collections.ts';
import { invariant } from '../../foundation/errors.ts';

interface UnconfirmedParent {
  readonly registrar: SelectionRegistrar;
  readonly selectable: Selectable;
  readonly error: unknown;
}
/** Local cleanup and external ownership are separate acknowledgements. A
 * throwing parent remove is never replayed or silently counted as success. */
export class SelectionCleanupError extends AggregateError {
  readonly unconfirmedParents: readonly UnconfirmedParent[];
  constructor(
    errors: readonly unknown[],
    unconfirmed: readonly UnconfirmedParent[],
    readonly localCleanupComplete: boolean,
    readonly retryLocalCleanup: (() => void) | null = null,
  ) {
    super(errors, 'Selection boundary failed; local cleanup attempted');
    this.name = 'SelectionCleanupError';
    this.unconfirmedParents = Object.freeze(
      unconfirmed.map((value) => Object.freeze({ ...value })),
    );
  }
}
type Operation = 'add' | 'remove' | 'dependencies' | 'dispose';
interface Frame {
  kind: Operation;
  unconfirmed: UnconfirmedParent[];
}
interface ListenerOwner {
  capture(selectable: Selectable, callback: () => void): void;
  forget(selectable: Selectable, callback: () => void): void;
  revoke(callback: () => void): void;
  checkRetired(): void;
}
let listenerOwner: ListenerOwner | null = null;
const retiredSelection = Symbol('retired source selection');
export function selectionAddListener(selectable: Selectable, callback: () => void): void {
  const owner = listenerOwner;
  owner?.capture(selectable, callback);
  selectable.addListener(callback);
  owner?.checkRetired();
}
export function selectionRemoveListener(selectable: Selectable, callback: () => void): void {
  const owner = listenerOwner;
  owner?.revoke(callback);
  selectable.removeListener(callback);
  owner?.forget(selectable, callback);
  owner?.checkRetired();
}
class ParentBinding implements SelectionRegistrar {
  readonly members = new Set<Selectable>();
  constructor(
    readonly registrar: SelectionRegistrar,
    private readonly enter: (binding: ParentBinding) => void,
    private readonly exit: (binding: ParentBinding) => void,
    private readonly uncertain: (value: UnconfirmedParent) => void,
    private readonly check: () => void,
  ) {}
  add(selectable: Selectable): void {
    this.members.add(selectable);
    this.enter(this);
    this.registrar.add(selectable);
    this.check();
  }
  remove(selectable: Selectable): void {
    // Forget the attempted release before invoking user code, including a
    // reentrant Root close. Its exception is an explicit unknown outcome.
    this.members.delete(selectable);
    if (this.members.size === 0) this.exit(this);
    try {
      this.registrar.remove(selectable);
    } catch (error) {
      this.uncertain({ registrar: this.registrar, selectable, error });
      throw error;
    }
    this.check();
  }
}
export abstract class TwoDimensionalSelectionHost<W extends StatefulWidget = StatefulWidget>
  extends AutomaticKeepAliveClientMixin<W>
  implements SelectionRegistrar, ListenerOwner
{
  abstract sourceAttachments: DartMap<Selectable, () => void> | null;
  abstract sourceSelections: DartSet<Selectable> | null;
  abstract sourceRegistrar: SelectionRegistrar | null;
  abstract override get wantKeepAlive(): boolean;
  abstract set wantKeepAlive(value: boolean);
  abstract sourceAdd(selectable: Selectable): void;
  abstract sourceRemove(selectable: Selectable): void;
  abstract sourceDidChangeDependencies(): void;
  abstract sourceDispose(): void;
  abstract sourceListensTo(selectable: Selectable): () => void;
  private readonly listeners = new Map<Selectable, Set<() => void>>();
  private readonly parents = new Set<ParentBinding>();
  private readonly bindings = new WeakMap<SelectionRegistrar, ParentBinding>();
  private readonly recovered = new WeakSet<Selectable>();
  private readonly cleaning = new Set<Selectable>();
  private readonly revoked = new WeakSet<() => void>();
  private readonly frames: Frame[] = [];
  private closed = false;
  private baseDisposed = false;
  capture(selectable: Selectable, callback: () => void): void {
    let callbacks = this.listeners.get(selectable);
    if (!callbacks) this.listeners.set(selectable, (callbacks = new Set()));
    callbacks.add(callback);
  }
  forget(selectable: Selectable, callback: () => void): void {
    const callbacks = this.listeners.get(selectable);
    callbacks?.delete(callback);
    if (callbacks?.size === 0) this.listeners.delete(selectable);
  }
  revoke(callback: () => void): void {
    this.revoked.add(callback);
  }
  guardedSourceListener(selectable: Selectable): () => void {
    const source = this.sourceListensTo(selectable),
      callback = () => {
        if (
          !this.closed &&
          !this.revoked.has(callback) &&
          this.listeners.get(selectable)?.has(callback)
        )
          source();
      };
    return callback;
  }
  checkRetired(): void {
    if (this.closed && this.frames.at(-1)?.kind !== 'dispose') throw retiredSelection;
  }
  parentFor(context: BuildContext): SelectionRegistrar | null {
    const parent = SelectionContainer.maybeOf(context);
    if (parent === null) return null;
    let binding = this.bindings.get(parent);
    if (!binding) {
      binding = new ParentBinding(
        parent,
        (b) => this.parents.add(b),
        (b) => this.parents.delete(b),
        (value) => this.frames.at(-1)?.unconfirmed.push(value),
        () => this.checkRetired(),
      );
      this.bindings.set(parent, binding);
    }
    return binding;
  }
  sourceBaseDidChangeDependencies(): void {
    super.didChangeDependencies();
  }
  sourceBaseDispose(): void {
    if (this.baseDisposed) return;
    this.baseDisposed = true;
    super.dispose();
  }
  private targets(): Selectable[] {
    return [
      ...new Set([
        ...this.listeners.keys(),
        ...(this.sourceAttachments?.keys ?? []),
        ...(this.sourceSelections ?? []),
        ...[...this.parents].flatMap((parent) => [...parent.members]),
      ]),
    ];
  }
  private clean(selectables: readonly Selectable[], errors: unknown[]): void {
    for (const selectable of selectables) {
      if (this.cleaning.has(selectable)) continue;
      this.cleaning.add(selectable);
      this.recovered.add(selectable);
      try {
        const callbacks = new Set(this.listeners.get(selectable)),
          source = this.sourceAttachments?.remove(selectable);
        if (source) callbacks.add(source);
        this.sourceSelections?.remove(selectable);
        for (const callback of callbacks) {
          this.revoke(callback);
          this.forget(selectable, callback);
          try {
            selectable.removeListener(callback);
          } catch (error) {
            this.capture(selectable, callback);
            errors.push(error);
          }
        }
        const snapshot = [...this.parents];
        for (const parent of snapshot)
          if (parent.members.has(selectable))
            try {
              parent.remove(selectable);
            } catch (error) {
              if (error !== retiredSelection) errors.push(error);
            }
      } finally {
        this.cleaning.delete(selectable);
      }
    }
    try {
      this.wantKeepAlive = this.sourceSelections?.isNotEmpty ?? false;
    } catch (error) {
      errors.push(error);
    }
  }
  private failure(
    errors: unknown[],
    unconfirmed: UnconfirmedParent[],
    targets: readonly Selectable[],
  ): SelectionCleanupError {
    const pending = new Map<Selectable, Set<() => void>>();
    for (const target of targets) {
      const callbacks = this.listeners.get(target);
      if (callbacks?.size) pending.set(target, new Set(callbacks));
    }
    const retry = pending.size
      ? () => {
          const failures: unknown[] = [];
          for (const [target, callbacks] of pending)
            if ([...callbacks].some((callback) => this.listeners.get(target)?.has(callback)))
              try {
                this.run('remove', () => {}, target, true);
              } catch (error) {
                failures.push(error);
              }
          if (failures.length) throw this.failure(failures, [], [...pending.keys()]);
        }
      : null;
    return new SelectionCleanupError(errors, unconfirmed, pending.size === 0, retry);
  }
  private run(
    kind: Operation,
    action: () => void,
    selectable?: Selectable,
    forceCleanup = false,
  ): void {
    const previous = listenerOwner,
      frame: Frame = { kind, unconfirmed: [] };
    this.frames.push(frame);
    listenerOwner = this;
    const errors: unknown[] = [];
    let failed = false,
      targets: Selectable[] = [];
    try {
      try {
        action();
      } catch (error) {
        failed = true;
        if (error !== retiredSelection) errors.push(error);
      }
      if (failed || kind === 'dispose' || this.closed || forceCleanup) {
        targets = selectable ? [selectable] : this.targets();
        this.clean(targets, errors);
      }
      if (kind === 'dependencies' && failed && !this.closed) {
        try {
          this.sourceRegistrar = this.parentFor(this.context);
        } catch (error) {
          this.sourceRegistrar = null;
          errors.push(error);
        }
      }
      if (kind === 'dispose') {
        this.sourceAttachments = null;
        this.sourceSelections = null;
        this.sourceRegistrar = null;
        try {
          this.sourceBaseDispose();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length || frame.unconfirmed.length)
        throw this.failure(errors, frame.unconfirmed, targets);
    } finally {
      listenerOwner = previous;
      this.frames.pop();
    }
  }
  add(selectable: Selectable): void {
    invariant(!this.closed, 'retired-selection-registrar', 'Selection registrar is retired');
    invariant(
      !this.sourceAttachments?.containsKey(selectable) && !this.listeners.has(selectable),
      'duplicate-selection-registration',
      'A selectable can have only one local attachment',
    );
    this.recovered.delete(selectable);
    this.run('add', () => this.sourceAdd(selectable), selectable);
  }
  remove(selectable: Selectable): void {
    if (this.cleaning.has(selectable)) return;
    if (this.closed || this.recovered.delete(selectable) || this.sourceRegistrar === null) {
      this.run('remove', () => {}, selectable, true);
      return;
    }
    this.run('remove', () => this.sourceRemove(selectable), selectable);
  }
  override didChangeDependencies(): void {
    invariant(!this.closed, 'retired-selection-registrar', 'Selection registrar is retired');
    this.run('dependencies', () => this.sourceDidChangeDependencies());
  }
  override dispose(): void {
    const first = !this.closed;
    this.closed = true;
    this.run('dispose', () => {
      if (first) this.sourceDispose();
    });
  }
}
export function selectionParentFor(
  owner: TwoDimensionalSelectionHost,
  context: BuildContext,
): SelectionRegistrar | null {
  return owner.parentFor(context);
}
