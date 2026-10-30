// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Finite functional port of radio_group.dart/raw_radio.dart on the owning Core tree.
import { StatefulWidget, State, InheritedWidget, InheritedElement, Element } from './framework.ts';
import type { Widget, BuildContext, WidgetOptions } from './framework.ts';
import { FocusNode } from './focus.ts';
import { ReadingOrderTraversalPolicy } from './focus-traversal-policy.ts';
import { FocusTraversalGroup } from './focus-traversal-group.ts';
import { Actions, VoidCallbackIntent, VoidCallbackAction } from './actions.ts';
import { Shortcuts, SingleActivator, ShortcutManager } from './shortcuts.ts';
import type { ShortcutMap } from './shortcuts.ts';
import type { KeyEvent } from '../../services/hardware-keyboard.ts';
import type { KeyEventResult } from './focus.ts';
import { LogicalKeyboardKey } from '../../services/keyboard-key.ts';
import { SemanticsRole } from '../../ui/semantics.ts';
import { Semantics } from './semantics.ts';
import { dartValueEquals } from '../../foundation/dart-value.ts';
import { invariant } from '../../foundation/errors.ts';
import { ToggleableControl } from './toggleable-control.ts';
import type { ToggleableMotion } from './toggleable-control.ts';
import type { ControlVisualState, ControlInteractionOptions } from './control-interaction.ts';
import { FoundationPlatform } from '../../foundation/platform.ts';
import { radioUnselectedHint } from './radio-localizations.ts';

