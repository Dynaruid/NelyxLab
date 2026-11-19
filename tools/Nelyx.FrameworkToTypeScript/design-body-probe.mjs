// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { execute } from '../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { designInventory, selectDesignBodyUnits } from './design-inventory.mjs';
import { openFlutterSource } from './flutter-source.mjs';

const families = new Map([
  [
    'W11-01',
    {
      'material/segmented_button.dart': [
        'ButtonSegment',
        'SegmentedButton',
        'SegmentedButtonState',
        '_RenderSegmentedButton',
      ],
      'cupertino/sliding_segmented_control.dart': [
        'CupertinoSlidingSegmentedControl',
        '_SlidingSegmentButtonState',
        '_SegmentedControlState',
        '_RenderSegmentedControl',
      ],
    },
  ],
  [
    'W11-05',
    {
      'cupertino/picker.dart': [
        'CupertinoPicker',
        '_CupertinoPickerState',
        'CupertinoPickerDefaultSelectionOverlay',
        '_CupertinoPickerSemantics',
        '_RenderCupertinoPickerSemantics',
        '_CupertinoPickerListWheelChildDelegateWrapper',
      ],
      'widgets/list_wheel_scroll_view.dart': ['FixedExtentScrollController', 'ListWheelScrollView'],
      'rendering/list_wheel_viewport.dart': ['RenderListWheelViewport'],
    },
  ],
]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    dart: { type: 'string' },
    family: { type: 'string', default: 'all' },
    emitter: { type: 'boolean' },
    summary: { type: 'boolean' },
    graph: { type: 'boolean' },
    'with-dependencies': { type: 'boolean' },
    coverage: { type: 'string' },
  },
});
const validFamily =
  values.family === 'all' ||
  (values.graph ? /^W11-0[1-7]$/.test(values.family) : families.has(values.family));
if (
  !values.source ||
  !values.dart ||
  !validFamily ||
  ((values.coverage || values['with-dependencies']) && !values.graph)
)
  throw Error(
    'design-body-probe --source <Flutter Git repository> --dart <Dart executable> [--family <W11 family>] [--graph [--coverage <resolved JSON>] [--with-dependencies]] [--emitter] [--summary]',
  );

const deadline = Date.now() + 1_200_000;
const dart = fs.realpathSync(values.dart);
const installedRevision = fs.readFileSync(path.resolve(dart, '../../revision'), 'utf8').trim();
const source = openFlutterSource(values.source);
const expectedRevision = /^\s*'dart_revision':\s*'([a-f0-9]{40})',/m.exec(source.text('DEPS'))?.[1];
if (!expectedRevision) throw Error('Pinned Flutter Dart revision is unavailable');
const graph = values.graph
  ? designInventory(values.source, { coverageFile: values.coverage })
  : null;
if (graph && !graph.bodyUnits)
  throw Error('Run designs:resolve to classify graph dependencies first');
