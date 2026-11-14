// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { emitDart } from './src/dart-emitter.ts';
import ts from 'typescript';
import {
  protect,
  finalFieldProtector,
  checkedInteger,
  modulo,
} from '../../Nelyx/src/ui/value-math.ts';
import { verifyLocalFunctions, verifyGeneratedLocalFunctions } from './verify-local-functions.ts';
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
    if (recipe.integerGuardFolding) {
      const baseline = { ...recipe };
      delete baseline.integerGuardFolding;
      const original = emitDart(declarations, baseline),
        specialized = emitDart(declarations, recipe);
      assert(
        (specialized.match(/checkedInteger\(/g) ?? []).length <
          (original.match(/checkedInteger\(/g) ?? []).length,
        'Adjacent guard folding removed no generated checks',
      );
      const header = (code: string, effects: string[], counts: { guards: number }) => {
        const file = ts.createSourceFile(
          'header.ts',
          code,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS,
        );
        const owner = file.statements.find(
          (node) => ts.isClassDeclaration(node) && node.name?.text === '_DayPickerState',
        ) as ts.ClassDeclaration;
        const method = owner.members.find(
          (node) => ts.isMethodDeclaration(node) && node.name.getText(file).endsWith('dayHeaders'),
        ) as ts.MethodDeclaration;
        assert(method, 'Missing pinned day-header source');
        const text = ts.transpileModule(
          'class Header {' + method.getText(file) + '}\nreturn new Header();',
          {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
          },
        ).outputText;
        class Excluded {
          constructor(readonly options: unknown) {}
        }
        const instance = Function(
          'checkedInteger',
          'modulo',
          'DateTime',
          'dateListAt',
          'dateListAdd',
          'ExcludeSemantics',
          'dateCenter',
          'dateText',
          text,
        )(
          (value: number) => {
            ++counts.guards;
            return checkedInteger(value);
          },
          modulo,
          { daysPerWeek: 7 },
          (values: unknown[], index: number) => values[index],
          (values: unknown[], value: unknown) => values.push(value),
          Excluded,
          (value: unknown) => value,
          (value: unknown, style: unknown) => ({ value, style }),
        );
        const name = Object.getOwnPropertyNames(Object.getPrototypeOf(instance)).find((name) =>
          name.endsWith('dayHeaders'),
        )!;
        return (start: number, sentinel?: object) =>
          instance[name](null, {
            get firstDayOfWeekIndex() {
              effects.push('first');
              return start;
            },
            get narrowWeekdays() {
              effects.push('weekdays');
              return new Proxy(['S', 'M', 'T', 'W', 'T', 'F', 'S'], {
                get(target, key, receiver) {
                  effects.push(String(key));
                  if (sentinel && key === '2') throw sentinel;
                  return Reflect.get(target, key, receiver);
                },
              });
            },
          });
      };
      for (const start of [0, 1, 6]) {
        const a: string[] = [],
          b: string[] = [],
          ca = { guards: 0 },
          cb = { guards: 0 };
        const before = header(original, a, ca)(start),
          after = header(specialized, b, cb)(start);
        assert.equal(JSON.stringify(after), JSON.stringify(before));
        assert.deepEqual(b, a);
        assert(cb.guards < ca.guards, 'Pinned header executed the same redundant integer guards');
      }
      for (const source of [original, specialized]) {
        const effects: string[] = [],
          read = header(source, effects, { guards: 0 }),
          sentinel = { reason: 'weekday getter' };
        assert.throws(
          () => read(0, sentinel),
          (error) => error === sentinel,
        );
        for (const invalid of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
          assert.throws(() => read(invalid));
      }
      assert.throws(
        () => emitDart(declarations, { ...recipe, integerGuardFolding: { policy: 'unchecked' } }),
        /integer guard folding policy/,
      );
      assert.throws(
        () =>
          emitDart(declarations, {
            ...recipe,
            imports: { ...recipe.imports, checkedInteger: 'user-adapter' },
          }),
        /integer guard folding policy/,
      );
    }
    if (recipe.localFunctionInlining) {
      verifyLocalFunctions();
      assert.equal(recipe.localFunctionInlining.methods.length, 2);
      const baseline = { ...recipe };
      delete baseline.localFunctionInlining;
      const original = emitDart(declarations, baseline),
        specialized = emitDart(declarations, recipe);
      const helpers = (code: string) =>
        (code.match(/const (effectiveValue|resolve)\s*:/g) ?? []).length;
      assert.equal(helpers(original), 4);
      assert.equal(helpers(specialized), 0, 'Pinned day/year helper closures were not removed');
      verifyGeneratedLocalFunctions(original, specialized);
      for (const invalid of [
        { ...recipe.localFunctionInlining, policy: 'unchecked' },
        { ...recipe.localFunctionInlining, methods: ['missing-method'] },
        {
          ...recipe.localFunctionInlining,
          methods: [
            recipe.localFunctionInlining.methods[0],
            recipe.localFunctionInlining.methods[0],
          ],
        },
      ])
        assert.throws(
          () => emitDart(declarations, { ...recipe, localFunctionInlining: invalid }),
          /local function inlining policy/,
        );
    }
    if (recipe.finalFieldLayouts) {
      const baseline = { ...recipe };
      delete baseline.finalFieldLayouts;
      const makeDay = (code: string) => {
        const file = ts.createSourceFile(
          'day.ts',
          code,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS,
        );
        const owner = file.statements.find(
          (node) => ts.isClassDeclaration(node) && node.name?.text === '_Day',
        );
        assert(owner, 'Missing original day constructor');
        const layouts = file.statements.filter(
          (node) =>
            ts.isVariableStatement(node) &&
            node.declarationList.declarations.some(
              (declaration) =>
                declaration.initializer &&
                ts.isCallExpression(declaration.initializer) &&
                ts.isIdentifier(declaration.initializer.expression) &&
                declaration.initializer.expression.text === recipe.finalFieldLayouts.factory,
            ),
        );
        const text = ts.transpileModule(
          [...layouts, owner].map((node) => node.getText(file).replace(/^export /, '')).join('\n'),
          { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
        ).outputText;
        class Host {
          key: unknown;
          constructor(options: { key: unknown }) {
            this.key = options.key;
          }
        }
        return Function(
          'protect',
          recipe.finalFieldLayouts.factory,
          'ScrollbarStatefulHost',
          text + '\nreturn _Day;',
        )(protect, finalFieldProtector, Host);
      };
      const original = makeDay(emitDart(declarations, baseline)),
        specialized = makeDay(emitDart(declarations, recipe)),
        day = {},
        focusNode = {},
        calendarDelegate = {},
        calls: unknown[] = [],
        onChanged = (value: unknown) => calls.push(value),
        reads: string[] = [];
      const input = () => ({
        get key() {
          reads.push('key');
          return null;
        },
        isDisabled: false,
        isSelectedDay: true,
        isToday: false,
        onChanged,
        focusNode,
        calendarDelegate,
      });
      const before = new original(day, input()),
        after = new specialized(day, input());
      assert.deepEqual(
        Object.getOwnPropertyDescriptors(after),
        Object.getOwnPropertyDescriptors(before),
      );
      assert.deepEqual(reads, ['key', 'key']);
      after.onChanged(after.day);
      assert.deepEqual(calls, [day]);
      class Extended extends specialized {
        extra = 17;
      }
      assert.equal(new Extended(day, input()).extra, 17);
      assert.throws(() => {
        after.day = {};
      }, TypeError);
      for (const invalid of [
        { ...recipe.finalFieldLayouts, policy: 'unknown' },
        { ...recipe.finalFieldLayouts, classes: ['missing-owner'] },
        { ...recipe.finalFieldLayouts, factory: 'missingFactory' },
      ])
        assert.throws(
          () => emitDart(declarations, { ...recipe, finalFieldLayouts: invalid }),
          /final-field layout policy/,
        );
    }
    if (recipe.lexicalNullReads) {
      const baseline = { ...recipe };
      delete baseline.lexicalNullReads;
      delete baseline.localFunctionInlining;
      const selector = (code: string) => {
        const file = ts.createSourceFile(
          'selector.ts',
          code,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS,
        );
        let found: ts.ArrowFunction | undefined;
        const visit = (node: ts.Node) => {
          if (
            ts.isArrowFunction(node) &&
            node.parameters.length === 1 &&
            node.parameters[0]!.name.getText(file) === 'theme' &&
            node.body.getText(file).includes('.dayShape')
          ) {
            found ??= node;
            return;
          }
          ts.forEachChild(node, visit);
        };
        const owner = file.statements.find(
          (node) => ts.isClassDeclaration(node) && node.name?.text === '_DayState',
        );
        assert(owner, 'Missing original day-state owner');
        visit(owner);
        assert(found, 'Missing original dayShape selector');
        return ts.transpileModule('const selector = (' + found.getText(file) + ');', {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
        }).outputText;
      };
      const current = { ...recipe };
      delete current.localFunctionInlining;
      const original = selector(emitDart(declarations, baseline)),
        specialized = selector(emitDart(declarations, current));
      assert(
        original.includes('=>') && original !== specialized,
        'Lexical null-read specialization did not remove an IIFE',
      );
      for (const code of [original, specialized]) {
        const read = Function(code + '\nreturn selector;')();
        assert.equal(read(null), null);
        assert.throws(() => read(undefined), TypeError);
        const effects: string[] = [],
          value = {};
        assert.equal(
          read({
            get dayShape() {
              effects.push('get');
              return value;
            },
          }),
          value,
        );
        assert.deepEqual(effects, ['get']);
        const failure = new Error('source getter');
        assert.throws(
          () =>
            read({
              get dayShape() {
                throw failure;
              },
            }),
          (error) => error === failure,
        );
        const proxy = new Proxy(
          { dayShape: value },
          {
            get(target, key, receiver) {
              effects.push(String(key));
              return Reflect.get(target, key, receiver);
            },
          },
        );
        assert.equal(read(proxy), value);
        assert.deepEqual(effects, ['get', 'dayShape']);
      }
      const invalid = { ...recipe, lexicalNullReads: { policy: 'unchecked-optional-chain' } };
      assert.throws(() => emitDart(declarations, invalid), /Unknown lexical null-read/);
    }
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
