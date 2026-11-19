// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { Color } from '../../ui/color.ts';
import type { Key } from '../../foundation/key.ts';
import type { Widget } from './framework.ts';

export interface BottomNavigationBarItemOptions {
  readonly key?: Key | null;
  readonly icon: Widget;
  readonly activeIcon?: Widget | null;
  readonly label?: string | null;
  readonly backgroundColor?: Color | null;
  readonly tooltip?: string | null;
  readonly semanticsLabel?: string | null;
}

export class BottomNavigationBarItem {
  readonly key: Key | null;
  readonly icon: Widget;
  readonly activeIcon: Widget;
  readonly label: string | null;
  readonly backgroundColor: Color | null;
  readonly tooltip: string | null;
  readonly semanticsLabel: string | null;

  constructor({
    key = null,
    icon,
    activeIcon = null,
    label = null,
    backgroundColor = null,
    tooltip = null,
    semanticsLabel = null,
  }: BottomNavigationBarItemOptions) {
    this.key = key;
    this.icon = icon;
    this.activeIcon = activeIcon ?? icon;
    this.label = label;
    this.backgroundColor = backgroundColor;
    this.tooltip = tooltip;
    this.semanticsLabel = semanticsLabel;
    Object.freeze(this);
  }
}
