// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter services/haptic_feedback.dart.
import type { BinaryMessenger } from './binary-messenger.ts';
import { SystemChannels, SystemChannelSet } from './system-channels.ts';
export class HapticFeedback {
  private constructor() {}
  private static async invoke(type: string | null, messenger?: BinaryMessenger): Promise<void> {
    await (
      messenger ? new SystemChannelSet(messenger).platform : SystemChannels.platform
    ).invokeMethod('HapticFeedback.vibrate', type);
  }
  static async vibrate(messenger?: BinaryMessenger): Promise<void> {
    await this.invoke(null, messenger);
  }
  static async lightImpact(messenger?: BinaryMessenger): Promise<void> {
    await this.invoke('HapticFeedbackType.lightImpact', messenger);
  }
  static async mediumImpact(messenger?: BinaryMessenger): Promise<void> {
    await this.invoke('HapticFeedbackType.mediumImpact', messenger);
  }
  static async heavyImpact(messenger?: BinaryMessenger): Promise<void> {
    await this.invoke('HapticFeedbackType.heavyImpact', messenger);
  }
  static async selectionClick(messenger?: BinaryMessenger): Promise<void> {
    await this.invoke('HapticFeedbackType.selectionClick', messenger);
  }
  static async successNotification(messenger?: BinaryMessenger): Promise<void> {
    await this.invoke('HapticFeedbackType.successNotification', messenger);
  }
  static async warningNotification(messenger?: BinaryMessenger): Promise<void> {
    await this.invoke('HapticFeedbackType.warningNotification', messenger);
  }
  static async errorNotification(messenger?: BinaryMessenger): Promise<void> {
    await this.invoke('HapticFeedbackType.errorNotification', messenger);
  }
}
