// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { BinaryMessenger } from './binary-messenger.ts';
import { SystemChannels, SystemChannelSet } from './system-channels.ts';
import { systemUiOverlayStyleToPlatformMap } from './system-ui-overlay-style-source.ts';
import type { SystemUiOverlayStyle } from './system-ui-overlay-style.ts';

export { SystemUiOverlayStyle } from './system-ui-overlay-style.ts';

export const DeviceOrientation = Object.freeze({
  portraitUp: 'portraitUp',
  portraitDown: 'portraitDown',
  landscapeLeft: 'landscapeLeft',
  landscapeRight: 'landscapeRight',
} as const);
export type DeviceOrientation = (typeof DeviceOrientation)[keyof typeof DeviceOrientation];

export const SystemUiMode = Object.freeze({
  edgeToEdge: 'edgeToEdge',
  leanBack: 'leanBack',
  immersive: 'immersive',
  immersiveSticky: 'immersiveSticky',
  manual: 'manual',
} as const);
export type SystemUiMode = (typeof SystemUiMode)[keyof typeof SystemUiMode];

export const SystemUiOverlay = Object.freeze({ top: 'top', bottom: 'bottom' } as const);
export type SystemUiOverlay = (typeof SystemUiOverlay)[keyof typeof SystemUiOverlay];

export class SystemChrome {
  private constructor() {}

  private static async invoke(
    method: string,
    args: unknown,
    messenger?: BinaryMessenger,
  ): Promise<void> {
    const channel = messenger ? new SystemChannelSet(messenger).platform : SystemChannels.platform;
    await channel.invokeMethod('SystemChrome.' + method, args);
  }

  /** An empty list returns orientation selection to the host. */
  static setPreferredOrientations(
    orientations: readonly DeviceOrientation[],
    messenger?: BinaryMessenger,
  ): Promise<void> {
    return this.invoke(
      'setPreferredOrientations',
      orientations.map((orientation) => 'DeviceOrientation.' + orientation),
      messenger,
    );
  }

  static async setEnabledSystemUIMode(
    mode: SystemUiMode,
    options?: { readonly overlays?: readonly SystemUiOverlay[] },
    messenger?: BinaryMessenger,
  ): Promise<void> {
    if (mode === SystemUiMode.manual) {
      if (!options?.overlays) throw new TypeError('Manual system UI mode requires overlays');
      await this.invoke(
        'setEnabledSystemUIOverlays',
        options.overlays.map((overlay) => 'SystemUiOverlay.' + overlay),
        messenger,
      );
    } else {
      await this.invoke('setEnabledSystemUIMode', 'SystemUiMode.' + mode, messenger);
    }
  }

  static restoreSystemUIOverlays(messenger?: BinaryMessenger): Promise<void> {
    return this.invoke('restoreSystemUIOverlays', null, messenger);
  }

  /** For a screen with an AppBar, use its systemOverlayStyle to set the style on each frame. */
  static setSystemUIOverlayStyle(
    style: SystemUiOverlayStyle,
    messenger?: BinaryMessenger,
  ): Promise<void> {
    return this.invoke(
      'setSystemUIOverlayStyle',
      new Map(Object.entries(systemUiOverlayStyleToPlatformMap(style))),
      messenger,
    );
  }
}
