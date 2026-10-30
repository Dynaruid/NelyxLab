// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { protect } from '../../ui/value-math.ts';
import { hashValues } from '../painting/value-equality.ts';
export class ContextMenuButtonType {
  static readonly cut = new ContextMenuButtonType(0, 'cut');
  static readonly copy = new ContextMenuButtonType(1, 'copy');
  static readonly paste = new ContextMenuButtonType(2, 'paste');
  static readonly selectAll = new ContextMenuButtonType(3, 'selectAll');
  static readonly delete = new ContextMenuButtonType(4, 'delete');
  static readonly lookUp = new ContextMenuButtonType(5, 'lookUp');
  static readonly searchWeb = new ContextMenuButtonType(6, 'searchWeb');
  static readonly share = new ContextMenuButtonType(7, 'share');
  static readonly liveTextInput = new ContextMenuButtonType(8, 'liveTextInput');
  static readonly custom = new ContextMenuButtonType(9, 'custom');
  static readonly values = Object.freeze([
    this.cut,
    this.copy,
    this.paste,
    this.selectAll,
    this.delete,
    this.lookUp,
    this.searchWeb,
    this.share,
    this.liveTextInput,
    this.custom,
  ]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'ContextMenuButtonType.' + this.name;
  }
}
export interface ContextMenuButtonItemOptions {
  readonly onPressed: (() => void) | null;
  readonly type?: ContextMenuButtonType;
  readonly label?: string | null;
}
export class ContextMenuButtonItem {
  readonly onPressed: (() => void) | null;
  readonly type: ContextMenuButtonType;
  readonly label: string | null;
  constructor({
    onPressed,
    type = ContextMenuButtonType.custom,
    label = null,
  }: ContextMenuButtonItemOptions) {
    this.onPressed = onPressed;
    this.type = type;
    this.label = label;
    protect(this, ['onPressed', 'type', 'label']);
  }
  copyWith({
    onPressed,
    type,
    label,
  }: Partial<{
    readonly onPressed: (() => void) | null;
    readonly type: ContextMenuButtonType | null;
    readonly label: string | null;
  }> = {}): ContextMenuButtonItem {
    return new ContextMenuButtonItem({
      onPressed: onPressed ?? this.onPressed,
      type: type ?? this.type,
      label: label ?? this.label,
    });
  }
  equals(other: unknown): boolean {
    return (
      other instanceof ContextMenuButtonItem &&
      other.constructor === this.constructor &&
      other.label === this.label &&
      other.onPressed === this.onPressed &&
      other.type === this.type
    );
  }
  get hashCode(): number {
    return hashValues(this.label, this.onPressed, this.type);
  }
  toString(): string {
    return `ContextMenuButtonItem ${this.type}, ${this.label}`;
  }
}
