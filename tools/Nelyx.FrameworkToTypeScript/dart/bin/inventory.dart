// SPDX-License-Identifier: BSD-3-Clause
import 'dart:convert';
import 'dart:io';

import 'package:analyzer/dart/analysis/analysis_context_collection.dart';
import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/dart/element/element.dart';
import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;

String digest(List<int> bytes) => sha256.convert(bytes).toString();
String qualified(Element element) {
  final parent = element.enclosingElement;
  final name = element is ConstructorElement
      ? element.name ?? 'new'
      : element.displayName;
  return parent == null || parent is LibraryElement
      ? name
      : '${qualified(parent)}.$name';
}

Element canonical(Element element) {
  element = element.baseElement;
  return element is PropertyAccessorElement ||
          element is PropertyInducingElement
      ? element.nonSynthetic
      : element;
}

// Private instance overrides are reached through dynamic dispatch even when no
// identifier in the subclass body refers to the overridden declaration.
bool overridesPrivateMember(Element element) {
  if (element.isPublic) return false;
  final parent = element.enclosingElement;
  if (parent is! InterfaceElement) return false;
  if (element is ExecutableElement && element.isStatic ||
      element is FieldElement && element.isStatic)
    return false;
  final name = element.displayName.replaceFirst(RegExp(r'=$'), '');
  for (final type in parent.allSupertypes) {
    final inherited = element is MethodElement
        ? type.getMethod(name)
        : element is SetterElement
        ? type.getSetter(name)
        : element is GetterElement || element is FieldElement
        ? type.getGetter(name) ?? type.getSetter(name)
        : null;
    if (inherited != null && inherited.library == element.library) return true;
  }
  return false;
}

bool iconConstant(Element element) {
  final parent = element.enclosingElement;
  return parent is ClassElement &&
      ['Icons', 'CupertinoIcons'].contains(parent.name) &&
      element is FieldElement &&
      element.isStatic &&
      element.isConst;
}

String identity(Element element) {
  element = canonical(element);
  return '${element.library?.uri}::${qualified(element)}:${element.kind.name}';
}

bool declaration(Element element) =>
    element is! FormalParameterElement &&
    element is! TypeParameterElement &&
    element is! LocalElement &&
    element is! PrefixElement &&
    element is! LibraryElement;

class References extends RecursiveAstVisitor<void> {
  final elements = <String, Element>{};
  void add(Element? element) {
    if (element == null || !declaration(element)) return;
    element = canonical(element);
    if (iconConstant(element)) return;
    if (element.library == null &&
        ['DYNAMIC', 'NEVER'].contains(element.kind.name))
      return;
    elements[identity(element)] = element;
  }

  @override
  void visitSimpleIdentifier(SimpleIdentifier node) {
    add(node.element);
    super.visitSimpleIdentifier(node);
  }

  // Assignment targets can have no SimpleIdentifier.element in analyzer 14.
  // Their implicit getter/setter and operator calls still belong to closure.
  @override
  void visitAssignmentExpression(AssignmentExpression node) {
    add(node.readElement);
    add(node.writeElement);
    add(node.element);
    super.visitAssignmentExpression(node);
  }

  @override
  void visitBinaryExpression(BinaryExpression node) {
    add(node.element);
    super.visitBinaryExpression(node);
  }

  @override
  void visitPrefixExpression(PrefixExpression node) {
    add(node.readElement);
    add(node.writeElement);
    add(node.element);
    super.visitPrefixExpression(node);
  }

  @override
  void visitPostfixExpression(PostfixExpression node) {
    add(node.readElement);
    add(node.writeElement);
    add(node.element);
    super.visitPostfixExpression(node);
  }

  @override
  void visitIndexExpression(IndexExpression node) {
    add(node.element);
    super.visitIndexExpression(node);
  }

  @override
  void visitNamedType(NamedType node) {
    add(node.element);
    super.visitNamedType(node);
  }

  @override
  void visitConstructorName(ConstructorName node) {
    add(node.element);
    super.visitConstructorName(node);
  }
}

