// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';
import { BlockedSemantic, emitDart } from './dart-emitter.ts';
import { wholeMillisecondDurationConstants } from './design-duration.ts';
import { createDesignSourceBatch } from './design-source-batch.ts';
import type { DesignModuleInput, DesignSourcePlan } from './design-source-batch.ts';
import type { BodyIr, Declaration, ModuleRecipe, ResolvedType } from './body-ir.ts';

const [request, plan, mode] = process.argv.slice(2);
if (!request || !plan) throw Error('Expected a design Body IR probe response and module plan');
const ir = JSON.parse(fs.readFileSync(request, 'utf8')) as BodyIr;
if (ir.schema !== 'nelyx.resolved-body-ir/v1') throw Error('Unexpected design Body IR schema');
const { modules, sourceBatch } = JSON.parse(fs.readFileSync(plan, 'utf8')) as {
  modules: DesignModuleInput[];
  sourceBatch?: DesignSourcePlan;
};
const batch = sourceBatch && createDesignSourceBatch(sourceBatch);
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
const sourceState = `${widgetLibrary}::State:CLASS`;
const sourceStateConstructor = `${widgetLibrary}::State.State.new:CONSTRUCTOR`;
const tickerLibrary = 'package:flutter/src/widgets/ticker_provider.dart';
const stateMixins: ReadonlyMap<string, readonly [target: string, module: string]> = new Map([
  [
    `${tickerLibrary}::TickerProviderStateMixin:MIXIN`,
    ['TickerProviderStateMixin', '@nelyx/core/framework/widgets/ticker-provider'],
  ],
  [
    `${tickerLibrary}::SingleTickerProviderStateMixin:MIXIN`,
    ['SingleTickerProviderStateMixin', '@nelyx/core/framework/widgets/ticker-provider'],
  ],
  [
    'package:flutter/src/widgets/restoration.dart::RestorationMixin:MIXIN',
    ['RestorationMixin', '@nelyx/core/framework/widgets/restoration'],
  ],
]);
const stateMixinImports = Object.fromEntries(stateMixins.values());

function stateMixinConstructors(
  declarations: readonly Declaration[],
): ModuleRecipe['superConstructors'] {
  const bindings: NonNullable<ModuleRecipe['superConstructors']> = {};
  for (const declaration of declarations) {
    if (declaration.kind !== 'class' || declaration.mixins?.length !== 1) continue;
    const base = declaration.superclass;
    const [mixin] = declaration.mixins;
    if (
      base?.constructor.id !== sourceStateConstructor ||
      base.type.kind !== 'interface' ||
      base.type.reference.id !== sourceState ||
      base.type.nullable ||
      base.type.arguments.length !== 1 ||
      mixin?.kind !== 'interface' ||
      mixin.nullable
    )
      continue;
    const binding = stateMixins.get(mixin.reference.id);
    if (!binding) continue;
    const key = (type: ResolvedType): string | undefined => {
      const nullable = type.nullable ? '?' : '';
      if (type.kind === 'parameter')
        return declaration.typeParameters.some(
          ({ reference }) => reference.id === type.reference.id,
        )
          ? type.reference.id + nullable
          : undefined;
      if (type.kind !== 'interface') return undefined;
      const arguments_ = type.arguments.map(key);
      if (arguments_.some((argument) => argument === undefined)) return undefined;
      return (
        type.reference.id + (arguments_.length ? '<' + arguments_.join(',') + '>' : '') + nullable
      );
    };
    const widget = key(base.type.arguments[0]!);
    const mixinKey = key(mixin);
    if (!widget || !mixinKey || mixin.arguments.length !== 1 || key(mixin.arguments[0]!) !== widget)
      continue;
    bindings[declaration.reference.id] = {
      target: binding[0],
      baseType: 'State',
      sourceConstructor: sourceStateConstructor,
      policy: 'no-derived-state-observation',
      mixins: [mixinKey],
    };
  }
  return bindings;
}

