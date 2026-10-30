// SPDX-License-Identifier: BSD-3-Clause
import { StatefulWidget, State, Element, InheritedWidget } from './framework.ts';
import type { Widget } from './framework.ts';
import type { Shortcuts as LegacyShortcuts } from './focus.ts';
import type { KeyEvent as TransportKeyEvent } from '../../ui/input.ts';
import { invariant } from '../../foundation/errors.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { ChangeNotifier } from '../../foundation/notifier.ts';
import { LogicalKeyboardKey, KeyboardKeySet } from '../../services/keyboard-key.ts';
import {
  KeyEvent,
  KeyDownEvent,
  KeyRepeatEvent,
  KeyboardLockMode,
} from '../../services/hardware-keyboard.ts';
import type { HardwareKeyboard } from '../../services/hardware-keyboard.ts';
import { Actions } from './actions.ts';
import type { Intent } from './actions.ts';
import { Focus } from './focus-scope.ts';
import type { KeyEventResult } from './focus.ts';
import type { BuildContext } from './framework.ts';
import type { Key } from '../../foundation/key.ts';
/** View-local shortcut registration; unmount removes the handler before State disposal. */
export class ShortcutsScope extends StatefulWidget {
  constructor(
    readonly shortcuts: LegacyShortcuts,
    readonly child: Widget,
  ) {
    super();
  }
  createState(): State {
    return new ShortcutsState();
  }
}
class ShortcutsState extends State<ShortcutsScope> {
  private readonly handle = (event: TransportKeyEvent) => {
    if (event.kind !== 'down' || event.repeat) return false;
    const key = [
      event.control ? 'Control' : null,
      event.alt ? 'Alt' : null,
      event.shift ? 'Shift' : null,
      event.meta ? 'Meta' : null,
      event.key,
    ]
      .filter((value) => value !== null)
      .join('+');
    return this.widget.shortcuts.handle(key);
  };
  override initState(): void {
    invariant(
      this.context instanceof Element,
      'invalid-context',
      'ShortcutsScope requires Element',
    );
    this.context.owner.keyHandlers.add(this.handle);
  }
  override dispose(): void {
    if (this.context instanceof Element) this.context.owner.keyHandlers.delete(this.handle);
  }
  build(): Widget {
    return this.widget.child;
  }
}

