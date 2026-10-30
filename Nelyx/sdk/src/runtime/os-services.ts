// SPDX-License-Identifier: BSD-3-Clause
import type { Disposable } from '@nelyx/core/foundation/disposable';
import type { PlatformEnvironment } from '@nelyx/core/services/binding';
import {
  JSONMessageCodec,
  JSONMethodCodec,
  StringCodec,
} from '@nelyx/core/services/message-codecs';
import { MissingPluginException, PlatformException } from '@nelyx/core/services/message-codec';
import type { PluginPlatformMessagePort } from './plugin-port.ts';
export type OsEnvironment = Omit<PlatformEnvironment, 'revision'>;
export interface OsServiceHost {
  readEnvironment(): OsEnvironment;
  observe(
    changed: () => void,
    memoryPressure: () => void,
    failed: (error: unknown) => void,
    fontsChanged: () => void,
  ): Disposable;
  readText?(): Promise<string>;
  writeText?(text: string): Promise<void>;
  hasStrings?(): Promise<boolean>;
  playSystemSound?(type: string): PromiseLike<void> | void;
  vibrateHapticFeedback?(type: string | null): PromiseLike<void> | void;
  pop?(animated: boolean | null): PromiseLike<void> | void;
  setFrameworkHandlesBack?(enabled: boolean): PromiseLike<void> | void;
  navigation?(method: string, args: unknown): Promise<unknown> | unknown;
}
export function unsupported(method: string): never {
  throw new PlatformException({
    code: 'unsupported',
    message: 'Platform does not support ' + method,
  });
}
/** Install actual OS implementations on one application's registry. */
export function installOsServices(port: PluginPlatformMessagePort, host: OsServiceHost): void {
  const json = new JSONMessageCodec(),
    strings = new StringCodec(),
    codec = new JSONMethodCodec();
  let revision = 0,
    observation: Disposable | undefined,
    live = true,
    starting = false;
  const listeners = new Set<string>();
  const snapshot = () => {
    const value = host.readEnvironment();
    return new Map<string, unknown>([
      ['revision', ++revision],
      ['locales', value.locales],
      ['localeSource', value.localeSource],
      ...(value.localeObservation
        ? [['localeObservation', value.localeObservation] as [string, unknown]]
        : []),
      ...(value.accessibility
        ? [['accessibility', new Map(Object.entries(value.accessibility))] as [string, unknown]]
        : []),
      ['brightness', value.brightness],
      ['lifecycle', value.lifecycle],
      ['textScale', value.textScale],
      ['capabilities', new Map(Object.entries(value.capabilities))],
    ]);
  };
  const emit = (channel: string, data: DataView | null) => {
    void port.emit(channel, data).catch(() => {});
  };
  const failed = (error: unknown) =>
    emit(
      'nelyx/environment-errors',
      json.encodeMessage(
        new Map<string, unknown>([
          ['code', error instanceof PlatformException ? error.code : 'platform-error'],
          ['message', error instanceof PlatformException ? error.message : String(error)],
          ['details', error instanceof PlatformException ? error.details : null],
        ]),
      ),
    );
  const changed = () => {
    if (!live || !listeners.size) return;
    try {
      const value = snapshot();
      emit('nelyx/environment-changed', json.encodeMessage(value));
      const state = value.get('lifecycle');
      if (state !== null)
        emit('flutter/lifecycle', strings.encodeMessage('AppLifecycleState.' + state));
    } catch (error) {
      failed(error);
    }
  };
  const pressure = () =>
    emit('flutter/system', json.encodeMessage(new Map([['type', 'memoryPressure']])));
  const fontsChanged = () =>
    emit('flutter/system', json.encodeMessage(new Map([['type', 'fontsChange']])));
  port.registerMethod('nelyx/environment', codec, (call) => {
    if (call.method !== 'snapshot') throw new MissingPluginException();
    return snapshot();
  });
  port.registerMethod('flutter/platform', codec, async (call) => {
    switch (call.method) {
      case 'SystemSound.play': {
        if (typeof call.arguments !== 'string')
          throw new PlatformException({
            code: 'invalid-arguments',
            message: 'Expected system sound type',
          });
        if (!host.playSystemSound) unsupported(call.method);
        await host.playSystemSound(call.arguments);
        return null;
      }
      case 'HapticFeedback.vibrate': {
        if (call.arguments !== null && typeof call.arguments !== 'string')
          throw new PlatformException({
            code: 'invalid-arguments',
            message: 'Expected haptic feedback type or null',
          });
        if (!host.vibrateHapticFeedback)
          throw new MissingPluginException('No haptic feedback host');
        await host.vibrateHapticFeedback(call.arguments);
        return null;
      }
      case 'Clipboard.getData': {
        if (call.arguments !== 'text/plain') return null;
        if (!host.readText) unsupported(call.method);
        return new Map([['text', await host.readText()]]);
      }
      case 'Clipboard.setData': {
        const args = call.arguments;
        if (!(args instanceof Map) || typeof args.get('text') !== 'string')
          throw new PlatformException({
            code: 'invalid-arguments',
            message: 'Clipboard.setData requires text',
          });
        if (!host.writeText) unsupported(call.method);
        await host.writeText(args.get('text'));
        return null;
      }
      case 'Clipboard.hasStrings': {
        if (!host.hasStrings) unsupported(call.method);
        return new Map([['value', await host.hasStrings()]]);
      }
      case 'SystemNavigator.pop': {
        if (!(call.arguments === null || typeof call.arguments === 'boolean'))
          throw new PlatformException({
            code: 'invalid-arguments',
            message: 'Expected animated boolean or null',
          });
        if (!host.pop) unsupported(call.method);
        await host.pop(call.arguments);
        return null;
      }
      case 'SystemNavigator.setFrameworkHandlesBack': {
        if (typeof call.arguments !== 'boolean')
          throw new PlatformException({
            code: 'invalid-arguments',
            message: 'Expected frameworkHandlesBack boolean',
          });
        if (!host.setFrameworkHandlesBack) unsupported(call.method);
        await host.setFrameworkHandlesBack(call.arguments);
        return null;
      }
      default:
        throw new MissingPluginException();
    }
  });
  port.registerMethod('flutter/navigation', codec, (call) => {
    if (!host.navigation) unsupported(call.method);
    return host.navigation(call.method, call.arguments);
  });
  port.onListening((channel, listening) => {
    if (
      ![
        'nelyx/environment-changed',
        'nelyx/environment-errors',
        'flutter/lifecycle',
        'flutter/system',
      ].includes(channel)
    )
      return;
    if (listening) listeners.add(channel);
    else listeners.delete(channel);
    if (live && listeners.size && !observation && !starting) {
      starting = true;
      try {
        const created = host.observe(changed, pressure, failed, fontsChanged);
        if (live && listeners.size) observation = created;
        else created.dispose();
      } finally {
        starting = false;
      }
    }
    if (!listeners.size && observation) {
      const previous = observation;
      observation = undefined;
      previous.dispose();
    }
  });
  const stop = () => {
    live = false;
    listeners.clear();
    const previous = observation;
    observation = undefined;
    previous?.dispose();
  };
  port.onStop(stop);
  port.own({ dispose: stop });
}
