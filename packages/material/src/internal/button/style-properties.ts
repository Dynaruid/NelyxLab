// SPDX-License-Identifier: BSD-3-Clause
// Source generic properties retain the actual Core owner and numeric provenance.
import { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { dartDoubleType, nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import type { DartTypeWitness } from '@nelyx/core/foundation/dart-type-witness';
import { Color } from '@nelyx/core/ui/color';
import { captureSourceColor, sourceColorType } from '@nelyx/core/ui/color-source';
import { Size } from '@nelyx/core/ui/size';
import { captureSourceSize, sourceSizeType } from '@nelyx/core/ui/size-source';
import { sourceMouseCursorType, captureSourceMouseCursor } from '@nelyx/core/framework/widgets/widget-state-mouse-cursor';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { sourceBorderSideType, captureSourceBorderSide } from '@nelyx/core/framework/widgets/widget-state-border-side';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import type { OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { sourceTextStyleType, sourceEdgeInsetsGeometryType, sourceOutlinedBorderType, captureSourceTextStyle, captureSourceEdgeInsetsGeometry, captureSourceOutlinedBorder } from '@nelyx/core/internal/framework/painting/source-value-types';
export function mapped<T extends {}>(type: DartTypeWitness<T>, resolve: (states: DartSet<WidgetState>) => T | null, admit: (value: T) => T): WidgetStateProperty<T | null> {
    return WidgetStateProperty.resolveWith(nullableDartType(type), states => { const value = resolve(states); return value === null ? null : admit(value); });
}
export const colorProperty = (resolve: (states: DartSet<WidgetState>) => Color | null): WidgetStateProperty<Color | null> => mapped(sourceColorType, resolve, captureSourceColor);
export const colorAll = (color: Color | null): WidgetStateProperty<Color | null> | null => color === null ? null : WidgetStateProperty.all(nullableDartType(sourceColorType), captureSourceColor(color));
export const doubleAll = (value: number | null): WidgetStateProperty<DartDouble | null> | null => value === null ? null : WidgetStateProperty.all(nullableDartType(dartDoubleType), DartDouble.fromSource(value));
export const doubleProperty = (resolve: (states: DartSet<WidgetState>) => number | null): WidgetStateProperty<DartDouble | null> => WidgetStateProperty.resolveWith(nullableDartType(dartDoubleType), states => { const value = resolve(states); return value === null ? null : DartDouble.fromSource(value); });
export const sizeAll = (value: Size | null): WidgetStateProperty<Size | null> | null => value === null ? null : WidgetStateProperty.all(nullableDartType(sourceSizeType), captureSourceSize(value));
export const insetsAll = (value: EdgeInsetsGeometry | null): WidgetStateProperty<EdgeInsetsGeometry | null> | null => value === null ? null : WidgetStateProperty.all(nullableDartType(sourceEdgeInsetsGeometryType), captureSourceEdgeInsetsGeometry(value));
export const shapeAll = (value: OutlinedBorder | null): WidgetStateProperty<OutlinedBorder | null> | null => value === null ? null : WidgetStateProperty.all(nullableDartType(sourceOutlinedBorderType), captureSourceOutlinedBorder(value));
export const textAll = (value: TextStyle | null): WidgetStateProperty<TextStyle | null> | null => value === null ? null : WidgetStateProperty.all(nullableDartType(sourceTextStyleType), captureSourceTextStyle(value));
export const textPropertyAll = (value: TextStyle | null): WidgetStateProperty<TextStyle | null> => WidgetStateProperty.all(nullableDartType(sourceTextStyleType), value === null ? null : captureSourceTextStyle(value));
export const cursorProperty = (resolve: (states: DartSet<WidgetState>) => MouseCursor | null): WidgetStateProperty<MouseCursor | null> => mapped(sourceMouseCursorType, resolve, captureSourceMouseCursor);
export const sideProperty = (resolve: (states: DartSet<WidgetState>) => BorderSide | null): WidgetStateProperty<BorderSide | null> => mapped(sourceBorderSideType, resolve, captureSourceBorderSide);
export const sideAll = (value: BorderSide | null): WidgetStateProperty<BorderSide | null> | null => value === null ? null : WidgetStateProperty.all(nullableDartType(sourceBorderSideType), captureSourceBorderSide(value));