// Copyright 2014 The Flutter Authors. All rights reserved.
// Shortcut matching and focus-path dispatch adapted from widgets/shortcuts.dart.
export type LockState = 'ignored' | 'locked' | 'unlocked';
export interface ShortcutActivator {
  readonly triggers: Iterable<LogicalKeyboardKey> | null;
  accepts(event: KeyEvent, state: HardwareKeyboard): boolean;
  /** Only activators with upstream value equality (such as LogicalKeySet) define this. */
  equals?(other: unknown): boolean;
}
export class LogicalKeySet implements ShortcutActivator {
  readonly keys: ReadonlySet<LogicalKeyboardKey>;
  constructor(...keys: readonly LogicalKeyboardKey[]) {
    invariant(
      keys.length > 0 && keys.length <= 4,
      'invalid-key-set',
      'LogicalKeySet needs one to four keys',
    );
    this.keys = new KeyboardKeySet(keys);
    invariant(
      this.keys.size === keys.length,
      'duplicate-key-set',
      'LogicalKeySet keys must be unique',
    );
  }
  static fromSet(keys: Iterable<LogicalKeyboardKey>): LogicalKeySet {
    const snapshot = new KeyboardKeySet(keys);
    invariant(snapshot.size > 0, 'invalid-key-set', 'LogicalKeySet cannot be empty');
    const value = Object.create(LogicalKeySet.prototype) as LogicalKeySet;
    Object.defineProperty(value, 'keys', { value: snapshot, enumerable: true });
    return value;
  }
  get triggers(): Iterable<LogicalKeyboardKey> {
    return LogicalKeyboardKey.expandSynonyms(this.keys);
  }
  accepts(event: KeyEvent, state: HardwareKeyboard): boolean {
    if (
      !(event instanceof KeyDownEvent || event instanceof KeyRepeatEvent) ||
      !new KeyboardKeySet(this.triggers).has(event.logicalKey)
    )
      return false;
    const required = LogicalKeyboardKey.collapseSynonyms(this.keys),
      pressed = LogicalKeyboardKey.collapseSynonyms(state.logicalKeysPressed);
    return required.size === pressed.size && [...required].every((key) => pressed.has(key));
  }
  equals(other: unknown): boolean {
    return (
      other instanceof LogicalKeySet &&
      other.constructor === this.constructor &&
      this.keys.size === other.keys.size &&
      [...this.keys].every((key) => other.keys.has(key))
    );
  }
}
export interface SingleActivatorOptions {
  readonly control?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
  readonly meta?: boolean;
  readonly numLock?: LockState;
  readonly includeRepeats?: boolean;
}
export class SingleActivator implements ShortcutActivator {
  readonly control: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly meta: boolean;
  readonly numLock: LockState;
  readonly includeRepeats: boolean;
  constructor(
    readonly trigger: LogicalKeyboardKey,
    options: SingleActivatorOptions = {},
  ) {
    if (FoundationBuildMode.debug)
      invariant(
        ![
          LogicalKeyboardKey.control,
          LogicalKeyboardKey.controlLeft,
          LogicalKeyboardKey.controlRight,
          LogicalKeyboardKey.shift,
          LogicalKeyboardKey.shiftLeft,
          LogicalKeyboardKey.shiftRight,
          LogicalKeyboardKey.alt,
          LogicalKeyboardKey.altLeft,
          LogicalKeyboardKey.altRight,
          LogicalKeyboardKey.meta,
          LogicalKeyboardKey.metaLeft,
          LogicalKeyboardKey.metaRight,
        ].some((key) => key === trigger),
        'modifier-trigger',
        'SingleActivator trigger cannot be a modifier',
      );
    this.control = options.control ?? false;
    this.shift = options.shift ?? false;
    this.alt = options.alt ?? false;
    this.meta = options.meta ?? false;
    this.numLock = options.numLock ?? 'ignored';
    this.includeRepeats = options.includeRepeats ?? true;
    Object.freeze(this);
  }
  get triggers(): Iterable<LogicalKeyboardKey> {
    return [this.trigger];
  }
  accepts(event: KeyEvent, state: HardwareKeyboard): boolean {
    return (
      (event instanceof KeyDownEvent || (this.includeRepeats && event instanceof KeyRepeatEvent)) &&
      event.logicalKey.equals(this.trigger) &&
      this.control === state.isControlPressed &&
      this.shift === state.isShiftPressed &&
      this.alt === state.isAltPressed &&
      this.meta === state.isMetaPressed &&
      (this.numLock === 'ignored' ||
        state.lockModesEnabled.has(KeyboardLockMode.numLock) === (this.numLock === 'locked'))
    );
  }
}
export interface CharacterActivatorOptions {
  readonly control?: boolean;
  readonly alt?: boolean;
  readonly meta?: boolean;
  readonly includeRepeats?: boolean;
}
export class CharacterActivator implements ShortcutActivator {
  readonly control: boolean;
  readonly alt: boolean;
  readonly meta: boolean;
  readonly includeRepeats: boolean;
  readonly triggers = null;
  constructor(
    readonly character: string,
    options: CharacterActivatorOptions = {},
  ) {
    this.control = options.control ?? false;
    this.alt = options.alt ?? false;
    this.meta = options.meta ?? false;
    this.includeRepeats = options.includeRepeats ?? true;
    Object.freeze(this);
  }
  accepts(event: KeyEvent, state: HardwareKeyboard): boolean {
    return (
      event.character === this.character &&
      (event instanceof KeyDownEvent || (this.includeRepeats && event instanceof KeyRepeatEvent)) &&
      this.control === state.isControlPressed &&
      this.alt === state.isAltPressed &&
      this.meta === state.isMetaPressed
    );
  }
}
export type ShortcutMap = ReadonlyMap<ShortcutActivator, Intent>;
function sameActivator(a: ShortcutActivator, b: ShortcutActivator): boolean {
  return a === b || a.equals?.(b) === true;
}
function valueEntries(value: ShortcutMap): readonly (readonly [ShortcutActivator, Intent])[] {
  const entries: [ShortcutActivator, Intent][] = [];
  for (const [activator, intent] of value) {
    const index = entries.findIndex(([key]) => sameActivator(key, activator));
    if (index < 0) entries.push([activator, intent]);
    else entries[index]![1] = intent;
  }
  return entries;
}
class ShortcutMapSnapshot implements ShortcutMap {
  private readonly items: readonly (readonly [ShortcutActivator, Intent])[];
  constructor(value: ShortcutMap) {
    this.items = valueEntries(value);
  }
  get size(): number {
    return this.items.length;
  }
  has(key: ShortcutActivator): boolean {
    return this.items.some(([activator]) => sameActivator(activator, key));
  }
  get(key: ShortcutActivator): Intent | undefined {
    return this.items.find(([activator]) => sameActivator(activator, key))?.[1];
  }
  entries(): MapIterator<[ShortcutActivator, Intent]> {
    return new Map(this.items).entries();
  }
  keys(): MapIterator<ShortcutActivator> {
    return new Map(this.items).keys();
  }
  values(): MapIterator<Intent> {
    return new Map(this.items).values();
  }
  [Symbol.iterator](): MapIterator<[ShortcutActivator, Intent]> {
    return this.entries();
  }
  forEach(
    callback: (value: Intent, key: ShortcutActivator, map: ShortcutMap) => void,
    thisArg?: unknown,
  ): void {
    for (const [key, value] of this.items) callback.call(thisArg, value, key, this);
  }
}
export class ShortcutManager extends ChangeNotifier {
  readonly modal: boolean;
  private entries: readonly (readonly [ShortcutActivator, Intent])[];
  private shortcutMap: ShortcutMap;
  constructor(options: { readonly shortcuts?: ShortcutMap; readonly modal?: boolean } = {}) {
    super();
    this.modal = options.modal ?? false;
    this.shortcutMap = options.shortcuts ?? new Map();
    this.entries = valueEntries(this.shortcutMap);
  }
  get shortcuts(): ShortcutMap {
    return this.shortcutMap;
  }
  set shortcuts(value: ShortcutMap) {
    this.ensureAlive();
    const next = valueEntries(value);
    if (
      next.length === this.entries.length &&
      next.every(([key, intent]) =>
        this.entries.some(
          ([previous, previousIntent]) => sameActivator(key, previous) && intent === previousIntent,
        ),
      )
    )
      return;
    this.shortcutMap = value;
    this.entries = next;
    this.notifyListeners();
  }
  handleKeypress(context: BuildContext, event: KeyEvent): KeyEventResult {
    this.ensureAlive();
    invariant(
      context instanceof Element,
      'invalid-shortcut-context',
      'Shortcuts require an Element context',
    );
    const keyboard = context.owner.keyboard,
      primary = context.owner.focus.primaryFocus?.context;
    const targeted = this.entries.filter(
        ([activator]) =>
          activator.triggers !== null &&
          new KeyboardKeySet(activator.triggers).has(event.logicalKey),
      ),
      wildcard = this.entries.filter(([activator]) => activator.triggers === null);
    const intent = [...targeted, ...wildcard].find(([activator]) =>
      activator.accepts(event, keyboard),
    )?.[1];
    if (intent && primary?.mounted) {
      const action = Actions.maybeFind(primary, intent);
      if (action) {
        const [enabled, result] = Actions.of(primary).invokeActionIfEnabled(
          action,
          intent,
          primary,
        );
        if (enabled) return action.toKeyEventResultFor(intent, result);
      }
    }
    return this.modal ? 'skipRemainingHandlers' : 'ignored';
  }
}
export interface ShortcutsPresentationOptions {
  readonly key?: Key | null;
  readonly debugLabel?: string | null;
  readonly includeSemantics?: boolean;
}
export interface ShortcutsOptions extends ShortcutsPresentationOptions {
  readonly shortcuts: ShortcutMap;
  readonly child: Widget;
}
export class Shortcuts extends StatefulWidget {
  private readonly shortcutMap: ShortcutMap;
  readonly child: Widget;
  readonly manager: ShortcutManager | undefined;
  readonly debugLabel: string | null;
  readonly includeSemantics: boolean;
  constructor(options: ShortcutsOptions) {
    super(options.key ?? null);
    this.shortcutMap = options.shortcuts;
    this.child = options.child;
    this.manager = undefined;
    this.debugLabel = options.debugLabel ?? null;
    this.includeSemantics = options.includeSemantics ?? true;
  }
  get shortcuts(): ShortcutMap {
    return this.manager?.shortcuts ?? this.shortcutMap;
  }
  static manager(
    manager: ShortcutManager,
    child: Widget,
    options?: ShortcutsPresentationOptions,
  ): Shortcuts;
  static manager(manager: ShortcutManager, child: Widget, key?: Key | null): Shortcuts;
  static manager(
    manager: ShortcutManager,
    child: Widget,
    options: ShortcutsPresentationOptions | Key | null = {},
  ): Shortcuts {
    const presentation =
      options !== null && typeof options === 'object' && 'equals' in options
        ? { key: options as Key }
        : (options ?? {});
    const value = new Shortcuts({ ...presentation, shortcuts: new Map(), child });
    Object.defineProperty(value, 'manager', { value: manager, enumerable: true });
    return value;
  }
  createState(): State {
    return new ShortcutsWidgetState();
  }
}
class ShortcutsWidgetState extends State<Shortcuts> {
  private owned: ShortcutManager | undefined;
  override initState(): void {
    if (!this.widget.manager)
      this.owned = new ShortcutManager({ shortcuts: this.widget.shortcuts });
  }
  override didUpdateWidget(_old: Shortcuts): void {
    if (this.widget.manager) {
      this.owned?.dispose();
      this.owned = undefined;
    } else if (this.owned) this.owned.shortcuts = this.widget.shortcuts;
    else this.owned = new ShortcutManager({ shortcuts: this.widget.shortcuts });
  }
  override dispose(): void {
    this.owned?.dispose();
    this.owned = undefined;
  }
  build(_context: BuildContext): Widget {
    return new Focus(this.widget.child, {
      debugLabel:
        this.widget.debugLabel === null ? 'Shortcuts' : 'Shortcuts: ' + this.widget.debugLabel,
      canRequestFocus: false,
      includeSemantics: this.widget.includeSemantics,
      onKeyEvent: (node, event) =>
        node.context === null
          ? 'ignored'
          : (this.widget.manager ?? this.owned!).handleKeypress(node.context, event),
    });
  }
}

