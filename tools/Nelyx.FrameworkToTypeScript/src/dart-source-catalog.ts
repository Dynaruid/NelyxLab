// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { contentCache, contentHash, stableJson, type CacheReport } from './content-cache.ts';
import { dartAnalysisIdentity, getPortCacheRoot } from './dart-frontend.ts';
import { guardLoadedIdentity } from './implementation-identity.ts';

interface CatalogSpan {
  kind: string;
  offset: number;
  length: number;
  spanSha256: string;
}
export interface SourceCatalogUnit {
  source: string;
  rawSha256: string;
  sha256: string;
  symbols: (CatalogSpan & { name: string })[];
  unselectable: (CatalogSpan & { diagnostic: string })[];
  parseDiagnostics: string[];
}
export interface SourceCatalog {
  schema: 'nelyx.source-units/v1';
  units: SourceCatalogUnit[];
}
const tool = path.resolve(import.meta.dir, '..');
const parser = path.join(tool, 'dart/bin/source_units.dart');
const hashFile = (file: string) => contentHash(fs.readFileSync(file));
const loadedImplementation = guardLoadedIdentity(
  () =>
    [
      import.meta.path,
      'src/content-cache.ts',
      'src/dart-frontend.ts',
      'src/implementation-identity.ts',
    ].map((file) => hashFile(path.isAbsolute(file) ? file : path.join(tool, file))),
  'Dart catalog implementation',
);

/** parseString uses no resolved imports or source analysis options. Retain the
 * actual parser, package/configuration and SDK byte identities independently
 * of the requested unit set, so overlapping batches can share individual units. */
function parserIdentity(sourceRoot: string, dart: string) {
  const analysis = dartAnalysisIdentity(sourceRoot, dart, []) as Record<string, unknown>;
  const keys = [
    'root',
    'executable',
    'sdk',
    'executableSha256',
    'sdkVersion',
    'sdkLibraries',
    'sdkRuntime',
    'lock',
    'pubspec',
    'packageConfiguration',
    'packages',
  ];
  return {
    schema: 'nelyx.source-catalog-inputs/v1',
    environment: Object.fromEntries(keys.map((key) => [key, analysis[key]])),
    parser: hashFile(parser),
    implementation: loadedImplementation(),
  };
}

/** Misses are collected first and parsed in one Dart process; a warm/overlapping
 * batch never starts a parser for units already qualified by the cache. */
