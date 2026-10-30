// SPDX-License-Identifier: BSD-3-Clause
import { test, expect } from 'bun:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { emitDart } from './dart-emitter.ts';
import type { Declaration, Expression, ModuleRecipe, Statement } from './body-ir.ts';

const timeout = 1_200_000,
  span = { offset: 0, length: 0 };
const literal = (value: boolean): Expression => ({ ...span, kind: 'literal', type: 'bool', value });
const local = (name: string): Expression => ({
  ...span,
  kind: 'identifier',
  type: 'bool',
  name,
  reference: { id: name, name, owner: null, local: true, static: false },
});
const returned = (value: boolean): Statement => ({
  ...span,
  kind: 'return',
  value: literal(value),
});
const stop: Statement = { ...span, kind: 'break' };
const switched = (
  value: Expression,
  cases: { test: Expression | null; statements: Statement[] }[],
): Statement => ({ ...span, kind: 'switch', value, cases, exhaustive: true });
const recipe: ModuleRecipe = {
  source: 'lint-fixture.dart',
  sha256: '0'.repeat(64),
  symbols: ['fixture'],
  destination: 'fixture.ts',
  sourceFlow: { policy: 'resolved-source-flow' },
};

function generate(statements: Statement[], extra: Partial<ModuleRecipe> = {}) {
  const declaration: Declaration = {
    ...span,
    kind: 'function',
    name: 'fixture',
    reference: null,
    returnType: 'bool',
    parameters: [{ name: 'flag', type: 'bool', named: false, required: true, default: null }],
    body: { ...span, kind: 'block', statements },
  };
  return emitDart([declaration], { ...recipe, ...extra });
}
function execute(source: string, load: (name: string) => unknown = () => ({})) {
  const exports: { fixture?: (flag: boolean) => boolean } = {};
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: load },
    { timeout },
  );
  return exports.fixture!;
}

test(
  'exhaustive returning cases keep both results without synthetic unreachable breaks',
  () => {
    const source = generate([
      switched(local('flag'), [
        { test: literal(true), statements: [returned(true)] },
        { test: literal(false), statements: [returned(false)] },
      ]),
    ]);
    const fixture = execute(source);
    expect([fixture(true), fixture(false)]).toEqual([true, false]);
    expect(source).not.toMatch(/return (?:true|false);\s*break;/);
  },
  timeout,
);

test(
  'a nested switch return exits its enclosing case',
  () => {
    const inner = switched(local('flag'), [
      { test: literal(true), statements: [returned(true)] },
      { test: null, statements: [returned(false)] },
    ]);
    const source = generate([
      switched(literal(true), [
        { test: literal(true), statements: [inner] },
        { test: null, statements: [returned(false)] },
      ]),
    ]);
    const fixture = execute(source);
    expect([fixture(true), fixture(false)]).toEqual([true, false]);
    expect(source).not.toContain('break;');
  },
  timeout,
);

test(
  'nested local breaks and an empty default preserve the outer case exit',
  () => {
    for (const fallback of [[stop], []]) {
      const inner = switched(local('flag'), [
        { test: literal(true), statements: [stop] },
        { test: null, statements: fallback },
      ]);
      const fixture = execute(
        generate([
          switched(literal(true), [
            { test: literal(true), statements: [inner] },
            { test: null, statements: [returned(true)] },
          ]),
          returned(false),
        ]),
      );
      expect([fixture(true), fixture(false)]).toEqual([false, false]);
    }
  },
  timeout,
);

test(
  'discarded expressions still invoke imported getters exactly once',
  () => {
    const value: Expression = {
      ...span,
      kind: 'identifier',
      type: 'bool',
      name: 'trigger',
      reference: null,
    };
    const source = generate([{ ...span, kind: 'expression', value }, returned(true)], {
      imports: { trigger: './getters.js' },
    });
    let reads = 0;
    const fixture = execute(source, () => ({
      get trigger() {
        reads++;
        return true;
      },
    }));
    expect(reads).toBe(0);
    expect(fixture(true)).toBe(true);
    expect(reads).toBe(1);
  },
  timeout,
);

test(
  'unused bindings preserve default module initialization and explicit initialization policies',
  () => {
    for (const importEmission of [
      undefined,
      { policy: 'used-identifiers' as const, sideEffects: ['./initialize.js'] },
    ]) {
      const extra: Partial<ModuleRecipe> = {
        imports: { Unused: './initialize.js' },
        typeImports: { UnusedType: './types.js' },
      };
      if (importEmission) extra.importEmission = importEmission;
      const source = generate([returned(true)], extra),
        initialized: string[] = [];
      const fixture = execute(source, (name) => {
        initialized.push(name);
        return {};
      });
      expect(fixture(true)).toBe(true);
      expect(initialized).toEqual(['./initialize.js']);
      expect(source).not.toContain('Unused');
    }
  },
  timeout,
);
