// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openFlutterSource } from './flutter-source.mjs';

const [repository, dart, mode] = process.argv.slice(2);
assert(
  repository && dart && (mode === undefined || mode === '--check'),
  'Usage: <flutter-repo> <pinned-dart> [--check]',
);
const source = openFlutterSource(repository);
const dartPath = fs.realpathSync(dart);
const requiredRevision = /^\s*'dart_revision':\s*'([a-f0-9]{40})',/m.exec(source.text('DEPS'))?.[1];
assert(
  requiredRevision &&
    fs.readFileSync(path.resolve(dartPath, '../../revision'), 'utf8').trim() === requiredRevision,
  'Flutter Dart revision differs',
);
const keys = [
  'timeOfDayFormat',
  'anteMeridiemAbbreviation',
  'postMeridiemAbbreviation',
  'timePickerDialHelpText',
  'timePickerInputHelpText',
  'timePickerHourLabel',
  'timePickerMinuteLabel',
  'timePickerHourModeAnnouncement',
  'timePickerMinuteModeAnnouncement',
  'invalidTimeLabel',
  'dialModeButtonLabel',
  'inputTimeModeButtonLabel',
  'modalBarrierDismissLabel',
  'cancelButtonLabel',
  'okButtonLabel',
];
const formats = new Map([
  ['HH:mm', 'HH_colon_mm'],
  ['HH.mm', 'HH_dot_mm'],
  ["HH 'h' mm", 'frenchCanadian'],
  ['H:mm', 'H_colon_mm'],
  ['h:mm a', 'h_colon_mm_space_a'],
  ['a h:mm', 'a_space_h_colon_mm'],
  ['ah:mm', 'a_space_h_colon_mm'],
]);
const files = source
  .files('packages/flutter_localizations/lib/src/l10n')
  .filter((file) => /\/material_[A-Za-z0-9_]+\.arb$/.test(file));
source.preload(files);
const labels = Object.fromEntries(
  files.map((file) => {
    const locale = /\/material_(.+)\.arb$/.exec(file)[1];
    const entries = JSON.parse(source.text(file));
    const values = {};
    for (const key of keys) {
      const entry = entries[key];
      if (entry === undefined) continue;
      assert.equal(typeof entry, 'string', `${file}: ${key}`);
      const value = key === 'timeOfDayFormat' ? formats.get(entry) : entry;
      assert.notEqual(value, undefined, `${file}: ${entry}`);
      values[key] = value;
    }
    return [locale, values];
  }),
);
assert.deepEqual(Object.keys(labels.en), keys);
const response = spawnSync(
  dartPath,
  [path.join(import.meta.dirname, 'dart/bin/material_time_digits.dart')],
  {
    input: JSON.stringify(Object.keys(labels)),
    encoding: 'utf8',
    timeout: 1_200_000,
    windowsHide: true,
  },
);
if (response.error || response.status !== 0)
  throw Error('Cannot extract pinned Material time digits: ' + (response.error ?? response.stderr));
const digits = JSON.parse(response.stdout);
assert.deepEqual(Object.keys(digits), Object.keys(labels));
for (const [locale, value] of Object.entries(digits))
  assert.equal(new Set([...value]).size, 10, locale);
const output = new URL(
  '../../packages/material/src/generated/localizations/time-localizations-data.generated.ts',
  import.meta.url,
);
const text =
  '// SPDX-License-Identifier: BSD-3-Clause\n' +
  '// Copyright 2014 The Flutter Authors. All rights reserved.\n' +
  `// Generated from Flutter ${source.revision} Material ARB strings and Dart intl 0.20.3 digits.\n` +
  'export const timeMessages: Readonly<Partial<Record<string, Readonly<Record<string, string>>>>> = ' +
  JSON.stringify(labels, null, 2) +
  ';\nexport const timeDigits: Readonly<Partial<Record<string, string>>> = ' +
  JSON.stringify(digits, null, 2) +
  ';\n';
if (mode === '--check')
  assert.equal(fs.readFileSync(output, 'utf8').replaceAll('\r\n', '\n'), text);
else fs.writeFileSync(output, text);
