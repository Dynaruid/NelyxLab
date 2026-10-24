// SPDX-License-Identifier: BSD-3-Clause
// Reviewed source generic admission for the canonical Core painting values.
import { TextStyle } from './text-style.ts';
import { EdgeInsetsGeometry } from './edge-insets.ts';
import { ShapeBorder, OutlinedBorder } from './borders.ts';
import { applyDartType, captureDartInterface, isDartType } from '../../foundation/dart-type-witness.ts';
import type { DartTypeWitness } from '../../foundation/dart-type-witness.ts';
import { registerDartValueSemantics } from '../../foundation/dart-value.ts';
import { valueEquals, valueHash } from './value-equality.ts';
import { widgetStateDiagnosticableType } from '../widgets/widget-state-diagnostic-source-adapter.ts';
export const sourceTextStyleType = applyDartType<TextStyle>(TextStyle, 'TextStyle', [], [widgetStateDiagnosticableType]);
export const sourceEdgeInsetsGeometryType = applyDartType<EdgeInsetsGeometry>(EdgeInsetsGeometry, 'EdgeInsetsGeometry', [], []);
export const sourceShapeBorderType = applyDartType<ShapeBorder>(ShapeBorder, 'ShapeBorder', [], []);
export const sourceOutlinedBorderType = applyDartType<OutlinedBorder>(OutlinedBorder, 'OutlinedBorder', [], [sourceShapeBorderType]);
function admit<T extends object>(value: T, owner: abstract new (...args: never[]) => T, type: DartTypeWitness<T>): T {
    if (!(value instanceof owner))
        throw new TypeError('Expected the canonical Core painting value');
    if (!isDartType(value, type))
        captureDartInterface(value, type);
    return value;
}
export function captureSourceTextStyle(value: TextStyle): TextStyle { return admit(value, TextStyle, sourceTextStyleType); }
export function captureSourceEdgeInsetsGeometry(value: EdgeInsetsGeometry): EdgeInsetsGeometry { return admit(value, EdgeInsetsGeometry, sourceEdgeInsetsGeometryType); }
export function captureSourceOutlinedBorder(value: OutlinedBorder): OutlinedBorder { return admit(value, OutlinedBorder, sourceOutlinedBorderType); }
registerDartValueSemantics(TextStyle, { accepts: (v: unknown): v is TextStyle => v instanceof TextStyle, equals: (v, o) => v.equals(o), hash: v => v.hashCode, string: v => v.toString() });
registerDartValueSemantics(EdgeInsetsGeometry, { accepts: (v: unknown): v is EdgeInsetsGeometry => v instanceof EdgeInsetsGeometry, equals: (v, o) => v.equals(o), hash: v => v.hashCode, string: v => v.toString() });
registerDartValueSemantics(ShapeBorder, { accepts: (v: unknown): v is ShapeBorder => v instanceof ShapeBorder, equals: valueEquals, hash: valueHash, string: v => v.toString() });
