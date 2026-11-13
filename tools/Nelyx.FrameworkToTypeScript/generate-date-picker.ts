import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { format } from 'oxfmt';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { emitDart } from './src/dart-emitter.ts';
import { verifyDatePicker, verifyDateCompiler } from './verify-date-picker.ts';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const manifest = JSON.parse(
  fs.readFileSync('tools/Nelyx.FrameworkToTypeScript/data/material-date-picker.json', 'utf8'),
);
const formatOptions = JSON.parse(fs.readFileSync('.oxfmtrc.json', 'utf8'));
delete formatOptions.$schema;
function analyze() {
  const sourceRoot = path.resolve(argument('--source') ?? 'reference/flutter-master');
  const dart = argument('--dart') ?? process.env.DART_EXECUTABLE ?? 'dart';
  for (const request of manifest.modules) {
    const body = fs
      .readFileSync(path.join(sourceRoot, request.source), 'utf8')
      .replaceAll('\r\n', '\n');
    if (createHash('sha256').update(body).digest('hex') !== request.sha256)
      throw Error('Pinned Flutter source differs: ' + request.source);
  }
  const parent = path.join(root, '.nelyx');
  fs.mkdirSync(parent, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(parent, 'date-analysis-'));
  try {
    const requests = path.join(temporary, 'requests.json'),
      output = path.join(temporary, 'ir.json');
    fs.writeFileSync(requests, JSON.stringify(manifest.modules));
    const result = spawnSync(
      dart,
      ['tools/Nelyx.FrameworkToTypeScript/dart/bin/body_ir.dart', sourceRoot, requests, output],
      {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 1200000,
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    if (result.error || result.status !== 0)
      throw Error(
        'Dart analyzer failed (requires the analyzer package SDK constraint): ' +
          (result.error ?? '') +
          '\n' +
          result.stdout +
          result.stderr,
      );
    return JSON.parse(fs.readFileSync(output, 'utf8'));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
const ir = process.argv.includes('--ir-stdin') ? JSON.parse(await Bun.stdin.text()) : analyze();
for (const request of manifest.modules) {
  const rows = ir.records.filter((r: any) => r.source === request.source);
  if (
    rows.length !== request.symbols.length ||
    rows.some((r: any) => r.sourceSha256 !== request.sha256 || !request.symbols.includes(r.symbol))
  )
    throw Error('Analyzed declaration identity differs: ' + request.source);
}
if (ir.records.length !== manifest.modules.reduce((n: number, m: any) => n + m.symbols.length, 0))
  throw Error('Unexpected analyzed declarations');
// Select complete original date-formatting members, leaving time-picker and
// unrelated localization APIs with their existing package owners.
const localization = ir.records.find((r: any) => r.symbol === 'DefaultMaterialLocalizations');
if (localization?.ir) {
  const selected = new Set<string>(['_getDaysInMonth', '_formatTwoDigitZeroPad']);
  const visit = (v: any): void => {
    if (!v || typeof v !== 'object') return;
    if (v.reference?.owner === 'MaterialLocalizations' && v.reference.name !== 'of')
      selected.add(v.reference.name);
    for (const child of Object.values(v))
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
  };
  for (const row of ir.records) if (row !== localization) visit(row.ir);
  localization.ir = {
    ...localization.ir,
    methods: localization.ir.methods.filter((m: any) => selected.has(m.name)),
    fields: localization.ir.fields.filter((f: any) => f.name !== 'delegate'),
  };
}
const old = JSON.parse(
  fs.readFileSync(
    'tools/Nelyx.FrameworkToTypeScript/data/work8/recipes/w10-material-scrollbar.json',
    'utf8',
  ),
).modules[0];
const recipe: any = {};
for (const key of [
  'imports',
  'typeImports',
  'methodTypeWitnesses',
  'typeBindings',
  'adapters',
  'superConstructors',
  'values',
  'memberBindings',
  'lateFields',
  'lateLocals',
  'numericTypes',
  'numericValues',
  'numericFunctions',
  'numericOperators',
  'records',
  'namedRecords',
  'staticFields',
  'runtimeTypes',
  'runtimeTypeApplications',
  'stringConversions',
  'methodTearOff',
  'assertion',
  'durationUnit',
  'patternMatching',
  'recordPatterns',
  'objectConstantPatterns',
])
  if (old[key]) recipe[key] = old[key];
recipe.importEmission = { policy: 'used-identifiers' };
delete recipe.methodTypeWitnesses;
recipe.sourceFlow = { policy: 'resolved-source-flow' };
recipe.iteration = { policy: 'host-iterable' };
recipe.constantConstructors = old.constantConstructors;
recipe.typeBindings[
  'package:flutter/src/material/material_localizations.dart::MaterialLocalizations:CLASS'
] = 'MaterialLocalizations';
recipe.imports.MaterialLocalizations = './material-localizations.ts';
recipe.typeBindings['package:flutter/src/services/text_input.dart::TextInputType:CLASS'] =
  'TextInputType';
recipe.imports.TextInputType = '@nelyx/core/services/text-input';
recipe.typeBindings['package:flutter/src/widgets/focus_manager.dart::FocusNode:CLASS'] =
  'FocusNode';
recipe.imports.FocusNode = '@nelyx/core/framework/widgets/focus';
recipe.imports.constSourceSize = '@nelyx/core/ui/size-source';
recipe.constantConstructors['dart:ui::Size.Size.new:CONSTRUCTOR'] = {
  factory: 'constSourceSize',
  policy: 'canonical-immutable-host',
  ownerType: 'dart:ui::Size:CLASS',
};
recipe.imports.modulo = '@nelyx/core/internal/ui/value-math';
recipe.adapters['dart:core::num.%:METHOD'] = { target: 'modulo', kind: 'call', receiver: 'first' };
recipe.imports.truncateDivide = '@nelyx/core/internal/ui/value-math';
recipe.adapters['dart:core::num.~/:METHOD'] = {
  target: 'truncateDivide',
  kind: 'call',
  receiver: 'first',
};
recipe.imports.dartValueString = '@nelyx/core/foundation/dart-value';
recipe.stringConversions['dart:core::DateTime:CLASS'] = 'dartValueString';
recipe.typeBindings['package:flutter/src/widgets/icon.dart::Icon:CLASS'] = 'Icon';
recipe.imports.Icon = '@nelyx/core/framework/widgets/icon';
recipe.imports.constGregorianCalendarDelegate = './internal/date/source-host.ts';
recipe.constructorSpecializations = old.constructorSpecializations;
recipe.renames = { '==': 'equals' };
recipe.adapters['package:flutter/src/material/date.dart::DateTimeRange.==:METHOD'] = {
  target: 'equals',
  kind: 'call',
  receiver: 'target',
};
recipe.typeBindings['package:flutter/src/widgets/editable_text.dart::TextEditingController:CLASS'] =
  'TextEditingController';
recipe.imports.TextEditingController = '@nelyx/core/framework/widgets/editable-text';
recipe.imports.constDateInsetsSymmetric = './internal/date/source-host.ts';
recipe.constantConstructors[
  'package:flutter/src/painting/edge_insets.dart::EdgeInsets.EdgeInsets.symmetric:CONSTRUCTOR'
] = {
  factory: 'constDateInsetsSymmetric',
  policy: 'canonical-immutable-host',
  ownerType: 'package:flutter/src/painting/edge_insets.dart::EdgeInsets:CLASS',
  namedArguments: 'options',
};
recipe.imports.isDateTimeRange = './internal/date/source-host.ts';
recipe.runtimeTypeApplications = [
  {
    type: {
      kind: 'interface',
      nullable: false,
      reference: ir.records.find((r: any) => r.symbol === 'DateTimeRange').ir.reference,
      arguments: [
        {
          kind: 'interface',
          nullable: false,
          reference: {
            id: 'dart:core::DateTime:CLASS',
            name: 'DateTime',
            owner: null,
            local: false,
            static: false,
          },
          arguments: [],
        },
      ],
    },
    is: 'isDateTimeRange',
    policy: 'checked-host-type-application',
  },
];
recipe.imports.debugCheckHasMaterial = './internal/date/source-host.ts';
recipe.imports.debugCheckHasMaterialLocalizations = './internal/date/source-host.ts';
recipe.imports.debugCheckHasDirectionality = './internal/date/source-host.ts';
recipe.adapters['package:flutter/src/widgets/debug.dart::debugCheckHasDirectionality:FUNCTION'] = {
  target: 'debugCheckHasDirectionality',
  kind: 'call',
};
recipe.typeBindings[
  'package:flutter/src/widgets/restoration_properties.dart::RestorableDateTimeN:CLASS'
] = 'RestorableDateTimeN';
recipe.imports.RestorableDateTimeN = './internal/date/source-host.ts';
for (const symbol of ['debugCheckHasMaterial', 'debugCheckHasMaterialLocalizations'])
  recipe.adapters['package:flutter/src/material/debug.dart::' + symbol + ':FUNCTION'] = {
    target: symbol,
    kind: 'call',
  };
recipe.adapters['package:flutter/src/widgets/framework.dart::State.dispose:METHOD'] = {
  target: 'dispose',
  kind: 'call',
  receiver: 'target',
};
recipe.imports.RestorationMixin = '@nelyx/core/framework/widgets/restoration';
recipe.imports.SingleTickerProviderStateMixin = '@nelyx/core/framework/widgets/ticker-provider';
for (const row of ir.records)
  if (row.ir?.mixins?.length) {
    const m = row.ir.mixins[0];
    const key = (t: any): string =>
      t.reference.id + (t.arguments?.length ? '<' + t.arguments.map(key).join(',') + '>' : '');
    recipe.superConstructors[row.ir.reference.id] = {
      sourceConstructor: row.ir.superclass.constructor.id,
      target: m.reference.name,
      baseType: 'State',
      mixins: row.ir.mixins.map(key),
      policy: 'no-derived-state-observation',
    };
  }
recipe.constantConstructors[
  'package:flutter/src/material/date.dart::GregorianCalendarDelegate.GregorianCalendarDelegate.new:CONSTRUCTOR'
] = {
  factory: 'constGregorianCalendarDelegate',
  policy: 'canonical-generated-external-fields',
  ownerType: 'package:flutter/src/material/date.dart::GregorianCalendarDelegate:CLASS',
};
function walk(value: any) {
  if (!value || typeof value !== 'object') return;
  const ref = value.reference;
  if (value.kind === 'call' && ref?.name === 'copyWith' && ref.id.startsWith('package:flutter/'))
    recipe.adapters[ref.id] = {
      target: 'copyWith',
      kind: 'call',
      receiver: 'target',
      namedArguments: 'options',
    };
  if (
    ref &&
    /^(dart:core::DateTime\.|package:flutter\/src\/material\/material_localizations.dart::MaterialLocalizations\.)/.test(
      ref.id,
    )
  ) {
    if (ref.id.endsWith(':METHOD'))
      recipe.adapters[ref.id] = {
        target: ref.static ? ref.owner + '.' + ref.name : ref.name,
        kind: 'call',
        ...(ref.static ? {} : { receiver: 'target' }),
      };
    if (!ref.static && (ref.id.endsWith(':GETTER') || ref.id.endsWith(':FIELD')))
      recipe.memberBindings[ref.id] = ref.name;
  }
  for (const child of Object.values(value))
    if (Array.isArray(child)) child.forEach(walk);
    else walk(child);
}
walk(ir);
// Discover candidate canonical module owners; compilation and runtime validation
// remain mandatory before these bindings become a product recipe.
const catalog = new Map<string, { file: string; typeOnly: boolean }[]>();
for (const base of ['Nelyx/src', 'packages/material/src', 'packages/cupertino/src'])
  for (const file of fs
    .readdirSync(base, { recursive: true })
    .filter((x: any) => typeof x === 'string' && x.endsWith('.ts'))) {
    const full = base + '/' + String(file).replaceAll('\\', '/');
    const ast = ts.createSourceFile(
      full,
      fs.readFileSync(full, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of ast.statements) {
      if (!statement.modifiers?.some((m: any) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
      const names = ts.isVariableStatement(statement)
        ? statement.declarationList.declarations.map((x: any) => x.name.text)
        : statement.name?.text
          ? [statement.name.text]
          : [];
      for (const name of names) {
        const list = catalog.get(name) ?? [];
        list.push({
          file: full,
          typeOnly: ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement),
        });
        catalog.set(name, list);
      }
    }
  }
const coreExports = JSON.parse(fs.readFileSync('Nelyx/package.json', 'utf8')).exports;
function moduleFor(file: string) {
  if (file.startsWith('Nelyx/src/')) {
    const dist = './dist/' + file.slice(10).replace(/\.ts$/, '.js');
    const found = Object.entries(coreExports).find(
      ([, v]: any) => v.default === dist || v.import === dist,
    );
    return found ? '@nelyx/core/' + found[0].slice(2) : '../../../' + file;
  }
  return './' + path.relative('packages/material/src', file).replaceAll('\\', '/');
}
function bindTypes(value: any) {
  if (!value || typeof value !== 'object') return;
  const ref = value.reference;
  if (ref && /:CLASS$|:MIXIN$|:ENUM$/.test(ref.id) && !recipe.typeBindings[ref.id]) {
    const candidates = catalog.get(ref.name) ?? [];
    const dart = /package:flutter\/src\/(.+)\.dart::/.exec(ref.id)?.[1];
    const expected = dart
      ? (/^(material|cupertino)\//.test(dart)
          ? 'packages/' + dart.split('/')[0] + '/src/' + dart.split('/').slice(1).join('/')
          : 'Nelyx/src/' +
            (/^(widgets|rendering|painting|gestures|animation|semantics|scheduler|physics)\//.test(
              dart,
            )
              ? 'framework/'
              : '') +
            dart
        ).replaceAll('_', '-') + '.ts'
      : null;
    const own =
      candidates.find((c) => c.file === expected) ??
      (candidates.length === 1 ? candidates[0] : undefined);
    if (own) {
      recipe.typeBindings[ref.id] = ref.name;
      (own.typeOnly ? recipe.typeImports : recipe.imports)[ref.name] = moduleFor(own.file);
    }
  }
  for (const child of Object.values(value))
    if (Array.isArray(child)) child.forEach(bindTypes);
    else bindTypes(child);
}
bindTypes(ir);
for (const key of Object.keys(recipe.typeImports))
  if (recipe.imports[key]) delete recipe.typeImports[key];
recipe.imports.SemanticsService = '@nelyx/core/framework/semantics/semantics-service';
recipe.typeBindings[
  'package:flutter/src/semantics/semantics_service.dart::SemanticsService:CLASS'
] = 'SemanticsService';
recipe.adapters[
  'package:flutter/src/services/text_input.dart::TextEditingValue.TextEditingValue.new:CONSTRUCTOR'
] = { target: 'TextEditingValue', kind: 'new', namedArguments: 'options' };
recipe.adapters['package:flutter/src/services/text_input.dart::TextEditingValue.copyWith:METHOD'] =
  { target: 'copyWith', kind: 'call', receiver: 'target', namedArguments: 'options' };
recipe.adapters['dart:core::DateTime.==:METHOD'] = {
  target: 'equals',
  kind: 'call',
  receiver: 'target',
};
recipe.imports.isDateTime = './internal/date/date-time.ts';
recipe.imports.castDateTime = './internal/date/date-time.ts';
recipe.runtimeTypes['dart:core::DateTime:CLASS'] = { is: 'isDateTime', cast: 'castDateTime' };
recipe.adapters[
  'package:flutter/src/services/text_editing.dart::TextSelection.TextSelection.new:CONSTRUCTOR'
] = { target: 'TextSelection', kind: 'new', namedArguments: 'options' };
recipe.asyncRuntime = old.asyncRuntime;
recipe.asyncRuntime = { ...recipe.asyncRuntime, resultTransfer: 'closed-nonnumeric-forwarding' };
recipe.imports.dateListAdd = './internal/date/source-host.ts';
recipe.adapters['dart:core::List.add:METHOD'] = {
  target: 'dateListAdd',
  kind: 'call',
  receiver: 'first',
};
recipe.imports.dateCatchError = './internal/date/source-host.ts';
recipe.adapters['dart:async::Future.catchError:METHOD'] = {
  target: 'dateCatchError',
  kind: 'call',
  receiver: 'first',
};
recipe.stringConversions['package:flutter/src/material/date.dart::DateTimeRange.T:TYPE_PARAMETER'] =
  'dartValueString';
recipe.imports.dateTimeType = './internal/date/date-time.ts';
recipe.methodTypeWitnesses = {
  ...old.methodTypeWitnesses,
  methods: [],
  types: { ...old.methodTypeWitnesses.types, 'dart:core::DateTime:CLASS': 'dateTimeType' },
  applications: {},
};
for (const [id, name, module] of [
  [
    'package:flutter/src/painting/borders.dart::OutlinedBorder:CLASS',
    'sourceOutlinedBorderType',
    '@nelyx/core/internal/framework/painting/source-value-types',
  ],
  [
    'package:flutter/src/painting/borders.dart::BorderSide:CLASS',
    'sourceBorderSideType',
    '@nelyx/core/framework/widgets/widget-state-border-side',
  ],
]) {
  recipe.imports[name] = module;
  recipe.methodTypeWitnesses.types[id] = name;
}
for (const [id, name, module] of [
  [
    'package:flutter/src/widgets/media_query.dart::MediaQuery:CLASS',
    'MediaQuery',
    '@nelyx/core/framework/widgets/app-data',
  ],
  [
    'package:flutter/src/widgets/form.dart::FormState:CLASS',
    'FormState',
    '@nelyx/core/framework/widgets/form',
  ],
  [
    'package:flutter/src/services/text_input.dart::TextEditingValue:CLASS',
    'TextEditingValue',
    '@nelyx/core/services/text-input',
  ],
  [
    'package:flutter/src/widgets/shortcuts.dart::ShortcutActivator:CLASS',
    'ShortcutActivator',
    '@nelyx/core/framework/widgets/shortcuts',
  ],
  [
    'package:flutter/src/widgets/actions.dart::Intent:CLASS',
    'Intent',
    '@nelyx/core/framework/widgets/actions',
  ],
  ['package:flutter/src/widgets/view.dart::View:CLASS', 'View', './internal/date/source-host.ts'],
  ['package:flutter/src/material/theme.dart::Theme:CLASS', 'Theme', './theme.ts'],
]) {
  recipe.typeBindings[id] = name;
  recipe.imports[name] = module;
}
recipe.imports.DateTime = './internal/date/date-time.ts';
recipe.typeBindings['dart:core::DateTime:CLASS'] = 'DateTime';
recipe.adapters['dart:core::DateTime.DateTime.new:CONSTRUCTOR'] = {
  target: 'DateTime',
  kind: 'new',
};
recipe.superConstructors[
  'package:flutter/src/widgets/framework.dart::State.State.new:CONSTRUCTOR'
] = { target: 'State', policy: 'no-derived-state-observation' };
recipe.typeBindings['package:flutter/src/painting/text_style.dart::TextStyle:CLASS'] = 'TextStyle';
recipe.imports.TextStyle = '@nelyx/core/framework/painting/text-style';
recipe.collectionLiterals = [...(old.collectionLiterals ?? [])];
const collectionKeys = new Set<string>();
function typeKey(t: any): string {
  return (
    t.reference?.id + (t.arguments?.length ? '<' + t.arguments.map(typeKey).join(',') + '>' : '')
  );
}
for (const c of recipe.collectionLiterals) collectionKeys.add(typeKey(c.type));
function collections(v: any) {
  if (!v || typeof v !== 'object') return;
  if (v.kind === 'collectionLiteral' && !collectionKeys.has(typeKey(v.collectionType))) {
    const args = v.collectionType.arguments.map((t: any) => t.reference.name);
    const factory = 'date' + args.join('') + 'Map';
    recipe.imports[factory] = './internal/date/source-host.ts';
    recipe.imports['const' + factory] = './internal/date/source-host.ts';
    recipe.collectionLiterals.push({
      type: v.collectionType,
      factory,
      constantFactory: 'const' + factory,
      constantPolicy: 'canonical-map-entries',
      policy: 'ordered-dart-collection',
    });
    collectionKeys.add(typeKey(v.collectionType));
  }
  for (const x of Object.values(v))
    if (Array.isArray(x)) x.forEach(collections);
    else collections(x);
}
collections(ir);
for (const name of [
  'Padding',
  'Align',
  'Center',
  'ConstrainedBox',
  'SizedBox',
  'Column',
  'Row',
  'Expanded',
  'Flexible',
  'Stack',
  'Positioned',
  'PositionedDirectional',
]) {
  const factory = 'date' + name;
  recipe.imports[factory] = './internal/date/source-host.ts';
  recipe.adapters[
    'package:flutter/src/widgets/basic.dart::' + name + '.' + name + '.new:CONSTRUCTOR'
  ] = { target: factory, kind: 'call', namedArguments: 'options' };
}
recipe.adapters['package:flutter/src/widgets/text.dart::Text.Text.new:CONSTRUCTOR'] = {
  target: 'Text',
  kind: 'new',
  namedArguments: 'trailing-options',
};
recipe.adapters[
  'package:flutter/src/widgets/scroll_controller.dart::ScrollController.ScrollController.new:CONSTRUCTOR'
] = { target: 'ScrollController', kind: 'new', namedArguments: 'options' };
recipe.typeBindings['package:flutter/src/painting/shape_decoration.dart::ShapeDecoration:CLASS'] =
  'ColorShapeDecoration';
recipe.imports.ColorShapeDecoration = '@nelyx/core/framework/painting/color-shape-decoration';
recipe.imports.dateShapeDecoration = './internal/date/source-host.ts';
recipe.adapters[
  'package:flutter/src/painting/shape_decoration.dart::ShapeDecoration.ShapeDecoration.new:CONSTRUCTOR'
] = { target: 'dateShapeDecoration', kind: 'call', namedArguments: 'options' };
recipe.adapters['package:flutter/src/widgets/icon.dart::Icon.Icon.new:CONSTRUCTOR'] = {
  target: 'Icon',
  kind: 'new',
  namedArguments: 'trailing-options',
};
recipe.imports.dateEnumString = './internal/date/source-host.ts';
for (const name of ['DatePickerEntryMode', 'DatePickerMode'])
  recipe.stringConversions['package:flutter/src/material/date.dart::' + name + ':ENUM'] =
    'dateEnumString';
recipe.adapters['package:flutter/src/painting/text_scaler.dart::TextScaler.scale:METHOD'] = {
  target: 'scale',
  kind: 'call',
  receiver: 'target',
};
recipe.adapters['package:flutter/src/widgets/basic.dart::Semantics.Semantics.new:CONSTRUCTOR'] = {
  target: 'Semantics',
  kind: 'new',
  namedArguments: 'options',
};
recipe.adapters['package:flutter/src/painting/text_scaler.dart::TextScaler.clamp:METHOD'] = {
  target: 'clamp',
  kind: 'call',
  receiver: 'target',
  namedArguments: 'options',
};
recipe.adapters[
  'package:flutter/src/material/text_form_field.dart::TextFormField.TextFormField.new:CONSTRUCTOR'
] = { target: 'TextFormField', kind: 'new', namedArguments: 'options' };
recipe.adapters[
  'package:flutter/src/material/input_decorator.dart::InputDecoration.copyWith:METHOD'
] = { target: 'copyWith', kind: 'call', receiver: 'target', namedArguments: 'options' };
recipe.adapters[
  'package:flutter/src/material/input_decorator.dart::InputDecorationThemeData.merge:METHOD'
] = { target: 'merge', kind: 'call', receiver: 'target' };
recipe.adapters[
  'package:flutter/src/widgets/media_query.dart::MediaQuery.withClampedTextScaling:METHOD'
] = { target: 'dateClampedTextScaling', kind: 'call', namedArguments: 'options' };
recipe.imports.dateClampedTextScaling = './internal/date/source-host.ts';
recipe.imports.dateFormKey = './internal/date/source-host.ts';
recipe.constructorSpecializations[
  'package:flutter/src/widgets/framework.dart::GlobalKey.GlobalKey.new:CONSTRUCTOR'
].push({
  typeArguments: ['package:flutter/src/widgets/form.dart::FormState:CLASS'],
  target: 'dateFormKey',
  kind: 'call',
});
recipe.imports.SourceRestorableValue = './internal/date/source-host.ts';
recipe.typeBindings[
  'package:flutter/src/widgets/restoration_properties.dart::RestorableValue:CLASS'
] = 'SourceRestorableValue';
recipe.superConstructors[
  'package:flutter/src/widgets/restoration_properties.dart::RestorableValue.RestorableValue.new:CONSTRUCTOR'
] = { target: 'SourceRestorableValue', policy: 'no-derived-state-observation' };
recipe.imports.SemanticsRole = '@nelyx/core/ui/semantics';
recipe.typeBindings['dart:ui::SemanticsRole:ENUM'] = 'SemanticsRole';
recipe.typeBindings['dart:core::StackTrace:CLASS'] = 'SourceStackTrace';
recipe.typeImports.SourceStackTrace = './internal/date/source-host.ts';
recipe.adapters[
  'package:flutter/src/foundation/assertions.dart::FlutterErrorDetails.FlutterErrorDetails.new:CONSTRUCTOR'
] = { target: 'FlutterErrorDetails', kind: 'new', namedArguments: 'options' };
recipe.superConstructors[
  'package:flutter/src/material/dialog_theme.dart::DialogThemeData.DialogThemeData.new:CONSTRUCTOR'
] = {
  target: 'DialogThemeData',
  namedArguments: 'options',
  policy: 'no-derived-state-observation',
};
recipe.superConstructors[
  'package:flutter/src/rendering/sliver_grid.dart::SliverGridDelegate.SliverGridDelegate.new:CONSTRUCTOR'
] = { target: 'SliverGridDelegate', policy: 'no-derived-state-observation' };
recipe.imports.dateValueKey = './internal/date/source-host.ts';
recipe.constructorSpecializations[
  'package:flutter/src/foundation/key.dart::ValueKey.ValueKey.new:CONSTRUCTOR'
] = [{ typeArguments: ['dart:core::DateTime:CLASS'], target: 'dateValueKey', kind: 'call' }];
recipe.imports.dateYearKey = './internal/date/source-host.ts';
recipe.constructorSpecializations[
  'package:flutter/src/foundation/key.dart::ValueKey.ValueKey.new:CONSTRUCTOR'
].push({ typeArguments: ['dart:core::int:CLASS'], target: 'dateYearKey', kind: 'call' });
for (const [type, values] of Object.entries({
  MainAxisAlignment: ['start', 'end', 'center', 'spaceBetween', 'spaceAround', 'spaceEvenly'],
  CrossAxisAlignment: ['start', 'end', 'center', 'stretch', 'baseline'],
  MainAxisSize: ['min', 'max'],
}))
  for (const value of values)
    recipe.values['package:flutter/src/rendering/flex.dart::' + type + '.' + value + ':GETTER'] =
      value;
recipe.imports.TraversalDirection = '@nelyx/core/framework/widgets/focus-traversal-policy';
recipe.typeBindings['package:flutter/src/widgets/widget_state.dart::WidgetStatesController:CLASS'] =
  'WidgetStatesController';
recipe.imports.WidgetStatesController = '@nelyx/core/framework/widgets/widget-state';
recipe.typeBindings['package:flutter/src/widgets/widget_state.dart::WidgetState:ENUM'] =
  'WidgetState';
recipe.imports.WidgetState = '@nelyx/core/framework/widgets/widget-state';
recipe.typeBindings['package:flutter/src/widgets/widget_state.dart::WidgetStateProperty:CLASS'] =
  'WidgetStateProperty';
recipe.imports.WidgetStateProperty = '@nelyx/core/framework/widgets/widget-state';
recipe.externalStaticMethods = {
  'package:flutter/src/widgets/widget_state.dart::WidgetStateProperty.resolveWith:METHOD': {
    ownerType: 'package:flutter/src/widgets/widget_state.dart::WidgetStateProperty:CLASS',
    target: 'WidgetStateProperty',
    arity: 1,
    policy: 'reified-generated-static',
  },
};
recipe.adapters[
  'package:flutter/src/widgets/widget_state.dart::WidgetStatesController.WidgetStatesController.new:CONSTRUCTOR'
] = { target: 'WidgetStatesController', kind: 'new' };
recipe.typeBindings['package:flutter/src/widgets/focus_traversal.dart::TraversalDirection:ENUM'] =
  'TraversalDirection';
recipe.patternMatching = { policy: 'ordered-cached-access-paths', equals: 'dartValueEquals' };
recipe.imports.dartValueEquals = '@nelyx/core/foundation/dart-value';
recipe.implicitTypeParameterBound = 'dart-object-nullable';
recipe.recordPatterns = { policy: 'core-shape-probe' };
recipe.numericOperators = { policy: 'retained-core-numeric-operations', operators: {} };
for (const name of ['min', 'max']) {
  const target = name + 'SourceDartNum';
  recipe.imports[target] = '@nelyx/core/foundation/dart-numeric-math';
  recipe.adapters['dart:math::' + name + ':FUNCTION'] = { target, kind: 'call' };
}
for (const [op, suffix] of Object.entries({
  '+': 'Add',
  '-': 'Subtract',
  '*': 'Multiply',
  '/': 'Divide',
  '<': 'Less',
  '<=': 'LessEqual',
  '>': 'Greater',
  '>=': 'GreaterEqual',
})) {
  const target = 'sourceDartNum' + suffix;
  recipe.imports[target] = '@nelyx/core/foundation/dart-numeric';
  for (const owner of ['num', 'int', 'double'])
    recipe.numericOperators.operators['dart:core::' + owner + '.' + op + ':METHOD'] = target;
}
recipe.imports.SourceInheritedHost = './internal/date/source-host.ts';
recipe.superConstructors[
  'package:flutter/src/widgets/framework.dart::InheritedWidget.InheritedWidget.new:CONSTRUCTOR'
] = {
  target: 'SourceInheritedHost',
  baseType: 'InheritedWidget',
  namedArguments: 'options',
  policy: 'no-derived-state-observation',
};
recipe.adapters['dart:core::Map.[]:METHOD'] = { target: 'get', kind: 'call', receiver: 'target' };
recipe.imports.dateMapGet = './internal/date/source-host.ts';
recipe.adapters['dart:core::Map.[]:METHOD'] = {
  target: 'dateMapGet',
  kind: 'call',
  receiver: 'first',
};
recipe.adapters['dart:core::String.toUpperCase:METHOD'] = {
  target: 'toUpperCase',
  kind: 'call',
  receiver: 'target',
};
recipe.imports.dateIntString = './internal/date/source-host.ts';
recipe.stringConversions['dart:core::int:CLASS'] = 'dateIntString';
recipe.adapters['dart:core::int.toString:METHOD'] = {
  target: 'dateIntString',
  kind: 'call',
  receiver: 'first',
};
recipe.imports.dateIntAbs = './internal/date/source-host.ts';
recipe.adapters['dart:core::int.abs:METHOD'] = {
  target: 'dateIntAbs',
  kind: 'call',
  receiver: 'first',
};
recipe.typeBindings['dart:core::StringBuffer:CLASS'] = 'DateStringBuffer';
recipe.imports.DateStringBuffer = './internal/date/source-host.ts';
recipe.adapters['dart:core::StringBuffer.StringBuffer.new:CONSTRUCTOR'] = {
  target: 'DateStringBuffer',
  kind: 'new',
};
for (const name of ['write', 'toString'])
  recipe.adapters['dart:core::StringBuffer.' + name + ':METHOD'] = {
    target: name,
    kind: 'call',
    receiver: 'target',
  };
recipe.imports.dateStringAt = './internal/date/source-host.ts';
recipe.adapters['dart:core::String.[]:METHOD'] = {
  target: 'dateStringAt',
  kind: 'call',
  receiver: 'first',
};
recipe.adapters['dart:core::String.padLeft:METHOD'] = {
  target: 'padStart',
  kind: 'call',
  receiver: 'target',
};
recipe.adapters['dart:core::String.split:METHOD'] = {
  target: 'split',
  kind: 'call',
  receiver: 'target',
};
recipe.imports.dateTryParseInt = './internal/date/source-host.ts';
recipe.adapters['dart:core::int.tryParse:METHOD'] = {
  target: 'dateTryParseInt',
  kind: 'call',
  namedArguments: 'trailing-options',
};
recipe.exceptions = old.exceptions;
recipe.typeBindings['dart:core::ArgumentError:CLASS'] = 'DateArgumentError';
for (const name of ['DateArgumentError', 'isDateArgumentError', 'castDateArgumentError'])
  recipe.imports[name] = './internal/date/date-time.ts';
recipe.runtimeTypes['dart:core::ArgumentError:CLASS'] = {
  is: 'isDateArgumentError',
  cast: 'castDateArgumentError',
};
recipe.imports.dateListAt = './internal/date/source-host.ts';
recipe.adapters['dart:core::List.[]:METHOD'] = {
  target: 'dateListAt',
  kind: 'call',
  receiver: 'first',
};
recipe.adapters['dart:ui::Size.*:METHOD'] = {
  target: 'multiply',
  kind: 'call',
  receiver: 'target',
};
recipe.imports.dateFocusableActionDetector = './internal/date/source-host.ts';
recipe.imports.dateBuilder = './internal/date/source-host.ts';
recipe.imports.dateColorSwatch = './internal/date/source-host.ts';
recipe.adapters[
  'package:flutter/src/widgets/actions.dart::FocusableActionDetector.FocusableActionDetector.new:CONSTRUCTOR'
] = { target: 'dateFocusableActionDetector', kind: 'call', namedArguments: 'options' };
recipe.adapters['package:flutter/src/widgets/basic.dart::Builder.Builder.new:CONSTRUCTOR'] = {
  target: 'dateBuilder',
  kind: 'call',
  namedArguments: 'options',
};
recipe.adapters['package:flutter/src/painting/colors.dart::ColorSwatch.[]:METHOD'] = {
  target: 'dateColorSwatch',
  kind: 'call',
  receiver: 'first',
};
recipe.imports.dateLayoutBuilder = './internal/date/source-host.ts';
recipe.imports.datePageViewBuilder = './internal/date/source-host.ts';
recipe.adapters['package:flutter/src/material/divider.dart::Divider.Divider.new:CONSTRUCTOR'] = {
  target: 'Divider',
  kind: 'new',
  namedArguments: 'options',
};
recipe.adapters[
  'package:flutter/src/material/divider.dart::VerticalDivider.VerticalDivider.new:CONSTRUCTOR'
] = { target: 'VerticalDivider', kind: 'new', namedArguments: 'options' };
recipe.imports.dateDependOnFocusedDate = './internal/date/source-host.ts';
recipe.adapters[
  'package:flutter/src/widgets/framework.dart::BuildContext.dependOnInheritedWidgetOfExactType:METHOD'
] = {
  target: 'dateDependOnFocusedDate',
  kind: 'call',
  receiver: 'first',
  typeArguments: ['package:flutter/src/material/calendar_date_picker.dart::_FocusedDate:CLASS'],
};
recipe.adapters[
  'package:flutter/src/widgets/layout_builder.dart::LayoutBuilder.LayoutBuilder.new:CONSTRUCTOR'
] = { target: 'dateLayoutBuilder', kind: 'call', namedArguments: 'options' };
for (const name of ['symmetric', 'only'])
  recipe.adapters[
    'package:flutter/src/painting/edge_insets.dart::EdgeInsets.EdgeInsets.' + name + ':CONSTRUCTOR'
  ] = { target: 'EdgeInsets.' + name, kind: 'call', namedArguments: 'options' };
recipe.imports.dateDirectionality = './internal/date/source-host.ts';
recipe.adapters[
  'package:flutter/src/widgets/basic.dart::Directionality.Directionality.new:CONSTRUCTOR'
] = { target: 'dateDirectionality', kind: 'call', namedArguments: 'options' };
recipe.imports.dateGridViewCustom = './internal/date/source-host.ts';
recipe.imports.dateLocalizationsOverride = './internal/date/source-host.ts';
recipe.adapters[
  'package:flutter/src/widgets/scroll_view.dart::GridView.GridView.custom:CONSTRUCTOR'
] = { target: 'GridView.custom', kind: 'call', namedArguments: 'options' };
recipe.adapters[
  'package:flutter/src/widgets/scroll_view.dart::GridView.GridView.builder:CONSTRUCTOR'
] = { target: 'GridView.builder', kind: 'call', namedArguments: 'options' };
recipe.adapters[
  'package:flutter/src/widgets/scroll_delegate.dart::SliverChildListDelegate.SliverChildListDelegate.new:CONSTRUCTOR'
] = { target: 'SliverChildListDelegate', kind: 'new', namedArguments: 'trailing-options' };
recipe.imports.dateShowDialog = './internal/date/source-host.ts';
recipe.adapters['package:flutter/src/material/dialog.dart::showDialog:FUNCTION'] = {
  target: 'dateShowDialog',
  kind: 'call',
  namedArguments: 'options',
  typeArguments: ['dart:core::DateTime:CLASS'],
};
recipe.adapters[
  'package:flutter/src/widgets/localizations.dart::Localizations.Localizations.override:CONSTRUCTOR'
] = { target: 'dateLocalizationsOverride', kind: 'call', namedArguments: 'options' };
recipe.adapters[
  'package:flutter/src/widgets/page_view.dart::PageView.PageView.builder:CONSTRUCTOR'
] = { target: 'datePageViewBuilder', kind: 'call', namedArguments: 'options' };
recipe.typeBindings['package:flutter/src/widgets/spacer.dart::Spacer:CLASS'] = 'Spacer';
recipe.imports.Spacer = './internal/date/source-host.ts';
for (const value of ['light', 'dark'])
  recipe.values['dart:ui::Brightness.' + value + ':GETTER'] = value;
recipe.typeBindings['dart:ui::Clip:ENUM'] = 'Clip';
recipe.typeImports.Clip = '@nelyx/core/ui/clip';
for (const name of ['none', 'hardEdge', 'antiAlias', 'antiAliasWithSaveLayer'])
  recipe.values['dart:ui::Clip.' + name + ':GETTER'] = name;
recipe.imports.dateRemoveViewInsets = './internal/date/source-host.ts';
recipe.adapters[
  'package:flutter/src/widgets/media_query.dart::MediaQuery.removeViewInsets:CONSTRUCTOR'
] = { target: 'dateRemoveViewInsets', kind: 'call', namedArguments: 'options' };
recipe.adapters[
  'package:flutter/src/widgets/media_query.dart::MediaQuery.MediaQuery.removeViewInsets:CONSTRUCTOR'
] = { target: 'dateRemoveViewInsets', kind: 'call', namedArguments: 'options' };
recipe.constructorSpecializations[
  'package:flutter/src/widgets/actions.dart::CallbackAction.CallbackAction.new:CONSTRUCTOR'
] = ['NextFocusIntent', 'PreviousFocusIntent', 'DirectionalFocusIntent'].map((name) => {
  const target = 'date' + name + 'Action';
  recipe.imports[target] = './internal/date/source-host.ts';
  return {
    typeArguments: ['package:flutter/src/widgets/focus_traversal.dart::' + name + ':CLASS'],
    target,
    kind: 'call',
    namedArguments: 'options',
  };
});
recipe.imports.dateGenerateFocusNodes = './internal/date/source-host.ts';
recipe.constructorSpecializations['dart:core::List.List.generate:CONSTRUCTOR'] = [
  {
    typeArguments: ['package:flutter/src/widgets/focus_manager.dart::FocusNode:CLASS'],
    target: 'dateGenerateFocusNodes',
    kind: 'call',
  },
];
recipe.adapters['package:flutter/src/material/ink_well.dart::InkWell.InkWell.new:CONSTRUCTOR'] = {
  target: 'InkWell',
  kind: 'new',
  namedArguments: 'options',
};
recipe.adapters[
  'package:flutter/src/material/input_decorator.dart::InputDecoration.applyDefaults:METHOD'
] = { target: 'applyDefaults', kind: 'call', receiver: 'target' };
recipe.adapters['package:flutter/src/widgets/restoration.dart::RestorableProperty.dispose:METHOD'] =
  { target: 'dispose', kind: 'call', receiver: 'target' };
for (const kind of ['GETTER', 'SETTER'])
  recipe.memberBindings[
    'package:flutter/src/widgets/restoration_properties.dart::RestorableValue.value:' + kind
  ] = 'value';
recipe.adapters['package:flutter/src/painting/edge_insets.dart::EdgeInsetsGeometry.+:METHOD'] = {
  target: 'add',
  kind: 'call',
  receiver: 'target',
};
recipe.adapters['package:flutter/src/painting/edge_insets.dart::EdgeInsets.+:METHOD'] = {
  target: 'add',
  kind: 'call',
  receiver: 'target',
};
recipe.adapters[
  'package:flutter/src/material/input_decorator.dart::InputDecoration.InputDecoration.new:CONSTRUCTOR'
] = { target: 'InputDecoration', kind: 'new', namedArguments: 'options' };
recipe.adapters['package:flutter/src/widgets/restoration.dart::RestorationMixin.dispose:METHOD'] = {
  target: 'dispose',
  kind: 'call',
  receiver: 'target',
};
recipe.imports.debugIsSerializableForRestoration = './internal/date/source-host.ts';
recipe.adapters[
  'package:flutter/src/services/restoration.dart::debugIsSerializableForRestoration:FUNCTION'
] = { target: 'debugIsSerializableForRestoration', kind: 'call' };
recipe.adapters['package:flutter/src/painting/text_style.dart::TextStyle.apply:METHOD'] = {
  target: 'apply',
  kind: 'call',
  receiver: 'target',
  namedArguments: 'options',
};
recipe.adapters[
  'package:flutter/src/widgets/restoration.dart::RestorationMixin.registerForRestoration:METHOD'
] = { target: 'registerForRestoration', kind: 'call', receiver: 'target' };
recipe.imports.isSourceDartInt = '@nelyx/core/foundation/dart-numeric';
recipe.runtimeTypes['dart:core::int:CLASS'] = { is: 'isSourceDartInt', cast: 'castSourceDartInt' };
for (const value of ['portrait', 'landscape'])
  recipe.values['package:flutter/src/widgets/media_query.dart::Orientation.' + value + ':GETTER'] =
    value;
function constants(v: any) {
  if (!v || typeof v !== 'object') return;
  if (
    v.kind === 'construct' &&
    v.const &&
    v.name !== 'Duration' &&
    v.name !== 'GregorianCalendarDelegate' &&
    v.constructedType?.arguments.length === 0
  ) {
    const target =
      'constDate' +
      v.name +
      (v.constructor ? v.constructor[0].toUpperCase() + v.constructor.slice(1) : '');
    recipe.imports[target] = './internal/date/source-host.ts';
    recipe.constantConstructors[v.reference.id] = {
      factory: target,
      policy: 'canonical-immutable-host-fields',
      ownerType: v.constructedType.reference.id,
      ...(v.args.some((a: any) => a.name !== null)
        ? {
            namedArguments: v.args.some((a: any) => a.name === null)
              ? 'trailing-options'
              : 'options',
          }
        : {}),
    };
  }
  for (const x of Object.values(v))
    if (Array.isArray(x)) x.forEach(constants);
    else constants(x);
}
constants(ir);
const owned = new Set(
  ir.records
    .filter((r: any) => r.ir?.reference)
    .map((r: any) => r.ir.reference.id.replace(/:[^:]+$/, '')),
);
function members(v: any) {
  if (!v || typeof v !== 'object') return;
  const ref = v.reference;
  if (
    v.kind === 'call' &&
    ref?.owner &&
    ref.id.startsWith('package:flutter/') &&
    !recipe.adapters[ref.id] &&
    /^\w+$/.test(ref.name)
  ) {
    const prefix = ref.id.slice(0, ref.id.indexOf('::') + 2) + ref.owner;
    const binding =
      recipe.typeBindings[prefix + ':CLASS'] ?? recipe.typeBindings[prefix + ':MIXIN'];
    if (binding && !owned.has(prefix) && recipe.imports[binding])
      recipe.adapters[ref.id] = {
        target: ref.static ? binding + '.' + ref.name : ref.name,
        kind: 'call',
        ...(ref.static ? {} : { receiver: 'target' }),
        ...(v.args.some((a: any) => a.name !== null)
          ? {
              namedArguments: v.args.some((a: any) => a.name === null)
                ? 'trailing-options'
                : 'options',
            }
          : {}),
      };
  }
  if (
    v.kind === 'construct' &&
    !v.const &&
    ref?.owner &&
    !recipe.adapters[ref.id] &&
    v.args.every((a: any) => a.name !== null) &&
    !v.constructor
  ) {
    const prefix = ref.id.slice(0, ref.id.indexOf('::') + 2) + ref.owner;
    if (!owned.has(prefix)) {
      const candidates = catalog.get(ref.owner) ?? [];
      const file = candidates.find(
        (c) => moduleFor(c.file) === recipe.imports[recipe.typeBindings[prefix + ':CLASS']],
      )?.file;
      if (file) {
        const ast = ts.createSourceFile(
          file,
          fs.readFileSync(file, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
        );
        const cls = ast.statements.find(
          (s: any) => ts.isClassDeclaration(s) && s.name?.text === ref.owner,
        );
        const accepts = cls?.members.some(
          (m: any) =>
            ts.isConstructorDeclaration(m) &&
            m.parameters.length === 1 &&
            (ts.isObjectBindingPattern(m.parameters[0].name) ||
              m.parameters[0].name.text === 'options'),
        );
        if (accepts)
          recipe.adapters[ref.id] = {
            target: recipe.typeBindings[prefix + ':CLASS'],
            kind: 'new',
            namedArguments: 'options',
          };
      }
    }
  }
  for (const x of Object.values(v))
    if (Array.isArray(x)) x.forEach(members);
    else members(x);
}
members(ir);
for (const id of Object.keys(recipe.externalStaticMethods ?? {})) delete recipe.adapters[id];
for (const row of ir.records)
  if (row.ir?.reference && ['class', 'enum'].includes(row.ir.kind)) {
    recipe.typeBindings[row.ir.reference.id] = row.ir.name;
  }
const errors = [];
let passed = 0;
const outputs = new Map<string, string>();
const outputRoot = 'packages/material/src/generated/date';
recipe.typeBindings['package:flutter/src/material/theme_data.dart::ThemeData:CLASS'] = 'ThemeData';
recipe.imports.ThemeData = './theme-data.ts';
function normalizeImport(module: string): string {
  const coreIndex = module.indexOf('Nelyx/src/');
  if (coreIndex >= 0) module = moduleFor(module.slice(coreIndex));
  if (module.startsWith('@nelyx/core/')) {
    const key = './' + module.slice('@nelyx/core/'.length);
    if (!coreExports[key] && coreExports['./internal/' + key.slice(2)])
      return '@nelyx/core/internal/' + key.slice(2);
    return module;
  }
  if (module.includes('cupertino/src/'))
    throw Error('Date components must bind their own canonical runtime: ' + module);
  if (/^\.\/generated\/[^/]+\.ts$/.test(module))
    return './' + path.basename(module, '.ts') + '.generated.ts';
  const target = module.startsWith('../../internal/')
    ? 'packages/material/src/' + module.slice(6)
    : 'packages/material/src/' + module.slice(2);
  return path.relative(outputRoot, target).replaceAll('\\', '/');
}
recipe.imports.sourceStyleRuntimeType = './internal/date/source-values.ts';
recipe.imports.sourceStyleHash = './internal/date/source-values.ts';
recipe.typeImports.ShortcutActivator = recipe.imports.ShortcutActivator;
delete recipe.imports.ShortcutActivator;
recipe.imports.emptyWidgetStateSet = '@nelyx/core/framework/widgets/widget-state';
for (const name of [
  'dateListAt',
  'dateListAdd',
  'dateStringAt',
  'dateIntString',
  'dateIntAbs',
  'dateTryParseInt',
  'DateStringBuffer',
  'dateEnumString',
  'dateCatchError',
])
  recipe.imports[name] = './internal/date/source-values.ts';
recipe.typeImports.SourceStackTrace = './internal/date/source-values.ts';
for (const [id, name] of [
  ['theme_data.dart::ThemeData', 'SourceDateThemeData'],
  ['color_scheme.dart::ColorScheme', 'SourceDateColorScheme'],
  ['theme.dart::Theme', 'SourceDateTheme'],
]) {
  recipe.typeBindings['package:flutter/src/material/' + id + ':CLASS'] = name;
  recipe.imports[name] = './internal/date/source-theme.ts';
}
recipe.adapters['package:flutter/src/material/theme.dart::Theme.of:METHOD'] = {
  target: 'SourceDateTheme.of',
  kind: 'call',
};
recipe.imports.InputDecoration = './input-decoration.ts';
recipe.imports.TextInputType = './internal/date/source-input.ts';
recipe.typeBindings['package:flutter/src/widgets/editable_text.dart::TextEditingController:CLASS'] =
  'SourceDateEditingController';
recipe.imports.SourceDateEditingController = './internal/date/source-input.ts';
recipe.adapters[
  'package:flutter/src/widgets/editable_text.dart::TextEditingController.TextEditingController.new:CONSTRUCTOR'
] = { target: 'SourceDateEditingController', kind: 'new', namedArguments: 'options' };
recipe.adapters[
  'package:flutter/src/material/text_form_field.dart::TextFormField.TextFormField.new:CONSTRUCTOR'
] = { target: 'dateTextFormField', kind: 'call', namedArguments: 'options' };
recipe.imports.dateTextFormField = './internal/date/source-input.ts';
for (const [id, name] of [
  ['package:flutter/src/widgets/form.dart::Form.Form.new:CONSTRUCTOR', 'dateForm'],
  [
    'package:flutter/src/widgets/shortcuts.dart::Shortcuts.Shortcuts.new:CONSTRUCTOR',
    'dateShortcuts',
  ],
]) {
  recipe.adapters[id] = { target: name, kind: 'call', namedArguments: 'options' };
  recipe.imports[name] = './internal/date/source-host.ts';
}
recipe.adapters['package:flutter/src/widgets/media_query.dart::MediaQuery.orientationOf:METHOD'] = {
  target: 'dateOrientationOf',
  kind: 'call',
};
recipe.imports.dateOrientationOf = './internal/date/source-host.ts';
recipe.adapters[
  'package:flutter/src/widgets/media_query.dart::MediaQuery.maybeSupportsAnnounceOf:METHOD'
] = { target: 'dateMaybeSupportsAnnounceOf', kind: 'call' };
recipe.imports.dateMaybeSupportsAnnounceOf = './internal/date/source-host.ts';
recipe.adapters['dart:core::String.isEmpty:GETTER'] = {
  target: 'dateStringIsEmpty',
  kind: 'call',
  receiver: 'first',
};
recipe.imports.dateStringIsEmpty = './internal/date/source-values.ts';
recipe.typeBindings['dart:core::Type:CLASS'] = 'IntentType';
recipe.typeImports.IntentType = '@nelyx/core/framework/widgets/actions';
recipe.imports.RestorationMixin = './internal/date/source-host.ts';
for (const [id, name] of [
  ['package:flutter/src/painting/text_style.dart::TextStyle.color:GETTER', 'dateTextStyleColor'],
  ['package:flutter/src/painting/borders.dart::BorderSide.color:GETTER', 'dateBorderSideColor'],
]) {
  recipe.adapters[id] = { target: name, kind: 'call', receiver: 'first' };
  recipe.imports[name] = './internal/date/source-paint.ts';
}
for (const [id, name] of [
  ['package:flutter/src/painting/text_style.dart::TextStyle.apply:METHOD', 'dateTextStyleApply'],
  [
    'package:flutter/src/painting/text_style.dart::TextStyle.copyWith:METHOD',
    'dateTextStyleCopyWith',
  ],
  [
    'package:flutter/src/painting/borders.dart::BorderSide.copyWith:METHOD',
    'dateBorderSideCopyWith',
  ],
  [
    'package:flutter/src/painting/borders.dart::OutlinedBorder.copyWith:METHOD',
    'dateOutlinedBorderCopyWith',
  ],
]) {
  recipe.adapters[id] = {
    target: name,
    kind: 'call',
    receiver: 'first',
    namedArguments: 'trailing-options',
  };
  recipe.imports[name] = './internal/date/source-paint.ts';
}
recipe.adapters['package:flutter/src/widgets/text.dart::Text.Text.new:CONSTRUCTOR'] = {
  target: 'dateText',
  kind: 'call',
  namedArguments: 'trailing-options',
};
recipe.imports.dateText = './internal/date/source-paint.ts';
recipe.adapters['package:flutter/src/widgets/navigator.dart::Navigator.pop:METHOD'] = {
  target: 'dateNavigatorPop',
  kind: 'call',
};
recipe.imports.dateNavigatorPop = './internal/date/source-host.ts';
for (const [method, target] of [
  ['nextPage', 'dateNextPage'],
  ['previousPage', 'datePreviousPage'],
]) {
  recipe.adapters[
    'package:flutter/src/widgets/page_view.dart::PageController.' + method + ':METHOD'
  ] = { target, kind: 'call', receiver: 'first', namedArguments: 'trailing-options' };
  recipe.imports[target] = './internal/date/source-host.ts';
}
for (const source of new Set(ir.records.map((r: any) => r.source))) {
  const rows = ir.records.filter((r: any) => r.source === source);
  const local = {
    ...recipe,
    imports: { ...recipe.imports },
    typeImports: { ...recipe.typeImports },
  };
  if (source.endsWith('/material_localizations.dart')) {
    local.classNames = { DefaultMaterialLocalizations: 'SourceDateLocalizations' };
    local.interfaceBindings = {
      'package:flutter/src/material/material_localizations.dart::MaterialLocalizations:CLASS':
        'DateLocalizationsContract',
    };
    local.typeImports.DateLocalizationsContract = './internal/date/localizations-contract.ts';
  }
  for (const key of Object.keys(local.typeImports))
    if (local.imports[key]) delete local.typeImports[key];
  if (source.endsWith('/date.dart')) {
    local.classTypeWitnesses = {
      ...old.classTypeWitnesses,
      classes: rows
        .filter((r: any) =>
          ['CalendarDelegate', 'GregorianCalendarDelegate', 'DateTimeRange'].includes(r.symbol),
        )
        .map((r: any) => r.ir.reference.id),
    };
    local.runtimeTypeApplications = [];
  } else {
    local.genericFunctionValues = { policy: 'checked-generic-function-type-witness' };
    delete local.numericFunctions;
  }
  if (source.endsWith('/calendar_date_picker.dart'))
    local.lexicalNullReads = { policy: 'single-local-property-read' };
  local.adapters = { ...recipe.adapters };
  local.memberBindings = { ...recipe.memberBindings };
  for (const row of ir.records)
    if (row.source !== source && row.ir?.reference && ['class', 'enum'].includes(row.ir.kind)) {
      local.imports[row.ir.name] =
        './generated/' + row.source.split('/').at(-1).replace('.dart', '.ts');
      for (const method of row.ir.methods ?? [])
        if (method.reference) {
          if (method.getter || method.setter)
            local.memberBindings[method.reference.id] = method.name;
          else
            local.adapters[method.reference.id] = {
              target: method.static ? row.ir.name + '.' + method.name : method.name,
              kind: 'call',
              ...(method.static ? {} : { receiver: 'target' }),
            };
        }
      for (const field of row.ir.fields ?? [])
        if (field.reference) local.memberBindings[field.reference.id] = field.name;
      if (
        row.ir.kind === 'class' &&
        row.ir.constructor?.reference &&
        !row.ir.typeParameters?.length
      )
        local.adapters[row.ir.constructor.reference.id] = {
          target: row.ir.name,
          kind: 'new',
          namedArguments: row.ir.constructor.parameters.some((p: any) => !p.named)
            ? 'trailing-options'
            : 'options',
        };
    }
  for (const row of rows) if (!row.ir) errors.push({ symbol: row.symbol, error: row.diagnostic });
  for (const row of rows) {
    delete local.imports[row.symbol];
    delete local.typeImports[row.symbol];
  }
  for (const key of Object.keys(local.typeImports))
    if (local.imports[key]) delete local.typeImports[key];
  try {
    if (process.argv.includes('--verify'))
      verifyDateCompiler(
        rows.filter((r: any) => r.ir).map((r: any) => r.ir),
        {
          ...local,
          source,
          sha256: rows[0].sourceSha256,
          symbols: rows.map((r: any) => r.symbol),
          destination: outputRoot + '/' + path.basename(source, '.dart') + '.generated.ts',
        },
      );
    let output = emitDart(
      rows.filter((r: any) => r.ir).map((r: any) => r.ir),
      {
        ...local,
        source,
        sha256: rows[0].sourceSha256,
        symbols: rows.map((r: any) => r.symbol),
        destination: outputRoot + '/' + path.basename(source, '.dart') + '.generated.ts',
      },
    ).replace(
      /from "([^"]+)";/g,
      (_match, module) => 'from ' + JSON.stringify(normalizeImport(module)) + ';',
    );
    if (source.endsWith('/calendar_date_picker.dart'))
      output += `
// Exact generated owners for inherited lookup and native regular-grid parameters.
import { registerDateFocusedType } from "../../internal/date/source-host.ts";
import { registerNativeRegularGridDelegate } from "@nelyx/core/internal/framework/rendering/native-grid";
registerDateFocusedType(_FocusedDate);
// Exact lowering of _DayPickerGridDelegate.getLayout above. Context controls
// numeric policy; actual viewport dimensions and tile placement stay in Core.
registerNativeRegularGridDelegate(_DayPickerGridDelegate.prototype, (delegate) => {
  const textScaleFactor = MediaQuery.textScalerOf(delegate.context).clamp({ maxScaleFactor: 3 }).scale(_fontSizeToScale) / _fontSizeToScale;
  const rowHeight = SourceDateTheme.of(delegate.context).useMaterial3 &&
    scrollbarRawObjectEquals(dateOrientationOf(delegate.context), 'portrait')
    ? _dayPickerRowHeightM3 : _dayPickerRowHeightM2;
  return { columns: DateTime.daysPerWeek, rows: _maxDayPickerRowCount + 1,
    maximumRowExtent: textScaleFactor > 1.3 ? (textScaleFactor - 1) * 30 + rowHeight : rowHeight };
});
registerNativeRegularGridDelegate(_YearPickerGridDelegate.prototype);
`;
    const enums = rows.filter((row: any) => row.ir?.kind === 'enum');
    if (enums.length)
      output +=
        '\nimport { registerDateEnumValues } from "../../internal/date/source-values.ts";\n' +
        enums.map((row: any) => `registerDateEnumValues(${row.ir.name});`).join('\n') +
        '\n';
    const formatted = await format('generated.ts', output, formatOptions);
    if (formatted.errors.length) throw Error('Generated TypeScript formatting failed');
    output = formatted.code;
    passed += rows.length;
    outputs.set(outputRoot + '/' + path.basename(source, '.dart') + '.generated.ts', output);
  } catch (e) {
    errors.push({ symbol: source, error: String(e) });
  }
}
console.log(JSON.stringify({ count: ir.records.length, passed, errors }, null, 2));
if (errors.length) process.exitCode = 1;
else if (process.argv.includes('--check')) {
  for (const [file, output] of outputs)
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== output)
      throw Error('Generated source differs: ' + file);
} else if (process.argv.includes('--write')) {
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const [file, output] of outputs) fs.writeFileSync(file, output);
}
if (!errors.length && process.argv.includes('--verify'))
  verifyDatePicker(
    ir,
    root,
    path.resolve(argument('--source') ?? 'reference/flutter-master'),
    argument('--dart') ?? process.env.DART_EXECUTABLE ?? 'dart',
  );
