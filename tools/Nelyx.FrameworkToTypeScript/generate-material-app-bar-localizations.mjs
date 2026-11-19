// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openFlutterSource } from './flutter-source.mjs';

const [repository, mode] = process.argv.slice(2);
assert(repository && (mode === undefined || mode === '--check'), 'Usage: <flutter-repo> [--check]');
const source = openFlutterSource(repository);
const files = source
  .files('packages/flutter_localizations/lib/src/l10n')
  .filter((file) => /\/material_[A-Za-z0-9_]+\.arb$/.test(file));
source.preload(files);
const catalogs = files.map((file) => [
  /\/material_(.+)\.arb$/.exec(file)[1],
  JSON.parse(source.text(file)),
]);
const declarations = [
  ['closeButtonTooltip', 'closeButtonTooltips'],
  ['drawerLabel', 'drawerLabels'],
  ['openAppDrawerTooltip', 'openAppDrawerTooltips'],
  ['tabLabel', 'tabLabels'],
];
const tables = declarations.map(([key, name]) => {
  const values = Object.fromEntries(
    catalogs.flatMap(([locale, entries]) => {
      const value = entries[key];
      if (value === undefined) return [];
      assert.equal(typeof value, 'string', `Material ${locale} ${key}`);
      return [[locale, value]];
    }),
  );
  assert(values.en && Object.keys(values).length > 1, `Pinned Material ${key} values are missing`);
  return (
    `export const ${name}: Readonly<Partial<Record<string, string>>> = Object.freeze(` +
    JSON.stringify(values, null, 2) +
    ');\n'
  );
});
const output = new URL(
  '../../packages/material/src/generated/localizations/app-bar-localizations-data.generated.ts',
  import.meta.url,
);
const text =
  '// SPDX-License-Identifier: BSD-3-Clause\n' +
  '// Copyright 2014 The Flutter Authors. All rights reserved.\n' +
  `// Generated from Flutter ${source.revision} Material navigation ARB strings.\n` +
  tables.join('');
if (mode === '--check')
  assert.equal(fs.readFileSync(output, 'utf8').replaceAll('\r\n', '\n'), text);
else fs.writeFileSync(output, text);
