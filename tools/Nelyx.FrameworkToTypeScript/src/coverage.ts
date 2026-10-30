// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';
import path from 'node:path';
import { readFile, readdir, writeFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { freshScratch, within } from './paths.ts';
import { selectionId } from './selection.ts';
import type { Manifest } from './selection.ts';
import {
  readInventory,
  reviewedDestinationsMatch,
  retainedReviewFields,
} from './coverage-format.ts';
import { readBatchEvidence } from './batch-evidence.ts';
import type { Declaration, DestinationIdentity } from './coverage-format.ts';
const [input, repository, flutterSource, output] = process.argv.slice(2);
if (!input || !repository || !flutterSource || !output)
  throw new Error(
    'bun src/coverage.ts <resolved-dart-inventory.json> <nelyx-repository-root> <pinned-flutter-checkout> <fresh-scratch-directory>',
  );
const root = await realpath(repository),
  target = await freshScratch(output);
const { inventory, cached } = readInventory(JSON.parse(await readFile(input, 'utf8')));
const frontendHash = createHash('sha256')
  .update(await readFile(path.resolve(import.meta.dir, '../dart/bin/inventory.dart')))
  .digest('hex');
if (inventory.source.toolFrontendSha256 !== frontendHash)
  throw new Error(
    'Dart frontend changed or lacks identity; regenerate the resolved analyzer inventory',
  );
const dependencyLock = createHash('sha256')
  .update(await readFile(path.resolve(import.meta.dir, '../dart/pubspec.lock')))
  .digest('hex');
if (cached && inventory.source.toolDependencyLockSha256 !== dependencyLock)
  throw new Error('Dart dependencies changed; regenerate the resolved analyzer inventory');
const packageFile = path.join(root, 'Nelyx/package.json'),
  pkg = JSON.parse(await readFile(packageFile, 'utf8')) as {
    version: string;
    exports: Record<string, { default: string }>;
  };
const workspace = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
  workspaces: string[];
};
const owners = await Promise.all(
  workspace.workspaces.map(async (directory) => ({
    directory,
    manifest: JSON.parse(await readFile(path.join(root, directory, 'package.json'), 'utf8')) as {
      name: string;
      exports?: Record<string, { default?: string }>;
    },
  })),
);
const packages = owners.filter(
  (owner) => owner.manifest.exports && awaitableConfig(owner.directory),
);
function awaitableConfig(directory: string): boolean {
  return ts.sys.fileExists(path.join(root, directory, 'tsconfig.build.json'));
}
const configFile = path.join(root, 'Nelyx/tsconfig.build.json'),
  config = ts.readConfigFile(configFile, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  path.dirname(configFile),
  { noEmit: true },
  configFile,
);
const packageConfigs = packages.map((owner) =>
  ts.parseJsonConfigFileContent(
    ts.readConfigFile(path.join(root, owner.directory, 'tsconfig.build.json'), ts.sys.readFile)
      .config,
    ts.sys,
    path.join(root, owner.directory),
  ),
);
const packageSources = packageConfigs.flatMap((config) => config.fileNames),
  libs = [...new Set(packageConfigs.flatMap((config) => config.options.lib ?? []))];
const types = [...new Set(packageConfigs.flatMap((config) => config.options.types ?? []))];
const jsx = packageConfigs.find((config) => config.options.jsx !== undefined)?.options.jsx;
const program = ts.createProgram([...new Set([...parsed.fileNames, ...packageSources])], {
    ...parsed.options,
    rootDir: root,
    lib: libs,
    types,
    ...(jsx === undefined ? {} : { jsx }),
  }),
  checker = program.getTypeChecker();
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length)
  throw new Error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (x) => x,
      getNewLine: () => '\n',
    }),
  );
interface TsLocation {
  file: string;
  line: number;
  sha256: string;
}
interface TsSymbol extends TsLocation {
  module: string;
  export: string;
  local?: string;
  representation?: 'class-factory';
  anchorSource?: TsLocation;
  signature: string;
  stringLiterals?: readonly string[];
  members: (TsLocation & {
    name: string;
    static: boolean;
    access: 'public' | 'protected' | 'private';
    signature: string;
    write?: TsLocation & { access: 'public' | 'protected' | 'private' };
  })[];
}
const sourceLocations = new Map<ts.SourceFile, { file: string; sha256: string }>();
function sourceLocation(node: ts.Node): TsLocation {
  const source = node.getSourceFile();
  let location = sourceLocations.get(source);
  if (!location) {
    location = {
      file: path.relative(root, source.fileName).replaceAll('\\', '/'),
      sha256: createHash('sha256').update(source.text).digest('hex'),
    };
    sourceLocations.set(source, location);
  }
  return { ...location, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 };
}
const candidates = new Map<string, TsSymbol[]>();
const standaloneExecutables = new Map<string, TsSymbol>();
const inOwnedSource = (file: string) =>
  packages.some((owner) => within(path.join(root, owner.directory, 'src'), file));
