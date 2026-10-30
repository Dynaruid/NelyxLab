// SPDX-License-Identifier: BSD-3-Clause
export interface DestinationIdentity {
  module: string;
  package?: string;
  export: string;
  member: string | null;
  file: string;
  sha256: string;
  access?: string;
  literal?: string;
  local?: string;
  exportSource?: { file: string; sha256: string };
}
/** Both an inherited member's declaring source and its exported class must still match. */
export function reviewedDestinationsMatch(
  previous: readonly DestinationIdentity[] | undefined,
  current: readonly DestinationIdentity[],
): boolean {
  if (!previous?.length) return current.length === 0;
  return previous.every((old) =>
    current.some(
      (now) =>
        old.module === now.module &&
        old.export === now.export &&
        old.member === now.member &&
        old.file === now.file &&
        old.sha256 === now.sha256 &&
        old.literal === now.literal &&
        old.local === now.local &&
        (old.access === undefined || old.access === now.access) &&
        ((old.exportSource === undefined && now.exportSource === undefined) ||
          (old.exportSource !== undefined &&
            now.exportSource !== undefined &&
            old.exportSource.file === now.exportSource.file &&
            old.exportSource.sha256 === now.exportSource.sha256)),
    ),
  );
}
/** Automatic reviews must be recreated from current dependency/tool/fixture
 * hashes, even when their generated destination bytes did not change. */
export function retainedReviewFields(
  previous: Record<string, unknown> | undefined,
  samePin: boolean,
  sameSpan: boolean,
  destinationStillExists: boolean,
): Record<string, unknown> {
  if (!previous || !samePin || !sameSpan || !destinationStillExists) return {};
  const evidence = Array.isArray(previous.evidence) ? previous.evidence : [],
    verification = previous.verification as { automaticBatch?: unknown } | undefined;
  if (
    verification?.automaticBatch !== undefined ||
    evidence.some((value) => typeof value === 'string' && value.startsWith('w8-generated-'))
  )
    return {};
  const reviewed =
    evidence.length > 0 ||
    (previous.implementation === 'notApplicable' &&
      Array.isArray(previous.differences) &&
      previous.differences.length > 0);
  if (!reviewed) return {};
  return Object.fromEntries(
    ['implementation', 'destination', 'differences', 'verification', 'evidence', 'adoptionIds']
      .filter((field) => previous[field] !== undefined)
      .map((field) => [field, previous[field]]),
  );
}
export interface Declaration {
  id: string;
  library: string;
  symbol: string;
  kind: string;
  public: boolean;
  exportedBy: string[];
  source: { file: string; offset: number; length: number; line: number; sha256: string };
  signature: string;
  members: string[];
  dependencies: string[];
  deprecated: boolean;
  internal: boolean;
  parameters?: unknown[];
  supertypes?: unknown[];
  constantFamily?: unknown;
}
export interface Inventory {
  schemaVersion: number;
  source: Record<string, unknown>;
  entrypoints: unknown[];
  conditionalExports: unknown[];
  conditionalImports?: { declarations: string[]; [key: string]: unknown }[];
  files: { path: string; sha256: string }[];
  declarations: Declaration[];
  diagnostics: unknown[];
}
interface CoverageItem extends Omit<Declaration, 'library' | 'symbol' | 'supertypes'> {
  upstreamId: string;
  conditionalExports?: string[];
  supertypes?: { id: string; type: string }[];
}
interface Coverage {
  schemaVersion: number;
  source: Record<string, unknown> & { files: { id: string; path: string; sha256: string }[] };
  scope: {
    entrypoints: { id: string; uri: string; exports: string[] }[];
    conditionalExports: { exports: string[] }[];
    conditionalImports?: { declarations: string[]; [key: string]: unknown }[];
  };
  analysis: { sourceDiagnostics: unknown[] };
  items: CoverageItem[];
  externalDependencies: { id: string; upstreamId: string }[];
}
/** Decode the already resolved pinned baseline for TS-only updates, without discarding reviewed records. */
export function readInventory(value: unknown): { inventory: Inventory; cached: boolean } {
  if (!value || typeof value !== 'object')
    throw new Error('Expected a resolved inventory or coverage manifest');
  if ('declarations' in value) {
    const inventory = value as Inventory;
    if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.declarations))
      throw new Error('Invalid resolved inventory');
    return { inventory, cached: false };
  }
  const coverage = value as Coverage;
  if (
    coverage.schemaVersion !== 1 ||
    !Array.isArray(coverage.items) ||
    !coverage.source?.files ||
    !coverage.scope?.entrypoints ||
    !coverage.analysis
  )
    throw new Error('Invalid cached coverage');
  const names = new Map(
    [...coverage.items, ...coverage.externalDependencies].map((item) => [item.id, item.upstreamId]),
  );
  const files = new Map(coverage.source.files.map((file) => [file.id, file.path]));
  const libraries = new Map(coverage.scope.entrypoints.map((library) => [library.id, library.uri]));
  function lookup(map: Map<string, string>, id: string): string {
    const value = map.get(id);
    if (value === undefined) throw new Error(`Unlinked cached inventory identity: ${id}`);
    return value;
  }
  const declarations = coverage.items.map((item) => {
    const id = item.upstreamId,
      separator = id.indexOf('::'),
      kind = id.lastIndexOf(':');
    if (separator < 1 || kind < separator)
      throw new Error(`Invalid canonical declaration identity: ${id}`);
    const source = { ...item.source, file: lookup(files, item.source.file) };
    return {
      id,
      library: id.slice(0, separator),
      symbol: id.slice(separator + 2, kind),
      kind: item.kind,
      source,
      signature: item.signature,
      public: item.public,
      deprecated: item.deprecated,
      internal: item.internal,
      exportedBy: [
        ...item.exportedBy.map((id) => lookup(libraries, id)),
        ...(item.conditionalExports ?? []),
      ],
      members: item.members.map((id) => lookup(names, id)),
      dependencies: item.dependencies.map((id) => lookup(names, id)),
      ...(item.parameters ? { parameters: item.parameters } : {}),
      ...(item.constantFamily ? { constantFamily: item.constantFamily } : {}),
      ...(item.supertypes
        ? { supertypes: item.supertypes.map((type) => ({ ...type, id: lookup(names, type.id) })) }
        : {}),
    };
  });
  return {
    cached: true,
    inventory: {
      schemaVersion: 1,
      source: coverage.source,
      files: coverage.source.files.map(({ path, sha256 }) => ({ path, sha256 })),
      diagnostics: coverage.analysis.sourceDiagnostics,
      entrypoints: coverage.scope.entrypoints.map((library) => ({
        uri: library.uri,
        exports: library.exports.map((id) => lookup(names, id)),
      })),
      conditionalExports: coverage.scope.conditionalExports.map((branch) => ({
        ...branch,
        exports: branch.exports.map((id) => lookup(names, id)),
      })),
      conditionalImports: (coverage.scope.conditionalImports ?? []).map((branch) => ({
        ...branch,
        declarations: branch.declarations.map((id) => lookup(names, id)),
      })),
      declarations,
    },
  };
}
