// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { TapSemanticEvent, LongPressSemanticsEvent } from '@nelyx/core/framework/semantics/semantics-event';
import { SystemSound, SystemSoundType } from '@nelyx/core/services/system-sound';
import { HapticFeedback } from '@nelyx/core/services/haptic-feedback';
/** Feedback uses the actual View messenger; absent native delivery stays unavailable. */
export class Feedback {
    static async forTap(context: BuildContext): Promise<void> {
        const platform = FoundationPlatform.defaultTargetPlatform, messenger = context.services.binaryMessenger;
        if (messenger)
            context.findRenderObject()?.sendSemanticsEvent(new TapSemanticEvent());
        if (messenger && (platform === 'android' || platform === 'fuchsia'))
            await SystemSound.play(SystemSoundType.click, messenger);
    }
    static async forLongPress(context: BuildContext): Promise<void> {
        const platform = FoundationPlatform.defaultTargetPlatform, messenger = context.services.binaryMessenger;
        if (!messenger)
            return;
        context.findRenderObject()?.sendSemanticsEvent(new LongPressSemanticsEvent());
        if (platform === 'android' || platform === 'fuchsia')
            await HapticFeedback.vibrate(messenger);
        else if (platform === 'iOS')
            await Promise.all([SystemSound.play(SystemSoundType.click, messenger), HapticFeedback.heavyImpact(messenger)]);
    }
    static wrapForTap(callback: (() => void) | null, context: BuildContext): (() => void) | null {
        return callback === null ? null : () => {
            void this.forTap(context);
            callback();
        };
    }
    static wrapForLongPress(callback: (() => void) | null, context: BuildContext): (() => void) | null {
        return callback === null ? null : () => {
            void this.forLongPress(context);
            callback();
        };
    }
}
