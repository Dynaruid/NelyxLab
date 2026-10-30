// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed services/browser_context_menu.dart at the pinned Flutter revision.
import { FoundationBuildMode } from '../foundation/constants.ts';
import { FoundationPlatform } from '../foundation/platform.ts';
import { invariant } from '../foundation/errors.ts';
import { SystemChannels, SystemChannelSet } from './system-channels.ts';
import type { BinaryMessenger } from './binary-messenger.ts';
export class BrowserContextMenu {
  private constructor() {}
  private static defaultEnabled = true;
  private static readonly applicationEnabled = new WeakMap<BinaryMessenger, boolean>();
  static get enabled(): boolean {
    return BrowserContextMenu.defaultEnabled;
  }
  /** Explicit application-messenger extension of the source singleton API. */
  static enabledFor(messenger?: BinaryMessenger): boolean {
    return messenger
      ? (BrowserContextMenu.applicationEnabled.get(messenger) ?? true)
      : BrowserContextMenu.enabled;
  }
  static async disableContextMenu(messenger?: BinaryMessenger): Promise<void> {
    BrowserContextMenu.checkWeb();
    await (
      messenger ? new SystemChannelSet(messenger).contextMenu : SystemChannels.contextMenu
    ).invokeMethod('disableContextMenu');
    if (messenger) BrowserContextMenu.applicationEnabled.set(messenger, false);
    else BrowserContextMenu.defaultEnabled = false;
  }
  static async enableContextMenu(messenger?: BinaryMessenger): Promise<void> {
    BrowserContextMenu.checkWeb();
    await (
      messenger ? new SystemChannelSet(messenger).contextMenu : SystemChannels.contextMenu
    ).invokeMethod('enableContextMenu');
    if (messenger) BrowserContextMenu.applicationEnabled.set(messenger, true);
    else BrowserContextMenu.defaultEnabled = true;
  }
  private static checkWeb(): void {
    if (FoundationBuildMode.debug)
      invariant(
        FoundationPlatform.hostEnvironment.kind === 'web',
        'native-browser-context-menu',
        'This has no effect on platforms other than web.',
      );
  }
}
