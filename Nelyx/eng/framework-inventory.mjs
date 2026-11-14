// SPDX-License-Identifier: BSD-3-Clause
// Current source/export inventory. This reports provenance, never semantic acceptance.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { productModulePath } from '../../tools/Nelyx.FrameworkToTypeScript/product-module-layout.mjs';
import { openFlutterSource } from '../../tools/Nelyx.FrameworkToTypeScript/flutter-source.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
function sourceExport(directory, entry) {
  if (typeof entry === 'object' && entry !== null)
    entry = entry.default ?? entry.import ?? entry.types;
  if (typeof entry !== 'string' || !/^\.\/dist\/.*\.(?:js|d\.ts)$/.test(entry)) return null;
  const relative = entry.replace(/^\.\/dist\//, '').replace(/\.(?:js|d\.ts)$/, '.ts');
  const file = path.posix.join(directory, 'src/' + relative);
  return !fs.existsSync(path.join(root, file)) && fs.existsSync(path.join(root, file + 'x'))
    ? file + 'x'
    : file;
}
export function frameworkInventory({ module: requestedModule } = {}) {
  const coverage = read('Nelyx/upstream/flutter-coverage.json');
  const origins = read('tools/Nelyx.FrameworkToTypeScript/data/work8/manual-origins.json');
  const reviewed = read('tools/Nelyx.FrameworkToTypeScript/data/framework-ports.json');
  if (coverage.source.revision !== origins.pin) throw Error('Active Flutter source pins differ');
  if (reviewed.pin !== origins.pin) throw Error('Framework port source pin differs');
  const sourceFiles = new Map(coverage.source.files.map((file) => [file.id, file]));
  const destinations = new Map();
  for (const item of coverage.items)
    for (const destination of item.destination ?? []) {
      const file = productModulePath(destination.file);
      const key = file + '\0' + destination.export;
      const entries = destinations.get(key) ?? [];
      entries.push({
        id: item.id,
        upstreamId: item.upstreamId,
        implementation: item.implementation,
        member: destination.member ?? null,
        source: { ...item.source, file: sourceFiles.get(item.source.file)?.path },
      });
      destinations.set(key, entries);
    }
  const packages = ['Nelyx', 'packages/material', 'packages/cupertino', 'Nelyx/sdk'];
  const exports = packages.flatMap((directory) => {
    const manifest = read(directory + '/package.json');
    return Object.entries(manifest.exports).map(([key, entry]) => ({
      module: manifest.name + (key === '.' ? '' : key.slice(1)),
      file: sourceExport(directory, entry),
      package: manifest.name,
      entry,
    }));
  });
  if (requestedModule && !exports.some((entry) => entry.module === requestedModule))
    throw Error('Unknown public module: ' + requestedModule);
  const selected = exports.filter((entry) => !requestedModule || entry.module === requestedModule);
  const files = [
    ...new Set(selected.flatMap((entry) => (entry.file ? [path.join(root, entry.file)] : []))),
  ];
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    allowImportingTsExtensions: true,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const dependencyCache = new Map();
  const dependencies = (source) => {
    if (!source) return [];
    if (dependencyCache.has(source.fileName)) return dependencyCache.get(source.fileName);
    const entries = source.statements.flatMap((statement) => {
      if (
        (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) ||
        !statement.moduleSpecifier ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        return [];
      const specifier = statement.moduleSpecifier.text,
        resolved = ts.resolveModuleName(
          specifier,
          source.fileName,
          program.getCompilerOptions(),
          ts.sys,
        ).resolvedModule;
      return [
        {
          module: specifier,
          typeOnly: statement.isTypeOnly ?? statement.importClause?.isTypeOnly ?? false,
          file: resolved
            ? path.relative(root, resolved.resolvedFileName).replaceAll('\\', '/')
            : null,
        },
      ];
    });
    dependencyCache.set(source.fileName, entries);
    return entries;
  };
  const location = (node) =>
    node
      ? {
          file: path.relative(root, node.getSourceFile().fileName).replaceAll('\\', '/'),
          line: node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1,
        }
      : null;
  const signature = (value) =>
    checker.signatureToString(value, undefined, ts.TypeFormatFlags.NoTruncation);
  const memberDescription = (member) => {
    const node = member.valueDeclaration ?? member.declarations?.[0];
    const flags = node ? ts.getCombinedModifierFlags(node) : 0;
    return {
      name: member.name,
      kind: node ? ts.SyntaxKind[node.kind] : 'unknown',
      owner: location(node),
      access:
        flags & ts.ModifierFlags.Private
          ? 'private'
          : flags & ts.ModifierFlags.Protected
            ? 'protected'
            : 'public',
      static: !!(flags & ts.ModifierFlags.Static),
      readonly: !!(flags & ts.ModifierFlags.Readonly),
      optional: !!(member.flags & ts.SymbolFlags.Optional),
      type: node
        ? checker.typeToString(
            checker.getTypeOfSymbolAtLocation(member, node),
            node,
            ts.TypeFormatFlags.NoTruncation,
          )
        : null,
      default: node?.initializer?.getText() ?? null,
    };
  };
  let declarations = 0,
    unmapped = 0;
  const modules = selected.map((entry) => {
    if (!entry.file) return { ...entry, declarations: [], status: 'non-typescript-export' };
    const source = program.getSourceFile(path.join(root, entry.file));
    const symbol = source && checker.getSymbolAtLocation(source);
    if (!symbol) return { ...entry, declarations: [], status: 'missing-source-module' };
    return {
      ...entry,
      status: 'source-present-behavior-unreviewed',
      dependencies: dependencies(source),
      declarations: checker.getExportsOfModule(symbol).map((exported) => {
        const value =
          exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
        const declaration = value.valueDeclaration ?? value.declarations?.[0];
        const actualFile = declaration
          ? path.relative(root, declaration.getSourceFile().fileName).replaceAll('\\', '/')
          : entry.file;
        const mapped = destinations.get(actualFile + '\0' + value.name) ?? [];
        const manual = [...origins.origins, ...reviewed.origins].filter(
          (origin) =>
            productModulePath(origin.destination.file) === actualFile &&
            origin.qualifiedId.split('::').at(-1)?.split(':')[0] === value.name,
        );
        const sourceOrigins = [...new Map(mapped.map((item) => [item.id, item])).values()];
        declarations++;
        if (!sourceOrigins.length && !manual.length) unmapped++;
        const members = new Set([
          ...(value.members?.keys() ?? []),
          ...(value.exports?.keys() ?? []),
        ]);
        const type = declaration ? checker.getTypeOfSymbolAtLocation(value, declaration) : null;
        return {
          name: exported.name,
          owner: actualFile,
          dependencies: dependencies(declaration?.getSourceFile()),
          line: declaration
            ? declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.getStart())
                .line + 1
            : null,
          kind: declaration ? ts.SyntaxKind[declaration.kind] : 'unknown',
          calls: type
            ? checker.getSignaturesOfType(type, ts.SignatureKind.Call).map(signature)
            : [],
          constructors: type
            ? checker.getSignaturesOfType(type, ts.SignatureKind.Construct).map(signature)
            : [],
          parameters:
            declaration && ts.isClassDeclaration(declaration)
              ? declaration.members.filter(ts.isConstructorDeclaration).flatMap((constructor) =>
                  constructor.parameters.map((parameter) => ({
                    binding: parameter.name.getText(),
                    type: parameter.type?.getText() ?? null,
                    default: parameter.initializer?.getText() ?? null,
                    optional: !!parameter.questionToken,
                  })),
                )
              : [],
          members: [...members]
            .filter((name) => !String(name).startsWith('__') && name !== 'prototype')
            .map((name) => memberDescription(value.members?.get(name) ?? value.exports.get(name))),
          source: sourceOrigins,
          manual: manual.map(({ id, source, mode, status, scope }) => ({
            id,
            source,
            mode,
            status,
            scope,
          })),
          behavior: 'unreviewed',
        };
      }),
    };
  });
  return {
    revision: origins.pin,
    upstreamDeclarations: coverage.items.length,
    metadataImplementations: coverage.items.reduce((counts, item) => {
      counts[item.implementation] = (counts[item.implementation] ?? 0) + 1;
      return counts;
    }, {}),
    declarations,
    unmapped,
    applications: ['nelyx-demo-app', 'nelyx-testbed-app-2'].map((name) => {
      const directory = 'sample/' + name,
        manifest = read(directory + '/package.json');
      return {
        application: manifest.name,
        entry: path.posix.join(directory, manifest.nelyx.appEntry),
        targets: Object.entries(manifest.nelyx.targets).map(([target, settings]) => {
          const runner = directory + '/' + target + '/runner',
            installed = read(runner + '/package.json');
          return {
            target,
            runner,
            component: path.posix.join(directory, settings.component),
            profile: settings.profile,
            cohort: settings.cohort ?? null,
            supply: Object.entries(installed.dependencies ?? {})
              .filter(([name]) => name.startsWith('@nelyx/'))
              .map(([name, archive]) => ({ name, archive })),
          };
        }),
        behavior:
          'Declared entries and current supply only; platform execution is recorded in work12.md',
      };
    }),
    modules,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const watchdog = setTimeout(() => {
    throw Error('Framework inventory exceeded 20 minutes');
  }, 1_200_000);
  try {
    let module, repository;
    for (let i = 2; i < process.argv.length; ++i) {
      if (process.argv[i] === '--module') module = process.argv[++i];
      else if (process.argv[i] === '--source') repository = process.argv[++i];
      else throw Error('Unknown inventory argument: ' + process.argv[i]);
      if ((process.argv[i] ?? '').startsWith('--')) throw Error('Missing inventory argument value');
    }
    if (repository)
      console.log(
        'FLUTTER_SOURCE',
        JSON.stringify(
          openFlutterSource(repository).verifyCoverage(
            read('Nelyx/upstream/flutter-coverage.json'),
          ),
        ),
      );
    const inventory = frameworkInventory({ module });
    console.log(
      JSON.stringify(
        module
          ? inventory
          : {
              ...inventory,
              modules: inventory.modules.map(({ module, file, status, declarations }) => ({
                module,
                file,
                status,
                declarations: declarations.length,
              })),
            },
        null,
        2,
      ),
    );
  } finally {
    clearTimeout(watchdog);
  }
}
