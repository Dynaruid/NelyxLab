// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Value contracts from pinned dart:ui semantics.dart. Engine update submission is separate.
import { protect } from './value-math.ts';
import { invariant } from '../foundation/errors.ts';
import { FoundationBuildMode } from '../foundation/constants.ts';
import type { Rect } from './rect.ts';
import type { StringAttribute } from './string-attribute.ts';
import type { Locale } from './locale.ts';
import { hashValues } from '../framework/painting/value-equality.ts';
export class SemanticsFlag {
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  static readonly hasCheckedState = new SemanticsFlag(2 ** 0, 'hasCheckedState');
  static readonly isChecked = new SemanticsFlag(2 ** 1, 'isChecked');
  static readonly isCheckStateMixed = new SemanticsFlag(2 ** 25, 'isCheckStateMixed');
  static readonly hasSelectedState = new SemanticsFlag(2 ** 28, 'hasSelectedState');
  static readonly isSelected = new SemanticsFlag(2 ** 2, 'isSelected');
  static readonly isButton = new SemanticsFlag(2 ** 3, 'isButton');
  static readonly isTextField = new SemanticsFlag(2 ** 4, 'isTextField');
  static readonly isSlider = new SemanticsFlag(2 ** 23, 'isSlider');
  static readonly isKeyboardKey = new SemanticsFlag(2 ** 24, 'isKeyboardKey');
  static readonly isReadOnly = new SemanticsFlag(2 ** 20, 'isReadOnly');
  static readonly isLink = new SemanticsFlag(2 ** 22, 'isLink');
  static readonly isFocusable = new SemanticsFlag(2 ** 21, 'isFocusable');
  static readonly isFocused = new SemanticsFlag(2 ** 5, 'isFocused');
  static readonly hasEnabledState = new SemanticsFlag(2 ** 6, 'hasEnabledState');
  static readonly isEnabled = new SemanticsFlag(2 ** 7, 'isEnabled');
  static readonly isInMutuallyExclusiveGroup = new SemanticsFlag(
    2 ** 8,
    'isInMutuallyExclusiveGroup',
  );
  static readonly isHeader = new SemanticsFlag(2 ** 9, 'isHeader');
  static readonly isObscured = new SemanticsFlag(2 ** 10, 'isObscured');
  static readonly isMultiline = new SemanticsFlag(2 ** 19, 'isMultiline');
  static readonly scopesRoute = new SemanticsFlag(2 ** 11, 'scopesRoute');
  static readonly namesRoute = new SemanticsFlag(2 ** 12, 'namesRoute');
  static readonly isHidden = new SemanticsFlag(2 ** 13, 'isHidden');
  static readonly isImage = new SemanticsFlag(2 ** 14, 'isImage');
  static readonly isLiveRegion = new SemanticsFlag(2 ** 15, 'isLiveRegion');
  static readonly hasToggledState = new SemanticsFlag(2 ** 16, 'hasToggledState');
  static readonly isToggled = new SemanticsFlag(2 ** 17, 'isToggled');
  static readonly hasImplicitScrolling = new SemanticsFlag(2 ** 18, 'hasImplicitScrolling');
  static readonly hasExpandedState = new SemanticsFlag(2 ** 26, 'hasExpandedState');
  static readonly isExpanded = new SemanticsFlag(2 ** 27, 'isExpanded');
  static readonly hasRequiredState = new SemanticsFlag(2 ** 29, 'hasRequiredState');
  static readonly isRequired = new SemanticsFlag(2 ** 30, 'isRequired');
  private static readonly byIndex = new Map<number, SemanticsFlag>(
    [
      SemanticsFlag.hasCheckedState,
      SemanticsFlag.isChecked,
      SemanticsFlag.hasSelectedState,
      SemanticsFlag.isSelected,
      SemanticsFlag.isButton,
      SemanticsFlag.isTextField,
      SemanticsFlag.isFocused,
      SemanticsFlag.hasEnabledState,
      SemanticsFlag.isEnabled,
      SemanticsFlag.isInMutuallyExclusiveGroup,
      SemanticsFlag.isHeader,
      SemanticsFlag.isObscured,
      SemanticsFlag.scopesRoute,
      SemanticsFlag.namesRoute,
      SemanticsFlag.isHidden,
      SemanticsFlag.isImage,
      SemanticsFlag.isLiveRegion,
      SemanticsFlag.hasToggledState,
      SemanticsFlag.isToggled,
      SemanticsFlag.hasImplicitScrolling,
      SemanticsFlag.isMultiline,
      SemanticsFlag.isReadOnly,
      SemanticsFlag.isFocusable,
      SemanticsFlag.isLink,
      SemanticsFlag.isSlider,
      SemanticsFlag.isKeyboardKey,
      SemanticsFlag.isCheckStateMixed,
      SemanticsFlag.hasExpandedState,
      SemanticsFlag.isExpanded,
      SemanticsFlag.hasRequiredState,
      SemanticsFlag.isRequired,
    ].map((value) => [value.index, value]),
  );
  static get values(): SemanticsFlag[] {
    const values = Object.seal([...this.byIndex.values()]);
    Object.defineProperty(values, 'length', { writable: false });
    return values;
  }
  static fromIndex(index: number): SemanticsFlag | null {
    return this.byIndex.get(index) ?? null;
  }
  toString(): string {
    return `SemanticsFlag.${this.name}`;
  }
}
export const SemanticsRole = Object.freeze({
  none: 'none',
  tab: 'tab',
  tabBar: 'tabBar',
  tabPanel: 'tabPanel',
  dialog: 'dialog',
  alertDialog: 'alertDialog',
  table: 'table',
  cell: 'cell',
  row: 'row',
  columnHeader: 'columnHeader',
  dragHandle: 'dragHandle',
  spinButton: 'spinButton',
  comboBox: 'comboBox',
  menuBar: 'menuBar',
  menu: 'menu',
  menuItem: 'menuItem',
  menuItemCheckbox: 'menuItemCheckbox',
  menuItemRadio: 'menuItemRadio',
  list: 'list',
  listItem: 'listItem',
  form: 'form',
  tooltip: 'tooltip',
  loadingSpinner: 'loadingSpinner',
  progressBar: 'progressBar',
  hotKey: 'hotKey',
  radioGroup: 'radioGroup',
  status: 'status',
  alert: 'alert',
  complementary: 'complementary',
  contentInfo: 'contentInfo',
  main: 'main',
  navigation: 'navigation',
  region: 'region',
  slider: 'slider',
} as const);
export type SemanticsRole = (typeof SemanticsRole)[keyof typeof SemanticsRole];
export const SemanticsInputType = Object.freeze({
  none: 'none',
  text: 'text',
  url: 'url',
  phone: 'phone',
  search: 'search',
  email: 'email',
} as const);
export type SemanticsInputType = (typeof SemanticsInputType)[keyof typeof SemanticsInputType];
export const SemanticsHitTestBehavior = Object.freeze({
  defer: 'defer',
  opaque: 'opaque',
  transparent: 'transparent',
} as const);
export type SemanticsHitTestBehavior =
  (typeof SemanticsHitTestBehavior)[keyof typeof SemanticsHitTestBehavior];
