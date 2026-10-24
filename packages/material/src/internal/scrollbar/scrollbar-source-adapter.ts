// SPDX-License-Identifier: BSD-3-Clause
// Actual Material Theme lookup; numeric ARGB is converted only at this boundary.
import { Theme } from "../../theme.ts";
import { ThemeData } from "../../theme-data.ts";
import { ColorScheme } from "../../color-scheme.ts";
import type { BuildContext } from "@nelyx/core/framework/widgets/framework";
import { Color } from "@nelyx/core/ui/color";
import { captureSourceColor } from "@nelyx/core/internal/ui/color-source-adapter";
import type { SourceScrollbarThemeData } from "../../generated/scrollbar/scrollbar-theme.generated.ts";
const schemes = new WeakMap<ColorScheme, ScrollbarColorScheme>();
const themes = new WeakMap<ThemeData, ScrollbarMaterialThemeData>();
export class ScrollbarColorScheme {
    readonly onSurface: Color;
    readonly secondary: Color;
    readonly brightness: 'light' | 'dark';
    constructor(source: ColorScheme) {
        this.onSurface = captureSourceColor(new Color(source.onSurface));
        this.secondary = captureSourceColor(new Color(source.secondary));
        this.brightness = source.brightness;
        Object.freeze(this);
    }
}
export class ScrollbarMaterialThemeData {
    readonly colorScheme: ScrollbarColorScheme;
    constructor(readonly source: ThemeData) {
        let scheme = schemes.get(source.colorScheme);
        if (!scheme) {
            scheme = new ScrollbarColorScheme(source.colorScheme);
            schemes.set(source.colorScheme, scheme);
        }
        this.colorScheme = scheme;
        Object.freeze(this);
    }
    get platform() {
        return this.source.platform;
    }
    get scrollbarTheme(): SourceScrollbarThemeData {
        return this.source.scrollbarTheme;
    }
    get highlightColor(): Color {
        return this.source.highlightColor;
    }
}
export class ScrollbarMaterialTheme {
    static of(context: BuildContext): ScrollbarMaterialThemeData {
        const source = Theme.of(context);
        let theme = themes.get(source);
        if (!theme) {
            theme = new ScrollbarMaterialThemeData(source);
            themes.set(source, theme);
        }
        return theme;
    }
}
