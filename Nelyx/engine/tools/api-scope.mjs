// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Reconstruct the selected portable-environment and additive-v2 declaration inputs.
// No historical package, SDK tree, or emitted file is copied or retained.
export function originalApiDeclarations(root, revision = '2f77d42') {
  const original = new Map();
  for (const file of [
    'Nelyx/src/framework/rendering/object.ts',
    'Nelyx/src/framework/widgets/basic.ts',
    'Nelyx/runtime/engine-client/codec.ts',
    'Nelyx/runtime/engine-client/widgets.ts',
    'Nelyx/runtime/engine-client/schema.ts',
    'Nelyx/skia/packages/native/src/skia/types/Drawing.ts',
    'Nelyx/sdk/src/backends/browser/canvaskit.ts',
    'Nelyx/sdk/src/backends/react-native/environment.ts',
    'Nelyx/sdk/src/platforms/web/application.ts',
    'Nelyx/sdk/src/runtime/worker-messages.ts',
  ])
    original.set(
      path.resolve(root, file),
      execFileSync('git', ['show', revision + ':' + file], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 1_200_000,
      }),
    );
  const declarations = new Map();
  const rewriteImports = (context) => {
    const factory = context.factory;
    const rewrite = (specifier) => {
      if (
        !specifier ||
        !ts.isStringLiteral(specifier) ||
        !specifier.text.startsWith('.') ||
        !/\.tsx?$/.test(specifier.text) ||
        specifier.text.endsWith('.d.ts')
      )
        return specifier;
      return ts.setOriginalNode(
        ts.setTextRange(
          factory.createStringLiteral(specifier.text.replace(/\.tsx?$/, '.js')),
          specifier,
        ),
        specifier,
      );
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node))
        return factory.updateImportDeclaration(
          node,
          node.modifiers,
          node.importClause,
          rewrite(node.moduleSpecifier),
          node.attributes,
        );
      if (ts.isExportDeclaration(node))
        return factory.updateExportDeclaration(
          node,
          node.modifiers,
          node.isTypeOnly,
          node.exportClause,
          rewrite(node.moduleSpecifier),
          node.attributes,
        );
      if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      )
        return factory.updateImportTypeNode(
          node,
          factory.updateLiteralTypeNode(node.argument, rewrite(node.argument.literal)),
          node.attributes,
          node.qualifier,
          node.typeArguments,
          node.isTypeOf,
        );
      return ts.visitEachChild(node, visit, context);
    };
    return (node) => ts.visitNode(node, visit);
  };
  for (const [directory, configuration] of [
    ['Nelyx', 'tsconfig.build.json'],
    ['Nelyx', 'runtime/tsconfig.json'],
    ['Nelyx/skia/packages/native', 'tsconfig.build.json'],
    ['Nelyx/sdk', 'tsconfig.build.json'],
  ]) {
    const configFile = path.join(root, directory, configuration);
    const config = ts.readConfigFile(configFile, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configFile), {
      noEmit: false,
      emitDeclarationOnly: true,
    });
    const host = ts.createCompilerHost(parsed.options),
      getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (file, language, onError, create) => {
      const text = original.get(path.resolve(file)) ?? declarations.get(path.resolve(file));
      return text === undefined
        ? getSourceFile(file, language, onError, create)
        : ts.createSourceFile(file, text, language, true);
    };
    const program = ts.createProgram(
      parsed.fileNames.filter(
        (file) => !file.replaceAll('\\', '/').endsWith('/runtime/engine-client/original.ts'),
      ),
      parsed.options,
      host,
    );
    const errors = ts
      .getPreEmitDiagnostics(program)
      .filter((item) => item.category === ts.DiagnosticCategory.Error);
    if (errors.length)
      throw Error(
        ts.formatDiagnostics(errors, {
          getCanonicalFileName: (file) => file,
          getCurrentDirectory: () => root,
          getNewLine: () => '\n',
        }),
      );
    const result = program.emit(
      undefined,
      (file, data, _bom, _error, sources) => {
        if (
          file.endsWith('.d.ts') &&
          sources?.some((source) => original.has(path.resolve(source.fileName)))
        )
          declarations.set(path.resolve(file), data);
      },
      undefined,
      true,
      { afterDeclarations: [rewriteImports] },
    );
    if (result.emitSkipped) throw Error('Original declaration reconstruction failed');
  }
  if (declarations.size !== original.size)
    throw Error('Original declaration reconstruction was incomplete');
  return declarations;
}

// Provenance stays outside the declaration shape, preserving every original hash.
// A textual property named "__@iterator@123" is never mistaken for a compiler symbol.
const computedMemberNames = new WeakMap();
export function recordComputedMemberName(member, name, previousName = name) {
  computedMemberNames.set(member, { name, previousName });
}
const normalizedTypes = new Map();
function normalizedType(text, kind) {
  if (!text.includes('|')) return text;
  const cacheKey = kind + ':' + text;
  if (normalizedTypes.has(cacheKey)) return normalizedTypes.get(cacheKey);
  const prefix =
    kind === 'signature'
      ? 'interface __Scope { __call'
      : kind === 'parameter'
        ? 'interface __Scope<'
        : 'type __Scope = ';
  const suffix = kind === 'signature' ? '; }' : kind === 'parameter' ? '> {}' : ';';
  const input = prefix + text + suffix;
  const source = ts.createSourceFile(
    'api-surface.ts',
    input,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (source.parseDiagnostics.length) return text;
  const render = (node) => {
    if (ts.isUnionTypeNode(node)) return node.types.map(render).sort().join(' | ');
    let result = '',
      cursor = node.getStart(source);
    ts.forEachChild(node, (child) => {
      const start = child.getStart(source);
      result += input.slice(cursor, start) + render(child);
      cursor = child.end;
    });
    return result + input.slice(cursor, node.end);
  };
  const result = render(source).slice(prefix.length, -suffix.length);
  if (normalizedTypes.size >= 32768) normalizedTypes.clear();
  normalizedTypes.set(cacheKey, result);
  return result;
}
export function stableApiSurface(surface, { previousNames = false, unions = true } = {}) {
  const result = JSON.parse(
    JSON.stringify(surface, function (key, value) {
      const names = computedMemberNames.get(this);
      return key === 'name' && names ? (previousNames ? names.previousName : names.name) : value;
    }),
  );
  const sort = (value) => {
    if (!value || typeof value !== 'object') return;
    if (
      Array.isArray(value) &&
      value.every(
        (item) => item && typeof item.name === 'string' && typeof item.visibility === 'string',
      )
    )
      value.sort((a, b) => a.name.localeCompare(b.name));
    for (const [key, child] of Object.entries(value)) {
      if (
        unions &&
        typeof child === 'string' &&
        ['type', 'key', 'value', 'definition'].includes(key)
      )
        value[key] = normalizedType(child, 'type');
      else if (
        unions &&
        Array.isArray(child) &&
        ['calls', 'constructors', 'typeParameters'].includes(key)
      )
        value[key] = child.map((item) =>
          typeof item === 'string'
            ? normalizedType(item, key === 'typeParameters' ? 'parameter' : 'signature')
            : item,
        );
      else sort(child);
    }
  };
  sort(result);
  return result;
}