const keyOnlyBases = [
  'Widget',
  'StatelessWidget',
  'StatefulWidget',
  'RenderObjectWidget',
  'LeafRenderObjectWidget',
];
const widgetBases = [
  ...keyOnlyBases.map((name) => [name, widgetLibrary, widgets, 'core-widget-key'] as const),
  ...[
    'ProxyWidget',
    'InheritedWidget',
    'SingleChildRenderObjectWidget',
    'MultiChildRenderObjectWidget',
  ].map((name) => [name, widgetLibrary, widgets, 'core-widget-child'] as const),
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
const animationDirectory = '@nelyx/core/framework/animation/';
const edgeInsetsLibrary = 'package:flutter/src/painting/edge_insets.dart';
const edgeInsetsModule = '@nelyx/core/framework/painting/edge-insets';
const edgeInsetsAdapter = '@nelyx/core/internal/framework/painting/edge-insets-source-adapter';
const edgeInsetsFactories = [
  ['EdgeInsets', 'fromLTRB', 'constEdgeInsetsLTRB', false],
  ['EdgeInsets', 'all', 'constEdgeInsetsAll', false],
  ['EdgeInsets', 'only', 'constEdgeInsetsOnly', true],
  ['EdgeInsets', 'symmetric', 'constEdgeInsetsSymmetric', true],
  ['EdgeInsetsDirectional', 'fromSTEB', 'constDirectionalInsetsSTEB', false],
  ['EdgeInsetsDirectional', 'all', 'constDirectionalInsetsAll', false],
  ['EdgeInsetsDirectional', 'only', 'constDirectionalInsetsOnly', true],
  ['EdgeInsetsDirectional', 'symmetric', 'constDirectionalInsetsSymmetric', true],
] as const;
const borderRadiusLibrary = 'package:flutter/src/painting/border_radius.dart';
const borderRadiusModule = '@nelyx/core/framework/painting/border-radius';
const borderRadiusAdapter = '@nelyx/core/internal/framework/painting/border-radius-source-adapter';
const borderRadiusFactories = [
  ['BorderRadius', 'all', 'constBorderRadiusAll', false],
  ['BorderRadius', 'only', 'constBorderRadiusOnly', true],
  ['BorderRadius', 'vertical', 'constBorderRadiusVertical', true],
  ['BorderRadius', 'horizontal', 'constBorderRadiusHorizontal', true],
  ['BorderRadiusDirectional', 'all', 'constBorderRadiusDirectionalAll', false],
  ['BorderRadiusDirectional', 'only', 'constBorderRadiusDirectionalOnly', true],
  ['BorderRadiusDirectional', 'vertical', 'constBorderRadiusDirectionalVertical', true],
  ['BorderRadiusDirectional', 'horizontal', 'constBorderRadiusDirectionalHorizontal', true],
  ['BorderRadiusGeometry', 'all', 'constBorderRadiusAll', false],
  ['BorderRadiusGeometry', 'only', 'constBorderRadiusOnly', true],
  ['BorderRadiusGeometry', 'vertical', 'constBorderRadiusVertical', true],
  ['BorderRadiusGeometry', 'directional', 'constBorderRadiusDirectionalOnly', true],
] as const;
const constPaintingFactories = [
  [edgeInsetsLibrary, edgeInsetsModule, edgeInsetsAdapter, edgeInsetsFactories],
  [borderRadiusLibrary, borderRadiusModule, borderRadiusAdapter, borderRadiusFactories],
] as const;
const constPaintingOwnerImports = Object.fromEntries(
  constPaintingFactories.flatMap(([, module, , factories]) =>
    factories.map(([owner]) => [owner, module]),
  ),
);
const constPaintingAdapterImports = Object.fromEntries(
  constPaintingFactories.flatMap(([, , adapter, factories]) =>
    factories.map(([, , factory]) => [factory, adapter]),
  ),
);
const constPaintingBindings = Object.fromEntries(
  constPaintingFactories.flatMap(([library, , , factories]) =>
    factories.map(([owner, constructor, factory, named]) => [
      `${library}::${owner}.${owner}.${constructor}:CONSTRUCTOR`,
      {
        factory,
        policy: 'canonical-immutable-host',
        ownerType: `${library}::${owner}:CLASS`,
        ...(named ? { namedArguments: 'options' } : {}),
      } as const,
    ]),
  ),
);
const sourceBases: readonly (readonly [
  library: string,
  name: string,
  module: string,
  namedArguments?: 'options',
])[] = [
  ['package:flutter/src/animation/animation.dart', 'Animation', animationDirectory + 'animation'],
  ['package:flutter/src/animation/tween.dart', 'Animatable', animationDirectory + 'tween'],
  ['package:flutter/src/animation/curves.dart', 'Curve', animationDirectory + 'curves'],
  [
    'package:flutter/src/rendering/custom_paint.dart',
    'CustomPainter',
    '@nelyx/core/framework/rendering/custom-paint',
    'options',
  ],
  [
    'package:flutter/src/rendering/shifted_box.dart',
    'SingleChildLayoutDelegate',
    '@nelyx/core/framework/rendering/custom-layout',
    'options',
  ],
  [
    'package:flutter/src/rendering/custom_layout.dart',
    'MultiChildLayoutDelegate',
    '@nelyx/core/framework/rendering/custom-layout',
    'options',
  ],
  ['package:flutter/src/widgets/actions.dart', 'Intent', '@nelyx/core/framework/widgets/actions'],
];
const sourceBaseImports = Object.fromEntries(sourceBases.map(([, name, module]) => [name, module]));
const coreTypeBindings = [
  ...sourceBases,
  ['dart:core', 'DateTime', '@nelyx/core/foundation/date-time'],
  ['dart:ui', 'Canvas', '@nelyx/core/ui/canvas'],
  ['dart:ui', 'Color', '@nelyx/core/ui/color'],
  ['dart:ui', 'Offset', '@nelyx/core/ui/offset'],
  ['dart:ui', 'Radius', '@nelyx/core/ui/radius'],
  ['dart:ui', 'Rect', '@nelyx/core/ui/rect'],
  ['dart:ui', 'Size', '@nelyx/core/ui/size'],
  [
    'package:flutter/src/animation/animations.dart',
    'CurvedAnimation',
    animationDirectory + 'animations',
  ],
  [
    'package:flutter/src/painting/alignment.dart',
    'AlignmentGeometry',
    '@nelyx/core/framework/painting/alignment',
  ],
  [
    'package:flutter/src/painting/decoration.dart',
    'Decoration',
    '@nelyx/core/framework/painting/decoration',
  ],
  [
    'package:flutter/src/painting/decoration.dart',
    'BoxPainter',
    '@nelyx/core/framework/painting/decoration',
  ],
  ...['BorderRadiusGeometry', 'BorderRadius', 'BorderRadiusDirectional'].map(
    (name) =>
      [
        'package:flutter/src/painting/border_radius.dart',
        name,
        '@nelyx/core/framework/painting/border-radius',
      ] as const,
  ),
  [
    'package:flutter/src/painting/borders.dart',
    'BorderSide',
    '@nelyx/core/framework/painting/borders',
  ],
  [
    'package:flutter/src/painting/box_border.dart',
    'Border',
    '@nelyx/core/framework/painting/box-border',
  ],
  [
    'package:flutter/src/painting/rounded_rectangle_border.dart',
    'RoundedRectangleBorder',
    '@nelyx/core/framework/painting/rounded-rectangle-border',
  ],
  [
    'package:flutter/src/painting/image_provider.dart',
    'ImageConfiguration',
    '@nelyx/core/framework/painting/image-configuration',
  ],
  [
    'package:flutter/src/painting/borders.dart',
    'ShapeBorder',
    '@nelyx/core/framework/painting/borders',
  ],
  [
    'package:flutter/src/painting/borders.dart',
    'OutlinedBorder',
    '@nelyx/core/framework/painting/borders',
  ],
  [
    'package:flutter/src/painting/box_shadow.dart',
    'BoxShadow',
    '@nelyx/core/framework/painting/box-shadow',
  ],
  [
    'package:flutter/src/widgets/preferred_size.dart',
    'PreferredSizeWidget',
    '@nelyx/core/framework/widgets/preferred-size',
  ],
  [
    'package:flutter/src/widgets/scroll_controller.dart',
    'ScrollController',
    '@nelyx/core/framework/widgets/scroll-controller',
  ],
  [
    'package:flutter/src/widgets/scroll_physics.dart',
    'ScrollPhysics',
    '@nelyx/core/framework/widgets/scroll-physics',
  ],
  [
    'package:flutter/src/widgets/scroll_position.dart',
    'ScrollPosition',
    '@nelyx/core/framework/widgets/scroll-position',
  ],
  [
    'package:flutter/src/widgets/page_view.dart',
    'PageController',
    '@nelyx/core/framework/widgets/page-view',
  ],
  [
    'package:flutter/src/rendering/sliver.dart',
    'SliverConstraints',
    '@nelyx/core/framework/rendering/sliver',
  ],
  [
    'package:flutter/src/semantics/semantics.dart',
    'SemanticsProperties',
    '@nelyx/core/framework/semantics/semantics',
  ],
  [
    'package:flutter/src/widgets/scroll_notification_observer.dart',
    'ScrollNotificationObserverState',
    '@nelyx/core/framework/widgets/scroll-notification-observer',
  ],
  [
    'package:flutter/src/widgets/focus_manager.dart',
    'FocusNode',
    '@nelyx/core/framework/widgets/focus',
  ],
  ['package:flutter/src/cupertino/colors.dart', 'CupertinoDynamicColor', '@nelyx/cupertino/colors'],
  [
    'package:flutter/src/animation/animation_controller.dart',
    'AnimationController',
    animationDirectory + 'animation-controller',
  ],
  [edgeInsetsLibrary, 'EdgeInsetsGeometry', edgeInsetsModule],
  [edgeInsetsLibrary, 'EdgeInsets', edgeInsetsModule],
  [edgeInsetsLibrary, 'EdgeInsetsDirectional', edgeInsetsModule],
  [
    'package:flutter/src/painting/text_style.dart',
    'TextStyle',
    '@nelyx/core/framework/painting/text-style',
  ],
  ['package:flutter/src/rendering/box.dart', 'RenderBox', '@nelyx/core/framework/rendering/object'],
  [
    'package:flutter/src/rendering/box.dart',
    'BoxConstraints',
    '@nelyx/core/framework/rendering/constraints',
  ],
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
  coreTypeBindings
    .filter(
      ([, name]) =>
        !['Radius', 'CurvedAnimation'].includes(name) &&
        !Object.hasOwn(constPaintingOwnerImports, name) &&
        !Object.hasOwn(sourceBaseImports, name),
    )
    .map(([, name, module]) => [name, module]),
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
for (const module of modules) {
  const { source, unit } = module;
  const selection = batch?.select(module);
  const symbols = selection?.map(({ symbol }) => symbol) ?? module.symbols;
  if (!symbols.length) continue;
  const records = symbols.map((symbol) => {
    const item = bySource.get(source)?.get(symbol);
    if (!item) throw Error(`Missing design body: ${source}::${symbol}`);
    return item;
  });
  const symbol = records[0]?.symbol;
  if (!symbol) continue;
  const material = source.startsWith('packages/flutter/lib/src/material/');
  const recipe: ModuleRecipe = {
    source,
    sha256: records[0]!.sourceSha256,
    symbols: records.map((record) => record.symbol),
    destination: 'candidate.ts',
    imports: {
      ...widgetImports,
      ...sourceBaseImports,
      ...stateMixinImports,
      Curves: animationDirectory + 'curves',
      CurvedAnimation: animationDirectory + 'animations',
      WidgetState: '@nelyx/core/framework/widgets/widget-state',
      ...constPaintingOwnerImports,
      ...constPaintingAdapterImports,
      Radius: '@nelyx/core/ui/radius',
      constSourceRadiusCircular: '@nelyx/core/internal/ui/radius-source-adapter',
      constSourceRadiusElliptical: '@nelyx/core/internal/ui/radius-source-adapter',
      State: widgets,
      FontWeight: '@nelyx/core/ui/typography',
      FoundationBuildMode: '@nelyx/core/foundation/constants',
      invariant: '@nelyx/core/foundation/errors',
      protect: '@nelyx/core/internal/ui/value-math',
      dartLateRead: '@nelyx/core/internal/foundation/dart-late',
      dartLateWrite: '@nelyx/core/internal/foundation/dart-late',
      dartLateInitialize: '@nelyx/core/internal/foundation/dart-late',
      dartLateLocal: '@nelyx/core/internal/foundation/dart-late',
    },
    typeImports: {
      ...coreTypeImports,
      TextDirection: '@nelyx/core/ui/typography',
      ...(material
        ? {
            CalendarDelegate: '@nelyx/material/date-picker',
            MaterialLocalizations: '@nelyx/material/material-localizations',
            TabController: '@nelyx/material/tab-controller',
          }
        : {}),
      BuildContext: widgets,
      Key: '@nelyx/core/foundation/key',
      GlobalKey: '@nelyx/core/framework/widgets/global-key',
      DartList: '@nelyx/core/internal/foundation/dart-list',
      DartMap: '@nelyx/core/foundation/dart-collections',
      DartSet: '@nelyx/core/foundation/dart-collections',
    },
    typeBindings: {
      ...coreTypes,
      ...widgetTypes,
      ...(material
        ? {
            'package:flutter/src/material/date.dart::CalendarDelegate:CLASS': 'CalendarDelegate',
            'package:flutter/src/material/material_localizations.dart::MaterialLocalizations:CLASS':
              'MaterialLocalizations',
            'package:flutter/src/material/tab_controller.dart::TabController:CLASS':
              'TabController',
          }
        : {}),
      [sourceState]: 'State',
      [`${widgetLibrary}::BuildContext:CLASS`]: 'BuildContext',
      [`${widgetLibrary}::GlobalKey:CLASS`]: 'GlobalKey',
      'package:flutter/src/foundation/key.dart::Key:CLASS': 'Key',
      'dart:ui::FontWeight:CLASS': 'FontWeight',
      'dart:ui::TextDirection:ENUM': 'TextDirection',
      'package:flutter/src/widgets/widget_state.dart::WidgetState:ENUM': 'WidgetState',
      'dart:core::List:CLASS': 'DartList',
      'dart:core::Map:CLASS': 'DartMap',
      'dart:core::Set:CLASS': 'DartSet',
    },
    adapters: {
      'package:flutter/src/animation/animations.dart::CurvedAnimation.CurvedAnimation.new:CONSTRUCTOR':
        {
          target: 'CurvedAnimation',
          kind: 'new',
          namedArguments: 'options',
        },
    },
    constantConstructors: {
      ...constPaintingBindings,
      'dart:ui::Radius.Radius.circular:CONSTRUCTOR': {
        factory: 'constSourceRadiusCircular',
        policy: 'canonical-immutable-host',
        ownerType: 'dart:ui::Radius:CLASS',
      },
      'dart:ui::Radius.Radius.elliptical:CONSTRUCTOR': {
        factory: 'constSourceRadiusElliptical',
        policy: 'canonical-immutable-host',
        ownerType: 'dart:ui::Radius:CLASS',
      },
    },
    values: {
      'dart:ui::TextDirection.ltr:GETTER': 'ltr',
      'dart:ui::TextDirection.rtl:GETTER': 'rtl',
    },
    superConstructors: {
      ...widgetConstructors,
      ...Object.fromEntries(
        sourceBases.map(([library, name, , namedArguments]) => [
          `${library}::${name}.${name}.new:CONSTRUCTOR`,
          {
            target: name,
            policy: 'no-derived-state-observation',
            ...(namedArguments ? { namedArguments } : {}),
          } as const,
        ]),
      ),
      [sourceStateConstructor]: {
        target: 'State',
        baseType: 'State',
        policy: 'no-derived-state-observation',
      },
    },
    lateFields: {
      read: 'dartLateRead',
      write: 'dartLateWrite',
      initialize: 'dartLateInitialize',
      policy: 'checked-late-instance',
    },
    lateLocals: { create: 'dartLateLocal', policy: 'checked-late-local' },
    implicitTypeParameterBound: 'dart-object-nullable',
    importEmission: { policy: 'used-identifiers' },
  };
  const analyze = (selected: typeof records) => {
    const symbols = selected.map((record) => record.symbol);
    const key = `${source}::${symbols.join(',')}`;
    const attempt = { source, symbols, ...(unit === undefined ? {} : { unit }) };
    const complete = (outcome: { status: string; diagnostic?: string; sha256?: string }) => {
      results.set(key, { ...attempt, ...outcome });
      if (selection)
        batch?.record(
          selection.map(({ id }) => id),
          outcome,
        );
    };
    const invalid = selected.find((record) => !record.ir);
    if (invalid) {
      if (!invalid.diagnostic) throw Error(`Missing Body IR diagnostic: ${key}`);
      complete({
        status: 'blocked-in-body-ir',
        diagnostic: `${invalid.symbol}: ${invalid.diagnostic}`,
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
            superConstructors: {
              ...recipe.superConstructors,
              ...stateMixinConstructors(declarations),
            },
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
      const syntax = ts.createSourceFile('candidate.ts', candidate, ts.ScriptTarget.Latest);
      if (!syntax.statements.some((statement) => !ts.isImportDeclaration(statement)))
        throw new BlockedSemantic('No declaration emitted from the requested body');
      const output = batch?.emit(module, candidate);
      complete({
        ...(output ?? { status: 'emitted-candidate' }),
        sha256: createHash('sha256').update(candidate).digest('hex'),
      });
    } catch (error) {
      complete({
        status: error instanceof BlockedSemantic ? 'blocked-in-emitter' : 'emitter-error',
        diagnostic: error instanceof Error ? error.message : String(error),
      });
    }
  };
  // The value declaration can be lowered independently of the state and render
  // cluster. Keep its diagnostic available even when that larger unit is blocked.
  if (!batch && symbol === 'ButtonSegment' && records.length > 1) analyze(records.slice(0, 1));
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
if (batch) {
  const result = batch.report(mode === '--summary');
  console.log(JSON.stringify(result.output));
  if (result.checkFailed) process.exitCode = 1;
}
