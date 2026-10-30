// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { BuildContext } from './framework.ts';
import type { TickerProvider } from '../animation/ticker.ts';
import type { AxisDirection } from '../painting/basic-types.ts';
import type { SemanticsAction } from '../../ui/semantics-action.ts';
/** Each scroll owner supplies its actual View, notification ancestry and ticker provider. */
export abstract class ScrollContext {
  abstract get notificationContext(): BuildContext | null;
  abstract get storageContext(): BuildContext;
  abstract get vsync(): TickerProvider;
  abstract get axisDirection(): AxisDirection;
  abstract get devicePixelRatio(): number;
  abstract setIgnorePointer(value: boolean): void;
  abstract setCanDrag(value: boolean): void;
  abstract setSemanticsActions(actions: Set<SemanticsAction>): void;
  abstract saveOffset(offset: number): void;
}