export interface ShortcutRegistryOptions {
  /** The owning View supplies post-frame scheduling; there is no process-global binding. */
  readonly postFrame: (callback: () => void) => void;
}
interface RegistryData {
  readonly entries: Map<ShortcutRegistryEntry, ShortcutMap>;
  readonly postFrame: (callback: () => void) => void;
  scheduled: boolean;
  closed: boolean;
}
const registries = new WeakMap<ShortcutRegistry, RegistryData>();
const entryRegistries = new WeakMap<ShortcutRegistryEntry, ShortcutRegistry>();
const createRegistryEntry = Symbol('ShortcutRegistryEntry factory');
function makeRegistryEntry(registry: ShortcutRegistry): ShortcutRegistryEntry {
  return ShortcutRegistryEntry[createRegistryEntry](registry);
}
function registryData(registry: ShortcutRegistry): RegistryData {
  const data = registries.get(registry);
  invariant(data, 'invalid-shortcut-registry', 'Unknown ShortcutRegistry');
  return data;
}
function liveRegistry(registry: ShortcutRegistry): RegistryData {
  const data = registryData(registry);
  invariant(!data.closed, 'disposed-shortcut-registry', 'ShortcutRegistry used after dispose');
  return data;
}
function checkRegistryEntry(
  registry: ShortcutRegistry,
  entry: ShortcutRegistryEntry,
): RegistryData {
  const data = registryData(registry);
  invariant(
    entry.registry === registry,
    'foreign-shortcut-entry',
    'Shortcut token belongs to a different registry',
  );
  invariant(
    data.entries.has(entry),
    'disposed-shortcut-entry',
    'Shortcut token was already disposed',
  );
  return data;
}
function notifyRegistryNextFrame(registry: ShortcutRegistry): void {
  const data = registryData(registry);
  if (data.closed || data.scheduled) return;
  data.scheduled = true;
  try {
    data.postFrame(() => {
      data.scheduled = false;
      if (!data.closed) registry.notifyListeners();
    });
  } catch (error) {
    data.scheduled = false;
    throw error;
  }
}
function checkRegistryDuplicates(entries: ReadonlyMap<ShortcutRegistryEntry, ShortcutMap>): void {
  const previous: ShortcutActivator[] = [];
  for (const shortcuts of entries.values())
    for (const key of shortcuts.keys()) {
      invariant(
        !previous.some((value) => sameActivator(value, key)),
        'duplicate-shortcut-registration',
        'ShortcutRegistry received duplicate activators',
      );
      previous.push(key);
    }
}
function replaceRegistryEntry(
  registry: ShortcutRegistry,
  entry: ShortcutRegistryEntry,
  value: ShortcutMap,
): void {
  const data = liveRegistry(registry);
  checkRegistryEntry(registry, entry);
  const snapshot = new ShortcutMapSnapshot(value),
    next = new Map(data.entries);
  next.set(entry, snapshot);
  checkRegistryDuplicates(next);
  data.entries.set(entry, snapshot);
  notifyRegistryNextFrame(registry);
}
function disposeRegistryEntry(registry: ShortcutRegistry, entry: ShortcutRegistryEntry): void {
  const data = checkRegistryEntry(registry, entry);
  data.entries.delete(entry);
  notifyRegistryNextFrame(registry);
}

