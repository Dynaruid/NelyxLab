// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Resolved API projection from the assessed full pinned source IR; functional build/State/render owners are explicit.
import { StatefulWidget, Widget } from '@nelyx/core/framework/widgets/framework';
import type { WidgetOptions, State } from '@nelyx/core/framework/widgets/framework';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type {
  BorderSide,
  OutlinedBorder,
  ShapeBorder,
} from '@nelyx/core/framework/painting/borders';
import { CircleBorder } from '@nelyx/core/framework/painting/circle-border';
import type { Clip } from '@nelyx/core/ui/clip';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { Color } from '@nelyx/core/ui/color';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { VisualDensity, MaterialTapTargetSize } from './theme-data.ts';
import type { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import type { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { ChipAnimationStyle } from './chip-animation-style.ts';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { ChipThemeData } from './chip-theme.ts';
import './chip-theme.ts';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { Icons } from './icons.ts';
import './internal/chip/chip-defaults.ts';
import { invariant } from '@nelyx/core/foundation/errors';
import { RawChipState } from './internal/chip/raw-chip-state.ts';
export { ChipAnimationStyle } from './chip-animation-style.ts';
const defaultDeleteIcon = new Icon(Icons.cancel);
export interface ChipAttributes {
  readonly label: Widget;
  readonly avatar: Widget | null;
  readonly labelStyle: TextStyle | null;
  readonly side: BorderSide | null;
  readonly shape: OutlinedBorder | null;
  readonly clipBehavior: Clip;
  readonly focusNode: FocusNode | null;
  readonly autofocus: boolean;
  readonly color: WidgetStateProperty<Color | null> | null;
  readonly backgroundColor: Color | null;
  readonly padding: EdgeInsetsGeometry | null;
  readonly visualDensity: VisualDensity | null;
  readonly labelPadding: EdgeInsetsGeometry | null;
  readonly materialTapTargetSize: MaterialTapTargetSize | null;
  /** @dartType double? */ readonly elevation: number | null;
  readonly shadowColor: Color | null;
  readonly surfaceTintColor: Color | null;
  readonly iconTheme: IconThemeData | null;
  readonly avatarBoxConstraints: BoxConstraints | null;
  readonly chipAnimationStyle: ChipAnimationStyle | null;
  readonly mouseCursor: MouseCursor | null;
}
export interface DeletableChipAttributes {
  readonly deleteIcon: Widget | null;
  readonly onDeleted: (() => void) | null;
  readonly deleteIconColor: Color | null;
  readonly deleteButtonTooltipMessage: string | null;
  readonly deleteIconBoxConstraints: BoxConstraints | null;
}
export interface SelectableChipAttributes {
  readonly selected: boolean;
  readonly onSelected: ((value0: boolean) => void) | null;
  /** @dartType double? */ readonly pressElevation: number | null;
  readonly selectedColor: Color | null;
  readonly selectedShadowColor: Color | null;
  readonly tooltip: string | null;
  readonly avatarBorder: ShapeBorder;
}
export interface CheckmarkableChipAttributes {
  readonly showCheckmark: boolean | null;
  readonly checkmarkColor: Color | null;
}
export interface DisabledChipAttributes {
  readonly isEnabled: boolean;
  readonly disabledColor: Color | null;
}
export interface TappableChipAttributes {
  readonly onPressed: (() => void) | null;
  /** @dartType double? */ readonly pressElevation: number | null;
  readonly tooltip: string | null;
}
export interface RawChipOptions extends WidgetOptions {
  readonly defaultProperties?: ChipThemeData | null;
  readonly avatar?: Widget | null;
  readonly label: Widget;
  readonly labelStyle?: TextStyle | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly visualDensity?: VisualDensity | null;
  readonly labelPadding?: EdgeInsetsGeometry | null;
  readonly deleteIcon?: Widget | null;
  readonly onDeleted?: (() => void) | null;
  readonly deleteIconColor?: Color | null;
  readonly deleteButtonTooltipMessage?: string | null;
  readonly onPressed?: (() => void) | null;
  readonly onSelected?: ((value0: boolean) => void) | null;
  /** @dartType double? */ readonly pressElevation?: number | null;
  readonly tapEnabled?: boolean;
  readonly selected?: boolean;
  readonly isEnabled?: boolean;
  readonly disabledColor?: Color | null;
  readonly selectedColor?: Color | null;
  readonly tooltip?: string | null;
  readonly side?: BorderSide | null;
  readonly shape?: OutlinedBorder | null;
  readonly clipBehavior?: Clip;
  readonly focusNode?: FocusNode | null;
  readonly autofocus?: boolean;
  readonly color?: WidgetStateProperty<Color | null> | null;
  readonly backgroundColor?: Color | null;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
  /** @dartType double? */ readonly elevation?: number | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly iconTheme?: IconThemeData | null;
  readonly selectedShadowColor?: Color | null;
  readonly showCheckmark?: boolean | null;
  readonly checkmarkColor?: Color | null;
  readonly avatarBorder?: ShapeBorder;
  readonly avatarBoxConstraints?: BoxConstraints | null;
  readonly deleteIconBoxConstraints?: BoxConstraints | null;
  readonly chipAnimationStyle?: ChipAnimationStyle | null;
  readonly mouseCursor?: MouseCursor | null;
}
export class RawChip extends StatefulWidget {
  readonly defaultProperties: ChipThemeData | null;
  readonly avatar: Widget | null;
  readonly label: Widget;
  readonly labelStyle: TextStyle | null;
  readonly labelPadding: EdgeInsetsGeometry | null;
  readonly deleteIcon: Widget;
  readonly onDeleted: (() => void) | null;
  readonly deleteIconColor: Color | null;
  readonly deleteButtonTooltipMessage: string | null;
  readonly onSelected: ((value0: boolean) => void) | null;
  readonly onPressed: (() => void) | null;
  /** @dartType double? */ readonly pressElevation: number | null;
  readonly selected: boolean;
  readonly isEnabled: boolean;
  readonly disabledColor: Color | null;
  readonly selectedColor: Color | null;
  readonly tooltip: string | null;
  readonly side: BorderSide | null;
  readonly shape: OutlinedBorder | null;
  readonly clipBehavior: Clip;
  readonly focusNode: FocusNode | null;
  readonly autofocus: boolean;
  readonly color: WidgetStateProperty<Color | null> | null;
  readonly backgroundColor: Color | null;
  readonly padding: EdgeInsetsGeometry | null;
  readonly visualDensity: VisualDensity | null;
  readonly materialTapTargetSize: MaterialTapTargetSize | null;
  /** @dartType double? */ readonly elevation: number | null;
  readonly shadowColor: Color | null;
  readonly surfaceTintColor: Color | null;
  readonly iconTheme: IconThemeData | null;
  readonly selectedShadowColor: Color | null;
  readonly showCheckmark: boolean | null;
  readonly checkmarkColor: Color | null;
  readonly avatarBorder: ShapeBorder;
  readonly avatarBoxConstraints: BoxConstraints | null;
  readonly deleteIconBoxConstraints: BoxConstraints | null;
  readonly chipAnimationStyle: ChipAnimationStyle | null;
  readonly mouseCursor: MouseCursor | null;
  readonly tapEnabled: boolean;
  /**
   * @dartParam pressElevation double?
   * @dartParam elevation double?
   */
  constructor(o: RawChipOptions) {
    super(o.key ?? null);
    invariant(
      o.label instanceof Widget,
      'invalid-chip-label',
      'Chip requires an owning Widget label',
    );
    this.defaultProperties = o.defaultProperties ?? null;
    this.avatar = o.avatar ?? null;
    this.label = o.label;
    this.labelStyle = o.labelStyle ?? null;
    this.labelPadding = o.labelPadding ?? null;
    this.deleteIcon = o.deleteIcon ?? defaultDeleteIcon;
    this.onDeleted = o.onDeleted ?? null;
    this.deleteIconColor = o.deleteIconColor ?? null;
    this.deleteButtonTooltipMessage = o.deleteButtonTooltipMessage ?? null;
    this.onSelected = o.onSelected ?? null;
    this.onPressed = o.onPressed ?? null;
    this.pressElevation = o.pressElevation ?? null;
    this.selected = o.selected ?? false;
    this.isEnabled = o.isEnabled ?? true;
    this.disabledColor = o.disabledColor ?? null;
    this.selectedColor = o.selectedColor ?? null;
    this.tooltip = o.tooltip ?? null;
    this.side = o.side ?? null;
    this.shape = o.shape ?? null;
    this.clipBehavior = o.clipBehavior ?? 'none';
    this.focusNode = o.focusNode ?? null;
    this.autofocus = o.autofocus ?? false;
    this.color = o.color ?? null;
    this.backgroundColor = o.backgroundColor ?? null;
    this.padding = o.padding ?? null;
    this.visualDensity = o.visualDensity ?? null;
    this.materialTapTargetSize = o.materialTapTargetSize ?? null;
    this.elevation = o.elevation ?? null;
    this.shadowColor = o.shadowColor ?? null;
    this.surfaceTintColor = o.surfaceTintColor ?? null;
    this.iconTheme = o.iconTheme ?? null;
    this.selectedShadowColor = o.selectedShadowColor ?? null;
    this.showCheckmark = o.showCheckmark ?? null;
    this.checkmarkColor = o.checkmarkColor ?? null;
    this.avatarBorder = o.avatarBorder ?? new CircleBorder();
    this.avatarBoxConstraints = o.avatarBoxConstraints ?? null;
    this.deleteIconBoxConstraints = o.deleteIconBoxConstraints ?? null;
    this.chipAnimationStyle = o.chipAnimationStyle ?? null;
    this.mouseCursor = o.mouseCursor ?? null;
    this.tapEnabled = o.tapEnabled ?? true;
    invariant(
      this.elevation === null || this.elevation >= 0,
      'invalid-chip-elevation',
      'Chip elevation must be nonnegative',
    );
    invariant(
      this.pressElevation === null || this.pressElevation >= 0,
      'invalid-chip-elevation',
      'Chip elevation must be nonnegative',
    );
  }
  createState(): State {
    return new RawChipState();
  }
}