const input = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'nelyx-design-probe-'));
const abort = new AbortController();
const stop = () => abort.abort();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  let checkout = path.join(input, 'flutter');
  const files = [
    'packages/flutter/lib',
    'packages/flutter_localizations/lib',
    'engine/src/flutter/lib/ui',
    'engine/src/flutter/lib/web_ui/lib',
  ].flatMap((prefix) => source.files(prefix).filter((file) => file.endsWith('.dart')));
  source.preload(files);
  for (const file of files) {
    const target = path.join(checkout, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source.read(file));
  }
  const units = graph
    ? selectDesignBodyUnits(graph.bodyUnits, values.family, values['with-dependencies'])
    : null;
  const modules = units
    ? units.flatMap((unit) => unit.recipeInputs.map((entry) => ({ ...entry, unit: unit.id })))
    : [...families]
        .filter(([family]) => values.family === 'all' || family === values.family)
        .flatMap(([, selections]) =>
          Object.entries(selections).map(([relative, symbols]) => {
            const file = 'packages/flutter/lib/src/' + relative;
            return {
              source: file,
              symbols,
              sha256: hash(source.text(file).replaceAll('\r\n', '\n')),
            };
          }),
        );
  const requests = modules.map(({ source: file, symbols, sha256 }) => ({
    source: file,
    symbols,
    sha256,
  }));
  if (!requests.length) throw Error(`No design bodies selected for ${values.family}`);
  const request = path.join(input, 'request.json');
  const output = path.join(input, 'body-ir.json');
  const frontend = path.join(import.meta.dirname, 'dart/bin/body_ir.dart');
  fs.writeFileSync(request, JSON.stringify(requests));
  let first;
  for (let i = 0; i < 2; i++) {
    const timeout = deadline - Date.now();
    if (timeout <= 0) throw Error('Design Body IR probe exceeded 20 minutes');
    await execute(dart, [frontend, checkout, request, output], { timeout, signal: abort.signal });
    const bytes = fs.readFileSync(output);
    if (first && !first.equals(bytes))
      throw Error('Identical Body IR probe inputs produced different bytes');
    first = bytes;
    if (i === 0) {
      const relocated = path.join(input, 'flutter-relocated');
      fs.renameSync(checkout, relocated);
      checkout = relocated;
    }
  }
  const result = JSON.parse(first.toString('utf8'));
  const expected = modules.flatMap((entry) =>
    entry.symbols.map((symbol, index) => ({
      source: entry.source,
      sha256: entry.sha256,
      symbol,
      identity: entry.identities?.[index],
    })),
  );
  if (result.schema !== 'nelyx.resolved-body-ir/v1' || result.records.length !== expected.length)
    throw Error('Unexpected Body IR result schema or record count');
  result.records.forEach((record, i) => {
    const request = expected[i];
    if (
      record.source !== request.source ||
      record.symbol !== request.symbol ||
      record.sourceSha256 !== request.sha256 ||
      Boolean(record.ir) === Boolean(record.diagnostic) ||
      (request.identity && record.ir && record.ir.reference?.id !== request.identity)
    )
      throw Error(`Unexpected Body IR response for ${request.source}::${request.symbol}`);
  });
  console.log(
    JSON.stringify({
      revision: source.revision,
      scope: {
        family: values.family,
        graph: !!graph,
        withDependencies: values['with-dependencies'] ?? false,
        units: units?.length ?? null,
        modules: modules.length,
      },
      dart: {
        expectedRevision,
        installedRevision,
        matchesPin: installedRevision === expectedRevision,
      },
      analyzerLockSha256: hash(
        fs.readFileSync(path.join(import.meta.dirname, 'dart/pubspec.lock')),
      ),
      frontendSha256: hash(fs.readFileSync(frontend)),
      bodyIrSha256: hash(first),
      recordCount: result.records.length,
      blockedRecords: result.records.filter((record) => record.diagnostic).length,
      records: values.summary
        ? undefined
        : result.records.map(({ source, symbol, spanSha256, ir, diagnostic }) => ({
            source,
            symbol,
            spanSha256,
            reference: ir?.reference?.id,
            status: diagnostic ? 'blocked-in-body-ir' : 'body-ir-ready',
            diagnostic,
          })),
    }),
  );
  if (values.emitter) {
    const timeout = deadline - Date.now();
    if (timeout <= 0) throw Error('Design emitter probe exceeded 20 minutes');
    const plan = path.join(input, 'emitter-inputs.json');
    fs.writeFileSync(plan, JSON.stringify(modules));
    await execute(
      'bun',
      [
        path.join(import.meta.dirname, 'src/design-emitter-probe.ts'),
        output,
        plan,
        ...(values.summary ? ['--summary'] : []),
      ],
      {
        timeout,
        signal: abort.signal,
      },
    );
  }
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
  if (path.basename(input).startsWith('nelyx-design-probe-') && fs.realpathSync(input) === input)
    fs.rmSync(input, { recursive: true, force: true });
}
