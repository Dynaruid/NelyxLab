// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Full nondeprecated public field projection from retained resolved IR; functional Core build below.
import { invariant } from '@nelyx/core/foundation/errors';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { ImageProvider } from '@nelyx/core/framework/painting/image-provider';
import type { ImageErrorListener } from '@nelyx/core/framework/painting/image-stream';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { BuildContext,Widget,WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Icon } from '@nelyx/core/framework/widgets/icon';
import type { WidgetStateProperty,WidgetStatesController } from '@nelyx/core/framework/widgets/widget-state';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Color } from '@nelyx/core/ui/color';
import { buildSwitchListTile } from './internal/list/toggle-list-tile-build.ts';
import type { ListTileControlAffinity } from './list-tile.ts';
import type { MaterialTapTargetSize,VisualDensity } from './theme-data.ts';
export interface SwitchListTileOptions extends WidgetOptions {
    readonly id?: string;
    readonly value: boolean;
    readonly onChanged: ((value0: boolean) => void) | null;
    readonly activeThumbColor?: Color | null;
    readonly activeTrackColor?: Color | null;
    readonly inactiveThumbColor?: Color | null;
    readonly inactiveTrackColor?: Color | null;
    readonly activeThumbImage?: ImageProvider | null;
    readonly onActiveThumbImageError?: ImageErrorListener | null;
    readonly inactiveThumbImage?: ImageProvider | null;
    readonly onInactiveThumbImageError?: ImageErrorListener | null;
    readonly thumbColor?: WidgetStateProperty<Color | null> | null;
    readonly trackColor?: WidgetStateProperty<Color | null> | null;
    readonly trackOutlineColor?: WidgetStateProperty<Color | null> | null;
    readonly thumbIcon?: WidgetStateProperty<Icon | null> | null;
    readonly materialTapTargetSize?: MaterialTapTargetSize | null;
    readonly dragStartBehavior?: DragStartBehavior;
    readonly mouseCursor?: MouseCursor | null;
    readonly overlayColor?: WidgetStateProperty<Color | null> | null;
    /** @dartType double? */
    readonly splashRadius?: number | null;
    readonly focusNode?: FocusNode | null;
    readonly statesController?: WidgetStatesController | null;
    readonly onFocusChange?: ((value0: boolean) => void) | null;
    readonly autofocus?: boolean;
    readonly tileColor?: Color | null;
    readonly title?: Widget | null;
    readonly subtitle?: Widget | null;
    readonly secondary?: Widget | null;
    readonly isThreeLine?: boolean | null;
    readonly dense?: boolean | null;
    readonly contentPadding?: EdgeInsetsGeometry | null;
    readonly selected?: boolean;
    readonly controlAffinity?: ListTileControlAffinity | null;
    readonly shape?: ShapeBorder | null;
    readonly selectedTileColor?: Color | null;
    readonly visualDensity?: VisualDensity | null;
    readonly enableFeedback?: boolean | null;
    /** @dartType double? */
    readonly horizontalTitleGap?: number | null;
    /** @dartType double? */
    readonly minVerticalPadding?: number | null;
    /** @dartType double? */
    readonly minLeadingWidth?: number | null;
    /** @dartType double? */
    readonly minTileHeight?: number | null;
    readonly hoverColor?: Color | null;
    readonly internalAddSemanticForOnTap?: boolean;
}
export interface SwitchListTileAdaptiveOptions extends SwitchListTileOptions { readonly applyCupertinoTheme?: boolean | null; }
const adaptiveTiles = new WeakSet<Widget>();
export class SwitchListTile extends StatelessWidget {
    readonly options: Readonly<SwitchListTileAdaptiveOptions>;
    /**
     * @dartParam splashRadius double?
     * @dartParam horizontalTitleGap double?
     * @dartParam minVerticalPadding double?
     * @dartParam minLeadingWidth double?
     * @dartParam minTileHeight double?
     */
    constructor(options: SwitchListTileOptions) {
        super(options.key ?? null);
        invariant(!("activeColor" in options), 'deprecated-toggle-tile-option', 'SwitchListTile has no deprecated activeColor option');
        invariant(options.onChanged === null || typeof options.onChanged === 'function', 'invalid-toggle-tile-callback', 'SwitchListTile requires an explicit nullable callback');
        invariant(typeof options.value === 'boolean', 'invalid-switch-value', 'Switch value must be boolean');
        invariant(options.activeThumbImage != null || options.onActiveThumbImageError == null, 'invalid-switch-image-handler', 'An active thumb image is required for its error listener');
        invariant(options.inactiveThumbImage != null || options.onInactiveThumbImageError == null, 'invalid-switch-image-handler', 'An inactive thumb image is required for its error listener');
        invariant(options.isThreeLine !== true || options.subtitle != null, 'invalid-three-line-tile', 'A three-line tile requires a subtitle');
        this.options = Object.freeze({...options});
    }
    /**
     * @dartParam splashRadius double?
     * @dartParam horizontalTitleGap double?
     * @dartParam minVerticalPadding double?
     * @dartParam minLeadingWidth double?
     * @dartParam minTileHeight double?
     */
    static adaptive(options: SwitchListTileAdaptiveOptions): SwitchListTile { const result = new SwitchListTile(options); adaptiveTiles.add(result); return result; }
    get value(): boolean { return this.options.value; }
    get onChanged(): ((value0: boolean) => void) | null { return this.options.onChanged ?? null; }
    get activeThumbColor(): Color | null { return this.options.activeThumbColor ?? null; }
    get activeTrackColor(): Color | null { return this.options.activeTrackColor ?? null; }
    get inactiveThumbColor(): Color | null { return this.options.inactiveThumbColor ?? null; }
    get inactiveTrackColor(): Color | null { return this.options.inactiveTrackColor ?? null; }
    get activeThumbImage(): ImageProvider | null { return this.options.activeThumbImage ?? null; }
    get onActiveThumbImageError(): ImageErrorListener | null { return this.options.onActiveThumbImageError ?? null; }
    get inactiveThumbImage(): ImageProvider | null { return this.options.inactiveThumbImage ?? null; }
    get onInactiveThumbImageError(): ImageErrorListener | null { return this.options.onInactiveThumbImageError ?? null; }
    get thumbColor(): WidgetStateProperty<Color | null> | null { return this.options.thumbColor ?? null; }
    get trackColor(): WidgetStateProperty<Color | null> | null { return this.options.trackColor ?? null; }
    get trackOutlineColor(): WidgetStateProperty<Color | null> | null { return this.options.trackOutlineColor ?? null; }
    get thumbIcon(): WidgetStateProperty<Icon | null> | null { return this.options.thumbIcon ?? null; }
    get materialTapTargetSize(): MaterialTapTargetSize | null { return this.options.materialTapTargetSize ?? null; }
    get dragStartBehavior(): DragStartBehavior { return this.options.dragStartBehavior ?? DragStartBehavior.start; }
    get mouseCursor(): MouseCursor | null { return this.options.mouseCursor ?? null; }
    get overlayColor(): WidgetStateProperty<Color | null> | null { return this.options.overlayColor ?? null; }
    /** @dartType double? */
    get splashRadius(): number | null { return this.options.splashRadius ?? null; }
    get focusNode(): FocusNode | null { return this.options.focusNode ?? null; }
    get statesController(): WidgetStatesController | null { return this.options.statesController ?? null; }
    get onFocusChange(): ((value0: boolean) => void) | null { return this.options.onFocusChange ?? null; }
    get autofocus(): boolean { return this.options.autofocus ?? false; }
    get tileColor(): Color | null { return this.options.tileColor ?? null; }
    get title(): Widget | null { return this.options.title ?? null; }
    get subtitle(): Widget | null { return this.options.subtitle ?? null; }
    get secondary(): Widget | null { return this.options.secondary ?? null; }
    get isThreeLine(): boolean | null { return this.options.isThreeLine ?? null; }
    get dense(): boolean | null { return this.options.dense ?? null; }
    get contentPadding(): EdgeInsetsGeometry | null { return this.options.contentPadding ?? null; }
    get selected(): boolean { return this.options.selected ?? false; }
    get controlAffinity(): ListTileControlAffinity | null { return this.options.controlAffinity ?? null; }
    get shape(): ShapeBorder | null { return this.options.shape ?? null; }
    get selectedTileColor(): Color | null { return this.options.selectedTileColor ?? null; }
    get visualDensity(): VisualDensity | null { return this.options.visualDensity ?? null; }
    get enableFeedback(): boolean | null { return this.options.enableFeedback ?? null; }
    /** @dartType double? */
    get horizontalTitleGap(): number | null { return this.options.horizontalTitleGap ?? null; }
    /** @dartType double? */
    get minVerticalPadding(): number | null { return this.options.minVerticalPadding ?? null; }
    /** @dartType double? */
    get minLeadingWidth(): number | null { return this.options.minLeadingWidth ?? null; }
    /** @dartType double? */
    get minTileHeight(): number | null { return this.options.minTileHeight ?? null; }
    get hoverColor(): Color | null { return this.options.hoverColor ?? null; }
    get applyCupertinoTheme(): boolean | null { return adaptiveTiles.has(this) ? this.options.applyCupertinoTheme ?? null : false; }
    get internalAddSemanticForOnTap(): boolean { return this.options.internalAddSemanticForOnTap ?? false; }
    build(context: BuildContext): Widget { return buildSwitchListTile(this, context, adaptiveTiles.has(this)); }
}
