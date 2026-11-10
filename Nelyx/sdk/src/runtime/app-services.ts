// SPDX-License-Identifier: BSD-3-Clause
import {
  AbortController as PortableAbortController,
  AbortSignal as PortableAbortSignal,
} from 'abort-controller';
import { PlatformException, MissingPluginException } from '@nelyx/core/services/message-codec';
import { PluginPlatformMessagePort } from './plugin-port.ts';
import { PlatformMessageConnection } from './platform-messages.ts';
import { invokeClipboardService } from './clipboard-service.ts';
import { JSONMethodCodec, StandardMessageCodec } from '@nelyx/core/services/message-codecs';
import type { EngineEvent, NodeHandle } from '@nelyx/core/engine';
import { PlatformDispatcher } from '@nelyx/core/ui/platform-dispatcher';
import type { PlatformViewRegistration } from '@nelyx/core/ui/platform-dispatcher';

import {
  appServicesVersion,
  appServiceTextUnits,
  validateAppServiceText,
  appServiceReadsText,
} from './app-service-protocol.ts';
import type { AppServiceMethod } from './app-service-protocol.ts';
type NativeAppServices = {
  readonly appServicesVersion: number;
  appService(id: number, method: AppServiceMethod, text: string): void;
  stopAppServices(): void;
  appServicesSnapshot(): { readonly pending: number; readonly bytes: number };
};
type ServiceReply = { kind: 'app-service-result'; id: number; text: string; error?: string };
type WorkerScope = {
  postMessage(value: unknown): void;
  addEventListener(type: 'message', callback: (event: MessageEvent<ServiceReply>) => void): void;
  removeEventListener(type: 'message', callback: (event: MessageEvent<ServiceReply>) => void): void;
};
/** One App messenger and one bounded OS transport. Native/DOM objects stay on UI. */
export function createAppServices(onError: (error: unknown) => void, viewId = 0) {
  const environment = globalThis as unknown as {
    NelyxV2Native?: NativeAppServices;
    __v2ServiceReply?: ((id: number, text: string, error?: string) => void) | undefined;
  };
  const native = environment.NelyxV2Native;
  if (native) {
    if (native.appServicesVersion !== appServicesVersion)
      throw new Error('Required App OS service version 4 is unavailable');
    // Hermes uses the same standard implementation as the previous SDK VM.
    // This App realm owns these missing constructors until the VM retires.
    if (typeof AbortController === 'undefined')
      Object.defineProperty(globalThis, 'AbortController', { value: PortableAbortController });
    if (typeof AbortSignal === 'undefined')
      Object.defineProperty(globalThis, 'AbortSignal', { value: PortableAbortSignal });
  }
  const scope = globalThis as unknown as WorkerScope,
    drains = new Set<Promise<void>>(),
    pending = new Map<
      number,
      { resolve(value: string): void; reject(error: unknown): void; bytes: number }
    >();
  let sequence = 0,
    heldBytes = 0,
    stopped = false,
    closed = false;
  const receive = (id: number, text: string, error?: string) => {
    const request = pending.get(id);
    if (!request) {
      onError(new Error('Unknown or retired App OS service reply'));
      return;
    }
    pending.delete(id);
    heldBytes -= request.bytes;
    if (error === 'not-implemented') request.reject(new MissingPluginException());
    else if (error)
      request.reject(new PlatformException({ code: 'platform-error', message: error }));
    else {
      try {
        validateAppServiceText(text);
        request.resolve(text);
      } catch (error) {
        request.reject(error);
      }
    }
  };
  const listener = (event: MessageEvent<ServiceReply>) => {
    if (event.data?.kind === 'app-service-result')
      receive(event.data.id, event.data.text, event.data.error);
  };
  if (native) {
    if (environment.__v2ServiceReply)
      throw new Error('An App OS service owner is already attached');
    environment.__v2ServiceReply = receive;
  } else scope.addEventListener('message', listener);
  const call = (method: AppServiceMethod, text = ''): Promise<string> => {
    try {
      validateAppServiceText(text);
    } catch (error) {
      return Promise.reject(error);
    }
    const bytes = text.length * 2 + (appServiceReadsText(method) ? appServiceTextUnits * 2 : 0);
    if (stopped || pending.size >= 32 || heldBytes + bytes > 1024 * 1024 || sequence >= 0xffff_ffff)
      return Promise.reject(new Error('App OS service mailbox is full or closed'));
    const id = ++sequence;
    const result = new Promise<string>((resolve, reject) => {
      pending.set(id, { resolve, reject, bytes });
      heldBytes += bytes;
      try {
        if (native) native.appService(id, method, text);
        else scope.postMessage({ kind: 'app-service', id, method, text });
      } catch (error) {
        pending.delete(id);
        heldBytes -= bytes;
        reject(error);
      }
    });
    const drain = result.then(
      () => {},
      () => {},
    );
    drains.add(drain);
    void drain.then(() => drains.delete(drain));
    return result;
  };
  const port = new PluginPlatformMessagePort();
  const accessibilityCodec = new StandardMessageCodec();
  port.register('flutter/accessibility', async (data) => {
    const value = accessibilityCodec.decodeMessage(data);
    if (
      !(value instanceof Map) ||
      !['tooltip', 'announce'].includes(String(value.get('type'))) ||
      value.size !== 2
    )
      throw new MissingPluginException('App accessibility event is unavailable');
    const payload = value.get('data');
    const announce = value.get('type') === 'announce';
    if (
      !(payload instanceof Map) ||
      payload.size !== (announce ? 3 : 1) ||
      (announce &&
        (payload.get('viewId') !== viewId || ![0, 1].includes(payload.get('textDirection')))) ||
      typeof payload.get('message') !== 'string'
    )
      throw new PlatformException({
        code: 'invalid-arguments',
        message: 'Invalid or unsupported polite accessibility event',
      });
    // Both original events use the existing polite announcement transport:
    // RNW announceForAccessibility on Windows and the live status node on Web.
    await call('accessibility-tooltip', payload.get('message'));
    return accessibilityCodec.encodeMessage(null);
  });
  let clipboardReadSnapshot = 0n;
  const clipboard = {
    readText: () =>
      clipboardReadSnapshot
        ? call('clipboard-read-event', String(clipboardReadSnapshot))
        : call('clipboard-read'),
    writeText: async (text: string) => {
      await call('clipboard-write', text);
    },
    hasStrings: async () => {
      const value = await call('clipboard-has-strings');
      if (value !== '0' && value !== '1') throw new Error('Malformed clipboard availability reply');
      return value === '1';
    },
  };
  port.registerMethod('flutter/platform', new JSONMethodCodec(), async (request) => {
    if (request.method === 'SystemSound.play') {
      if (
        !['SystemSoundType.click', 'SystemSoundType.tick', 'SystemSoundType.alert'].includes(
          String(request.arguments),
        )
      )
        throw new PlatformException({ code: 'invalid-arguments', message: 'Unknown system sound' });
      await call('system-sound', request.arguments as string);
      return null;
    }
    if (request.method === 'HapticFeedback.vibrate') {
      const value = request.arguments;
      if (
        value !== null &&
        ![
          'lightImpact',
          'mediumImpact',
          'heavyImpact',
          'selectionClick',
          'successNotification',
          'warningNotification',
          'errorNotification',
        ].some((type) => value === 'HapticFeedbackType.' + type)
      )
        throw new PlatformException({
          code: 'invalid-arguments',
          message: 'Unknown haptic feedback',
        });
      await call('haptic-feedback', value === null ? '' : (value as string));
      return null;
    }
    return invokeClipboardService(clipboard, request);
  });
  const messages = new PlatformMessageConnection(port, {
    useAsDefault: true,
    checkChannel: (channel) => {
      if (channel !== 'flutter/platform' && channel !== 'flutter/accessibility')
        throw new MissingPluginException('App OS channel is unavailable: ' + channel);
    },
  });
  let viewRegistration: PlatformViewRegistration | undefined;
  const stop = () => {
    if (stopped) return;
    viewRegistration?.dispose();
    messages.stop();
    stopped = true;
    if (native) native.stopAppServices();
    else scope.postMessage({ kind: 'app-services-stop' });
  };
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      stop();
      await messages.dispose();
      await Promise.all(drains);
      if (pending.size || heldBytes) throw new Error('App OS service callbacks have not drained');
      if (native) {
        const state = native.appServicesSnapshot();
        if (state.pending || state.bytes)
          throw new Error('Native App OS service bytes have not retired');
        environment.__v2ServiceReply = undefined;
      } else scope.removeEventListener('message', listener);
      closed = true;
    })());
  try {
    messages.attach();
    viewRegistration = PlatformDispatcher.forMessenger(
      messages.binaryMessenger,
    ).registerViewIdentity(viewId, { implicit: true, isLive: () => !stopped });
  } catch (error) {
    stop();
    void close().catch(onError);
    throw error;
  }
  return {
    binaryMessenger: messages.binaryMessenger,
    platformView: viewRegistration!.view,
    dispatchNativeKey: (event: EngineEvent, dispatch?: () => void): void => {
      const snapshot = event.clipboardReadSnapshot ?? 0n,
        previous = clipboardReadSnapshot;
      if (snapshot && !native) throw Error('Native clipboard snapshot has no owning OS host');
      clipboardReadSnapshot = snapshot;
      try {
        dispatch?.();
      } finally {
        clipboardReadSnapshot = previous;
        if (snapshot && !stopped)
          void call('clipboard-release-event', String(snapshot)).catch(onError);
      }
    },
    semanticsEvent: async (node: NodeHandle, type: 'tap' | 'longPress' | 'focus') => {
      if (
        !Number.isInteger(node.slot) ||
        node.slot <= 0 ||
        node.slot > 0xffff_ffff ||
        !Number.isInteger(node.generation) ||
        node.generation <= 0 ||
        node.generation > 0xffff_ffff
      )
        throw new Error('Invalid native semantics event identity');
      await call(
        ('semantics-' + type) as AppServiceMethod,
        ((BigInt(node.generation) << 32n) | BigInt(node.slot)).toString(),
      );
    },
    stop,
    close,
    get execution() {
      return { version: appServicesVersion, pending: pending.size, bytes: heldBytes, closed };
    },
  };
}