export const SemanticsValidationResult = Object.freeze({
  none: 'none',
  valid: 'valid',
  invalid: 'invalid',
} as const);
export type SemanticsValidationResult =
  (typeof SemanticsValidationResult)[keyof typeof SemanticsValidationResult];
export class CheckedState {
  private constructor(
    readonly index: number,
    readonly name: string,
    readonly value: number,
  ) {
    Object.freeze(this);
  }
  static readonly none = new CheckedState(0, 'none', 0);
  static readonly isTrue = new CheckedState(1, 'isTrue', 1);
  static readonly isFalse = new CheckedState(2, 'isFalse', 2);
  static readonly mixed = new CheckedState(3, 'mixed', 3);
  static readonly values = Object.freeze([
    CheckedState.none,
    CheckedState.isTrue,
    CheckedState.isFalse,
    CheckedState.mixed,
  ]);
  hasConflict(other: CheckedState): boolean {
    return this !== CheckedState.none && other !== CheckedState.none;
  }
  merge(other: CheckedState): CheckedState {
    for (const value of [CheckedState.mixed, CheckedState.isTrue, CheckedState.isFalse])
      if (this === value || other === value) return value;
    return CheckedState.none;
  }
  toString(): string {
    return 'CheckedState.' + this.name;
  }
}
export class Tristate {
  private constructor(
    readonly index: number,
    readonly name: string,
    readonly value: number,
  ) {
    Object.freeze(this);
  }
  static readonly none = new Tristate(0, 'none', 0);
  static readonly isTrue = new Tristate(1, 'isTrue', 1);
  static readonly isFalse = new Tristate(2, 'isFalse', 2);
  static readonly values = Object.freeze([Tristate.none, Tristate.isTrue, Tristate.isFalse]);
  hasConflict(other: Tristate): boolean {
    return this !== Tristate.none && other !== Tristate.none;
  }
  merge(other: Tristate): Tristate {
    if (this === Tristate.isTrue || other === Tristate.isTrue) return Tristate.isTrue;
    if (this === Tristate.isFalse || other === Tristate.isFalse) return Tristate.isFalse;
    return Tristate.none;
  }
  toBoolOrNull(): boolean | null {
    return this === Tristate.none ? null : this === Tristate.isTrue;
  }
  toString(): string {
    return 'Tristate.' + this.name;
  }
}
export interface SemanticsFlagsOptions {
  readonly isChecked?: CheckedState;
  readonly isSelected?: Tristate;
  readonly isEnabled?: Tristate;
  readonly isToggled?: Tristate;
  readonly isExpanded?: Tristate;
  readonly isRequired?: Tristate;
  readonly isFocused?: Tristate;
  readonly isAccessibilityFocusBlocked?: boolean;
  readonly isButton?: boolean;
  readonly isTextField?: boolean;
  readonly isInMutuallyExclusiveGroup?: boolean;
  readonly isHeader?: boolean;
  readonly isObscured?: boolean;
  readonly scopesRoute?: boolean;
  readonly namesRoute?: boolean;
  readonly isHidden?: boolean;
  readonly isImage?: boolean;
  readonly isLiveRegion?: boolean;
  readonly hasImplicitScrolling?: boolean;
  readonly isMultiline?: boolean;
  readonly isReadOnly?: boolean;
  readonly isLink?: boolean;
  readonly isSlider?: boolean;
  readonly isKeyboardKey?: boolean;
}
export type SemanticsFlagsCopyOptions = {
  readonly [Key in keyof SemanticsFlagsOptions]?: SemanticsFlagsOptions[Key] | null;
};
const flagFields = [
  'isChecked',
  'isSelected',
  'isEnabled',
  'isToggled',
  'isExpanded',
  'isRequired',
  'isFocused',
  'isAccessibilityFocusBlocked',
  'isButton',
  'isTextField',
  'isInMutuallyExclusiveGroup',
  'isHeader',
  'isObscured',
  'scopesRoute',
  'namesRoute',
  'isHidden',
  'isImage',
  'isLiveRegion',
  'hasImplicitScrolling',
  'isMultiline',
  'isReadOnly',
  'isLink',
  'isSlider',
  'isKeyboardKey',
] as const;
export type SemanticsFlagName = (typeof flagFields)[number];
/** @internal A configuration owns one validated 31-bit state, separate from
 * the legacy engine flag mask. Public SemanticsFlags keep their field shape. */
