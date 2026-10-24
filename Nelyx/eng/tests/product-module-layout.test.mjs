// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import {productModulePath, relocateProductModule} from '../../../tools/Nelyx.FrameworkToTypeScript/product-module-layout.mjs';

test('generation layout relocates actual module references and preserves data, comments and provenance', {timeout: 1_200_000}, () => {
  const original = `// Source text ./checkbox.ts remains literal documentation.
import {Theme} from './theme.ts';
import {Painter} from './checkbox-painter.ts';
import {Color} from '@nelyx/core/ui/color';
export type Checkbox = import('./checkbox.ts').Checkbox;
/** @dartType double */ export const width: number = 18;
export const asset = './assets/unchanged.bin';
`;
  const actual = relocateProductModule('packages/material/src/checkbox-build.ts', original);
  assert.equal(actual.file, 'packages/material/src/internal/checkbox/checkbox-build.ts');
  assert.match(actual.text, /from "\.\.\/\.\.\/theme\.ts"/);
  assert.match(actual.text, /from '\.\/checkbox-painter\.ts'/);
  assert.match(actual.text, /import\("\.\.\/\.\.\/checkbox\.ts"\)/);
  assert(actual.text.includes("from '@nelyx/core/ui/color'"));
  assert(actual.text.includes("export const asset = './assets/unchanged.bin'"));
  assert(actual.text.includes('/** @dartType double */ export const width: number = 18;'));
  assert(actual.text.startsWith('// Source text ./checkbox.ts remains literal documentation.'));
  const dynamic = relocateProductModule('packages/cupertino/src/checkbox-build.ts', "export const load = () => import('./checkbox-defaults.generated.ts');");
  assert.match(dynamic.text, /import\("\.\.\/\.\.\/generated\/checkbox\/checkbox-defaults.generated\.ts"\)/);
  assert.equal(productModulePath('packages/material/src/filled-button.ts'), 'packages/material/src/filled-button.ts');
  const catalog = relocateProductModule('packages/material/src/chip.ts', "import {Icons} from './icons.ts';");
  assert.equal(catalog.text, "import {Icons} from './icons.ts';");
  const facade = relocateProductModule('packages/material/src/icons.ts', "export {Icons} from './generated/icons/icons.ts';", {destination: 'packages/material/src/icons.ts'});
  assert.equal(facade.file, 'packages/material/src/icons.ts');
  assert.equal(facade.text, "export {Icons} from './generated/icons/icons.ts';");
  assert.throws(() => relocateProductModule('packages/material/src/checkbox.ts', 'const value = ;'), /invalid TypeScript/);
});
