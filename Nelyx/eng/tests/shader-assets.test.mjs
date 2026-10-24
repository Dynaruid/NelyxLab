// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import {shaderAssetImports} from '../shader-assets.mjs';

const timeout = 1_200_000;
async function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-shader-'));
  try {
    const shaders = path.join(root, 'assets', 'shaders');
    fs.mkdirSync(shaders, {recursive: true});
    const file = path.join(shaders, 'effect.sksl');
    const emit = (source = "import shader from '../assets/shaders/effect.sksl'; export default shader;") => ts.transpileModule(source, {
      fileName: path.join(root, 'src', 'effect.ts'),
      compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022},
      transformers: {before: [shaderAssetImports(root)]},
    }).outputText;
    return await run({root, file, emit});
  } finally {
    assert(path.dirname(root) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('nelyx-shader-'));
    fs.rmSync(root, {recursive: true, force: true});
  }
}

test('package emit embeds the current SkSL file bytes and needs no runtime loader', {timeout}, async () => {
  // Await inside the fixture so temporary assets remain until the consumer finishes.
  await fixture(async ({file, emit}) => {
    for (const color of ['1, 0, 0, 1', '0, 1, 0, 1']) {
      const source = '// "quoted" \\ shader\n\thalf4 main(float2 p) { return half4(' + color + '); }\n';
      fs.writeFileSync(file, source);
      const output = emit();
      assert(!/\bimport\b|\brequire\(/.test(output));
      const module = await import('data:text/javascript,' + encodeURIComponent(output));
      assert.equal(module.default, source, 'Rebuild must read edited asset bytes');
    }
  });
});

test('missing, empty, non-ASCII and oversized shader assets fail the package emit', {timeout}, async () => {
  await fixture(({file, emit}) => {
    assert.throws(() => emit(), /ENOENT/);
    for (const source of ['', '   ', 'half4 main() { /* 한글 */ }', 'x'.repeat(16385)]) {
      fs.writeFileSync(file, source);
      assert.throws(() => emit(), /16384 ASCII/);
    }
  });
});

test('shader imports cannot escape their owner or use unsupported loading forms', {timeout}, async () => {
  await fixture(({root, file, emit}) => {
    fs.writeFileSync(file, 'half4 main(float2 p) { return half4(1); }');
    fs.writeFileSync(path.join(root, 'other.sksl'), 'half4 main(float2 p) { return half4(0); }');
    assert.throws(() => emit("import s from '../other.sksl';"), /assets\/shaders/);
    for (const source of [
      "import s from '@another/package/effect.sksl';",
      "import {shader} from '../assets/shaders/effect.sksl';",
      "import '../assets/shaders/effect.sksl';",
      "export {default} from '../assets/shaders/effect.sksl';",
      "export const s = import('../assets/shaders/effect.sksl');",
    ]) assert.throws(() => emit(source), /default import/);
  });
});
