// SPDX-License-Identifier: BSD-3-Clause
import type {
  SceneCompositionService,
  SceneCompositionSource,
  SceneCompositionRange,
} from '@nelyx/core/hosting/scene-composition';
import type { ViewOwner } from '@nelyx/core/ui/types';
import type { Skia } from './skia/types/Skia.ts';
let nextSession = 0;
/** Numeric metadata only on the native side. JS command/resource holds are
 * owned by the original recordings and each destination Canvas as before. */
export function createSceneCompositionService(
  api: Skia,
  owner: ViewOwner,
  ensure: () => void,
): SceneCompositionService | undefined {
  if (api.nelyxSceneCompositionVersion === undefined) return undefined;
  if (api.nelyxSceneCompositionVersion() !== 1 || !api.nelyxSceneCompositionSession)
    throw Error('Scene composition capability/version differs from SDK');
  const session = ++nextSession,
    native = api.nelyxSceneCompositionSession(session, owner.generation),
    ids = new WeakMap<SceneCompositionSource, number>(),
    live = new Set<number>(),
    pending = new Set<number>(),
    removed = new Set<number>();
  let nextId = 0,
    revision = 0,
    closed = false;
  return {
    begin(token, diagnostics) {
      ensure();
      if (closed || token.owner.id !== owner.id || token.owner.generation !== owner.generation)
        throw Error('Closed/foreign Scene composition owner');
      const rev = ++revision;
      if (!Number.isSafeInteger(rev)) throw Error('Scene composition revision exhausted');
      let prepared = false,
        attempted = false,
        ended = false,
        added: number[] = [],
        retired: number[] = [];
      return {
        compose(root) {
          ensure();
          if (closed || ended || attempted)
            throw Error('Scene composition transaction already used');
          attempted = true;
          const fallback = () => {
            for (const key of added) pending.delete(key);
            added = [];
            if (diagnostics) diagnostics.recordDuration(token, 'scene-compose-fallback', 0, 1);
            return undefined;
          };
          if (!root) return fallback();
          const began = diagnostics?.now(),
            sources = new Map<number, SceneCompositionSource>(),
            updates: number[] = [],
            stack = [{ source: root, depth: 1 }];
          let nodes = 0,
            edges = 0;
          const identify = (source: SceneCompositionSource) => {
            let key = ids.get(source);
            if (key === undefined) {
              key = ++nextId;
              if (!Number.isSafeInteger(key)) throw Error('Scene composition IDs exhausted');
              ids.set(source, key);
              const captured = key;
              source.onDispose(() => {
                if (!closed && (live.has(captured) || pending.has(captured))) removed.add(captured);
              });
            }
            return key;
          };
          const rootId = identify(root);
          while (stack.length) {
            const { source, depth } = stack.pop()!;
            if (depth > 128 || ++nodes > 8192) return fallback();
            const key = identify(source);
            if (sources.has(key)) continue;
            sources.set(key, source);
            const fresh = !live.has(key);
            if (fresh) {
              updates.push(
                key,
                0,
                source.scoped ? 1 : 0,
                source.draw ? 1 : source.commands.length,
                source.children.length,
              );
              added.push(key);
              pending.add(key);
            }
            for (let i = source.children.length - 1; i >= 0; i--)
              stack.push({ source: source.children[i]!.source, depth: depth + 1 });
            for (const child of source.children) {
              edges++;
              if (fresh) updates.push(child.mark, identify(child.source));
            }
          }
          retired = [...removed].filter((key) => live.has(key));
          const m = token.metrics,
            words = [
              0x4e4c5343,
              1,
              session,
              owner.generation,
              rev,
              m.viewportGeneration,
              m.rendererGeneration,
              m.nativeContextGeneration ?? -1,
              m.nativeSurfaceGeneration ?? -1,
              m.scale,
              added.length,
              retired.length,
              rootId,
              16 + updates.length + retired.length,
              0,
              0,
            ];
          if (words[13]! * 8 > 4 * 1024 * 1024) return fallback();
          const packet = new Float64Array(words[13]!);
          packet.set(words);
          packet.set(updates, 16);
          packet.set(retired, 16 + updates.length);
          const beforeNative = diagnostics?.now();
          if (diagnostics) {
            diagnostics.record(token, 'scene-compose-extract', began!, nodes, packet.byteLength);
            diagnostics.recordDuration(token, 'scene-compose-edges', 0, edges);
          }
          const bytes = native.prepare(packet.buffer);
          prepared = true;
          try {
            const output = new Float64Array(bytes);
            if (diagnostics)
              diagnostics.record(
                token,
                'scene-compose-native',
                beforeNative!,
                nodes,
                output.byteLength,
              );
            ensure();
            if (closed || revision !== rev) throw Error('Stale Scene composition result');
            if (
              output.length < 16 ||
              (output.length - 16) % 3 ||
              output[0] !== 0x4e4c534f ||
              output[13] !== output.length
            )
              throw Error('Malformed Scene composition result');
            for (let i = 1; i < 16; i++)
              if (i !== 13 && output[i] !== packet[i])
                throw Error('Foreign Scene composition result');
            const plan: SceneCompositionRange[] = [];
            for (let at = 16; at < output.length; at += 3) {
              const key = output[at]!,
                begin = output[at + 1]!,
                end = output[at + 2]!;
              if (key === 0) {
                if (begin !== end || (begin !== 0 && begin !== 1))
                  throw Error('Malformed Scene scope');
                plan.push({ scope: begin === 0 ? 'save' : 'restore' });
              } else {
                const source = sources.get(key);
                if (
                  !source ||
                  !Number.isInteger(begin) ||
                  !Number.isInteger(end) ||
                  begin < 0 ||
                  end < begin ||
                  end > (source.draw ? 1 : source.commands.length)
                )
                  throw Error('Malformed Scene range');
                plan.push({ source, begin, end });
              }
            }
            if (diagnostics) {
              const stats = new Float64Array(native.stats());
              diagnostics.recordDuration(
                token,
                'scene-compose-state',
                0,
                stats[0]! + stats[1]!,
                stats[4]!,
              );
            }
            return plan;
          } catch (error) {
            if (!closed) native.discard(rev);
            prepared = false;
            throw error;
          }
        },
        commit() {
          if (ended) return;
          ensure();
          if (closed || revision !== rev) throw Error('Stale Scene composition commit');
          if (prepared) {
            native.commit(rev);
            for (const key of added) live.add(key);
            for (const key of retired) {
              live.delete(key);
              removed.delete(key);
            }
          }
          ended = true;
          for (const key of added) {
            pending.delete(key);
            if (!live.has(key)) removed.delete(key);
          }
          added = [];
          retired = [];
        },
        discard() {
          if (ended) return;
          if (prepared && !closed) native.discard(rev);
          for (const key of added) pending.delete(key);
          for (const key of added) if (!live.has(key)) removed.delete(key);
          ended = true;
          added = [];
          retired = [];
        },
      };
    },
    dispose() {
      if (closed) return;
      closed = true;
      native.close();
      live.clear();
      pending.clear();
      removed.clear();
    },
  };
}
