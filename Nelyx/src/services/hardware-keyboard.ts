// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// HardwareKeyboard/KeyEvent adapted from services/hardware_keyboard.dart.
// Raw transport regularization is an Nelyx embedding adapter, separate from IME editing.
import { LogicalKeyboardKey, PhysicalKeyboardKey, KeyboardKeySet } from './keyboard-key.ts';
import type { KeyEvent as TransportKeyEvent } from '../ui/input.ts';
import { scanCodeToPhysical, keyCodeToLogical } from './android-key-map.ts';
import { kWebToLogicalKey, kWebToPhysicalKey, kWebLogicalLocationMap } from './web-key-map.ts';
import { windowsPhysicalKeyId, windowsLogicalKeyId } from './windows-engine-key-map.ts';
import { ServicesBinding } from './binding.ts';
import { FlutterError } from '../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../foundation/assertions.ts';
import type { BinaryMessenger } from './binary-messenger.ts';
import { OptionalMethodChannel } from './platform-channel.ts';
import { StandardMethodCodec } from './message-codecs.ts';

export type KeyEventDeviceType = 'keyboard' | 'directionalPad' | 'gamepad' | 'joystick' | 'hdmi';
/** The legacy transport label is extra to source KeyEvent. Packed raw UTF-16
 * logical IDs can exceed the Unicode scalar range; do not reinterpret them. */
