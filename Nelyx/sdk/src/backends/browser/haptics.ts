// SPDX-License-Identifier: BSD-3-Clause
export type HapticRequest =
  | { readonly kind: 'vibrate'; readonly duration: 50 }
  | {
      readonly kind: 'impact';
      readonly style: 'light' | 'medium' | 'heavy';
      readonly duration: number;
    }
  | { readonly kind: 'selection'; readonly duration: 10 }
  | {
      readonly kind: 'notification';
      readonly type: 'success' | 'warning' | 'error';
      readonly duration: number;
    };

export function hapticRequest(type: string | null): HapticRequest {
  switch (type) {
    case 'HapticFeedbackType.lightImpact':
      return { kind: 'impact', style: 'light', duration: 10 };
    case 'HapticFeedbackType.mediumImpact':
      return { kind: 'impact', style: 'medium', duration: 20 };
    case 'HapticFeedbackType.heavyImpact':
      return { kind: 'impact', style: 'heavy', duration: 30 };
    case 'HapticFeedbackType.selectionClick':
      return { kind: 'selection', duration: 10 };
    case 'HapticFeedbackType.successNotification':
      return { kind: 'notification', type: 'success', duration: 20 };
    case 'HapticFeedbackType.warningNotification':
      return { kind: 'notification', type: 'warning', duration: 20 };
    case 'HapticFeedbackType.errorNotification':
      return { kind: 'notification', type: 'error', duration: 30 };
    default:
      return { kind: 'vibrate', duration: 50 };
  }
}
