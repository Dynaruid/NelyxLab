// SPDX-License-Identifier: BSD-3-Clause
import { JSONMethodCodec } from '@nelyx/core/services/message-codecs';
import { MissingPluginException, PlatformException } from '@nelyx/core/services/message-codec';
import type { MethodCall } from '@nelyx/core/services/message-codec';
import type { PluginPlatformMessagePort } from './plugin-port.ts';

export interface ClipboardServiceHost {
  readText?(): Promise<string>;
  writeText?(text: string): Promise<void>;
  hasStrings?(): Promise<boolean>;
}
export async function invokeClipboardService(
  host: ClipboardServiceHost,
  call: MethodCall,
): Promise<unknown> {
  const unsupported = (): never => {
    throw new PlatformException({
      code: 'unsupported',
      message: 'Platform does not support ' + call.method,
    });
  };
  switch (call.method) {
    case 'Clipboard.getData':
      if (call.arguments !== 'text/plain') return null;
      if (!host.readText) return unsupported();
      return new Map([['text', await host.readText()]]);
    case 'Clipboard.setData': {
      const args = call.arguments;
      if (!(args instanceof Map) || typeof args.get('text') !== 'string')
        throw new PlatformException({
          code: 'invalid-arguments',
          message: 'Clipboard.setData requires text',
        });
      if (!host.writeText) return unsupported();
      await host.writeText(args.get('text'));
      return null;
    }
    case 'Clipboard.hasStrings':
      if (!host.hasStrings) return unsupported();
      return new Map([['value', await host.hasStrings()]]);
    default:
      throw new MissingPluginException();
  }
}
/** The same channel implementation is used by complete and bounded App hosts. */
export function installClipboardService(
  port: PluginPlatformMessagePort,
  host: ClipboardServiceHost,
): void {
  port.registerMethod('flutter/platform', new JSONMethodCodec(), (call) =>
    invokeClipboardService(host, call),
  );
}
