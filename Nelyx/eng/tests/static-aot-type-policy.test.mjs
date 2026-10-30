// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {
  automaticPartition,
  verifyTypePolicy,
} from '../../sdk/tooling/static-aot/src/type-policy.mjs';
const timeout = 1_200_000;
test(
  'annotation and checked IR select scalar bodies automatically while dynamic semantics keep their owners',
  { timeout },
  () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-auto-policy-'));
    try {
      const entry = path.join(folder, 'entry.ts');
      const text = `let observed=1;
export function numeric(x:number):number { return x*x+observed; }
export function inferred(x:number) { return x*x; }
export function uncertain(x:any):number { return x*x; }
export function array(x:number[]):number { return x[0]; }
export function args(x:number):number { return arguments.length; }
export class Holder { value=2; read(x:number):number { return x*this.value; } }
export function mutate(x:number):number { observed=x; return observed; }
export function callback(fn:()=>number):number { return fn(); }
export function pure(x:number,enabled:boolean):number { if(enabled)return x*x;return x+1; }
`;
      fs.writeFileSync(entry, text);
      const options = { entry, applicationRoot: folder, packageRoots: [] },
        partition = automaticPartition(options);
      assert.deepEqual(
        partition.bindings.map((b) => b.name),
        ['pure'],
      );
      assert.equal(verifyTypePolicy(partition.typePolicy), partition.typePolicy);
      const tampered = structuredClone(partition.typePolicy);
      tampered.decisions[0].reason = 'forged';
      assert.throws(() => verifyTypePolicy(tampered), /evidence differs/);
      assert.match(
        partition.typePolicy.decisions.find((d) => d.name === 'read').reason,
        /dynamic observations/,
      );
      assert(
        partition.typePolicy.decisions.every((d) => d.reason && d.sourceSha256 && d.offset >= 0),
      );
      assert.match(
        partition.typePolicy.decisions.find((d) => d.name === 'args').reason,
        /Special lexical/,
      );
      const create = (source) => {
        const context = vm.createContext({ exports: {}, Number });
        vm.runInContext(
          ts.transpileModule(partition.source + '\n' + source, {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
          }).outputText,
          context,
        );
        return context;
      };
      const parsed = ts.createSourceFile(entry, text, ts.ScriptTarget.ES2022, true),
        edits = [];
      const visit = (node) => {
        if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.body) {
          const className = ts.isClassDeclaration(node.parent) ? node.parent.name?.text : null;
          const binding = partition.bindings.find(
            (binding) =>
              binding.name === node.name?.getText(parsed) && binding.className === className,
          );
          if (binding)
            edits.push({
              start: node.body.getStart(parsed),
              end: node.body.end,
              text:
                '{if(' +
                binding.guard +
                '){' +
                binding.adapter +
                '}' +
                node.body.getText(parsed).slice(1, -1) +
                '}',
            });
        }
        ts.forEachChild(node, visit);
      };
      visit(parsed);
      let adaptedSource = text;
      for (const edit of edits.sort((a, b) => b.start - a.start))
        adaptedSource =
          adaptedSource.slice(0, edit.start) + edit.text + adaptedSource.slice(edit.end);
      const original = create(text),
        adapted = create(adaptedSource);
      for (const value of [
        -0,
        NaN,
        Infinity,
        3,
        '3',
        null,
        undefined,
        {
          valueOf() {
            return 4;
          },
        },
      ])
        for (const enabled of [true, false, 0, 'yes'])
          assert(
            Object.is(original.exports.pure(value, enabled), adapted.exports.pure(value, enabled)),
          );
      const calls = () => adapted[partition.bindings[0].globalName + '_calls']();
      const before = calls();
      adapted.exports.pure('3', true);
      assert.equal(calls(), before);
      adapted.exports.pure(3, true);
      assert.equal(calls(), before + 1);
      for (const value of [-0, Number.MIN_VALUE, 0.25, NaN, Infinity])
        assert(Object.is(original.exports.numeric(value), adapted.exports.numeric(value)));
      original.exports.mutate(7);
      adapted.exports.mutate(7);
      assert.equal(original.exports.numeric(3), adapted.exports.numeric(3));
      const a = new original.exports.Holder(),
        b = new adapted.exports.Holder();
      for (const value of [-0, 0, Number.MIN_VALUE, 0.25, NaN, Infinity, -Infinity])
        assert(Object.is(a.read(value), b.read(value)));
      const observe = (value) => {
        let reads = 0;
        const proxy = new Proxy(value, {
          get(target, key, receiver) {
            if (key === 'value') reads++;
            return Reflect.get(target, key, receiver);
          },
        });
        return { value: proxy.read(0.3), reads };
      };
      assert.deepEqual(observe(a), observe(b));
      const sentinel = Error('getter sentinel');
      Object.defineProperty(a, 'value', {
        get() {
          throw sentinel;
        },
      });
      Object.defineProperty(b, 'value', {
        get() {
          throw sentinel;
        },
      });
      for (const value of [a, b])
        assert.throws(
          () => value.read(1),
          (error) => error === sentinel,
        );
      // Renaming a function cannot remove its eligibility; changing annotations can.
      fs.writeFileSync(
        entry,
        text.replaceAll('pure', 'renamed') +
          '\nexport function added(n:number):number{return n+1;}\n',
      );
      const expanded = automaticPartition(options);
      assert(expanded.bindings.some((b) => b.name === 'added'));
      assert(expanded.bindings.some((b) => b.name === 'renamed'));
      fs.writeFileSync(entry, 'export function onlyDynamic(value:any){return value;}');
      const dynamic = automaticPartition(options);
      assert.equal(dynamic.bindings.length, 0);
      assert.equal(dynamic.typePolicy.summary.specialize, 0);
    } finally {
      assert.equal(path.dirname(folder), fs.realpathSync(os.tmpdir()));
      assert(!fs.lstatSync(folder).isSymbolicLink());
      fs.rmSync(folder, { recursive: true, force: true });
    }
  },
);
