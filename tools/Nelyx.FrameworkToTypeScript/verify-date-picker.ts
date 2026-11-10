// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { emitDart } from './src/dart-emitter.ts';
export function verifyDateCompiler(declarations: any[], recipe: any): void {
  if (recipe.source.endsWith('/date_picker.dart')) {
    const rejected = structuredClone(recipe);
    delete rejected.asyncRuntime.resultTransfer;
    assert.throws(() => emitDart(declarations, rejected), /Future representation transfer/);
    const invalid = structuredClone(declarations),
      method = invalid.find((d: any) => d.name === 'showDatePicker');
    assert(method, 'Original async function missing');
    const future = method.resolvedReturnType;
    assert.equal(future.reference.id, 'dart:async::Future:CLASS');
    future.arguments[0] = {
      kind: 'interface',
      nullable: false,
      reference: {
        id: 'dart:core::int:CLASS',
        name: 'int',
        owner: null,
        local: false,
        static: false,
      },
      arguments: [],
    };
    assert.throws(() => emitDart(invalid, recipe), /Future representation transfer/);
  }
  if (recipe.source.endsWith('/calendar_date_picker.dart')) {
    const state = declarations.find((d: any) => d.name === '_DatePickerModeToggleButtonState');
    assert(state?.mixins?.length);
    const invalid = structuredClone(recipe);
    invalid.superConstructors[state.reference.id].sourceConstructor = 'different:CONSTRUCTOR';
    assert.throws(() => emitDart(declarations, invalid), /exact source constructor/);
    const mixins = structuredClone(recipe);
    mixins.superConstructors[state.reference.id].mixins = [];
    assert.throws(() => emitDart(declarations, mixins), /exact ordered host superclass/);
  }
}
/** Differential execution of unchanged source member spans against current dist.
 * No Flutter engine is needed for these dart:core date/localization operations. */
export function verifyDatePicker(ir: any, root: string, sourceRoot: string, dart: string): void {
  const temporary = fs.mkdtempSync(path.join(root, '.nelyx/date-oracle-'));
  const source = (row: any) => fs.readFileSync(path.join(sourceRoot, row.source), 'utf8');
  const span = (row: any, node: any) => source(row).slice(node.offset, node.offset + node.length);
  const row = (name: string) => ir.records.find((r: any) => r.symbol === name);
  const locale = row('DefaultMaterialLocalizations');
  const fields = locale.ir.fields
    .map((f: any) => 'static const List<String> ' + span(locale, f) + ';')
    .join('\n');
  const methods = locale.ir.methods.map((m: any) => span(locale, m)).join('\n');
  const dates = [
    [1, 1, 1],
    [99, 2, 28],
    [1900, 2, 28],
    [2000, 2, 29],
    [2024, 2, 29],
    [2100, 2, 28],
    [2026, 1, 31],
    [2026, 11, 10],
    [2026, 12, 31],
    [2026, 13, 0],
    [2026, 0, 1],
    [2026, 3, 0],
  ];
  const inputs = [
    '02/29/2000',
    '02/29/1900',
    '2/29/2024',
    '13/1/2026',
    '04/31/2026',
    '1/1/0099',
    '11/10/2026',
    ' 11 / 10 / 2026 ',
    '12x/1/2026',
    '',
    '-1/1/2026',
  ];
  const dartMain = `
List<int>? parts(DateTime? d)=>d==null?null:[d.year,d.month,d.day,d.weekday];
void main(){final l=DefaultMaterialLocalizations();final dates=${JSON.stringify(dates)};final inputs=${JSON.stringify(inputs)};
print(jsonEncode({'dates':[for(final p in dates)for(final d in [DateTime(p[0],p[1],p[2])]) {'date':parts(d),'days':DateUtils.getDaysInMonth(d.year,d.month),'first':DateUtils.firstDayOffset(d.year,d.month,l),'next':parts(DateUtils.addMonthsToMonthDate(d,1)),'format':[l.formatCompactDate(d),l.formatFullDate(d),l.formatMediumDate(d),l.formatMonthYear(d),l.formatShortDate(d),l.formatShortMonthDay(d)]}],'parse':[for(final text in inputs)parts(l.parseCompactDate(text))],'decimal':[for(final n in [0,12,1234,-1234567])l.formatDecimal(n)]}));}
`;
  try {
    const oracle = path.join(temporary, 'oracle.dart');
    fs.writeFileSync(
      oracle,
      "import 'dart:convert';\nclass Meta {const Meta();} const immutable=Meta(),optionalTypeArgs=Meta();\ntypedef MaterialLocalizations=DefaultMaterialLocalizations;\n" +
        span(row('DateUtils'), row('DateUtils').ir) +
        '\n' +
        span(row('DateTimeRange'), row('DateTimeRange').ir) +
        '\nclass DefaultMaterialLocalizations {\n' +
        fields +
        '\n' +
        methods +
        '\n}\n' +
        dartMain,
    );
    const expected = spawnSync(dart, [oracle], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 1200000,
    });
    if (expected.error || expected.status !== 0)
      throw Error(
        'Dart oracle failed: ' + expected.error + '\n' + expected.stdout + expected.stderr,
      );
    const script = `import assert from 'node:assert/strict';import {DateUtils,DatePickerEntryMode} from './packages/material/dist/generated/date/date.generated.js';import {DateTime} from './packages/material/dist/internal/date/date-time.js';import {SourceDateLocalizations} from './packages/material/dist/generated/date/material_localizations.generated.js';
import {AutovalidateMode} from './packages/material/dist/generated/date/form.generated.js';import {_RestorableAutovalidateMode,_RestorableDatePickerEntryMode} from './packages/material/dist/generated/date/date_picker.generated.js';
for(const [Type,first,next] of [[_RestorableAutovalidateMode,AutovalidateMode.disabled,AutovalidateMode.always],[_RestorableDatePickerEntryMode,DatePickerEntryMode.calendar,DatePickerEntryMode.input]]){const property=new Type(first);let notifications=0;property.addListener(()=>notifications++);property.value=first;assert.equal(notifications,0);property.value=next;assert.equal(property.value,next);assert.equal(notifications,1);property.dispose();}
const l=new SourceDateLocalizations(),parts=d=>d===null?null:[d.year,d.month,d.day,d.weekday],dates=${JSON.stringify(dates)},inputs=${JSON.stringify(inputs)};
console.log(JSON.stringify({dates:dates.map(p=>{const d=new DateTime(...p);return {date:parts(d),days:DateUtils.getDaysInMonth(d.year,d.month),first:DateUtils.firstDayOffset(d.year,d.month,l),next:parts(DateUtils.addMonthsToMonthDate(d,1)),format:[l.formatCompactDate(d),l.formatFullDate(d),l.formatMediumDate(d),l.formatMonthYear(d),l.formatShortDate(d),l.formatShortMonthDay(d)]};}),parse:inputs.map(text=>parts(l.parseCompactDate(text))),decimal:[0,12,1234,-1234567].map(n=>l.formatDecimal(n))}));`;
    const actual = spawnSync(
      process.env.NODE_EXECUTABLE ?? 'node',
      ['--input-type=module', '-e', script],
      { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 1200000 },
    );
    if (actual.error || actual.status !== 0)
      throw Error(
        'Current dist oracle failed: ' + actual.error + '\n' + actual.stdout + actual.stderr,
      );
    assert.deepEqual(JSON.parse(actual.stdout), JSON.parse(expected.stdout));
    console.log(
      'Original Dart date/localization oracle PASS (12 dates, 11 inputs, 4 decimal cases)',
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
