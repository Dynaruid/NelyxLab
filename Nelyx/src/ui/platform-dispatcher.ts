// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Message/registration subset adapted from dart:ui/platform_dispatcher.dart.
import type { RootIsolateToken } from './root-isolate-token.ts';
import type { BinaryMessenger } from '../services/binary-messenger.ts';
import { PlatformChannelBinding } from '../services/channel-binding.ts';
import type { PlatformMessageResponseCallback } from './channel-buffers.ts';
import type { Disposable } from '../foundation/disposable.ts';
import { FlutterError } from '../foundation/flutter-error.ts';
import type { ChannelBuffers } from './channel-buffers.ts';
import { KeyData, KeyEventType } from './key-data.ts';
import { FlutterErrorDetails } from '../foundation/assertions.ts';
import { decodeUtf8 } from '../services/json-serialization.ts';
import type { PointerDataPacket } from './pointer.ts';
import { Offset } from './offset.ts';
import { AccessibilityFeatures } from './accessibility-features.ts';
import { SemanticsAction, SemanticsActionEvent } from './semantics-action.ts';
import type { ChannelCallbackContext } from './channel-buffers.ts';
export type SemanticsActionEventCallback = (event: SemanticsActionEvent) => void;
export interface PlatformAccessibilityObserver {
  featuresChanged(): void;
  enabledChanged(): void;
  action(event: SemanticsActionEvent): void;
}
export type KeyDataCallback = (data: KeyData) => boolean;
export type PointerDataPacketCallback = (packet: PointerDataPacket) => void;
/** Minimal actual View identity port; this is not a fabricated FlutterView. */
export interface HitTestView {
  readonly viewId: number | string;
}
/** Registered SDK identity for source APIs that require integer View ids.
 * Full FlutterView geometry/rendering remains a separate platform contract. */
export interface PlatformViewIdentity {
  readonly viewId: number;
  readonly platformDispatcher: PlatformDispatcher;
}
export interface PlatformViewRegistration extends Disposable {
  readonly view: PlatformViewIdentity;
}
export class HitTestRequest {
  readonly view: HitTestView;
  readonly offset: Offset;
  constructor({ view, offset }: { readonly view: HitTestView; readonly offset: Offset }) {
    if (
      !view ||
      !(typeof view.viewId === 'string' || Number.isSafeInteger(view.viewId)) ||
      !(offset instanceof Offset)
    )
      throw new TypeError('Invalid hit test request');
    this.view = view;
    this.offset = offset;
    if (new.target === HitTestRequest) Object.freeze(this);
  }
}
export class HitTestResponse {
  static readonly empty = new HitTestResponse({ hasPlatformView: false });
  readonly hasPlatformView: boolean;
  constructor({ hasPlatformView }: { readonly hasPlatformView: boolean }) {
    if (typeof hasPlatformView !== 'boolean') throw new TypeError('Invalid hit test response');
    this.hasPlatformView = hasPlatformView;
    if (new.target === HitTestResponse) Object.freeze(this);
  }
}
export type HitTestCallback = (request: HitTestRequest) => HitTestResponse;

