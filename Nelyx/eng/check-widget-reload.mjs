// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { transformWithOxc } from 'vite';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import {
  inspectWidgetModule,
  instrumentWidgetModule,
  widgetRuntimeId,
  widgetUpdateModule,
} from '../sdk/tooling/vite/src/widget-reload.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

const widgetRuntime = new URL('../sdk/tooling/vite/src/widget-runtime.mjs', import.meta.url);
const { applyWidgetUpdate } = await import(widgetRuntime.href);
const framework = '@nelyx/core/framework/widgets/framework';
const filename = '/app/widget.ts';
const initial = `
import { State as Base } from '${framework}';
let builds = 0;
export const topLevel = {};
const multiply = (a: number, b: number) => a * b;
export class MyState extends Base {
  count = 1;
  override build(input: number) {
    const local = this.count;
    return { builds, invoke: () => [multiply(++this.count, input), local] };
  }
}
export function bump() { builds++; }
`;
const next = initial.replace('multiply(++this.count, input)', 'multiply(++this.count, input + 1)');
const analysis = inspectWidgetModule(filename, initial);
const changed = inspectWidgetModule(filename, next);
assert.equal(changed.shape, analysis.shape);
assert.deepEqual([...changed.methods.get('MyState.build').reads].sort(), ['builds', 'multiply']);
const encode = (code) => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
async function compile(text) {
  const { code } = await transformWithOxc(text, filename, { lang: 'ts' });
  return import(encode(code));
}
const frameworkStub = encode('export class State {}');
const original = await compile(
  instrumentWidgetModule(initial, 'widget.ts', analysis, analysis.bindings)
    .replace(widgetRuntimeId, widgetRuntime.href)
    .replace(framework, frameworkStub),
);
const state = new original.MyState();
const method = state.build;
assert.deepEqual(method.call(state, 2).invoke(), [4, 1]);
original.bump();
const first = await compile(widgetUpdateModule(new Map([['widget.ts', changed]])));
assert.equal(applyWidgetUpdate(first.default), true);
assert.equal(state.build, method);
const result = state.build(2);
assert.equal(result.builds, 1);
assert.deepEqual(result.invoke(), [9, 2]);
assert.equal(state.count, 3);
assert.equal(applyWidgetUpdate([['widget.ts', 'different-shape', []]]), false);
assert.deepEqual(state.build(2).invoke(), [12, 3]);

for (const unsupported of [
  next.replace('count = 1', 'count = 2'),
  next.replace('const local = this.count', 'const local = super.build(input)'),
  next.replace('const local = this.count', 'const local = ++builds'),
  next.replace('const local = this.count', 'const local = import.meta.url'),
])
  assert.notEqual(inspectWidgetModule(filename, unsupported).shape, analysis.shape);
assert.throws(
  () => inspectWidgetModule(filename, next.replace('local = this.count', 'local = )')),
  SyntaxError,
);
console.log('Widget method replacement, lexical references, state and incompatible edits passed.');
