// SPDX-License-Identifier: BSD-3-Clause
import { MissingPluginException, PlatformException } from '@nelyx/core/services/message-codec';
import { StandardMethodCodec } from '@nelyx/core/services/message-codecs';
import type { PluginPlatformMessagePort } from '../../runtime/plugin-port.ts';
export interface NativeMouseCursorPort {
  activate(kind: string, device: number): void;
  dispose(): void;
}
/** The callback belongs to the actual rendered native View, never a global window. */
export function installNativeMouseCursor(
  port: PluginPlatformMessagePort,
  cursor: NativeMouseCursorPort,
): void {
  port.registerMethod('flutter/mousecursor', new StandardMethodCodec(), (call, { signal }) => {
    if (call.method !== 'activateSystemCursor') throw new MissingPluginException();
    const args = call.arguments;
    if (
      !(args instanceof Map) ||
      !Number.isSafeInteger(args.get('device')) ||
      typeof args.get('kind') !== 'string'
    )
      throw new PlatformException({
        code: 'invalid-arguments',
        message: 'Invalid system cursor device or kind',
      });
    if (!signal.aborted) cursor.activate(args.get('kind') as string, args.get('device') as number);
    return null;
  });
  port.own(cursor);
}
