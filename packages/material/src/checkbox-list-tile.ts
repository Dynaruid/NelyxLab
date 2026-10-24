// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Full nondeprecated public field projection from retained resolved IR; functional Core build below.
import { invariant } from '@nelyx/core/foundation/errors';
import type { BorderSide,OutlinedBorder,ShapeBorder } from '@nelyx/core/framework/painting/borders';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { BuildContext,Widget,WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { WidgetStateProperty,WidgetStatesController } from '@nelyx/core/framework/widgets/widget-state';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Color } from '@nelyx/core/ui/color';
import { buildCheckboxListTile } from './internal/list/toggle-list-tile-build.ts';
import type { ListTileControlAffinity,ListTileTitleAlignment } from './list-tile.ts';
import type { MaterialTapTargetSize,VisualDensity } from './theme-data.ts';
export interface CheckboxListTileOptions extends WidgetOptions {
    readonly id?: string;
    readonly value: boolean | null;
    readonly onChanged: ((value0: boolean | null) => void) | null;
    readonly mouseCursor?: MouseCursor | null;
    readonly activeColor?: Color | null;
    readonly fillColor?: WidgetStateProperty<Color | null> | null;
    readonly checkColor?: Color | null;
    readonly hoverColor?: Color | null;
    readonly overlayColor?: WidgetStateProperty<Color | null> | null;
    /** @dartType double? */
    readonly splashRadius?: number | null;
    readonly materialTapTargetSize?: MaterialTapTargetSize | null;
    readonly visualDensity?: VisualDensity | null;
    readonly focusNode?: FocusNode | null;
    readonly statesController?: WidgetStatesController | null;
    readonly autofocus?: boolean;
    readonly shape?: ShapeBorder | null;
    readonly side?: BorderSide | null;
    readonly isError?: boolean;
    readonly tileColor?: Color | null;
    readonly title?: Widget | null;
    readonly subtitle?: Widget | null;
    readonly secondary?: Widget | null;
    readonly isThreeLine?: boolean | null;
    readonly dense?: boolean | null;
    readonly selected?: boolean;
    readonly controlAffinity?: ListTileControlAffinity | null;
    readonly contentPadding?: EdgeInsetsGeometry | null;
    readonly tristate?: boolean;
    readonly checkboxShape?: OutlinedBorder | null;
    readonly selectedTileColor?: Color | null;
    readonly onFocusChange?: ((value0: boolean) => void) | null;
    readonly enableFeedback?: boolean | null;
    /** @dartType double? */
    readonly horizontalTitleGap?: number | null;
    /** @dartType double? */
    readonly minVerticalPadding?: number | null;
    /** @dartType double? */
    readonly minLeadingWidth?: number | null;
    /** @dartType double? */
    readonly minTileHeight?: number | null;
    readonly enabled?: boolean | null;
    readonly titleAlignment?: ListTileTitleAlignment | null;
    readonly internalAddSemanticForOnTap?: boolean;
    /** @dartType double */
    readonly checkboxScaleFactor?: number;
    readonly checkboxSemanticLabel?: string | null;
}
const adaptiveTiles = new WeakSet<Widget>();
export class CheckboxListTile extends StatelessWidget {
    readonly options: Readonly<CheckboxListTileOptions>;
    /**
     * @dartParam splashRadius double?
     * @dartParam horizontalTitleGap double?
     * @dartParam minVerticalPadding double?
     * @dartParam minLeadingWidth double?
     * @dartParam minTileHeight double?
     * @dartParam checkboxScaleFactor double
     */
    constructor(options: CheckboxListTileOptions) {
        super(options.key ?? null);
        invariant(options.onChanged === null || typeof options.onChanged === 'function', 'invalid-toggle-tile-callback', 'CheckboxListTile requires an explicit nullable callback');
        invariant(typeof options.value === 'boolean' || options.value === null && options.tristate === true, 'invalid-checkbox-value', 'Null checkbox values require tristate');
        invariant(options.isThreeLine !== true || options.subtitle != null, 'invalid-three-line-tile', 'A three-line tile requires a subtitle');
        this.options = Object.freeze({...options});
    }
    /**
     * @dartParam splashRadius double?
     * @dartParam horizontalTitleGap double?
     * @dartParam minVerticalPadding double?
     * @dartParam minLeadingWidth double?
     * @dartParam minTileHeight double?
     * @dartParam checkboxScaleFactor double
     */
    static adaptive(options: CheckboxListTileOptions): CheckboxListTile { const result = new CheckboxListTile(options); adaptiveTiles.add(result); return result; }
    get value(): boolean | null { return this.options.value ?? null; }
    get onChanged(): ((value0: boolean | null) => void) | null { return this.options.onChanged ?? null; }
    get mouseCursor(): MouseCursor | null { return this.options.mouseCursor ?? null; }
    get activeColor(): Color | null { return this.options.activeColor ?? null; }
    get fillColor(): WidgetStateProperty<Color | null> | null { return this.options.fillColor ?? null; }
    get checkColor(): Color | null { return this.options.checkColor ?? null; }
    get hoverColor(): Color | null { return this.options.hoverColor ?? null; }
    get overlayColor(): WidgetStateProperty<Color | null> | null { return this.options.overlayColor ?? null; }
    /** @dartType double? */
    get splashRadius(): number | null { return this.options.splashRadius ?? null; }
    get materialTapTargetSize(): MaterialTapTargetSize | null { return this.options.materialTapTargetSize ?? null; }
    get visualDensity(): VisualDensity | null { return this.options.visualDensity ?? null; }
    get focusNode(): FocusNode | null { return this.options.focusNode ?? null; }
    get statesController(): WidgetStatesController | null { return this.options.statesController ?? null; }
    get autofocus(): boolean { return this.options.autofocus ?? false; }
    get shape(): ShapeBorder | null { return this.options.shape ?? null; }
    get side(): BorderSide | null { return this.options.side ?? null; }
    get isError(): boolean { return this.options.isError ?? false; }
    get tileColor(): Color | null { return this.options.tileColor ?? null; }
    get title(): Widget | null { return this.options.title ?? null; }
    get subtitle(): Widget | null { return this.options.subtitle ?? null; }
    get secondary(): Widget | null { return this.options.secondary ?? null; }
    get isThreeLine(): boolean | null { return this.options.isThreeLine ?? null; }
    get dense(): boolean | null { return this.options.dense ?? null; }
    get selected(): boolean { return this.options.selected ?? false; }
    get controlAffinity(): ListTileControlAffinity | null { return this.options.controlAffinity ?? null; }
    get contentPadding(): EdgeInsetsGeometry | null { return this.options.contentPadding ?? null; }
    get tristate(): boolean { return this.options.tristate ?? false; }
    get checkboxShape(): OutlinedBorder | null { return this.options.checkboxShape ?? null; }
    get selectedTileColor(): Color | null { return this.options.selectedTileColor ?? null; }
    get onFocusChange(): ((value0: boolean) => void) | null { return this.options.onFocusChange ?? null; }
    get enableFeedback(): boolean | null { return this.options.enableFeedback ?? null; }
    /** @dartType double? */
    get horizontalTitleGap(): number | null { return this.options.horizontalTitleGap ?? null; }
    /** @dartType double? */
    get minVerticalPadding(): number | null { return this.options.minVerticalPadding ?? null; }
    /** @dartType double? */
    get minLeadingWidth(): number | null { return this.options.minLeadingWidth ?? null; }
    /** @dartType double? */
    get minTileHeight(): number | null { return this.options.minTileHeight ?? null; }
    get enabled(): boolean | null { return this.options.enabled ?? null; }
    get titleAlignment(): ListTileTitleAlignment | null { return this.options.titleAlignment ?? null; }
    get internalAddSemanticForOnTap(): boolean { return this.options.internalAddSemanticForOnTap ?? false; }
    /** @dartType double */
    get checkboxScaleFactor(): number { return this.options.checkboxScaleFactor ?? 1; }
    get checkboxSemanticLabel(): string | null { return this.options.checkboxSemanticLabel ?? null; }
    build(context: BuildContext): Widget { return buildCheckboxListTile(this, context, adaptiveTiles.has(this)); }
}
