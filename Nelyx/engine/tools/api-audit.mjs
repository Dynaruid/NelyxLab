// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEngineV2DataApi } from '../../sdk/tooling/cli/src/engine-v2-data-api.mjs';
const root = path.resolve(import.meta.dirname, '../../..');
const packages = ['Nelyx', 'packages/material', 'packages/cupertino', 'Nelyx/sdk'].map(
  (directory) => {
    const absolute = path.join(root, directory),
      manifest = JSON.parse(fs.readFileSync(path.join(absolute, 'package.json'), 'utf8'));
    const modules = Object.entries(manifest.exports).map(([subpath, value]) => ({
      subpath,
      file: path.resolve(
        absolute,
        typeof value === 'string' ? value : (value.types ?? value.default),
      ),
    }));
    return {
      name: manifest.name,
      modules,
      v2: manifest.name === '@nelyx/sdk' ? './engine-v2' : './v2',
    };
  },
);
export function auditEngineV2Api() {
  const program = ts.createProgram(
      packages.flatMap((p) => p.modules.map((m) => m.file)),
      {
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      },
    ),
    checker = program.getTypeChecker();
  const exportsOf = (file) => {
    const source = program.getSourceFile(file),
      module = source && checker.getSymbolAtLocation(source);
    return module ? checker.getExportsOfModule(module) : [];
  };
  const symbolType = (symbol) => {
    if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    if (!(symbol.flags & ts.SymbolFlags.Value) && symbol.flags & ts.SymbolFlags.Type)
      return checker.getDeclaredTypeOfSymbol(symbol);
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    return declaration ? checker.getTypeOfSymbolAtLocation(symbol, declaration) : undefined;
  };
  const members = (type) =>
    type
      .getProperties()
      .filter(
        (property) =>
          !property.declarations?.some(
            (declaration) =>
              (ts.getCombinedModifierFlags(declaration) &
                (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) !==
              0,
          ),
      )
      .map((property) => ({
        name: property.name,
        type: checker.typeToString(
          symbolType(property),
          undefined,
          ts.TypeFormatFlags.NoTruncation,
        ),
      }));
  const shape = (symbol) => {
    const type = symbolType(symbol);
    if (!type) return null;
    return {
      constructors: type
        .getConstructSignatures()
        .map((signature) =>
          checker.signatureToString(signature, undefined, ts.TypeFormatFlags.NoTruncation),
        ),
      calls: type
        .getCallSignatures()
        .map((signature) =>
          checker.signatureToString(signature, undefined, ts.TypeFormatFlags.NoTruncation),
        ),
      value: checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation),
      members: members(type),
      instances: type
        .getConstructSignatures()
        .map((signature) => members(signature.getReturnType())),
    };
  };
  const results = packages.map((pkg) => {
    const v2 = new Map(
      exportsOf(pkg.modules.find((m) => m.subpath === pkg.v2).file).map((symbol) => [
        symbol.name,
        symbol,
      ]),
    );
    const entries = pkg.modules
      .filter((m) => m.subpath !== pkg.v2)
      .flatMap((module) =>
        exportsOf(module.file).map((symbol) => {
          const name = pkg.name + module.subpath.slice(1);
          const original = shape(symbol),
            reused = isEngineV2DataApi(name),
            candidate = v2.get(symbol.name),
            replacement = reused ? original : candidate ? shape(candidate) : null;
          return {
            module: name,
            name: symbol.name,
            original,
            replacement,
            route: reused ? name : candidate ? pkg.name + pkg.v2.slice(1) : null,
            status: reused
              ? 'canonicalDataReuse'
              : !candidate
                ? 'missing'
                : JSON.stringify(original) === JSON.stringify(replacement)
                  ? 'signatureMatchBehaviorUnverified'
                  : 'signatureChanged',
          };
        }),
      );
    const counts = {};
    for (const entry of entries) counts[entry.status] = (counts[entry.status] ?? 0) + 1;
    return {
      package: pkg.name,
      legacySubpaths: pkg.modules.length - 1,
      v2Symbols: v2.size,
      counts,
      entries,
    };
  });
  return {
    schema: 'nelyx.api.v2.audit/1',
    compatible: results.every((pkg) =>
      pkg.entries.every((entry) => entry.status === 'canonicalDataReuse'),
    ),
    note: 'Signatures and names alone do not establish behavioral compatibility. Missing and changed entries remain migration work.',
    packages: results,
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditEngineV2Api();
  console.log(
    JSON.stringify(
      process.argv.includes('--summary')
        ? {
            ...result,
            packages: result.packages.map(({ entries, ...pkg }) => ({
              ...pkg,
              examples: entries
                .filter((e) => e.status !== 'signatureMatchBehaviorUnverified')
                .slice(0, 5)
                .map((e) => ({ module: e.module, name: e.name, status: e.status })),
            })),
          }
        : result,
      null,
      2,
    ),
  );
  if (process.argv.includes('--strict')) process.exitCode = result.compatible ? 0 : 1;
}
