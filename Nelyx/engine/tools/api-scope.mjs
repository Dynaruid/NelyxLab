// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Read the original declaration cohort into memory. Mixing selected old files
// with today's dependent runtime can no longer typecheck after API expansion.
// No historical package, SDK tree, or emitted file is copied or retained.
export function originalApiDeclarations(
  root,
  revision = '2f77d4227adb31d36dcc9b321f997a47fae0dea7',
) {
  const cohort = revision,
    options = { cwd: root, windowsHide: true, timeout: 1_200_000, maxBuffer: 64 * 1024 * 1024 },
    files = execFileSync('git', ['ls-tree', '-r', '--name-only', cohort], {
      ...options,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(
        (file) =>
          /^(?:Nelyx\/(?:src|runtime|sdk\/src|skia\/packages\/native\/src)|packages\/(?:material|cupertino)\/src)\//.test(
            file,
          ) && /\.[cm]?tsx?$/.test(file),
      ),
    bytes = execFileSync('git', ['cat-file', '--batch'], {
      ...options,
      input: files.map((file) => cohort + ':' + file).join('\n') + '\n',
    }),
    original = new Map();
  let cursor = 0;
  for (const file of files) {
    const end = bytes.indexOf(10, cursor),
      header = bytes
        .subarray(cursor, end)
        .toString('utf8')
        .match(/^[a-f0-9]+ blob (\d+)$/);
    if (end < cursor || !header) throw Error('Original source object is unavailable: ' + file);
    const size = Number(header[1]);
    original.set(
      path.resolve(root, file),
      bytes.subarray(end + 1, end + 1 + size).toString('utf8'),
    );
    cursor = end + 2 + size;
  }
  const selected = [
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
  ];
  const declarations = new Map(),
    emitted = new Set();
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
    ['packages/cupertino', 'tsconfig.build.json'],
    ['packages/material', 'tsconfig.build.json'],
    ['Nelyx/sdk', 'tsconfig.build.json'],
  ]) {
    const configFile = path.join(root, directory, configuration);
    const config = ts.readConfigFile(configFile, () =>
      execFileSync(
        'git',
        ['show', cohort + ':' + path.relative(root, configFile).replaceAll('\\', '/')],
        { ...options, encoding: 'utf8' },
      ),
    );
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
        (file) =>
          original.has(path.resolve(file)) &&
          !file.replaceAll('\\', '/').endsWith('/runtime/engine-client/original.ts'),
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
        ) {
          declarations.set(path.resolve(file), data);
          for (const source of sources) emitted.add(path.resolve(source.fileName));
        }
      },
      undefined,
      true,
      { afterDeclarations: [rewriteImports] },
    );
    if (result.emitSkipped) throw Error('Original declaration reconstruction failed');
  }
  if (selected.some((file) => !emitted.has(path.resolve(root, file))))
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
function normalizedType(text, kind, properties = false, unions = true) {
  if (!properties && !text.includes('|')) return text;
  const cacheKey = kind + ':' + properties + ':' + unions + ':' + text;
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
    if (unions && ts.isUnionTypeNode(node)) return node.types.map(render).sort().join(' | ');
    if (
      properties &&
      ts.isTypeLiteralNode(node) &&
      node.members.length &&
      node.members.every(
        (member) =>
          ts.isPropertySignature(member) &&
          (ts.isIdentifier(member.name) ||
            ts.isStringLiteral(member.name) ||
            ts.isNumericLiteral(member.name)),
      )
    ) {
      const names = node.members.map((member) => member.name.text);
      if (new Set(names).size === names.length)
        return (
          '{ ' +
          [...node.members]
            .sort((a, b) => a.name.text.localeCompare(b.name.text))
            .map(render)
            .join(' ') +
          ' }'
        );
    }
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
export function stableApiSurface(
  surface,
  { previousNames = false, unions = true, properties = false } = {},
) {
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
        (unions || properties) &&
        typeof child === 'string' &&
        ['type', 'key', 'value', 'definition'].includes(key)
      )
        value[key] = normalizedType(child, 'type', properties, unions);
      else if (
        unions &&
        Array.isArray(child) &&
        ['calls', 'constructors', 'typeParameters'].includes(key)
      )
        value[key] = child.map((item) =>
          typeof item === 'string'
            ? normalizedType(
                item,
                key === 'typeParameters' ? 'parameter' : 'signature',
                properties,
                unions,
              )
            : item,
        );
      else sort(child);
    }
  };
  sort(result);
  return result;
}
