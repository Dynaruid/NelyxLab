// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source composition using current Core Container/border/layout owners; ARGB paint ABI.
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { SizedBox, Center } from '@nelyx/core/framework/widgets/basic';
import { Container } from '@nelyx/core/framework/widgets/container';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { Border } from '@nelyx/core/framework/painting/box-border';
import { BorderSide, withSourceBorderSideColor } from '@nelyx/core/framework/painting/borders';
import { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { BorderRadiusGeometry } from '@nelyx/core/framework/painting/border-radius';
import { Color } from '@nelyx/core/ui/color';
import { invariant } from '@nelyx/core/foundation/errors';
import { Theme } from './theme.ts';
import { DividerTheme, DividerThemeData } from './divider-theme.ts';

interface DividerLineOptions extends WidgetOptions {

    /** @dartType double? */
    readonly thickness?: number | null;

    /** @dartType double? */
    readonly indent?: number | null;

    /** @dartType double? */
    readonly endIndent?: number | null;


    readonly color?: Color | null;
    readonly radius?: BorderRadiusGeometry | null;


}
export interface DividerOptions extends DividerLineOptions {
    /** @dartType double? */
    readonly height?: number | null;
}
export interface VerticalDividerOptions extends DividerLineOptions {
    /** @dartType double? */
    readonly width?: number | null;
}
function defaults(context: BuildContext): DividerThemeData {


    const theme = Theme.of(context);


    return new DividerThemeData({
space: 16, thickness: 1, indent: 0, endIndent: 0,
        color: new Color(theme.colorScheme.outlineVariant)
});


}
// ColorScheme follows the existing ARGB public ABI; BorderSide retains a source Color.
function validate(o: DividerLineOptions, extent: number | null | undefined): void {


    for (const v of [extent, o.thickness, o.indent, o.endIndent]) invariant(v == null || v >= 0, 'invalid-divider-dimension', 'Divider dimensions must be nonnegative');


}
export class Divider extends StatelessWidget {

    /** @dartType double? */
    readonly height: number | null;

    /** @dartType double? */
    readonly thickness: number | null;

    /** @dartType double? */
    readonly indent: number | null;

    /** @dartType double? */
    readonly endIndent: number | null;


    readonly color: Color | null;
    readonly radius: BorderRadiusGeometry | null;

    /**
     * @dartParam height double?
     * @dartParam thickness double?
     * @dartParam indent double?
     * @dartParam endIndent double?
     */

    constructor(o: DividerOptions = {}) {
        super(o.key ?? null);
        validate(o, o.height);
        this.height = o.height ?? null;
        this.thickness = o.thickness ?? null;
        this.indent = o.indent ?? null;
        this.endIndent = o.endIndent ?? null;
        this.color = o.color ?? null;
        this.radius = o.radius ?? null;
    }

    /** @dartParam width double? */

    static createBorderSide(context: BuildContext | null, { color = null, width = null }: { readonly color?: Color | null; readonly width?: number | null } = {}): BorderSide {


        const theme = context === null ? null : DividerTheme.of(context), fallback = context === null ? null : defaults(context), effectiveColor = color ?? theme?.color ?? fallback?.color;


        const side = new BorderSide({ width: width ?? theme?.thickness ?? fallback?.thickness ?? 0, ...(effectiveColor ? { color: effectiveColor.toARGB32() } : {}) });


        return effectiveColor ? withSourceBorderSideColor(side, effectiveColor) : side;


    }


    build(context: BuildContext): Widget {


        const theme = DividerTheme.of(context), fallback = defaults(context), height = this.height ?? theme.space ?? fallback.space!, thickness = this.thickness ?? theme.thickness ?? fallback.thickness!,
            indent = this.indent ?? theme.indent ?? fallback.indent!, endIndent = this.endIndent ?? theme.endIndent ?? fallback.endIndent!;


        return new SizedBox(undefined, height, new Center(new Container({
height: thickness, margin: EdgeInsetsDirectional.only({ start: indent, end: endIndent }),
            decoration: new BoxDecoration({ borderRadius: this.radius ?? theme.radius ?? fallback.radius, border: new Border({ bottom: Divider.createBorderSide(context, { color: this.color, width: thickness }) }) })
})));


    }


}
export class VerticalDivider extends StatelessWidget {

    /** @dartType double? */
    readonly width: number | null;

    /** @dartType double? */
    readonly thickness: number | null;

    /** @dartType double? */
    readonly indent: number | null;

    /** @dartType double? */
    readonly endIndent: number | null;


    readonly color: Color | null;
    readonly radius: BorderRadiusGeometry | null;

    /**
     * @dartParam width double?
     * @dartParam thickness double?
     * @dartParam indent double?
     * @dartParam endIndent double?
     */

    constructor(o: VerticalDividerOptions = {}) {
        super(o.key ?? null);
        validate(o, o.width);
        this.width = o.width ?? null;
        this.thickness = o.thickness ?? null;
        this.indent = o.indent ?? null;
        this.endIndent = o.endIndent ?? null;
        this.color = o.color ?? null;
        this.radius = o.radius ?? null;
    }


    build(context: BuildContext): Widget {


        const theme = DividerTheme.of(context), fallback = defaults(context), width = this.width ?? theme.space ?? fallback.space!, thickness = this.thickness ?? theme.thickness ?? fallback.thickness!,
            indent = this.indent ?? theme.indent ?? fallback.indent!, endIndent = this.endIndent ?? theme.endIndent ?? fallback.endIndent!;


        return new SizedBox(width, undefined, new Center(new Container({
width: thickness, margin: EdgeInsetsDirectional.only({ top: indent, bottom: endIndent }),
            decoration: new BoxDecoration({ borderRadius: this.radius ?? theme.radius ?? fallback.radius, border: new Border({ left: Divider.createBorderSide(context, { color: this.color, width: thickness }) }) })
})));


    }


}