export type SemanticsFlagWord = number & { readonly __semanticsFlagWord: unique symbol };
interface FlagPacking {
  readonly shift: number;
  readonly mask: number;
  readonly states: readonly (CheckedState | Tristate)[] | null;
}
const ownedFlagWords = new WeakMap<SemanticsFlags, SemanticsFlagWord>();
const flagPacking = Object.create(null) as Record<SemanticsFlagName, FlagPacking>;
let flagShift = 0;
for (let index = 0; index < flagFields.length; index++) {
  const width = index < 7 ? 2 : 1;
  flagPacking[flagFields[index]!] = Object.freeze({
    shift: flagShift,
    mask: (2 ** width - 1) << flagShift,
    states: index === 0 ? CheckedState.values : index < 7 ? Tristate.values : null,
  });
  flagShift += width;
}
Object.freeze(flagPacking);
function flagScalar(packing: FlagPacking, value: unknown): number | null {
  if (packing.states === null) return typeof value === 'boolean' ? Number(value) : null;
  for (let index = 0; index < packing.states.length; index++)
    if (value === packing.states[index]) return index;
  return null;
}
function captureFlagWord(value: SemanticsFlags): SemanticsFlagWord | null {
  let word = 0;
  for (const name of flagFields) {
    const packing = flagPacking[name],
      scalar = flagScalar(packing, value[name]);
    if (scalar === null) return null;
    word |= scalar << packing.shift;
  }
  return word as SemanticsFlagWord;
}
export class SemanticsFlags {
  readonly isChecked: CheckedState;
  readonly isSelected: Tristate;
  readonly isEnabled: Tristate;
  readonly isToggled: Tristate;
  readonly isExpanded: Tristate;
  readonly isRequired: Tristate;
  readonly isFocused: Tristate;
  readonly isAccessibilityFocusBlocked: boolean;
  readonly isButton: boolean;
  readonly isTextField: boolean;
  readonly isInMutuallyExclusiveGroup: boolean;
  readonly isHeader: boolean;
  readonly isObscured: boolean;
  readonly scopesRoute: boolean;
  readonly namesRoute: boolean;
  readonly isHidden: boolean;
  readonly isImage: boolean;
  readonly isLiveRegion: boolean;
  readonly hasImplicitScrolling: boolean;
  readonly isMultiline: boolean;
  readonly isReadOnly: boolean;
  readonly isLink: boolean;
  readonly isSlider: boolean;
  readonly isKeyboardKey: boolean;
  constructor(options: SemanticsFlagsOptions = {}) {
    this.isChecked = options.isChecked === undefined ? CheckedState.none : options.isChecked;
    this.isSelected = options.isSelected === undefined ? Tristate.none : options.isSelected;
    this.isEnabled = options.isEnabled === undefined ? Tristate.none : options.isEnabled;
    this.isToggled = options.isToggled === undefined ? Tristate.none : options.isToggled;
    this.isExpanded = options.isExpanded === undefined ? Tristate.none : options.isExpanded;
    this.isRequired = options.isRequired === undefined ? Tristate.none : options.isRequired;
    this.isFocused = options.isFocused === undefined ? Tristate.none : options.isFocused;
    this.isAccessibilityFocusBlocked =
      options.isAccessibilityFocusBlocked === undefined
        ? false
        : options.isAccessibilityFocusBlocked;
    this.isButton = options.isButton === undefined ? false : options.isButton;
    this.isTextField = options.isTextField === undefined ? false : options.isTextField;
    this.isInMutuallyExclusiveGroup =
      options.isInMutuallyExclusiveGroup === undefined ? false : options.isInMutuallyExclusiveGroup;
    this.isHeader = options.isHeader === undefined ? false : options.isHeader;
    this.isObscured = options.isObscured === undefined ? false : options.isObscured;
    this.scopesRoute = options.scopesRoute === undefined ? false : options.scopesRoute;
    this.namesRoute = options.namesRoute === undefined ? false : options.namesRoute;
    this.isHidden = options.isHidden === undefined ? false : options.isHidden;
    this.isImage = options.isImage === undefined ? false : options.isImage;
    this.isLiveRegion = options.isLiveRegion === undefined ? false : options.isLiveRegion;
    this.hasImplicitScrolling =
      options.hasImplicitScrolling === undefined ? false : options.hasImplicitScrolling;
    this.isMultiline = options.isMultiline === undefined ? false : options.isMultiline;
    this.isReadOnly = options.isReadOnly === undefined ? false : options.isReadOnly;
    this.isLink = options.isLink === undefined ? false : options.isLink;
    this.isSlider = options.isSlider === undefined ? false : options.isSlider;
    this.isKeyboardKey = options.isKeyboardKey === undefined ? false : options.isKeyboardKey;
    for (const name of flagFields) {
      const value = this[name];
      const valid =
        name === 'isChecked'
          ? value instanceof CheckedState
          : name === 'isSelected' ||
              name === 'isEnabled' ||
              name === 'isToggled' ||
              name === 'isExpanded' ||
              name === 'isRequired' ||
              name === 'isFocused'
            ? value instanceof Tristate
            : typeof value === 'boolean';
      if (!valid)
        invariant(false, 'invalid-semantics-flag', 'Semantics flags require typed state values');
    }
    if (new.target === SemanticsFlags) {
      Object.freeze(this);
      const word = captureFlagWord(this);
      if (word !== null) ownedFlagWords.set(this, word);
    } else protect(this, flagFields);
  }
  static none = new SemanticsFlags();
  merge(other: SemanticsFlags): SemanticsFlags {
    return new SemanticsFlags({
      isChecked: this.isChecked.merge(other.isChecked),
      isSelected: this.isSelected.merge(other.isSelected),
      isEnabled: this.isEnabled.merge(other.isEnabled),
      isToggled: this.isToggled.merge(other.isToggled),
      isExpanded: this.isExpanded.merge(other.isExpanded),
      isRequired: this.isRequired.merge(other.isRequired),
      isFocused: this.isFocused.merge(other.isFocused),
      isAccessibilityFocusBlocked:
        this.isAccessibilityFocusBlocked || other.isAccessibilityFocusBlocked,
      isButton: this.isButton || other.isButton,
      isTextField: this.isTextField || other.isTextField,
      isInMutuallyExclusiveGroup:
        this.isInMutuallyExclusiveGroup || other.isInMutuallyExclusiveGroup,
      isHeader: this.isHeader || other.isHeader,
      isObscured: this.isObscured || other.isObscured,
      scopesRoute: this.scopesRoute || other.scopesRoute,
      namesRoute: this.namesRoute || other.namesRoute,
      isHidden: this.isHidden || other.isHidden,
      isImage: this.isImage || other.isImage,
      isLiveRegion: this.isLiveRegion || other.isLiveRegion,
      hasImplicitScrolling: this.hasImplicitScrolling || other.hasImplicitScrolling,
      isMultiline: this.isMultiline || other.isMultiline,
      isReadOnly: this.isReadOnly || other.isReadOnly,
      isLink: this.isLink || other.isLink,
      isSlider: this.isSlider || other.isSlider,
      isKeyboardKey: this.isKeyboardKey || other.isKeyboardKey,
    });
  }
  copyWith(options: SemanticsFlagsCopyOptions = {}): SemanticsFlags {
    return new SemanticsFlags({
      isChecked: options.isChecked ?? this.isChecked,
      isSelected: options.isSelected ?? this.isSelected,
      isEnabled: options.isEnabled ?? this.isEnabled,
      isToggled: options.isToggled ?? this.isToggled,
      isExpanded: options.isExpanded ?? this.isExpanded,
      isRequired: options.isRequired ?? this.isRequired,
      isFocused: options.isFocused ?? this.isFocused,
      isAccessibilityFocusBlocked:
        options.isAccessibilityFocusBlocked ?? this.isAccessibilityFocusBlocked,
      isButton: options.isButton ?? this.isButton,
      isTextField: options.isTextField ?? this.isTextField,
      isInMutuallyExclusiveGroup:
        options.isInMutuallyExclusiveGroup ?? this.isInMutuallyExclusiveGroup,
      isHeader: options.isHeader ?? this.isHeader,
      isObscured: options.isObscured ?? this.isObscured,
      scopesRoute: options.scopesRoute ?? this.scopesRoute,
      namesRoute: options.namesRoute ?? this.namesRoute,
      isHidden: options.isHidden ?? this.isHidden,
      isImage: options.isImage ?? this.isImage,
      isLiveRegion: options.isLiveRegion ?? this.isLiveRegion,
      hasImplicitScrolling: options.hasImplicitScrolling ?? this.hasImplicitScrolling,
      isMultiline: options.isMultiline ?? this.isMultiline,
      isReadOnly: options.isReadOnly ?? this.isReadOnly,
      isLink: options.isLink ?? this.isLink,
      isSlider: options.isSlider ?? this.isSlider,
      isKeyboardKey: options.isKeyboardKey ?? this.isKeyboardKey,
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof SemanticsFlags &&
        this.constructor === other.constructor &&
        flagFields.every((name) => this[name] === other[name]))
    );
  }
  get hashCode(): number {
    return hashValues(...flagFields.map((name) => this[name]));
  }
  toStrings(): string[] {
    return [
      ...(this.isChecked != CheckedState.none ? ['hasCheckedState'] : []),
      ...(this.isChecked == CheckedState.isTrue ? ['isChecked'] : []),
      ...(this.isSelected == Tristate.isTrue ? ['isSelected'] : []),
      ...(this.isButton ? ['isButton'] : []),
      ...(this.isTextField ? ['isTextField'] : []),
      ...(this.isFocused == Tristate.isTrue ? ['isFocused'] : []),
      ...(this.isEnabled != Tristate.none ? ['hasEnabledState'] : []),
      ...(this.isEnabled == Tristate.isTrue ? ['isEnabled'] : []),
      ...(this.isInMutuallyExclusiveGroup ? ['isInMutuallyExclusiveGroup'] : []),
      ...(this.isHeader ? ['isHeader'] : []),
      ...(this.isObscured ? ['isObscured'] : []),
      ...(this.scopesRoute ? ['scopesRoute'] : []),
      ...(this.namesRoute ? ['namesRoute'] : []),
      ...(this.isHidden ? ['isHidden'] : []),
      ...(this.isImage ? ['isImage'] : []),
      ...(this.isLiveRegion ? ['isLiveRegion'] : []),
      ...(this.isToggled != Tristate.none ? ['hasToggledState'] : []),
      ...(this.isToggled == Tristate.isTrue ? ['isToggled'] : []),
      ...(this.hasImplicitScrolling ? ['hasImplicitScrolling'] : []),
      ...(this.isMultiline ? ['isMultiline'] : []),
      ...(this.isReadOnly ? ['isReadOnly'] : []),
      ...(this.isFocused != Tristate.none ? ['isFocusable'] : []),
      ...(this.isAccessibilityFocusBlocked ? ['isAccessibilityFocusBlocked'] : []),
      ...(this.isLink ? ['isLink'] : []),
      ...(this.isSlider ? ['isSlider'] : []),
      ...(this.isKeyboardKey ? ['isKeyboardKey'] : []),
      ...(this.isChecked == CheckedState.mixed ? ['isCheckStateMixed'] : []),
      ...(this.isExpanded != Tristate.none ? ['hasExpandedState'] : []),
      ...(this.isExpanded == Tristate.isTrue ? ['isExpanded'] : []),
      ...(this.isSelected != Tristate.none ? ['hasSelectedState'] : []),
      ...(this.isRequired != Tristate.none ? ['hasRequiredState'] : []),
      ...(this.isRequired == Tristate.isTrue ? ['isRequired'] : []),
    ];
  }
  hasRepeatedFlags(other: SemanticsFlags): boolean {
    return (
      this.isChecked.hasConflict(other.isChecked) ||
      this.isSelected.hasConflict(other.isSelected) ||
      this.isEnabled.hasConflict(other.isEnabled) ||
      this.isToggled.hasConflict(other.isToggled) ||
      this.isEnabled.hasConflict(other.isEnabled) ||
      this.isExpanded.hasConflict(other.isExpanded) ||
      this.isRequired.hasConflict(other.isRequired) ||
      this.isFocused.hasConflict(other.isFocused) ||
      (this.isButton && other.isButton) ||
      (this.isTextField && other.isTextField) ||
      (this.isInMutuallyExclusiveGroup && other.isInMutuallyExclusiveGroup) ||
      (this.isHeader && other.isHeader) ||
      (this.isObscured && other.isObscured) ||
      (this.scopesRoute && other.scopesRoute) ||
      (this.namesRoute && other.namesRoute) ||
      (this.isHidden && other.isHidden) ||
      (this.isImage && other.isImage) ||
      (this.isLiveRegion && other.isLiveRegion) ||
      (this.hasImplicitScrolling && other.hasImplicitScrolling) ||
      (this.isMultiline && other.isMultiline) ||
      (this.isReadOnly && other.isReadOnly) ||
      (this.isLink && other.isLink) ||
      (this.isSlider && other.isSlider) ||
      (this.isKeyboardKey && other.isKeyboardKey)
    );
  }
  hasConflictingFlags(other: SemanticsFlags): boolean {
    return (
      this.isChecked.hasConflict(other.isChecked) ||
      this.isSelected.hasConflict(other.isSelected) ||
      this.isEnabled.hasConflict(other.isEnabled) ||
      this.isToggled.hasConflict(other.isToggled) ||
      this.isEnabled.hasConflict(other.isEnabled) ||
      this.isExpanded.hasConflict(other.isExpanded) ||
      this.isRequired.hasConflict(other.isRequired) ||
      this.isFocused.hasConflict(other.isFocused) ||
      (this.isButton && other.isButton) ||
      (this.isTextField && other.isTextField) ||
      (this.isInMutuallyExclusiveGroup && other.isInMutuallyExclusiveGroup) ||
      (this.isHeader && other.isHeader) ||
      (this.isObscured && other.isObscured) ||
      (this.scopesRoute && other.scopesRoute) ||
      (this.namesRoute && other.namesRoute) ||
      (this.isHidden && other.isHidden) ||
      (this.isImage && other.isImage) ||
      (this.isLiveRegion && other.isLiveRegion) ||
      (this.hasImplicitScrolling && other.hasImplicitScrolling) ||
      (this.isMultiline && other.isMultiline) ||
      (this.isReadOnly && other.isReadOnly) ||
      (this.isLink && other.isLink) ||
      (this.isSlider && other.isSlider) ||
      (this.isKeyboardKey && other.isKeyboardKey) ||
      this.isAccessibilityFocusBlocked != other.isAccessibilityFocusBlocked
    );
  }
}
/** @internal Foreign/subclass/Proxy flags retain their ordinary virtual path. */
export function semanticsFlagWord(value: SemanticsFlags): SemanticsFlagWord | null {
  return ownedFlagWords.get(value) ?? null;
}
/** @internal Configuration setters update their own record. Nullish and
 * unusual values retain the public copyWith validation/retention path. */
