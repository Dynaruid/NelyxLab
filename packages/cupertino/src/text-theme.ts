// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional port of cupertino/text_theme.dart at Flutter
// 71e4717a61786faab4c7aa39825989305ed29e8a, on Core's ARGB TextStyle ABI.
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { FontWeight, TextDecoration } from '@nelyx/core/ui/typography';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { CupertinoColors } from './colors.ts';
import { cupertinoColorValue, cupertinoColorEquals, resolveCupertinoColor } from "./internal/colors/color-values.ts";
import type { CupertinoColor } from "./internal/colors/color-values.ts";
const roles = ['textStyle', 'actionTextStyle', 'actionSmallTextStyle', 'tabLabelTextStyle', 'navTitleTextStyle', 'navLargeTitleTextStyle', 'navActionTextStyle', 'pickerTextStyle', 'dateTimePickerTextStyle'] as const;
type Role = typeof roles[number];
export type CupertinoTextThemeDataOptions = {
    readonly primaryColor?: CupertinoColor | null;
} & {
    readonly [K in Role]?: TextStyle | null;
};
export interface CupertinoTextDefaults {
    readonly label: CupertinoColor;
    readonly inactive: CupertinoColor;
}
const defaultColors: CupertinoTextDefaults = Object.freeze({ label: CupertinoColors.label, inactive: CupertinoColors.inactiveGray });
export class CupertinoTextThemeData extends Diagnosticable(class {
}) {
    private readonly specified: Readonly<Record<Role, TextStyle | null>>;
    private readonly primary: CupertinoColor;
    private readonly defaults: CupertinoTextDefaults;
    private readonly values=new Map<Role,TextStyle>();
    private readonly resolvedColors:Readonly<{primary:number;label:number;inactive:number}>;
    constructor(options: CupertinoTextThemeDataOptions = {}, colors: CupertinoTextDefaults | null = null) {
        super();
        this.primary = options.primaryColor ?? CupertinoColors.systemBlue;
        this.defaults = colors ?? defaultColors;
        this.specified = Object.freeze({
            textStyle:options.textStyle??null,actionTextStyle:options.actionTextStyle??null,actionSmallTextStyle:options.actionSmallTextStyle??null,
            tabLabelTextStyle:options.tabLabelTextStyle??null,navTitleTextStyle:options.navTitleTextStyle??null,navLargeTitleTextStyle:options.navLargeTitleTextStyle??null,
            navActionTextStyle:options.navActionTextStyle??null,pickerTextStyle:options.pickerTextStyle??null,dateTimePickerTextStyle:options.dateTimePickerTextStyle??null
        });
        // Capture colours at construction as before; role styles are created
        // only when requested, like the pinned source's default getters.
        this.resolvedColors=Object.freeze({primary:cupertinoColorValue(this.primary),label:cupertinoColorValue(this.defaults.label),inactive:cupertinoColorValue(this.defaults.inactive)});
        if (new.target === CupertinoTextThemeData)
            Object.freeze(this);
    }
    private _styleForRole(role:Role):TextStyle {
        const existing=this.specified[role]??this.values.get(role);if(existing)return existing;
        const value=this._createDefaultStyle(role);this.values.set(role,value);return value;
    }
    private _createDefaultStyle(role:Role):TextStyle {
        const {primary,label,inactive}=this.resolvedColors;
        const ordinary = {
            inherit: false, fontFamily: 'CupertinoSystemText', fontSize: 17, letterSpacing: -0.41, decoration: TextDecoration.none
        };
        switch(role){
            case 'textStyle':return new TextStyle({ ...ordinary, color: label });
            case 'actionTextStyle':case 'navActionTextStyle':return new TextStyle({ ...ordinary, color: primary });
            case 'actionSmallTextStyle':return new TextStyle({
                ...ordinary, fontSize: 15, letterSpacing: -0.23, color: primary
            });
            case 'tabLabelTextStyle':return new TextStyle({
                inherit: false, fontFamily: 'CupertinoSystemText', fontSize: 10, fontWeight: FontWeight.w500, letterSpacing: -0.24, color: inactive
            });
            case 'navTitleTextStyle':return new TextStyle({
                inherit: false, fontFamily: 'CupertinoSystemText', fontSize: 17, fontWeight: FontWeight.w600, letterSpacing: -0.41, color: label
            });
            case 'navLargeTitleTextStyle':return new TextStyle({
                inherit: false, fontFamily: 'CupertinoSystemDisplay', fontSize: 34, fontWeight: FontWeight.w700, letterSpacing: 0.38, color: label
            });
            case 'pickerTextStyle':return new TextStyle({
                inherit: false, fontFamily: 'CupertinoSystemDisplay', fontSize: 21, fontWeight: FontWeight.w400, letterSpacing: -0.6, color: label
            });
            case 'dateTimePickerTextStyle':return new TextStyle({
                inherit: false, fontFamily: 'CupertinoSystemDisplay', fontSize: 21, fontWeight: FontWeight.normal, letterSpacing: 0.4, color: label
            });
        }
    }
    get primaryColor(): number {
        return cupertinoColorValue(this.primary);
    }
    get textStyle(): TextStyle {
        return this._styleForRole('textStyle');
    }
    get actionTextStyle(): TextStyle {
        return this._styleForRole('actionTextStyle');
    }
    get actionSmallTextStyle(): TextStyle {
        return this._styleForRole('actionSmallTextStyle');
    }
    get tabLabelTextStyle(): TextStyle {
        return this._styleForRole('tabLabelTextStyle');
    }
    get navTitleTextStyle(): TextStyle {
        return this._styleForRole('navTitleTextStyle');
    }
    get navLargeTitleTextStyle(): TextStyle {
        return this._styleForRole('navLargeTitleTextStyle');
    }
    get navActionTextStyle(): TextStyle {
        return this._styleForRole('navActionTextStyle');
    }
    get pickerTextStyle(): TextStyle {
        return this._styleForRole('pickerTextStyle');
    }
    get dateTimePickerTextStyle(): TextStyle {
        return this._styleForRole('dateTimePickerTextStyle');
    }
    copyWith(options: CupertinoTextThemeDataOptions = {}): CupertinoTextThemeData {
        const styles = Object.fromEntries(roles.map(role => [role, options[role] ?? this.specified[role]]));
        return new CupertinoTextThemeData({ ...styles, primaryColor: options.primaryColor ?? this.primary }, this.defaults);
    }
    resolveFrom(context: BuildContext): CupertinoTextThemeData {
        // Explicit Core TextStyles already carry resolved ARGB color fields.
        return new CupertinoTextThemeData({ ...this.specified, primaryColor: resolveCupertinoColor(this.primary, context) }, { label: resolveCupertinoColor(this.defaults.label, context), inactive: resolveCupertinoColor(this.defaults.inactive, context) });
    }
    equals(other: unknown): boolean {
        return this === other || other instanceof CupertinoTextThemeData && other.constructor === this.constructor && cupertinoColorEquals(this.primary, other.primary) &&
            cupertinoColorEquals(this.defaults.label, other.defaults.label) && cupertinoColorEquals(this.defaults.inactive, other.defaults.inactive) &&
            roles.every(role => this.specified[role] === other.specified[role] || this.specified[role]?.equals(other.specified[role]) === true);
    }
    get hashCode(): number {
        return roles.reduce((hash, role) => Math.imul(hash, 31) + (this.specified[role]?.hashCode ?? 0) | 0, cupertinoColorValue(this.primary) ^ cupertinoColorValue(this.defaults.label) ^ cupertinoColorValue(this.defaults.inactive));
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        const standard = new CupertinoTextThemeData();
        for (const role of roles)
            properties.add(new DiagnosticsProperty(role, this[role], { defaultValue: standard[role] }));
    }
}
class DefaultCupertinoTextThemeData extends CupertinoTextThemeData {
    constructor(primaryColor: CupertinoColor, private readonly label: CupertinoColor, private readonly inactive: CupertinoColor) {
        super({ primaryColor });
        Object.freeze(this);
    }
    override get textStyle(): TextStyle {
        return super.textStyle.copyWith({ color: cupertinoColorValue(this.label) });
    }
    override get tabLabelTextStyle(): TextStyle {
        return super.tabLabelTextStyle.copyWith({ color: cupertinoColorValue(this.inactive) });
    }
    override get navTitleTextStyle(): TextStyle {
        return super.navTitleTextStyle.copyWith({ color: cupertinoColorValue(this.label) });
    }
    override get navLargeTitleTextStyle(): TextStyle {
        return super.navLargeTitleTextStyle.copyWith({ color: cupertinoColorValue(this.label) });
    }
    override get pickerTextStyle(): TextStyle {
        return super.pickerTextStyle.copyWith({ color: cupertinoColorValue(this.label) });
    }
    override get dateTimePickerTextStyle(): TextStyle {
        return super.dateTimePickerTextStyle.copyWith({ color: cupertinoColorValue(this.label) });
    }
}
/** @internal ThemeData's source default helper; explicit styles remain separate. */
export function defaultCupertinoTextTheme(primary: CupertinoColor, colors: CupertinoTextDefaults): CupertinoTextThemeData {
    return new DefaultCupertinoTextThemeData(primary, colors.label, colors.inactive);
}
