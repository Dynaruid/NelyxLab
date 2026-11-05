// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { engineV2ImportRoute } from '../../sdk/tooling/cli/src/engine-v2-data-api.mjs';

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
const surfaceHash = (entry, root) =>
  createHash('sha256')
    .update(
      entry.kind === 'asset'
        ? fs.readFileSync(entry.original)
        : JSON.stringify(entry.original, (_key, value) =>
            typeof value === 'string'
              ? value.replaceAll(root.replaceAll('\\', '/'), '<root>').replaceAll(root, '<root>')
              : value,
          ),
    )
    .digest('hex');

/** Canonical compatibility input, not a test receipt. Updating it changes API scope. */
export function engineV2OriginalSurface(result, root = repository) {
  return {
    schema: 'nelyx.api.original/1',
    packages: result.packages.map((pkg) => ({
      package: pkg.package,
      modules: pkg.modules.map((module) => ({
        module: module.module,
        kind: module.kind,
        exports: module.entries.map((entry) => [entry.name, surfaceHash(entry, root)]),
      })),
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
  const program = ts.createProgram(
      packages.flatMap((pkg) =>
        pkg.modules.filter((module) => module.code).map((module) => module.file),
      ),
      options,
    ),
    checker = program.getTypeChecker();
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
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
        return [
          {
            name: property.name,
            visibility: flags & ts.ModifierFlags.Protected ? 'protected' : 'public',
            optional: !!(property.flags & ts.SymbolFlags.Optional),
            readonly: !!(flags & ts.ModifierFlags.Readonly),
            type: type ? checker.typeToString(type, undefined, typeFlags) : null,
            calls:
              type
                ?.getCallSignatures()
                .map((signature) => checker.signatureToString(signature, undefined, typeFlags)) ??
              [],
            getter: declarations.some(ts.isGetAccessorDeclaration),
            setter: declarations.some(ts.isSetAccessorDeclaration),
          },
        ];
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
      .filter((module) => module.subpath !== pkg.v2)
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
  for (const pkg of results) {
    pkg.counts = {};
    for (const entry of pkg.entries) pkg.counts[entry.status] = (pkg.counts[entry.status] ?? 0) + 1;
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
      scope.schema !== 'nelyx.api.original/1' ||
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
                  item.length !== 2 ||
                  typeof item[0] !== 'string' ||
                  !/^[a-f0-9]{64}$/.test(item[1]),
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
          for (const [name, hash] of original.exports) {
            const entry = module.entries.find((entry) => entry.name === name);
            if (!entry) fail('missingOriginalExport', original.module + '#' + name);
            else if (
              entry.original &&
              (entry.kind !== 'asset' || fs.existsSync(entry.original)) &&
              surfaceHash(entry, root) !== hash
            )
              fail('originalSurfaceChanged', original.module + '#' + name);
          }
        }
      }
  }
  return {
    schema: 'nelyx.api.v2.audit/2',
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
    originalScope: Array.isArray(scope?.packages) && {
      packages: scope.packages.length,
      subpaths: scope.packages.reduce((sum, pkg) => sum + (pkg?.modules?.length ?? 0), 0),
    },
    cases,
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