export function updateSemanticsFlagWord(
  word: SemanticsFlagWord,
  name: SemanticsFlagName,
  value: unknown,
): SemanticsFlagWord | null {
  if (!Number.isInteger(word) || word < 0 || word > 0x7fffffff) return null;
  const packing = flagPacking[name];
  if (!packing) return null;
  const scalar = flagScalar(packing, value);
  return scalar === null
    ? null
    : (((word & ~packing.mask) | (scalar << packing.shift)) as SemanticsFlagWord);
}
/** @internal Closed operations over admitted state; no public value objects
 * or virtual methods are needed between annotation and node publication. */
export function mergeSemanticsFlagWords(
  left: SemanticsFlagWord,
  right: SemanticsFlagWord,
): SemanticsFlagWord {
  let word = (left | right) & 0x7fffc000;
  const checkedLeft = left & 3,
    checkedRight = right & 3;
  word |=
    checkedLeft === 3 || checkedRight === 3
      ? 3
      : checkedLeft === 1 || checkedRight === 1
        ? 1
        : checkedLeft | checkedRight;
  for (let shift = 2; shift <= 12; shift += 2) {
    const a = (left >>> shift) & 3,
      b = (right >>> shift) & 3;
    word |= (a === 1 || b === 1 ? 1 : a | b) << shift;
  }
  return word as SemanticsFlagWord;
}
export function semanticsFlagWordsConflict(
  left: SemanticsFlagWord,
  right: SemanticsFlagWord,
): boolean {
  if ((left & right & 0x7fff8000) !== 0 || ((left ^ right) & 0x4000) !== 0) return true;
  for (let shift = 0; shift <= 12; shift += 2)
    if (((left >>> shift) & 3) !== 0 && ((right >>> shift) & 3) !== 0) return true;
  return false;
}
export function readSemanticsFlagWord<Key extends SemanticsFlagName>(
  word: SemanticsFlagWord,
  name: Key,
): Required<SemanticsFlagsOptions>[Key] {
  const packing = flagPacking[name];
  if (!packing) invariant(false, 'invalid-semantics-flag-word', 'Unknown semantics flag');
  const scalar = (word & packing.mask) >>> packing.shift;
  const value = packing.states === null ? scalar !== 0 : packing.states[scalar];
  if (value === undefined)
    invariant(false, 'invalid-semantics-flag-word', 'Invalid packed semantics state');
  return value as Required<SemanticsFlagsOptions>[Key];
}
/** @internal Trusted state publishes the same immutable, enumerable value
 * fields as the public constructor, without replaying external admission. */
