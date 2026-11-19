// SPDX-License-Identifier: BSD-3-Clause
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repository = fs.realpathSync(path.resolve(import.meta.dir, '../../..'));
const packages = ['material', 'cupertino'] as const;
const candidateFolder = 'src/generated/flutter-design';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
type Package = (typeof packages)[number];
type Mode = 'write' | 'check';
type Binding = {
  module: string;
  file: string;
  match: 'mapped-origin' | 'candidate';
  ownership: 'adopted' | 'generated';
};
type DesignRecord = {
  upstreamId: string;
  owner: string;
  library?: string;
  symbol?: string;
  publicIn: string[];
  scope?: string;
  origin: { file: string; line: number; offset: number; length: number; sha256: string };
  bindings: Binding[];
  constantMembers?: DesignRecord[];
};
type Outcome = {
  status: string;
  file?: string;
  diagnostic?: string;
  bindings?: Binding[];
};
const material2Exclusion: Outcome = {
  status: 'excluded-material-2',
  diagnostic: 'Pinned private defaults selected only when ThemeData.useMaterial3 is false',
};
export type DesignSourcePlan = {
  revision: string;
  mode: Mode;
  records: DesignRecord[];
  external: { id: string; publicIn: string[] }[];
};
export type DesignModuleInput = {
  source: string;
  sha256: string;
  symbols: string[];
  identities?: string[];
  unit?: number;
};

