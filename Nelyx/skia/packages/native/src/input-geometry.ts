// SPDX-License-Identifier: BSD-3-Clause
import {
  encodeInputGeometry,
  decodeInputGeometry,
  inputGeometryProtocol,
} from '@nelyx/core/hosting/input-geometry';
import type { InputGeometryService } from '@nelyx/core/hosting/input-geometry';
import type { ViewOwner } from '@nelyx/core/ui/types';
import type { Skia } from './skia/types/Skia.ts';
let nextSession = 0;
/** One owner-thread synchronous service. It retains no tree or GPU resource. */
export function createInputGeometryService(
  api: Skia,
  owner: ViewOwner,
  ensure: () => void,
): InputGeometryService | undefined {
  if (api.nelyxInputGeometryVersion === undefined) return undefined;
  if (
    api.nelyxInputGeometryVersion() !== inputGeometryProtocol.version ||
    !api.nelyxInputGeometrySession
  )
    throw Error('Native input geometry capability/version differs from the SDK');
  if (!Number.isSafeInteger(nextSession + 1)) throw Error('Input geometry session space exhausted');
  const session = ++nextSession,
    native = api.nelyxInputGeometrySession(session, owner.generation);
  let closed = false,
    revision = 0;
  return {
    project(frame, nodes, editors) {
      ensure();
      if (closed) throw Error('Input geometry owner closed');
      if (frame.owner.id !== owner.id || frame.owner.generation !== owner.generation)
        throw Error('Foreign input geometry owner');
      if (!Number.isSafeInteger(revision + 1))
        throw Error('Input geometry revision space exhausted');
      const diagnostic = frame.geometryDiagnostics,
        trace = diagnostic?.diagnostics;
      const began = trace?.now();
      const packet = encodeInputGeometry(frame, session, ++revision, nodes, editors);
      if (trace)
        trace.record(
          diagnostic!.token,
          'input-geometry-packet',
          began!,
          nodes.length,
          packet.byteLength,
        );
      const nativeBegan = trace?.now();
      const result = native.evaluate(packet.buffer as ArrayBuffer);
      if (trace)
        trace.record(
          diagnostic!.token,
          'input-geometry-jsi',
          nativeBegan!,
          editors.length,
          result.byteLength,
        );
      // Native code copies input before any result allocation; an invalid
      // capability never silently retries the same getters through TS.
      ensure();
      if (closed) throw Error('Input geometry owner closed during calculation');
      const decodeBegan = trace?.now(),
        output = new Float64Array(result);
      const decoded = decodeInputGeometry(packet, output);
      if (trace) {
        trace.record(
          diagnostic!.token,
          'input-geometry-decode',
          decodeBegan!,
          editors.length,
          output.byteLength,
        );
        trace.recordDuration(
          diagnostic!.token,
          'input-geometry-copy-validate',
          output[14]!,
          nodes.length,
          packet.byteLength,
        );
        trace.recordDuration(
          diagnostic!.token,
          'input-geometry-kernel',
          output[15]!,
          editors.length,
          output.byteLength,
        );
      }
      return decoded;
    },
    dispose() {
      if (closed) return;
      closed = true;
      native.close();
    },
  };
}
