// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import ts from 'typescript';
import { inlineLocalFunctions } from './src/local-functions.ts';

function load(text: string, runtime?: unknown): any {
  const code = ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return Function('runtime', code + '\nreturn Fixture;')(runtime);
}

/** Execute the actual pinned day/year value expressions, rather than a handwritten
 * optimized equivalent. Widgets after these values use the regular App tests. */
export function verifyGeneratedLocalFunctions(original: string, specialized: string): void {
  const prefix = (text: string, year: boolean): string => {
    const file = ts.createSourceFile(
      'day.ts',
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const owner = file.statements.find(
      (node) =>
        ts.isClassDeclaration(node) &&
        node.name?.text === (year ? '_YearPickerState' : '_DayState'),
    ) as ts.ClassDeclaration;
    const method = owner.members.find(
      (node) =>
        ts.isMethodDeclaration(node) &&
        (year
          ? node.name.getText(file).endsWith('_buildYearItem')
          : node.name.getText(file) === 'build'),
    ) as ts.MethodDeclaration;
    const statements = method.body!.statements;
    const end = statements.findIndex(
      (node) =>
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (declaration) => declaration.name.getText(file) === (year ? 'yearShape' : 'dayShape'),
        ),
    );
    assert(end > 0, 'Pinned day build lost its shape boundary');
    const selected = statements
      .slice(0, end + 1)
      .filter(
        (node) =>
          !year ||
          (ts.isVariableStatement(node) &&
            node.declarationList.declarations.some((declaration) =>
              [
                'effectiveValue',
                'resolve',
                'textColor',
                'background',
                'overlayColor',
                'yearShape',
              ].includes(declaration.name.getText(file)),
            )),
      );
    const body =
      (year
        ? 'const datePickerTheme=DatePickerTheme.of(context), defaults=DatePickerTheme.defaults(context), isCurrentYear=context.today, states=new Set(["selected"]);\n'
        : '') + selected.map((node) => node.getText(file)).join('\n');
    const controller = body.match(/this\.([\w$]*statesController)\.value/)?.[1];
    assert(year || controller, 'Pinned states-controller write missing');
    return `
      const DatePickerTheme = {defaults: context => {runtime.trace.push('defaults');return context.defaults;}, of: context => {runtime.trace.push('theme');return context.theme;}};
      const MaterialLocalizations = {of: context => {runtime.trace.push('localizations');return {currentDateLabel:'today'};}};
      const emptyWidgetStateSet = () => new Set();
      const WidgetState = {disabled:'disabled',selected:'selected'};
      const sourceColorType = {name:'color'}, sourceOutlinedBorderType = {name:'shape'};
      const nullableDartType = token => {runtime.trace.push('witness:'+token.name);if(runtime.mode==='throw-witness')throw runtime.failure;return {};};
      const WidgetStateProperty = {resolveWith: (token,callback) => {runtime.trace.push('resolveWith');return {resolve: callback};}};
      class Fixture {
        constructor(readonly widget:any, controller:any) {${year ? '' : 'this.' + controller + '=controller;'}}
        run(context:any) {${body}
          return ${year ? '{dayForegroundColor:textColor,dayBackgroundColor:background,dayOverlayColor:overlayColor,dayShape:yearShape}' : '{dayForegroundColor,dayBackgroundColor,dayOverlayColor,dayShape}'};
        }
      }`;
  };
  for (const year of [false, true]) {
    const bodies = [prefix(original, year), prefix(specialized, year)];
    for (const mode of [
      'value',
      'null',
      'missing',
      'undefined',
      'throw-witness',
      'throw-getter',
      'throw-resolver',
    ]) {
      const results = bodies.map((body) => {
        const trace: string[] = [],
          failure = new Error(mode),
          runtime = { trace, failure, mode };
        let today = false;
        const makeTheme = (label: string, first: boolean) =>
          new Proxy(
            {},
            {
              get(_target, key) {
                trace.push(label + ':' + String(key));
                if (mode === 'throw-getter') throw failure;
                if (key === 'dayStyle' || (first && mode === 'missing')) return null;
                return {
                  label,
                  resolve(states: Set<string>) {
                    assert.equal(this.label, label);
                    trace.push(label + ':' + String(key) + ':' + [...states].join(','));
                    if (mode === 'throw-resolver') throw failure;
                    if (mode === 'undefined' && first) return undefined;
                    return first && mode !== 'value' ? null : label + ':' + String(key);
                  },
                };
              },
            },
          );
        const widget = {
          get isToday() {
            trace.push('today:' + today);
            today = !today;
            return !today;
          },
          isDisabled: true,
          isSelectedDay: true,
        };
        const controller = {
          set value(states: Set<string>) {
            trace.push('controller:' + [...states].join(','));
          },
        };
        let value: unknown;
        try {
          const instance = new (load(body, runtime))(widget, controller);
          const built = instance.run({
            theme: makeTheme('theme', true),
            defaults: makeTheme('defaults', false),
            today: mode === 'value' || mode === 'missing',
          });
          trace.push('returned');
          value = [
            built.dayForegroundColor,
            built.dayBackgroundColor,
            built.dayShape,
            built.dayOverlayColor.resolve(new Set(['late'])),
          ];
        } catch (error) {
          assert.equal(error, failure);
          value = 'threw';
        }
        return { trace, value };
      });
      assert.deepEqual(
        results[1],
        results[0],
        'Pinned ' + (year ? 'year' : 'day') + ' build effects differ: ' + mode,
      );
    }
  }
}
export function verifyLocalFunctions(): void {
  const source = `class Fixture {
    constructor(readonly widget: any) {}
    run(datePickerTheme: any, defaults: any, states: any, witness: () => object) {
      const effectiveValue = <T>(token: object, getProperty: (theme: any) => T | null): T | null => {
        return getProperty(datePickerTheme) ?? getProperty(defaults);
      };
      const resolve = <T>(token: object, getProperty: (theme: any) => any, states: any): T | null => {
        return effectiveValue<T>(token, theme => getProperty(theme)?.resolve(states) ?? null);
      };
      const value = resolve<string>(witness(), theme => this.widget.isToday ? theme.today : theme.day, states);
      const overlay = (states: any) => effectiveValue<string>(witness(), theme => theme.overlay?.resolve(states) ?? null);
      return {value, overlay};
    }
  }`;
  const optimized = inlineLocalFunctions(source, [{ owner: 'Fixture', method: 'run' }]);
  assert(!/const (effectiveValue|resolve)\b/.test(optimized), 'Direct-only helper closures remain');
  assert((optimized.match(/=>/g) ?? []).length < (source.match(/=>/g) ?? []).length);
  const constructors = [load(source), load(optimized)];
  const suspended = inlineLocalFunctions(
    'class Fixture {async run(input:any) {const fn=(a:any)=>a+a;return fn(await input());}}',
    [{ owner: 'Fixture', method: 'run' }],
  );
  assert(/const fn\b/.test(suspended), 'Suspending input escaped into a synchronous helper IIFE');
  for (const mode of [
    'value',
    'null',
    'missing',
    'undefined',
    'throw-witness',
    'throw-getter',
    'throw-resolver',
  ]) {
    const runs = constructors.map((Type) => {
      const trace: string[] = [],
        failure = new Error(mode),
        state = { id: 'initial' };
      let today = true;
      const resolver = (label: string, result: string | null) => ({
        label,
        resolve(value: any) {
          assert.equal(this.label, label, 'Resolver lost its receiver');
          trace.push(label + ':' + value.id);
          if (mode === 'throw-resolver') throw failure;
          if (mode === 'undefined') return undefined;
          return result;
        },
      });
      const theme = (label: string, result: string | null) =>
        new Proxy(
          {
            today: resolver(label + '.today', result),
            day: resolver(label + '.day', result),
            overlay: resolver(label + '.overlay', result),
          },
          {
            get(target, key, receiver) {
              trace.push(label + '.' + String(key));
              if (mode === 'throw-getter') throw failure;
              return mode === 'missing' && label === 'theme'
                ? null
                : Reflect.get(target, key, receiver);
            },
          },
        );
      const instance = new Type({
        get isToday() {
          trace.push('today:' + today);
          const value = today;
          today = !today;
          return value;
        },
      });
      let result: unknown;
      try {
        const value = instance.run(
          theme('theme', mode === 'value' ? 'first' : null),
          theme('defaults', 'fallback'),
          state,
          () => {
            trace.push('witness');
            if (mode === 'throw-witness') throw failure;
            return {};
          },
        );
        trace.push('returned');
        state.id = 'late';
        result = [value.value, value.overlay(state)];
      } catch (error) {
        assert.equal(error, failure);
        result = 'threw';
      }
      return { trace, result };
    });
    assert.deepEqual(runs[1], runs[0], mode + ' changed witness/getter/resolver order');
  }
  for (const body of [
    'const fn = (a: number, b: number) => a + a + b; return fn(input.read(), input.read());',
    'const fn = (unused: number, b: number) => b; return fn(input.read(), input.read());',
    'const fn = () => 7; return {fn, alias: fn};',
    'const fn = (a: any) => ({a}); return fn(input.read());',
    'const fn = (a: any) => ++a; return fn(3);',
    'const fn = (a: any) => a as typeof a; return fn(3);',
    'const fn = (a: number) => a+1; return 3*fn(2);',
    'const fn = (a: number|null, b: number) => a ?? b; return fn(null,3)*7;',
    'const fn = (value: any) => (input = 7, value + value); return fn(input);',
    'const fn = () => 7; return eval("typeof fn");',
    'const fn = (a: number, b: number) => a+b; return fn(...[3,7]);',
    'const outer = 3; const fn = () => outer; return ((outer: number) => fn())(9);',
    'const fn = () => unresolvedGlobal; return ((unresolvedGlobal: any) => fn())(9);',
    'const fn = () => undefined; return ((undefined: any) => fn())(9);',
    'const fn = () => this.value; return function(this: any) {return fn();}.call({value: 9});',
    'return fn(); const fn = () => 7;',
  ]) {
    const original = 'class Fixture { value = 3; run(input: any) {' + body + '} }';
    const compiled = inlineLocalFunctions(original, [{ owner: 'Fixture', method: 'run' }]);
    const results = [original, compiled].map((code) => {
      let count = 0;
      try {
        const value = new (load(code))().run({
          read() {
            return ++count;
          },
        });
        return { count, value: value?.fn ? [value.fn(), value.fn === value.alias] : value };
      } catch (error) {
        return { count, error: (error as Error).constructor.name };
      }
    });
    assert.deepEqual(results[1], results[0], body);
  }
}
