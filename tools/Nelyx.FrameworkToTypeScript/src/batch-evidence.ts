// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Declaration, DestinationIdentity } from './coverage-format.ts';
interface Origin {
  qualifiedId: string;
  spanSha256: string;
  destination: string;
}
interface Comparison {
  status: 'PASS' | 'FAIL' | 'notRun';
  fixtureHash: string | null;
}
interface Batch {
  phase: string;
  fingerprint: string;
  origins: Origin[];
  files: { destination: string; productHash: string; recipe?: string }[];
  validation?: {
    types: boolean;
    semantic: boolean;
    fixtureHash: string;
    nelyx?: { status: 'PASS'; contractId: string };
    sourceComparison?: Comparison;
  };
  identity: {
    recipe: {
      revision: string;
      validation: string;
      sourceComparison?: string;
      contract?: { id: string; classification: string; differences: string[] };
    };
    tool: Record<string, string>;
    dependencies: Record<string, string>;
  };
}
/** Compiler identity + exact source span + accepted current product bytes. */
export function readBatchEvidence(root: string, pin: string) {
  const file = path.join(root, 'tools/Nelyx.FrameworkToTypeScript/data/work8/state.json'),
    entries = new Map<
      string,
      {
        origin: Origin;
        id: string;
        hash: string;
        contract?: { id: string; classification: string; differences: string[] };
        comparison: string;
      }
    >(),
    envelopes: Record<string, unknown> = {};
  const hash = (file: string) =>
    fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
  if (fs.existsSync(file)) {
    const state = JSON.parse(fs.readFileSync(file, 'utf8')) as { batches: Record<string, Batch> };
    for (const [id, batch] of Object.entries(state.batches)) {
      if (
        batch.phase !== 'promoted' ||
        !batch.validation?.types ||
        !batch.validation.semantic ||
        batch.identity.recipe.revision !== pin
      )
        continue;
      if (
        batch.files.some(
          (file) =>
            file.recipe &&
            (!fs.existsSync(path.resolve(root, file.recipe)) ||
              JSON.stringify(
                JSON.parse(fs.readFileSync(path.resolve(root, file.recipe), 'utf8')),
              ) !== JSON.stringify(batch.identity.recipe)),
        )
      )
        continue;
      if (
        hash(path.resolve(root, batch.identity.recipe.validation)) !==
          batch.validation.fixtureHash ||
        Object.entries(batch.identity.tool).some(
          ([file, value]) =>
            hash(path.resolve(root, 'tools/Nelyx.FrameworkToTypeScript', file)) !== value,
        ) ||
        Object.entries(batch.identity.dependencies).some(
          ([file, value]) => hash(path.resolve(root, file)) !== value,
        ) ||
        batch.files.some((file) => hash(path.resolve(root, file.destination)) !== file.productHash)
      )
        continue;
      const contract = batch.identity.recipe.contract;
      if (
        contract &&
        (!batch.validation.nelyx ||
          batch.validation.nelyx.status !== 'PASS' ||
          batch.validation.nelyx.contractId !== contract.id)
      )
        continue;
      const reference = batch.validation.sourceComparison;
      const comparison = !contract
        ? 'PASS'
        : !reference || reference.status === 'notRun'
          ? 'notRun'
          : batch.identity.recipe.sourceComparison &&
              hash(path.resolve(root, batch.identity.recipe.sourceComparison)) ===
                reference.fixtureHash
            ? reference.status
            : 'stale';
      const evidence = 'w8-generated-' + id + '-' + batch.fingerprint.slice(0, 16);
      envelopes[evidence] = {
        status: 'PASS',
        scope:
          'Accepted resolved-body scalar/data batch only; current compiler destination and source span are checked per record. No full class, native/physical or complete dependency parity.',
        contract,
        nelyx: batch.validation.nelyx ?? null,
        sourceComparison: comparison,
        revision: pin,
        fingerprint: batch.fingerprint,
        recipe: batch.identity.recipe,
        fixtureSha256: batch.validation.fixtureHash,
        files: batch.files,
      };
      for (const origin of batch.origins)
        entries.set(origin.qualifiedId, {
          origin,
          id: evidence,
          hash: batch.files.find((file) => file.destination === origin.destination)!.productHash,
          ...(contract ? { contract } : {}),
          comparison,
        });
    }
  }
  return {
    envelopes,
    review(item: Declaration, mappings: DestinationIdentity[]): Record<string, unknown> {
      const proof = entries.get(item.id);
      if (
        !proof ||
        proof.origin.spanSha256 !== item.source.sha256 ||
        !mappings.some(
          (mapping) => mapping.file === proof.origin.destination && mapping.sha256 === proof.hash,
        )
      )
        return {};
      return {
        ...(proof.comparison === 'PASS' &&
        (!proof.contract || proof.contract.classification === 'compatible')
          ? { implementation: 'adapted' }
          : {}),
        ...(proof.contract ? { nelyxContract: { ...proof.contract, status: 'PASS' } } : {}),
        differences: proof.contract
          ? proof.contract.differences
          : [
              'Generated from resolved pinned Dart execution IR with explicit TypeScript host adapters; comparison scope remains in the historical receipt.',
            ],
        verification: {
          automaticBatch: proof.id,
          types: 'PASS',
          sourceComparison: proof.comparison,
          fullClass: 'PARTIAL',
          platformAcceptance: 'notVerified',
        },
        evidence: [proof.id],
      };
    },
  };
}
