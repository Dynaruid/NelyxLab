// SPDX-License-Identifier: BSD-3-Clause
import { sourceDependencyClosure, type SourceDependencyFrontier } from './source-dependencies.ts';
import type { BodyRecord } from './body-ir.ts';

export interface SourceDependencyOutcome {
  library: string;
  symbol: string;
  source: string | null;
  /** An exact attempted body, including an explicit unsupported diagnostic. */
  record?: BodyRecord;
  /** Location/resolution failure; never a replacement declaration. */
  diagnostic?: string;
}
const ownerKey = (owner: { library: string; symbol: string }) =>
  owner.library + '::' + owner.symbol;
const referenceLibrary = (id: string) => id.slice(0, id.indexOf('::'));

/** Expand whole source bodies to a fixed point under an explicit library policy.
 * Unsupported bodies are attempted once and remain on the reachable frontier.
 * A fixed point does not imply that unsupported or out-of-policy bodies closed. */
export function expandSourceDependencies(options: {
  records: BodyRecord[];
  roots: { source: string; symbol: string }[];
  include: (owner: SourceDependencyFrontier) => boolean;
  resolve: (owners: SourceDependencyFrontier[], round: number) => SourceDependencyOutcome[];
  maxRounds: number;
}) {
  if (!Number.isSafeInteger(options.maxRounds) || options.maxRounds < 1)
    throw new Error('Expansion requires a positive bounded round count');
  const records = [...options.records],
    attempted = new Map<string, SourceDependencyOutcome & { round: number }>();
  const rounds: {
    round: number;
    requested: string[];
    resolved: number;
    unsupported: number;
    unresolved: number;
    selectedAfter: number;
  }[] = [];
  let closure = sourceDependencyClosure(records, options.roots);
  for (let round = 1; round <= options.maxRounds; round++) {
    const requested = closure.frontier.filter(
      (owner) => options.include(owner) && !attempted.has(ownerKey(owner)),
    );
    if (!requested.length) break;
    const outcomes = options.resolve(structuredClone(requested), round),
      expected = new Map(requested.map((owner) => [ownerKey(owner), owner]));
    if (outcomes.length !== expected.size || new Set(outcomes.map(ownerKey)).size !== expected.size)
      throw new Error('Expansion resolver must return each exact requested owner once');
    // Validate the entire round before incorporating any result.
    for (const outcome of outcomes) {
      const key = ownerKey(outcome);
      if (!expected.has(key))
        throw new Error('Expansion resolver returned an unrequested owner: ' + key);
      if (outcome.record) {
        const row = outcome.record;
        if (
          !outcome.source ||
          row.source !== outcome.source ||
          row.symbol !== outcome.symbol ||
          Boolean(row.ir) === Boolean(row.diagnostic) ||
          outcome.diagnostic
        )
          throw new Error('Expansion body request identity differs: ' + key);
        if (
          row.ir &&
          (!row.ir.reference ||
            referenceLibrary(row.ir.reference.id) !== outcome.library ||
            row.ir.name !== outcome.symbol)
        )
          throw new Error('Expansion body resolved to a different analyzer owner: ' + key);
      } else if (!outcome.diagnostic)
        throw new Error('Expansion missing body must retain its location diagnostic: ' + key);
    }
    let resolved = 0,
      unsupported = 0,
      unresolved = 0;
    for (const outcome of outcomes) {
      attempted.set(ownerKey(outcome), { ...outcome, round });
      if (outcome.record) {
        records.push(outcome.record);
        if (outcome.record.ir) resolved++;
        else unsupported++;
      } else unresolved++;
    }
    closure = sourceDependencyClosure(records, options.roots);
    rounds.push({
      round,
      requested: requested.map(ownerKey),
      resolved,
      unsupported,
      unresolved,
      selectedAfter: closure.selected.length,
    });
  }
  const frontier = closure.frontier.map((owner) => {
    const attempt = attempted.get(ownerKey(owner));
    return {
      ...owner,
      status: !options.include(owner)
        ? ('OUT_OF_POLICY' as const)
        : !attempt
          ? ('NOT_ATTEMPTED' as const)
          : attempt.record
            ? ('UNSUPPORTED_BODY' as const)
            : ('UNRESOLVED_LOCATION' as const),
      ...(attempt ? { attempt } : {}),
    };
  });
  return {
    records,
    closure: { ...closure, frontier },
    rounds,
    attempts: [...attempted.values()],
    fixedPoint: !frontier.some((owner) => owner.status === 'NOT_ATTEMPTED'),
    closedWithinPolicy:
      closure.blocked.length === 0 && !frontier.some((owner) => owner.status !== 'OUT_OF_POLICY'),
  };
}
