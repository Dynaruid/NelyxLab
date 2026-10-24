// SPDX-License-Identifier: BSD-3-Clause
// Canonical Widget/IconThemeData admission at source generic boundaries.
import { IconThemeData } from './icon-theme-data.ts';
import { Widget } from './framework.ts';
import { sourceWidgetType } from './framework-source-types.ts';
import { widgetStateDiagnosticableType } from './widget-state-diagnostic-source-adapter.ts';
import { applyDartType, captureDartInterface, isDartType } from '../../foundation/dart-type-witness.ts';
import { registerDartValueSemantics, dartIdentityHash } from '../../foundation/dart-value.ts';
export { sourceWidgetType } from './framework-source-types.ts';
export const sourceIconThemeDataType = applyDartType<IconThemeData>(IconThemeData, 'IconThemeData', [], [widgetStateDiagnosticableType]);
export function captureSourceIconThemeData(value: IconThemeData): IconThemeData {
    if (!(value instanceof IconThemeData)) throw new TypeError('Expected the canonical Core IconThemeData');
    if (!isDartType(value, sourceIconThemeDataType)) captureDartInterface(value, sourceIconThemeDataType);
    return value;
}
export function captureSourceWidget(value: Widget): Widget {
    if (!(value instanceof Widget)) throw new TypeError('Expected the canonical Core Widget');
    if (!isDartType(value, sourceWidgetType)) captureDartInterface(value, sourceWidgetType);
    return value;
}
registerDartValueSemantics(IconThemeData, { accepts: (v: unknown): v is IconThemeData => v instanceof IconThemeData, equals: (v, o) => v.equals(o), hash: v => v.hashCode, string: v => v.toString() });
registerDartValueSemantics(Widget, { accepts: (v: unknown): v is Widget => v instanceof Widget, equals: (v, o) => v === o, hash: dartIdentityHash, string: v => v.toString() });
