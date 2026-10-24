// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { ButtonStyleButton } from './button-style-button.ts';
import type { MaterialButtonOptions, MaterialButtonVariant } from './button-style-button.ts';
import { Text } from '@nelyx/core/framework/widgets/basic';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/size';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import type { BorderSide, OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { VisualDensity, MaterialTapTargetSize } from './theme-data.ts';
import type { InteractiveInkFeatureFactory } from './ink-feature.ts';
import { ButtonStyle } from './button-style.ts';
import type { ButtonLayerBuilder } from './button-style.ts';
import { IconAlignment } from './icon-alignment.ts';
import { TextButtonTheme } from './text-button-theme.ts';
import { ButtonIconLabel } from './internal/button/icon-label.ts';
import { concreteStyleFrom } from './internal/button/concrete-style-from.ts';
import { insetsAll } from './internal/button/style-properties.ts';
import { emptyWidgetStateSet } from '@nelyx/core/internal/framework/widgets/widget-state-full-collections';
export interface TextButtonOptions extends Omit<MaterialButtonOptions, 'onPressed' | 'selected'> {
    readonly onPressed: (() => void) | null;
}
export interface TextButtonIconOptions extends Omit<TextButtonOptions, 'child'> {
    readonly icon?: Widget | null;
    readonly label: Widget;
    readonly iconAlignment?: IconAlignment | null;
}
export interface TextButtonStyleFromOptions {
    readonly foregroundColor?: Color | null;
    readonly backgroundColor?: Color | null;
    readonly disabledForegroundColor?: Color | null;
    readonly disabledBackgroundColor?: Color | null;
    readonly shadowColor?: Color | null;
    readonly surfaceTintColor?: Color | null;
    readonly iconColor?: Color | null;
    /** @dartType double? */ readonly iconSize?: number | null;
    readonly iconAlignment?: IconAlignment | null;
    readonly disabledIconColor?: Color | null;
    readonly overlayColor?: Color | null;
    /** @dartType double? */ readonly elevation?: number | null;
    readonly textStyle?: TextStyle | null;
    readonly padding?: EdgeInsetsGeometry | null;
    readonly minimumSize?: Size | null;
    readonly fixedSize?: Size | null;
    readonly maximumSize?: Size | null;
    readonly side?: BorderSide | null;
    readonly shape?: OutlinedBorder | null;
    readonly enabledMouseCursor?: MouseCursor | null;
    readonly disabledMouseCursor?: MouseCursor | null;
    readonly visualDensity?: VisualDensity | null;
    readonly tapTargetSize?: MaterialTapTargetSize | null;
    readonly animationDuration?: number | null;
    readonly enableFeedback?: boolean | null;
    readonly alignment?: AlignmentGeometry | null;
    readonly splashFactory?: InteractiveInkFeatureFactory | null;
    readonly backgroundBuilder?: ButtonLayerBuilder | null;
    readonly foregroundBuilder?: ButtonLayerBuilder | null;
}
export class TextButton extends ButtonStyleButton {
    private addPadding = false;
    override get variant(): MaterialButtonVariant { return 'text'; }
    constructor(options: TextButtonOptions);
    constructor(id: string, label: string, onPressed: (() => void) | undefined);
    constructor(first: TextButtonOptions | string, label?: string, onPressed?: (() => void)) { const options: TextButtonOptions = typeof first === 'string' ? { id: first, semanticsLabel: label ?? '', child: new Text(label ?? ''), onPressed: onPressed ?? null } : first; if (!Object.hasOwn(options, 'onPressed'))
        throw new TypeError('TextButton requires the nullable onPressed argument'); if (!Object.hasOwn(options, 'child'))
        throw new TypeError('TextButton requires the nullable child argument'); super({ ...options, clipBehavior: options.clipBehavior === undefined ? null : options.clipBehavior }); }
    static icon(options: TextButtonIconOptions): TextButton { const { icon = null, label, iconAlignment = null, ...base } = options; const button = new TextButton({ ...base, clipBehavior: base.clipBehavior === undefined ? "none" : base.clipBehavior, child: icon === null ? label : new ButtonIconLabel(label, icon, options.style ?? null, iconAlignment, context => TextButtonTheme.of(context).style) }); button.addPadding = icon !== null; return button; }
    /** @dartParam iconSize double?
    * @dartParam elevation double? */ static styleFrom(options: TextButtonStyleFromOptions = {}): ButtonStyle { return concreteStyleFrom(options, 'text'); }
    override defaultStyleOf(context: BuildContext): ButtonStyle { const style = super.defaultStyleOf(context); if (!this.addPadding)
        return style; const fontSize = style.textStyle?.resolve(emptyWidgetStateSet())?.fontSize ?? 14, scale = MediaQuery.textScalerOf(context).scale(fontSize) / 14, padding = ButtonStyleButton.scaledPadding(EdgeInsetsDirectional.fromSTEB(12, 8, 16, 8), EdgeInsets.symmetric({ horizontal: 4 }), EdgeInsets.symmetric({ horizontal: 4 }), scale); return style.copyWith({ padding: insetsAll(padding) }); }
    override themeStyleOf(context: BuildContext): ButtonStyle | null { return TextButtonTheme.of(context).style; }
}
