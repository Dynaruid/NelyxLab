// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openFlutterSource } from './flutter-source.mjs';

const [repository, mode] = process.argv.slice(2);
assert(repository && (mode === undefined || mode === '--check'), 'Usage: <flutter-repo> [--check]');
const source = openFlutterSource(repository);
const files = source
  .files('packages/flutter_localizations/lib/src/l10n')
  .filter((file) => /\/cupertino_[A-Za-z0-9_]+\.arb$/.test(file));
source.preload(files);
const entries = new Map();
for (const file of files) {
  const locale = /\/cupertino_(.+)\.arb$/.exec(file)[1];
  const value = JSON.parse(source.text(file)).searchTextFieldPlaceholderLabel;
  if (value !== undefined) {
    assert.equal(typeof value, 'string', file);
    entries.set(locale, value);
  }
}
assert(entries.has('en') && entries.size > 1, 'Missing pinned search placeholder translations');
const output = new URL(
  '../../packages/cupertino/src/generated/localizations/search-localizations-data.generated.ts',
  import.meta.url,
);
const text =
  '// SPDX-License-Identifier: BSD-3-Clause\n' +
  '// Copyright 2014 The Flutter Authors. All rights reserved.\n' +
  `// Generated from Flutter ${source.revision} Cupertino ARB search placeholders.\n` +
  'export const searchPlaceholderLabels: Readonly<Partial<Record<string, string>>> = {\n' +
  [...entries]
    .map(([locale, value]) => {
      const json = JSON.stringify(value);
      const literal = value.includes("'")
        ? json
        : "'" + json.slice(1, -1).replaceAll('\\"', '"') + "'";
      return `  ${locale}: ${literal},\n`;
    })
    .join('') +
  '};\n';
if (mode === '--check')
  assert.equal(fs.readFileSync(output, 'utf8').replaceAll('\r\n', '\n'), text);
else fs.writeFileSync(output, text);
