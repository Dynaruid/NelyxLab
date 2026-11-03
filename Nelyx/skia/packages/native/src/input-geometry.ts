// SPDX-License-Identifier: BSD-3-Clause
import {
  encodeInputGeometry,
  decodeInputGeometry,
  inputGeometryProtocol,
  retainedInputGeometryProtocol,
  decodeRetainedInputGeometry,
  projectInputGeometry,
} from '@nelyx/core/hosting/input-geometry';
import type {
  InputGeometryService,
  InputGeometryBatch,
  InputGeometryCandidate,
  InputGeometryFrame,
  InputGeometryNode,
} from '@nelyx/core/hosting/input-geometry';
import type { ViewOwner } from '@nelyx/core/ui/types';
import type { Rect } from '@nelyx/core/ui/types';
import { isCapturedTransform } from '@nelyx/core/ui/geometry';
import type { TransformMatrix } from '@nelyx/core/ui/geometry';
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

interface RetainedNode extends InputGeometryNode {
  readonly token: { readonly slot: number; readonly handle: number };
  readonly owned: boolean;
}
const sameRect = (a: Rect | null, b: Rect | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    Object.is(a.x, b.x) &&
    Object.is(a.y, b.y) &&
    Object.is(a.width, b.width) &&
    Object.is(a.height, b.height));
const sameLocal = (a: TransformMatrix, b: TransformMatrix): boolean =>
  a === b || (a.length === b.length && a.every((value, index) => Object.is(value, b[index])));

/** Retains only numeric metadata and weak source identities. Native publication
 * shares the existing CPU geometry commit; no callback or render tree is held. */
