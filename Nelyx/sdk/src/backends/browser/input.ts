// SPDX-License-Identifier: BSD-3-Clause
import type { ViewRuntime } from '@nelyx/core/hosting/runtime';
import type { PointerEvent as FrameworkPointerEvent } from '@nelyx/core/ui/input';
import { RawKeyEventDataWeb } from '@nelyx/core/services/raw-keyboard-web';
/** Canvas captures its own streams; native overlays own their input. */
export function bindCanvasInput(
  canvas: HTMLCanvasElement,
  view: ViewRuntime,
  options: {
    readonly keySurface?: HTMLElement;
    readonly ownsEditingTarget?: (target: EventTarget | null) => boolean;
    readonly ownsSemanticsTarget?: (target: EventTarget | null) => boolean;
    readonly ownsNativeSelectionTarget?: (target: EventTarget | null) => boolean;
  } = {},
): () => void {
  let live = true;
  const pointers = new Set<number>(),
    keySurface = options.keySurface ?? canvas;
  canvas.tabIndex = 0;
  canvas.style.touchAction = 'none';
  const pointer = (kind: FrameworkPointerEvent['kind']) => (event: PointerEvent) => {
    if (!live) return;
    const rect = canvas.getBoundingClientRect(),
      metrics = view.currentMetrics;
    if (!rect.width || !rect.height) return;
    if (kind === 'down') {
      const keepInput =
        !options.ownsNativeSelectionTarget?.(event.target) &&
        options.ownsEditingTarget?.(canvas.ownerDocument.activeElement);
      if (keepInput) event.preventDefault();
      else canvas.focus({ preventScroll: true });
      if (!live) return;
      pointers.add(event.pointerId);
      if (!options.ownsNativeSelectionTarget?.(event.target) || event.button === 0)
        canvas.setPointerCapture(event.pointerId);
      if (!live) return;
    }
    view.dispatchPointer({
      kind: kind === 'move' && !pointers.has(event.pointerId) ? 'hover' : kind,
      pointer: event.pointerId,
      device:
        event.pointerType === 'mouse' ||
        event.pointerType === 'touch' ||
        event.pointerType === 'pen'
          ? event.pointerType
          : 'unknown',
      buttons: event.buttons,
      x: ((event.clientX - rect.left) * metrics.logicalWidth) / rect.width,
      y: ((event.clientY - rect.top) * metrics.logicalHeight) / rect.height,
      timestamp: event.timeStamp,
      viewportGeneration: metrics.viewportGeneration,
    });
    if (kind === 'up' || kind === 'cancel') {
      pointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }
  };
  const down = pointer('down'),
    move = pointer('move'),
    up = pointer('up'),
    cancel = pointer('cancel'),
    leave = pointer('leave');
  const lostCapture = (event: PointerEvent) => {
    if (pointers.has(event.pointerId)) cancel(event);
  };
  const nativePointer = (handler: (event: PointerEvent) => void) => (event: PointerEvent) => {
    if (options.ownsNativeSelectionTarget?.(event.target)) handler(event);
  };
  const nativeDown = nativePointer(down),
    nativeMove = nativePointer(move),
    nativeUp = nativePointer(up),
    nativeCancel = nativePointer(cancel),
    nativeLeave = nativePointer(leave);
  const wheel = (event: WheelEvent) => {
    if (!live) return;
    const rect = canvas.getBoundingClientRect(),
      metrics = view.currentMetrics,
      unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? metrics.logicalHeight : 1;
    view.dispatchPointer({
      kind: 'wheel',
      pointer: 0,
      device: 'mouse',
      buttons: 0,
      x: ((event.clientX - rect.left) * metrics.logicalWidth) / rect.width,
      y: ((event.clientY - rect.top) * metrics.logicalHeight) / rect.height,
      deltaX: event.deltaX * unit,
      deltaY: event.deltaY * unit,
      timestamp: event.timeStamp,
      viewportGeneration: metrics.viewportGeneration,
      respondToSignal: (allowPlatformDefault) => {
        if (!allowPlatformDefault) event.preventDefault();
      },
    });
  };
  const nativeWheel = (event: WheelEvent) => {
    if (options.ownsNativeSelectionTarget?.(event.target)) wheel(event);
  };
  const key = (event: KeyboardEvent) => {
    const target = event.target,
      editing = !!options.ownsEditingTarget?.(target);
    if (
      editing &&
      (event.isComposing ||
        (target instanceof HTMLElement && target.dataset.nelyxComposing === 'true'))
    )
      return;
    if (
      !live ||
      (target !== canvas &&
        !editing &&
        (!options.ownsSemanticsTarget?.(target) ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable)))
    )
      return;
    const capsLock = event.getModifierState('CapsLock'),
      numLock = event.getModifierState('NumLock'),
      scrollLock = event.getModifierState('ScrollLock');
    const handled = view.controller?.rawKey
      ? view.dispatchRawKey(
          Object.freeze({
            type: event.type,
            keymap: 'web',
            code: event.code,
            key: event.key,
            location: event.location,
            keyCode: event.keyCode,
            metaState:
              (event.shiftKey ? RawKeyEventDataWeb.modifierShift : 0) |
              (event.altKey ? RawKeyEventDataWeb.modifierAlt : 0) |
              (event.ctrlKey ? RawKeyEventDataWeb.modifierControl : 0) |
              (event.metaKey ? RawKeyEventDataWeb.modifierMeta : 0) |
              (numLock ? RawKeyEventDataWeb.modifierNumLock : 0) |
              (capsLock ? RawKeyEventDataWeb.modifierCapsLock : 0) |
              (scrollLock ? RawKeyEventDataWeb.modifierScrollLock : 0),
          }),
        )
      : /* oxlint-disable no-control-regex -- Control code points are deliberately matched for input validation or normalization. */
        view.dispatchKey({
          kind: event.type === 'keydown' ? 'down' : 'up',
          key: event.key,
          character:
            [...event.key].length === 1 && !/^[\x00-\x1f\x7f-\x9f]$/.test(event.key)
              ? event.key
              : null,
          code: event.code,
          location: event.location,
          timestamp: event.timeStamp,
          platform: 'web',
          locks: { capsLock, numLock, scrollLock },
          shift: event.shiftKey,
          control: event.ctrlKey,
          alt: event.altKey,
          meta: event.metaKey,
          repeat: event.repeat,
        });
    /* oxlint-enable no-control-regex */
    if (handled || (!editing && ['Tab', ' ', 'Enter'].includes(event.key))) event.preventDefault();
  };
  const focus = () => {
      if (live) view.dispatchKeyboardFocusGained();
    },
    blur = () => {
      if (live) view.dispatchKeyboardFocusLost();
    };
  canvas.addEventListener('focus', focus);
  canvas.addEventListener('blur', blur);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('lostpointercapture', lostCapture);
  canvas.addEventListener('wheel', wheel, { passive: false });
  keySurface.addEventListener('keydown', key, true);
  keySurface.addEventListener('keyup', key, true);
  keySurface.addEventListener('pointerdown', nativeDown, true);
  keySurface.addEventListener('pointermove', nativeMove, true);
  keySurface.addEventListener('pointerup', nativeUp, true);
  keySurface.addEventListener('pointercancel', nativeCancel, true);
  keySurface.addEventListener('pointerleave', nativeLeave, true);
  keySurface.addEventListener('wheel', nativeWheel, { capture: true, passive: false });
  return () => {
    if (!live) return;
    live = false;
    const errors: unknown[] = [];
    try {
      view.dispatchKeyboardFocusLost();
    } catch (error) {
      errors.push(error);
    }
    for (const pointer of pointers)
      try {
        if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
      } catch (error) {
        errors.push(error);
      }
    pointers.clear();
    canvas.removeEventListener('focus', focus);
    canvas.removeEventListener('blur', blur);
    keySurface.removeEventListener('pointerdown', nativeDown, true);
    keySurface.removeEventListener('pointermove', nativeMove, true);
    keySurface.removeEventListener('pointerup', nativeUp, true);
    keySurface.removeEventListener('pointercancel', nativeCancel, true);
    keySurface.removeEventListener('pointerleave', nativeLeave, true);
    keySurface.removeEventListener('wheel', nativeWheel, true);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel);
    canvas.removeEventListener('pointerleave', leave);
    canvas.removeEventListener('lostpointercapture', lostCapture);
    canvas.removeEventListener('wheel', wheel);
    keySurface.removeEventListener('keydown', key, true);
    keySurface.removeEventListener('keyup', key, true);
    if (errors.length) throw new AggregateError(errors, 'Canvas input cleanup failed');
  };
}
