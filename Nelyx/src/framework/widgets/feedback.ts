// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter widgets/feedback.dart.
import { FoundationPlatform } from '../../foundation/platform.ts';
import { SystemSound } from '../../services/system-sound.ts';
import { HapticFeedback } from '../../services/haptic-feedback.ts';
import { TapSemanticEvent, LongPressSemanticsEvent } from '../semantics/semantics-event.ts';
import type { GestureTapCallback } from '../gestures/tap.ts';
import type { GestureLongPressCallback } from '../gestures/long-press.ts';
import type { BuildContext } from './framework.ts';

export class Feedback {
  private constructor() {}
  static async forTap(context: BuildContext): Promise<void> {
    context.findRenderObject()!.sendSemanticsEvent(new TapSemanticEvent());
    switch (FoundationPlatform.defaultTargetPlatform) {
      case 'android':
      case 'fuchsia':
        return SystemSound.play(
          'click',
          context.services.binaryMessenger ??
            context.services.platformServices?.defaultBinaryMessenger,
        );
      case 'iOS':
      case 'linux':
      case 'macOS':
      case 'windows':
        return;
    }
  }
  static wrapForTap(
    callback: GestureTapCallback | null,
    context: BuildContext,
  ): GestureTapCallback | null {
    if (callback === null) return null;
    return () => {
      void Feedback.forTap(context);
      callback();
    };
  }
  static forLongPress(context: BuildContext): Promise<void> {
    context.findRenderObject()!.sendSemanticsEvent(new LongPressSemanticsEvent());
    const messenger =
      context.services.binaryMessenger ?? context.services.platformServices?.defaultBinaryMessenger;
    switch (FoundationPlatform.defaultTargetPlatform) {
      case 'android':
      case 'fuchsia':
        return HapticFeedback.vibrate(messenger);
      case 'iOS':
        return Feedback.waitForFeedback([
          SystemSound.play('click', messenger),
          HapticFeedback.heavyImpact(messenger),
        ]);
      case 'linux':
      case 'macOS':
      case 'windows':
        return Promise.resolve();
    }
  }
  /** Dart Future.wait waits for both operations and propagates the first error. */
  private static async waitForFeedback(futures: readonly Promise<void>[]): Promise<void> {
    let failed = false,
      firstError: unknown;
    await Promise.all(
      futures.map((future) =>
        future.catch((error) => {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }),
      ),
    );
    if (failed) throw firstError;
  }
  static wrapForLongPress(
    callback: GestureLongPressCallback | null,
    context: BuildContext,
  ): GestureLongPressCallback | null {
    if (callback === null) return null;
    return () => {
      void Feedback.forLongPress(context);
      callback();
    };
  }
}
