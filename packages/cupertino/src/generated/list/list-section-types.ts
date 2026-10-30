// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Managed resolved public API projection; behavior uses canonical Core owners.
export class CupertinoListSectionType {
  static readonly base = new CupertinoListSectionType(0, 'base');
  static readonly insetGrouped = new CupertinoListSectionType(1, 'insetGrouped');
  static readonly values: readonly CupertinoListSectionType[] = Object.freeze([
    CupertinoListSectionType.base,
    CupertinoListSectionType.insetGrouped,
  ]);
  /** @dartType int */ readonly index: number;
  readonly name: string;
  private constructor(index: number, name: string) {
    this.index = index;
    this.name = name;
    Object.freeze(this);
  }
  toString(): string {
    return 'CupertinoListSectionType.' + this.name;
  }
}