export class ShortcutRegistryEntry {
  private constructor(registry: ShortcutRegistry) {
    entryRegistries.set(this, registry);
  }
  static [createRegistryEntry](registry: ShortcutRegistry): ShortcutRegistryEntry {
    return new ShortcutRegistryEntry(registry);
  }
  get registry(): ShortcutRegistry {
    const registry = entryRegistries.get(this);
    invariant(registry, 'invalid-shortcut-entry', 'Unknown shortcut token');
    return registry;
  }
  replaceAll(value: ShortcutMap): void {
    replaceRegistryEntry(this.registry, this, value);
  }
  dispose(): void {
    disposeRegistryEntry(this.registry, this);
  }
}
export class ShortcutRegistry extends ChangeNotifier {
  constructor({ postFrame }: ShortcutRegistryOptions) {
    super();
    invariant(
      typeof postFrame === 'function',
      'missing-shortcut-scheduler',
      'ShortcutRegistry requires its View post-frame scheduler',
    );
    registries.set(this, { entries: new Map(), postFrame, scheduled: false, closed: false });
    ChangeNotifier.maybeDispatchObjectCreation(this);
  }
  get shortcuts(): ShortcutMap {
    return new ShortcutMapSnapshot(
      new Map([...liveRegistry(this).entries.values()].flatMap((value) => [...value])),
    );
  }
  addAll(value: ShortcutMap): ShortcutRegistryEntry {
    const data = liveRegistry(this),
      snapshot = new ShortcutMapSnapshot(value);
    invariant(
      snapshot.size > 0,
      'empty-shortcut-registration',
      'Cannot register an empty map of shortcuts',
    );
    const entry = makeRegistryEntry(this),
      next = new Map(data.entries);
    next.set(entry, snapshot);
    checkRegistryDuplicates(next);
    data.entries.set(entry, snapshot);
    notifyRegistryNextFrame(this);
    return entry;
  }
  static maybeOf(context: BuildContext): ShortcutRegistry | null {
    return context.maybeDependOn(ShortcutRegistrarScope)?.registry ?? null;
  }
  static of(context: BuildContext): ShortcutRegistry {
    const registry = this.maybeOf(context);
    invariant(registry, 'missing-shortcut-registrar', 'No ShortcutRegistrar ancestor was found');
    return registry;
  }
  override dispose(): void {
    const data = registryData(this);
    if (data.closed) return;
    super.dispose();
    data.closed = true;
  }
}
export class ShortcutRegistrar extends StatefulWidget {
  constructor(
    readonly child: Widget,
    key: Key | null = null,
  ) {
    super(key);
  }
  createState(): State {
    return new ShortcutRegistrarState();
  }
}
class ShortcutRegistrarState extends State<ShortcutRegistrar> {
  private registry!: ShortcutRegistry;
  private manager!: ShortcutManager;
  private readonly changed = () => {
    this.manager.shortcuts = this.registry.shortcuts;
  };
  override initState(): void {
    super.initState();
    invariant(
      this.context instanceof Element,
      'invalid-shortcut-context',
      'ShortcutRegistrar requires an Element context',
    );
    const owner = this.context.owner;
    this.registry = new ShortcutRegistry({ postFrame: (callback) => owner.postFrame(callback) });
    this.manager = new ShortcutManager();
    this.registry.addListener(this.changed);
  }
  override dispose(): void {
    this.registry.removeListener(this.changed);
    this.registry.dispose();
    this.manager.dispose();
    super.dispose();
  }
  build(): Widget {
    return new ShortcutRegistrarScope(
      this.registry,
      Shortcuts.manager(this.manager, this.widget.child),
    );
  }
}
class ShortcutRegistrarScope extends InheritedWidget {
  constructor(
    readonly registry: ShortcutRegistry,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: this): boolean {
    return this.registry !== old.registry;
  }
}
