// SPDX-License-Identifier: BSD-3-Clause
import { relocateProductModule, moduleLayoutIdentity } from './product-module-layout.mjs';
// A finite resolved-IR field projection, not a whole SliderThemeData body conversion.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const writeCurrentOwnership = (file, value) =>
  fs.writeFileSync(
    file,
    JSON.stringify({ ...value, moduleLayout: moduleLayoutIdentity() }, null, 2) + '\n',
  );
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  ref = (file) => ({ file, sha256: sha(file) }),
  candidateFile = '.tmp/work8/w11-slider-dependencies-candidate/result.json',
  candidate = JSON.parse(fs.readFileSync(candidateFile, 'utf8')),
  irFile = candidate.ir.file;
assert.equal(sha(irFile), candidate.ir.sha256);
const source = 'packages/flutter/lib/src/material/slider_theme.dart',
  sourceFile = '.tmp/work6/flutter-source/' + source,
  input = candidate.upstream.find((row) => row.source === source);
assert(input);
assert.equal(
  createHash('sha256')
    .update(fs.readFileSync(sourceFile, 'utf8').replaceAll('\r\n', '\n'))
    .digest('hex'),
  input.sha256,
);
const record = JSON.parse(fs.readFileSync(irFile, 'utf8')).records.find(
  (row) => row.source === source && row.symbol === 'SliderThemeData',
);
assert.equal(record.ir?.kind, 'class');
const fields = record.ir.fields;
assert.equal(fields.length, 36);
assert(fields.every((field) => field.final && !field.static && field.initializer === null));
const bindings = new Map([
  ['dart:core::double:CLASS', 'number'],
  ['dart:core::bool:CLASS', 'boolean'],
  ['dart:ui::Color:CLASS', 'Color'],
  ['dart:ui::Size:CLASS', 'Size'],
  ['package:flutter/src/painting/text_style.dart::TextStyle:CLASS', 'TextStyle'],
  ['package:flutter/src/painting/edge_insets.dart::EdgeInsetsGeometry:CLASS', 'EdgeInsetsGeometry'],
  ['package:flutter/src/services/mouse_cursor.dart::MouseCursor:CLASS', 'MouseCursor'],
  [
    'package:flutter/src/widgets/widget_state.dart::WidgetStateProperty:CLASS',
    'WidgetStateProperty',
  ],
  ['package:flutter/src/material/slider.dart::SliderInteraction:ENUM', 'SliderInteraction'],
  ['package:flutter/src/material/slider_theme.dart::ShowValueIndicator:ENUM', 'ShowValueIndicator'],
  ...[
    'SliderComponentShape',
    'SliderTickMarkShape',
    'SliderTrackShape',
    'RangeSliderTickMarkShape',
    'RangeSliderThumbShape',
    'RangeSliderTrackShape',
    'RangeSliderValueIndicatorShape',
  ].map((name) => {
    const file =
      name === 'SliderComponentShape'
        ? 'slider_value_indicator_shape'
        : name.startsWith('Range')
          ? 'range_slider_parts'
          : 'slider_parts';
    return ['package:flutter/src/material/' + file + '.dart::' + name + ':CLASS', name];
  }),
]);
function type(value) {
  let output;
  if (value.kind === 'function') {
    assert.equal(
      value.alias?.reference.id,
      'package:flutter/src/material/range_slider_parts.dart::RangeThumbSelector:TYPE_ALIAS',
    );
    assert.equal(value.parameters.length, 6);
    assert.deepEqual(
      value.parameters
        .filter((p) => p.type.reference?.id === 'dart:core::double:CLASS')
        .map((p) => p.name),
      ['tapValue', 'dx'],
    );
    output = 'RangeThumbSelector';
  } else {
    assert.equal(value.kind, 'interface');
    output = bindings.get(value.reference.id);
    assert(output, 'Unbound source field type ' + value.reference.id);
    if (value.arguments.length) output += '<' + value.arguments.map(type).join(',') + '>';
  }
  return output + (value.nullable ? '|null' : '');
}
const annotated = fields.filter((field) => field.numeric),
  numeric = annotated.filter((field) => field.numeric.resolvedType.kind === 'interface');
