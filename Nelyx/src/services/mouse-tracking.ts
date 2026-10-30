// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type {
  PointerEnterEvent,
  PointerExitEvent,
  PointerHoverEvent,
} from '../framework/gestures/events.ts';
import type { MouseCursor } from './mouse-cursor.ts';
export type PointerRegionEvent = PointerEnterEvent | PointerExitEvent;
export type PointerEnterEventListener = (event: PointerEnterEvent) => void;
export type PointerExitEventListener = (event: PointerExitEvent) => void;
export type PointerHoverEventListener = (event: PointerHoverEvent) => void;
export interface MouseTrackerAnnotation {
  readonly validForMouseTracker: boolean;
  readonly cursor?: MouseCursor;
  readonly onEnter?: PointerEnterEventListener | undefined;
  readonly onExit?: PointerExitEventListener | undefined;
}
