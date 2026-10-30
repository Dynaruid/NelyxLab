// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { emitDart, BlockedSemantic } from './dart-emitter.ts';
import type { BodyIr, ModuleRecipe, Declaration, PackagePin } from './body-ir.ts';
import { scanInventory } from './batch-plan.ts';
import { resolvePackageSource } from './package-source.ts';
import { contentCache, stableJson, treeIdentity } from './content-cache.ts';
import type { CacheReport } from './content-cache.ts';
import {
  analyzeDart,
  dartAnalysisIdentity,
  dartRequestSources,
  getPortCacheRoot,
} from './dart-frontend.ts';
import { guardLoadedIdentity, typescriptIdentity } from './implementation-identity.ts';
export const repository = path.resolve(import.meta.dir, '../../..');
const migration = path.join(repository, 'tools/Nelyx.FrameworkToTypeScript/data/work8'),
  scratch = path.join(repository, '.tmp/work8/batches');
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const json = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temp, file);
};
const existsHash = (file: string) => (fs.existsSync(file) ? sha(fs.readFileSync(file)) : null);
export interface NelyxContract {
  id: string;
  classification: 'compatible' | 'nelyx-replacement' | 'nelyx-only' | 'excluded';
  ownership: 'generated' | 'adopted';
  api: string[];
  requirements: string[];
  numericPolicy: string;
  differences: string[];
  performance: string;
}
export interface BatchRecipe {
  schema: 'nelyx.batch/v1';
  id: string;
  revision: string;
  sourceRoot: string;
  dartSdk?: string;
  package: string;
  modules: ModuleRecipe[];
  referencePackages?: { packagePin: PackagePin; library: string; librarySha256: string }[];
  adoptExisting?: Record<string, string>;
  validation: string;
  validationInputs?: string[];
  validationData?: string[];
  validationSources?: string[];
  contract?: NelyxContract;
  sourceComparison?: string;
  requireSourceComparison?: boolean;
}
interface FileState {
  destination: string;
  mode: 'generated' | 'adopted';
  baseHash: string;
  productHash: string;
  fingerprint: string;
  recipe: string;
}
type Validation = {
  types: true;
  semantic: true;
  fixtureHash: string;
  nelyx?: { status: 'PASS'; contractId: string };
  sourceComparison?: {
    status: 'PASS' | 'FAIL' | 'notRun';
    fixtureHash: string | null;
    diagnostic?: string;
  };
};
interface Origin {
  source: string;
  symbol: string;
  qualifiedId: string;
  offset: number;
  length: number;
  spanSha256: string;
  destination: string;
  package: string;
  packagePin?: PackagePin;
  library?: string;
  sourceSha256?: string;
}
interface BatchState {
  fingerprint: string;
  phase: string;
  diagnostics: string[];
  files: FileState[];
  origins?: Origin[];
  identity?: unknown;
  promotion?: {
    fingerprint: string;
    files: FileState[];
    validation?: Validation;
    origins?: Origin[];
  };
  validation?: Validation;
}
interface State {
  schema: 'nelyx.batch-state/v1';
  batches: Record<string, BatchState>;
}
const stateFile = path.join(migration, 'state.json');
const state = (): State =>
  fs.existsSync(stateFile)
    ? read<State>(stateFile)
    : { schema: 'nelyx.batch-state/v1', batches: {} };