export function semanticsFlagsFromWord(word: SemanticsFlagWord): SemanticsFlags {
  if (!Number.isInteger(word) || word < 0 || word > 0x7fffffff)
    invariant(false, 'invalid-semantics-flag-word', 'Semantics flag word must fit 31 bits');
  // A prototype literal initializes one ordinary object directly; per-field
  // descriptor objects would cost more than the immutable values they replace.
  const value = Object.freeze({
    __proto__: SemanticsFlags.prototype,
    isChecked: readSemanticsFlagWord(word, 'isChecked'),
    isSelected: readSemanticsFlagWord(word, 'isSelected'),
    isEnabled: readSemanticsFlagWord(word, 'isEnabled'),
    isToggled: readSemanticsFlagWord(word, 'isToggled'),
    isExpanded: readSemanticsFlagWord(word, 'isExpanded'),
    isRequired: readSemanticsFlagWord(word, 'isRequired'),
    isFocused: readSemanticsFlagWord(word, 'isFocused'),
    isAccessibilityFocusBlocked: readSemanticsFlagWord(word, 'isAccessibilityFocusBlocked'),
    isButton: readSemanticsFlagWord(word, 'isButton'),
    isTextField: readSemanticsFlagWord(word, 'isTextField'),
    isInMutuallyExclusiveGroup: readSemanticsFlagWord(word, 'isInMutuallyExclusiveGroup'),
    isHeader: readSemanticsFlagWord(word, 'isHeader'),
    isObscured: readSemanticsFlagWord(word, 'isObscured'),
    scopesRoute: readSemanticsFlagWord(word, 'scopesRoute'),
    namesRoute: readSemanticsFlagWord(word, 'namesRoute'),
    isHidden: readSemanticsFlagWord(word, 'isHidden'),
    isImage: readSemanticsFlagWord(word, 'isImage'),
    isLiveRegion: readSemanticsFlagWord(word, 'isLiveRegion'),
    hasImplicitScrolling: readSemanticsFlagWord(word, 'hasImplicitScrolling'),
    isMultiline: readSemanticsFlagWord(word, 'isMultiline'),
    isReadOnly: readSemanticsFlagWord(word, 'isReadOnly'),
    isLink: readSemanticsFlagWord(word, 'isLink'),
    isSlider: readSemanticsFlagWord(word, 'isSlider'),
    isKeyboardKey: readSemanticsFlagWord(word, 'isKeyboardKey'),
  }) as unknown as SemanticsFlags;
  ownedFlagWords.set(value, word);
  return value;
}

