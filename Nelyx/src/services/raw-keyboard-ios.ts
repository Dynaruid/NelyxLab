// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed port of services/raw_keyboard_ios.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {
  RawKeyEventData,
  rawInteger,
  rawText,
  rawKeyId,
  sealRawFields,
  sidePressed,
  modifierSide,
} from './raw-keyboard-data.ts';
import type { KeyboardSide, ModifierKey } from './raw-keyboard-data.ts';
import { LogicalKeyboardKey, PhysicalKeyboardKey } from './keyboard-key.ts';
import * as maps from './keyboard-platform-maps.ts';
function logical(id: number): LogicalKeyboardKey {
  return LogicalKeyboardKey.findKeyByKeyId(id) ?? new LogicalKeyboardKey(id);
}
function unprintable(label: string): boolean {
  return label.length === 1 && label.charCodeAt(0) >= 0xf700 && label.charCodeAt(0) <= 0xf8ff;
}
export interface RawKeyEventDataIosOptions {
  readonly characters?: string;
  readonly charactersIgnoringModifiers?: string;
  readonly keyCode?: number;
  readonly modifiers?: number;
}
export class RawKeyEventDataIos extends RawKeyEventData {
  readonly characters: string;
  readonly charactersIgnoringModifiers: string;
  readonly keyCode: number;
  readonly modifiers: number;
  constructor(options: RawKeyEventDataIosOptions = {}) {
    super();
    this.characters = rawText(options.characters === undefined ? '' : options.characters);
    this.charactersIgnoringModifiers = rawText(
      options.charactersIgnoringModifiers === undefined ? '' : options.charactersIgnoringModifiers,
    );
    this.keyCode = rawInteger(options.keyCode === undefined ? 0 : options.keyCode);
    this.modifiers = rawInteger(options.modifiers === undefined ? 0 : options.modifiers);
    sealRawFields(this, ['characters', 'charactersIgnoringModifiers', 'keyCode', 'modifiers']);
  }
  static readonly modifierCapsLock = 0x10000;
  static readonly modifierShift = 0x20000;
  static readonly modifierLeftShift = 0x02;
  static readonly modifierRightShift = 0x04;
  static readonly modifierControl = 0x40000;
  static readonly modifierLeftControl = 0x01;
  static readonly modifierRightControl = 0x2000;
  static readonly modifierOption = 0x80000;
  static readonly modifierLeftOption = 0x20;
  static readonly modifierRightOption = 0x40;
  static readonly modifierCommand = 0x100000;
  static readonly modifierLeftCommand = 0x08;
  static readonly modifierRightCommand = 0x10;
  static readonly modifierNumericPad = 0x200000;
  static readonly modifierHelp = 0x400000;
  static readonly modifierFunction = 0x800000;
  static readonly deviceIndependentMask = 0xffff0000;
  get keyLabel(): string {
    return this.charactersIgnoringModifiers;
  }
  get physicalKey(): PhysicalKeyboardKey {
    return (
      maps.kIosToPhysicalKey.get(this.keyCode) ??
      new PhysicalKeyboardKey(LogicalKeyboardKey.iosPlane + this.keyCode)
    );
  }
  get logicalKey(): LogicalKeyboardKey {
    const pad = maps.kIosNumPadMap.get(this.keyCode);
    if (pad) return pad;
    const special = maps.kIosSpecialLogicalMap.get(this.keyLabel);
    if (special) return special;
    const known = maps.kIosToLogicalKey.get(this.keyCode);
    if (known) return known;
    if (
      this.keyLabel &&
      !LogicalKeyboardKey.isControlCharacter(this.keyLabel) &&
      !unprintable(this.keyLabel)
    ) {
      if (this.keyLabel.length > 2)
        throw new RangeError('Raw iOS key label exceeds two UTF-16 units');
      const packed =
        this.keyLabel.length === 2
          ? this.keyLabel.charCodeAt(0) * 0x10000 + this.keyLabel.charCodeAt(1)
          : this.keyLabel.charCodeAt(0);
      return logical(rawKeyId(LogicalKeyboardKey.unicodePlane, packed));
    }
    return logical(rawKeyId(LogicalKeyboardKey.iosPlane, this.keyCode));
  }
  isModifierPressed(
    key: ModifierKey,
    { side = 'any' }: { readonly side?: KeyboardSide } = {},
  ): boolean {
    switch (key) {
      case 'controlModifier':
        return sidePressed(
          this.modifiers,
          side,
          this.modifiers &
            RawKeyEventDataIos.deviceIndependentMask &
            RawKeyEventDataIos.modifierControl,
          RawKeyEventDataIos.modifierLeftControl,
          RawKeyEventDataIos.modifierRightControl,
          'apple',
        );
      case 'shiftModifier':
        return sidePressed(
          this.modifiers,
          side,
          this.modifiers &
            RawKeyEventDataIos.deviceIndependentMask &
            RawKeyEventDataIos.modifierShift,
          RawKeyEventDataIos.modifierLeftShift,
          RawKeyEventDataIos.modifierRightShift,
          'apple',
        );
      case 'altModifier':
        return sidePressed(
          this.modifiers,
          side,
          this.modifiers &
            RawKeyEventDataIos.deviceIndependentMask &
            RawKeyEventDataIos.modifierOption,
          RawKeyEventDataIos.modifierLeftOption,
          RawKeyEventDataIos.modifierRightOption,
          'apple',
        );
      case 'metaModifier':
        return sidePressed(
          this.modifiers,
          side,
          this.modifiers &
            RawKeyEventDataIos.deviceIndependentMask &
            RawKeyEventDataIos.modifierCommand,
          RawKeyEventDataIos.modifierLeftCommand,
          RawKeyEventDataIos.modifierRightCommand,
          'apple',
        );
      case 'capsLockModifier':
        return (this.modifiers & RawKeyEventDataIos.modifierCapsLock) !== 0;
      case 'numLockModifier':
        return false;
      case 'scrollLockModifier':
        return false;
      case 'functionModifier':
        return false;
      case 'symbolModifier':
        return false;
    }
  }
  getModifierSide(key: ModifierKey): KeyboardSide | null {
    switch (key) {
      case 'controlModifier':
        return modifierSide(
          this.modifiers,
          RawKeyEventDataIos.modifierControl,
          RawKeyEventDataIos.modifierLeftControl,
          RawKeyEventDataIos.modifierRightControl,
          'windows',
        );
      case 'shiftModifier':
        return modifierSide(
          this.modifiers,
          RawKeyEventDataIos.modifierShift,
          RawKeyEventDataIos.modifierLeftShift,
          RawKeyEventDataIos.modifierRightShift,
          'windows',
        );
      case 'altModifier':
        return modifierSide(
          this.modifiers,
          RawKeyEventDataIos.modifierOption,
          RawKeyEventDataIos.modifierLeftOption,
          RawKeyEventDataIos.modifierRightOption,
          'windows',
        );
      case 'metaModifier':
        return modifierSide(
          this.modifiers,
          RawKeyEventDataIos.modifierCommand,
          RawKeyEventDataIos.modifierLeftCommand,
          RawKeyEventDataIos.modifierRightCommand,
          'windows',
        );
      case 'capsLockModifier':
        return 'all';
      case 'numLockModifier':
        return 'all';
      case 'scrollLockModifier':
        return 'all';
      case 'functionModifier':
        return 'all';
      case 'symbolModifier':
        return 'all';
    }
  }
  protected get equalityValues(): readonly unknown[] {
    return [this.characters, this.charactersIgnoringModifiers, this.keyCode, this.modifiers];
  }
  protected get diagnosticFields(): Readonly<Record<string, unknown>> {
    return {
      characters: this.characters,
      charactersIgnoringModifiers: this.charactersIgnoringModifiers,
      keyCode: this.keyCode,
      modifiers: this.modifiers,
    };
  }
}