export interface RadioClient<T> {
  readonly radioValue: T;
  readonly focusNode: FocusNode;
  readonly enabled: boolean;
  readonly tristate: boolean;
}
export abstract class RadioGroupRegistry<T> {
  abstract get groupValue(): T | null;
  abstract get onChanged(): (value: T | null) => void;
  abstract registerClient(client: RadioClient<T>): void;
  abstract unregisterClient(client: RadioClient<T>): void;
}
export interface RadioGroupOptions<T> extends WidgetOptions {
  readonly typeToken: object | symbol;
  readonly groupValue: T | null;
  readonly onChanged: (value: T | null) => void;
  readonly child: Widget;
}
class RadioGroupScope<T> extends InheritedWidget {
  constructor(
    readonly groupToken: object | symbol,
    readonly registry: RadioGroupRegistry<T>,
    readonly value: T | null,
    readonly revision: number,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: this): boolean {
    return (
      old.registry !== this.registry ||
      old.groupToken !== this.groupToken ||
      !dartValueEquals(old.value, this.value) ||
      old.revision !== this.revision
    );
  }
}
/** Explicit token reifies the erased generic group type, including nested groups of different types. */
export class RadioGroup<T> extends StatefulWidget {
  constructor(readonly options: RadioGroupOptions<T>) {
    super(options.key ?? null);
    invariant(
      typeof options.typeToken === 'symbol' ||
        (typeof options.typeToken === 'object' && options.typeToken !== null),
      'invalid-radio-token',
      'RadioGroup requires an explicit runtime type token',
    );
  }
  static maybeOf<T>(
    context: BuildContext,
    typeToken: object | symbol,
  ): RadioGroupRegistry<T> | null {
    let found: InheritedElement | undefined;
    context.visitAncestorElements((element) => {
      if (
        element instanceof InheritedElement &&
        element.widget instanceof RadioGroupScope &&
        element.widget.groupToken === typeToken
      ) {
        found = element;
        return false;
      }
      return true;
    });
    return found ? (context.dependOnInheritedElement(found) as RadioGroupScope<T>).registry : null;
  }
  createState(): State {
    return new RadioGroupState<T>();
  }
}
class RadioGroupState<T> extends State<RadioGroup<T>> implements RadioGroupRegistry<T> {
  private readonly clients = new Set<RadioClient<T>>();
  private revision = 0;
  private scheduled = false;
  private closed = false;
  private readonly shortcuts: ShortcutMap = new Map([
    [
      new SingleActivator(LogicalKeyboardKey.arrowLeft),
      new VoidCallbackIntent(() => this.move(false)),
    ],
    [
      new SingleActivator(LogicalKeyboardKey.arrowUp),
      new VoidCallbackIntent(() => this.move(false)),
    ],
    [
      new SingleActivator(LogicalKeyboardKey.arrowRight),
      new VoidCallbackIntent(() => this.move(true)),
    ],
    [
      new SingleActivator(LogicalKeyboardKey.arrowDown),
      new VoidCallbackIntent(() => this.move(true)),
    ],
  ]);
  private readonly manager = new RadioShortcutManager(
    () => [...this.clients].some((c) => c.focusNode.hasFocus),
    this.shortcuts,
  );
  get groupValue(): T | null {
    return this.widget.options.groupValue;
  }
  get onChanged(): (value: T | null) => void {
    return this.widget.options.onChanged;
  }
  registerClient(client: RadioClient<T>): void {
    this.clients.add(client);
    this.schedule();
  }
  unregisterClient(client: RadioClient<T>): void {
    if (this.clients.delete(client)) this.schedule();
  }
  private schedule(): void {
    if (this.scheduled || this.closed) return;
    this.scheduled = true;
    (this.context as Element).owner.postFrame(() => {
      this.scheduled = false;
      if (this.mounted && !this.closed && (this.context as Element).active) {
        const selected = [...this.clients].filter((c) =>
          dartValueEquals(c.radioValue, this.groupValue),
        );
        invariant(
          selected.length < 2,
          'multiple-radio-selection',
          'RadioGroup cannot have multiple clients with its selected value',
        );
        this.setState(() => {
          this.revision++;
        });
      }
    });
  }
  private move(forward: boolean): void {
    if (this.closed || !(this.context as Element).active || this.clients.size < 2) return;
    const clients = [...this.clients],
      current = clients.find((c) => c.focusNode.hasFocus);
    if (!current) return;
    const enabled = clients.filter((c) => c.enabled),
      sorted = [...ReadingOrderTraversalPolicy.sort(enabled.map((c) => c.focusNode))];
    invariant(
      sorted.length > 0,
      'empty-radio-navigation',
      'A focused RadioGroup must have an enabled navigation candidate',
    );
    const index = sorted.indexOf(current.focusNode),
      next =
        sorted[
          index < 0
            ? forward
              ? 0
              : sorted.length - 1
            : (index + (forward ? 1 : -1) + sorted.length) % sorted.length
        ]!,
      client = enabled.find((c) => c.focusNode === next)!;
    this.onChanged(client.radioValue);
    if (this.mounted && !this.closed && this.clients.has(client)) next.requestFocus();
  }
  build(): Widget {
    return new Semantics({
      container: true,
      role: SemanticsRole.radioGroup,
      child: new Actions({
        actions: new Map([[VoidCallbackIntent, new VoidCallbackAction()]]),
        child: Shortcuts.manager(
          this.manager,
          new FocusTraversalGroup(
            new RadioGroupScope(
              this.widget.options.typeToken,
              this,
              this.groupValue,
              this.revision,
              this.widget.options.child,
            ),
            {
              policy: new RadioTraversalPolicy(
                () => [...this.clients],
                () => this.groupValue,
              ),
            },
          ),
        ),
      }),
    });
  }
  override dispose(): void {
    this.closed = true;
    this.clients.clear();
    try {
      this.manager.dispose();
    } finally {
      super.dispose();
    }
  }
}
class RadioShortcutManager extends ShortcutManager {
  constructor(
    private readonly radioHasFocus: () => boolean,
    shortcuts: ShortcutMap,
  ) {
    super({ shortcuts });
  }
  override handleKeypress(context: BuildContext, event: KeyEvent): KeyEventResult {
    return this.radioHasFocus() ? super.handleKeypress(context, event) : 'ignored';
  }
}
class RadioTraversalPolicy<T> extends ReadingOrderTraversalPolicy {
  constructor(
    private readonly clients: () => readonly RadioClient<T>[],
    private readonly value: () => T | null,
  ) {
    super();
  }
  override sortDescendants(
    descendants: Iterable<FocusNode>,
    currentNode: FocusNode,
  ): Iterable<FocusNode> {
    const candidates = [...descendants],
      radios = this.clients(),
      ordered = [...super.sortDescendants(candidates, currentNode)];
    let selected = radios.find((c) => dartValueEquals(c.radioValue, this.value()));
    if (!selected)
      for (const node of ordered) {
        selected = radios.find((c) => c.focusNode === node);
        if (selected) break;
      }
    if (!selected) return ordered;
    const skip = new Set(
      radios.filter((c) => c !== selected && c.focusNode !== currentNode).map((c) => c.focusNode),
    );
    return super.sortDescendants(
      candidates.filter((node) => !skip.has(node)),
      currentNode,
    );
  }
}
export interface RawRadioOptions<T> extends Omit<
  ControlInteractionOptions,
  'onPressed' | 'selected' | 'builder'
