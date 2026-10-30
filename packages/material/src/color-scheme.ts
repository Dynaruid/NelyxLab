// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Nelyx ARGB role API, with pinned Flutter M3 ThemeData token defaults.
import { Color } from '@nelyx/core/ui/color';
import {assertSourceColorInterface} from '@nelyx/core/ui/color-source';
import {invariant} from '@nelyx/core/foundation/errors';
import {Diagnosticable} from '@nelyx/core/foundation/diagnosticable';
import {DiagnosticsProperty} from '@nelyx/core/foundation/diagnostics';
import type {DiagnosticPropertiesBuilder} from '@nelyx/core/foundation/diagnostics';
import {DynamicSchemeVariant} from './dynamic-scheme-variant.ts';
import {seedColorRoles} from './internal/color-scheme/dynamic-scheme.ts';
import {imageProviderPixels} from './internal/color-scheme/image-provider-colors.ts';
import {materialImageSeed} from './internal/color-scheme/image-colors.ts';
import type {ImageProvider} from '@nelyx/core/framework/painting/image-provider';
import type {ImageConfiguration} from '@nelyx/core/framework/painting/image-configuration';
import type {RasterizationService} from '@nelyx/core/hosting/rasterization';
export {DynamicSchemeVariant} from './dynamic-scheme-variant.ts';
import { m3LightColorRoles, m3DarkColorRoles } from "./generated/theme/color-scheme-data.ts";
export type ColorRole = Exclude<keyof typeof m3LightColorRoles, 'brightness' | 'background' | 'onBackground' | 'surfaceVariant'>;
export type ColorSchemeOptions = Partial<Readonly<Record<ColorRole, number | null>>> & {
    readonly brightness?: 'light' | 'dark' | null;
};
export interface ColorSchemeFromSeedOptions extends ColorSchemeOptions {
    readonly brightness?: 'light' | 'dark';
    readonly seedColor: Color | number;
    readonly dynamicSchemeVariant?: DynamicSchemeVariant;
    /** @dartType double */ readonly contrastLevel?: number;
}
export interface ColorSchemeFromImageOptions extends Omit<ColorSchemeFromSeedOptions, 'seedColor'> {
    readonly provider: ImageProvider;
    /** Nelyx requires explicit View owners instead of a global painting binding. */
    readonly configuration: ImageConfiguration;
    readonly rasterizer: RasterizationService;
}
const deprecatedRoles = ['background', 'onBackground', 'surfaceVariant'];
const roles = Object.keys(m3LightColorRoles).filter(key => key !== 'brightness' && !deprecatedRoles.includes(key)) as ColorRole[];
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging -- The constructor explicitly initializes the interface fields through validated property assignment.
export interface ColorScheme extends Readonly<Record<ColorRole, number>> {
}
export class ColorScheme extends Diagnosticable(class {}) {
    readonly brightness: 'light' | 'dark';
    constructor(options: ColorSchemeOptions = {}) {
        super();
        invariant(!deprecatedRoles.some(role => Object.hasOwn(options, role)), 'deprecated-color-role', 'Use surface, onSurface and surfaceContainerHighest instead of deprecated ColorScheme roles');
        this.brightness = options.brightness ?? 'light';
        invariant(this.brightness === 'light' || this.brightness === 'dark', 'invalid-color-scheme-brightness', 'ColorScheme brightness must be light or dark');
        const defaults = this.brightness === 'dark' ? m3DarkColorRoles : m3LightColorRoles;
        for (const role of roles)
            Object.defineProperty(this, role, { value: new Color(options[role] ?? defaults[role]).toARGB32(), enumerable: true });
        Object.freeze(this);
    }
    copyWith(options: ColorSchemeOptions = {}): ColorScheme {
        invariant(!deprecatedRoles.some(role => Object.hasOwn(options, role)), 'deprecated-color-role', 'Deprecated ColorScheme roles have been removed');
        return new ColorScheme({ ...Object.fromEntries(roles.map(role => [role, options[role] ?? this[role]])), brightness: options.brightness ?? this.brightness });
    }
    /** @dartParam contrastLevel double */
    static fromSeed(options: ColorSchemeFromSeedOptions): ColorScheme {
        invariant(!deprecatedRoles.some(role => Object.hasOwn(options, role)), 'deprecated-color-role', 'Deprecated ColorScheme roles have been removed');
        const {seedColor, brightness = 'light', dynamicSchemeVariant = DynamicSchemeVariant.tonalSpot, contrastLevel = 0, ...overrides} = options;
        invariant(brightness === 'light' || brightness === 'dark', 'invalid-color-scheme-brightness', 'ColorScheme brightness must be light or dark');
        if (typeof seedColor !== 'number') {
            assertSourceColorInterface(seedColor);
            invariant([seedColor.a, seedColor.r, seedColor.g, seedColor.b].every(Number.isFinite), 'invalid-seed-color', 'Seed color components must be finite');
        }
        const argb = typeof seedColor === 'number' ? new Color(seedColor).toARGB32() : seedColor.toARGB32();
        return new ColorScheme({...seedColorRoles(argb, brightness, dynamicSchemeVariant, contrastLevel, roles), ...Object.fromEntries(roles.filter(role => overrides[role] != null).map(role => [role, overrides[role]])), brightness});
    }
    /** @dartParam contrastLevel double */
    static async fromImageProvider({provider, configuration, rasterizer, ...options}: ColorSchemeFromImageOptions): Promise<ColorScheme> {
        const pixels = await imageProviderPixels(provider, configuration, rasterizer);
        return ColorScheme.fromSeed({...options, seedColor: materialImageSeed(pixels)});
    }
    /** @dartParam t double */
    static lerp(a: ColorScheme, b: ColorScheme, t: number): ColorScheme {
        if (a === b) return a;
        return new ColorScheme({ ...Object.fromEntries(roles.map(role => [role, Color.lerp(new Color(a[role]), new Color(b[role]), t)!.toARGB32()])), brightness: t < 0.5 ? a.brightness : b.brightness });
    }
    equals(other: unknown): boolean {
        return this === other || other instanceof ColorScheme && other.constructor === this.constructor && other.brightness === this.brightness && roles.every(role => other[role] === this[role]);
    }
    /** @dartReturn int */
    get hashCode(): number {
        return roles.reduce((hash, role) => Math.imul(hash, 31) + this[role] | 0, this.brightness === 'light' ? 0 : 1);
    }
    debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        properties.add(new DiagnosticsProperty('brightness', this.brightness));
        for (const role of roles) properties.add(new DiagnosticsProperty(role, new Color(this[role])));
    }
}