Future<void> main(List<String> args) async {
  if (args.length != 2)
    throw ArgumentError(
      'inventory.dart <pinned-flutter-root> <fresh-output-directory>',
    );
  final root = p.normalize(p.absolute(args[0])),
      out = p.normalize(p.absolute(args[1]));
  final sdk = p.dirname(p.dirname(Platform.resolvedExecutable));
  final git = await Process.run('git', ['-C', root, 'rev-parse', 'HEAD']);
  if (git.exitCode != 0)
    throw StateError('A git-pinned Flutter source checkout is required');
  final revision = (git.stdout as String).trim();
  final tracked = await Process.run('git', [
    '-C',
    root,
    'diff',
    '--name-only',
    'HEAD',
    '--',
    'packages/flutter',
    'packages/flutter_localizations',
    'engine/src/flutter/lib/ui',
    'LICENSE',
  ]);
  if ((tracked.stdout as String).trim().isNotEmpty)
    throw StateError('Pinned Flutter sources have local modifications');

  // A standalone tool lock resolves external dependencies. No Flutter workspace pub get,
  // SDK replacement, engine build, or product runtime dependency is required.
  final toolConfig = File(
    p.join(
      p.dirname(p.dirname(Platform.script.toFilePath())),
      '.dart_tool',
      'package_config.json',
    ),
  );
  final config =
      jsonDecode(toolConfig.readAsStringSync()) as Map<String, dynamic>;
  final packages = (config['packages'] as List)
      .cast<Map<String, dynamic>>()
      .map(
        (item) => {
          ...item,
          'rootUri': toolConfig.uri
              .resolve(item['rootUri'] as String)
              .toString(),
        },
      )
      .toList();
  final sky = p.join(out, 'sky_engine');
  Directory(p.join(sky, 'lib')).createSync(recursive: true);
  final metadata = jsonDecode(
    File(p.join(sdk, 'lib', 'libraries.json')).readAsStringSync(),
  ) as Map<String, dynamic>;
  final embedded = <String, String>{};
  for (final platform in metadata.values.whereType<Map<String, dynamic>>()) {
    final libraries = platform['libraries'];
    if (libraries is! Map) continue;
    for (final entry in libraries.entries) {
      final value = entry.value;
      if (value is Map && value['uri'] is String)
        embedded.putIfAbsent(
          'dart:${entry.key}',
          () => p.join(sdk, 'lib', value['uri'] as String),
        );
    }
  }
  embedded['dart:ui'] = p.join(
    root,
    'engine',
    'src',
    'flutter',
    'lib',
    'ui',
    'ui.dart',
  );
  embedded['dart:ui_web'] = p.join(
    root,
    'engine',
    'src',
    'flutter',
    'lib',
    'web_ui',
    'lib',
    'ui_web',
    'src',
    'ui_web.dart',
  );
  final nativeWrappers = p.join(
    sdk,
    'lib',
    'html',
    'dartium',
    'nativewrappers.dart',
  );
  if (File(nativeWrappers).existsSync())
    embedded['dart:nativewrappers'] = nativeWrappers;
  File(p.join(sky, 'lib', '_embedder.yaml')).writeAsStringSync(
    'embedded_libs:\n${embedded.entries.map((e) => '  ${jsonEncode(e.key)}: ${jsonEncode(p.posix.joinAll(p.split(e.value)))}').join('\n')}\n',
  );
  for (final name in ['flutter', 'flutter_localizations'])
    packages.add({
      'name': name,
      'rootUri': Directory(p.join(root, 'packages', name)).uri.toString(),
      'packageUri': 'lib/',
      'languageVersion': '3.13',
    });
  packages.add({
    'name': 'sky_engine',
    'rootUri': Directory(sky).uri.toString(),
    'packageUri': 'lib/',
    'languageVersion': '3.13',
  });
  final rootConfig = File(p.join(root, '.dart_tool', 'package_config.json'));
  if (rootConfig.existsSync())
    throw StateError(
      'Refusing to overwrite an existing source package configuration',
    );
  rootConfig.parent.createSync(recursive: true);
  rootConfig.writeAsStringSync(jsonEncode({...config, 'packages': packages}));
  final collection = AnalysisContextCollection(
    includedPaths: [root],
    sdkPath: sdk,
  );
  try {
    final entrypoints = <String>[];
    for (final package in ['flutter', 'flutter_localizations']) {
      final lib = Directory(p.join(root, 'packages', package, 'lib'));
      for (final file in lib.listSync().whereType<File>().where(
        (f) => f.path.endsWith('.dart'),
      ))
        entrypoints.add('package:$package/${p.basename(file.path)}');
    }
    entrypoints.add('dart:ui');
    entrypoints.sort();
    final session = collection
        .contextFor(p.join(root, 'packages', 'flutter', 'lib', 'widgets.dart'))
        .currentSession;
    final public = <String, Element>{},
        exports = <String, Set<String>>{},
        libraries = <Map<String, Object?>>[];
    final resolved = <String, ResolvedLibraryResult>{};
    Future<ResolvedLibraryResult> resolve(LibraryElement library) async {
      if (resolved.containsKey(library.uri.toString()))
        return resolved[library.uri.toString()]!;
      final result = await library.session.getResolvedLibraryByElement(library);
      if (result is! ResolvedLibraryResult)
        throw StateError('Unresolved library ${library.uri}: $result');
      resolved[library.uri.toString()] = result;
      return result;
    }

    final branches = <Map<String, Object?>>[];
    final importBranches = <Map<String, Object?>>[];
    final conditionalImports =
        <
          String,
          List<
            ({
              Map<String, String> names,
              Map<String, Element> alternatives,
              Set<String> ids,
            })
          >
        >{};
    Future<
      List<
        ({
          Map<String, String> names,
          Map<String, Element> alternatives,
          Set<String> ids,
        })
      >
    >
    importsFor(LibraryElement library) async {
      final cached = conditionalImports[library.uri.toString()];
      if (cached != null) return cached;
      final mappings =
          <
            ({
              Map<String, String> names,
              Map<String, Element> alternatives,
              Set<String> ids,
            })
          >[];
      conditionalImports[library.uri.toString()] = mappings;
      final result = await resolve(library);
      for (final unit in result.units) {
        for (final directive
            in unit.unit.directives.whereType<ImportDirective>().where(
              (d) => d.configurations.isNotEmpty,
            )) {
          final defaultUri = directive.uri.stringValue;
          if (defaultUri == null)
            throw StateError('Unresolved conditional import URI');
          final original = await session.getLibraryByUri(
            library.uri.resolve(defaultUri).toString(),
          );
          if (original is! LibraryElementResult)
            throw StateError('Unresolved conditional import $defaultUri');
          bool admitted(String name) {
            for (final combinator in directive.combinators) {
              if (combinator is ShowCombinator &&
                  !combinator.shownNames.any((n) => n.name == name))
                return false;
              if (combinator is HideCombinator &&
                  combinator.hiddenNames.any((n) => n.name == name))
                return false;
            }
            return true;
          }

          final names = <String, String>{
            for (final entry
                in original.element.exportNamespace.definedNames2.entries.where(
                  (e) => admitted(e.key),
                ))
              identity(entry.value): entry.key,
          };
          for (final configuration in directive.configurations) {
            final uri = configuration.uri.stringValue;
            if (uri == null)
              throw StateError('Unresolved conditional import alternative');
            final target = library.uri.resolve(uri).toString(),
                alternate = await session.getLibraryByUri(target);
            if (alternate is! LibraryElementResult)
              throw StateError('Unresolved conditional import $target');
            final alternatives = <String, Element>{
                  for (final entry
                      in alternate.element.exportNamespace.definedNames2.entries
                          .where((e) => admitted(e.key)))
                    entry.key: canonical(entry.value),
                },
                ids = <String>{};
            mappings.add((names: names, alternatives: alternatives, ids: ids));
            importBranches.add({
              'from': library.uri.toString(),
              'condition': configuration.toSource(),
              'target': target,
              'declarations': ids,
            });
          }
        }
      }
      return mappings;
    }

    final scanned = <String>{};
    Future<void> scanExports(LibraryElement library, String via) async {
      final key = '${library.uri}|$via';
      if (!scanned.add(key)) return;
      final result = await resolve(library);
      for (final unit in result.units)
        for (final directive
            in unit.unit.directives.whereType<ExportDirective>()) {
          for (final configuration in directive.configurations) {
            final uri = configuration.uri.stringValue;
            if (uri == null) throw StateError('Unresolved conditional URI');
            final target = library.uri.resolve(uri).toString();
            final alternate = await session.getLibraryByUri(target);
            if (alternate is! LibraryElementResult)
              throw StateError('Unresolved conditional export $target');
            final names = alternate
                .element
                .exportNamespace
                .definedNames2
                .entries
                .where((entry) {
                  for (final combinator in directive.combinators) {
                    if (combinator is ShowCombinator &&
                        !combinator.shownNames.any(
                          (name) => name.name == entry.key,
                        ))
                      return false;
                    if (combinator is HideCombinator &&
                        combinator.hiddenNames.any(
                          (name) => name.name == entry.key,
                        ))
                      return false;
                  }
                  return true;
                });
            final ids = <String>[];
            for (final entry in names) {
              final element = canonical(entry.value);
              if (!element.isPublic) continue;
              final id = identity(element);
              public[id] = element;
              exports
                  .putIfAbsent(id, () => {})
                  .add('$via [${configuration.name.toSource()}]');
              ids.add(id);
            }
            branches.add({
              'from': library.uri.toString(),
              'via': via,
              'condition': configuration.toSource(),
              'target': target,
              'exports': ids..sort(),
            });
            await scanExports(alternate.element, via);
          }
        }
      for (final exported in library.exportedLibraries)
        await scanExports(exported, via);
    }

    for (final uri in entrypoints) {
      final result = await session.getLibraryByUri(uri);
      if (result is! LibraryElementResult)
        throw StateError('Unable to resolve entrypoint $uri: $result');
      final ids = <String>[];
      for (final entry
          in result.element.exportNamespace.definedNames2.entries) {
        final element = canonical(entry.value);
        if (!element.isPublic) continue;
        final id = identity(element);
        public[id] = element;
        exports.putIfAbsent(id, () => {}).add(uri);
        ids.add(id);
      }
      libraries.add({'uri': uri, 'exports': ids..sort()});
      await scanExports(result.element, uri);
      stderr.writeln('$uri: ${ids.length} declarations');
    }
    final queue = <Element>[...public.values],
        seen = <String>{},
        records = <Map<String, Object?>>[],
        files = <String, Map<String, Object?>>{};
    String portableFile(String file) {
      if (p.isWithin(root, file))
        return p.posix.joinAll(p.split(p.relative(file, from: root)));
      for (final package in packages) {
        final base = Uri.parse(package['rootUri'] as String).toFilePath();
        if (p.isWithin(base, file))
          return 'package:${package['name']}/${p.posix.joinAll(p.split(p.relative(file, from: p.join(base, 'lib'))))}';
      }
      if (p.isWithin(sdk, file))
        return 'dart-sdk/${p.posix.joinAll(p.split(p.relative(file, from: sdk)))}';
      throw StateError('Unpinned source path $file');
    }

    for (var cursor = 0; cursor < queue.length; cursor++) {
      final element = canonical(queue[cursor]), id = identity(element);
      if (!seen.add(id)) continue;
      final library = element.library;
      if (library == null) throw StateError('Declaration without library $id');
      // Dart VM APIs are recorded as dependencies, not duplicated as UI product APIs.
      if (library.isInSdk && library.uri.toString() != 'dart:ui') continue;
      final result = await resolve(library);
      final fragment = element.firstFragment;
      final source =
          fragment.libraryFragment?.source ?? library.firstFragment.source;
      final file = portableFile(source.fullName),
          bytes = File(source.fullName).readAsBytesSync();
      files.putIfAbsent(file, () => {'path': file, 'sha256': digest(bytes)});
      AstNode? node;
      try {
        node =
            result.getFragmentDeclaration(fragment)?.node ??
            result
                .getFragmentDeclaration(element.nonSynthetic.firstFragment)
                ?.node;
      } on ArgumentError {
        node = null;
      }
      final refs = References();
      node?.accept(refs);
      refs.elements.remove(id);
      // Resolve only alternate bindings actually referenced by this library.
      // They are implementation dependencies, never extra public exports.
      for (final mapping in await importsFor(library)) {
        for (final reference in refs.elements.values.toList()) {
          Element top = reference;
          while (top.enclosingElement != null &&
              top.enclosingElement is! LibraryElement) {
            top = top.enclosingElement!;
          }
          final name = mapping.names[identity(top)];
          if (name == null) continue;
          final alternative = mapping.alternatives[name];
          if (alternative == null)
            throw StateError(
              'Missing conditional import binding $name for ${library.uri}',
            );
          mapping.ids.add(identity(alternative));
          queue.add(alternative);
          refs.elements.putIfAbsent(identity(alternative), () => alternative);
        }
      }
      final parent = element.enclosingElement;
      final exposed =
          public.containsKey(id) ||
          (parent != null &&
              public.containsKey(identity(parent)) &&
              element.isPublic);
      final children = element.children
          .where(
            (child) =>
                child is! TypeParameterElement &&
                child is! FormalParameterElement &&
                child is! LocalElement &&
                (!exposed || child.isPublic || overridesPrivateMember(child)),
          )
          .map(canonical)
          .toSet()
          .toList();
      // Icon constant families retain a source hash and generation recipe instead of thousands of duplicate entries.
      final icons =
          element is ClassElement &&
          ['Icons', 'CupertinoIcons'].contains(element.name);
      final iconMembers = icons
          ? children
                .whereType<FieldElement>()
                .where((f) => f.isStatic && f.isConst)
                .toList()
          : <FieldElement>[];
      final actualChildren = children
          .where((child) => !iconConstant(child))
          .toList();
      if (exposed)
        for (final child in actualChildren.where((child) => child.isPublic)) {
          public.putIfAbsent(identity(child), () => child);
          exports
              .putIfAbsent(identity(child), () => {})
              .addAll(exports[id] ?? {});
        }
      queue.addAll(actualChildren);
      queue.addAll(refs.elements.values);
      final unit = result.units.firstWhere(
        (unit) => unit.path == source.fullName,
      );
      final start = node?.offset ?? fragment.nameOffset ?? 0,
          end = node?.end ?? start;
      final record = <String, Object?>{
        'id': id,
        'library': library.uri.toString(),
        'symbol': qualified(element),
        'kind': element.kind.name,
        'source': {
          'file': file,
          'offset': start,
          'length': end - start,
          'line': unit.lineInfo.getLocation(start).lineNumber,
          'sha256': digest(utf8.encode(unit.content.substring(start, end))),
        },
        'signature': element.displayString(),
        'public': exposed,
        'exportedBy': (exports[id] ?? {}).toList()..sort(),
        'deprecated': element.metadata.hasDeprecated,
        'internal': element.metadata.hasInternal,
        'members': actualChildren.map(identity).toSet().toList()..sort(),
        'dependencies': refs.elements.keys.toList()..sort(),
      };
      if (element is InterfaceElement)
        record['supertypes'] = element.allSupertypes
            .map(
              (type) => {
                'id': identity(type.element),
                'type': type.getDisplayString(),
              },
            )
            .toList();
      if (element is FunctionTypedElement)
        record['parameters'] = element.formalParameters
            .map(
              (parameter) => {
                'name': parameter.name,
                'type': parameter.type.getDisplayString(),
                'required':
                    parameter.isRequiredNamed || parameter.isRequiredPositional,
                'named': parameter.isNamed,
                'default': parameter.defaultValueCode,
              },
            )
            .toList();
      if (icons)
        record['constantFamily'] = {
          'count': iconMembers.length,
          'rule': 'Parse public static const IconData fields from the pinned file; preserve codepoint, fontFamily, fontPackage and matchTextDirection.',
          'representatives': iconMembers
              .take(3)
              .map(
                (field) => {
                  'name': field.name,
                  'value': field.computeConstantValue()?.toString(),
                },
              )
              .toList(),
        };
      records.add(record);
    }
    final diagnostics = <Map<String, Object?>>[];
    for (final library in resolved.values)
      for (final unit in library.units)
        for (final error in unit.diagnostics) {
          if (error.diagnosticCode.severity.name != 'ERROR') continue;
          diagnostics.add({
            'file': portableFile(unit.path),
            'offset': error.offset,
            'code': error.diagnosticCode.lowerCaseName,
            'message': error.message,
          });
        }
    final fileList = files.values.toList()
      ..sort((a, b) => (a['path'] as String).compareTo(b['path'] as String));
    records.sort((a, b) => (a['id'] as String).compareTo(b['id'] as String));
    final output = {
      'schemaVersion': 1,
      'source': {
        'repository': 'https://github.com/flutter/flutter',
        'toolFrontendSha256': digest(
          File.fromUri(Platform.script).readAsBytesSync(),
        ),
        'revision': revision,
        'licenseSha256': digest(
          File(p.join(root, 'LICENSE')).readAsBytesSync(),
        ),
        'dartSdk': Platform.version.split(' ').first,
        'analyzer': '14.4.0',
        'externalPackages': packages
            .where(
              (pkg) => ![
                'flutter',
                'flutter_localizations',
                'sky_engine',
                'nelyx_flutter_inventory',
              ].contains(pkg['name']),
            )
            .map(
              (pkg) => {
                'name': pkg['name'],
                'languageVersion': pkg['languageVersion'],
              },
            )
            .toList(),
      },
      'entrypoints': libraries,
      'conditionalExports': branches,
      'conditionalImports': importBranches
          .map(
            (branch) => {
              ...branch,
              'declarations': (branch['declarations'] as Set<String>).toList()
                ..sort(),
            },
          )
          .toList(),
      'files': fileList,
      'declarations': records,
      'diagnostics': diagnostics,
      'resolution': 'resolved-element-model; conditional alternatives explicitly enumerated; runtime behavior requires separate review',
    };
    File(p.join(out, 'dart-inventory.json')).writeAsStringSync(
      '${const JsonEncoder.withIndent('  ').convert(output)}\n',
    );
    stderr.writeln(
      '${records.length} declarations; ${diagnostics.length} source diagnostics; ${fileList.length} source files',
    );
  } finally {
    await collection.dispose();
    rootConfig.deleteSync();
  }
}