export interface PlatformMessageReplyPort {
  postMessage(message: readonly [identifier: number, bytes: Uint8Array | null]): void;
  /** Host transport failures have an explicit outcome in JavaScript. */
  postError(identifier: number, error: unknown): void;
}
export interface PlatformMessageDispatcherHost {
  readonly rootIsolateToken: RootIsolateToken | null;
  readonly channelBuffers?: ChannelBuffers;
  sendPlatformMessage(
    name: string,
    data: DataView | null,
    callback: PlatformMessageResponseCallback | null,
  ): void;
  sendPortPlatformMessage(
    name: string,
    data: DataView | null,
    identifier: number,
    port: PlatformMessageReplyPort,
  ): void;
  registerBackgroundIsolate(token: RootIsolateToken): void;
  /** Host context captures the callback's registration scope; not a Dart VM Zone. */
  captureCallbackContext?(): ChannelCallbackContext;
  setSemanticsTreeEnabled?(enabled: boolean): void;
  onClosing?(callback: () => void): () => void;
  onRetired?(callback: () => void): () => void;
}
const dispatchers = new WeakMap<BinaryMessenger, PlatformDispatcher>();
/** Root applications inject explicitly; a background realm registers one host. */
export class PlatformDispatcher {
  private static background: PlatformDispatcher | undefined;
  private readonly leases = new Set<object>();
  private active = true;
  private keyDataCallback: KeyDataCallback | null = null;
  private pointerDataCallback: PointerDataPacketCallback | null = null;
  private hitTestCallback: HitTestCallback | null = null;
  private features = AccessibilityFeatures.fromBits(0);
  private platformSemanticsEnabled = false;
  private readonly accessibilityObservers = new Set<PlatformAccessibilityObserver>();
  private configurationChanged: (() => void) | null = null;
  private featuresChanged: (() => void) | null = null;
  private semanticsEnabledChanged: (() => void) | null = null;
  private semanticsActionEvent: SemanticsActionEventCallback | null = null;
  private configurationContext: ChannelCallbackContext | null = null;
  private featuresContext: ChannelCallbackContext | null = null;
  private semanticsEnabledContext: ChannelCallbackContext | null = null;
  private semanticsActionContext: ChannelCallbackContext | null = null;
  private readonly viewIdentities = new Map<
    number,
    { view: PlatformViewIdentity; isLive: () => boolean }
  >();
  private implicitViewIdentity: PlatformViewIdentity | null = null;
  private viewsOpen = true;
  private readonly releaseViewClosing: (() => void) | undefined;
  private constructor(
    private readonly host: PlatformMessageDispatcherHost,
    private readonly messenger?: BinaryMessenger,
  ) {
    this.releaseViewClosing = host.onClosing?.(() => {
      this.viewsOpen = false;
      this.viewIdentities.clear();
      this.implicitViewIdentity = null;
      // Unsubscribe while the transport still accepts unlisten. Public callbacks
      // need the same shutdown ordering as the framework's keyboard binding.
      if (this.keyDataCallback !== null) this.onKeyData = null;
    });
  }
  static get initialized(): boolean {
    return this.resolve() !== undefined;
  }
  private static resolve(): PlatformDispatcher | undefined {
    return (
      (PlatformChannelBinding.initialized
        ? dispatchers.get(PlatformChannelBinding.binaryMessenger)
        : undefined) ?? this.background
    );
  }
  static get instance(): PlatformDispatcher {
    const dispatcher = this.resolve();
    if (!dispatcher)
      throw new FlutterError(
        'PlatformDispatcher requires an initialized SDK root or background dispatcher',
      );
    return dispatcher;
  }
  static forMessenger(messenger: BinaryMessenger): PlatformDispatcher {
    const dispatcher = dispatchers.get(messenger);
    if (!dispatcher) throw new FlutterError('This messenger has no registered PlatformDispatcher');
    return dispatcher;
  }
  /** Standalone library bindings can have a messenger without an engine host. */
  static maybeForMessenger(messenger: BinaryMessenger): PlatformDispatcher | undefined {
    return dispatchers.get(messenger);
  }
  static bindRoot(messenger: BinaryMessenger, host: PlatformMessageDispatcherHost): Disposable {
    if (host.rootIsolateToken === null)
      throw new FlutterError('A root dispatcher requires its root token');
    if (dispatchers.has(messenger))
      throw new FlutterError('A dispatcher already owns this messenger');
    const dispatcher = new PlatformDispatcher(host, messenger);
    dispatchers.set(messenger, dispatcher);
    return {
      dispose() {
        if (dispatchers.get(messenger) !== dispatcher) return;
        dispatchers.delete(messenger);
        dispatcher.retire();
      },
    };
  }
  static bindBackground(host: PlatformMessageDispatcherHost): Disposable {
    if (host.rootIsolateToken !== null)
      throw new FlutterError('Background dispatcher must have no root token in this realm');
    let dispatcher = this.background;
    if (dispatcher && dispatcher.host !== host)
      throw new FlutterError('A different background dispatcher already owns this realm');
    if (!dispatcher) this.background = dispatcher = new PlatformDispatcher(host);
    const owner = dispatcher,
      lease = {};
    owner.leases.add(lease);
    return {
      dispose: () => {
        if (!owner.leases.delete(lease) || owner.leases.size) return;
        if (this.background === owner) this.background = undefined;
        owner.retire();
      },
    };
  }
  get rootIsolateToken(): RootIsolateToken | null {
    return this.host.rootIsolateToken;
  }
  /** Explicit root-app adapter; background dispatchers have no View messenger. */
  get binaryMessenger(): BinaryMessenger {
    this.checkActive();
    if (!this.messenger)
      throw new FlutterError('A background dispatcher has no root View messenger');
    return this.messenger;
  }
  get views(): Iterable<PlatformViewIdentity> {
    return [...this.viewIdentities.values()]
      .filter((entry) => entry.isLive())
      .map((entry) => entry.view);
  }
  get implicitView(): PlatformViewIdentity | null {
    const view = this.implicitViewIdentity;
    return view && this.isViewActive(view) ? view : null;
  }
  isViewActive(view: PlatformViewIdentity): boolean {
    const entry = this.viewIdentities.get(view.viewId);
    return this.active && entry?.view === view && entry.isLive();
  }
  /** SDK-owned registration. Implicit selection is explicit, never inferred
   * from the number of currently attached views. IDs cannot alias live owners. */
  registerViewIdentity(
    viewId: number,
    {
      implicit = false,
      isLive = () => true,
    }: { readonly implicit?: boolean; readonly isLive?: () => boolean } = {},
  ): PlatformViewRegistration {
    this.checkActive();
    if (
      !this.viewsOpen ||
      !this.messenger ||
      !Number.isSafeInteger(viewId) ||
      this.viewIdentities.has(viewId) ||
      (implicit && this.implicitViewIdentity !== null)
    )
      throw new FlutterError('Invalid or duplicate platform View registration');
    const view = Object.freeze({ viewId: viewId === 0 ? 0 : viewId, platformDispatcher: this }),
      entry = { view, isLive };
    this.viewIdentities.set(viewId, entry);
    if (implicit) this.implicitViewIdentity = view;
    return {
      view,
      dispose: () => {
        if (this.viewIdentities.get(viewId) !== entry) return;
        this.viewIdentities.delete(viewId);
        if (this.implicitViewIdentity === view) this.implicitViewIdentity = null;
      },
    };
  }
  get channelBuffers(): ChannelBuffers {
    if (!this.host.channelBuffers)
      throw new FlutterError('This dispatcher has no root ChannelBuffers');
    return this.host.channelBuffers;
  }
  private checkActive(): void {
    if (!this.active) throw new FlutterError('PlatformDispatcher is retired');
  }
  get accessibilityFeatures(): AccessibilityFeatures {
    return this.features;
  }
  get semanticsEnabled(): boolean {
    return this.platformSemanticsEnabled;
  }
  get onPlatformConfigurationChanged(): (() => void) | null {
    return this.configurationChanged;
  }
  set onPlatformConfigurationChanged(value: (() => void) | null) {
    this.checkActive();
    this.configurationChanged = value;
    this.configurationContext = this.host.captureCallbackContext?.() ?? null;
  }
  get onAccessibilityFeaturesChanged(): (() => void) | null {
    return this.featuresChanged;
  }
  set onAccessibilityFeaturesChanged(value: (() => void) | null) {
    this.checkActive();
    this.featuresChanged = value;
    this.featuresContext = this.host.captureCallbackContext?.() ?? null;
  }
  get onSemanticsEnabledChanged(): (() => void) | null {
    return this.semanticsEnabledChanged;
  }
  set onSemanticsEnabledChanged(value: (() => void) | null) {
    this.checkActive();
    this.semanticsEnabledChanged = value;
    this.semanticsEnabledContext = this.host.captureCallbackContext?.() ?? null;
  }
  get onSemanticsActionEvent(): SemanticsActionEventCallback | null {
    return this.semanticsActionEvent;
  }
  set onSemanticsActionEvent(value: SemanticsActionEventCallback | null) {
    this.checkActive();
    this.semanticsActionEvent = value;
    this.semanticsActionContext = this.host.captureCallbackContext?.() ?? null;
  }
  private invokePlatformCallback(
    callback: (() => void) | null,
    context: ChannelCallbackContext | null,
  ): void {
    if (!callback || !this.active || !this.viewsOpen) return;
    if (context) context.invoke(callback);
    else callback();
  }
  /** Typed embedding ingress corresponding to the engine's private update hook. */
  updateAccessibilityFeatures(values: number): void {
    this.checkActive();
    if (!this.viewsOpen) return;
    const features = AccessibilityFeatures.fromBits(values);
    if (features.equals(this.features)) return;
    this.features = features;
    try {
      this.invokePlatformCallback(this.configurationChanged, this.configurationContext);
      this.invokePlatformCallback(this.featuresChanged, this.featuresContext);
    } finally {
      this.notifyAccessibility((observer) => observer.featuresChanged());
    }
  }
  updateSemanticsEnabled(enabled: boolean): void {
    this.checkActive();
    if (typeof enabled !== 'boolean')
      throw new TypeError('Expected platform semantics enabled boolean');
    if (!this.viewsOpen || enabled === this.platformSemanticsEnabled) return;
    this.platformSemanticsEnabled = enabled;
    try {
      this.invokePlatformCallback(this.configurationChanged, this.configurationContext);
      this.invokePlatformCallback(this.semanticsEnabledChanged, this.semanticsEnabledContext);
    } finally {
      this.notifyAccessibility((observer) => observer.enabledChanged());
    }
  }
  /** Framework subscriptions are independent of replaceable application callbacks. */
  observeAccessibility(observer: PlatformAccessibilityObserver): () => void {
    this.checkActive();
    if (!this.viewsOpen) throw new FlutterError('Platform Views are closing');
    this.accessibilityObservers.add(observer);
    return () => {
      this.accessibilityObservers.delete(observer);
    };
  }
  private notifyAccessibility(invoke: (observer: PlatformAccessibilityObserver) => void): void {
    const snapshot = [...this.accessibilityObservers];
    for (const observer of snapshot)
      if (this.active && this.viewsOpen && this.accessibilityObservers.has(observer))
        try {
          invoke(observer);
        } catch (exception) {
          FlutterError.reportError(
            new FlutterErrorDetails({ exception, library: 'platform accessibility' }),
          );
        }
  }
  setSemanticsTreeEnabled(enabled: boolean): void {
    this.checkActive();
    if (typeof enabled !== 'boolean')
      throw new TypeError('Expected semantics tree enabled boolean');
    this.host.setSemanticsTreeEnabled?.(enabled);
  }
  dispatchSemanticsAction(
    viewId: number,
    nodeId: number,
    action: number,
    args: DataView | null = null,
  ): void {
    this.checkActive();
    if (!this.viewsOpen) return;
    const type = SemanticsAction.fromIndex(action);
    if (type === null) throw new TypeError('Unknown semantics action');
    const event = new SemanticsActionEvent({ type, viewId, nodeId, arguments: args }),
      callback = this.semanticsActionEvent;
    try {
      this.invokePlatformCallback(
        callback ? () => callback(event) : null,
        this.semanticsActionContext,
      );
    } finally {
      this.notifyAccessibility((observer) => observer.action(event));
    }
  }
  get onPointerDataPacket(): PointerDataPacketCallback | null {
    return this.pointerDataCallback;
  }
  set onPointerDataPacket(callback: PointerDataPacketCallback | null) {
    this.checkActive();
    this.pointerDataCallback = callback;
  }
  get onHitTest(): HitTestCallback | null {
    return this.hitTestCallback;
  }
  set onHitTest(callback: HitTestCallback | null) {
    this.checkActive();
    this.hitTestCallback = callback;
  }
  /** Typed engine/embedding ingress. A native binary producer is a separate contract. */
  dispatchPointerDataPacket(packet: PointerDataPacket): void {
    this.checkActive();
    const callback = this.pointerDataCallback;
    if (!callback) return;
    try {
      callback(packet);
    } catch (exception) {
      FlutterError.reportError(new FlutterErrorDetails({ exception, library: 'ui library' }));
    }
  }
  dispatchHitTest(request: HitTestRequest): HitTestResponse {
    this.checkActive();
    const callback = this.hitTestCallback;
    if (!callback) return HitTestResponse.empty;
    try {
      const result = callback(request);
      if (!(result instanceof HitTestResponse))
        throw new TypeError('Hit test callback must return HitTestResponse');
      return result;
    } catch (exception) {
      FlutterError.reportError(new FlutterErrorDetails({ exception, library: 'ui library' }));
      return HitTestResponse.empty;
    }
  }
  get onKeyData(): KeyDataCallback | null {
    return this.keyDataCallback;
  }
  set onKeyData(callback: KeyDataCallback | null) {
    this.checkActive();
    this.keyDataCallback = callback;
    const buffers = this.host.channelBuffers;
    if (!buffers) return;
    if (callback === null) {
      buffers.clearListener('flutter/keydata');
      return;
    }
    buffers.setListener('flutter/keydata', (packet, reply) => {
      let handled = false;
      try {
        handled = callback(PlatformDispatcher.unpackKeyData(packet));
      } catch (exception) {
        FlutterError.reportError(new FlutterErrorDetails({ exception, library: 'ui library' }));
      }
      reply(new DataView(Uint8Array.of(handled ? 1 : 0).buffer));
    });
  }
  /** Exact pinned six-field packet, little endian, followed by UTF-8 bytes.
   * DataView offsets and safe-number IDs are checked explicitly in this host. */
  private static unpackKeyData(packet: DataView | null): KeyData {
    if (packet === null || packet.byteLength < 56)
      throw new RangeError('Incomplete key data packet');
    const integer = (offset: number): number => {
      const value = packet.getBigUint64(offset, true);
      if (value > BigInt(Number.MAX_SAFE_INTEGER))
        throw new RangeError('Key data integer exceeds the exact-number domain');
      return Number(value);
    };
    const size = integer(0),
      type = packet.getBigInt64(16, true);
    if (size > packet.byteLength - 56 || type < 0n || type >= BigInt(KeyEventType.values.length))
      throw new RangeError('Invalid key data packet');
    return new KeyData({
      timeStamp: integer(8) / 1000,
      type: KeyEventType.values[Number(type)]!,
      physical: integer(24),
      logical: integer(32),
      character:
        size === 0 ? null : decodeUtf8(new Uint8Array(packet.buffer, packet.byteOffset + 56, size)),
      synthesized: packet.getBigUint64(40, true) !== 0n,
    });
  }
  private retire(): void {
    try {
      if (this.keyDataCallback !== null) this.onKeyData = null;
    } finally {
      this.active = false;
      this.accessibilityObservers.clear();
      this.keyDataCallback = null;
      this.pointerDataCallback = null;
      this.hitTestCallback = null;
      this.configurationChanged = null;
      this.featuresChanged = null;
      this.semanticsEnabledChanged = null;
      this.semanticsActionEvent = null;
      this.configurationContext = null;
      this.featuresContext = null;
      this.semanticsEnabledContext = null;
      this.semanticsActionContext = null;
      this.viewsOpen = false;
      this.viewIdentities.clear();
      this.implicitViewIdentity = null;
      this.releaseViewClosing?.();
    }
  }
  /** Engine/SDK ingress uses the callback captured for this message. */
  dispatchKeyData(data: KeyData): boolean {
    this.checkActive();
    const callback = this.keyDataCallback;
    if (!callback) return false;
    try {
      return callback(data);
    } catch (exception) {
      FlutterError.reportError(new FlutterErrorDetails({ exception, library: 'ui library' }));
      return false;
    }
  }
  sendPlatformMessage(
    name: string,
    data: DataView | null,
    callback: PlatformMessageResponseCallback | null,
  ): void {
    this.checkActive();
    this.host.sendPlatformMessage(name, data, callback);
  }
  sendPortPlatformMessage(
    name: string,
    data: DataView | null,
    identifier: number,
    port: PlatformMessageReplyPort,
  ): void {
    this.checkActive();
    this.host.sendPortPlatformMessage(name, data, identifier, port);
  }
  registerBackgroundIsolate(token: RootIsolateToken): void {
    this.checkActive();
    this.host.registerBackgroundIsolate(token);
  }
  onClosing(callback: () => void): () => void {
    return this.host.onClosing?.(callback) ?? (() => {});
  }
  onRetired(callback: () => void): () => void {
    return this.host.onRetired?.(callback) ?? (() => {});
  }
}