function transportKeyLabel(key: LogicalKeyboardKey): string {
  return Math.floor(key.keyId / 0x100000000) === 0 && key.keyId > 0x10ffff ? '' : key.keyLabel;
}
export interface KeyEventOptions {
  readonly physicalKey: PhysicalKeyboardKey;
  readonly logicalKey: LogicalKeyboardKey;
  /** Milliseconds in the embedding's monotonic clock, equivalent to source Duration. */
  readonly timeStamp: number;
  readonly character?: string | null;
  readonly synthesized?: boolean;
  readonly deviceType?: KeyEventDeviceType;
  /** Legacy transport compatibility, copied at dispatch rather than read from mutable state. */
  readonly key?: string;
  readonly shift?: boolean;
  readonly control?: boolean;
  readonly alt?: boolean;
  readonly meta?: boolean;
}
export abstract class KeyEvent implements TransportKeyEvent {
  readonly physicalKey: PhysicalKeyboardKey;
  readonly logicalKey: LogicalKeyboardKey;
  readonly timeStamp: number;
  readonly character: string | null;
  readonly synthesized: boolean;
  readonly deviceType: KeyEventDeviceType;
  readonly key: string;
  readonly shift: boolean;
  readonly control: boolean;
  readonly alt: boolean;
  readonly meta: boolean;
  abstract readonly kind: 'down' | 'up';
  abstract readonly repeat: boolean;
  constructor(options: KeyEventOptions) {
    if (!Number.isFinite(options.timeStamp) || options.timeStamp < 0)
      throw new RangeError('Invalid key timestamp');
    this.physicalKey = options.physicalKey;
    this.logicalKey = options.logicalKey;
    this.timeStamp = options.timeStamp;
    this.character = options.character ?? null;
    this.synthesized = options.synthesized ?? false;
    this.deviceType = options.deviceType ?? 'keyboard';
    this.key = options.key ?? options.character ?? transportKeyLabel(options.logicalKey);
    this.shift = options.shift ?? false;
    this.control = options.control ?? false;
    this.alt = options.alt ?? false;
    this.meta = options.meta ?? false;
  }
}
export class KeyDownEvent extends KeyEvent {
  readonly kind = 'down';
  readonly repeat = false;
  constructor(options: KeyEventOptions) {
    super(options);
    Object.freeze(this);
  }
}
export class KeyUpEvent extends KeyEvent {
  readonly kind = 'up';
  readonly repeat = false;
  constructor(options: Omit<KeyEventOptions, 'character'>) {
    super(options);
    Object.freeze(this);
  }
}
export class KeyRepeatEvent extends KeyEvent {
  readonly kind = 'down';
  readonly repeat = true;
  constructor(options: Omit<KeyEventOptions, 'synthesized'>) {
    super(options);
    Object.freeze(this);
  }
}
export class KeyboardLockMode {
  private constructor(
    readonly logicalKey: LogicalKeyboardKey,
    readonly name: 'numLock' | 'scrollLock' | 'capsLock',
  ) {
    Object.freeze(this);
  }
  static readonly numLock = new KeyboardLockMode(LogicalKeyboardKey.numLock, 'numLock');
  static readonly scrollLock = new KeyboardLockMode(LogicalKeyboardKey.scrollLock, 'scrollLock');
  static readonly capsLock = new KeyboardLockMode(LogicalKeyboardKey.capsLock, 'capsLock');
  static findLockByLogicalKey(key: LogicalKeyboardKey): KeyboardLockMode | undefined {
    return lockModes.find((mode) => mode.logicalKey.equals(key));
  }
}
const lockModes = [
  KeyboardLockMode.numLock,
  KeyboardLockMode.scrollLock,
  KeyboardLockMode.capsLock,
];
export type KeyEventCallback = (event: KeyEvent) => boolean;
/** One admitted host message can normalize once; the capability expires on return. */
export interface KeyboardMessageScope {
  handleTransportMessage(
    raw: TransportKeyEvent,
    route: (events: readonly KeyEvent[]) => boolean,
  ): boolean;
}
const modifiers = [
  {
    flag: 'shift',
    left: LogicalKeyboardKey.shiftLeft,
    right: LogicalKeyboardKey.shiftRight,
    physical: PhysicalKeyboardKey.shiftLeft,
  },
  {
    flag: 'control',
    left: LogicalKeyboardKey.controlLeft,
    right: LogicalKeyboardKey.controlRight,
    physical: PhysicalKeyboardKey.controlLeft,
  },
  {
    flag: 'alt',
    left: LogicalKeyboardKey.altLeft,
    right: LogicalKeyboardKey.altRight,
    physical: PhysicalKeyboardKey.altLeft,
  },
  {
    flag: 'meta',
    left: LogicalKeyboardKey.metaLeft,
    right: LogicalKeyboardKey.metaRight,
    physical: PhysicalKeyboardKey.metaLeft,
  },
] as const;
/** Unknown transport keys have an opaque platform identity, never a guessed USB position. */
function opaqueCode(text: string): number {
  let result = 0x811c9dc5;
  for (let i = 0; i < text.length; i++)
    result = Math.imul(result ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return result;
}
function plane(raw: TransportKeyEvent): number {
  return raw.platform === 'android'
    ? LogicalKeyboardKey.androidPlane
    : raw.platform === 'windows'
      ? LogicalKeyboardKey.windowsPlane
      : LogicalKeyboardKey.webPlane;
}
function identities(raw: TransportKeyEvent): {
  physicalKey: PhysicalKeyboardKey;
  logicalKey: LogicalKeyboardKey;
  character: string | null;
  deviceType: KeyEventDeviceType;
} {
  let physical: number, logical: number | undefined;
  if (raw.android) {
    const { scanCode, keyCode } = raw.android;
    physical =
      scanCode === 0
        ? LogicalKeyboardKey.androidPlane + keyCode
        : (scanCodeToPhysical.get(scanCode) ?? LogicalKeyboardKey.androidPlane + scanCode);
    logical = keyCodeToLogical.get(keyCode) ?? LogicalKeyboardKey.androidPlane + keyCode;
  }
  // RNW virtual input can have no scan code. Keep public raw IDs and the
  // exact engine table unchanged; the modern host uses an opaque keyCode ID
  // so independent no-scan keys do not overwrite each other's tap sequence.
  else if (raw.windows) {
    const { scanCode, keyCode } = raw.windows;
    physical =
      scanCode === 0 ? LogicalKeyboardKey.windowsPlane + keyCode : windowsPhysicalKeyId(scanCode);
    logical = windowsLogicalKeyId(keyCode, scanCode);
  } else {
    physical =
      (raw.code && kWebToPhysicalKey.get(raw.code)) ||
      plane(raw) + opaqueCode(raw.code || 'legacy:' + raw.key.toLowerCase());
    const location =
      raw.location ??
      (/^(Control|Shift|Alt|Meta)Right$/.test(raw.code ?? '')
        ? 2
        : /^(Control|Shift|Alt|Meta)Left$/.test(raw.code ?? '')
          ? 1
          : raw.code?.startsWith('Numpad')
            ? 3
            : 0);
    logical = kWebLogicalLocationMap.get(raw.key)?.[location] ?? kWebToLogicalKey.get(raw.key);
    if (logical === undefined) {
      const text = raw.key.toLowerCase();
      logical =
        [...text].length === 1 && !LogicalKeyboardKey.isControlCharacter(text)
          ? text.codePointAt(0)!
          : plane(raw) + opaqueCode(raw.key);
    }
  }
  const printable = [...raw.key].length === 1 && !LogicalKeyboardKey.isControlCharacter(raw.key);
  const character =
    raw.kind === 'up'
      ? null
      : raw.character !== undefined
        ? raw.character
        : printable && !raw.control && !raw.meta
          ? raw.key
          : null;
  const source = raw.android?.source ?? 0,
    deviceType: KeyEventDeviceType =
      (source & 0x200) === 0x200
        ? 'directionalPad'
        : (source & 0x400) === 0x400
          ? 'gamepad'
          : (source & 0x1000000) === 0x1000000
            ? 'joystick'
            : 'keyboard';
  return {
    physicalKey: PhysicalKeyboardKey.findKeyByCode(physical) ?? new PhysicalKeyboardKey(physical),
    logicalKey: LogicalKeyboardKey.findKeyByKeyId(logical) ?? new LogicalKeyboardKey(logical),
    character,
    deviceType,
  };
}
export class HardwareKeyboard {
  static get instance(): HardwareKeyboard {
    return ServicesBinding.instance.keyboard;
  }
  private readonly pressed = new Map<
    number,
    { physical: PhysicalKeyboardKey; logical: LogicalKeyboardKey; synthesized: boolean }
  >();
  private readonly locks = new Set<KeyboardLockMode>();
  private handlers: KeyEventCallback[] = [];
  private modified: KeyEventCallback[] | undefined;
  private dispatching = false;
  private regularizing = false;
  private messageDispatching = false;
  private lastTimeStamp = 0;
  private closed = false;
  private pendingRelease: { timeStamp: number; route: KeyEventCallback | undefined } | undefined;
  private checkOpen(): void {
    if (this.closed) throw new FlutterError('HardwareKeyboard is closed');
  }
  /** Embedding admission must happen before a View changes keyboard ownership. */
  get isDispatching(): boolean {
    return this.dispatching || this.regularizing || this.messageDispatching;
  }
  /** A native/raw message keeps focus-loss cleanup outside all its callbacks. */
  dispatchMessage<T>(dispatch: (scope: KeyboardMessageScope) => T): T {
    this.checkOpen();
    if (this.isDispatching) throw new FlutterError('Nested keyboard dispatching is not supported');
    this.messageDispatching = true;
    let active = true,
      normalized = false;
    const scope: KeyboardMessageScope = Object.freeze({
      handleTransportMessage: (
        raw: TransportKeyEvent,
        route: (events: readonly KeyEvent[]) => boolean,
      ) => {
        if (!active || normalized || this.dispatching || this.regularizing)
          throw new FlutterError('Host message normalization is unavailable');
        normalized = true;
        const events: KeyEvent[] = [];
        let handled = this.regularizeTransportEvent(raw, (event) => {
          events.push(event);
          return false;
        });
        if (!this.closed)
          try {
            handled = route(Object.freeze(events)) || handled;
          } catch (exception) {
            FlutterError.reportError(
              new FlutterErrorDetails({ exception, library: 'services library' }),
            );
          }
        return handled;
      },
    });
    try {
      return dispatch(scope);
    } finally {
      active = false;
      this.messageDispatching = false;
      this.flushRelease();
    }
  }
  /** Optional engine startup snapshot; missing plugins leave current state intact. */
  async syncKeyboardState(messenger?: BinaryMessenger): Promise<void> {
    this.checkOpen();
    const state = await new OptionalMethodChannel(
      'flutter/keyboard',
      new StandardMethodCodec(),
      messenger ?? null,
    ).invokeMapMethod('getKeyboardState');
    if (this.closed || state === null) return;
    if (this.isDispatching)
      throw new FlutterError('Cannot synchronize keyboard state during dispatch');
    const entries = [...state].map(([physical, logical]) => {
      if (
        typeof physical !== 'number' ||
        !Number.isSafeInteger(physical) ||
        physical < 0 ||
        typeof logical !== 'number' ||
        !Number.isSafeInteger(logical) ||
        logical < 0
      )
        throw new FlutterError('Invalid engine keyboard state');
      return {
        physical: PhysicalKeyboardKey.findKeyByCode(physical) ?? new PhysicalKeyboardKey(physical),
        logical: LogicalKeyboardKey.findKeyByKeyId(logical) ?? new LogicalKeyboardKey(logical),
        synthesized: false,
      };
    });
    for (const entry of entries) this.pressed.set(entry.physical.usbHidUsage, entry);
  }
  get physicalKeysPressed(): ReadonlySet<PhysicalKeyboardKey> {
    return new KeyboardKeySet([...this.pressed.values()].map((key) => key.physical));
  }
  get logicalKeysPressed(): ReadonlySet<LogicalKeyboardKey> {
    return new KeyboardKeySet([...this.pressed.values()].map((key) => key.logical));
  }
  get lockModesEnabled(): ReadonlySet<KeyboardLockMode> {
    return new Set(this.locks);
  }
  lookUpLayout(key: PhysicalKeyboardKey): LogicalKeyboardKey | undefined {
    return this.pressed.get(key.usbHidUsage)?.logical;
  }
  isLogicalKeyPressed(key: LogicalKeyboardKey): boolean {
    return this.logicalKeysPressed.has(key);
  }
  isPhysicalKeyPressed(key: PhysicalKeyboardKey): boolean {
    return this.pressed.has(key.usbHidUsage);
  }
  get isControlPressed(): boolean {
    return (
      this.isLogicalKeyPressed(LogicalKeyboardKey.controlLeft) ||
      this.isLogicalKeyPressed(LogicalKeyboardKey.controlRight)
    );
  }
  get isShiftPressed(): boolean {
    return (
      this.isLogicalKeyPressed(LogicalKeyboardKey.shiftLeft) ||
      this.isLogicalKeyPressed(LogicalKeyboardKey.shiftRight)
    );
  }
  get isAltPressed(): boolean {
    return (
      this.isLogicalKeyPressed(LogicalKeyboardKey.altLeft) ||
      this.isLogicalKeyPressed(LogicalKeyboardKey.altRight)
    );
  }
  get isMetaPressed(): boolean {
    return (
      this.isLogicalKeyPressed(LogicalKeyboardKey.metaLeft) ||
      this.isLogicalKeyPressed(LogicalKeyboardKey.metaRight)
    );
  }
  addHandler(handler: KeyEventCallback): void {
    this.checkOpen();
    if (this.dispatching) {
      this.modified ??= [...this.handlers];
      this.modified.push(handler);
    } else this.handlers.push(handler);
  }
  removeHandler(handler: KeyEventCallback): void {
    const list = this.dispatching ? (this.modified ??= [...this.handlers]) : this.handlers,
      index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }
  /** Source entry point consumes a regularized event; all handlers run, even after true. */
  handleKeyEvent(
    event: KeyEvent,
    route?: KeyEventCallback,
    locks?: TransportKeyEvent['locks'],
  ): boolean {
    this.checkOpen();
    if (this.dispatching) throw new FlutterError('Nested keyboard dispatching is not supported');
    const code = event.physicalKey.usbHidUsage,
      previous = this.pressed.get(code);
    if (event instanceof KeyDownEvent) {
      if (previous) throw new FlutterError('KeyDownEvent for an already pressed physical key');
      this.pressed.set(code, {
        physical: event.physicalKey,
        logical: event.logicalKey,
        synthesized: event.synthesized,
      });
      const lock = KeyboardLockMode.findLockByLogicalKey(event.logicalKey);
      if (lock) {
        if (this.locks.has(lock)) this.locks.delete(lock);
        else this.locks.add(lock);
      }
    } else if (event instanceof KeyUpEvent || event instanceof KeyRepeatEvent) {
      if (!previous || !previous.logical.equals(event.logicalKey))
        throw new FlutterError('Key up/repeat does not match the pressed physical and logical key');
      if (event instanceof KeyUpEvent) this.pressed.delete(code);
    } else throw new FlutterError('Unknown KeyEvent subclass');
    if (locks)
      for (const mode of lockModes) {
        if (locks[mode.name]) this.locks.add(mode);
        else this.locks.delete(mode);
      }
    this.lastTimeStamp = event.timeStamp;
    this.dispatching = true;
    let handled = false;
    try {
      for (const handler of route ? [...this.handlers, route] : this.handlers) {
        if (this.closed) break;
        try {
          handled = handler(event) || handled;
        } catch (exception) {
          FlutterError.reportError(
            new FlutterErrorDetails({ exception, library: 'services library' }),
          );
        }
      }
    } finally {
      this.dispatching = false;
      if (this.modified) {
        this.handlers = this.closed ? [] : this.modified;
        this.modified = undefined;
      }
      if (!this.regularizing) this.flushRelease();
    }
    return handled;
  }
  /** Host adapter repairs missed modifier/down/up edges before the source dispatcher. */
  handleTransportEvent(raw: TransportKeyEvent, route: KeyEventCallback): boolean {
    this.checkOpen();
    if (this.regularizing || this.dispatching || this.messageDispatching)
      throw new FlutterError('Nested keyboard dispatching is not supported');
    return this.regularizeTransportEvent(raw, route);
  }
  /** Embedding equivalent of the modern-event part of KeyEventManager:
   * update keyboard state for every normalized event, then route one batch.
   * This does not implement the deprecated raw-event/channel compatibility. */
  handleTransportMessage(
    raw: TransportKeyEvent,
    route: (events: readonly KeyEvent[]) => boolean,
  ): boolean {
    return this.dispatchMessage((scope) => scope.handleTransportMessage(raw, route));
  }
  private regularizeTransportEvent(raw: TransportKeyEvent, route: KeyEventCallback): boolean {
    this.regularizing = true;
    let handled = false;
    const send = (event: KeyEvent, locks?: TransportKeyEvent['locks']) => {
      handled = this.handleIfOpen(event, route, locks) || handled;
    };
    try {
      if (raw instanceof KeyEvent) {
        send(raw);
        return handled;
      }
      const { physicalKey, logicalKey, character, deviceType } = identities(raw),
        timeStamp = raw.timestamp ?? 0;
      for (const modifier of modifiers) {
        const isTrigger = logicalKey.equals(modifier.left) || logicalKey.equals(modifier.right),
          pressed = [...this.pressed.values()].filter(
            (key) => key.logical.equals(modifier.left) || key.logical.equals(modifier.right),
          );
        if (isTrigger) {
          for (const key of pressed)
            if (
              !key.physical.equals(physicalKey) &&
              (!raw[modifier.flag] ||
                (raw.kind === 'down' && key.synthesized && key.logical.equals(logicalKey)))
            )
              send(
                new KeyUpEvent({
                  physicalKey: key.physical,
                  logicalKey: key.logical,
                  timeStamp,
                  synthesized: true,
                  ...this.flags(),
                }),
              );
          continue;
        }
        if (!raw[modifier.flag]) {
          for (const key of pressed)
            send(
              new KeyUpEvent({
                physicalKey: key.physical,
                logicalKey: key.logical,
                timeStamp,
                synthesized: true,
                ...this.flags(),
              }),
            );
        } else if (!pressed.length)
          send(
            new KeyDownEvent({
              physicalKey: modifier.physical,
              logicalKey: modifier.left,
              timeStamp,
              synthesized: true,
              ...this.flags(),
              [modifier.flag]: true,
            }),
          );
      }
      let previous = this.pressed.get(physicalKey.usbHidUsage);
      const options = {
        physicalKey,
        logicalKey: previous?.logical ?? logicalKey,
        timeStamp,
        deviceType,
        key: raw.key,
        shift: raw.shift,
        control: raw.control,
        alt: raw.alt,
        meta: raw.meta,
      };
      if (raw.kind === 'up') {
        if (!previous) {
          send(new KeyDownEvent({ ...options, synthesized: true }));
          previous = this.pressed.get(physicalKey.usbHidUsage);
        }
        send(new KeyUpEvent(options), raw.locks);
        return handled;
      }
      if (previous && !raw.repeat) {
        send(new KeyUpEvent({ ...options, synthesized: true }));
        previous = undefined;
      }
      send(
        previous
          ? new KeyRepeatEvent({ ...options, character })
          : new KeyDownEvent({ ...options, character }),
        raw.locks,
      );
      return handled;
    } finally {
      this.regularizing = false;
      this.flushRelease();
    }
  }
  private handleIfOpen(
    event: KeyEvent,
    route: KeyEventCallback,
    locks?: TransportKeyEvent['locks'],
  ): boolean {
    return this.closed ? false : this.handleKeyEvent(event, route, locks);
  }
  private flags(): Pick<KeyEventOptions, 'shift' | 'control' | 'alt' | 'meta'> {
    return {
      shift: this.isShiftPressed,
      control: this.isControlPressed,
      alt: this.isAltPressed,
      meta: this.isMetaPressed,
    };
  }
  /** Embedding focus loss releases held keys without removing registered app handlers. */
  releaseAllKeys(timeStamp = this.lastTimeStamp, route?: KeyEventCallback): void {
    if (this.closed) return;
    if (this.dispatching || this.regularizing || this.messageDispatching) {
      this.pendingRelease = { timeStamp, route };
      return;
    }
    const errors: unknown[] = [];
    const snapshot1 = [...this.pressed.values()];
    for (const key of snapshot1)
      if (!this.closed && this.pressed.has(key.physical.usbHidUsage))
        try {
          this.handleKeyEvent(
            new KeyUpEvent({
              physicalKey: key.physical,
              logicalKey: key.logical,
              timeStamp,
              synthesized: true,
              ...this.flags(),
            }),
            route,
          );
        } catch (error) {
          errors.push(error);
        }
    if (errors.length) throw new AggregateError(errors, 'Keyboard focus release failed');
  }
  private flushRelease(): void {
    if (this.messageDispatching) return;
    const pending = this.pendingRelease;
    this.pendingRelease = undefined;
    if (pending && !this.closed) this.releaseAllKeys(pending.timeStamp, pending.route);
  }
  clearState(): void {
    this.checkOpen();
    if (this.dispatching || this.regularizing || this.messageDispatching)
      throw new FlutterError('Cannot clear keyboard state during dispatch');
    this.pressed.clear();
    this.locks.clear();
    this.handlers = [];
    this.modified = undefined;
    this.lastTimeStamp = 0;
    this.pendingRelease = undefined;
  }
  /** App owner teardown is admitted even from a handler; no later handler reaches a closed app. */
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.pressed.clear();
    this.locks.clear();
    this.handlers = [];
    this.modified = undefined;
    this.pendingRelease = undefined;
  }
}
