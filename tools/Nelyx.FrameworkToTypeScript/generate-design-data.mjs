// SPDX-License-Identifier: BSD-3-Clause
import { relocateProductModule } from './product-module-layout.mjs';
// Finite immutable design data, not a general Dart/C# compiler.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const sourceRoot = '.tmp/work6/flutter-source',
  pin = '71e4717a61786faab4c7aa39825989305ed29e8a';
const parser = 'tools/Nelyx.FrameworkToTypeScript/dart/bin/design_values.dart',
  dart = path.resolve('.tmp/work6/dart-dev/dart-sdk/bin/dart.exe');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  hash = (file) => digest(fs.readFileSync(file));
function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 1200000,
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(result.status, 0, String(result.error ?? '') + result.stderr);
  return result.stdout;
}
assert.equal(run('git', ['-C', sourceRoot, 'rev-parse', 'HEAD']).trim(), pin);
assert.equal(run('git', ['-C', sourceRoot, 'status', '--porcelain']).trim(), '');
const inputs = [],
  outputs = [];
function read(source, symbol, ...names) {
  const file = sourceRoot + '/' + source,
    data = JSON.parse(run(dart, [parser, file, symbol, ...names]));
  assert.equal(data.sourceSha256, hash(file));
  inputs.push({ file, sha256: hash(file), symbol });
  return data.fields;
}
function render(node, mode, localNames = new Set()) {
  switch (node.kind) {
    case 'int':
    case 'double':
    case 'bool':
    case 'string':
      return JSON.stringify(node.value);
    case 'null':
      return 'null';
    case 'negate':
      return '-' + render(node.value, mode, localNames);
    case 'ref': {
      if (localNames.has(node.name)) return 'Colors.' + node.name;
      if (/^(Brightness|TextBaseline|TextLeadingDistribution)\./.test(node.name))
        return JSON.stringify(node.name.split('.')[1]);
      if (/^FontWeight\.(w[1-9]00|normal|bold)$/.test(node.name)) return node.name;
      if (node.name === 'TextDecoration.none') return 'TextDecoration.none';
      if (mode === 'typography' && node.name === '_helsinkiFontFallbacks')
        return 'helsinkiFontFallbacks';
      if (/^Colors\.[a-zA-Z0-9]+$/.test(node.name))
        return mode === 'palette' ? node.name : node.name + '.toARGB32()';
      throw Error('Unbound data reference: ' + node.name);
    }
    case 'list':
      return (
        'Object.freeze([' +
        node.values.map((entry) => render(entry, mode, localNames)).join(',') +
        '])'
      );
    case 'map':
      return (
        'new Map<number,Color>([' +
        node.values
          .map(
            (entry) =>
              '[' +
              render(entry.key, mode, localNames) +
              ',' +
              render(entry.value, mode, localNames) +
              ']',
          )
          .join(',') +
        '])'
      );
    case 'new': {
      const args = node.args;
      if (
        node.type === 'Color' &&
        node.constructor === null &&
        args.length === 1 &&
        args[0].name === null &&
        (args[0].value.kind === 'int' ||
          (args[0].value.kind === 'ref' && localNames.has(args[0].value.name)))
      )
        return mode === 'palette'
          ? 'constSourceColor(Color,' + render(args[0].value, mode, localNames) + ')'
          : render(args[0].value, mode, localNames);
      if (
        ['MaterialColor', 'MaterialAccentColor'].includes(node.type) &&
        mode === 'palette' &&
        node.constructor === null &&
        args.length === 2 &&
        args.every((arg) => arg.name === null)
      )
        return (
          'new ' +
          node.type +
          '(' +
          args.map((arg) => render(arg.value, mode, localNames)).join(',') +
          ')'
        );
      if (
        ['TextTheme', 'TextStyle', 'ColorScheme'].includes(node.type) &&
        node.constructor === null &&
        args.every((arg) => typeof arg.name === 'string')
      ) {
        const object =
          '{' +
          args.map((arg) => arg.name + ':' + render(arg.value, mode, localNames)).join(',') +
          '}';
        return node.type === 'ColorScheme'
          ? 'Object.freeze(' + object + ')'
          : 'new ' + node.type + '(' + object + ')';
      }
      throw Error('Unsupported design data constructor: ' + node.type + '.' + node.constructor);
    }
    default:
      throw Error('Unsupported design data kind: ' + node.kind);
  }
}
function output(file, source, text) {
  const header = `// SPDX-License-Identifier: BSD-3-Clause\n// Copyright 2014 The Flutter Authors. All rights reserved.\n// Immutable data from Flutter ${pin} ${source}; SHA256 ${hash(sourceRoot + '/' + source)}.\n// Regenerate with tools/Nelyx.FrameworkToTypeScript/generate-design-data.mjs.\n`;
  let parsed = ts.createSourceFile(file, header + text, ts.ScriptTarget.Latest, true);
  assert.equal(parsed.parseDiagnostics.length, 0, file);
  // Emit immutable TextStyle specifications independently from the TextTheme
  // class. Its canonical owner supplies construction through one default path.
  if (source === 'packages/flutter/lib/src/material/typography.dart') {
    let scales = 0;
    const transformed = ts.transform(parsed, [
      (context) => (node) => {
        const visit = (current) => {
          if (
            ts.isPropertyAssignment(current) &&
            ts.isNewExpression(current.initializer) &&
            ts.isIdentifier(current.initializer.expression) &&
            current.initializer.expression.text === 'TextTheme'
          ) {
            assert(ts.isIdentifier(current.name));
            assert.equal(current.initializer.arguments?.length, 1);
            assert(ts.isObjectLiteralExpression(current.initializer.arguments[0]));
            scales++;
            return ts.factory.updatePropertyAssignment(
              current,
              current.name,
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('Object'),
                  'freeze',
                ),
                undefined,
                [current.initializer.arguments[0]],
              ),
            );
          }
          return ts.visitEachChild(current, visit, context);
        };
        return ts.visitNode(node, visit);
      },
    ]);
    const updated = transformed.transformed[0];
    assert.equal(
      scales,
      13,
      'Expected three M3 geometry scales and ten platform color/font themes',
    );
    parsed = ts.factory.updateSourceFile(
      updated,
      updated.statements.filter(
        (statement) =>
          !ts.isImportDeclaration(statement) ||
          !statement.importClause?.namedBindings ||
          !ts.isNamedImports(statement.importClause.namedBindings) ||
          !statement.importClause.namedBindings.elements.some(
            (element) => element.name.text === 'TextTheme',
          ),
      ),
    );
    transformed.dispose();
  }
  const relocated = relocateProductModule(
    file,
    ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(parsed),
  );
  file = relocated.file;
  const bytes = Buffer.from(relocated.text);
  outputs.push({ file, bytes, sha256: digest(bytes) });
}
const paletteSource = 'packages/flutter/lib/src/material/colors.dart',
  palette = read(paletteSource, 'Colors');
