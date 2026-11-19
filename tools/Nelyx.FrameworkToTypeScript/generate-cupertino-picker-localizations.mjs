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
const files = source
  .files('packages/flutter_localizations/lib/src/l10n')
  .filter((file) => /\/cupertino_[A-Za-z0-9_]+\.arb$/.test(file));
source.preload(files);
const entries = Object.fromEntries(
  files
    .map((file) => [
      /\/cupertino_(.+)\.arb$/.exec(file)[1],
      Object.fromEntries(
        Object.entries(JSON.parse(source.text(file))).filter(([key, value]) => {
          if (
            !/^(?:datePicker(?:Date(?:Time)?Order|(?:Hour|Minute)SemanticsLabel\w+)|(?:ante|post)MeridiemAbbreviation|todayLabel|(?:back|cancel)ButtonLabel|tabSemanticsLabel|timerPicker(?:Hour|Minute|Second)Label\w+)$/.test(
              key,
            )
          )
            return false;
          assert.equal(typeof value, 'string', `${file}: ${key}`);
          return true;
        }),
      ),
    ])
    .filter(([, messages]) => Object.keys(messages).length > 0),
);
assert.equal(entries.en?.datePickerDateOrder, 'mdy');
assert.equal(entries.en?.datePickerDateTimeOrder, 'date_time_dayPeriod');
assert(Object.keys(entries).length > 1, 'Missing pinned Cupertino picker translations');
const formats = spawnSync(
  dartPath,
  [path.join(import.meta.dirname, 'dart/bin/cupertino_picker_formats.dart')],
  {
    input: JSON.stringify(entries),
    encoding: 'utf8',
    timeout: 1_200_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  },
);
if (formats.error || formats.status !== 0)
  throw Error('Cannot extract pinned Cupertino date formats: ' + (formats.error ?? formats.stderr));
const pickerFormats = JSON.parse(formats.stdout);
assert.deepEqual(Object.keys(pickerFormats), Object.keys(entries));
const messages = Object.fromEntries(
  Object.entries(entries).map(([locale, values]) => [
    locale,
    Object.fromEntries(
      Object.entries(values).filter(
        ([key]) =>
          !key.includes('Label') ||
          ['todayLabel', 'backButtonLabel', 'cancelButtonLabel', 'tabSemanticsLabel'].includes(key),
      ),
    ),
  ]),
);
const output = new URL(
  '../../packages/cupertino/src/generated/localizations/picker-localizations-data.generated.ts',
  import.meta.url,
);
const text =
  '// SPDX-License-Identifier: BSD-3-Clause\n' +
  '// Copyright 2014 The Flutter Authors. All rights reserved.\n' +
  `// Generated from Flutter ${source.revision} Cupertino ARB picker messages and Dart intl 0.20.3.\n` +
  'export interface PickerFormats {\n' +
  '  readonly digits: string;\n' +
  '  readonly year: readonly [prefix: string, suffix: string];\n' +
  "  readonly medium: readonly (string | { readonly field: 'day' | 'month' | 'weekday'; readonly values: readonly string[] })[];\n" +
  [
    'months',
    'days',
    'weekdays',
    'hours',
    'minutes',
    'timerMinutes',
    'timerSeconds',
    'hourSemantics',
    'minuteSemantics',
    'timerHourLabels',
    'timerMinuteLabels',
    'timerSecondLabels',
  ]
    .map((field) => `  readonly ${field}: readonly string[];\n`)
    .join('') +
  '}\n' +
  'export const pickerMessages: Readonly<Partial<Record<string, Readonly<Record<string, string>>>>> = ' +
  JSON.stringify(messages, null, 2) +
  ';\n' +
  'export const pickerFormats: Readonly<Record<string, PickerFormats>> = {\n' +
  Object.entries(pickerFormats)
    .map(
      ([locale, values]) =>
        `  ${JSON.stringify(locale)}: {\n` +
        Object.entries(values)
          .map(([field, value]) => `    ${field}: ${JSON.stringify(value)},\n`)
          .join('') +
        '  },\n',
    )
    .join('') +
  '};\n';
if (mode === '--check') assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text);
