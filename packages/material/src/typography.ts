// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// M3-only Typography. Doroti typography.cs responsibilities; pinned Flutter values/methods.
import {Diagnosticable} from '@nelyx/core/foundation/diagnosticable';
import {DiagnosticsProperty} from '@nelyx/core/foundation/diagnostics';
import type {DiagnosticPropertiesBuilder} from '@nelyx/core/foundation/diagnostics';
import type {TargetPlatform} from '@nelyx/core/foundation/platform';
import {invariant} from '@nelyx/core/foundation/errors';
import {hashValues} from '@nelyx/core/framework/painting/value-equality';
import {TextTheme} from './text-theme.ts';
import {ColorScheme} from './color-scheme.ts';
import {ScriptCategory} from './script-category.ts';
import {material2021, platformTextThemes} from './generated/theme/typography-data.ts';
import {platformTypographyNames} from './internal/theme/text-theme-defaults.ts';
export {ScriptCategory} from './script-category.ts';

const fields = ['black', 'white', 'englishLike', 'dense', 'tall'] as const;
type TypographyValues = Readonly<Record<typeof fields[number], TextTheme>>;
export type TypographyCopyOptions = {readonly [K in keyof TypographyValues]?: TextTheme | null};
export interface TypographyOptions extends TypographyCopyOptions {
    readonly platform?: TargetPlatform | null;
    readonly colorScheme?: ColorScheme;
}
const rawValues = Symbol('Typography.raw');
type InternalTypographyOptions = TypographyOptions & {readonly [rawValues]?: TypographyValues};

export class Typography extends Diagnosticable(class {}) {
    private readonly values: TypographyValues;
    constructor(options?: TypographyOptions);
    constructor(options: InternalTypographyOptions = {}) {
        super();
        if (options[rawValues]) {
            this.values = Object.freeze({...options[rawValues]});
        } else {
            const {platform = 'android', colorScheme = new ColorScheme()} = options;
            invariant(platform !== null || options.black != null && options.white != null, 'invalid-typography-platform', 'A null platform requires both black and white text themes');
            const names = platform === null ? null : platformTypographyNames(platform);
            const dark = colorScheme.brightness === 'light' ? colorScheme.onSurface : colorScheme.surface;
            const light = colorScheme.brightness === 'light' ? colorScheme.surface : colorScheme.onSurface;
            this.values = Object.freeze({
                black: (options.black ?? Typography[names![0]]).apply({displayColor: dark, bodyColor: dark, decorationColor: dark}),
                white: (options.white ?? Typography[names![1]]).apply({displayColor: light, bodyColor: light, decorationColor: light}),
                englishLike: options.englishLike ?? Typography.englishLike2021,
                dense: options.dense ?? Typography.dense2021,
                tall: options.tall ?? Typography.tall2021,
            });
        }
        Object.freeze(this);
    }
    get black(): TextTheme {return this.values.black;}
    get white(): TextTheme {return this.values.white;}
    get englishLike(): TextTheme {return this.values.englishLike;}
    get dense(): TextTheme {return this.values.dense;}
    get tall(): TextTheme {return this.values.tall;}
    static material2021(options: TypographyOptions = {}): Typography {return new Typography(options);}
    private static fromValues(values: TypographyValues): Typography {
        const options: InternalTypographyOptions = {[rawValues]: values};
        return new Typography(options);
    }
    geometryThemeFor(category: ScriptCategory): TextTheme {
        invariant(ScriptCategory.values.includes(category), 'invalid-script-category', 'Expected a canonical ScriptCategory');
        if (category === ScriptCategory.dense) return this.dense;
        if (category === ScriptCategory.tall) return this.tall;
        return this.englishLike;
    }
    copyWith(options: TypographyCopyOptions = {}): Typography {
        return Typography.fromValues({
            black: options.black ?? this.black, white: options.white ?? this.white,
            englishLike: options.englishLike ?? this.englishLike, dense: options.dense ?? this.dense, tall: options.tall ?? this.tall,
        });
    }
    /** @dartParam t double */
    static lerp(a: Typography, b: Typography, t: number): Typography {
        if (a === b) return a;
        return Typography.fromValues({
            black: TextTheme.lerp(a.black, b.black, t), white: TextTheme.lerp(a.white, b.white, t),
            englishLike: TextTheme.lerp(a.englishLike, b.englishLike, t), dense: TextTheme.lerp(a.dense, b.dense, t), tall: TextTheme.lerp(a.tall, b.tall, t),
        });
    }
    equals(other: unknown): boolean {
        return this === other || other instanceof Typography && other.constructor === this.constructor && fields.every(field => this[field].equals(other[field]));
    }
    /** @dartReturn int */
    get hashCode(): number {return hashValues(...fields.map(field => this[field].hashCode));}
    debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        const defaults = Typography.material2021();
        for (const field of fields) properties.add(new DiagnosticsProperty(field, this[field], {defaultValue: defaults[field]}));
    }
    static readonly blackMountainView = new TextTheme(platformTextThemes.blackMountainView);
    static readonly whiteMountainView = new TextTheme(platformTextThemes.whiteMountainView);
    static readonly blackRedmond = new TextTheme(platformTextThemes.blackRedmond);
    static readonly whiteRedmond = new TextTheme(platformTextThemes.whiteRedmond);
    static readonly blackHelsinki = new TextTheme(platformTextThemes.blackHelsinki);
    static readonly whiteHelsinki = new TextTheme(platformTextThemes.whiteHelsinki);
    static readonly blackCupertino = new TextTheme(platformTextThemes.blackCupertino);
    static readonly whiteCupertino = new TextTheme(platformTextThemes.whiteCupertino);
    static readonly blackRedwoodCity = new TextTheme(platformTextThemes.blackRedwoodCity);
    static readonly whiteRedwoodCity = new TextTheme(platformTextThemes.whiteRedwoodCity);
    static readonly englishLike2021 = new TextTheme(material2021.englishLike);
    static readonly dense2021 = new TextTheme(material2021.dense);
    static readonly tall2021 = new TextTheme(material2021.tall);
}
