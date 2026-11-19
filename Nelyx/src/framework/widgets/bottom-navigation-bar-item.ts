// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { Color } from '../../ui/color.ts';
import type { Widget } from './framework.ts';

export interface BottomNavigationBarItemOptions {
  readonly icon: Widget;
  readonly activeIcon?: Widget | null;
  readonly label?: string | null;
  readonly backgroundColor?: Color | null;
  readonly tooltip?: string | null;
  readonly semanticsLabel?: string | null;
}

export class BottomNavigationBarItem {
  readonly icon: Widget;
  readonly activeIcon: Widget;
  readonly label: string | null;
  readonly backgroundColor: Color | null;
  readonly tooltip: string | null;
  readonly semanticsLabel: string | null;

  constructor({
    icon,
    activeIcon = null,
    label = null,
    backgroundColor = null,
    tooltip = null,
    semanticsLabel = null,
  }: BottomNavigationBarItemOptions) {
    this.icon = icon;
    this.activeIcon = activeIcon ?? icon;
    this.label = label;
    this.backgroundColor = backgroundColor;
    this.tooltip = tooltip;
    this.semanticsLabel = semanticsLabel;
    Object.freeze(this);
  }
}