export interface SemanticsNodeUpdateOptions {
  readonly id: number;
  readonly flags: SemanticsFlags;
  readonly actions: number;
  readonly maxValueLength: number;
  readonly currentValueLength: number;
  readonly textSelectionBase: number;
  readonly textSelectionExtent: number;
  readonly platformViewId: number;
  readonly scrollChildren: number;
  readonly scrollIndex: number;
  readonly traversalParent: number;
  readonly scrollPosition: number;
  readonly scrollExtentMax: number;
  readonly scrollExtentMin: number;
  readonly rect: Rect;
  readonly identifier: string;
  readonly label: string;
  readonly labelAttributes: readonly StringAttribute[];
  readonly value: string;
  readonly valueAttributes: readonly StringAttribute[];
  readonly increasedValue: string;
  readonly increasedValueAttributes: readonly StringAttribute[];
  readonly decreasedValue: string;
  readonly decreasedValueAttributes: readonly StringAttribute[];
  readonly hint: string;
  readonly hintAttributes: readonly StringAttribute[];
  readonly tooltip: string;
  readonly textDirection: 'ltr' | 'rtl' | null;
  readonly transform: Float64Array;
  readonly hitTestTransform: Float64Array;
  readonly childrenInTraversalOrder: Int32Array;
  readonly childrenInHitTestOrder: Int32Array;
  readonly additionalActions: Int32Array;
  readonly headingLevel?: number;
  readonly linkUrl?: string;
  readonly role?: SemanticsRole;
  readonly controlsNodes: readonly string[] | null;
  readonly validationResult?: SemanticsValidationResult;
  readonly hitTestBehavior?: SemanticsHitTestBehavior;
  readonly inputType: SemanticsInputType;
  readonly locale: Locale | null;
  readonly minValue: string;
  readonly maxValue: string;
}
/** @internal Captured engine update payload; scalar/attribute data uses the source API. */
export type SemanticsNodeUpdate = Readonly<
  Omit<
    Required<SemanticsNodeUpdateOptions>,
    | 'transform'
    | 'hitTestTransform'
    | 'childrenInTraversalOrder'
    | 'childrenInHitTestOrder'
    | 'additionalActions'
  > & {
    readonly transform: readonly number[];
    readonly hitTestTransform: readonly number[];
    readonly childrenInTraversalOrder: readonly number[];
    readonly childrenInHitTestOrder: readonly number[];
    readonly additionalActions: readonly number[];
  }