for (const owner of packages)
  for (const [subpath, entry] of Object.entries(owner.manifest.exports!)) {
    if (!entry.default?.startsWith('./dist/') || !entry.default.endsWith('.js')) continue;
    const ownerSource = path.join(root, owner.directory, 'src');
    const baseFile = path.resolve(
      root,
      owner.directory,
      entry.default.replace('./dist/', './src/').replace(/\.js$/, '.ts'),
    );
    const file = ts.sys.fileExists(baseFile) ? baseFile : baseFile + 'x';
    if (!within(ownerSource, file)) throw new Error('Public export escapes owning package source');
    const source = program.getSourceFile(file);
    if (!source) throw new Error(`Public export has no compiled source: ${subpath}`);
    const module = checker.getSymbolAtLocation(source);
    if (!module) throw new Error(`Public export has no module symbol: ${subpath}`);
    const exported = checker.getExportsOfModule(module);
    const symbols = exported.map((symbol) => ({
      symbol,
      anchor: symbol.name,
      local: undefined as string | undefined,
      upstream: undefined as string | undefined,
      representation: undefined as 'class-factory' | undefined,
      anchorSource: undefined as TsLocation | undefined,
    }));
    // Local dependencies require a public module anchor, a qualified private
    // upstream identity and an actual compiler declaration in that module.
    const localMappings: {
      subpath: string;
      anchor: string;
      local: string;
      upstream: string;
      file?: string;
    }[] = [
      {
        subpath: './framework/painting/alignment',
        anchor: 'AlignmentGeometry',
        local: 'MixedAlignment',
        upstream: 'package:flutter/src/painting/alignment.dart::_MixedAlignment',
      },
      {
        subpath: './framework/painting/border-radius',
        anchor: 'BorderRadiusGeometry',
        local: 'MixedBorderRadius',
        upstream: 'package:flutter/src/painting/border_radius.dart::_MixedBorderRadius',
      },
      {
        subpath: './framework/painting/edge-insets',
        anchor: 'EdgeInsetsGeometry',
        local: 'MixedEdgeInsets',
        upstream: 'package:flutter/src/painting/edge_insets.dart::_MixedEdgeInsets',
      },
      {
        subpath: './framework/rendering/rotated-box',
        anchor: 'RenderRotatedBox',
        local: '_kQuarterTurnsInRadians',
        upstream: 'package:flutter/src/rendering/rotated_box.dart::_kQuarterTurnsInRadians',
      },
      ...['_Visibility', '_RenderVisibility'].map((local) => ({
        subpath: './framework/widgets/visibility',
        anchor: 'Visibility',
        local,
        upstream: 'package:flutter/src/widgets/indexed_stack.dart::' + local,
      })),
      {
        subpath: './framework/widgets/visibility',
        anchor: 'Visibility',
        local: '_VisibilityScope',
        file: 'framework/widgets/visibility-scope.ts',
        upstream: 'package:flutter/src/widgets/indexed_stack.dart::_VisibilityScope',
      },
      ...['_RawIndexedStack', '_IndexedStackElement'].map((local) => ({
        subpath: './framework/widgets/indexed-stack',
        anchor: 'IndexedStack',
        local,
        upstream: 'package:flutter/src/widgets/indexed_stack.dart::' + local,
      })),
    ];
    localMappings.push(
      ...['_LayoutBuilderElement', '_RenderLayoutBuilder'].map((local) => ({
        subpath: './framework/widgets/layout-builder',
        anchor: 'LayoutBuilder',
        local,
        upstream: 'package:flutter/src/widgets/layout_builder.dart::' + local,
      })),
    );
    localMappings.push({
      subpath: './framework/painting/binding',
      anchor: 'PaintingBinding',
      local: '_SystemFontsNotifier',
      upstream: 'package:flutter/src/painting/binding.dart::_SystemFontsNotifier',
    });
    localMappings.push(
      ...['_ErrorDiagnostic', '_FlutterErrorDetailsNode'].map((local) => ({
        subpath:
          local === '_ErrorDiagnostic' ? './foundation/diagnostics' : './foundation/assertions',
        anchor: local === '_ErrorDiagnostic' ? 'ErrorSummary' : 'FlutterErrorDetails',
        local,
        upstream: 'package:flutter/src/foundation/assertions.dart::' + local,
      })),
    );
    localMappings.push(
      {
        subpath: './foundation/diagnostic-properties',
        anchor: 'DoubleProperty',
        local: '_NumProperty',
        upstream: 'package:flutter/src/foundation/diagnostics.dart::_NumProperty',
      },
      {
        subpath: './foundation/diagnostics-text',
        anchor: 'TextTreeRenderer',
        local: '_PrefixedStringBuilder',
        upstream: 'package:flutter/src/foundation/diagnostics.dart::_PrefixedStringBuilder',
      },
    );
    localMappings.push({
      subpath: './foundation/diagnostics-serialization',
      anchor: 'DiagnosticsSerializationDelegate',
      local: '_DefaultDiagnosticsSerializationDelegate',
      upstream:
        'package:flutter/src/foundation/diagnostics.dart::_DefaultDiagnosticsSerializationDelegate',
    });
    localMappings.push({
      subpath: './framework/widgets/framework',
      anchor: 'Element',
      local: '_ElementDiagnosticableTreeNode',
      upstream: 'package:flutter/src/widgets/framework.dart::_ElementDiagnosticableTreeNode',
    });
    localMappings.push(
      ...['_NoDefaultValue', '_NodesToJsonifyStack'].map((local) => ({
        subpath: './foundation/diagnostics',
        anchor: local === '_NoDefaultValue' ? 'kNoDefaultValue' : 'DiagnosticsNode',
        local,
        upstream: 'package:flutter/src/foundation/diagnostics.dart::' + local,
      })),
      ...['_WordWrapParseMode', '_isSingleLine'].map((local) => ({
        subpath: './foundation/diagnostics-text',
        anchor: 'TextTreeRenderer',
        local,
        upstream: 'package:flutter/src/foundation/diagnostics.dart::' + local,
      })),
    );
    localMappings.push(
      {
        subpath: './foundation/basic-types',
        anchor: 'CachingIterable',
        local: '_LazyListIterator',
        upstream: 'package:flutter/src/foundation/basic_types.dart::_LazyListIterator',
      },
      ...[
        '_WordWrapParseMode',
        '_indentPattern',
        '_kDebugPrintCapacity',
        '_kDebugPrintPauseTime',
      ].map((local) => ({
        subpath: './foundation/print',
        anchor: 'DebugPrintController',
        local,
        upstream: 'package:flutter/src/foundation/print.dart::' + local,
      })),
    );
    localMappings.push({
      subpath: './foundation/platform',
      anchor: 'FoundationPlatform',
      local: '_operatingSystemToTargetPlatform',
      upstream:
        'package:flutter/src/foundation/_platform_web.dart::_operatingSystemToTargetPlatform',
    });
    localMappings.push({
      subpath: './services/message-codecs',
      anchor: 'StandardMessageCodec',
      local: '_writeBufferStartCapacity',
      upstream: 'package:flutter/src/services/message_codecs.dart::_writeBufferStartCapacity',
    });
    localMappings.push(
      ...['_ChannelCallbackRecord', '_StoredMessage', '_Channel'].map((local) => ({
        subpath: './ui/channel-buffers',
        anchor: 'ChannelBuffers',
        local,
        upstream: 'dart:ui::' + local,
      })),
    );
    localMappings.push(
      ...[
        '_PlatformChannelStats',
        '_ProfiledBinaryMessenger',
        '_profiledBinaryMessengers',
        '_profilePlatformChannelsRate',
        '_findBinaryMessenger',
      ].map((local) => ({
        subpath: './services/platform-channel',
        anchor: 'MethodChannel',
        local,
        upstream: 'package:flutter/src/services/platform_channel.dart::' + local,
      })),
    );
    localMappings.push({
      subpath: './framework/animation/curves',
      anchor: 'Curves',
      local: 'bounce',
      file: 'framework/animation/bounce.ts',
      upstream: 'package:flutter/src/animation/curves.dart::_bounce',
    });
    localMappings.push(
      ...[
        'AnimatedContainer',
        'AnimatedPadding',
        'AnimatedAlign',
        'AnimatedPositioned',
        'AnimatedPositionedDirectional',
        'AnimatedScale',
        'AnimatedRotation',
        'AnimatedSlide',
        'AnimatedOpacity',
        'SliverAnimatedOpacity',
        'AnimatedDefaultTextStyle',
        'AnimatedFractionallySizedBox',
      ].map((widget) => ({
        subpath: './framework/widgets/implicit-animations',
        anchor: widget,
        local: widget + 'State',
        upstream: 'package:flutter/src/widgets/implicit_animations.dart::_' + widget + 'State',
      })),
    );
    localMappings.push(
      {
        subpath: './framework/widgets/container',
        anchor: 'Container',
        local: 'DecorationClipper',
        upstream: 'package:flutter/src/widgets/container.dart::_DecorationClipper',
      },
      {
        subpath: './framework/widgets/basic',
        anchor: 'ColoredBox',
        local: 'RenderColoredBox',
        upstream: 'package:flutter/src/widgets/basic.dart::_RenderColoredBox',
      },
      {
        subpath: './framework/rendering/clip',
        anchor: 'RenderClipPath',
        local: 'RenderCustomClip',
        upstream: 'package:flutter/src/rendering/proxy_box.dart::_RenderCustomClip',
      },
    );
    localMappings.push(
      ...['WidgetSpanParentData', 'AutoScaleInlineWidget', 'RenderScaledInlineWidget'].map(
        (local) => ({
          subpath: './framework/widgets/widget-span',
          anchor: 'WidgetSpan',
          local,
          upstream: 'package:flutter/src/widgets/widget_span.dart::_' + local,
        }),
      ),
    );
    localMappings.push({
      subpath: './framework/painting/text-painter',
      anchor: 'TextPainter',
      local: 'TextPainterLayoutCache',
      upstream: 'package:flutter/src/painting/text_painter.dart::_TextPainterLayoutCacheWithOffset',
    });
    for (const binding of localMappings)
      if (
        subpath === binding.subpath &&
        exported.some((symbol) => symbol.name === binding.anchor)
      ) {
        const localFile = binding.file ? path.resolve(ownerSource, binding.file) : file;
        if (!within(ownerSource, localFile)) throw new Error('Local source escapes package');
        const localSource = program.getSourceFile(localFile);
        if (!localSource) throw new Error('Local source is not compiled');
        const declaration =
          (localSource.statements.find(
            (node) =>
              (ts.isClassDeclaration(node) ||
                ts.isTypeAliasDeclaration(node) ||
                ts.isFunctionDeclaration(node)) &&
              node.name?.text === binding.local,
          ) as
            | ts.ClassDeclaration
            | ts.TypeAliasDeclaration
            | ts.FunctionDeclaration
            | undefined) ??
          localSource.statements
            .filter(ts.isVariableStatement)
            .filter(
              (node) =>
                !node.modifiers?.some(
                  (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
                ) && (node.declarationList.flags & ts.NodeFlags.Const) !== 0,
            )
            .flatMap((node) => node.declarationList.declarations)
            .find((node) => ts.isIdentifier(node.name) && node.name.text === binding.local);
        const symbol = declaration?.name && checker.getSymbolAtLocation(declaration.name);
        const anchor = exported.find((symbol) => symbol.name === binding.anchor)!,
          anchorDeclaration = anchor.valueDeclaration ?? anchor.declarations?.[0];
        if (symbol && !exported.some((entry) => entry === symbol))
          symbols.push({
            symbol,
            anchor: binding.anchor,
            local: binding.local,
            upstream: binding.upstream,
            representation: undefined,
            anchorSource:
              binding.file && anchorDeclaration ? sourceLocation(anchorDeclaration) : undefined,
          });
      }
    // These public Dart mixins are real TypeScript class factories. Resolve the
    // runtime class inside its named exported factory, never an interface or a
    // same-named class elsewhere. This proves identity only, not compatibility.
    for (const binding of [
      {
        subpath: './framework/rendering/object',
        anchor: 'ContainerParentDataMixin',
        local: 'LinkedParentData',
        upstream: 'package:flutter/src/rendering/object.dart::ContainerParentDataMixin',
      },
      {
        subpath: './framework/rendering/object',
        anchor: 'RelayoutWhenSystemFontsChangeMixin',
        local: 'SystemFontsRelayoutRenderObject',
        upstream: 'package:flutter/src/rendering/object.dart::RelayoutWhenSystemFontsChangeMixin',
      },
      {
        subpath: './framework/rendering/paragraph',
        anchor: 'RenderInlineChildrenContainerDefaults',
        local: 'InlineChildrenRender',
        upstream:
          'package:flutter/src/rendering/paragraph.dart::RenderInlineChildrenContainerDefaults',
      },
      {
        subpath: './framework/rendering/layout-callback',
        anchor: 'RenderObjectWithLayoutCallbackMixin',
        local: 'LayoutCallbackRender',
        upstream: 'package:flutter/src/rendering/object.dart::RenderObjectWithLayoutCallbackMixin',
      },
      {
        subpath: './framework/widgets/layout-builder',
        anchor: 'RenderAbstractLayoutBuilderMixin',
        local: 'AbstractLayoutRender',
        upstream:
          'package:flutter/src/widgets/layout_builder.dart::RenderAbstractLayoutBuilderMixin',
      },
      {
        subpath: './foundation/diagnosticable',
        anchor: 'Diagnosticable',
        local: 'DiagnosticableValue',
        upstream: 'package:flutter/src/foundation/diagnostics.dart::Diagnosticable',
      },
      {
        subpath: './foundation/diagnosticable',
        anchor: 'DiagnosticableTreeMixin',
        local: 'TreeDiagnosticableValue',
        upstream: 'package:flutter/src/foundation/diagnostics.dart::DiagnosticableTreeMixin',
      },
      {
        subpath: './framework/animation/listener-helpers',
        anchor: 'AnimationLazyListenerMixin',
        local: 'Lazy',
        upstream: 'package:flutter/src/animation/listener_helpers.dart::AnimationLazyListenerMixin',
      },
      {
        subpath: './framework/animation/listener-helpers',
        anchor: 'AnimationEagerListenerMixin',
        local: 'Eager',
        upstream:
          'package:flutter/src/animation/listener_helpers.dart::AnimationEagerListenerMixin',
      },
      {
        subpath: './framework/animation/listener-helpers',
        anchor: 'AnimationLocalListenersMixin',
        local: 'Local',
        upstream:
          'package:flutter/src/animation/listener_helpers.dart::AnimationLocalListenersMixin',
      },
      {
        subpath: './framework/animation/listener-helpers',
        anchor: 'AnimationLocalStatusListenersMixin',
        local: 'LocalStatus',
        upstream:
          'package:flutter/src/animation/listener_helpers.dart::AnimationLocalStatusListenersMixin',
      },
      {
        subpath: './framework/rendering/animated-opacity',
        anchor: 'RenderAnimatedOpacityMixin',
        local: 'AnimatedOpacity',
        upstream: 'package:flutter/src/rendering/proxy_box.dart::RenderAnimatedOpacityMixin',
      },
    ])
      if (subpath === binding.subpath) {
        const factory = source.statements.find(
          (node): node is ts.FunctionDeclaration =>
            ts.isFunctionDeclaration(node) &&
            node.name?.text === binding.anchor &&
            exported.some((symbol) => symbol.name === binding.anchor),
        );
        const declarations: ts.ClassDeclaration[] = [];
        function visit(node: ts.Node): void {
          if (ts.isClassDeclaration(node) && node.name?.text === binding.local)
            declarations.push(node);
          ts.forEachChild(node, visit);
        }
        if (factory?.body) visit(factory.body);
        if (!factory || declarations.length !== 1)
          throw new Error(`Missing or ambiguous mixin runtime class: ${binding.anchor}`);
        const symbol = checker.getSymbolAtLocation(declarations[0]!.name!);
        if (!symbol) throw new Error('Mixin runtime class has no compiler symbol');
        symbols.push({
          symbol,
          anchor: binding.anchor,
          local: binding.local,
          upstream: binding.upstream,
          representation: 'class-factory',
          anchorSource: sourceLocation(factory),
        });
      }
    for (const { symbol, anchor, local, upstream, representation, anchorSource } of symbols) {
      if (symbol.flags & ts.SymbolFlags.Alias) {
        // A provider's local `export default Component` is not a Flutter named
        // declaration or a barrel. Do not turn that alias into a name match.
        if (symbol.name === 'default' && source.statements.some(ts.isExportAssignment)) continue;
        throw new Error(`Re-export/barrel is not allowed: ${subpath}/${symbol.name}`);
      }
      const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
      if (!declaration) continue;
      const type = checker.getDeclaredTypeOfSymbol(symbol),
        value = checker.getTypeOfSymbolAtLocation(symbol, declaration);
      const members: TsSymbol['members'] = [];
      for (const [staticMember, properties] of [
        [false, type.getProperties()],
        [true, value.getProperties()],
      ] as const)
        for (const property of properties) {
          if (property.name === 'prototype') continue;
          const node = property.valueDeclaration ?? property.declarations?.[0];
          if (!node) continue;
          if (!inOwnedSource(node.getSourceFile().fileName)) continue;
          const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
          const declarationName = (node as ts.NamedDeclaration).name;
          const name =
            declarationName && ts.isPrivateIdentifier(declarationName)
              ? declarationName.getText()
              : declarationName &&
                  ts.isComputedPropertyName(declarationName) &&
                  declarationName.expression.getText() === 'Symbol.iterator'
                ? '[Symbol.iterator]'
                : property.name;
          const setter = property.declarations?.find(ts.isSetAccessorDeclaration),
            writeNode =
              setter ??
              ((ts.isPropertyDeclaration(node) ||
                ts.isPropertySignature(node) ||
                ts.isParameter(node)) &&
              !modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
                ? node
                : undefined);
          const writeModifiers =
            writeNode && ts.canHaveModifiers(writeNode) ? ts.getModifiers(writeNode) : undefined;
          const write = writeNode
            ? {
                ...sourceLocation(writeNode),
                access: writeModifiers?.some(
                  (modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword,
                )
                  ? ('private' as const)
                  : writeModifiers?.some(
                        (modifier) => modifier.kind === ts.SyntaxKind.ProtectedKeyword,
                      )
                    ? ('protected' as const)
                    : ('public' as const),
              }
            : undefined;
          members.push({
            ...sourceLocation(node),
            name,
            static: staticMember,
            access:
              (declarationName && ts.isPrivateIdentifier(declarationName)) ||
              modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword)
                ? 'private'
                : modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ProtectedKeyword)
                  ? 'protected'
                  : 'public',
            signature: checker.typeToString(
              checker.getTypeOfSymbolAtLocation(property, node),
              node,
              ts.TypeFormatFlags.NoTruncation,
            ),
            ...(write ? { write } : {}),
          });
        }
      for (const signature of value.getConstructSignatures())
        members.push({
          ...sourceLocation(signature.getDeclaration() ?? declaration),
          name: 'new',
          static: true,
          access: 'public',
          signature: checker.signatureToString(
            signature,
            undefined,
            ts.TypeFormatFlags.NoTruncation,
          ),
        });
      const literalTypes = type.isUnion() ? type.types : [type];
      const stringLiterals =
        ts.isTypeAliasDeclaration(declaration) &&
        literalTypes.every((type) => type.isStringLiteral())
          ? literalTypes.map((type) => (type as ts.StringLiteralType).value)
          : undefined;
      const record: TsSymbol = {
        module: `${owner.manifest.name}/${subpath.slice(2)}`,
        export: anchor,
        ...(local ? { local } : {}),
        ...(representation ? { representation } : {}),
        ...sourceLocation(declaration),
        ...(anchorSource ? { anchorSource } : {}),
        signature: checker.typeToString(value, declaration, ts.TypeFormatFlags.NoTruncation),
        members,
        ...(stringLiterals ? { stringLiterals } : {}),
      };
      const key = upstream ?? symbol.name,
        entries = candidates.get(key) ?? [];
      entries.push(record);
      candidates.set(key, entries);
      if (
        record.module === '@nelyx/core/foundation/binding' &&
        record.export === 'initializeFoundationBindings' &&
        !record.local
      ) {
        if (!ts.isFunctionDeclaration(declaration))
          throw new Error('Foundation binding adapter must be an actual exported function');
        standaloneExecutables.set(
          'package:flutter/src/foundation/binding.dart::BindingBase._initListenable:METHOD',
          record,
        );
      }
    }
  }