const localNames = new Set(palette.map((field) => field.name));
function refs(value) {
  if (value === null || typeof value !== 'object') return [];
  return [
    ...(value.kind === 'ref' && localNames.has(value.name) ? [value.name] : []),
    ...Object.values(value).flatMap(refs),
  ];
}
const ordered = [],
  done = new Set(),
  visiting = new Set();
function visit(field) {
  if (done.has(field.name)) return;
  assert(!visiting.has(field.name), 'Data dependency cycle');
  visiting.add(field.name);
  for (const name of refs(field.value)) visit(palette.find((field) => field.name === name));
  visiting.delete(field.name);
  done.add(field.name);
  ordered.push(field);
}
palette.forEach(visit);
const paletteType = (type) =>
  ({
    Color: 'Color',
    MaterialColor: 'MaterialColor',
    MaterialAccentColor: 'MaterialAccentColor',
    'int': 'number',
    'List<MaterialColor>': 'readonly MaterialColor[]',
    'List<MaterialAccentColor>': 'readonly MaterialAccentColor[]',
  })[type] ??
  (() => {
    throw Error('Unknown palette type: ' + type);
  })();
output(
  'packages/material/src/colors.generated.ts',
  paletteSource,
  `import {Color} from '@nelyx/core/ui/color';\nimport {constSourceColor} from '@nelyx/core/internal/ui/color-source-adapter';\nimport {MaterialColor,MaterialAccentColor} from './material-color.ts';\nexport {MaterialColor,MaterialAccentColor} from './material-color.ts';\nexport abstract class Colors {\n` +
    ordered
      .map(
        (field) =>
          `${field.name.startsWith('_') ? 'private ' : ''}static readonly ${field.name}:${paletteType(field.type)}=${render(field.value, 'palette', localNames)};`,
      )
      .join('\n') +
    '\n}\nObject.freeze(Colors);\n',
);
const typographySource = 'packages/flutter/lib/src/material/typography.dart',
  scales = read(typographySource, '_M3Typography');