function inside(base: string, file: string): boolean {
  const relative = path.relative(base, file);
  return (
    relative !== '' &&
    !relative.startsWith('..' + path.sep) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  );
}
function plainPath(file: string, base: string): string {
  const resolved = path.resolve(file);
  if (!inside(base, resolved)) throw new Error('Path outside owner: ' + file);
  if (base !== repository && !inside(repository, base))
    throw new Error('Owner root outside repository');
  let current = repository;
  for (const segment of path.relative(repository, resolved).split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw new Error('Linked path rejected: ' + current);
  }
  return resolved;
}
function command(executable: string, args: string[], cwd = repository, env = process.env): string {
  const result = spawnSync(executable, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 1200000,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${executable} exited ${result.status}: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`,
    );
  return result.stdout;
}
function owner(recipe: BatchRecipe): {
  directory: string;
  config: string;
  sourceRoot: string;
  name: string;
} {
  const registry = read<{
    packages: { directory: string; config: string; sourceRoot: string; name: string }[];
  }>(path.join(repository, 'tools/Nelyx.FrameworkToTypeScript/data/packages.json'));
  const owners = registry.packages.filter((p) => p.name === recipe.package);
  if (owners.length !== 1) throw new Error('Batch must have one registered package owner');
  return owners[0]!;
}
function destination(recipe: BatchRecipe, module: ModuleRecipe): string {
  const p = owner(recipe);
  return plainPath(
    path.resolve(repository, module.destination),
    path.resolve(repository, p.directory, p.sourceRoot),
  );
}
function manualInputs(module: ModuleRecipe): { file: string; source: string }[] {
  const inputs = module.manualDeclarations ?? [];
  if (new Set(inputs).size !== inputs.length) throw new Error('Duplicate manual declaration input');
  return inputs.map((file) => {
    const absolute = plainPath(path.resolve(repository, file), path.join(migration, 'inputs'));
    if (
      path.relative(repository, absolute).replaceAll('\\', '/') !== file ||
      path.extname(absolute) !== '.ts'
    )
      throw new Error(
        'Manual declaration input must use its canonical repository-relative TypeScript path',
      );
    return { file, source: fs.readFileSync(absolute, 'utf8') };
  });
}
function toolIdentity(): Record<string, string> {
  // Fingerprint this execution path. Inventory/report-only changes must not
  // recompile unrelated accepted Dart bodies.
  const files = [
    'dart/bin/body_ir.dart',
    'dart/pubspec.lock',
    'package.json',
    'bun.lock',
    ...[
      'main',
      'batch',
      'batch-plan',
      'body-ir',
      'class-model',
      'constructor-redirects',
      'mixin-applications',
      'dart-emitter',
      'package-source',
      'paths',
      'selection',
      'content-cache',
      'dart-frontend',
      'dart-directives',
      'implementation-identity',
    ].map((f) => 'src/' + f + '.ts'),
  ];
  return Object.fromEntries(
    files.sort().map((file) => [file, existsHash(path.resolve(import.meta.dir, '..', file))!]),
  );
}
const loadedToolIdentity = guardLoadedIdentity(toolIdentity, 'Converter implementation');
const loadedEmitterIdentity = guardLoadedIdentity(
  () => treeIdentity(path.resolve(import.meta.dir), (file) => file.endsWith('.ts')),
  'Emitter implementation',
);
function dependencyIdentity(recipe: BatchRecipe): Record<string, string> {
  const registry = read<{ packages: { directory: string; name: string }[] }>(
    path.join(repository, 'tools/Nelyx.FrameworkToTypeScript/data/packages.json'),
  );
  const hashes: Record<string, string> = {};
  const generated = new Set(recipe.modules.map((m) => path.resolve(repository, m.destination)));
  // A separate set avoids revisiting modules using absolute/relative keys.
  const seen = new Set<string>();
  function resolve(specifier: string, origin: string): string | undefined {
    if (specifier.startsWith('.'))
      return path.resolve(path.dirname(origin), specifier.replace(/\.js$/, '.ts'));
    const match = /^(@nelyx\/[^/]+)\/(.+)$/.exec(specifier);
    if (!match) return;
    const p = registry.packages.find((p) => p.name === match[1]);
    if (!p) throw new Error('Unregistered public import: ' + specifier);
    const packageFile = path.join(repository, p.directory, 'package.json'),
      manifest = read<{ exports: Record<string, { default: string }> }>(packageFile),
      entry = manifest.exports['./' + match[2]];
    if (!entry?.default) throw new Error('Public import is not exported: ' + specifier);
    return path.resolve(
      repository,
      p.directory,
      entry.default.replace('./dist/', './src/').replace(/\.js$/, '.ts'),
    );
  }
  // Transitive imports are traversed with a cycle guard before visit's hash work.
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (generated.has(file) || !fs.existsSync(file)) return;
    plainPath(file, repository);
    hashes[path.relative(repository, file).replaceAll('\\', '/')] = sha(fs.readFileSync(file));
    for (const item of ts.preProcessFile(fs.readFileSync(file, 'utf8')).importedFiles) {
      const next = resolve(item.fileName, file);
      if (next) walk(next);
    }
  };
  for (const m of recipe.modules)
    for (const specifier of [
      ...Object.values(m.imports ?? {}),
      ...Object.values(m.typeImports ?? {}),
    ]) {
      const file = resolve(specifier, destination(recipe, m));
      if (file) walk(file);
    }
  // Consumer facades may depend on generated modules without being imported by
  // them. Include those gate inputs and their transitive source dependencies.
  if (recipe.validationSources) {
    if (new Set(recipe.validationSources).size !== recipe.validationSources.length)
      throw new Error('Duplicate validation source');
    const p = owner(recipe),
      base = path.resolve(repository, p.directory, p.sourceRoot);
    for (const file of recipe.validationSources) {
      const absolute = plainPath(path.resolve(repository, file), base);
      if (
        path.relative(repository, absolute).replaceAll('\\', '/') !== file ||
        path.extname(absolute) !== '.ts' ||
        !fs.existsSync(absolute) ||
        generated.has(absolute)
      )
        throw new Error(
          'Validation source must be an existing canonical nongenerated package source',
        );
      walk(absolute);
    }
  }
  for (const module of recipe.modules)
    for (const input of manualInputs(module))
      hashes[input.file] = sha(fs.readFileSync(path.resolve(repository, input.file)));
  for (const p of registry.packages)
    for (const name of ['package.json', 'tsconfig.build.json']) {
      const file = path.join(repository, p.directory, name);
      if (fs.existsSync(file))
        hashes[path.relative(repository, file).replaceAll('\\', '/')] = sha(fs.readFileSync(file));
    }
  return hashes;
}
function context(recipeFile: string) {
  const absolute = plainPath(path.resolve(recipeFile), migration),
    recipe = read<BatchRecipe>(absolute);
  if (
    recipe.schema !== 'nelyx.batch/v1' ||
    !/^[-a-z0-9]+$/.test(recipe.id) ||
    !recipe.modules.length
  )
    throw new Error('Invalid batch recipe');
  if (
    recipe.contract &&
    (!recipe.contract.id ||
      !['compatible', 'nelyx-replacement', 'nelyx-only', 'excluded'].includes(
        recipe.contract.classification,
      ) ||
      recipe.contract.classification === 'excluded' ||
      !['generated', 'adopted'].includes(recipe.contract.ownership) ||
      !recipe.contract.api.length ||
      !recipe.contract.requirements.length ||
      !recipe.contract.numericPolicy ||
      !recipe.contract.performance)
  )
    throw new Error('Incomplete or excluded Nelyx contract cannot be promoted');
  if (recipe.requireSourceComparison && (!recipe.contract || !recipe.sourceComparison))
    throw new Error('Required source comparison needs a contract and fixture');
  const destinations = new Set(recipe.modules.map((m) => destination(recipe, m)));
  if (destinations.size !== recipe.modules.length)
    throw new Error('Duplicate destination in batch');
  const source = plainPath(path.resolve(repository, recipe.sourceRoot), repository);
  if (fs.realpathSync(source) !== source) throw new Error('Source root link rejected');
  if (
    command('git', ['rev-parse', '--show-toplevel'], source)
      .trim()
      .replaceAll('\\', '/')
      .toLowerCase() !== source.replaceAll('\\', '/').toLowerCase() ||
    command('git', ['rev-parse', 'HEAD'], source).trim() !== recipe.revision
  )
    throw new Error('Source checkout does not match pinned Git root/HEAD');
  if (
    command(
      'git',
      [
        'diff',
        '--name-only',
        'HEAD',
        '--',
        'packages/flutter',
        'packages/flutter_localizations',
        'engine/src/flutter/lib/ui',
        'LICENSE',
      ],
      source,
    ).trim()
  )
    throw new Error('Pinned framework/engine source has local edits');
  const externalSources = [];
  for (const module of recipe.modules) {
    if (module.source.startsWith('package:')) {
      externalSources.push(resolvePackageSource(repository, module).identity);
      continue;
    }
    if (module.packagePin || module.library || module.librarySha256)
      throw new Error('Package metadata requires a package source URI');
    const file = plainPath(path.resolve(source, module.source), source),
      bytes = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
    if (sha(bytes) !== module.sha256)
      throw new Error('Pinned source bytes drifted: ' + module.source);
  }
  const dartCommand =
    process.env.NELYX_DART ??
    (recipe.dartSdk
      ? path.resolve(
          repository,
          recipe.dartSdk,
          'bin',
          process.platform === 'win32' ? 'dart.exe' : 'dart',
        )
      : Bun.which('dart'));
  if (!dartCommand) throw new Error('Dart SDK unavailable; set NELYX_DART to its executable');
  const dart = dartCommand.endsWith('.bat')
    ? path.resolve(path.dirname(dartCommand), 'cache/dart-sdk/bin/dart.exe')
    : dartCommand;
  const analysis = dartAnalysisIdentity(source, dart, dartRequestSources(recipe.modules));
  const identity = {
    recipe,
    tool: loadedToolIdentity(),
    runtime: { bun: Bun.version, node: process.versions.node },
    dart: { version: command(dart, ['--version']).trim(), executableSha256: existsHash(dart) },
    analysis: sha(stableJson(analysis)),
    typescript: typescriptIdentity(),
    dependencies: dependencyIdentity(recipe),
    validationHash: existsHash(
      plainPath(
        path.resolve(repository, recipe.validation),
        path.join(repository, 'tools/Nelyx.FrameworkToTypeScript'),
      ),
    ),
    sourceComparisonHash: recipe.sourceComparison
      ? existsHash(
          plainPath(
            path.resolve(repository, recipe.sourceComparison),
            path.join(repository, 'tools/Nelyx.FrameworkToTypeScript'),
          ),
        )
      : null,
    mappingHash: existsHash(
      path.join(repository, 'tools/Nelyx.FrameworkToTypeScript/data/packages.json'),
    ),
  };
  if (externalSources.length) Object.assign(identity, { externalSources });
  if (recipe.referencePackages) {
    if (
      new Set(recipe.referencePackages.map((p) => p.library)).size !==
      recipe.referencePackages.length
    )
      throw new Error('Duplicate reference package library');
    Object.assign(identity, {
      referencePackages: recipe.referencePackages.map(
        (p) =>
          resolvePackageSource(repository, {
            ...p,
            source: p.library,
            sha256: p.librarySha256,
            symbols: [],
            destination: '',
          }).identity,
      ),
    });
  }
  if (recipe.validationInputs) {
    if (new Set(recipe.validationInputs).size !== recipe.validationInputs.length)
      throw new Error('Duplicate validation input');
    Object.assign(identity, {
      validationInputs: Object.fromEntries(
        recipe.validationInputs.map((file) => {
          const absolute = plainPath(
            path.resolve(repository, file),
            path.join(repository, 'tools/Nelyx.FrameworkToTypeScript/checks'),
          );
          if (path.relative(repository, absolute).replaceAll('\\', '/') !== file)
            throw new Error('Validation input must use canonical repository-relative path');
          return [file, sha(fs.readFileSync(absolute))];
        }),
      ),
    });
  }
  if (recipe.validationData) {
    if (new Set(recipe.validationData).size !== recipe.validationData.length)
      throw new Error('Duplicate validation data');
    Object.assign(identity, {
      validationData: Object.fromEntries(
        recipe.validationData.map((file) => {
          const absolute = plainPath(path.resolve(repository, file), migration),
            relative = path.relative(migration, absolute).replaceAll('\\', '/');
          if (
            path.relative(repository, absolute).replaceAll('\\', '/') !== file ||
            !/^(candidates|recipes|inputs)\/.+\.json$/.test(relative)
          )
            throw new Error(
              'Validation data must be canonical tracked recipe/candidate/input JSON',
            );
          return [file, sha(fs.readFileSync(absolute))];
        }),
      ),
    });
  }
  const fingerprint = sha(JSON.stringify(identity)),
    directory = path.join(scratch, recipe.id, fingerprint);
  plainPath(directory, path.join(repository, '.tmp/work8'));
  fs.mkdirSync(directory, { recursive: true });
  json(path.join(directory, 'analysis-inputs.json'), analysis);
  return { recipe, absolute, source, fingerprint, directory, identity, dart, analysis };
}
function merge(current: string, base: string, next: string, directory: string): string {
  if (current === base) return next;
  if (next === base || current === next) return current;
  const mergeDir = fs.mkdtempSync(path.join(directory, 'merge-')),
    files = ['current', 'base', 'next'].map((name) => path.join(mergeDir, name));
  [current, base, next].forEach((value, i) => fs.writeFileSync(files[i]!, value));
  const result = spawnSync('git', ['merge-file', '-p', ...files], {
    encoding: 'utf8',
    timeout: 1200000,
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw new Error('3-way merge conflict; product retained. ' + result.stderr);
  return result.stdout;
}
function recoverJournal() {
  const file = path.join(repository, '.tmp/work8/promotion-journal.json');
  if (!fs.existsSync(file)) return;
  const journal = read<{
    phase: string;
    stateBefore: State;
    files: { destination: string; before: string | null; afterHash: string }[];
  }>(file);
  if (journal.phase !== 'promoting') return;
  for (const entry of [...journal.files].reverse()) {
    const dest = plainPath(path.resolve(repository, entry.destination), repository),
      hash = existsHash(dest);
    if (hash === entry.afterHash) {
      if (entry.before === null) fs.unlinkSync(dest);
      else fs.writeFileSync(dest, entry.before);
    } else if (hash !== (entry.before === null ? null : sha(entry.before)))
      throw new Error(
        'Interrupted promotion conflicts with an external edit: ' + entry.destination,
      );
  }
  json(stateFile, journal.stateBefore);
  json(file, { ...journal, phase: 'rolled-back' });
}
export async function batchMain(args: string[]): Promise<void> {
  const [action, recipeFile] = args;
  if (action === 'scan' || action === 'plan') {
    await scanInventory(repository);
    return;
  }
  if (action === 'resume' && recipeFile === 'all') {
    const directory = path.join(migration, 'recipes'),
      results: { recipe: string; status: string; diagnostic?: string }[] = [];
    for (const file of fs
      .readdirSync(directory)
      .filter((file) => file.endsWith('.json'))
      .sort())
      try {
        await batchMain(['resume', path.join(directory, file)]);
        results.push({ recipe: file, status: 'accepted' });
      } catch (error) {
        results.push({ recipe: file, status: 'failed', diagnostic: String(error) });
      }
    json(path.join(migration, 'batch-report.json'), { schema: 'nelyx.batch-report/v1', results });
    console.log(JSON.stringify(results));
    if (results.some((result) => result.status === 'failed')) process.exitCode = 2;
    return;
  }
  if (
    !action ||
    !recipeFile ||
    !['generate', 'compose', 'validate', 'promote', 'resume', 'compare'].includes(action)
  )
    throw new Error(
      'port batch scan|plan OR generate|compose|validate|promote|resume|compare <tracked-recipe.json>',
    );
  const lock = path.join(migration, '.batch.lock');
  fs.mkdirSync(migration, { recursive: true });
  let handle: number;
  try {
    handle = fs.openSync(lock, 'wx');
  } catch {
    const pid = Number(fs.readFileSync(lock, 'utf8'));
    let dead = false;
    if (Number.isSafeInteger(pid) && pid > 0)
      try {
        process.kill(pid, 0);
      } catch (error) {
        dead = (error as NodeJS.ErrnoException).code === 'ESRCH';
      }
    if (!dead)
      throw new Error('Another batch owns promotion/state; inspect .batch.lock before retrying');
    fs.unlinkSync(lock);
    handle = fs.openSync(lock, 'wx');
  }
  try {
    fs.writeFileSync(handle, String(process.pid));
    recoverJournal();
    const c = context(recipeFile),
      s = state(),
      previous = s.batches[c.recipe.id];
    const promotion =
      previous?.promotion ??
      (previous?.phase === 'promoted'
        ? {
            fingerprint: previous.fingerprint,
            files: previous.files,
            ...(previous.validation ? { validation: previous.validation } : {}),
            ...(previous.origins ? { origins: previous.origins } : {}),
          }
        : undefined);
    const promotedFiles = promotion?.files ?? [];
    const active: BatchState = {
      fingerprint: c.fingerprint,
      phase: 'planned',
      diagnostics: [],
      files: promotedFiles,
      origins: [],
      identity: c.identity,
      ...(promotion ? { promotion } : {}),
    };
    const reportFile = path.join(c.directory, 'report.json'),
      cache: CacheReport[] = [];
    const save = () => {
      s.batches[c.recipe.id] = active;
      json(stateFile, s);
      json(reportFile, { ...active, identity: c.identity, cache });
      json(path.join(c.directory, 'cache-report.json'), {
        schema: 'nelyx.batch-cache-report/v1',
        id: c.recipe.id,
        cache,
      });
    };
    const announce = () =>
      console.log(
        JSON.stringify({
          id: c.recipe.id,
          status: active.phase,
          fingerprint: c.fingerprint,
          files: active.files.length,
          cache,
        }),
      );
    if (action === 'compare') {
      console.log(
        JSON.stringify({
          id: c.recipe.id,
          changed: previous?.fingerprint !== c.fingerprint,
          productChanges:
            previous?.files.filter(
              (f) => existsHash(path.resolve(repository, f.destination)) !== f.productHash,
            ) ?? [],
          previousPhase: previous?.phase,
        }),
      );
      return;
    }
    // Only validated, byte-identical promotions can be reused.
    if (
      action === 'resume' &&
      promotion?.validation &&
      promotion.fingerprint === c.fingerprint &&
      promotion.files.every(
        (file) => existsHash(path.resolve(repository, file.destination)) === file.productHash,
      )
    ) {
      if (previous?.phase !== 'promoted') {
        active.phase = 'promoted';
        active.validation = promotion.validation;
        active.origins = promotion.origins ?? [];
        save();
      }
      console.log(
        JSON.stringify({ id: c.recipe.id, status: 'unchanged', fingerprint: c.fingerprint }),
      );
      return;
    }
    try {
      const request = path.join(c.directory, 'request.json'),
        irFile = path.join(c.directory, 'body-ir.json');
      json(
        request,
        c.recipe.modules.map((m) => ({
          source: m.source,
          sha256: m.sha256,
          symbols: m.symbols,
          ...(m.packagePin
            ? { packagePin: m.packagePin, library: m.library, librarySha256: m.librarySha256 }
            : {}),
        })),
      );
      const dart = c.dart;
      // Use the SDK selected by Flutter; callers may explicitly select another
      // locked SDK through NELYX_DART. The frontend lock remains fingerprinted.
      cache.push(
        analyzeDart({
          dart,
          sourceRoot: c.source,
          requestFile: request,
          irFile,
          identity: c.analysis,
        }),
      );
      const ir = read<BodyIr>(irFile);
      if (ir.schema !== 'nelyx.resolved-body-ir/v1') throw new Error('Invalid body IR schema');
      active.phase = 'analyzed';
      const emitterIdentity = {
        sources: loadedEmitterIdentity(),
        typescript: typescriptIdentity(),
        runtime: { bun: Bun.version, node: process.versions.node },
        package: existsHash(path.resolve(import.meta.dir, '../package.json')),
        lock: existsHash(path.resolve(import.meta.dir, '../bun.lock')),
      };
      for (const module of c.recipe.modules) {
        const records = module.symbols.map((symbol) => {
          const matches = ir.records.filter(
            (r) => r.source === module.source && r.symbol === symbol,
          );
          if (matches.length !== 1) throw new Error('Ambiguous/missing IR record: ' + symbol);
          return matches[0]!;
        });
        const blocked = records.filter((r) => r.diagnostic || !r.ir);
        if (blocked.length)
          throw new BlockedSemantic(blocked.map((r) => r.symbol + ': ' + r.diagnostic).join('\n'));
        for (const record of records) {
          if (record.sourceSha256 !== module.sha256)
            throw new Error('Resolved source identity differs from recipe');
          if (
            module.packagePin &&
            (JSON.stringify(record.packagePin) !== JSON.stringify(module.packagePin) ||
              record.library !== module.library ||
              !record.ir!.reference!.id.startsWith(module.library + '::'))
          )
            throw new Error('Resolved external library identity differs from recipe');
        }
        active.origins!.push(
          ...records.map((record) => ({
            source: record.source,
            symbol: record.symbol,
            qualifiedId: record.ir!.reference!.id,
            offset: record.ir!.offset,
            length: record.ir!.length,
            spanSha256: record.spanSha256!,
            destination: module.destination,
            package: c.recipe.package,
            ...(module.packagePin
              ? {
                  packagePin: module.packagePin,
                  library: module.library!,
                  sourceSha256: record.sourceSha256,
                }
              : {}),
          })),
        );
        const declarations = records.map((r) => r.ir as Declaration),
          manual = manualInputs(module),
          generated = contentCache(
            {
              root: getPortCacheRoot(),
              namespace: 'typescript-base',
              identity: { emitter: emitterIdentity, declarations, module, manual },
            },
            () => {
              const output = emitDart(declarations, module, manual);
              loadedEmitterIdentity();
              typescriptIdentity();
              return { 'generated.ts': Buffer.from(output) };
            },
            (artifacts) => {
              if (Object.keys(artifacts).length !== 1 || !artifacts['generated.ts']?.length)
                throw new Error('Invalid generated base cache');
            },
          );
        cache.push(generated.report);
        const file = path.join(c.directory, 'base', module.destination);
        plainPath(file, c.directory);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, generated.artifacts['generated.ts']!);
      }
      active.phase = 'generated';
      save();
      if (action === 'generate') {
        announce();
        return;
      }
      const snapshots: Record<string, string | null> = {};
      active.files = [];
      for (const module of c.recipe.modules) {
        const dest = destination(c.recipe, module),
          oldFile = promotedFiles.find((file) => file.destination === module.destination);
        const current = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null,
          next = fs.readFileSync(path.join(c.directory, 'base', module.destination), 'utf8');
        snapshots[module.destination] = current;
        let effective = next;
        if (oldFile) {
          if (oldFile.mode === 'adopted')
            effective =
              current ??
              (() => {
                throw new Error('Adopted file was deleted');
              })();
          else {
            const oldBase = path.join(
              scratch,
              c.recipe.id,
              oldFile.fingerprint,
              'base',
              module.destination,
            );
            if (!fs.existsSync(oldBase) || existsHash(oldBase) !== oldFile.baseHash)
              throw new Error(
                'Previous base unavailable; current edits retained. Reproduce its exact fingerprint before merging.',
              );
            if (current === null)
              throw new Error('Generated product deleted externally; retained as conflict');
            effective = merge(current, fs.readFileSync(oldBase, 'utf8'), next, c.directory);
          }
          if (
            oldFile.mode === 'generated' &&
            current !== null &&
            sha(current) !== oldFile.baseHash
          ) {
            const base = path.join(
                scratch,
                c.recipe.id,
                oldFile.fingerprint,
                'base',
                module.destination,
              ),
              editDir = path.join(migration, 'edits', c.recipe.id);
            fs.mkdirSync(editDir, { recursive: true });
            const diff = spawnSync('git', ['diff', '--no-index', '--', base, dest], {
              encoding: 'utf8',
              timeout: 1200000,
              windowsHide: true,
            });
            if (diff.error || (diff.status !== 1 && diff.status !== 0))
              throw new Error('Cannot capture manual correction input');
            const duplicateName =
              c.recipe.modules.filter(
                (other) => path.basename(other.destination) === path.basename(module.destination),
              ).length > 1;
            const patchFile = path.join(
              editDir,
              (duplicateName ? module.destination : path.basename(module.destination)) + '.patch',
            );
            fs.mkdirSync(path.dirname(patchFile), { recursive: true });
            fs.writeFileSync(
              patchFile,
              diff.stdout
                .replaceAll(base.replaceAll('\\', '/'), 'generated-base/' + module.destination)
                .replaceAll(dest.replaceAll('\\', '/'), module.destination),
            );
          }
        } else if (
          current !== null &&
          c.recipe.adoptExisting?.[module.destination] !== sha(current)
        )
          throw new Error(
            'Destination is not generated-owned or explicitly adopted: ' + module.destination,
          );
        // No other recipe may claim a product file.
        for (const [id, other] of Object.entries(s.batches))
          if (
            id !== c.recipe.id &&
            other.files.some((file) => file.destination === module.destination)
          )
            throw new Error('Destination already owned by ' + id);
        if (c.recipe.contract && c.recipe.contract.ownership !== (oldFile?.mode ?? 'generated'))
          throw new Error('Contract ownership differs from generated/adopted file state');
        const file = path.join(c.directory, 'effective', module.destination);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, effective);
        active.files.push({
          destination: module.destination,
          mode: oldFile?.mode ?? 'generated',
          baseHash: sha(next),
          productHash: sha(effective),
          fingerprint: c.fingerprint,
          recipe: path.relative(repository, c.absolute).replaceAll('\\', '/'),
        });
      }
      json(path.join(c.directory, 'product-snapshots.json'), snapshots);
      active.phase = 'composed';
      save();
      if (action === 'compose') {
        announce();
        return;
      }
      const p = owner(c.recipe),
        configFile = path.join(repository, p.directory, p.config),
        config = ts.readConfigFile(configFile, ts.sys.readFile),
        parsed = ts.parseJsonConfigFileContent(
          config.config,
          ts.sys,
          path.dirname(configFile),
          { noEmit: true },
          configFile,
        );
      // Explicit adoption is pinned once, not refreshed from the live product.
      const virtual = new Map(
        c.recipe.modules.map((m) => [
          destination(c.recipe, m).toLowerCase(),
          fs.readFileSync(path.join(c.directory, 'effective', m.destination), 'utf8'),
        ]),
      );
      const host = ts.createCompilerHost(parsed.options),
        originalRead = host.readFile,
        originalExists = host.fileExists;
      host.readFile = (file) => virtual.get(path.resolve(file).toLowerCase()) ?? originalRead(file);
      host.fileExists = (file) =>
        virtual.has(path.resolve(file).toLowerCase()) || originalExists(file);
      const program = ts.createProgram(
          [
            ...new Set([
              ...parsed.fileNames,
              ...c.recipe.modules.map((m) => destination(c.recipe, m)),
            ]),
          ],
          parsed.options,
          host,
        ),
        diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
      if (diagnostics.length)
        throw new Error(
          ts.formatDiagnosticsWithColorAndContext(diagnostics, {
            getCurrentDirectory: () => repository,
            getCanonicalFileName: (x) => x,
            getNewLine: () => '\n',
          }),
        );
      const effectiveRoot = path.join(c.directory, 'effective-repository');
      fs.mkdirSync(path.join(effectiveRoot, p.directory), { recursive: true });
      fs.cpSync(
        path.join(repository, p.directory, p.sourceRoot),
        path.join(effectiveRoot, p.directory, p.sourceRoot),
        {
          recursive: true,
          filter: (source) => {
            if (fs.lstatSync(source).isSymbolicLink())
              throw new Error('Linked effective source rejected');
            return true;
          },
        },
      );
      for (const module of c.recipe.modules)
        fs.copyFileSync(
          path.join(c.directory, 'effective', module.destination),
          path.join(effectiveRoot, module.destination),
        );
      const semantic = command(
        process.execPath,
        [path.resolve(repository, c.recipe.validation)],
        repository,
        {
          ...process.env,
          NELYX_DART: dart,
          NELYX_EFFECTIVE_ROOT: effectiveRoot,
          NELYX_BATCH_CONTEXT: JSON.stringify({
            id: c.recipe.id,
            directory: c.directory,
            source: c.source,
            modules: c.recipe.modules,
            irFile,
            contract: c.recipe.contract,
          }),
        },
      );
      fs.writeFileSync(path.join(c.directory, 'semantic.log'), semantic);
      active.validation = { types: true, semantic: true, fixtureHash: c.identity.validationHash! };
      if (c.recipe.contract) {
        active.validation.nelyx = { status: 'PASS', contractId: c.recipe.contract.id };
        active.validation.sourceComparison = { status: 'notRun', fixtureHash: null };
        if (c.recipe.sourceComparison) {
          try {
            const comparison = command(
              process.execPath,
              [path.resolve(repository, c.recipe.sourceComparison)],
              repository,
              {
                ...process.env,
                NELYX_DART: dart,
                NELYX_EFFECTIVE_ROOT: effectiveRoot,
                NELYX_BATCH_CONTEXT: JSON.stringify({
                  id: c.recipe.id,
                  directory: c.directory,
                  source: c.source,
                  modules: c.recipe.modules,
                  irFile,
                }),
              },
            );
            fs.writeFileSync(path.join(c.directory, 'source-comparison.log'), comparison);
            active.validation.sourceComparison = {
              status: 'PASS',
              fixtureHash: c.identity.sourceComparisonHash,
            };
          } catch (error) {
            active.validation.sourceComparison = {
              status: 'FAIL',
              fixtureHash: c.identity.sourceComparisonHash,
              diagnostic: String(error),
            };
          }
        }
      }
      if (c.recipe.requireSourceComparison && active.validation.sourceComparison?.status !== 'PASS')
        throw new Error('Required source comparison did not pass; candidate cannot promote');
      const acceptance = {
        contract: c.recipe.contract ?? null,
        validation: active.validation,
        files: active.files,
        origins: active.origins,
      };
      json(
        path.join(c.directory, 'acceptance-' + sha(JSON.stringify(acceptance)) + '.json'),
        acceptance,
      );
      active.phase = 'validated';
      save();
      if (action === 'validate') {
        announce();
        return;
      }
      // Recheck the recipe/tool/dependency bytes and every product immediately
      // before entering the single-writer transaction.
      if (context(recipeFile).fingerprint !== c.fingerprint)
        throw new Error('Batch inputs changed while validating');
      for (const module of c.recipe.modules)
        if (
          existsHash(destination(c.recipe, module)) !==
          (snapshots[module.destination] === null ? null : sha(snapshots[module.destination]!))
        )
          throw new Error('Product edited during generation: ' + module.destination);
      const journalFile = path.join(repository, '.tmp/work8/promotion-journal.json');
      const journal = {
        phase: 'promoting',
        stateBefore: structuredClone(s),
        files: active.files.map((file) => ({
          destination: file.destination,
          before: snapshots[file.destination]!,
          afterHash: file.productHash,
        })),
      };
      json(journalFile, journal);
      try {
        for (const module of c.recipe.modules) {
          const dest = destination(c.recipe, module),
            temporary = dest + '.w8-' + process.pid;
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(path.join(c.directory, 'effective', module.destination), temporary);
          if (
            existsHash(dest) !==
            (snapshots[module.destination] === null ? null : sha(snapshots[module.destination]!))
          )
            throw new Error('Product changed at commit: ' + module.destination);
          fs.renameSync(temporary, dest);
        }
        active.phase = 'promoted';
        active.promotion = {
          fingerprint: c.fingerprint,
          files: structuredClone(active.files),
          validation: active.validation!,
          origins: active.origins!,
        };
        save();
        json(journalFile, { ...journal, phase: 'committed' });
      } catch (error) {
        recoverJournal();
        throw error;
      }
      announce();
    } catch (error) {
      active.phase =
        error instanceof BlockedSemantic
          ? 'blocked-semantic'
          : String(error).includes('conflict') || String(error).includes('edited')
            ? 'conflict'
            : 'failed';
      active.diagnostics.push(String(error));
      // Preserve the last promoted base for safe retries after a failed attempt.
      active.files = promotedFiles;
      save();
      throw error;
    }
  } finally {
    fs.closeSync(handle);
    fs.unlinkSync(lock);
  }
}