const aliases: Record<string, string> = {
  SchedulerBinding: 'FrameScheduler',
  _RRectLike: 'RRect',
  _JsonDiagnosticsNode: 'JsonDiagnosticsNode',
  _DefaultBinaryMessenger: 'DefaultBinaryMessenger',
};
// The explicit host engine context combines each public interface with its
// native implementation owner. These identities remain partial adaptations;
// unmatched native FFI members and implicit factory behavior stay missing.
const qualifiedAliases: Readonly<Record<string, { name: string; module: string }>> = {
  'package:flutter/src/semantics/semantics.dart::SemanticsNode': {
    name: 'SemanticsNode',
    module: '@nelyx/core/framework/semantics/semantics',
  },
  'dart:ui::SemanticsAction': {
    name: 'SemanticsAction',
    module: '@nelyx/core/ui/semantics-action',
  },
  'package:flutter/src/rendering/paragraph.dart::RenderParagraph': {
    name: 'RenderParagraph',
    module: '@nelyx/core/framework/rendering/paragraph',
  },
  'dart:ui::_NativeParagraph': { name: 'Paragraph', module: '@nelyx/core/ui/paragraph' },
  'dart:ui::_NativeParagraphBuilder': {
    name: 'ParagraphBuilder',
    module: '@nelyx/core/ui/paragraph-builder',
  },
};
// These identify real destination members only. They never imply compatible behavior or signatures.
const memberAliases: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Key: { '==': 'equals' },
  ValueKey: { '==': 'equals' },
  ObjectKey: { '==': 'equals' },
  GlobalObjectKey: { '==': 'equals' },
  ObserverList: { iterator: '[Symbol.iterator]' },
  HashedObserverList: { iterator: '[Symbol.iterator]' },
  IndexedSlot: { '==': 'equals' },
  ParagraphConstraints: { '==': 'equals' },
  LineMetrics: { '==': 'equals' },
  GlyphInfo: { '==': 'equals' },
  PlaceholderDimensions: { '==': 'equals' },
  PlaceholderSpanIndexSemanticsTag: { '==': 'equals' },
  SemanticsFlags: { '==': 'equals' },
  CustomSemanticsAction: { '==': 'equals' },
  SemanticsHintOverrides: { '==': 'equals' },
  SemanticsData: { '==': 'equals' },
  TickerModeData: { '==': 'equals' },
  BoxConstraints: {
    '==': 'equals',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncatingDivide',
    '%': 'modulo',
  },
  StackFrame: { '==': 'equals' },
  DoubleProperty: { lazy: 'lazyNumber' },
  _NumProperty: { lazy: 'initializeLazy' },
  WriteBuffer: { _: 'new' },
  _DefaultBinaryMessenger: { _: 'new' },
  DiagnosticableNode: { _cachedBuilder: 'cached' },
  DiagnosticsBlock: { _children: 'children', _properties: 'properties', _description: 'text' },
  DiagnosticsProperty: {
    _computeValue: 'compute',
    _defaultLevel: 'defaultLevel',
    _description: 'description',
    _exception: 'failure',
    _value: 'stored',
    _valueComputed: 'computed',
  },
  TextTreeRenderer: {
    _maxDescendentsTruncatableNode: 'maxDescendentsTruncatableNode',
    _minLevel: 'minLevel',
    _wrapWidth: 'wrapWidth',
    _wrapWidthProperties: 'wrapWidthProperties',
  },
  _PrefixedStringBuilder: {
    _wordWrapLine: 'wordWrapLine',
    _finalizeLine: 'finalizeLine',
    _updatePrefix: 'updatePrefix',
    _writeLine: 'writeLine',
    _getCurrentPrefix: 'currentPrefix',
    _buffer: 'buffer',
    _currentLine: 'current',
    _wrappableRanges: 'ranges',
    _numLines: 'numLines',
    _nextPrefixOtherLines: 'nextPrefix',
    _prefixOtherLines: 'prefix',
  },
  Radius: {
    '==': 'equals',
    'unary-': 'negate',
    '+': 'add',
    '-': 'subtract',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  Rect: { '==': 'equals' },
  RRect: { '==': 'equals' },
  _RRectLike: { '==': 'equals' },
  OffsetBase: {
    _dx: 'horizontal',
    _dy: 'vertical',
    '==': 'equals',
    '<': 'lessThan',
    '<=': 'lessThanOrEqual',
    '>': 'greaterThan',
    '>=': 'greaterThanOrEqual',
  },
  Offset: {
    '==': 'equals',
    'unary-': 'negate',
    '+': 'add',
    '-': 'subtract',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
    '&': 'and',
  },
  Size: {
    '==': 'equals',
    '+': 'add',
    '-': 'subtract',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  Vector2: {
    _v2storage: '#values',
    '==': 'equals',
    'unary-': 'unaryMinus',
    '+': 'plus',
    '-': 'minus',
    '*': 'times',
    '/': 'divided',
    '[]': 'at',
    '[]=': 'setAt',
  },
  Vector3: {
    _v3storage: '#values',
    '==': 'equals',
    'unary-': 'unaryMinus',
    '+': 'plus',
    '-': 'minus',
    '*': 'times',
    '/': 'divided',
    '[]': 'at',
    '[]=': 'setAt',
  },
  Vector4: {
    _v4storage: '#values',
    '==': 'equals',
    'unary-': 'unaryMinus',
    '+': 'plus',
    '-': 'minus',
    '*': 'times',
    '/': 'divided',
    '[]': 'at',
    '[]=': 'setAt',
  },
  Matrix2: {
    _m2storage: '#values',
    '==': 'equals',
    'unary-': 'unaryMinus',
    '+': 'plus',
    '-': 'minus',
    '*': 'times',
    '[]': 'at',
    '[]=': 'setAt',
  },
  Matrix3: {
    _m3storage: '#values',
    '==': 'equals',
    'unary-': 'unaryMinus',
    '+': 'plus',
    '-': 'minus',
    '*': 'times',
    '[]': 'at',
    '[]=': 'setAt',
  },
  Matrix4: {
    _m4storage: '#values',
    '==': 'equals',
    'unary-': 'unaryMinus',
    '+': 'plus',
    '-': 'minus',
    '*': 'times',
    '[]': 'at',
    '[]=': 'setAt',
  },
  Quaternion: {
    _qStorage: '#values',
    _: 'zero',
    '==': 'equals',
    'unary-': 'unaryMinus',
    '+': 'plus',
    '-': 'minus',
    '*': 'times',
    '[]': 'at',
    '[]=': 'setAt',
  },
  BorderRadiusGeometry: {
    '==': 'equals',
    'unary-': 'negate',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  BorderRadius: {
    'unary-': 'negate',
    '+': 'add',
    '-': 'subtract',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  BorderRadiusDirectional: {
    'unary-': 'negate',
    '+': 'add',
    '-': 'subtract',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  _MixedBorderRadius: {
    'unary-': 'negate',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  EdgeInsetsGeometry: {
    '==': 'equals',
    'unary-': 'negate',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  EdgeInsets: {
    '-': 'minus',
    '+': 'plus',
    'unary-': 'negate',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  EdgeInsetsDirectional: {
    '-': 'minus',
    '+': 'plus',
    'unary-': 'negate',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  _MixedEdgeInsets: {
    'unary-': 'negate',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  AlignmentGeometry: {
    '==': 'equals',
    'unary-': 'negate',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  Alignment: {
    'unary-': 'negate',
    '+': 'plus',
    '-': 'subtract',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  AlignmentDirectional: {
    'unary-': 'negate',
    '+': 'plus',
    '-': 'subtract',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  _MixedAlignment: {
    'unary-': 'negate',
    '*': 'multiply',
    '/': 'divide',
    '~/': 'truncateDivide',
    '%': 'modulo',
  },
  RenderTransform: {
    _effectiveTransform: 'effective',
    _origin: 'pivot',
    _alignment: 'aligned',
    _textDirection: 'textFlow',
    _transform: 'value',
  },
  RelativeRect: { '==': 'equals' },
  RenderTable: { setChildren: 'setCellRows' },
  CustomClipper: { _reclip: 'reclip' },
  RenderClipRect: { _defaultClip: 'defaultClip' },
  RenderClipRRect: { _defaultClip: 'defaultClip' },
  RenderClipOval: { _defaultClip: 'defaultClip' },
};
function stage(item: Declaration): string {
  const source = item.source.file,
    domain = source.split('/src/')[1]?.split('/')[0] ?? '';
  if (
    /^(?:CustomClipper|_RenderCustomClip|(?:Render)?Clip(?:Rect|RRect|Oval|Path|RSuperellipse))(?:\.|$)/.test(
      item.symbol,
    )
  )
    return 'W6-05';
  if (item.library === 'dart:ui') {
    if (/^(Text|Paragraph|Font|LineMetrics|Glyph|Strut)/.test(item.symbol)) return 'W6-06';
    if (/^(Pointer|Gesture)/.test(item.symbol)) return 'W6-08';
    if (/^(KeyData|KeyEvent|KeyEventType)/.test(item.symbol)) return 'W6-09';
    if (/^(Semantics|AccessibilityFeatures)/.test(item.symbol)) return 'W6-16';
    if (/^(Image|Codec|FrameInfo|ImmutableBuffer)/.test(item.symbol)) return 'W6-07';
    if (/^(FrameTiming|FramePhase)/.test(item.symbol)) return 'W6-24';
    if (/^(ChannelBuffers|CallbackHandle|PluginUtilities|RootIsolateToken)/.test(item.symbol))
      return 'W6-22';
    if (
      /^(PlatformDispatcher|FlutterView|FlutterWindow|ViewConfiguration|Window|Locale|Brightness|AppLifecycleState)/.test(
        item.symbol,
      )
    )
      return 'W6-02';
    return 'W6-05';
  }
  if (/^package:(listen|collection|meta)\//.test(item.library)) return 'W6-02';
  if (item.library.startsWith('package:vector_math/')) return 'W6-05';
  if (item.library.startsWith('package:material_color_utilities/')) return 'W6-17';
  if (item.library.startsWith('package:intl/')) return 'W6-16';
  if (item.library.startsWith('package:flutter_localizations')) return 'W6-16';
  if (source.includes('/cupertino/'))
    return /app|theme|nav|route|tab|page_scaffold|colors/.test(source) ? 'W6-20' : 'W6-21';
  if (source.includes('/material/'))
    return /app|theme|color|ink|scaffold|bar|drawer|typography|material.dart/.test(source)
      ? 'W6-17'
      : /dialog|sheet|menu|picker|tab|data_table|expansion|stepper|carousel|reorder|refresh|about|license/.test(
            source,
          )
        ? 'W6-19'
        : 'W6-18';
  if (domain === 'foundation' || domain === 'scheduler') return 'W6-02';
  if (
    domain === 'animation' ||
    domain === 'physics' ||
    /animation|transition|ticker_provider/.test(source)
  )
    return 'W6-11';
  if (domain === 'gestures' || /gesture_detector|mouse_region|tap_region|drag_target/.test(source))
    return 'W6-08';
  if (domain === 'semantics' || /localization|semantics/.test(source)) return 'W6-16';
  if (/focus|keyboard|shortcuts|actions/.test(source)) return 'W6-09';
  if (
    /editable|text_input|text_editing|input_formatter|undo|autofill|spell_check|text_selection/.test(
      source,
    )
  )
    return 'W6-10';
  if (/navigator|router|route|overlay|restoration|hero|modal_barrier|pages/.test(source))
    return 'W6-14';
  if (
    /platform_view|texture|platform_channel|system_chrome|clipboard|platform_menu/.test(source) ||
    domain === 'services'
  )
    return 'W6-22';
  if (/inspector|debug|widget_previews|performance_overlay/.test(source)) return 'W6-23';
  if (
    /nested_scroll|page_view|scrollbar|reorder|dismissible|interactive_viewer|two_dimensional|sliver_tree|draggable_scrollable|list_wheel|scroll_physics|scroll_activity|scroll_position/.test(
      source,
    )
  )
    return 'W6-13';
  if (/sliver|viewport|scroll_view|scrollable|scroll_controller/.test(source)) return 'W6-12';
  if (/framework|inherited|key.dart/.test(source)) return 'W6-03';
  if (/image|asset|decoration|border|shape/.test(source)) return 'W6-07';
  if (/text|font|selection|characters/.test(source)) return 'W6-06';
  if (/layer|paint|clip|opacity|transform|shader/.test(source) || domain === 'painting')
    return 'W6-05';
  if (domain === 'rendering' || /container|basic.dart|layout_builder|table|visibility/.test(source))
    return 'W6-04';
  return 'W6-15';
}
const manifest = JSON.parse(
  await readFile(path.join(root, 'Nelyx/upstream/framework-imports.json'), 'utf8'),
) as Manifest;
const generated = readBatchEvidence(root, String(inventory.source.revision));
const declarations = new Map(inventory.declarations.map((item) => [item.id, item]));
const oldFile = path.join(root, 'Nelyx/upstream/flutter-coverage.json');
const previous = (await Bun.file(oldFile).exists())
  ? ((await Bun.file(oldFile).json()) as {
      source: { revision: string };
      items: Record<string, unknown>[];
      evidence?: Record<string, unknown>;
    })
  : { source: { revision: '' }, items: [] };
const reviews = new Map(previous.items.map((item) => [item.upstreamId ?? item.id, item]));
const items = inventory.declarations.map((item) => {
  const chain = item.symbol.split('.'),
    name = chain[0]!,
    qualifiedAlias = qualifiedAliases[`${item.library}::${name}`],
    matches = (
      candidates.get(`${item.library}::${name}`) ??
      candidates.get(
        qualifiedAlias?.name ?? (Object.hasOwn(aliases, name) ? aliases[name]! : name),
      ) ??
      []
    ).filter(
      (candidate) =>
        (!qualifiedAlias || candidate.module === qualifiedAlias.module) &&
        (!candidate.local ||
          (!item.public && name.startsWith('_')) ||
          (candidate.representation === 'class-factory' &&
            declarations.get(`${item.library}::${name}:MIXIN`)?.kind === 'MIXIN')) &&
        (name !== 'FocusScope' ||
          item.library !== 'package:flutter/src/widgets/focus_scope.dart' ||
          candidate.module === '@nelyx/core/framework/widgets/focus-scope'),
    );
  const overrides = Object.hasOwn(memberAliases, name) ? memberAliases[name] : undefined,
    memberName = chain.at(-1)!;
  const member =
    overrides && Object.hasOwn(overrides, memberName)
      ? overrides[memberName]!
      : chain.slice(1).join('.');
  // Numeric lazy resolves only its own initializeLazy adapter, never generic inherited lazy.
  const memberFor = (candidate: TsSymbol) =>
    candidate.members.find(
      (entry) =>
        entry.name === member &&
        (entry.access !== 'private' || memberName.startsWith('_')) &&
        (item.kind !== 'CONSTRUCTOR' || entry.static) &&
        (item.kind !== 'SETTER' ||
          (entry.write !== undefined &&
            (entry.write.access !== 'private' || memberName.startsWith('_')))),
    );
  const literalFor = (candidate: TsSymbol) =>
    chain.length === 2 &&
    item.kind === 'FIELD' &&
    declarations.get(`${item.library}::${name}:ENUM`)?.kind === 'ENUM' &&
    candidate.stringLiterals?.includes(member) === true;
  const choices = matches.filter(
    (candidate) => chain.length === 1 || memberFor(candidate) || literalFor(candidate),
  );
  const required = true;
  const standalone = standaloneExecutables.get(item.id);
  const globalBinding = (
    {
      'package:flutter/src/foundation/constants.dart::kDebugMode:TOP_LEVEL_VARIABLE': [
        '@nelyx/core/foundation/constants',
        'FoundationBuildMode',
        'debug',
      ],
      'package:flutter/src/foundation/constants.dart::kProfileMode:TOP_LEVEL_VARIABLE': [
        '@nelyx/core/foundation/constants',
        'FoundationBuildMode',
        'profile',
      ],
      'package:flutter/src/foundation/constants.dart::kReleaseMode:TOP_LEVEL_VARIABLE': [
        '@nelyx/core/foundation/constants',
        'FoundationBuildMode',
        'release',
      ],
      'package:flutter/src/foundation/debug.dart::debugDoublePrecision:TOP_LEVEL_VARIABLE': [
        '@nelyx/core/foundation/debug',
        'DebugFormatting',
        'doublePrecision',
      ],
      'package:flutter/src/foundation/print.dart::debugPrintDone:GETTER': [
        '@nelyx/core/foundation/print',
        'DebugPrint',
        'done',
      ],
      ...Object.fromEntries(
        [
          '_debugPrintedCharacters',
          '_debugPrintBuffer',
          '_debugPrintStopwatch',
          '_debugPrintCompleter',
          '_debugPrintScheduled',
        ].map((member) => [
          'package:flutter/src/foundation/print.dart::' + member + ':TOP_LEVEL_VARIABLE',
          ['@nelyx/core/foundation/print', 'DebugPrintController', member, 'instance'],
        ]),
      ),
      'package:flutter/src/foundation/print.dart::_debugPrintTask:FUNCTION': [
        '@nelyx/core/foundation/print',
        'DebugPrintController',
        '_debugPrintTask',
        'instance',
      ],
      ...Object.fromEntries(
        [
          'defaultTargetPlatform:GETTER',
          'debugDefaultTargetPlatformOverride:GETTER',
          'debugDefaultTargetPlatformOverride:SETTER',
          '_debugDefaultTargetPlatformOverride:TOP_LEVEL_VARIABLE',
        ].map((symbol) => [
          'package:flutter/src/foundation/platform.dart::' + symbol,
          ['@nelyx/core/foundation/platform', 'FoundationPlatform', symbol.split(':')[0]!],
        ]),
      ),
      'package:flutter/src/foundation/_platform_io.dart::defaultTargetPlatform:GETTER': [
        '@nelyx/core/foundation/platform',
        'FoundationPlatform',
        '_nativeTargetPlatform',
      ],
      'package:flutter/src/foundation/_platform_web.dart::defaultTargetPlatform:GETTER': [
        '@nelyx/core/foundation/platform',
        'FoundationPlatform',
        '_webTargetPlatform',
      ],
      'package:flutter/src/foundation/_platform_web.dart::_testPlatform:GETTER': [
        '@nelyx/core/foundation/platform',
        'FoundationPlatform',
        '_testPlatform',
      ],
      'package:flutter/src/foundation/_platform_web.dart::_browserPlatform:TOP_LEVEL_VARIABLE': [
        '@nelyx/core/foundation/platform',
        'FoundationPlatform',
        '_browserPlatform',
      ],
      ...Object.fromEntries(
        [
          ['_debugLaunchProfilePlatformChannels:FUNCTION', 'launch'],
          ['_debugRecordUpStream:FUNCTION', 'recordUpStream'],
          ['_debugRecordDownStream:FUNCTION', 'recordDownStream'],
          [
            '_profilePlatformChannelsIsRunning:TOP_LEVEL_VARIABLE',
            '_profilePlatformChannelsIsRunning',
          ],
          ['_profilePlatformChannelsStats:TOP_LEVEL_VARIABLE', '_profilePlatformChannelsStats'],
        ].map(([symbol, member]) => [
          'package:flutter/src/services/platform_channel.dart::' + symbol,
          ['@nelyx/core/services/platform-channel', 'PlatformChannelProfiler', member!, 'instance'],
        ]),
      ),
    } as Record<string, readonly string[]>
  )[item.id];
  const globalCandidate =
      globalBinding &&
      (candidates.get(globalBinding[1]!) ?? []).find((c) => c.module === globalBinding[0]),
    globalMember = globalCandidate?.members.find(
      (m) => m.static === (globalBinding![3] !== 'instance') && m.name === globalBinding![2],
    );
  if (globalBinding && (!globalCandidate || !globalMember))
    throw new Error('Missing explicit global/static-member adapter: ' + item.id);
  if (globalBinding && item.kind === 'SETTER' && !globalMember?.write)
    throw new Error('Missing explicit global setter: ' + item.id);
  const globalDeclaration =
    item.kind === 'SETTER' && globalMember?.write ? globalMember.write : globalMember;
  const mappings =
    globalCandidate && globalMember && globalDeclaration
      ? [
          {
            module: globalCandidate.module,
            export: globalCandidate.export,
            member: globalMember.name,
            access: globalDeclaration.access,
            file: globalDeclaration.file,
            line: globalDeclaration.line,
            sha256: globalDeclaration.sha256,
            representation: globalMember.static ? 'static-member' : 'owner-member',
            evidence:
              'Compiler confirms explicit host static/owner-member adapter and separate setter declaration where applicable; compile-time Dart constants and implicit bundler mode inference are not implied.',
          },
        ]
      : standalone
        ? [
            {
              module: standalone.module,
              export: standalone.export,
              member: null,
              access: 'public',
              representation: 'standalone-function',
              file: standalone.file,
              line: standalone.line,
              sha256: standalone.sha256,
              evidence:
                'Compiler confirms a real standalone exported function implementing an explicit source-method adapter; no BindingBase class/runtime identity is implied.',
            },
          ]
        : choices.map((candidate) => {
            const literal = literalFor(candidate) && !memberFor(candidate),
              found = chain.length > 1 && !literal ? memberFor(candidate)! : candidate,
              declaration = item.kind === 'SETTER' && 'write' in found ? found.write! : found;
            const anchor =
              candidate.anchorSource ??
              (declaration.file !== candidate.file ? candidate : undefined);
            return {
              module: candidate.module,
              export: candidate.export,
              member: chain.length > 1 && !literal ? member : null,
              ...(candidate.local ? { local: candidate.local } : {}),
              ...(literal
                ? { literal: member }
                : chain.length > 1
                  ? { access: 'access' in declaration ? declaration.access : 'public' }
                  : candidate.local
                    ? { access: 'module-private' }
                    : {}),
              file: declaration.file,
              line: declaration.line,
              sha256: declaration.sha256,
              ...(anchor ? { exportSource: { file: anchor.file, sha256: anchor.sha256 } } : {}),
              evidence: literal
                ? 'Compiler confirms an enum field name exists as an exported string-union literal; no runtime enum member or behavior compatibility is implied'
                : candidate.local
                  ? 'Compiler local declaration/member identity under a public module anchor; local is not a public export and behavior requires review'
                  : 'Compiler export/member identity only; behavior and signature compatibility require review',
            };
          });
  const adoption = manifest.selections
    .filter(
      (selection) =>
        (selection.symbol === name &&
          choices.some((choice) => choice.file === selection.destination)) ||
        (standalone &&
          selectionId(selection) === item.id &&
          selection.destination === standalone.file) ||
        (globalCandidate &&
          selectionId(selection) === item.id &&
          selection.destination === globalCandidate.file),
    )
    .map(selectionId);
  for (const mapping of mappings)
    Object.assign(mapping, { package: mapping.module.split('/').slice(0, 2).join('/') });
  const old = reviews.get(item.id);
  const oldDestination = old?.destination as DestinationIdentity[] | undefined;
  const destinationStillExists = reviewedDestinationsMatch(oldDestination, mappings);
  const reviewFields = retainedReviewFields(
    old,
    previous.source.revision === inventory.source.revision,
    !!old && (old.source as Declaration['source']).sha256 === item.source.sha256,
    destinationStillExists,
  );
  return {
    ...item,
    task: stage(item),
    required,
    implementation: mappings.length ? 'partial' : 'missing',
    destination: mappings,
    adoptionIds: adoption,
    ...reviewFields,
    ...generated.review(item, mappings),
  };
});
const external = new Map<string, { id: string; reason: string }>();
for (const item of items)
  for (const dependency of [
    ...item.dependencies,
    ...item.members,
    ...((item.supertypes as { id: string }[]) ?? []).map((type) => type.id),
  ])
    if (!declarations.has(dependency))
      external.set(dependency, {
        id: dependency,
        reason:
          dependency.startsWith('dart:') && !dependency.startsWith('dart:ui::')
            ? 'Dart runtime/language dependency; map required UI semantics to JavaScript/host, no Dart VM or ABI compatibility'
            : 'Unresolved dependency; closure requires review',
      });
async function sourceSnapshot(directory: string) {
  const files: { path: string; sha256: string }[] = [];
  async function visit(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && entry.name.endsWith('.dart'))
        files.push({
          path: path.relative(directory, file).replaceAll('\\', '/'),
          sha256: createHash('sha256')
            .update(await readFile(file))
            .digest('hex'),
        });
    }
  }
  await visit(directory);
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    files: files.length,
    sha256: createHash('sha256')
      .update(files.map((file) => `${file.path}\0${file.sha256}\n`).join(''))
      .digest('hex'),
    entries: files,
  };
}
const snapshot = await sourceSnapshot(
  path.join(root, 'reference/flutter-master/packages/flutter/lib/src'),
);
const pinDirectory = await realpath(flutterSource);
const revisionProcess = Bun.spawn(['git', '-C', pinDirectory, 'rev-parse', 'HEAD'], {
  stdout: 'pipe',
  stderr: 'pipe',
  timeout: 1200000,
});
const actualRevision = (await new Response(revisionProcess.stdout).text()).trim();
if ((await revisionProcess.exited) !== 0 || actualRevision !== inventory.source.revision)
  throw new Error('Inventory revision does not match source checkout');
const pinnedSnapshot = await sourceSnapshot(path.join(pinDirectory, 'packages/flutter/lib/src'));
const gitTree = Bun.spawn(['git', '-C', pinDirectory, 'ls-tree', '-r', 'HEAD'], {
  stdout: 'pipe',
  stderr: 'pipe',
  timeout: 1200000,
});
const tree = await new Response(gitTree.stdout).text();
if ((await gitTree.exited) !== 0) throw new Error(await new Response(gitTree.stderr).text());
const blobs = new Map(
  tree
    .trim()
    .split('\n')
    .map((line) => {
      const [metadata, file] = line.split('\t');
      return [file!, metadata!.split(' ')[2]!];
    }),
);
const provenance = [];
for (const file of inventory.files) {
  if (!file.path.startsWith('packages/') && !file.path.startsWith('engine/')) {
    provenance.push(file);
    continue;
  }
  const bytes = await readFile(path.join(pinDirectory, file.path));
  if (createHash('sha256').update(bytes).digest('hex') !== file.sha256)
    throw new Error(`Analyzed source changed: ${file.path}`);
  const normalized = Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
  const blob = createHash('sha1')
    .update(`blob ${normalized.length}\0`)
    .update(normalized)
    .digest('hex');
  if (blobs.get(file.path) !== blob)
    throw new Error(`Source does not match pinned Git blob: ${file.path}`);
  provenance.push({
    ...file,
    gitBlob: blob,
    upstreamSha256: createHash('sha256').update(normalized).digest('hex'),
  });
}
const localNames = new Set(snapshot.entries.map((file) => file.path)),
  pinnedNames = new Set(pinnedSnapshot.entries.map((file) => file.path)),
  changed = [];
for (const file of snapshot.entries)
  if (pinnedNames.has(file.path)) {
    const a = (
      await readFile(
        path.join(root, 'reference/flutter-master/packages/flutter/lib/src', file.path),
        'utf8',
      )
    ).replaceAll('\r\n', '\n');
    const b = (
      await readFile(path.join(pinDirectory, 'packages/flutter/lib/src', file.path), 'utf8')
    ).replaceAll('\r\n', '\n');
    if (a !== b) changed.push(file.path);
  }
const { entries: localEntries, ...localSnapshot } = snapshot,
  { entries: pinnedEntries, ...pinSnapshot } = pinnedSnapshot;
const coverage = {
  schemaVersion: 1,
  source: {
    ...inventory.source,
    toolDependencyLockSha256: dependencyLock,
    localComparisonSnapshot: localSnapshot,
    pinnedFrameworkSnapshot: pinSnapshot,
    localSnapshotMatchesPin: snapshot.sha256 === pinnedSnapshot.sha256,
    baselineDelta: {
      localOnly: [...localNames].filter((file) => !pinnedNames.has(file)),
      pinnedOnly: [...pinnedNames].filter((file) => !localNames.has(file)),
      changedContent: changed,
      policy:
        'Exact Git pin adopted; removed private helpers and changed files require source review in their assigned tasks; no public family is excluded.',
    },
    hashPolicy:
      'sha256 hashes analysis checkout bytes; gitBlob/upstreamSha256 verify LF-normalized content against the pinned Git object, independent of Windows checkout EOL.',
    files: provenance,
  },
  scope: {
    entrypoints: inventory.entrypoints,
    conditionalExports: inventory.conditionalExports,
    conditionalImports: inventory.conditionalImports ?? [],
    policy:
      'All public UI declarations and required implementation dependencies; inherited APIs link through supertypes; parameters/options are inventoried with their executable. Behavior acceptance remains separate.',
    deprecatedPolicy:
      'Retain until replacement and compatibility policy reviewed; no automatic exclusions.',
    apiPolicy: {
      imports:
        'Direct implementation modules; explicit .ts source and .js ESM/declarations; no barrels',
      constructors: 'Options objects for new APIs; named factories use explicit static names',
      identity: 'Explicit constructor/generic tokens; value objects define equality',
      async: 'Cancellation has an explicit outcome; late events require owner/generation checks',
      version:
        'Breaking APIs require version and migration updates; W5 paths remain until migrated',
    },
  },
  verificationPolicies: {
    'w6-platform-acceptance': {
      windows: {
        status: 'notVerified',
        required: [
          'ESM',
          'Metro/Hermes',
          'pixels',
          'physical input',
          'Korean IME',
          'Narrator/UIA',
          'performance',
          'production deployment',
          'clean consumer',
        ],
        baseline:
          'RNW/Hermes/Graphite-Vulkan; x64 is the existing development baseline; additional supported architecture/OS/hardware selection remains open',
      },
      android: {
        status: 'notVerified',
        required: [
          'Metro/Hermes',
          'ARM64 physical device',
          'pixels',
          'touch',
          'Korean Gboard',
          'TalkBack',
          'performance',
          'signed APK/AAB',
        ],
        baseline:
          'x86_64 emulator evidence is separate; ARM64 physical device/API selection remains open',
      },
      web: {
        status: 'notVerified',
        required: [
          'ESM/Metro',
          'WebGL2 pixels',
          'physical input/IME',
          'browser history',
          'reader',
          'context loss',
          'HTTPS/CSP deployment',
        ],
        baseline: 'CanvasKit/Ganesh/WebGL2; browser/reader qualification selection remains open',
      },
      ios: {
        status: 'SKIPPED',
        reason: '사용자 지정: 코드 구성만 수행',
        providerQualification: 'notVerified',
      },
      macos: {
        status: 'SKIPPED',
        reason: '사용자 지정: 코드 구성만 수행',
        providerQualification: 'notVerified',
      },
      linux: {
        status: 'SKIPPED',
        reason: '사용자 지정: 코드 구성만 수행',
        providerQualification: 'notVerified',
        backend: 'GTK4/RNL/Hermes/Graphite-Vulkan X11; no implicit Wayland support',
      },
    },
  },
  defaults: {
    differences: [
      'Signature/options, state transitions, errors, disposal and target conditions require semantic review',
    ],
    verificationPolicy: 'w6-platform-acceptance',
    verification: {
      portable: 'notVerified',
      runtime: 'notVerified',
      input: 'notVerified',
      ime: 'notVerified',
      reader: 'notVerified',
      performance: 'notVerified',
      deployment: 'notVerified',
    },
  },
  analysis: {
    typescript: ts.version,
    coreVersion: pkg.version,
    frontend: cached
      ? 'Cached resolved model; source Git blobs and Dart dependency lock revalidated'
      : 'Fresh resolved analyzer model',
    sourceDiagnostics: inventory.diagnostics,
    limitations: [
      'Element resolution is not behavioral parity evidence.',
      'Conditional branch visibility must be reviewed with target configuration before closure.',
      'Existing name/member matches remain partial until semantic review.',
    ],
  },
  evidence: { ...previous.evidence, ...generated.envelopes },
  externalDependencies: [...external.values()].sort((a, b) => a.id.localeCompare(b.id)),
  items,
};
// Stable short IDs keep dependency edges small without changing declaration identity.
const identities = new Map<string, string>(),
  reverse = new Map<string, string>();
function ref(id: string): string {
  let hash = identities.get(id);
  if (hash) return hash;
  hash = createHash('sha256').update(id).digest('hex').slice(0, 20);
  if (reverse.has(hash) && reverse.get(hash) !== id) throw new Error('Stable ID collision');
  identities.set(id, hash);
  reverse.set(hash, id);
  return hash;
}
const fileIds = new Map(inventory.files.map((file) => [file.path, ref(`file:${file.path}`)]));
const compactItems = items.map((item) => {
  const { id, library, symbol, members, dependencies, exportedBy, supertypes, source, ...rest } =
    item;
  return {
    id: ref(id),
    upstreamId: id,
    ...rest,
    source: { ...source, file: fileIds.get(source.file) },
    exportedBy: exportedBy.filter((uri) => !uri.includes(' [')).map((uri) => ref(uri)),
    members: members.map(ref),
    dependencies: dependencies.map(ref),
    ...(supertypes
      ? {
          supertypes: (supertypes as { id: string; type: string }[]).map((type) => ({
            ...type,
            id: ref(type.id),
          })),
        }
      : {}),
    ...(exportedBy.some((uri) => uri.includes(' ['))
      ? { conditionalExports: exportedBy.filter((uri) => uri.includes(' [')) }
      : {}),
  };
});
coverage.source.files = provenance.map((file) => ({
  ...file,
  id: fileIds.get(file.path),
})) as typeof coverage.source.files;
const { items: discarded, ...header } = coverage;
const compact = {
  ...header,
  encoding: {
    id: 'First 20 lowercase hex characters of SHA256(canonical upstream declaration identity); collisions rejected',
    file: 'source.file references source.files[].id',
    edges: 'members/dependencies/supertypes reference items[].id or externalDependencies[].id',
    entrypoints: 'exportedBy references scope.entrypoints[].id',
    defaults:
      'Absent item differences and verification inherit defaults; all six targets use the verification policy',
  },
  scope: {
    ...coverage.scope,
    entrypoints: (inventory.entrypoints as { uri: string; exports: string[] }[]).map((library) => ({
      id: ref(library.uri),
      uri: library.uri,
      exports: library.exports.map(ref),
    })),
    conditionalExports: (inventory.conditionalExports as { exports: string[] }[]).map((branch) => ({
      ...branch,
      exports: branch.exports.map(ref),
    })),
    conditionalImports: (inventory.conditionalImports ?? []).map((branch) => ({
      ...branch,
      declarations: branch.declarations.map(ref),
    })),
  },
  externalDependencies: coverage.externalDependencies.map((item) => ({
    ...item,
    id: ref(item.id),
    upstreamId: item.id,
  })),
};
const headerJson = JSON.stringify(compact, null, 2).slice(0, -2);
await writeFile(
  path.join(target, 'flutter-coverage.json'),
  headerJson +
    ',\n  "items": [\n' +
    compactItems.map((item) => '    ' + JSON.stringify(item)).join(',\n') +
    '\n  ]\n}\n',
);
console.log(
  JSON.stringify({
    items: items.length,
    public: items.filter((item) => item.public).length,
    partial: items.filter((item) => item.implementation === 'partial').length,
    missing: items.filter((item) => item.implementation === 'missing').length,
    diagnostics: inventory.diagnostics.length,
    localSnapshotMatchesPin: coverage.source.localSnapshotMatchesPin,
    output: target,
  }),
);
