// SPDX-License-Identifier: BSD-3-Clause
// Source nullable/stateful interpolation over canonical Core value owners.
import { WidgetStateProperty, WidgetStateBorderSide } from '@nelyx/core/framework/widgets/widget-state';
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { dartDoubleType, nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
import { Color } from '@nelyx/core/ui/color';
import { sourceColorType } from '@nelyx/core/ui/color-source';
import { Size } from '@nelyx/core/ui/size';
import { sourceSizeType, sourceSizeLerp } from '@nelyx/core/ui/size-source';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { ShapeBorder, OutlinedBorder, BorderSide } from '@nelyx/core/framework/painting/borders';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { sourceIconThemeDataType, captureSourceIconThemeData } from '@nelyx/core/internal/framework/widgets/source-value-types';
import { sourceTextStyleType, sourceEdgeInsetsGeometryType, sourceOutlinedBorderType, captureSourceTextStyle, captureSourceEdgeInsetsGeometry, captureSourceOutlinedBorder } from '@nelyx/core/internal/framework/painting/source-value-types';
import { emptyWidgetStateSet } from '@nelyx/core/internal/framework/widgets/widget-state-full-collections';
import type { SystemUiOverlayStyle } from '@nelyx/core/services/system-ui-overlay-style';
type Property<T extends {}> = WidgetStateProperty<T | null> | null;
export function lerpColorProperty(a: Property<Color>, b: Property<Color>, t: number): Property<Color> {
    return WidgetStateProperty.lerp<Color | null>(nullableDartType(sourceColorType), a, b, t, Color.lerp);
}
export function lerpDoubleProperty(a: Property<DartDouble>, b: Property<DartDouble>, t: number): Property<DartDouble> {
    return WidgetStateProperty.lerp(nullableDartType(dartDoubleType), a, b, t, (x, y, q) => {
        if (x !== null && !DartDouble.is(x) || y !== null && !DartDouble.is(y)) throw new TypeError('Numeric properties require retained DartDouble provenance');
        if (x === null && y === null) return null;
        if (x === y) return x;
        return DartDouble.fromSource(lerpDouble(x?.value ?? null, y?.value ?? null, q)!);
    });
}
export function lerpTextStyleProperty(a: Property<TextStyle>, b: Property<TextStyle>, t: number): Property<TextStyle> {
    return WidgetStateProperty.lerp(nullableDartType(sourceTextStyleType), a, b, t, (x, y, q) => {
        const value = TextStyle.lerp(x, y, q); return value === null ? null : captureSourceTextStyle(value);
    });
}
export function lerpEdgeInsetsGeometryProperty(a: Property<EdgeInsetsGeometry>, b: Property<EdgeInsetsGeometry>, t: number): Property<EdgeInsetsGeometry> {
    return WidgetStateProperty.lerp(nullableDartType(sourceEdgeInsetsGeometryType), a, b, t, (x, y, q) => {
        const value = EdgeInsetsGeometry.lerp(x, y, q); return value === null ? null : captureSourceEdgeInsetsGeometry(value);
    });
}
export function lerpSizeProperty(a: Property<Size>, b: Property<Size>, t: number): Property<Size> {
    return WidgetStateProperty.lerp<Size | null>(nullableDartType(sourceSizeType), a, b, t, sourceSizeLerp);
}
export function lerpOutlinedBorderProperty(a: Property<OutlinedBorder>, b: Property<OutlinedBorder>, t: number): Property<OutlinedBorder> {
    return WidgetStateProperty.lerp(nullableDartType(sourceOutlinedBorderType), a, b, t, (x, y, q) => {
        const value = OutlinedBorder.lerp(x, y, q); return value === null ? null : captureSourceOutlinedBorder(value);
    });
}
export function lerpIconThemeDataProperty(a: Property<IconThemeData>, b: Property<IconThemeData>, t: number): Property<IconThemeData> {
    return WidgetStateProperty.lerp(nullableDartType(sourceIconThemeDataType), a, b, t, (x, y, q) => captureSourceIconThemeData(IconThemeData.lerp(x, y, q)));
}
export function checkedOutlinedBorder(value: ShapeBorder | null): OutlinedBorder | null {
    if (value !== null && !(value instanceof OutlinedBorder)) throw new TypeError('Source interpolation requires an OutlinedBorder');
    return value;
}
export function lerpSearchSides(a: BorderSide | null, b: BorderSide | null, t: number): BorderSide | null {
    if (a === null && b === null) return null;
    if (a instanceof WidgetStateBorderSide) a = a.resolve(emptyWidgetStateSet());
    if (b instanceof WidgetStateBorderSide) b = b.resolve(emptyWidgetStateSet());
    // Source assertions deliberately reject two stateful sides resolving null.
    if (a === null && b === null) throw new TypeError('Source search side interpolation requires a resolved side');
    a ??= new BorderSide({ width: 0, color: b!.color & 0x00ffffff });
    b ??= new BorderSide({ width: 0, color: a.color & 0x00ffffff });
    return BorderSide.lerp(a, b, t);
}
// Pinned date picker helper deliberately fades a non-null a, even when b is
// non-null. Keep the source decision distinct from search-side interpolation.
/** @dartParam t double */
export function lerpDatePickerSide(a: BorderSide | null, b: BorderSide | null, t: number): BorderSide | null {
    if (a === b) return a;
    if (a === null) return BorderSide.lerp(new BorderSide({ width: 0, color: b!.color & 0x00ffffff }), b!, t);
    return BorderSide.lerp(a, new BorderSide({ width: 0, color: a.color & 0x00ffffff }), t);
}
export function describeSystemUiOverlayStyle(value: SystemUiOverlayStyle | null): string | null {
    if (value === null) return null;
    const names = ['systemNavigationBarColor', 'systemNavigationBarDividerColor', 'systemNavigationBarIconBrightness', 'statusBarColor', 'statusBarBrightness', 'statusBarIconBrightness', 'systemStatusBarContrastEnforced', 'systemNavigationBarContrastEnforced'] as const;
    const parts: string[] = [];
    for (const name of names) {
        const field = value[name];
        if (field !== null) parts.push(name + ': ' + (typeof field === 'string' ? 'Brightness.' + field : String(field)));
    }
    return 'SystemUiOverlayStyle(' + parts.join(', ') + ')';
}
