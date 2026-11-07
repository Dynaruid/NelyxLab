// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';
import fs from 'node:fs';
import { runTypeScriptCompiler } from '../../sdk/tooling/metro/src/typescript-compiler.cjs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { engineV2ImportRoute } from '../../sdk/tooling/cli/src/engine-v2-data-api.mjs';
import {
  stableApiSurface,
  recordComputedMemberName,
  originalApiDeclarations,
} from './api-scope.mjs';

const repository = path.resolve(import.meta.dirname, '../../..');
const defaultPackages = ['Nelyx', 'packages/material', 'packages/cupertino', 'Nelyx/sdk'];
const typeFlags =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
const isCode = (name) => /\.[cm]?[jt]sx?$/.test(name);
const select = (value, conditions) => {
  if (typeof value === 'string') return value;
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  for (const condition of conditions) {
    const result = select(value[condition], conditions);
    if (result) return result;
  }
  return null;
};
const publicName = (pkg, subpath) => pkg + (subpath === '.' ? '' : subpath.slice(1));
const isV2Module = (pkg, module) =>
  module.subpath === pkg.v2 ||
  module.subpath.startsWith(pkg.v2 + '/') ||
  module.subpath.startsWith(pkg.v2 + '-');

/** Applicability follows the original platform/backend entry, never v2 support. */
export function engineV2ApiTarget(module, target) {
  if (!['windows', 'web'].includes(target)) throw new Error('Unknown API target: ' + target);
  const platform = module.match(
    /@nelyx\/sdk\/(?:platforms|native)\/(windows|web|android|ios|linux|macos)(?:\/|$)/,
  );
  if (platform)
    return {
      applicable: platform[1] === target,
      reason: 'original platform entry: ' + platform[1],
    };
  const provider = module.match(
    /@nelyx\/sdk\/providers\/(windows|web|android|ios|linux|macos)\.json$/,
  );
  if (provider)
    return {
      applicable: provider[1] === target,
      reason: 'original provider asset: ' + provider[1],
    };
  if (module.startsWith('@nelyx/sdk/backends/browser/'))
    return { applicable: target === 'web', reason: 'original browser backend' };
  if (module.startsWith('@nelyx/sdk/backends/react-native/apple-'))
    return { applicable: false, reason: 'original Apple backend; deferred target' };
  if (/^@nelyx\/sdk\/backends\/(?:react-native|native-hermes)\//.test(module))
    return { applicable: target === 'windows', reason: 'original native backend' };
  return { applicable: true, reason: 'shared original public entry' };
}

/** Resolve actual public imports in a consumer, with no ambient declaration suppression. */
export function checkEngineV2ApiTarget({
  root,
  modules,
  target,
  compilerRoot = root,
  compilerPackage = path.resolve(compilerRoot) === repository ? '@typescript/native' : 'typescript',
}) {
  const applicable = modules.filter((module) => engineV2ApiTarget(module.name, target).applicable),
    directory = fs.mkdtempSync(path.join(root, '.nelyx-api-')),
    filename = path.join(directory, 'consumer.mts'),
    project = path.join(directory, 'tsconfig.json'),
    options = {
      noEmit: true,
      strict: true,
      skipLibCheck: false,
      types: [],
      lib: target === 'web' ? ['ES2022', 'DOM'] : ['ES2022'],
      jsx: 'react-jsx',
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      customConditions: target === 'web' ? ['browser'] : [],
    },
    errors = [],
    files = new Set(),
    resolutions = new Map();
  let compilerVersion = 'unavailable';
  try {
    fs.writeFileSync(
      filename,
      applicable
        .filter((module) => module.code)
        .map(
          (module, index) =>
            'import * as api' +
            index +
            ' from ' +
            JSON.stringify(module.name) +
            '; export {api' +
            index +
            '};',
        )
        .join('\n'),
    );
    fs.writeFileSync(project, JSON.stringify({ compilerOptions: options, files: [filename] }));
    const checked = runTypeScriptCompiler(
      compilerRoot,
      ['-p', project, '--pretty', 'false', '--listFiles', '--traceResolution', '--singleThreaded'],
      compilerPackage,
    );
    compilerVersion = checked.version;
    let resolving;
    for (const line of (checked.stdout + '\n' + checked.stderr).split(/\r?\n/)) {
      const begin = /^======== Resolving module '(.+)' from '(.+)'\. ========$/.exec(line),
        resolved = /^======== Module name '(.+)' was successfully resolved to '(.+?)'/.exec(line);
      if (begin)
        resolving = {
          name: begin[1],
          direct:
            fs.existsSync(begin[2]) && fs.realpathSync(begin[2]) === fs.realpathSync(filename),
        };
      else if (resolved && resolving?.direct && resolving.name === resolved[1])
        resolutions.set(resolved[1], fs.realpathSync(resolved[2]));
      const error = /^(.*?)(?:\((\d+),(\d+)\))?:?\s*error TS(\d+):\s*(.*)$/.exec(line);
      if (error)
        errors.push({
          code: 'TS' + error[4],
          message: error[5],
          ...(error[1] ? { file: error[1] + (error[2] ? ':' + error[2] : '') } : {}),
        });
      else if (line.trim() && fs.existsSync(line.trim())) files.add(fs.realpathSync(line.trim()));
    }
    if (checked.status !== 0 && !errors.length)
      errors.push({ code: 'nativeCompilerFailed', message: checked.stdout + checked.stderr });
    for (const module of applicable.filter((module) => module.code))
      if (
        !fs.existsSync(module.file) ||
        !files.has(fs.realpathSync(module.file)) ||
        resolutions.get(module.name) !== fs.realpathSync(module.file)
      )
        errors.push({
          code: 'consumerResolution',
          message: 'Public import does not resolve to its declared entry: ' + module.name,
        });
  } catch (error) {
    errors.push({ code: 'compilerUnavailable', message: String(error) });
  } finally {
    try {
      if (
        path.dirname(path.resolve(directory)) !== path.resolve(root) ||
        !path.basename(directory).startsWith('.nelyx-api-')
      )
        errors.push({ code: 'consumerCleanup', message: 'Unexpected API consumer cleanup target' });
      else fs.rmSync(directory, { recursive: true, force: true });
    } catch (error) {
      errors.push({ code: 'consumerCleanup', message: String(error) });
    }
  }
  return {
    target,
    compiler: compilerVersion,
    moduleResolution: 'NodeNext',
    conditions: options.customConditions,
    lib: target === 'web' ? ['lib.es2022.d.ts', 'lib.dom.d.ts'] : ['lib.es2022.d.ts'],
    types: [],
    skipLibCheck: false,
    inputValid: !errors.length,
    errors,
    modules: modules.map((module) => ({
      module: module.name,
      ...engineV2ApiTarget(module.name, target),
    })),
    counts: {
      total: modules.length,
      applicable: applicable.length,
      notApplicable: modules.length - applicable.length,
      unverified: 0,
    },
  };
}

const overriddenAssets = new WeakMap();
const assetBytes = (entry) => overriddenAssets.get(entry) ?? fs.readFileSync(entry.original);
const projectJson = (actual, shape) => {
  if (!shape || typeof shape !== 'object' || Array.isArray(shape)) return actual;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return actual;
  return Object.fromEntries(
    Object.keys(shape).map((key) => [
      key,
      Object.hasOwn(actual, key)
        ? projectJson(actual[key], shape[key])
        : { missingOriginalKey: key },
    ]),
  );
};
const surfaceHash = (
  entry,
  root,
  stable = false,
  { unions = true, properties = false, jsonShape } = {},
) =>
  createHash('sha256')
    .update(
      entry.kind === 'asset'
        ? stable && jsonShape
          ? JSON.stringify(projectJson(JSON.parse(assetBytes(entry).toString('utf8')), jsonShape))
          : assetBytes(entry)
        : JSON.stringify(
            stable ? stableApiSurface(entry.original, { unions, properties }) : entry.original,
            (_key, value) =>
              typeof value === 'string'
                ? value.replaceAll(root.replaceAll('\\', '/'), '<root>').replaceAll(root, '<root>')
                : value,
          ),
    )
    .digest('hex');

/** Canonical compatibility input, not a test receipt. Updating it changes API scope. */
export function engineV2OriginalSurface(result, root = repository, { stable = false } = {}) {
  return {
    schema: stable ? 'nelyx.api.original/3' : 'nelyx.api.original/1',
    ...(stable ? { normalization: 'computed-symbol-identity-and-unions-v2' } : {}),
    packages: result.packages.map((pkg) => ({
      package: pkg.package,
      modules: pkg.modules.map((module) => {
        const asset = module.entries.find(
          (entry) => entry.kind === 'asset' && entry.module.endsWith('/package.json'),
        );
        const jsonShape =
          stable && asset ? JSON.parse(assetBytes(asset).toString('utf8')) : undefined;
        return {
          module: module.module,
          kind: module.kind,
          ...(jsonShape ? { jsonShape } : {}),
          exports: module.entries.map((entry) => [
            entry.name,
            surfaceHash(entry, root),
            ...(stable ? [surfaceHash(entry, root, true, { jsonShape })] : []),
          ]),
        };
      }),
    })),
  };
}

/** Declarations are evidence inputs: a missing/invalid module always fails the gate. */
export async function auditEngineV2Api({
  root = repository,
  directories = defaultPackages,
  verify = false,
  contracts,
  resolveRoute = engineV2ImportRoute,
  scope,
  targets = root === repository ? ['windows', 'web'] : [],
  declarationOverrides,
  assetOverrides,
  originalDeclarations = root === repository ? () => originalApiDeclarations(root) : undefined,
} = {}) {
  root = fs.realpathSync(root);
  const errors = [],
    packages = [];
  const fail = (code, message, file) => errors.push({ code, message, ...(file ? { file } : {}) });
  for (const directory of directories) {
    const absolute = path.resolve(root, directory);
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(absolute, 'package.json'), 'utf8'));
      if (!manifest.name || !manifest.exports || typeof manifest.exports !== 'object')
        throw Error('Package name and an explicit public export map are required');
      const modules = Object.entries(manifest.exports).map(([subpath, value]) => {
        const target = select(value, ['types', 'import', 'default']),
          runtime = select(value, ['import', 'default']);
        const module = {
          subpath,
          name: publicName(manifest.name, subpath),
          file: target && path.resolve(absolute, target),
          runtime: runtime && path.resolve(absolute, runtime),
        };
        for (const [kind, file] of [
          ['declaration', module.file],
          ['runtime', module.runtime],
        ]) {
          if (!file) {
            fail('exportTarget', `Missing ${kind} export target: ${module.name}`);
            continue;
          }
          const relative = path.relative(absolute, file);
          if (
            relative.startsWith('..' + path.sep) ||
            relative === '..' ||
            path.isAbsolute(relative)
          )
            fail('exportTarget', `Export leaves its package: ${module.name}`, file);
          else if (!fs.existsSync(file) || !fs.statSync(file).isFile())
            fail('missingFile', `Unreadable ${kind} export: ${module.name}`, file);
        }
        module.code = !!module.file && isCode(module.file);
        return module;
      });
      const v2 = manifest.name === '@nelyx/sdk' ? './engine-v2' : './v2';
      if (!modules.some((module) => module.subpath === v2))
        fail('missingV2Entry', `Missing ${manifest.name}${v2.slice(1)} entry`);
      packages.push({ name: manifest.name, absolute, modules, v2 });
    } catch (error) {
      fail('manifest', `${directory}: ${error}`);
    }
  }
  const options = {
    noEmit: true,
    allowJs: true,
    skipLibCheck: false,
    strict: true,
    types: ['node'],
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  };
  const inventoryHost = ts.createCompilerHost(options);
  if (declarationOverrides?.size) {
    const getSourceFile = inventoryHost.getSourceFile.bind(inventoryHost);
    inventoryHost.getSourceFile = (file, language, onError, create) =>
      declarationOverrides.has(path.resolve(file))
        ? ts.createSourceFile(file, declarationOverrides.get(path.resolve(file)), language, true)
        : getSourceFile(file, language, onError, create);
  }
  const program = ts.createProgram(
      packages.flatMap((pkg) =>
        pkg.modules
          .filter(
            (module) => module.code && (!isV2Module(pkg, module) || module.subpath === pkg.v2),
          )
          .map((module) => module.file),
      ),
      options,
      inventoryHost,
    ),
    checker = program.getTypeChecker();
  // This program preserves the pinned inventory's representation. Platform input
  // validity is checked by real imports in separate, explicitly typed consumers.
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    if (targets.length) continue;
    if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
    const position =
      diagnostic.file && diagnostic.start !== undefined
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        : undefined;
    fail(
      `TS${diagnostic.code}`,
      ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
      diagnostic.file && diagnostic.file.fileName + (position ? `:${position.line + 1}` : ''),
    );
  }
  const exportsOf = (module) => {
    if (!module?.code) return [];
    const source = program.getSourceFile(module.file),
      symbol = source && checker.getSymbolAtLocation(source);
    if (!symbol) {
      fail('moduleResolution', `No readable external module: ${module.name}`, module.file);
      return [];
    }
    return checker.getExportsOfModule(symbol);
  };
  const unalias = (symbol) =>
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const symbolType = (symbol) => {
    symbol = unalias(symbol);
    if (!(symbol.flags & ts.SymbolFlags.Value) && symbol.flags & ts.SymbolFlags.Type)
      return checker.getDeclaredTypeOfSymbol(symbol);
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    return declaration && checker.getTypeOfSymbolAtLocation(symbol, declaration);
  };
  const computedMembers = [];
  const members = (type) =>
    type
      .getProperties()
      .flatMap((property) => {
        const declarations = property.declarations ?? [],
          flags = declarations.reduce(
            (result, declaration) => result | ts.getCombinedModifierFlags(declaration),
            0,
          );
        if (flags & ts.ModifierFlags.Private || property.name.startsWith('#')) return [];
        if (
          declarations.length &&
          declarations.every((declaration) =>
            program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
          )
        )
          return [];
        const type = symbolType(property);
        const member = {
          name: property.name,
          visibility: flags & ts.ModifierFlags.Protected ? 'protected' : 'public',
          optional: !!(property.flags & ts.SymbolFlags.Optional),
          readonly: !!(flags & ts.ModifierFlags.Readonly),
          type: type ? checker.typeToString(type, undefined, typeFlags) : null,
          calls:
            type
              ?.getCallSignatures()
              .map((signature) => checker.signatureToString(signature, undefined, typeFlags)) ?? [],
          getter: declarations.some(ts.isGetAccessorDeclaration),
          setter: declarations.some(ts.isSetAccessorDeclaration),
        };
        if (property.name.startsWith('__@')) {
          const declaration = declarations.find(
            (item) => item.name && ts.isComputedPropertyName(item.name),
          );
          if (declaration)
            computedMembers.push({ member, expression: declaration.name.expression });
        }
        return [member];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  const shape = (symbol) => {
    const type = symbolType(symbol);
    if (!type) {
      fail('symbolResolution', `No type for export ${symbol.name}`);
      return null;
    }
    const original = unalias(symbol);
    const indexes = (value) =>
      checker.getIndexInfosOfType(value).map((index) => ({
        key: checker.typeToString(index.keyType, undefined, typeFlags),
        value: checker.typeToString(index.type, undefined, typeFlags),
        readonly: index.isReadonly,
      }));
    return {
      kind: original.flags & ts.SymbolFlags.Value ? 'value' : 'type',
      constructors: type
        .getConstructSignatures()
        .map((signature) => checker.signatureToString(signature, undefined, typeFlags)),
      calls: type
        .getCallSignatures()
        .map((signature) => checker.signatureToString(signature, undefined, typeFlags)),
      value: checker.typeToString(type, undefined, typeFlags),
      definition:
        original.flags & ts.SymbolFlags.TypeAlias
          ? checker.typeToString(type, undefined, typeFlags | ts.TypeFormatFlags.InTypeAlias)
          : null,
      indexes: indexes(type),
      members: members(type),
      instances: type
        .getConstructSignatures()
        .map((signature) => members(signature.getReturnType())),
      instanceIndexes: type
        .getConstructSignatures()
        .map((signature) => indexes(signature.getReturnType())),
      declarations:
        original.declarations?.flatMap((declaration) =>
          'typeParameters' in declaration
            ? [
                {
                  typeParameters:
                    declaration.typeParameters?.map((parameter) => parameter.getText()) ?? [],
                },
              ]
            : [],
        ) ?? [],
    };
  };
  const require = createRequire(path.join(root, 'package.json'));
  const obligationsOf = (surface) => {
    if (!surface) return [];
    surface = stableApiSurface(surface);
    const obligations = [
      ...surface.constructors.map((_, index) => `construct:${index}`),
      ...surface.calls.map((_, index) => `call:${index}`),
      ...surface.indexes.map((_, index) => `index:${index}`),
      ...surface.members
        .filter((member) => member.name !== 'prototype')
        .map((member) => `static:${member.name}`),
      ...surface.instances.flatMap((members, index) =>
        members.map((member) => `instance:${index}:${member.name}`),
      ),
      ...surface.instanceIndexes.flatMap((indexes, constructor) =>
        indexes.map((_, index) => `instance-index:${constructor}:${index}`),
      ),
      ...(surface.kind === 'type' ? ['type'] : []),
    ];
    return obligations.length ? obligations : ['value'];
  };
  const results = packages.map((pkg) => {
    const v2 = new Map(
      exportsOf(pkg.modules.find((module) => module.subpath === pkg.v2)).map((symbol) => [
        symbol.name,
        symbol,
      ]),
    );
    const modules = pkg.modules
      .filter((module) => !isV2Module(pkg, module))
      .map((module) => {
        const symbols = exportsOf(module),
          route = resolveRoute(module.name),
          routeModule =
            route && packages.flatMap((item) => item.modules).find((item) => item.name === route),
          routed =
            routeModule && new Map(exportsOf(routeModule).map((symbol) => [symbol.name, symbol]));
        let resolved;
        if (route) {
          try {
            resolved = fs.realpathSync(require.resolve(route));
            if (!routeModule || resolved !== fs.realpathSync(routeModule.runtime))
              fail(
                'runtimeRoute',
                `Import route has no matching declared implementation: ${module.name}`,
                resolved,
              );
          } catch (error) {
            fail('runtimeRoute', `${module.name}: ${error}`);
          }
        }
        const entries = !module.code
          ? [
              {
                module: module.name,
                name: '*',
                kind: 'asset',
                original: module.file,
                replacement: null,
                route: null,
                status: 'assetUnverified',
                behavior: [],
              },
            ]
          : !symbols.length
            ? [
                {
                  module: module.name,
                  name: '*',
                  kind: 'module',
                  original: module.file,
                  replacement: null,
                  route: route && { module: route, resolved },
                  status: 'moduleUnverified',
                  behavior: [],
                },
              ]
            : symbols.map((symbol) => {
                const original = shape(symbol),
                  candidate = route ? routed?.get(symbol.name) : v2.get(symbol.name),
                  replacement = candidate ? shape(candidate) : null,
                  candidateType = candidate && symbolType(candidate),
                  originalType = symbolType(symbol),
                  assignable = !!(
                    candidateType &&
                    originalType &&
                    checker.isTypeAssignableTo(candidateType, originalType) &&
                    checker.isTypeAssignableTo(originalType, candidateType)
                  ),
                  signatureMatches =
                    !!replacement && JSON.stringify(original) === JSON.stringify(replacement);
                return {
                  module: module.name,
                  name: symbol.name,
                  kind: original?.kind,
                  original,
                  replacement,
                  route: route ? { module: route, symbol: symbol.name, resolved } : null,
                  candidate:
                    !route && candidate
                      ? { module: publicName(pkg.name, pkg.v2), symbol: candidate.name }
                      : null,
                  assignable,
                  signatureMatches,
                  behavior: [],
                  obligations: obligationsOf(original),
                  unverified: obligationsOf(original),
                  declarations:
                    unalias(symbol).declarations?.map((declaration) => ({
                      file: declaration.getSourceFile().fileName,
                      line:
                        declaration
                          .getSourceFile()
                          .getLineAndCharacterOfPosition(declaration.getStart()).line + 1,
                    })) ?? [],
                  status: !candidate
                    ? 'missing'
                    : !signatureMatches || !assignable
                      ? 'signatureChanged'
                      : route === module.name
                        ? 'canonicalDataReuseBehaviorUnverified'
                        : 'signatureMatchBehaviorUnverified',
                };
              });
        return {
          module: module.name,
          kind: module.code ? 'code' : 'asset',
          file: module.file,
          runtime: module.runtime,
          exportCount: symbols.length,
          entries,
        };
      });
    return {
      package: pkg.name,
      legacySubpaths: modules.length,
      v2Symbols: v2.size,
      modules,
      entries: modules.flatMap((module) => module.entries),
    };
  });
  if (assetOverrides?.size)
    for (const entry of results.flatMap((pkg) => pkg.entries))
      if (entry.kind === 'asset' && assetOverrides.has(path.resolve(entry.original)))
        overriddenAssets.set(entry, assetOverrides.get(path.resolve(entry.original)));
  // Resolve computed-name provenance only after all raw shapes are captured.
  // Compiler global symbol allocation must not perturb the legacy fingerprints.
  for (const { member, expression } of computedMembers) {
    if (!(checker.getTypeAtLocation(expression).flags & ts.TypeFlags.UniqueESSymbol)) continue;
    let symbol = checker.getSymbolAtLocation(expression);
    if (!symbol) {
      fail('computedSymbol', 'No declaration identity for ' + member.name);
      continue;
    }
    symbol = unalias(symbol);
    const declarations = symbol.declarations ?? [];
    const library =
      declarations.length &&
      declarations.every((item) => program.isSourceFileDefaultLibrary(item.getSourceFile()));
    let identity;
    if (!library) {
      const file = declarations[0]?.getSourceFile().fileName;
      const actual = file && fs.realpathSync(file);
      const pkg =
        actual &&
        packages.find((pkg) => {
          const relative = path.relative(fs.realpathSync(pkg.absolute), actual);
          return (
            relative &&
            relative !== '..' &&
            !relative.startsWith('..' + path.sep) &&
            !path.isAbsolute(relative)
          );
        });
      if (!pkg) {
        fail('computedSymbol', 'No portable declaration package for ' + member.name);
        continue;
      }
      const relative = path
        .relative(fs.realpathSync(pkg.absolute), actual)
        .replaceAll('\\', '/')
        .replace(/^dist\//, '')
        .replace(/\.d\.[cm]?ts$/, '');
      const qualified = checker.getFullyQualifiedName(symbol);
      const suffix = qualified.startsWith('"')
        ? qualified.slice(qualified.indexOf('"', 1) + 1)
        : '.' + qualified;
      identity = '__@unique:"' + pkg.name + '/' + relative + '"' + suffix;
    }
    recordComputedMemberName(
      member,
      library ? member.name.replace(/@\d+$/, '') : identity,
      library
        ? member.name.replace(/@\d+$/, '')
        : '__@unique:' + checker.getFullyQualifiedName(symbol),
    );
  }
  for (const entry of results.flatMap((pkg) => pkg.entries))
    if (entry.original && entry.kind !== 'asset' && entry.kind !== 'module') {
      entry.obligations = obligationsOf(entry.original);
      entry.unverified = [...entry.obligations];
    }
  if (!targets.length) {
    const additional = packages.flatMap((pkg) =>
      pkg.modules
        .filter((module) => module.code && isV2Module(pkg, module) && module.subpath !== pkg.v2)
        .map((module) => module.file),
    );
    if (additional.length)
      for (const diagnostic of ts.getPreEmitDiagnostics(
        ts.createProgram(additional, options, inventoryHost),
      ))
        if (diagnostic.category === ts.DiagnosticCategory.Error)
          fail(
            'TS' + diagnostic.code,
            ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
            diagnostic.file?.fileName,
          );
  }
  const cases = [];
  if (verify) {
    contracts ??= (await import('./api-behavior.mjs')).engineV2ApiContracts;
    const entries = results.flatMap((pkg) => pkg.entries),
      ids = new Set();
    for (const contract of contracts) {
      const targets = contract.exports.map(({ module, name }) =>
        entries.find((entry) => entry.module === module && entry.name === name),
      );
      let error;
      if (
        !contract.id ||
        ids.has(contract.id) ||
        !targets.length ||
        targets.some(
          (entry, index) =>
            !entry?.route ||
            !entry.signatureMatches ||
            !entry.assignable ||
            !contract.exports[index].covers?.length ||
            contract.exports[index].covers.some((item) => !entry.obligations.includes(item)),
        )
      )
        error =
          'Behavior case requires a unique ID, a real import route, compatible surface and explicit overload/member coverage';
      else {
        try {
          await contract.run({
            load: (name) => require(name),
            replacement: (name) => {
              const route = resolveRoute(name);
              if (!route) throw Error('No original import route: ' + name);
              return require(route);
            },
          });
        } catch (failure) {
          error = String(failure);
        }
      }
      ids.add(contract.id);
      cases.push({ id: contract.id, passed: !error, ...(error ? { error } : {}) });
      for (const [index, entry] of targets.entries()) {
        if (!entry) continue;
        entry.behavior.push({
          id: contract.id,
          passed: !error,
          covers: contract.exports[index].covers ?? [],
        });
        const covered = new Set(
          entry.behavior.filter((item) => item.passed).flatMap((item) => item.covers),
        );
        entry.unverified = entry.obligations.filter((item) => !covered.has(item));
        entry.status = entry.behavior.some((item) => !item.passed)
          ? 'behaviorFailed'
          : entry.unverified.length
            ? 'behaviorPartiallyVerified'
            : 'behaviorVerified';
      }
    }
  }
  if (!scope && root === fs.realpathSync(repository)) {
    try {
      scope = JSON.parse(
        fs.readFileSync(new URL('../schema/public-api.json', import.meta.url), 'utf8'),
      );
    } catch (error) {
      fail('originalScope', 'Unreadable canonical public API scope: ' + error);
    }
  }
  if (scope) {
    if (
      !['nelyx.api.original/1', 'nelyx.api.original/2', 'nelyx.api.original/3'].includes(
        scope.schema,
      ) ||
      (scope.schema === 'nelyx.api.original/2' &&
        scope.normalization !== 'computed-symbol-identity-v1') ||
      (scope.schema === 'nelyx.api.original/3' &&
        scope.normalization !== 'computed-symbol-identity-and-unions-v2') ||
      !Array.isArray(scope.packages) ||
      !scope.packages.length ||
      scope.packages.some(
        (pkg) =>
          !pkg ||
          typeof pkg.package !== 'string' ||
          !Array.isArray(pkg.modules) ||
          !pkg.modules.length ||
          pkg.modules.some(
            (module) =>
              !module ||
              typeof module.module !== 'string' ||
              !['code', 'asset'].includes(module.kind) ||
              !Array.isArray(module.exports) ||
              !module.exports.length ||
              module.exports.some(
                (item) =>
                  !Array.isArray(item) ||
                  item.length !== (scope.schema === 'nelyx.api.original/1' ? 2 : 3) ||
                  typeof item[0] !== 'string' ||
                  !/^[a-f0-9]{64}$/.test(item[1]) ||
                  (scope.schema !== 'nelyx.api.original/1' && !/^[a-f0-9]{64}$/.test(item[2])),
              ),
          ),
      )
    )
      fail('originalScope', 'Invalid canonical public API scope');
    else
      for (const expected of scope.packages) {
        const pkg = results.find((pkg) => pkg.package === expected.package);
        if (!pkg) {
          fail('missingOriginalPackage', expected.package);
          continue;
        }
        for (const original of expected.modules) {
          const module = pkg.modules.find((module) => module.module === original.module);
          if (!module) {
            fail('missingOriginalModule', original.module);
            continue;
          }
          if (original.kind !== module.kind)
            fail('originalSurfaceChanged', 'Public module kind changed: ' + original.module);
          for (const [name, hash, stableHash] of original.exports) {
            const entry = module.entries.find((entry) => entry.name === name);
            if (!entry) fail('missingOriginalExport', original.module + '#' + name);
            else if (
              entry.original &&
              (entry.kind !== 'asset' || fs.existsSync(entry.original)) &&
              surfaceHash(entry, root, !!stableHash, {
                unions: scope.schema === 'nelyx.api.original/3',
                jsonShape: original.jsonShape,
              }) !== (stableHash ?? hash)
            )
              fail('originalSurfaceChanged', original.module + '#' + name);
          }
        }
      }
  }
  let scopeNormalization;
  if (
    !declarationOverrides &&
    originalDeclarations &&
    scope?.schema === 'nelyx.api.original/3' &&
    errors.some((error) => error.code === 'originalSurfaceChanged')
  ) {
    try {
      const baseline = await auditEngineV2Api({
        root,
        directories,
        scope,
        targets,
        declarationOverrides: originalDeclarations(),
        assetOverrides,
        originalDeclarations: undefined,
      });
      if (!baseline.inputValid)
        throw Error('Reconstructed declarations do not match the pinned original hashes');
      const originals = new Map(
          baseline.packages
            .flatMap((pkg) => pkg.entries)
            .map((entry) => [entry.module + '#' + entry.name, entry]),
        ),
        current = new Map(
          results
            .flatMap((pkg) => pkg.entries)
            .map((entry) => [entry.module + '#' + entry.name, entry]),
        );
      let matched = 0;
      const extensions = [];
      for (let at = errors.length - 1; at >= 0; --at) {
        const error = errors[at],
          before = originals.get(error.message),
          after = current.get(error.message);
        if (
          error.code === 'originalSurfaceChanged' &&
          ['type', 'value'].includes(before?.kind) &&
          before.kind === after?.kind &&
          surfaceHash(before, root, true, { properties: true }) ===
            surfaceHash(after, root, true, { properties: true })
        ) {
          errors.splice(at, 1);
          ++matched;
          continue;
        }
        // A class extension is a compatibility change, not an invalid original
        // input, only after every pinned member/constructor/index has been
        // reconstructed and matched exactly. It can never approve behavior or
        // structural compatibility: the entry remains signatureChanged even if
        // a current-surface behavior case passed. No original hash is replaced.
        const previous = before?.original,
          next = after?.original;
        if (
          error.code !== 'originalSurfaceChanged' ||
          before?.kind !== 'value' ||
          after?.kind !== 'value' ||
          !previous?.constructors.length ||
          previous.instances.length !== next?.instances.length
        )
          continue;
        const added = [];
        const project = (oldMembers, newMembers, prefix) => {
          const names = new Set(oldMembers.map((member) => member.name));
          return newMembers.filter((member) => {
            if (names.has(member.name)) return true;
            added.push(prefix + member.name);
            return false;
          });
        };
        const projected = {
          ...next,
          members: project(previous.members, next.members, 'static:'),
          instances: next.instances.map((members, index) =>
            project(previous.instances[index], members, `instance:${index}:`),
          ),
        };
        if (
          added.length &&
          surfaceHash(before, root, true, { properties: true }) ===
            surfaceHash({ ...after, original: projected }, root, true, { properties: true })
        ) {
          errors.splice(at, 1);
          after.status = 'signatureChanged';
          after.signatureMatches = false;
          after.assignable = false;
          after.originalSurfaceExtension = {
            added,
            pinnedOriginalSha256: surfaceHash(before, root, true),
            structuralCompatibility: 'notApproved',
          };
          extensions.push({ export: error.message, ...after.originalSurfaceExtension });
        }
      }
      scopeNormalization = {
        matched,
        originalHashesPreserved: true,
        proof: 'reconstructed-original-declarations',
        ...(extensions.length ? { extensions } : {}),
      };
    } catch (error) {
      fail('originalScopeReconstruction', String(error).slice(0, 500));
    }
  }
  const targetInputs = targets.map((target) =>
    checkEngineV2ApiTarget({
      root,
      modules: packages.flatMap((pkg) => pkg.modules.filter((module) => module.subpath !== pkg.v2)),
      target,
    }),
  );
  for (const input of targetInputs) {
    const applicable = new Set(
      input.modules.filter((module) => module.applicable).map((module) => module.module),
    );
    const entries = results.flatMap((pkg) => pkg.entries);
    input.counts.occurrences = {
      total: entries.length,
      applicable: entries.filter((entry) => applicable.has(entry.module)).length,
      notApplicable: entries.filter((entry) => !applicable.has(entry.module)).length,
      unverified: 0,
    };
    for (const error of input.errors) errors.push({ ...error, target: input.target });
  }
  for (const pkg of results) {
    pkg.counts = {};
    for (const entry of pkg.entries) pkg.counts[entry.status] = (pkg.counts[entry.status] ?? 0) + 1;
  }
  return {
    schema: 'nelyx.api.v2.audit/3',
    inputValid: errors.length === 0,
    compatible:
      errors.length === 0 &&
      results.length > 0 &&
      results.length === directories.length &&
      results.every(
        (pkg) =>
          pkg.entries.length > 0 &&
          pkg.entries.every((entry) => entry.status === 'behaviorVerified'),
      ) &&
      cases.every((item) => item.passed),
    note: 'Original module/export occurrences, including protected hooks and non-code exports. Candidates are not import routes; signatures, aliases, allowlists and existing test files alone never approve behavior.',
    errors,
    ...(scopeNormalization ? { scopeNormalization } : {}),
    originalScope: Array.isArray(scope?.packages) && {
      packages: scope.packages.length,
      subpaths: scope.packages.reduce((sum, pkg) => sum + (pkg?.modules?.length ?? 0), 0),
    },
    cases,
    targetInputs,
    packages: results,
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await auditEngineV2Api({ verify: process.argv.includes('--verify') });
  console.log(
    JSON.stringify(
      process.argv.includes('--summary')
        ? {
            ...result,
            errors: result.errors.slice(0, 8),
            errorCount: result.errors.length,
            targetInputs: result.targetInputs.map(({ modules, errors, ...input }) => ({
              ...input,
              errorCount: errors.length,
              errors: errors.slice(0, 5),
            })),
            packages: result.packages.map(({ entries, modules, ...pkg }) => ({
              ...pkg,
              nonCodeSubpaths: modules.filter((module) => module.kind === 'asset').length,
              examples: entries
                .filter((entry) => entry.status !== 'behaviorVerified')
                .slice(0, 5)
                .map(({ module, name, status }) => ({ module, name, status })),
            })),
          }
        : result,
      null,
      2,
    ),
  );
  if (process.argv.includes('--strict')) process.exitCode = result.compatible ? 0 : 1;
}