>;
export interface CustomSemanticsActionUpdate {
  readonly id: number;
  readonly label: string;
  readonly hint: string;
  readonly overrideId: number;
}
interface SemanticsUpdatePayload {
  readonly nodes: readonly SemanticsNodeUpdate[];
  readonly customActions: readonly CustomSemanticsActionUpdate[];
}
const semanticsUpdates = new WeakMap<SemanticsUpdate, SemanticsUpdatePayload>();
/** Explicit TypeScript engine transport. Native accessibility delivery is owned by the host. */
export class SemanticsUpdate {
  private constructor(payload: SemanticsUpdatePayload) {
    semanticsUpdates.set(this, payload);
  }
  /** @internal Created only by a builder. */
  static _fromPayload(payload: SemanticsUpdatePayload): SemanticsUpdate {
    return new SemanticsUpdate(payload);
  }
  dispose(): void {
    semanticsUpdates.delete(this);
  }
  /** @internal The host applies this immutable update before retiring it. */
  _read(): SemanticsUpdatePayload {
    const payload = semanticsUpdates.get(this);
    if (!(payload !== undefined))
      invariant(false, 'disposed-semantics-update', 'Semantics update has been disposed');
    return payload;
  }
}
/** Source-shaped builder with owned immutable payloads at the engine boundary. */
export class SemanticsUpdateBuilder {
  private readonly nodes = new Map<number, SemanticsNodeUpdate>();
  private readonly customActions = new Map<number, CustomSemanticsActionUpdate>();
  private built = false;
  private ensureOpen(): void {
    if (this.built)
      invariant(
        false,
        'used-semantics-builder',
        'SemanticsUpdateBuilder cannot be used after build',
      );
  }
  updateNode(options: SemanticsNodeUpdateOptions): void {
    this.ensureOpen();
    const {
      headingLevel = 0,
      linkUrl = '',
      role = SemanticsRole.none,
      validationResult = SemanticsValidationResult.none,
      hitTestBehavior = SemanticsHitTestBehavior.defer,
    } = options;
    if (FoundationBuildMode.debug) {
      if (!(options.transform.length === 16 && options.transform.every(Number.isFinite)))
        invariant(
          false,
          'invalid-semantics-transform',
          'Semantics transform must be a finite matrix4',
        );
      if (!(headingLevel >= 0 && headingLevel <= 6))
        invariant(false, 'invalid-semantics-heading', 'Heading level must be between 0 and 6');
    }
    const list = <T>(values: Iterable<T>): readonly T[] => Object.freeze(Array.from(values));
    this.nodes.set(
      options.id,
      Object.freeze({
        ...options,
        headingLevel,
        linkUrl,
        role,
        validationResult,
        hitTestBehavior,
        transform: list(options.transform),
        hitTestTransform: list(options.hitTestTransform),
        childrenInTraversalOrder: list(options.childrenInTraversalOrder),
        childrenInHitTestOrder: list(options.childrenInHitTestOrder),
        additionalActions: list(options.additionalActions),
        labelAttributes: list(options.labelAttributes),
        valueAttributes: list(options.valueAttributes),
        increasedValueAttributes: list(options.increasedValueAttributes),
        decreasedValueAttributes: list(options.decreasedValueAttributes),
        hintAttributes: list(options.hintAttributes),
        controlsNodes: options.controlsNodes === null ? null : list(options.controlsNodes),
      }),
    );
  }
  updateCustomAction({
    id,
    label = null,
    hint = null,
    overrideId = -1,
  }: {
    readonly id: number;
    readonly label?: string | null;
    readonly hint?: string | null;
    readonly overrideId?: number;
  }): void {
    this.ensureOpen();
    this.customActions.set(
      id,
      Object.freeze({ id, label: label ?? '', hint: hint ?? '', overrideId }),
    );
  }
  build(): SemanticsUpdate {
    this.ensureOpen();
    const update = SemanticsUpdate._fromPayload(
      Object.freeze({
        nodes: Object.freeze([...this.nodes.values()]),
        customActions: Object.freeze([...this.customActions.values()]),
      }),
    );
    this.built = true;
    this.nodes.clear();
    this.customActions.clear();
    return update;
  }
  toString(): string {
    return 'SemanticsUpdateBuilder';
  }
}
