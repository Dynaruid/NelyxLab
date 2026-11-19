// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';
import { BlockedSemantic, emitDart } from './dart-emitter.ts';
import { wholeMillisecondDurationConstants } from './design-duration.ts';
import type { BodyIr, ModuleRecipe } from './body-ir.ts';

const [request, plan, mode] = process.argv.slice(2);
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
const keyOnlyBases = [
  'Widget',
  'StatelessWidget',
  'StatefulWidget',
  'RenderObjectWidget',
  'LeafRenderObjectWidget',
];
const widgetBases = [
  ...keyOnlyBases.map((name) => [name, widgetLibrary, widgets, 'core-widget-key'] as const),
  ...['ProxyWidget', 'InheritedWidget', 'SingleChildRenderObjectWidget'].map(
    (name) => [name, widgetLibrary, widgets, 'core-widget-child'] as const,
  ),
  [
    'InheritedTheme',
    'package:flutter/src/widgets/inherited_theme.dart',
    '@nelyx/core/framework/widgets/inherited-theme',
    'core-widget-child',
  ] as const,
];
const widgetImports = Object.fromEntries(widgetBases.map(([name, , module]) => [name, module]));
const widgetTypes = Object.fromEntries(
  widgetBases.map(([name, library]) => [`${library}::${name}:CLASS`, name]),
);
const widgetConstructors = Object.fromEntries(
  widgetBases.map(([name, library, , namedArguments]) => [
    `${library}::${name}.${name}.new:CONSTRUCTOR`,
    { target: name, policy: 'no-derived-state-observation', namedArguments } as const,
  ]),
);
const coreTypeBindings = [
  ['dart:ui', 'Color', '@nelyx/core/ui/color'],
  ['dart:ui', 'Offset', '@nelyx/core/ui/offset'],
  ['dart:ui', 'Radius', '@nelyx/core/ui/radius'],
  ['dart:ui', 'Size', '@nelyx/core/ui/size'],
  ['package:flutter/src/animation/curves.dart', 'Curve', '@nelyx/core/framework/animation/curves'],
  [
    'package:flutter/src/painting/edge_insets.dart',
    'EdgeInsetsGeometry',
    '@nelyx/core/framework/painting/edge-insets',
  ],
  [
    'package:flutter/src/painting/edge_insets.dart',
    'EdgeInsets',
    '@nelyx/core/framework/painting/edge-insets',
  ],
  [
    'package:flutter/src/painting/edge_insets.dart',
    'EdgeInsetsDirectional',
    '@nelyx/core/framework/painting/edge-insets',
  ],
  [
    'package:flutter/src/painting/text_style.dart',
    'TextStyle',
    '@nelyx/core/framework/painting/text-style',
  ],
  ['package:flutter/src/rendering/box.dart', 'RenderBox', '@nelyx/core/framework/rendering/object'],
  [
    'package:flutter/src/rendering/object.dart',
    'RenderObject',
    '@nelyx/core/framework/rendering/object',
  ],
] as const;
const coreTypes = Object.fromEntries(
  coreTypeBindings.map(([library, name]) => [`${library}::${name}:CLASS`, name]),
);
const coreTypeImports = Object.fromEntries(
  coreTypeBindings.map(([, name, module]) => [name, module]),
);
const results = new Map<
  string,
  {
    source: string;
    symbols: string[];
    unit?: number;
    status: string;
    diagnostic?: string;
    sha256?: string;
  }
>();
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
      ...widgetImports,
      State: widgets,
      FontWeight: '@nelyx/core/ui/typography',
      FoundationBuildMode: '@nelyx/core/foundation/constants',
      invariant: '@nelyx/core/foundation/errors',
      protect: '@nelyx/core/internal/ui/value-math',
    },
    typeImports: {
      ...coreTypeImports,
      BuildContext: widgets,
      Key: '@nelyx/core/foundation/key',
      DartMap: '@nelyx/core/foundation/dart-collections',
      DartSet: '@nelyx/core/foundation/dart-collections',
    },
    typeBindings: {
      ...coreTypes,
      ...widgetTypes,
      [`${widgetLibrary}::State:CLASS`]: 'State',
      [`${widgetLibrary}::BuildContext:CLASS`]: 'BuildContext',
      'package:flutter/src/foundation/key.dart::Key:CLASS': 'Key',
      'dart:ui::FontWeight:CLASS': 'FontWeight',
      'dart:core::Map:CLASS': 'DartMap',
      'dart:core::Set:CLASS': 'DartSet',
    },
    superConstructors: {
      ...widgetConstructors,
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
    const attempt = { source, symbols, ...(unit === undefined ? {} : { unit }) };
    const invalid = selected.find((record) => !record.ir);
    if (invalid) {
      if (!invalid.diagnostic) throw Error(`Missing Body IR diagnostic: ${key}`);
      results.set(key, {
        ...attempt,
        status: 'blocked-in-body-ir',
        diagnostic: invalid.diagnostic,
      });
      return;
    }
    try {
      const declarations = selected.map((record) => record.ir!);
      // Closed enum ordinals are safe numbers; do not apply this to arbitrary Dart ints.
      const ordinalOnly = declarations.every(
        (declaration) =>
          declaration.kind === 'enum' &&
          !declaration.fields?.length &&
          !declaration.methods?.length &&
          !declaration.mixins?.length,
      );
      const binding: ModuleRecipe = ordinalOnly
        ? {
            ...recipe,
            symbols,
            imports: { ...recipe.imports, checkedInteger: '@nelyx/core/internal/ui/value-math' },
            numericTypes: { int: { representation: 'safe-number', check: 'checkedInteger' } },
          }
        : {
            ...recipe,
            symbols,
            ...(wholeMillisecondDurationConstants(declarations)
              ? { durationUnit: 'milliseconds' }
              : {}),
          };
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
        ...attempt,
        status: 'emitted-candidate',
        sha256: createHash('sha256').update(candidate).digest('hex'),
      });
    } catch (error) {
      if (!(error instanceof BlockedSemantic)) throw error;
      results.set(key, {
        ...attempt,
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
const attempts = [...results.values()];
const counts: Record<string, number> = {};
const blockers: Record<string, number> = {};
for (const { status, diagnostic } of attempts) {
  counts[status] = (counts[status] ?? 0) + 1;
  if (diagnostic) {
    const key = diagnostic.replace(/ @\d+$/, '');
    blockers[key] = (blockers[key] ?? 0) + 1;
  }
}
const frequentBlockers = Object.entries(blockers).sort(
  ([first, firstCount], [second, secondCount]) =>
    secondCount - firstCount || first.localeCompare(second, 'en'),
);
console.log(
  JSON.stringify({
    schema: 'nelyx.design-emitter-probe/v1',
    counts,
    ...(mode === '--summary'
      ? {
          blockers: Object.fromEntries(frequentBlockers.slice(0, 20)),
          otherBlockers: frequentBlockers.slice(20).reduce((sum, [, count]) => sum + count, 0),
        }
      : { units: attempts }),
  }),
);
