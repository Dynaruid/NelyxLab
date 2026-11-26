// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { openFlutterSource } from './flutter-source.mjs';
import {
  englishSchema,
  fail,
  parseArb,
  readMessages,
  requiredMessageKeys,
  requireMessages,
} from './flutter-localization-arb.mjs';

const arbDirectory = 'packages/flutter_localizations/lib/src/l10n';
const families = {
  widgets: { count: 117, folder: 'Nelyx', output: 'src/framework/widgets' },
  material: { count: 116, folder: 'packages/material', output: 'src/generated/localizations' },
  cupertino: { count: 115, folder: 'packages/cupertino', output: 'src/generated/localizations' },
};
// Normalize the three misspellings and disambiguate the two Basque suffixes
// handled by Flutter's literal replacement. Provenance keeps the original hashes.
const corrections = {
  cupertino_eu: {
    datePickerHourSemanticsLabelOne: ['Ordu$houra da', 'Ordu${hour}a da'],
    datePickerHourSemanticsLabelOther: ['$hourak dira', '${hour}ak dira'],
  },
  material_ps: { scrimOnTapHint: ['Close $modalRouteName', 'Close $modalRouteContentName'] },
  material_ug: {
    dateRangeStartDateSemanticLabel: ['باشلىنىش ۋاقتى fullDate$', 'باشلىنىش ۋاقتى $fullDate'],
    dateRangeEndDateSemanticLabel: ['ئاخىرلىشىش ۋاقتى fullDate$', 'ئاخىرلىشىش ۋاقتى $fullDate'],
  },
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (value) => JSON.stringify(value, null, 2);
// Flutter derives script parents before adding the regional classes. An explicit
// script file supersedes the first assumed script file in repository path order.
function localeParts(file, family) {
  const name = path.posix.basename(file, '.arb');
  const match = /^([a-z]{2,8})(?:_([A-Z][a-z]{3}))?(?:_([A-Z]{2}|\d{3}))?$/.exec(
    name.slice(family.length + 1),
  );
  if (!match) fail(file, '@locale', 'Invalid locale in filename');
  const [, language, script, region] = match;
  const inferred =
    script ??
    (language === 'zh'
      ? ['TW', 'HK', 'MO'].includes(region)
        ? 'Hant'
        : 'Hans'
      : language === 'sr' && !region
        ? 'Cyrl'
        : undefined);
  const inputTag = [language, script, region].filter(Boolean).join('-');
  const scriptTag = inferred ? `${language}-${inferred}` : null;
  const tag = region && inferred ? `${scriptTag}-${region}` : inputTag;
  const parent = region ? (scriptTag ?? language) : script ? language : null;
  return { name, language, scriptTag, tag, inputTag, parent };
}

export function readFlutterCatalog(source, family, files) {
  const englishFile = `${arbDirectory}/${family}_en.arb`;
  const english = parseArb(source.text(englishFile), englishFile);
  const metadata = englishSchema(english, englishFile);
  const required = requiredMessageKeys(english, metadata);
  const rows = new Map();
  const provenance = [];
  for (const file of [...files].sort()) {
    const { name, language, scriptTag, tag, inputTag, parent } = localeParts(file, family);
    const imported = readMessages(
      file === englishFile ? english : parseArb(source.text(file), file),
      file,
      english,
      metadata,
      corrections[name],
    );
    if (rows.has(tag) && !rows.get(tag).assumed) fail(file, '@locale', `Duplicate locale ${tag}`);
    rows.set(tag, { ...imported, parent, file });
    if (scriptTag && !rows.has(scriptTag))
      rows.set(scriptTag, { ...imported, parent: language, file, assumed: true });
    if (inputTag !== tag) rows.set(inputTag, { messages: {}, attributes: {}, parent: tag, file });
    provenance.push({
      path: file,
      gitBlob: source.blob(file),
      sha256: hash(source.read(file)),
      ...(corrections[name] ? { placeholderCorrections: corrections[name] } : {}),
    });
  }
  const inherited = new Map();
  const resolve = (tag) => {
    if (inherited.has(tag)) return inherited.get(tag);
    const row = rows.get(tag);
    if (!row) throw new Error(`Missing locale ${tag}`);
    if (row.parent && !rows.has(row.parent))
      fail(row.file, '@locale', `Missing parent ${row.parent}`);
    const parent = row.parent ? resolve(row.parent) : {};
    const messages = { ...parent, ...row.messages };
    requireMessages(messages, required, row.file, tag);
    inherited.set(tag, messages);
    return messages;
  };
  const locales = Object.fromEntries(
    [...rows.keys()].sort().map((tag) => {
      resolve(tag);
      const row = rows.get(tag);
      const parent = row.parent ? inherited.get(row.parent) : {};
      return [
        tag,
        {
          parent: row.parent,
          messages: Object.fromEntries(
            Object.entries(row.messages).filter(([key, value]) => parent[key] !== value),
          ),
          ...(Object.keys(row.attributes).length ? { metadata: row.attributes } : {}),
        },
      ];
    }),
  );
  return { metadata, locales, provenance };
}

function main() {
  const [repository, mode, ...extra] = process.argv.slice(2);
  if (!repository || (mode !== undefined && mode !== '--check') || extra.length)
    throw new Error('Usage: import-flutter-localizations.mjs <flutter-repo> [--check]');
  const source = openFlutterSource(repository);
  const inputs = source.files(arbDirectory);
  const files = Object.fromEntries(
    Object.entries(families).map(([family, { count }]) => {
      const paths = inputs.filter(
        (file) => file.startsWith(`${arbDirectory}/${family}_`) && file.endsWith('.arb'),
      );
      if (paths.length !== count)
        throw new Error(`${family}: expected ${count} ARBs, got ${paths.length}`);
      return [family, paths];
    }),
  );
  source.preload(Object.values(files).flat());
  const outputs = new Map();
  const stats = {};
  for (const [family, { folder, output }] of Object.entries(families)) {
    const { metadata, locales, provenance } = readFlutterCatalog(source, family, files[family]);
    const typeImport =
      family === 'widgets'
        ? './widget-localization-catalog.ts'
        : '@nelyx/core/framework/widgets/widget-localization-catalog';
    outputs.set(
      `${folder}/${output}/${family}-arb.generated.ts`,
      `// SPDX-License-Identifier: BSD-3-Clause\n// Copyright 2014 The Flutter Authors. All rights reserved.\n` +
        `// Generated by import-flutter-localizations.mjs from Flutter ${source.revision}.\n` +
        `import type { WidgetLocalizationCatalogData } from '${typeImport}';\n\n` +
        `export const ${family}Arb: WidgetLocalizationCatalogData = {\n  metadata: ${json(metadata).replaceAll('\n', '\n  ')},\n  locales: {\n` +
        Object.entries(locales)
          .map(([tag, row]) => `    ${JSON.stringify(tag)}: ${JSON.stringify(row)},`)
          .join('\n') +
        '\n  },\n};\n',
    );
    outputs.set(
      `${folder}/licenses/flutter-localizations-sources.json`,
      json({
        schema: 'nelyx.flutter-localization-sources/v1',
        repository: 'https://github.com/flutter/flutter',
        revision: source.revision,
        license: 'BSD-3-Clause',
        notice: 'Flutter-LICENSE.md',
        family,
        inputs: provenance,
        locales: Object.keys(locales),
      }) + '\n',
    );
    stats[family] = { inputs: provenance.length, catalogLocales: Object.keys(locales).length };
  }
  const root = path.resolve(import.meta.dirname, '../..');
  const differences = [];
  for (const [relative, content] of outputs) {
    const file = path.join(root, relative);
    const current = fs.existsSync(file)
      ? fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n')
      : null;
    if (current === content) continue;
    if (mode === '--check') differences.push(relative);
    else fs.writeFileSync(file, content, 'utf8');
  }
  if (differences.length)
    throw new Error(`Flutter localization outputs differ: ${differences.join(', ')}`);
  console.log(JSON.stringify({ revision: source.revision, ...stats }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