for (const field of annotated) {
  assert.equal(field.numeric.inferred, false);
  assert.deepEqual(field.numeric.resolvedType, field.type);
  assert.equal(field.numeric.bounds.length, 0);
  if (field.type.kind === 'function') {
    assert.equal(
      field.type.alias.reference.id,
      'package:flutter/src/material/range_slider_parts.dart::RangeThumbSelector:TYPE_ALIAS',
    );
  } else {
    assert.equal(field.numeric.resolvedType.reference.id, 'dart:core::double:CLASS');
    assert.equal(field.numeric.resolvedType.nullable, true);
    assert.equal(field.numeric.type, 'double?');
  }
}
const comment = (field) => (field.numeric ? '/** @dartType ' + field.numeric.type + ' */\n ' : '');
const output = `// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated field/type projection from pinned analyzer-resolved IR. Methods live in slider-theme.ts.
import type {Color} from '@nelyx/core/ui/color';import type {Size} from '@nelyx/core/ui/size';import type {TextStyle} from '@nelyx/core/framework/painting/text-style';import type {EdgeInsetsGeometry} from '@nelyx/core/framework/painting/edge-insets';import type {MouseCursor} from '@nelyx/core/services/mouse-cursor';import type {WidgetStateProperty} from '@nelyx/core/framework/widgets/widget-state';import type {SliderInteraction} from './slider-values.generated.ts';
import type {SliderComponentShape,SliderTickMarkShape,SliderTrackShape,RangeSliderTickMarkShape,RangeSliderThumbShape,RangeSliderTrackShape,RangeSliderValueIndicatorShape} from './slider-shapes.ts';import type {RangeThumbSelector} from './range-slider-values.ts';import type {ShowValueIndicator} from './slider-theme-values.generated.ts';
export interface SliderThemeOptions {
 ${fields.map((field) => comment(field) + 'readonly ' + field.name + '?:' + type(field.type) + ';').join('\n ')}
}
export const sliderThemeFieldNames=Object.freeze(${JSON.stringify(fields.map((field) => field.name))} as const);
export const sliderThemeColorFields=Object.freeze(${JSON.stringify(fields.filter((field) => field.type.reference?.id === 'dart:ui::Color:CLASS').map((field) => field.name))} as const);
export const sliderThemeNumberFields=Object.freeze(${JSON.stringify(numeric.map((field) => field.name))} as const);
export class SliderThemeFieldsBase {
 protected readonly specs:Readonly<SliderThemeOptions>;
 constructor(options:SliderThemeOptions={}){for(const key of Object.keys(options))if(!(sliderThemeFieldNames as readonly string[]).includes(key))throw new TypeError('Unknown slider theme field: '+key);this.specs=Object.freeze({...options});Object.defineProperty(this,'specs',{writable:false,configurable:false});}
 ${fields.map((field) => comment(field) + 'get ' + field.name + '():' + type(field.type) + '{return this.specs.' + field.name + '??null;}').join('\n ')}
}
`;
const relocated = relocateProductModule(
    'packages/material/src/slider-theme-fields.generated.ts',
    output,
  ),
  file = relocated.file,
  effective = relocated.text,
  ownershipFile = 'tools/Nelyx.FrameworkToTypeScript/data/work8/w12-slider-field-ownership.json';
if (fs.existsSync(file)) {
  assert(fs.existsSync(ownershipFile), 'Existing field output has no ownership receipt');
  const old = JSON.parse(fs.readFileSync(ownershipFile, 'utf8'));
  assert.equal(sha(file), old.output.sha256, 'Direct slider field edits conflict with generation');
}
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(file, 'utf8'), effective);
else {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') !== effective) {
    const bytes = fs.readFileSync(file),
      history = '.tmp/work8/receipt-history/' + sha(file) + '-slider-theme-fields.previous.ts';
    if (!fs.existsSync(history)) fs.writeFileSync(history, bytes, { flag: 'wx' });
  }
  fs.writeFileSync(file, effective);
  writeCurrentOwnership(ownershipFile, {
    schema: 'nelyx.w11-slider-field-projection/v1',
    status: 'PASS-scoped',
    recordedAt: new Date().toISOString(),
    inputs: [
      ref(candidateFile),
      ref(irFile),
      ref(sourceFile),
      ref('tools/Nelyx.FrameworkToTypeScript/generate-slider-theme-fields.mjs'),
    ],
    fields: fields.map((field) => ({
      name: field.name,
      reference: field.reference,
      type: field.type,
      numeric: field.numeric,
      offset: field.offset,
      length: field.length,
    })),
    output: ref(file),
    scope:
      'All 36 final instance fields/types projected from full pinned resolved SliderThemeData IR. Three nullable double fields and the function-valued numeric signature retain only resolved analyzer metadata. Functional methods and owning widget/shape implementation are separate; whole class/body conversion and promotion are not inferred.',
  });
}
console.log(
  JSON.stringify({
    status: 'PASS-scoped',
    fields: fields.length,
    numericFields: numeric.length,
    checkOnly: process.argv.includes('--check'),
  }),
);
