// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Resolved API projection from the assessed full pinned source IR; functional build/State/render owners are explicit.
import { StatelessWidget, Widget } from '@nelyx/core/framework/widgets/framework';
import type { WidgetOptions, BuildContext } from '@nelyx/core/framework/widgets/framework';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { BorderSide, OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import '@nelyx/core/framework/painting/circle-border';
import type { Clip } from '@nelyx/core/ui/clip';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { Color } from '@nelyx/core/ui/color';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { VisualDensity, MaterialTapTargetSize } from '../../theme-data.ts';
import type { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import type { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { ChipAnimationStyle } from '../../chip-animation-style.ts';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import '../../chip-theme.ts';
import '@nelyx/core/framework/widgets/icon';
import '../../icons.ts';
import '../../internal/chip/chip-defaults.ts';
import { invariant } from '@nelyx/core/foundation/errors';
import { RawChip } from '../../raw-chip.ts';
export interface ChipOptions extends WidgetOptions {
  readonly avatar?: Widget | null;
  readonly label: Widget;
  readonly labelStyle?: TextStyle | null;
  readonly labelPadding?: EdgeInsetsGeometry | null;
  readonly deleteIcon?: Widget | null;
  readonly onDeleted?: (() => void) | null;
  readonly deleteIconColor?: Color | null;
  readonly deleteButtonTooltipMessage?: string | null;
  readonly side?: BorderSide | null;
  readonly shape?: OutlinedBorder | null;
  readonly clipBehavior?: Clip;
  readonly focusNode?: FocusNode | null;
  readonly autofocus?: boolean;
  readonly color?: WidgetStateProperty<Color | null> | null;
  readonly backgroundColor?: Color | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly visualDensity?: VisualDensity | null;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
  /** @dartType double? */ readonly elevation?: number | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly iconTheme?: IconThemeData | null;
  readonly avatarBoxConstraints?: BoxConstraints | null;
  readonly deleteIconBoxConstraints?: BoxConstraints | null;
  readonly chipAnimationStyle?: ChipAnimationStyle | null;
  readonly mouseCursor?: MouseCursor | null;
}
export class Chip extends StatelessWidget {
  readonly avatar: Widget | null;
  readonly label: Widget;
  readonly labelStyle: TextStyle | null;
  readonly labelPadding: EdgeInsetsGeometry | null;
  readonly side: BorderSide | null;
  readonly shape: OutlinedBorder | null;
  readonly clipBehavior: Clip;
  readonly focusNode: FocusNode | null;
  readonly autofocus: boolean;
  readonly color: WidgetStateProperty<Color | null> | null;
  readonly backgroundColor: Color | null;
  readonly padding: EdgeInsetsGeometry | null;
  readonly visualDensity: VisualDensity | null;
  readonly deleteIcon: Widget | null;
  readonly onDeleted: (() => void) | null;
  readonly deleteIconColor: Color | null;
  readonly deleteButtonTooltipMessage: string | null;
  readonly materialTapTargetSize: MaterialTapTargetSize | null;
  /** @dartType double? */ readonly elevation: number | null;
  readonly shadowColor: Color | null;
  readonly surfaceTintColor: Color | null;
  readonly iconTheme: IconThemeData | null;
  readonly avatarBoxConstraints: BoxConstraints | null;
  readonly deleteIconBoxConstraints: BoxConstraints | null;
  readonly chipAnimationStyle: ChipAnimationStyle | null;
  readonly mouseCursor: MouseCursor | null;
  /**
   * @dartParam elevation double?
   */
  constructor(o: ChipOptions) {
    super(o.key ?? null);
    invariant(
      o.label instanceof Widget,
      'invalid-chip-label',
      'Chip requires an owning Widget label',
    );
    this.avatar = o.avatar ?? null;
    this.label = o.label;
    this.labelStyle = o.labelStyle ?? null;
    this.labelPadding = o.labelPadding ?? null;
    this.side = o.side ?? null;
    this.shape = o.shape ?? null;
    this.clipBehavior = o.clipBehavior ?? 'none';
    this.focusNode = o.focusNode ?? null;
    this.autofocus = o.autofocus ?? false;
    this.color = o.color ?? null;
    this.backgroundColor = o.backgroundColor ?? null;
    this.padding = o.padding ?? null;
    this.visualDensity = o.visualDensity ?? null;
    this.deleteIcon = o.deleteIcon ?? null;
    this.onDeleted = o.onDeleted ?? null;
    this.deleteIconColor = o.deleteIconColor ?? null;
    this.deleteButtonTooltipMessage = o.deleteButtonTooltipMessage ?? null;
    this.materialTapTargetSize = o.materialTapTargetSize ?? null;
    this.elevation = o.elevation ?? null;
    this.shadowColor = o.shadowColor ?? null;
    this.surfaceTintColor = o.surfaceTintColor ?? null;
    this.iconTheme = o.iconTheme ?? null;
    this.avatarBoxConstraints = o.avatarBoxConstraints ?? null;
    this.deleteIconBoxConstraints = o.deleteIconBoxConstraints ?? null;
    this.chipAnimationStyle = o.chipAnimationStyle ?? null;
    this.mouseCursor = o.mouseCursor ?? null;
    invariant(
      this.elevation === null || this.elevation >= 0,
      'invalid-chip-elevation',
      'Chip elevation must be nonnegative',
    );
  }
  build(_context: BuildContext): Widget {
    return new RawChip({
      avatar: this.avatar,
      label: this.label,
      labelStyle: this.labelStyle,
      labelPadding: this.labelPadding,
      side: this.side,
      shape: this.shape,
      clipBehavior: this.clipBehavior,
      focusNode: this.focusNode,
      autofocus: this.autofocus,
      color: this.color,
      backgroundColor: this.backgroundColor,
      padding: this.padding,
      visualDensity: this.visualDensity,
      deleteIcon: this.deleteIcon,
      onDeleted: this.onDeleted,
      deleteIconColor: this.deleteIconColor,
      deleteButtonTooltipMessage: this.deleteButtonTooltipMessage,
      materialTapTargetSize: this.materialTapTargetSize,
      elevation: this.elevation,
      shadowColor: this.shadowColor,
      surfaceTintColor: this.surfaceTintColor,
      iconTheme: this.iconTheme,
      avatarBoxConstraints: this.avatarBoxConstraints,
      deleteIconBoxConstraints: this.deleteIconBoxConstraints,
      chipAnimationStyle: this.chipAnimationStyle,
      mouseCursor: this.mouseCursor,
      tapEnabled: false,
    });
  }
}
