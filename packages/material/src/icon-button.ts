import {kDefaultIconLightColor,kDefaultIconDarkColor} from './constants.ts';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Complete M3 IconButton surface, style factory and four source variant policies.
import { StatelessWidget, Widget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import type { Key } from '@nelyx/core/foundation/key';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetStatesController } from '@nelyx/core/framework/widgets/widget-state';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { Color } from '@nelyx/core/ui/color';
import { Size } from '@nelyx/core/ui/size';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import type { BorderSide, OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import type { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { invariant } from '@nelyx/core/foundation/errors';
import { DiagnosticsProperty, StringProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { ObjectFlagProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { ColorProperty } from '@nelyx/core/framework/painting/color-property';
import { ButtonStyle } from './button-style.ts';
import { ButtonStyleButton } from './button-style-button.ts';
import type { MaterialButtonOptions, MaterialButtonVariant } from './button-style-button.ts';
import type { VisualDensity, MaterialTapTargetSize } from './theme-data.ts';
import type { InteractiveInkFeatureFactory } from './ink-feature.ts';
import { Theme } from './theme.ts';
import './colors.ts';
import { IconButtonTheme } from './icon-button-theme.ts';
import { iconButtonDefaults } from './internal/button/icon-button-defaults.ts';
import type { IconButtonVariant } from './internal/button/icon-button-defaults.ts';
import { colorProperty, colorAll, doubleAll, sizeAll, insetsAll, shapeAll, cursorProperty, sideAll } from './internal/button/style-properties.ts';
export interface IconButtonOptions {
    readonly key?: Key | null;
    /** @dartType double? */ readonly iconSize?: number | null;
    readonly visualDensity?: VisualDensity | null;
    readonly padding?: EdgeInsetsGeometry | null;
    readonly alignment?: AlignmentGeometry | null;
    /** @dartType double? */ readonly splashRadius?: number | null;
    readonly color?: Color | null;
    readonly focusColor?: Color | null;
    readonly hoverColor?: Color | null;
    readonly highlightColor?: Color | null;
    readonly splashColor?: Color | null;
    readonly disabledColor?: Color | null;
    readonly onPressed: (() => void) | null;
    readonly onHover?: ((hovered: boolean) => void) | null;
    readonly onLongPress?: (() => void) | null;
    readonly mouseCursor?: MouseCursor | null;
    readonly focusNode?: FocusNode | null;
    readonly autofocus?: boolean;
    readonly tooltip?: string | null;
    readonly enableFeedback?: boolean | null;
    readonly constraints?: BoxConstraints | null;
    readonly style?: ButtonStyle | null;
    readonly isSelected?: boolean | null;
    readonly selectedIcon?: Widget | null;
    readonly statesController?: WidgetStatesController | null;
    readonly icon: Widget;
    readonly id?: string;
}
export interface IconButtonStyleFromOptions {
    readonly foregroundColor?: Color | null;
    readonly backgroundColor?: Color | null;
    readonly disabledForegroundColor?: Color | null;
    readonly disabledBackgroundColor?: Color | null;
    readonly focusColor?: Color | null;
    readonly hoverColor?: Color | null;
    readonly highlightColor?: Color | null;
    readonly shadowColor?: Color | null;
    readonly surfaceTintColor?: Color | null;
    readonly overlayColor?: Color | null;
    /** @dartType double? */ readonly elevation?: number | null;
    readonly minimumSize?: Size | null;
    readonly fixedSize?: Size | null;
    readonly maximumSize?: Size | null;
    /** @dartType double? */ readonly iconSize?: number | null;
    readonly side?: BorderSide | null;
    readonly shape?: OutlinedBorder | null;
    readonly padding?: EdgeInsetsGeometry | null;
    readonly enabledMouseCursor?: MouseCursor | null;
    readonly disabledMouseCursor?: MouseCursor | null;
    readonly visualDensity?: VisualDensity | null;
    readonly tapTargetSize?: MaterialTapTargetSize | null;
    readonly animationDuration?: number | null; // Source Duration in host milliseconds.
    readonly enableFeedback?: boolean | null;
    readonly alignment?: AlignmentGeometry | null;
    readonly splashFactory?: InteractiveInkFeatureFactory | null;
}
export class IconButton extends StatelessWidget {
    readonly options: Readonly<IconButtonOptions>;
    private sourceVariant: IconButtonVariant = 'standard';
    /** @dartType double? */ get iconSize(): number | null { return this.options.iconSize ?? null; }
    get visualDensity(): VisualDensity | null { return this.options.visualDensity ?? null; }
    get padding(): EdgeInsetsGeometry | null { return this.options.padding ?? null; }
    get alignment(): AlignmentGeometry | null { return this.options.alignment ?? null; }
    /** @dartType double? */ get splashRadius(): number | null { return this.options.splashRadius ?? null; }
    get color(): Color | null { return this.options.color ?? null; }
    get focusColor(): Color | null { return this.options.focusColor ?? null; }
    get hoverColor(): Color | null { return this.options.hoverColor ?? null; }
    get highlightColor(): Color | null { return this.options.highlightColor ?? null; }
    get splashColor(): Color | null { return this.options.splashColor ?? null; }
    get disabledColor(): Color | null { return this.options.disabledColor ?? null; }
    get onPressed(): (() => void) | null { return this.options.onPressed ?? null; }
    get onHover(): ((hovered: boolean) => void) | null { return this.options.onHover ?? null; }
    get onLongPress(): (() => void) | null { return this.options.onLongPress ?? null; }
    get mouseCursor(): MouseCursor | null { return this.options.mouseCursor ?? null; }
    get focusNode(): FocusNode | null { return this.options.focusNode ?? null; }
    get autofocus(): boolean { return this.options.autofocus ?? false; }
    get tooltip(): string | null { return this.options.tooltip ?? null; }
    get enableFeedback(): boolean | null { return this.options.enableFeedback ?? null; }
    get constraints(): BoxConstraints | null { return this.options.constraints ?? null; }
    get style(): ButtonStyle | null { return this.options.style ?? null; }
    get isSelected(): boolean | null { return this.options.isSelected ?? null; }
    get selectedIcon(): Widget | null { return this.options.selectedIcon ?? null; }
    get statesController(): WidgetStatesController | null { return this.options.statesController ?? null; }
    get icon(): Widget { return this.options.icon; }
    /** @dartParam iconSize double?
     * @dartParam splashRadius double? */
    constructor(options: IconButtonOptions) { super(options.key ?? null); invariant(options.icon instanceof Widget, 'missing-icon-button-icon', 'IconButton requires a Widget icon'); invariant(options.splashRadius == null || Number.isFinite(options.splashRadius) && options.splashRadius > 0, 'invalid-icon-button-splash-radius', 'splashRadius must be positive'); this.options = Object.freeze({ ...options }); }
    /** @dartParam iconSize double?
     * @dartParam splashRadius double? */
    static filled(options: IconButtonOptions): IconButton { const button = new IconButton(options); button.sourceVariant = 'filled'; return button; }
    /** @dartParam iconSize double?
     * @dartParam splashRadius double? */
    static filledTonal(options: IconButtonOptions): IconButton { const button = new IconButton(options); button.sourceVariant = 'filledTonal'; return button; }
    /** @dartParam iconSize double?
     * @dartParam splashRadius double? */
    static outlined(options: IconButtonOptions): IconButton { const button = new IconButton(options); button.sourceVariant = 'outlined'; return button; }
    /** @dartParam elevation double?
     * @dartParam iconSize double? */
    static styleFrom(o: IconButtonStyleFromOptions = {}): ButtonStyle {
        const fallback = o.overlayColor ?? o.foregroundColor ?? null;
        const overlay = o.hoverColor != null || o.focusColor != null || o.highlightColor != null || fallback !== null ? (o.overlayColor?.a === 0 ? colorAll(o.overlayColor) : colorProperty(states => states.contains(WidgetState.pressed) ? o.highlightColor ?? fallback?.withOpacity(.1) ?? null : states.contains(WidgetState.hovered) ? o.hoverColor ?? fallback?.withOpacity(.08) ?? null : states.contains(WidgetState.focused) ? o.focusColor ?? fallback?.withOpacity(.1) ?? null : null)) : null;
        return new ButtonStyle({ backgroundColor: ButtonStyleButton.defaultColor(o.backgroundColor ?? null, o.disabledBackgroundColor ?? null), foregroundColor: ButtonStyleButton.defaultColor(o.foregroundColor ?? null, o.disabledForegroundColor ?? null), overlayColor: overlay, shadowColor: colorAll(o.shadowColor ?? null), surfaceTintColor: colorAll(o.surfaceTintColor ?? null), elevation: doubleAll(o.elevation ?? null), padding: insetsAll(o.padding ?? null), minimumSize: sizeAll(o.minimumSize ?? null), fixedSize: sizeAll(o.fixedSize ?? null), maximumSize: sizeAll(o.maximumSize ?? null), iconSize: doubleAll(o.iconSize ?? null), side: sideAll(o.side ?? null), shape: shapeAll(o.shape ?? null), mouseCursor: o.enabledMouseCursor == null && o.disabledMouseCursor == null ? null : cursorProperty(states => states.contains(WidgetState.disabled) ? o.disabledMouseCursor ?? null : o.enabledMouseCursor ?? null), visualDensity: o.visualDensity ?? null, tapTargetSize: o.tapTargetSize ?? null, animationDuration: o.animationDuration ?? null, enableFeedback: o.enableFeedback ?? null, alignment: o.alignment ?? null, splashFactory: o.splashFactory ?? null });
    }
    build(): Widget {
        const o = this.options;
        let adjusted = IconButton.styleFrom({ visualDensity: this.visualDensity, foregroundColor: this.color, disabledForegroundColor: this.disabledColor, focusColor: this.focusColor, hoverColor: this.hoverColor, highlightColor: this.highlightColor, padding: this.padding, minimumSize: this.constraints ? new Size(this.constraints.minWidth, this.constraints.minHeight) : null, maximumSize: this.constraints ? new Size(this.constraints.maxWidth, this.constraints.maxHeight) : null, iconSize: this.iconSize, alignment: this.alignment, enabledMouseCursor: this.mouseCursor, disabledMouseCursor: this.mouseCursor, enableFeedback: this.enableFeedback });
        if (this.style)
            adjusted = this.style.merge(adjusted);
        if (adjusted.iconColor === null)
            adjusted = adjusted.copyWith({ iconColor: adjusted.foregroundColor });
        return new StyledIconButton(this.sourceVariant, this.isSelected !== null, { style: adjusted, child: this.isSelected === true && this.selectedIcon ? this.selectedIcon : this.icon, onPressed: this.onPressed, onLongPress: this.onPressed !== null ? this.onLongPress : null, autofocus: this.autofocus, focusNode: this.focusNode, statesController: this.statesController, selected: this.isSelected, tooltip: this.tooltip, ...(o.onHover ? { onHover: o.onHover } : {}), ...(o.id ? { id: o.id } : {}) });
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        properties.add(new StringProperty('tooltip', this.tooltip, { defaultValue: null, quoted: false }));
        properties.add(new ObjectFlagProperty('onPressed', this.onPressed, { ifNull: 'disabled' }));
        properties.add(new ObjectFlagProperty('onHover', this.onHover, { ifNull: 'disabled' }));
        properties.add(new ObjectFlagProperty('onLongPress', this.onLongPress, { ifNull: 'disabled' }));
        for (const name of ['color', 'disabledColor', 'focusColor', 'hoverColor', 'highlightColor', 'splashColor'] as const)
            properties.add(new ColorProperty(name, this[name], { defaultValue: null }));
        properties.add(new DiagnosticsProperty('padding', this.padding, { defaultValue: null }));
        properties.add(new DiagnosticsProperty('focusNode', this.focusNode, { defaultValue: null }));
    }
}
class StyledIconButton extends ButtonStyleButton {
    constructor(private readonly sourceVariant: IconButtonVariant, private readonly toggleable: boolean, options: MaterialButtonOptions) { super(options); }
    get variant(): MaterialButtonVariant { return this.sourceVariant === 'filled' ? 'filled' : this.sourceVariant === 'filledTonal' ? 'tonal' : this.sourceVariant === 'outlined' ? 'outlined' : 'text'; }
    override defaultStyleOf(context: BuildContext): ButtonStyle { return iconButtonDefaults(Theme.of(context), this.sourceVariant, this.toggleable); }
    override themeStyleOf(context: BuildContext): ButtonStyle {
        const icon = IconTheme.of(context), isDefaultSize = icon.size === IconThemeData.fallback().size, isDefaultColor = icon.color === (Theme.brightnessOf(context) === 'light' ? kDefaultIconDarkColor : kDefaultIconLightColor), iconStyle = IconButton.styleFrom({ foregroundColor: isDefaultColor ? null : icon.color, iconSize: isDefaultSize ? null : icon.size });
        return IconButtonTheme.of(context).style?.merge(iconStyle) ?? iconStyle;
    }
}