export function createRetainedInputGeometryService(
  api: Skia,
  owner: ViewOwner,
  ensure: () => void,
): InputGeometryService | undefined {
  const p = retainedInputGeometryProtocol;
  if (api.nelyxRetainedInputGeometryVersion === undefined) return undefined;
  if (
    api.nelyxRetainedInputGeometryVersion() !== p.version ||
    !api.nelyxRetainedInputGeometrySession
  )
    throw Error('Retained input geometry capability/version differs from the SDK');
  let sessionsCreated = 0,
    committedFrames = 0,
    fallbackFrames = 0;
  const fallbackReasons: Record<string, number> = {};
  const noteFallback = (reason: string) => {
    fallbackFrames++;
    fallbackReasons[reason] = (fallbackReasons[reason] ?? 0) + 1;
  };
  const execution = () => ({
    schema: 1,
    kind: 'execution',
    mode: 'retained' as const,
    ownerGeneration: owner.generation,
    sessionsCreated,
    committedFrames,
    fallbackFrames,
    fallbackReasons: { ...fallbackReasons },
    closed,
  });
  let native: ReturnType<NonNullable<Skia['nelyxRetainedInputGeometrySession']>> | undefined,
    session = 0,
    revision = 0,
    committedRevision = 0,
    closed = false,
    records: (RetainedNode | undefined)[] = Array.from({ length: p.slots }),
    generations: number[] = Array.from({ length: p.slots }, () => 0),
    keys = new WeakMap<object, RetainedNode['token']>(),
    active: InputGeometryBatch | undefined,
    pending: InputGeometryCandidate | undefined,
    stamp: readonly (number | null)[] | undefined;
  const check = (frame?: InputGeometryFrame) => {
    ensure();
    if (closed) throw Error('Retained input geometry owner closed');
    if (frame && (frame.owner.id !== owner.id || frame.owner.generation !== owner.generation))
      throw Error('Foreign retained input geometry owner');
  };
  const reset = () => {
    if (!native && !pending && !active && !stamp) return;
    try {
      pending?.discard();
      active?.discard();
    } finally {
      try {
        native?.close();
      } finally {
        native = undefined;
        pending = undefined;
        active = undefined;
        committedRevision = 0;
        records = Array.from({ length: p.slots });
        generations = Array.from({ length: p.slots }, () => 0);
        keys = new WeakMap();
        stamp = undefined;
      }
    }
  };
  const service: InputGeometryService = {
    limits: Object.freeze({ nodes: p.nodes, editors: p.editors }),
    reset,
    noteFallback,
    execution,
    stats: () =>
      native
        ? Array.from(new Float64Array(native.stats()))
        : [0, 0, 0, 0, 0, closed ? 1 : 0, 0, 0, 0, 0],
    project(frame, nodes, editors) {
      check(frame);
      return projectInputGeometry(frame, nodes, editors);
    },
    begin(frame) {
      check(frame);
      pending?.discard();
      active?.discard();
      const nextStamp = [
        frame.metrics.viewportGeneration,
        frame.metrics.rendererGeneration,
        frame.metrics.nativeContextGeneration,
        frame.metrics.nativeSurfaceGeneration,
      ];
      if (stamp && stamp.some((value, index) => value !== nextStamp[index])) reset();
      if (!Number.isSafeInteger(++revision)) throw Error('Retained geometry revision exhausted');
      const candidateRevision = revision,
        next = records.slice(),
        nextGenerations = generations.slice(),
        order: RetainedNode[] = [],
        updates: RetainedNode[] = [],
        seen = new Set<number>();
      let open = true,
        prepared = false,
        cursor = 0;
      let candidateNative: typeof native;
      const current = () => {
        check(frame);
        if (!open || active !== batch) throw Error('Stale retained geometry batch');
      };
      const discard = () => {
        if (!open) return;
        open = false;
        const owns = active === batch || (candidate !== undefined && pending === candidate);
        try {
          if (owns && prepared) candidateNative!.discard(candidateRevision);
        } finally {
          if (pending === candidate) pending = undefined;
          if (active === batch) active = undefined;
        }
      };
      let candidate: InputGeometryCandidate | undefined;
      const batch: InputGeometryBatch = {
        node(key, parent, local, clip) {
          current();
          if (prepared) throw Error('Retained geometry batch already prepared');
          let token = keys.get(key),
            previous = token ? next[token.slot] : undefined;
          if (previous?.token !== token) previous = undefined;
          if (previous && seen.has(previous.token.handle)) return previous.token.handle;
          if (order.length >= p.nodes) throw Error('Retained geometry node budget');
          if (!previous) {
            while (cursor < p.slots && next[cursor]) cursor++;
            if (cursor === p.slots) throw Error('Retained geometry node budget');
            const slot = cursor++,
              generation = nextGenerations[slot]! + 1,
              handle = generation * p.slots + slot;
            if (!Number.isSafeInteger(handle)) throw Error('Retained geometry handle exhausted');
            nextGenerations[slot] = generation;
            token = { slot, handle };
            keys.set(key, token);
          }
          const owned = isCapturedTransform(local);
          // Raw numeric storage is copied by index once, preserving the source
          // representation/ownership flag without invoking a custom iterator.
          const captured = owned
            ? local
            : (Object.freeze(
                Array.from({ length: local.length }, (_, i) => local[i]!),
              ) as TransformMatrix);
          const capturedClip =
            clip === null
              ? null
              : Object.freeze({ x: clip.x, y: clip.y, width: clip.width, height: clip.height });
          const value: RetainedNode =
            previous &&
            previous.parent === parent &&
            previous.owned === owned &&
            sameLocal(previous.local, captured) &&
            sameRect(previous.clip, capturedClip)
              ? previous
              : { token: token!, parent, local: captured, clip: capturedClip, owned };
          next[token!.slot] = value;
          order.push(value);
          seen.add(token!.handle);
          if (value !== records[token!.slot]) updates.push(value);
          return token!.handle;
        },
        prepare(editors) {
          current();
          if (prepared || candidate) throw Error('Retained geometry batch already prepared');
          if (editors.length > p.editors) throw Error('Retained geometry editor budget');
          if (
            editors.some(
              (entry) => entry.core.selectionRects.length > inputGeometryProtocol.editorSelections,
            )
          )
            throw Error('Retained geometry editor selection budget');
          const removals: number[] = [];
          for (let slot = 0; slot < p.slots; slot++)
            if (next[slot] && !seen.has(next[slot]!.token.handle)) {
              removals.push(next[slot]!.token.handle);
              next[slot] = undefined;
            }
          const selectionCount = editors.reduce(
              (sum, entry) => sum + entry.core.selectionRects.length,
              0,
            ),
            diagnostic = frame.geometryDiagnostics,
            trace = diagnostic?.diagnostics,
            began = trace?.now();
          if (selectionCount > inputGeometryProtocol.selections)
            throw Error('Retained geometry selection budget');
          let projections;
          if (selectionCount > p.selections) {
            noteFallback('selection-budget');
            // A known capacity miss uses already captured numbers, never a
            // second RenderObject/getter walk and never a protocol-error retry.
            const indices = new Map(order.map((value, index) => [value.token.handle, index]));
            projections = projectInputGeometry(
              frame,
              order.map((value) => ({
                parent: value.parent < 0 ? -1 : indices.get(value.parent)!,
                local: value.local,
                clip: value.clip,
              })),
              editors.map((entry) => ({ node: indices.get(entry.node)!, core: entry.core })),
            );
            trace?.recordDuration(
              diagnostic!.token,
              'input-geometry-retained-budget',
              0,
              editors.length,
            );
          } else {
            if (!native) {
              if (!Number.isSafeInteger(nextSession + 1))
                throw Error('Input geometry session space exhausted');
              session = ++nextSession;
              native = api.nelyxRetainedInputGeometrySession!(session, owner.generation);
              sessionsCreated++;
              // Even an uncommitted native candidate belongs to this cohort.
              stamp = nextStamp;
            }
            const editorAt = p.headerWords + updates.length * p.nodeWords + removals.length,
              selectionAt = editorAt + editors.length * inputGeometryProtocol.editorWords,
              packet = new Float64Array(selectionAt + selectionCount * 4);
            packet.set([
              p.magic,
              p.version,
              session,
              owner.generation,
              candidateRevision,
              frame.metrics.viewportGeneration,
              frame.metrics.nativeSurfaceGeneration ?? -1,
              frame.metrics.scale,
              frame.metrics.logicalWidth,
              frame.metrics.logicalHeight,
              updates.length,
              editors.length,
              selectionCount,
              packet.length,
              trace ? 1 : 0,
              committedRevision,
              removals.length,
              order.length,
              0,
              0,
            ]);
            let at: number = p.headerWords;
            for (const value of updates) {
              packet[at] = value.token.handle;
              packet[at + 1] = value.parent;
              packet[at + 2] = value.local.length;
              for (let lane = 0; lane < value.local.length; lane++)
                packet[at + 3 + lane] = value.local[lane]!;
              if (value.clip)
                packet.set(
                  [1, value.clip.x, value.clip.y, value.clip.width, value.clip.height],
                  at + 19,
                );
              packet[at + 24] = value.owned ? 1 : 0;
              at += p.nodeWords;
            }
            packet.set(removals, at);
            at = editorAt;
            let selection = 0;
            for (const entry of editors) {
              const core = entry.core;
              packet.set(
                [
                  entry.node,
                  core.epoch,
                  core.width,
                  core.height,
                  core.caret.x,
                  core.caret.y,
                  core.caret.width,
                  core.caret.height,
                  core.caretBaseline.x,
                  core.caretBaseline.y,
                  selection,
                  core.selectionRects.length,
                ],
                at,
              );
              at += inputGeometryProtocol.editorWords;
              for (const rect of core.selectionRects) {
                packet.set([rect.x, rect.y, rect.width, rect.height], selectionAt + selection * 4);
                selection++;
              }
            }
            trace?.record(
              diagnostic!.token,
              'input-geometry-packet',
              began!,
              updates.length,
              packet.byteLength,
            );
            const nativeBegan = trace?.now();
            candidateNative = native;
            try {
              const result = candidateNative.prepare(packet.buffer as ArrayBuffer);
              prepared = true;
              trace?.record(
                diagnostic!.token,
                'input-geometry-jsi',
                nativeBegan!,
                editors.length,
                result.byteLength,
              );
              check(frame);
              if (!open || active !== batch)
                throw Error('Retained geometry changed during preparation');
              const output = new Float64Array(result),
                decodeBegan = trace?.now();
              projections = decodeRetainedInputGeometry(packet, output);
              trace?.record(
                diagnostic!.token,
                'input-geometry-decode',
                decodeBegan!,
                editors.length,
                output.byteLength,
              );
              trace?.recordDuration(
                diagnostic!.token,
                'input-geometry-retained-upserts',
                0,
                updates.length,
                packet.byteLength,
              );
              trace?.recordDuration(
                diagnostic!.token,
                'input-geometry-retained-nodes',
                0,
                order.length,
              );
              if (trace) {
                trace.recordDuration(
                  diagnostic!.token,
                  'input-geometry-copy-validate',
                  output[14]!,
                  updates.length,
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
            } catch (error) {
              // Reset after native/VM/decode failure, without retrying hooks.
              open = false;
              // A reentrant replacement may already have committed a newer
              // batch. An older failure cannot close that newer native state.
              if (revision === candidateRevision) reset();
              throw error;
            }
          }
          current();
          candidate = {
            projections,
            commit() {
              check(frame);
              if (!open || active !== batch || pending !== candidate) return false;
              if (prepared) {
                try {
                  candidateNative!.commit(candidateRevision);
                } catch (error) {
                  reset();
                  throw error;
                }
                committedRevision = candidateRevision;
                committedFrames++;
                records = next;
                generations = nextGenerations;
                stamp = nextStamp;
              }
              open = false;
              active = undefined;
              pending = undefined;
              return true;
            },
            discard,
          };
          pending = candidate;
          return candidate;
        },
        discard,
      };
      active = batch;
      return batch;
    },
    dispose() {
      if (closed) return;
      closed = true;
      try {
        reset();
      } finally {
        api.nelyxReportInputGeometryStatus?.(JSON.stringify(execution()));
      }
    },
  };
  return service;
}
