// SPDX-License-Identifier: BSD-3-Clause
import type { SemanticsNode } from '@nelyx/core/ui/types';
import type { NativeInteraction } from '../../runtime/native-interaction.ts';
interface ControlPointer {
  pointerId?: number;
  pointerType?: string;
  buttons?: number;
  offsetX?: number;
  offsetY?: number;
  locationX?: number;
  locationY?: number;
  timestamp?: number;
}
interface ControlTouch {
  identifier?: number;
  locationX?: number;
  locationY?: number;
  timestamp?: number;
}
/** Observe actual native control input without forwarding it into canvas hit
 * testing. Missing native fields remain unobserved, rather than inferred. */
export function nativeControlInputProps(
  target: string,
  interaction: NativeInteraction | undefined,
  node: SemanticsNode | undefined,
): Record<string, unknown> {
  if (!interaction || !node) return {};
  const pointer =
    (kind: 'down' | 'move' | 'up' | 'cancel' | 'leave') =>
    (event: { nativeEvent: ControlPointer }) => {
      const e = event.nativeEvent,
        x = e.offsetX ?? e.locationX,
        y = e.offsetY ?? e.locationY;
      if (
        !Number.isSafeInteger(e.pointerId) ||
        e.pointerId! < 0 ||
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isSafeInteger(e.buttons) ||
        e.buttons! < 0
      )
        return;
      interaction.observeControlPointer(node, {
        kind: kind === 'move' && e.buttons === 0 ? 'hover' : kind,
        pointer: e.pointerId!,
        device:
          e.pointerType === 'mouse' || e.pointerType === 'touch' || e.pointerType === 'pen'
            ? e.pointerType
            : 'unknown',
        buttons: e.buttons!,
        x,
        y,
        timestamp:
          typeof e.timestamp === 'number' && Number.isFinite(e.timestamp)
            ? e.timestamp
            : performance.now(),
      });
    };
  const touch =
    (kind: 'down' | 'move' | 'up' | 'cancel') =>
    (event: { nativeEvent: ControlTouch & { changedTouches?: readonly ControlTouch[] } }) => {
      for (const e of event.nativeEvent.changedTouches ?? [event.nativeEvent])
        if (
          Number.isSafeInteger(e.identifier) &&
          e.identifier! >= 0 &&
          typeof e.locationX === 'number' &&
          typeof e.locationY === 'number' &&
          Number.isFinite(e.locationX) &&
          Number.isFinite(e.locationY)
        )
          interaction.observeControlPointer(node, {
            kind,
            pointer: e.identifier!,
            device: 'touch',
            buttons: kind === 'up' || kind === 'cancel' ? 0 : 1,
            x: e.locationX,
            y: e.locationY,
            timestamp:
              typeof e.timestamp === 'number' && Number.isFinite(e.timestamp)
                ? e.timestamp
                : performance.now(),
          });
    };
  const focus = node.actions?.focus
    ? {
        accessibilityActions: [{ name: 'focus', label: 'Focus' }],
        onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => {
          if (event.nativeEvent.actionName === 'focus' && interaction.isLiveNodeSnapshot(node))
            interaction.performAction(node.id, 'focus');
        },
      }
    : {};
  return {
    ...focus,
    ...(target === 'android' || target === 'ios'
      ? {
          onTouchStart: touch('down'),
          onTouchMove: touch('move'),
          onTouchEnd: touch('up'),
          onTouchCancel: touch('cancel'),
        }
      : {
          onPointerDown: pointer('down'),
          onPointerMove: pointer('move'),
          onPointerUp: pointer('up'),
          onPointerCancel: pointer('cancel'),
          onPointerLeave: pointer('leave'),
        }),
  };
}