> {
  readonly value: T;
  readonly groupRegistry?: RadioGroupRegistry<T>;
  readonly groupToken?: object | symbol;
  readonly toggleable?: boolean;
  readonly motion?: 'source';
  readonly builder: (
    context: BuildContext,
    state: ControlVisualState,
    selected: boolean,
    position: number,
    motion: ToggleableMotion,
  ) => Widget;
}
/** Controlled value: selection changes only when the registry owner rebuilds with a new groupValue. */
export class RawRadio<T> extends StatefulWidget {
  constructor(readonly options: RawRadioOptions<T>) {
    super(options.key ?? null);
  }
  createState(): State {
    return new RawRadioState<T>();
  }
}
class RawRadioState<T> extends State<RawRadio<T>> implements RadioClient<T> {
  private internalNode: FocusNode | undefined;
  private registry: RadioGroupRegistry<T> | null = null;
  private retired = false;
  get focusNode(): FocusNode {
    return (
      this.widget.options.focusNode ??
      (this.internalNode ??= new FocusNode({ debugLabel: 'RawRadio' }))
    );
  }
  get radioValue(): T {
    return this.widget.options.value;
  }
  get enabled(): boolean {
    return this.widget.options.enabled ?? true;
  }
  get tristate(): boolean {
    return this.widget.options.toggleable ?? false;
  }
  private resolve(): void {
    const options = this.widget.options,
      next =
        options.groupRegistry ??
        (options.groupToken === undefined
          ? null
          : RadioGroup.maybeOf<T>(this.context, options.groupToken));
    invariant(
      next || options.enabled === false,
      'missing-radio-registry',
      'Enabled Radio needs a typed RadioGroup ancestor or an explicit registry',
    );
    if (next !== this.registry) {
      this.registry?.unregisterClient(this);
      this.registry = next;
      next?.registerClient(this);
    }
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.resolve();
  }
  override didUpdateWidget(old: RawRadio<T>): void {
    super.didUpdateWidget(old);
    this.resolve();
    if (
      old.options.enabled !== this.widget.options.enabled ||
      !dartValueEquals(old.options.value, this.widget.options.value) ||
      old.options.focusNode !== this.widget.options.focusNode
    ) {
      this.registry?.unregisterClient(this);
      this.registry?.registerClient(this);
    }
  }
  private select(): void {
    if (this.retired || !this.mounted || !(this.context as Element).active || !this.enabled) return;
    const registry = this.registry!;
    if (!dartValueEquals(registry.groupValue, this.radioValue)) registry.onChanged(this.radioValue);
    else if (this.tristate) registry.onChanged(null);
  }
  override deactivate(): void {
    this.registry?.unregisterClient(this);
    super.deactivate();
  }
  override activate(): void {
    super.activate();
    this.registry?.registerClient(this);
  }
  override dispose(): void {
    this.retired = true;
    this.registry?.unregisterClient(this);
    this.registry = null;
    try {
      this.internalNode?.dispose();
    } finally {
      super.dispose();
    }
  }
  build(): Widget {
    const options = this.widget.options,
      selected = dartValueEquals(this.registry?.groupValue ?? null, this.radioValue),
      apple = ['iOS', 'macOS'].includes(FoundationPlatform.defaultTargetPlatform),
      {
        key: _,
        builder,
        value: __,
        groupRegistry: ___,
        groupToken: ____,
        toggleable: _____,
        motion,
        ...interaction
      } = options;
    return new ToggleableControl({
      ...interaction,
      value: selected,
      onChanged: this.enabled ? () => this.select() : null,
      ...(motion ? { motion } : {}),
      focusNode: this.focusNode,
      semantics: {
        ...options.semantics,
        checked: selected,
        inMutuallyExclusiveGroup: true,
        selected: apple ? selected : null,
        hint: apple && !selected ? radioUnselectedHint(this.context) : null,
      },
      builder: (context, state, position, motion) =>
        builder(context, state, selected, position, motion),
    });
  }
}
