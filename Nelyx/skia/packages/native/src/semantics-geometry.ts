// SPDX-License-Identifier: BSD-3-Clause
import type {
  SemanticsGeometryService,
  SemanticsGeometryResult,
  SemanticsRect,
} from '@nelyx/core/hosting/semantics-geometry';
import type { ViewOwner } from '@nelyx/core/ui/types';
import type { Skia } from './skia/types/Skia.ts';
let nextSession = 0;
export function createSemanticsGeometryService(
  api: Skia,
  owner: ViewOwner,
  ensure: () => void,
): SemanticsGeometryService | undefined {
  if (api.nelyxSemanticsGeometryVersion === undefined) return undefined;
  if (api.nelyxSemanticsGeometryVersion() !== 1 || !api.nelyxSemanticsGeometrySession)
    throw Error('Semantics geometry capability/version differs from SDK');
  const session = ++nextSession,
    native = api.nelyxSemanticsGeometrySession(session, owner.generation);
  let revision = 0,
    closed = false;
  return {
    project(token, queries, diagnostics) {
      ensure();
      if (closed || token.owner.id !== owner.id || token.owner.generation !== owner.generation)
        throw Error('Closed/foreign Semantics geometry owner');
      const rev = ++revision;
      if (!Number.isSafeInteger(rev)) throw Error('Semantics geometry revision exhausted');
      const m = token.metrics,
        wordLength = 16 + queries.length * 57,
        resultLength = 16 + queries.length * 31;
      if (queries.length > 8192 || (wordLength + 2 * resultLength) * 8 + 4096 > 4 * 1024 * 1024)
        throw Error('Semantics geometry aggregate byte/node budget exceeded');
      const began = diagnostics?.now(),
        packet = new Float64Array(wordLength);
      packet.set([
        0x4e4c5347,
        1,
        session,
        owner.generation,
        rev,
        m.viewportGeneration,
        m.rendererGeneration,
        m.nativeContextGeneration ?? -1,
        m.nativeSurfaceGeneration ?? -1,
        m.scale,
        queries.length,
        57,
        31,
        wordLength,
        diagnostics ? 1 : 0,
        0,
      ]);
      let at = 16;
      for (const q of queries) {
        if (q.transform.length !== 16 || (q.parentTransform && q.parentTransform.length !== 16))
          throw Error('Semantics geometry requires captured Matrix4 values');
        packet.set(q.transform, at);
        at += 16;
        packet[at++] = q.parentTransform ? 1 : 0;
        if (q.parentTransform) packet.set(q.parentTransform, at);
        at += 16;
        for (const r of [q.paint, q.semantic, q.parentPaint, q.parentSemantic]) {
          packet[at++] = r ? 1 : 0;
          if (r) packet.set(r, at);
          at += 4;
        }
        packet.set(q.bounds, at);
        at += 4;
      }
      if (diagnostics)
        diagnostics.record(
          token,
          'semantics-geometry-packet',
          began!,
          queries.length,
          packet.byteLength,
        );
      const before = diagnostics?.now(),
        out = new Float64Array(native.evaluate(packet.buffer));
      if (diagnostics)
        diagnostics.record(
          token,
          'semantics-geometry-native',
          before!,
          queries.length,
          out.byteLength,
        );
      ensure();
      if (closed || revision !== rev) throw Error('Stale Semantics geometry result');
      if (out.length !== resultLength || out[0] !== 0x4e4c5348 || out[13] !== out.length)
        throw Error('Malformed Semantics geometry result');
      for (let i = 1; i < 14; i++)
        if (i !== 13 && out[i] !== packet[i]) throw Error('Foreign Semantics geometry result');
      const result: SemanticsGeometryResult[] = [];
      const rect = (offset: number): SemanticsRect => [
        out[offset]!,
        out[offset + 1]!,
        out[offset + 2]!,
        out[offset + 3]!,
      ];
      for (let i = 0; i < queries.length; i++) {
        const offset = 16 + i * 31;
        for (const flag of [16, 21, 30])
          if (out[offset + flag] !== 0 && out[offset + flag] !== 1)
            throw Error('Malformed Semantics geometry flags');
        result.push({
          transform: [...out.subarray(offset, offset + 16)],
          paint: out[offset + 16] ? rect(offset + 17) : null,
          semantic: out[offset + 21] ? rect(offset + 22) : null,
          rect: rect(offset + 26),
          hidden: out[offset + 30] !== 0,
        });
      }
      if (diagnostics) {
        diagnostics.recordDuration(
          token,
          'semantics-geometry-validate',
          out[14]!,
          queries.length,
          packet.byteLength,
        );
        diagnostics.recordDuration(
          token,
          'semantics-geometry-kernel',
          out[15]!,
          queries.length,
          out.byteLength,
        );
        const stats = new Float64Array(native.stats());
        diagnostics.recordDuration(token, 'semantics-geometry-state', 0, 0, stats[4]!);
      }
      return result;
    },
    dispose() {
      if (closed) return;
      closed = true;
      native.close();
    },
  };
}
