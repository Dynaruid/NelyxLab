// SPDX-License-Identifier: BSD-3-Clause
export interface Selection {
  id?: string;
  language?: 'csharp' | 'dart';
  repository?: string;
  revision?: string;
  coverageId?: string;
  packagePin?: { name: string; version: string; archiveSha256: string };
  reviewedAgainst?: string[];
  source: string;
  sha256: string;
  symbol: string;
  destination: string;
  destinationPackage?: string;
  mode: 'automatic' | 'reviewed-port';
  excludeMembers?: string[];
  ports?: Record<string, string>;
  imports?: Record<string, string>;
}
export interface Manifest {
  revision: string;
  rules: string;
  selections: Selection[];
}
/** Older W5 entries retain identity; new selections are qualified by repository, language and source. */
export function selectionId(entry: Selection): string {
  return (
    entry.id ??
    `${entry.repository ?? 'Doroti'}:${entry.language ?? 'csharp'}:${entry.source}::${entry.symbol}`
  );
}
export function validateSelections(manifest: Manifest): void {
  if (!manifest.revision || !manifest.rules || !Array.isArray(manifest.selections))
    throw new Error('Invalid selection manifest');
  const identities = new Set<string>();
  for (const entry of manifest.selections) {
    const id = selectionId(entry);
    const symbolPattern =
      entry.language === 'dart' && entry.mode === 'reviewed-port'
        ? /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/
        : /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (
      !symbolPattern.test(entry.symbol) ||
      identities.has(id) ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      !['automatic', 'reviewed-port'].includes(entry.mode)
    )
      throw new Error('Invalid/duplicate selection identity, hash or mode');
    if (entry.language && entry.language !== 'csharp' && entry.language !== 'dart')
      throw new Error('Unsupported source language');
    identities.add(id);
    for (const [name, module] of Object.entries(entry.imports ?? {}))
      if (
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ||
        !(
          (module.startsWith('.') && module.endsWith('.ts')) ||
          /^@nelyx\/[a-z][a-z0-9-]*\/[a-z0-9/-]+$/.test(module)
        )
      )
        throw new Error('Ports must be relative .ts imports or public Nelyx direct subpaths');
  }
}