export function catalogDartSources(options: {
  sourceRoot: string;
  dart: string;
  sources: string[];
  cacheRoot?: string;
  enabled?: boolean;
}) {
  const started = performance.now(),
    root = fs.realpathSync(options.sourceRoot);
  const inputs = options.sources.map((source) => {
    const file = path.resolve(root, source),
      relative = path.relative(root, file);
    if (
      path.isAbsolute(source) ||
      relative === '..' ||
      relative.startsWith('..' + path.sep) ||
      !relative ||
      !source.endsWith('.dart')
    )
      throw new Error('Invalid relative catalog unit: ' + source);
    const actual = fs.realpathSync(file),
      canonical = (value: string) => (process.platform === 'win32' ? value.toLowerCase() : value);
    if (canonical(actual) !== canonical(file) || !fs.statSync(file).isFile())
      throw new Error('Linked/non-file catalog unit rejected: ' + source);
    const content = fs.readFileSync(file, 'utf8');
    return {
      source,
      file,
      content,
      rawSha256: contentHash(content),
      sha256: contentHash(content.replaceAll('\r\n', '\n')),
    };
  });
  if (
    new Set(
      inputs.map((input) => (process.platform === 'win32' ? input.file.toLowerCase() : input.file)),
    ).size !== inputs.length
  )
    throw new Error('Duplicate catalog unit');
  const identity = parserIdentity(root, options.dart),
    units = new Map<string, SourceCatalogUnit>(),
    reports = new Map<string, CacheReport>(),
    missing: typeof inputs = [];
  function validate(input: (typeof inputs)[number], unit: SourceCatalogUnit) {
    if (
      unit.source !== input.source ||
      unit.rawSha256 !== input.rawSha256 ||
      unit.sha256 !== input.sha256 ||
      !Array.isArray(unit.symbols) ||
      !Array.isArray(unit.unselectable) ||
      !Array.isArray(unit.parseDiagnostics) ||
      unit.parseDiagnostics.some((value) => typeof value !== 'string')
    )
      throw new Error('Catalog cache input/schema mismatch');
    for (const span of [...unit.symbols, ...unit.unselectable]) {
      if (
        typeof span.kind !== 'string' ||
        !span.kind ||
        !Number.isSafeInteger(span.offset) ||
        !Number.isSafeInteger(span.length) ||
        span.offset < 0 ||
        span.length < 0 ||
        span.offset + span.length > input.content.length ||
        contentHash(input.content.slice(span.offset, span.offset + span.length)) !== span.spanSha256
      )
        throw new Error('Catalog cache source span mismatch');
    }
    if (
      unit.symbols.some((symbol) => typeof symbol.name !== 'string' || !symbol.name) ||
      unit.unselectable.some((span) => typeof span.diagnostic !== 'string')
    )
      throw new Error('Catalog cache declaration schema mismatch');
  }
  function cached(input: (typeof inputs)[number], produce: () => SourceCatalogUnit) {
    return contentCache(
      {
        root: options.cacheRoot ?? getPortCacheRoot(),
        namespace: 'dart-catalog',
        identity: { parser: identity, source: input.source, rawSha256: input.rawSha256 },
        ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
      },
      () => ({ 'unit.json': Buffer.from(JSON.stringify(produce()) + '\n') }),
      (artifacts) => {
        if (Object.keys(artifacts).length !== 1 || !artifacts['unit.json'])
          throw new Error('Invalid catalog cache artifacts');
        validate(input, JSON.parse(artifacts['unit.json'].toString()));
      },
    );
  }
  // contentCache does not publish failed producers. A private sentinel probes
  // misses without creating one Dart process per file or hiding other errors.
  const miss = new Error('catalog miss');
  for (const input of inputs)
    try {
      const hit = cached(input, () => {
        throw miss;
      });
      units.set(input.source, JSON.parse(hit.artifacts['unit.json']!.toString()));
      reports.set(input.source, hit.report);
    } catch (error) {
      if (error !== miss) throw error;
      missing.push(input);
    }
  let parserProcesses = 0;
  if (missing.length) {
    parserProcesses++;
    const run = spawnSync(options.dart, [parser, root, ...missing.map((input) => input.source)], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 1200000,
      maxBuffer: 32 * 1024 * 1024,
    });
    if (run.error || run.status !== 0)
      throw new Error(
        `Dart catalog exited ${run.status}: ${run.error?.message ?? ''}\n${run.stdout}\n${run.stderr}`,
      );
    const result = JSON.parse(run.stdout) as SourceCatalog;
    if (
      result.schema !== 'nelyx.source-units/v1' ||
      !Array.isArray(result.units) ||
      result.units.length !== missing.length
    )
      throw new Error('Dart catalog schema/unit count mismatch');
    result.units.forEach((unit, index) => validate(missing[index]!, unit));
    // Qualify every result and recheck inputs before publishing any miss.
    for (const input of inputs)
      if (fs.readFileSync(input.file, 'utf8') !== input.content)
        throw new Error('Catalog source changed while parsing: ' + input.source);
    if (stableJson(parserIdentity(root, options.dart)) !== stableJson(identity))
      throw new Error('Catalog parser inputs changed while parsing');
    for (let index = 0; index < missing.length; index++) {
      const input = missing[index]!,
        entry = cached(input, () => result.units[index]!);
      units.set(input.source, JSON.parse(entry.artifacts['unit.json']!.toString()));
      reports.set(input.source, entry.report);
    }
  }
  for (const input of inputs)
    if (fs.readFileSync(input.file, 'utf8') !== input.content)
      throw new Error('Catalog source changed while reading cache: ' + input.source);
  if (!missing.length && stableJson(parserIdentity(root, options.dart)) !== stableJson(identity))
    throw new Error('Catalog parser inputs changed while reading cache');
  if (fs.existsSync(path.join(root, '.dart_tool/package_config.json')))
    throw new Error('Source analysis configuration already owned by another analyzer');
  return {
    catalog: {
      schema: 'nelyx.source-units/v1',
      units: inputs.map((input) => units.get(input.source)!),
    } as SourceCatalog,
    cache: {
      namespace: 'dart-catalog',
      parserProcesses,
      elapsedMs: Math.round(performance.now() - started),
      units: inputs.map((input) => ({ source: input.source, ...reports.get(input.source)! })),
    },
  };
}
