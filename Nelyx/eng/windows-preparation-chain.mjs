// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const handleEqual = (a, b) => a && b && a.slot === b.slot && a.generation === b.generation;
const sameOwner = (native, target) =>
  native.owner === target.owner &&
  native.metrics === target.metrics &&
  native.device === target.device &&
  native.font === target.font;
const delay = (at, start) =>
  at && Number.isFinite(start) ? { minimumMs: at.from - start, maximumMs: at.to - start } : null;
const between = (later, earlier) =>
  later && earlier
    ? { minimumMs: later.from - earlier.to, maximumMs: later.to - earlier.from }
    : null;

/** Read-only evidence, with explicit observation brackets and missing chains.
 * Neither first observed preparation nor callback completion proves demand or
 * ready pixels. Exact IDs are decimal strings, never JS numeric conversions. */
export function preparationChain(native, source) {
  const result = {
    domain: source?.clockDomain ?? null,
    scope: 'retained-bounded-samples',
    demandToCoverage: 'notVerified',
    actualDemandCreation: 'notObserved',
    sourceCalls: source?.calls ?? 0,
    sourceOverwritten: source?.samplesOverwritten ?? 0,
    sourceOverwrittenPending: source?.overwrittenPending ?? 0,
    sourceTerminals: source?.terminals ?? null,
    nativeThrough: native?.through ?? 0,
    nativeOverwritten: native?.overwritten ?? 0,
    nativeOverwrittenPending: native?.overwrittenPending ?? 0,
    nativeOutOfOrder: native?.outOfOrder ?? 0,
    nativeTerminals: native?.terminals ?? null,
    nativePending: native?.pending ?? 0,
    clockCompatible: native?.domain === 'qpc-milliseconds' && source?.clockDomain === native.domain,
    requestMatched: 0,
    readyMatched: 0,
    publishedMatched: 0,
    missing: {},
    samples: [],
  };
  const missing = (reason) => (result.missing[reason] = (result.missing[reason] ?? 0) + 1);
  for (const sample of source?.samples ?? []) {
    const target = sample.target;
    const row = {
      sequence: sample.sequence,
      kind: sample.kind,
      sourceMs: sample.elapsedMs,
      terminal: sample.terminal ?? 'pending',
      target,
      acceptedDocument: sample.acceptedDocument ?? null,
      requestObservedToSource: null,
      sourceToReady: null,
      readyToProvider: null,
      providerToActivation: null,
      activationToPublication: null,
      request: null,
      accepted: null,
      readyViewport: null,
      publishedViewport: null,
    };
    result.samples.push(row);
    if (!result.clockCompatible) {
      missing('clock-domain');
      continue;
    }
    if (!target) {
      missing('source-target');
      continue;
    }
    const requested = (native?.samples ?? []).find(
      (n) =>
        sameOwner(n, target) &&
        n.preparation === target.preparation &&
        n.document === target.document &&
        n.requests.some(
          (r) =>
            r.id === target.requestId &&
            r.revision === target.revision &&
            handleEqual(r.node, target.node) &&
            (!target.range ||
              (r.listGeneration === target.range.generation &&
                r.begin === target.range.begin &&
                r.end === target.range.end)),
        ),
    );
    if (requested) {
      ++result.requestMatched;
      const request = requested.requests.find(
        (r) => r.id === target.requestId && handleEqual(r.node, target.node),
      );
      row.request = request;
      // Reverse the native observation bracket for a Source endpoint.
      row.requestObservedToSource = {
        minimumMs: sample.started - request.observed.to,
        maximumMs: sample.started - request.observed.from,
      };
    } else missing(target.requestId ? 'native-request' : 'non-authoritative-source-request');
    const candidates = (native?.samples ?? []).filter(
      (n) => sameOwner(n, target) && n.document === sample.acceptedDocument,
    );
    const exactPublication = candidates.filter((n) => n.publication === sample.publication);
    const published = candidates.filter((n) => n.published);
    const eligible = exactPublication.length
      ? exactPublication
      : published.length
        ? published
        : candidates;
    const accepted = eligible.length === 1 ? eligible[0] : undefined;
    if (!accepted) {
      missing(
        candidates.length > 1
          ? 'ambiguous-native-cohort'
          : sample.acceptedDocument
            ? 'native-accepted-document'
            : 'unaccepted-source',
      );
      continue;
    }
    row.accepted = {
      preparation: accepted.preparation,
      document: accepted.document,
      publication: accepted.publication,
      terminal: accepted.terminal,
      truncated: accepted.truncated,
      requestOverflow: accepted.requestOverflow,
    };
    const rangeMatches = (v) =>
      handleEqual(v.content, target.node) &&
      (!target.range ||
        (v.listGeneration === target.range.generation &&
          v.begin <= target.range.begin &&
          v.end >= target.range.end));
    row.readyViewport = accepted.viewports.find(rangeMatches) ?? null;
    row.publishedViewport = accepted.publishedViewports.find(rangeMatches) ?? null;
    // A general native-ready bit still does not prove the requested viewport.
    if (accepted.layoutReady && !accepted.truncated && !accepted.requestOverflow) {
      ++result.readyMatched;
      row.sourceToReady = delay(accepted.layoutReady, sample.started + sample.elapsedMs);
      row.readyToProvider = between(accepted.providerReady, accepted.layoutReady);
    } else missing('native-ready');
    if (accepted.providerReady)
      row.providerToActivation = between(accepted.activated, accepted.providerReady);
    if (accepted.activated)
      row.activationToPublication = between(accepted.published, accepted.activated);
    if (accepted.published) ++result.publishedMatched;
    else missing('native-publication');
    if (!row.readyViewport || !row.publishedViewport) missing('exact-list-range');
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { native, source } = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
    process.stdout.write(JSON.stringify(preparationChain(native, source)));
  } catch (error) {
    console.error(`Preparation evidence: ${error.message}`);
    process.exitCode = 1;
  }
}