assert.deepEqual(
  scales.map((field) => field.name),
  ['englishLike', 'dense', 'tall'],
);
const platformThemeNames = [
  'blackMountainView',
  'whiteMountainView',
  'blackRedmond',
  'whiteRedmond',
  'blackHelsinki',
  'whiteHelsinki',
  'blackCupertino',
  'whiteCupertino',
  'blackRedwoodCity',
  'whiteRedwoodCity',
];
const platformValues = read(
  typographySource,
  'Typography',
  ...platformThemeNames,
  '_helsinkiFontFallbacks',
);
assert.equal(platformValues.length, 11);
assert(platformThemeNames.every((name) => platformValues.some((field) => field.name === name)));
output(
  'packages/material/src/typography-data.ts',
  typographySource,
  `import {TextTheme} from './text-theme.ts';\nimport {TextStyle} from '@nelyx/core/framework/painting/text-style';\nimport {FontWeight} from '@nelyx/core/ui/typography';\nimport {TextDecoration} from '@nelyx/core/ui/typography';\nimport {Colors} from './colors.ts';\nconst helsinkiFontFallbacks=` +
    render(
      platformValues.find((field) => field.name === '_helsinkiFontFallbacks').value,
      'typography',
    ) +
    `;\nexport const material2021=Object.freeze({` +
    scales.map((field) => field.name + ':' + render(field.value, 'typography')).join(',') +
    '});\nexport const platformTextThemes=Object.freeze({' +
    platformThemeNames
      .map(
        (name) =>
          name +
          ':' +
          render(platformValues.find((field) => field.name === name).value, 'typography'),
      )
      .join(',') +
    '});\n',
);
const defaultsSource = 'packages/flutter/lib/src/material/theme_data.dart',
  defaults = read(defaultsSource, 'topLevel', '_colorSchemeLightM3', '_colorSchemeDarkM3');
assert.equal(defaults.length, 2);
output(
  'packages/material/src/color-scheme-data.ts',
  defaultsSource,
  defaults
    .map(
      (field) =>
        `export const ${field.name === '_colorSchemeLightM3' ? 'm3LightColorRoles' : 'm3DarkColorRoles'}=${render(field.value, 'scheme')};`,
    )
    .join('\n'),
);
const l10nSource = 'packages/flutter_localizations/lib/src/l10n',
  scriptCategories = {};
for (const name of fs
  .readdirSync(sourceRoot + '/' + l10nSource)
  .filter((name) => /^material_.+\.arb$/.test(name))
  .sort()) {
  const file = sourceRoot + '/' + l10nSource + '/' + name,
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  inputs.push({ file, sha256: hash(file), symbol: 'scriptCategory' });
  if (data.scriptCategory !== undefined) {
    assert(
      ['English-like', 'dense', 'tall'].includes(data.scriptCategory),
      'Unknown ARB script category: ' + file,
    );
    scriptCategories[name.slice(9, -4)] =
      data.scriptCategory === 'English-like' ? 'englishLike' : data.scriptCategory;
  }
}
assert(Object.keys(scriptCategories).length > 90);
output(
  'packages/material/src/generated/localizations/script-categories.ts',
  l10nSource + '/material_en.arb',
  `export const scriptCategories:Readonly<Record<string,'englishLike'|'dense'|'tall'>>=Object.freeze(${JSON.stringify(scriptCategories)});\n`,
);
const recordFile = 'tools/Nelyx.FrameworkToTypeScript/data/work8/w11-design-data-ownership.json',
  previous = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile, 'utf8')) : null;
if (process.argv.includes('--check')) {
  for (const row of outputs)
    assert.equal(hash(row.file), row.sha256, 'Generated design data drift: ' + row.file);
} else {
  // Fail closed on direct edits; regenerate only an unchanged prior owned base.
  for (const row of outputs)
    if (fs.existsSync(row.file))
      assert(
        previous?.outputs.some((old) => old.file === row.file && old.sha256 === hash(row.file)) ||
          hash(row.file) === row.sha256,
        'Preserve edited data before regeneration: ' + row.file,
      );
  for (const row of outputs) fs.writeFileSync(row.file, row.bytes);
  fs.writeFileSync(
    recordFile,
    JSON.stringify(
      {
        schema: 'nelyx.w11-design-data-ownership/v1',
        revision: pin,
        mode: 'generated-immutable-data-fail-on-product-edit',
        parser: { file: parser, sha256: hash(parser) },
        generator: {
          file: path.relative(process.cwd(), import.meta.filename).replaceAll('\\', '/'),
          sha256: hash(import.meta.filename),
        },
        inputs,
        outputs: outputs.map(({ bytes, ...row }) => row),
        scope:
          'Full original Material palette values, M3 geometry scales, all ten platform color/font themes, ARB script categories and ThemeData M3 default role tokens. Data output is separate from handwritten functional classes. No Dart dependency in product build/runtime.',
      },
      null,
      2,
    ) + '\n',
  );
}
console.log(
  JSON.stringify({
    status: 'PASS-scoped',
    checkOnly: process.argv.includes('--check'),
    inputs: inputs.length,
    outputs: outputs.map(({ file, sha256 }) => ({ file, sha256 })),
  }),
);
