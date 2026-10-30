// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Deprecated KeyEventManager from pinned services/hardware_keyboard.dart.
import { HardwareKeyboard, KeyDownEvent, KeyRepeatEvent, KeyUpEvent } from './hardware-keyboard.ts';
import type {
  KeyEvent,
  KeyEventDeviceType,
  KeyEventOptions,
  KeyboardMessageScope,
} from './hardware-keyboard.ts';
import { RawKeyboard } from './raw-keyboard.ts';
import { RawKeyEvent, RawKeyDownEvent, RawKeyUpEvent } from './raw-key-event.ts';
import type { RawKeyMessage } from './raw-key-event.ts';
import { RawKeyEventDataAndroid } from './raw-keyboard-android.ts';
import { RawKeyEventDataWeb } from './raw-keyboard-web.ts';
import { LogicalKeyboardKey, PhysicalKeyboardKey } from './keyboard-key.ts';
import { KeyMessage } from './key-message.ts';
import type { KeyMessageHandler } from './key-message.ts';
import { KeyData, KeyEventType } from '../ui/key-data.ts';
import { FlutterError } from '../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../foundation/assertions.ts';
import { ErrorDescription } from '../foundation/diagnostics.ts';
import { FoundationBuildMode } from '../foundation/constants.ts';
import type { KeyEvent as TransportKeyEvent } from '../ui/input.ts';
export const KeyDataTransitMode = Object.freeze({
  rawKeyData: 'rawKeyData',
  keyDataThenRawKeyData: 'keyDataThenRawKeyData',
} as const);
export type KeyDataTransitMode = (typeof KeyDataTransitMode)[keyof typeof KeyDataTransitMode];
export interface KeyEventManagerOptions {
  /** App monotonic milliseconds; source reads its current frame timestamp. */ readonly timeStamp?: () => number;
  /** App embedding prepares the active View after message admission. */ readonly prepareMessage?: () => void;
}
function defaultKeyboardTimeStamp(): number {
  const clock = (globalThis as unknown as { performance?: { now(): number } }).performance;
  if (!clock) throw new FlutterError('Raw key conversion requires an embedding timestamp provider');
  return clock.now();
}
export class KeyEventManager {
  private transitMode: KeyDataTransitMode | null = null;
  private readonly events: KeyEvent[] = [];
  private readonly skippedRawKeys = new Set<number>();
  private live = true;
  private dispatching = false;
  private pendingFocusReset = false;
  private readonly timeStamp: () => number;
  private readonly prepareMessage: (() => void) | undefined;
  private transport: TransportKeyEvent | undefined;
  constructor(
    readonly hardwareKeyboard: HardwareKeyboard,
    readonly rawKeyboard: RawKeyboard,
    options: KeyEventManagerOptions = {},
  ) {
    this.timeStamp = options.timeStamp ?? defaultKeyboardTimeStamp;
    this.prepareMessage = options.prepareMessage;
  }
  get keyMessageHandler(): KeyMessageHandler | null {
    return this.rawKeyboard.messageBinding.keyMessageHandler;
  }
  set keyMessageHandler(handler: KeyMessageHandler | null) {
    this.checkOpen();
    this.rawKeyboard.messageBinding.keyMessageHandler = handler;
  }
  private checkOpen(): void {
    if (!this.live) throw new FlutterError('KeyEventManager is closed');
  }
  private enter(): void {
    this.checkOpen();
    if (this.dispatching) throw new FlutterError('Nested key message dispatch is not supported');
    this.dispatching = true;
  }
  private dispatchMessage<T>(dispatch: (scope: KeyboardMessageScope) => T): T {
    this.enter();
    try {
      return this.hardwareKeyboard.dispatchMessage((scope) => {
        try {
          this.prepareMessage?.();
          return dispatch(scope);
        } finally {
          if (this.pendingFocusReset) {
            this.pendingFocusReset = false;
            this.resetFocusState();
          }
        }
      });
    } finally {
      this.dispatching = false;
      if (this.pendingFocusReset) {
        this.pendingFocusReset = false;
        this.resetFocusState();
      }
    }
  }
  handleKeyData(data: KeyData): boolean {
    return this.dispatchMessage(() => {
      if (!this.live) return false;
      this.transitMode ??= 'keyDataThenRawKeyData';
      if (this.transitMode === 'rawKeyData') {
        if (FoundationBuildMode.debug)
          throw new FlutterError('Should never encounter KeyData when transitMode is rawKeyData');
        return false;
      }
      if (data.physical === 0 && data.logical === 0) return false;
      if (data.physical === 0 || data.logical === 0)
        throw new FlutterError('KeyData must have both physical and logical IDs');
      const event = this.eventFromData(data);
      if (data.synthesized && this.events.length === 0) {
        this.hardwareKeyboard.handleKeyEvent(event);
        if (this.live) this.dispatchKeyMessage([event], null);
      } else this.events.push(event);
      return false;
    });
  }
  private dispatchKeyMessage(events: readonly KeyEvent[], rawEvent: RawKeyEvent | null): boolean {
    if (!this.live) return false;
    const handler = this.keyMessageHandler;
    if (!handler) return false;
    try {
      return handler(new KeyMessage(events, rawEvent));
    } catch (exception) {
      FlutterError.reportError(
        new FlutterErrorDetails({
          exception,
          library: 'services library',
          context: new ErrorDescription('while processing the key message handler'),
        }),
      );
      return false;
    }
  }
  async handleRawKeyMessage(message: RawKeyMessage): Promise<Map<string, boolean>> {
    return this.handleRawKeyMessageSync(message);
  }
  /** Same source processor, synchronous for a DOM/native handled reply. */
  handleRawKeyMessageSync(
    message: RawKeyMessage,
    transport?: TransportKeyEvent,
  ): Map<string, boolean> {
    return this.dispatchMessage((scope) => {
      const previous = this.transport;
      this.transport = transport;
      try {
        return this.processRawKeyMessage(message, scope);
      } finally {
        this.transport = previous;
      }
    });
  }
  private processRawKeyMessage(
    message: RawKeyMessage,
    scope: KeyboardMessageScope,
  ): Map<string, boolean> {
    if (!this.live) return new Map([['handled', false]]);
    if (this.transitMode === null) {
      this.transitMode =
        this.transport?.android || this.transport?.windows ? 'keyDataThenRawKeyData' : 'rawKeyData';
      if (this.transitMode === 'rawKeyData')
        this.rawKeyboard.addListener(this.convertRawEventAndStore);
    }
    const event = RawKeyEvent.fromMessage(message, { keyboard: this.rawKeyboard }),
      id = event.physicalKey.usbHidUsage;
    let shouldDispatch = true;
    if (event instanceof RawKeyDownEvent) {
      if (!event.data.shouldDispatchEvent()) {
        shouldDispatch = false;
        this.skippedRawKeys.add(id);
      } else this.skippedRawKeys.delete(id);
    } else if (event instanceof RawKeyUpEvent && this.skippedRawKeys.has(id)) {
      this.skippedRawKeys.delete(id);
      shouldDispatch = false;
    }
    let handled = true;
    if (shouldDispatch) {
      handled = this.rawKeyboard.handleRawKeyEvent(event);
      // SDK native hosts pair an actual modern transport with pinned raw data.
      const hostTransport =
        (this.transport?.android || this.transport?.windows) &&
        this.transitMode === 'keyDataThenRawKeyData' &&
        this.events.length === 0
          ? this.transport
          : undefined;
      if (hostTransport && this.live)
        handled =
          scope.handleTransportMessage(hostTransport, (events) =>
            this.live ? this.dispatchKeyMessage(events, event) : false,
          ) || handled;
      else
        for (const normalized of this.events) {
          if (!this.live) break;
          handled = this.hardwareKeyboard.handleKeyEvent(normalized) || handled;
        }
      if (this.live && FoundationBuildMode.debug && this.transitMode === 'rawKeyData') {
        const raw = this.rawKeyboard.physicalKeysPressed,
          hardware = this.hardwareKeyboard.physicalKeysPressed;
        if (raw.size !== hardware.size || [...raw].some((key) => !hardware.has(key)))
          throw new FlutterError(
            'RawKeyboard and HardwareKeyboard disagree about physical keys pressed',
          );
      }
      if (this.live && !hostTransport)
        handled = this.dispatchKeyMessage(this.events, event) || handled;
      this.events.length = 0;
    }
    return new Map([['handled', handled]]);
  }
  /** View focus loss clears queued/raw state after the current message finishes. */
  resetForFocusLoss(): void {
    if (!this.live) return;
    if (this.dispatching) {
      this.pendingFocusReset = true;
      return;
    }
    this.resetFocusState();
  }
  private resetFocusState(): void {
    this.rawKeyboard.clearKeysPressed();
    this.events.length = 0;
    this.skippedRawKeys.clear();
  }
  private deviceType(event: RawKeyEvent): KeyEventDeviceType {
    if (!(event.data instanceof RawKeyEventDataAndroid)) return 'keyboard';
    switch (event.data.eventSource) {
      case 0x101:
        return 'keyboard';
      case 0x201:
        return 'directionalPad';
      case 0x401:
        return 'gamepad';
      case 0x01000010:
        return 'joystick';
      case 0x02000001:
        return 'hdmi';
      default:
        return 'keyboard';
    }
  }
  private readonly convertRawEventAndStore = (raw: RawKeyEvent): void => {
    if (!this.live) return;
    const physical = raw.physicalKey,
      logical = raw.logicalKey,
      physicalKeys = new Map(
        [...this.hardwareKeyboard.physicalKeysPressed].map((key) => [key.usbHidUsage, key]),
      ),
      afterwards: KeyEvent[] = [],
      recorded = this.hardwareKeyboard.lookUpLayout(physical),
      timeStamp = this.transport?.timestamp ?? this.timeStamp(),
      deviceType = this.deviceType(raw),
      compatibility = {
        shift: raw.isShiftPressed,
        control: raw.isControlPressed,
        alt: raw.isAltPressed,
        meta: raw.isMetaPressed,
        ...(this.transport
          ? { key: this.transport.key }
          : raw.data instanceof RawKeyEventDataWeb
            ? { key: raw.data.key }
            : {}),
      },
      options = {
        physicalKey: physical,
        logicalKey: logical,
        timeStamp,
        deviceType,
        character: raw.character === '' ? null : raw.character,
        ...compatibility,
      };
    let main: KeyEvent | null;
    if (raw instanceof RawKeyDownEvent) {
      if (recorded === undefined) {
        main = new KeyDownEvent(options);
        physicalKeys.set(physical.usbHidUsage, physical);
      } else main = new KeyRepeatEvent({ ...options, logicalKey: recorded });
    } else {
      if (!(raw instanceof RawKeyUpEvent))
        throw new FlutterError('Unexpected subclass of RawKeyEvent');
      if (recorded === undefined) main = null;
      else {
        main = new KeyUpEvent({
          physicalKey: physical,
          logicalKey: recorded,
          timeStamp,
          deviceType,
          ...compatibility,
        });
        physicalKeys.delete(physical.usbHidUsage);
      }
    }
    const rawPhysical = this.rawKeyboard.physicalKeysPressed;
    for (const key of physicalKeys.values())
      if (!rawPhysical.has(key)) {
        if (key.equals(physical))
          afterwards.push(
            new KeyUpEvent({
              physicalKey: key,
              logicalKey: logical,
              timeStamp,
              synthesized: true,
              deviceType,
            }),
          );
        else
          this.events.push(
            new KeyUpEvent({
              physicalKey: key,
              logicalKey: this.hardwareKeyboard.lookUpLayout(key)!,
              timeStamp,
              synthesized: true,
              deviceType,
            }),
          );
      }
    for (const key of rawPhysical)
      if (!physicalKeys.has(key.usbHidUsage))
        this.events.push(
          new KeyDownEvent({
            physicalKey: key,
            logicalKey: this.rawKeyboard.lookUpLayout(key)!,
            timeStamp,
            synthesized: true,
            deviceType,
          }),
        );
    if (main) this.events.push(main);
    this.events.push(...afterwards);
  };
  private eventFromData(data: KeyData): KeyEvent {
    const options: KeyEventOptions = {
      physicalKey:
        PhysicalKeyboardKey.findKeyByCode(data.physical) ?? new PhysicalKeyboardKey(data.physical),
      logicalKey:
        LogicalKeyboardKey.findKeyByKeyId(data.logical) ?? new LogicalKeyboardKey(data.logical),
      timeStamp: data.timeStamp,
      deviceType: data.deviceType.name,
    };
    if (data.type === KeyEventType.down)
      return new KeyDownEvent({
        ...options,
        character: data.character,
        synthesized: data.synthesized,
      });
    if (data.type === KeyEventType.up) {
      if (FoundationBuildMode.debug && data.character !== null)
        throw new FlutterError('Key up data must not have a character');
      return new KeyUpEvent({ ...options, synthesized: data.synthesized });
    }
    return new KeyRepeatEvent({ ...options, character: data.character });
  }
  /** Source test-only reset intentionally leaves pressed keyboard state and handler ownership intact. */
  clearState(): void {
    this.checkOpen();
    if (!FoundationBuildMode.debug) return;
    this.transitMode = null;
    this.rawKeyboard.removeListener(this.convertRawEventAndStore);
    this.events.length = 0;
  }
  /** Application lifetime adaptation. ServicesBinding separately owns both keyboard state objects. */
  dispose(): void {
    if (!this.live) return;
    this.live = false;
    this.rawKeyboard.removeListener(this.convertRawEventAndStore);
    this.events.length = 0;
    this.skippedRawKeys.clear();
    this.rawKeyboard.messageBinding.keyMessageHandler = null;
  }
}