function count(values: Iterable<string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function ownedPackage(file: string) {
  const match =
    /^packages\/flutter\/lib\/src\/(material|cupertino)\/([a-z0-9_]+(?:\/[a-z0-9_]+)*(?:\.[a-z0-9_]+)*)\.dart$/.exec(
      file,
    );
  if (!match) throw Error(`Unsupported design source path: ${file}`);
  return { owner: match[1] as Package, source: match[2]!.replaceAll('_', '-') };
}

function destinationFor(module: DesignModuleInput, revision: string) {
  const { owner, source } = ownedPackage(module.source);
  const identity = hash(JSON.stringify([revision, module.source, module.identities]));
  const name = module.symbols[0]!.replace(/[^A-Za-z0-9]/g, '-').toLowerCase();
  return {
    owner,
    identity,
    file: `packages/${owner}/${candidateFolder}/${source}/${name}-${identity.slice(0, 12)}.generated.ts`,
  };
}

function plainDirectory(directory: string, root: string) {
  const relative = path.relative(root, directory);
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`))
    throw Error(`Candidate directory is outside its owner: ${directory}`);
  for (let current = directory; current !== root; current = path.dirname(current)) {
    const entry = fs.lstatSync(current, { throwIfNoEntry: false });
    if (entry && !entry.isDirectory())
      throw Error(`Candidate directory has a different owner: ${current}`);
  }
}

function ownedBytes(identity: string, source: string): string {
  return `// W11 Flutter design source ${identity} SHA256 ${hash(source)}\n${source}`;
}

function ownsBytes(identity: string, text: string): boolean {
  const boundary = text.indexOf('\n');
  if (boundary < 0) return false;
  return text === ownedBytes(identity, text.slice(boundary + 1));
}

export function writeDesignSource(
  target: ReturnType<typeof destinationFor>,
  source: string,
  mode: Mode,
  root = repository,
): Outcome {
  const { file, identity, owner } = target;
  const absolute = path.join(root, file);
  const folder = path.dirname(absolute);
  const next = ownedBytes(identity, source);
  try {
    plainDirectory(folder, path.join(root, 'packages', owner, candidateFolder));
    plainDirectory(path.join(root, 'packages', owner, candidateFolder), root);
    const entry = fs.lstatSync(absolute, { throwIfNoEntry: false });
    if (entry && !entry.isFile())
      return {
        file,
        status: 'ownership-conflict',
        diagnostic: 'Destination is not a regular file',
      };
    const current = entry ? fs.readFileSync(absolute, 'utf8') : null;
    if (current === next) return { file, status: 'unchanged-source' };
    if (current !== null && !ownsBytes(identity, current))
      return {
        file,
        status: 'ownership-conflict',
        diagnostic: 'Destination has local edits or a different origin',
      };
    if (mode === 'check')
      return { file, status: current === null ? 'missing-source' : 'different-source' };
    fs.mkdirSync(folder, { recursive: true });
    const staging = path.join(folder, `.${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(staging, next, { flag: 'wx' });
      if (current === null) fs.linkSync(staging, absolute);
      else if (fs.readFileSync(absolute, 'utf8') === current) fs.renameSync(staging, absolute);
      else
        return {
          file,
          status: 'ownership-conflict',
          diagnostic: 'Destination changed during regeneration',
        };
    } finally {
      fs.rmSync(staging, { force: true });
    }
    return { file, status: current === null ? 'written-source' : 'regenerated-source' };
  } catch (error) {
    return { file, status: 'source-write-error', diagnostic: String(error) };
  }
}

function existingBinding(record: DesignRecord): Outcome | undefined {
  if (!record.bindings.length) return;
  const mapped = record.bindings.filter((binding) => binding.match === 'mapped-origin');
  const bindings = mapped.length ? mapped : record.bindings;
  const files = new Set(bindings.map((binding) => binding.file));
  if (files.size !== 1)
    return {
      status: 'existing-ownership-review',
      diagnostic: 'Multiple source files export this declaration',
      bindings,
    };
  return {
    status: mapped.length ? 'mapped-existing-origin' : 'existing-signature-review',
    file: bindings[0]!.file,
    bindings,
  };
}

function checkSources(files: string[]) {
  const ast = ts.readConfigFile(
    path.join(repository, 'packages/material/tsconfig.build.json'),
    ts.sys.readFile,
  );
  const config = ts.parseJsonConfigFileContent(ast.config, ts.sys, repository);
  const program = ts.createProgram(
    files.map((file) => path.join(repository, file)),
    { ...config.options, rootDir: repository, noEmit: true, incremental: false },
  );
  return [...(ast.error ? [ast.error] : []), ...ts.getPreEmitDiagnostics(program)].map((error) => {
    const file = error.file;
    return {
      code: error.code,
      message: ts.flattenDiagnosticMessageText(error.messageText, '\n'),
      ...(file
        ? {
            file: path.relative(repository, file.fileName).replaceAll('\\', '/'),
            line: file.getLineAndCharacterOfPosition(error.start ?? 0).line + 1,
          }
        : {}),
    };
  });
}

function staleFiles(owner: Package, expected: ReadonlySet<string>): string[] {
  const folder = `packages/${owner}/${candidateFolder}`;
  const absolute = path.join(repository, folder);
  if (!fs.lstatSync(absolute, { throwIfNoEntry: false })?.isDirectory()) return [];
  const files: string[] = [];
  const visit = (from: string) => {
    for (const entry of fs.readdirSync(path.join(repository, from), { withFileTypes: true })) {
      const relative = `${from}/${entry.name}`;
      if (entry.isDirectory()) visit(relative);
      else if (entry.isFile() && relative.endsWith('.generated.ts') && !expected.has(relative))
        files.push(relative);
    }
  };
  visit(folder);
  return files.sort();
}

export function createDesignSourceBatch(plan: DesignSourcePlan) {
  const records = plan.records.flatMap((record) => [record, ...(record.constantMembers ?? [])]);
  const byId = new Map(records.map((record) => [record.upstreamId, record]));
  const outcomes = new Map<string, Outcome>();
  const emitted = new Set<string>();
  const present = new Set<string>();
  const candidateStatuses = new Set(['written-source', 'regenerated-source', 'unchanged-source']);
  const sourceErrors = new Set([
    'missing-source',
    'different-source',
    'ownership-conflict',
    'source-write-error',
  ]);
  const owners = new Map(
    records
      .filter((record) => record.symbol && !record.symbol.includes('.'))
      .map((record) => [`${record.library}::${record.symbol}`, record.upstreamId]),
  );
  return {
    select(module: DesignModuleInput) {
      if (module.identities?.length !== module.symbols.length)
        throw Error(`Design body module has no resolved identities: ${module.source}`);
      const { owner } = ownedPackage(module.source);
      return module.identities.flatMap((id, index) => {
        const record = byId.get(id);
        if (record?.owner !== `@nelyx/${owner}` || record.origin.file !== module.source)
          throw Error(`Unexpected design input owner: ${id}`);
        if (record.scope === 'material-2-only') {
          outcomes.set(id, material2Exclusion);
          return [];
        }
        const match = existingBinding(record);
        if (match) outcomes.set(id, match);
        return match ? [] : [{ id, symbol: module.symbols[index]! }];
      });
    },
    record(ids: string[], outcome: Outcome) {
      for (const id of ids) outcomes.set(id, outcome);
    },
    emit(module: DesignModuleInput, source: string) {
      const target = destinationFor(module, plan.revision);
      emitted.add(target.file);
      const outcome = writeDesignSource(target, source, plan.mode);
      if (candidateStatuses.has(outcome.status)) present.add(target.file);
      return outcome;
    },
    report(summary: boolean) {
      const diagnostics = checkSources([...present]);
      const stale = packages.flatMap((name) => staleFiles(name, emitted));
      const rows = records.map((record) => {
        const { upstreamId, owner, publicIn, origin } = record;
        const { scope, symbol, library } = record;
        let outcome =
          record.scope === 'material-2-only'
            ? material2Exclusion
            : (outcomes.get(upstreamId) ?? existingBinding(record));
        if (!outcome && packages.some((name) => owner === `@nelyx/${name}`)) {
          const separator = upstreamId.lastIndexOf('::');
          const recordLibrary = library ?? upstreamId.slice(0, separator);
          const name = (symbol ?? upstreamId.slice(separator + 2)).split('.')[0];
          const parentId = owners.get(`${recordLibrary}::${name}`);
          const parent = parentId && outcomes.get(parentId);
          outcome = parent
            ? {
                ...parent,
                status: candidateStatuses.has(parent.status)
                  ? 'generated-member-review'
                  : parent.bindings
                    ? 'existing-member-review'
                    : parent.status,
              }
            : {
                status: 'no-body-unit',
                diagnostic: 'No resolved body module owns this declaration',
              };
        }
        outcome ??= {
          status: 'shared-binding-required',
          diagnostic: `Implement or bind through ${owner}`,
        };
        return { upstreamId, owner, publicIn, scope, origin, ...outcome };
      });
      const errors = diagnostics.filter(({ file }) => file && present.has(file));
      const output = {
        schema: 'nelyx.design-source-batch/v1',
        revision: plan.revision,
        mode: plan.mode,
        packages: Object.fromEntries(
          packages.map((name) => {
            const prefix = `packages/${name}/`;
            const owned = rows.filter((row) => row.owner === `@nelyx/${name}`);
            const files = [...present].filter((file) => file.startsWith(prefix));
            const errorsByFile = new Set(errors.map((item) => item.file));
            return [
              name,
              {
                ownRecords: count(owned.map((row) => row.status)),
                publicRecords: count(
                  owned.filter((row) => row.publicIn.includes(name)).map((row) => row.status),
                ),
                scope: count(owned.flatMap((row) => (row.scope ? [row.scope] : []))),
                sourceFiles: files.length,
                typecheckedFiles: files.filter((file) => !errorsByFile.has(file)).length,
              },
            ];
          }),
        ),
        shared: count(
          rows
            .filter((row) => !packages.some((name) => row.owner === `@nelyx/${name}`))
            .map((row) => row.status),
        ),
        externalBindings: plan.external.length,
        staleSources: stale,
        typeDiagnostics: count(diagnostics.map((item) => `TS${item.code}`)),
        ...(summary ? {} : { declarations: rows, external: plan.external, diagnostics }),
      };
      const checkFailed =
        plan.mode === 'check' &&
        (stale.length > 0 || [...outcomes.values()].some(({ status }) => sourceErrors.has(status)));
      return { output, checkFailed };
    },
  };
}
