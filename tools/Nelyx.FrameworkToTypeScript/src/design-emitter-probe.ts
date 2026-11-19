// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';
import { BlockedSemantic, emitDart } from './dart-emitter.ts';
import type { BodyIr, ModuleRecipe } from './body-ir.ts';

const [request, plan] = process.argv.slice(2);
if (!request || !plan) throw Error('Expected a design Body IR probe response and module plan');
const ir = JSON.parse(fs.readFileSync(request, 'utf8')) as BodyIr;
if (ir.schema !== 'nelyx.resolved-body-ir/v1') throw Error('Unexpected design Body IR schema');
const modules = JSON.parse(fs.readFileSync(plan, 'utf8')) as {
  source: string;
  symbols: string[];
  unit?: number;
}[];
const bySource = new Map<string, Map<string, BodyIr['records'][number]>>();
for (const record of ir.records) {
  const symbols = bySource.get(record.source) ?? new Map();
  if (symbols.has(record.symbol))
    throw Error(`Duplicate design body: ${record.source}::${record.symbol}`);
  symbols.set(record.symbol, record);
  bySource.set(record.source, symbols);
}

const widgets = '@nelyx/core/framework/widgets/framework';
const widgetLibrary = 'package:flutter/src/widgets/framework.dart';
const results = new Map<string, object>();
for (const { source, symbols, unit } of modules) {
  const records = symbols.map((symbol) => {
    const item = bySource.get(source)?.get(symbol);
    if (!item) throw Error(`Missing design body: ${source}::${symbol}`);
    return item;
  });
  const symbol = records[0]?.symbol;
  if (!symbol) continue;
  const recipe: ModuleRecipe = {
    source,
    sha256: records[0]!.sourceSha256,
    symbols: records.map((record) => record.symbol),
    destination: 'candidate.ts',
    imports: {
      StatefulWidget: widgets,
      State: widgets,
      WheelStatefulHost: '../../../Nelyx/src/framework/widgets/list-wheel-widget-adapter.ts',
      FoundationBuildMode: '@nelyx/core/foundation/constants',
      invariant: '@nelyx/core/foundation/errors',
      protect: '@nelyx/core/internal/ui/value-math',
    },
    typeImports: {
      Widget: widgets,
      BuildContext: widgets,
      Key: '@nelyx/core/foundation/key',
    },
    typeBindings: {
      [`${widgetLibrary}::Widget:CLASS`]: 'Widget',
      [`${widgetLibrary}::State:CLASS`]: 'State',
      [`${widgetLibrary}::StatefulWidget:CLASS`]: 'StatefulWidget',
      [`${widgetLibrary}::BuildContext:CLASS`]: 'BuildContext',
      'package:flutter/src/foundation/key.dart::Key:CLASS': 'Key',
    },
    superConstructors: {
      [`${widgetLibrary}::StatefulWidget.StatefulWidget.new:CONSTRUCTOR`]: {
        target: 'WheelStatefulHost',
        baseType: 'StatefulWidget',
        policy: 'no-derived-state-observation',
        namedArguments: 'options',
      },
      [`${widgetLibrary}::State.State.new:CONSTRUCTOR`]: {
        target: 'State',
        baseType: 'State',
        policy: 'no-derived-state-observation',
      },
    },
    importEmission: { policy: 'used-identifiers' },
  };
  const analyze = (selected: typeof records) => {
    const symbols = selected.map((record) => record.symbol);
    const key = `${source}::${symbols.join(',')}`;
    const invalid = selected.find((record) => !record.ir);
    if (invalid) {
      results.set(key, {
        source,
        symbols,
        unit,
        status: 'blocked-in-body-ir',
        diagnostic: invalid.diagnostic,
      });
      return;
    }
    try {
      const binding = { ...recipe, symbols };
      const declarations = selected.map((record) => record.ir!);
      const candidate = emitDart(declarations, binding);
      if (candidate !== emitDart(declarations, binding)) throw Error(`Unstable candidate: ${key}`);
      const parsed = ts.transpileModule(candidate, {
        fileName: binding.destination,
        reportDiagnostics: true,
      });
      if (parsed.diagnostics?.length)
        throw Error(
          ts.formatDiagnosticsWithColorAndContext(parsed.diagnostics, {
            getCanonicalFileName: (file) => file,
            getCurrentDirectory: () => process.cwd(),
            getNewLine: () => '\n',
          }),
        );
      results.set(key, {
        source,
        symbols,
        unit,
        status: 'emitted-candidate',
        sha256: createHash('sha256').update(candidate).digest('hex'),
      });
    } catch (error) {
      if (!(error instanceof BlockedSemantic)) throw error;
      results.set(key, {
        source,
        symbols,
        unit,
        status: 'blocked-in-emitter',
        diagnostic: error.message,
      });
    }
  };
  // The value declaration can be lowered independently of the state and render
  // cluster. Keep its diagnostic available even when that larger unit is blocked.
  if (symbol === 'ButtonSegment' && records.length > 1) analyze(records.slice(0, 1));
  analyze(records);
}
console.log(
  JSON.stringify({ schema: 'nelyx.design-emitter-probe/v1', units: [...results.values()] }),
);
