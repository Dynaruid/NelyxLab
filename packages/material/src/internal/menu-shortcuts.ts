// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from packages/flutter/lib/src/material/menu_anchor.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { CharacterActivator, SingleActivator } from '@nelyx/core/framework/widgets/shortcuts';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { usesSymbolicMenuModifiers } from '../menu-accelerator-label.ts';
import type { MaterialLocalizations } from '../material-localizations.ts';
import type { MenuKeyboardLabel } from './menu-keyboard-labels.ts';

export interface MenuShortcutSerialization {
  readonly trigger?: LogicalKeyboardKey | null;
  readonly character?: string | null;
  readonly control?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
  readonly meta?: boolean;
}

export type MenuSerializableShortcut =
  | SingleActivator
  | CharacterActivator
  | { serializeForMenu(): MenuShortcutSerialization };

const names: ReadonlyMap<number, MenuKeyboardLabel> = new Map([
  [LogicalKeyboardKey.altGraph.keyId, 'keyboardKeyAltGraph'],
  [LogicalKeyboardKey.backspace.keyId, 'keyboardKeyBackspace'],
  [LogicalKeyboardKey.capsLock.keyId, 'keyboardKeyCapsLock'],
  [LogicalKeyboardKey.channelDown.keyId, 'keyboardKeyChannelDown'],
  [LogicalKeyboardKey.channelUp.keyId, 'keyboardKeyChannelUp'],
  [LogicalKeyboardKey.delete.keyId, 'keyboardKeyDelete'],
  [LogicalKeyboardKey.eject.keyId, 'keyboardKeyEject'],
  [LogicalKeyboardKey.end.keyId, 'keyboardKeyEnd'],
  [LogicalKeyboardKey.escape.keyId, 'keyboardKeyEscape'],
  [LogicalKeyboardKey.fn.keyId, 'keyboardKeyFn'],
  [LogicalKeyboardKey.home.keyId, 'keyboardKeyHome'],
  [LogicalKeyboardKey.insert.keyId, 'keyboardKeyInsert'],
  [LogicalKeyboardKey.numLock.keyId, 'keyboardKeyNumLock'],
  [LogicalKeyboardKey.numpad0.keyId, 'keyboardKeyNumpad0'],
  [LogicalKeyboardKey.numpad1.keyId, 'keyboardKeyNumpad1'],
  [LogicalKeyboardKey.numpad2.keyId, 'keyboardKeyNumpad2'],
  [LogicalKeyboardKey.numpad3.keyId, 'keyboardKeyNumpad3'],
  [LogicalKeyboardKey.numpad4.keyId, 'keyboardKeyNumpad4'],
  [LogicalKeyboardKey.numpad5.keyId, 'keyboardKeyNumpad5'],
  [LogicalKeyboardKey.numpad6.keyId, 'keyboardKeyNumpad6'],
  [LogicalKeyboardKey.numpad7.keyId, 'keyboardKeyNumpad7'],
  [LogicalKeyboardKey.numpad8.keyId, 'keyboardKeyNumpad8'],
  [LogicalKeyboardKey.numpad9.keyId, 'keyboardKeyNumpad9'],
  [LogicalKeyboardKey.numpadAdd.keyId, 'keyboardKeyNumpadAdd'],
  [LogicalKeyboardKey.numpadComma.keyId, 'keyboardKeyNumpadComma'],
  [LogicalKeyboardKey.numpadDecimal.keyId, 'keyboardKeyNumpadDecimal'],
  [LogicalKeyboardKey.numpadDivide.keyId, 'keyboardKeyNumpadDivide'],
  [LogicalKeyboardKey.numpadEnter.keyId, 'keyboardKeyNumpadEnter'],
  [LogicalKeyboardKey.numpadEqual.keyId, 'keyboardKeyNumpadEqual'],
  [LogicalKeyboardKey.numpadMultiply.keyId, 'keyboardKeyNumpadMultiply'],
  [LogicalKeyboardKey.numpadParenLeft.keyId, 'keyboardKeyNumpadParenLeft'],
  [LogicalKeyboardKey.numpadParenRight.keyId, 'keyboardKeyNumpadParenRight'],
  [LogicalKeyboardKey.numpadSubtract.keyId, 'keyboardKeyNumpadSubtract'],
  [LogicalKeyboardKey.pageDown.keyId, 'keyboardKeyPageDown'],
  [LogicalKeyboardKey.pageUp.keyId, 'keyboardKeyPageUp'],
  [LogicalKeyboardKey.power.keyId, 'keyboardKeyPower'],
  [LogicalKeyboardKey.powerOff.keyId, 'keyboardKeyPowerOff'],
  [LogicalKeyboardKey.printScreen.keyId, 'keyboardKeyPrintScreen'],
  [LogicalKeyboardKey.scrollLock.keyId, 'keyboardKeyScrollLock'],
  [LogicalKeyboardKey.select.keyId, 'keyboardKeySelect'],
  [LogicalKeyboardKey.space.keyId, 'keyboardKeySpace'],
]);
const graphical = new Map([
  [LogicalKeyboardKey.arrowLeft.keyId, '←'],
  [LogicalKeyboardKey.arrowRight.keyId, '→'],
  [LogicalKeyboardKey.arrowUp.keyId, '↑'],
  [LogicalKeyboardKey.arrowDown.keyId, '↓'],
  [LogicalKeyboardKey.enter.keyId, '↵'],
]);

function keyLabel(key: LogicalKeyboardKey, localization: MaterialLocalizations): string {
  const arrow = graphical.get(key.keyId);
  if (arrow) return arrow;
  const localized = names.get(key.keyId);
  if (localized) return localization.keyboardKeyLabel(localized);
  return key.keyId <= 0x10ffff ? String.fromCodePoint(key.keyId).toUpperCase() : key.keyLabel;
}

export function menuShortcutLabel(
  shortcut: MenuSerializableShortcut,
  localization: MaterialLocalizations,
): string {
  const spec =
    shortcut instanceof SingleActivator || shortcut instanceof CharacterActivator
      ? shortcut
      : shortcut.serializeForMenu();
  const symbolic = usesSymbolicMenuModifiers();
  const { control, alt, meta } = spec;
  const trigger = 'trigger' in spec ? spec.trigger : null;
  const character = 'character' in spec ? spec.character : null;
  const shift = 'shift' in spec && spec.shift && trigger;
  const labels: string[] = [];
  if (symbolic) {
    if (control) labels.push('⌃');
    if (alt) labels.push('⌥');
    if (shift) labels.push('⇧');
    if (meta) labels.push('⌘');
  } else {
    if (alt) labels.push(localization.keyboardKeyLabel('keyboardKeyAlt'));
    if (control) labels.push(localization.keyboardKeyLabel('keyboardKeyControl'));
    if (meta)
      labels.push(
        localization.keyboardKeyLabel(
          FoundationPlatform.defaultTargetPlatform === 'windows'
            ? 'keyboardKeyMetaWindows'
            : 'keyboardKeyMeta',
        ),
      );
    if (shift) labels.push(localization.keyboardKeyLabel('keyboardKeyShift'));
  }
  const label = trigger ? keyLabel(trigger, localization) : character;
  if (label) labels.push(label);
  return labels.join(symbolic ? ' ' : '+');
}
