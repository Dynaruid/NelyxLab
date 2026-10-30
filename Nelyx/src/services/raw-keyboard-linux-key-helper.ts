// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// KeyHelper/GLFWKeyHelper/GtkKeyHelper from pinned raw_keyboard_linux.dart.
import { LogicalKeyboardKey } from './keyboard-key.ts';
import type { KeyboardSide, ModifierKey } from './raw-keyboard-data.ts';
import {
  kGlfwNumpadMap,
  kGlfwToLogicalKey,
  kGtkNumpadMap,
  kGtkToLogicalKey,
} from './keyboard-platform-maps.ts';
import { FlutterError } from '../foundation/flutter-error.ts';
export interface KeyHelperModifierOptions {
  readonly side?: KeyboardSide;
  readonly keyCode: number;
  readonly isDown: boolean;
}
export abstract class KeyHelper {
  static forToolkit(toolkit: string): KeyHelper {
    if (toolkit === 'glfw') return new GLFWKeyHelper();
    if (toolkit === 'gtk') return new GtkKeyHelper();
    throw new FlutterError('Window toolkit not recognized: ' + toolkit);
  }
  abstract readonly debugToolkit: string;
  abstract getModifierSide(key: ModifierKey): KeyboardSide;
  abstract isModifierPressed(
    key: ModifierKey,
    modifiers: number,
    options: KeyHelperModifierOptions,
  ): boolean;
  abstract numpadKey(keyCode: number): LogicalKeyboardKey | undefined;
  abstract logicalKey(keyCode: number): LogicalKeyboardKey | undefined;
  abstract readonly platformPlane: number;
}
export class GLFWKeyHelper extends KeyHelper {
  static readonly modifierCapsLock = 0x0010;
  static readonly modifierShift = 0x0001;
  static readonly modifierControl = 0x0002;
  static readonly modifierAlt = 0x0004;
  static readonly modifierMeta = 0x0008;
  static readonly modifierNumericPad = 0x0020;
  get debugToolkit(): string {
    return 'GLFW';
  }
  get platformPlane(): number {
    return LogicalKeyboardKey.glfwPlane;
  }
  getModifierSide(_key: ModifierKey): KeyboardSide {
    return 'all';
  }
  private mergeModifiers(modifiers: number, keyCode: number, isDown: boolean): number {
    const C = GLFWKeyHelper;
    const change =
      keyCode === 340 || keyCode === 344
        ? C.modifierShift
        : keyCode === 341 || keyCode === 345
          ? C.modifierControl
          : keyCode === 342 || keyCode === 346
            ? C.modifierAlt
            : keyCode === 343 || keyCode === 347
              ? C.modifierMeta
              : keyCode === 280
                ? C.modifierCapsLock
                : keyCode === 282
                  ? C.modifierNumericPad
                  : 0;
    return isDown ? modifiers | change : modifiers & ~change;
  }
  isModifierPressed(
    key: ModifierKey,
    modifiers: number,
    { keyCode, isDown }: KeyHelperModifierOptions,
  ): boolean {
    const C = GLFWKeyHelper;
    modifiers = this.mergeModifiers(modifiers, keyCode, isDown);
    const mask = {
      controlModifier: C.modifierControl,
      shiftModifier: C.modifierShift,
      altModifier: C.modifierAlt,
      metaModifier: C.modifierMeta,
      capsLockModifier: C.modifierCapsLock,
      numLockModifier: C.modifierNumericPad,
      functionModifier: 0,
      symbolModifier: 0,
      scrollLockModifier: 0,
    }[key];
    return (modifiers & mask) !== 0;
  }
  numpadKey(code: number): LogicalKeyboardKey | undefined {
    return kGlfwNumpadMap.get(code);
  }
  logicalKey(code: number): LogicalKeyboardKey | undefined {
    return kGlfwToLogicalKey.get(code);
  }
}
export class GtkKeyHelper extends KeyHelper {
  static readonly modifierShift = 1 << 0;
  static readonly modifierCapsLock = 1 << 1;
  static readonly modifierControl = 1 << 2;
  static readonly modifierMod1 = 1 << 3;
  static readonly modifierMod2 = 1 << 4;
  static readonly modifierMeta = 1 << 26;
  get debugToolkit(): string {
    return 'GTK';
  }
  get platformPlane(): number {
    return LogicalKeyboardKey.gtkPlane;
  }
  getModifierSide(_key: ModifierKey): KeyboardSide {
    return 'all';
  }
  private mergeModifiers(modifiers: number, keyCode: number, isDown: boolean): number {
    const C = GtkKeyHelper;
    const change =
      keyCode === 0xffe1 || keyCode === 0xffe2
        ? C.modifierShift
        : keyCode === 0xffe3 || keyCode === 0xffe4
          ? C.modifierControl
          : keyCode === 0xffe9 || keyCode === 0xffea
            ? C.modifierMod1
            : keyCode === 0xffeb || keyCode === 0xffec
              ? C.modifierMeta
              : keyCode === 0xffe5 || keyCode === 0xffe6
                ? C.modifierCapsLock
                : keyCode === 0xff7f
                  ? C.modifierMod2
                  : 0;
    return isDown ? modifiers | change : modifiers & ~change;
  }
  isModifierPressed(
    key: ModifierKey,
    modifiers: number,
    { keyCode, isDown }: KeyHelperModifierOptions,
  ): boolean {
    const C = GtkKeyHelper;
    modifiers = this.mergeModifiers(modifiers, keyCode, isDown);
    const mask = {
      controlModifier: C.modifierControl,
      shiftModifier: C.modifierShift,
      altModifier: C.modifierMod1,
      metaModifier: C.modifierMeta,
      capsLockModifier: C.modifierCapsLock,
      numLockModifier: C.modifierMod2,
      functionModifier: 0,
      symbolModifier: 0,
      scrollLockModifier: 0,
    }[key];
    return (modifiers & mask) !== 0;
  }
  numpadKey(code: number): LogicalKeyboardKey | undefined {
    return kGtkNumpadMap.get(code);
  }
  logicalKey(code: number): LogicalKeyboardKey | undefined {
    return kGtkToLogicalKey.get(code);
  }
}
