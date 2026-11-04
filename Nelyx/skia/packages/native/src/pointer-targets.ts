// SPDX-License-Identifier: BSD-3-Clause
import type { PointerTargetsService } from '@nelyx/core/hosting/pointer-targets';
import {
  captureTransform,
  createPointerPosition,
  retainPointerPositionCapture,
} from '@nelyx/core/ui/geometry';
import type { Skia } from './skia/types/Skia.ts';
export interface NativePointerTargetsSession {
  patch(packet: ArrayBuffer): void;
  query(packet: ArrayBuffer): number[];
  drop(id: number): void;
  close(): void;
}
/** Bounded numeric trees only. Current live contract validation belongs to the
 * render owner; changed rows cross JSI, unchanged trees send only the query. */
export function createPointerTargetsService(
  api: Skia,
  generation: number,
  ensure: () => void,
  options: { readonly strategy?: 'linear-prefix' | 'closed-reference' } = {},
) {
  if (api.nelyxPointerTargetsVersion?.() !== 2 || !api.nelyxPointerTargetsSession)
    throw new Error('Requested pointer-targets capability missing; rebuild native inputs');
  type Tree = {
    id: number;
    revision: number;
    rows: readonly (readonly number[])[];
    active: boolean;
  };
  const native = api.nelyxPointerTargetsSession(generation),
    releasePositions = retainPointerPositionCapture(),
    trees = new Map<number, Tree>();
  let roots = new WeakMap<object, Tree>();
  let closed = false,
    next = 0;
  const work = {
    strategy: options.strategy ?? 'linear-prefix',
    queries: 0,
    prefixQueries: 0,
    prefixNodes: 0,
    visited: 0,
    patches: 0,
    bytes: 0,
    paths: 0,
    supportNodes: 0,
    tsFallbacks: 0,
    fallbackReasons: {} as Record<string, number>,
    closed: false,
  };
  const request = (
    root: object,
    rows: readonly (readonly number[])[],
    x: number,
    y: number,
    toLocal: readonly number[],
    operation: number,
  ) => {
    ensure();
    if (closed) throw new Error('Pointer targets owner closed');
    if (!rows.length || rows.length > 128 || toLocal.length !== 6)
      throw new Error('Pointer targets support budget');
    let tree = roots.get(root);
    if (!tree?.active) {
      if (trees.size === 16) {
        const [key, old] = trees.entries().next().value!;
        native.drop(old.id);
        old.active = false;
        old.rows = [];
        trees.delete(key);
      }
      tree = { id: ++next, revision: 0, rows: [], active: true };
      roots.set(root, tree);
      trees.set(tree.id, tree);
    } else {
      trees.delete(tree.id);
      trees.set(tree.id, tree);
    }
    const changed = rows.filter((row, index) =>
      row.some((n, lane) => !Object.is(n, tree!.rows[index]?.[lane])),
    );
    if (changed.length || tree.rows.length !== rows.length) {
      const packet = new Float64Array([
        0x4e4c5054,
        2,
        generation,
        tree.id,
        ++tree.revision,
        rows.length,
        changed.length,
        ...changed.flat(),
      ]);
      native.patch(packet.buffer);
      tree.rows = rows;
      work.patches++;
      work.bytes += packet.byteLength;
    }
    const packet = new Float64Array([
      generation,
      tree.id,
      tree.revision,
      x,
      y,
      operation,
      ...toLocal,
    ]);
    const output = native.query(packet.buffer);
    return { output, revision: tree.revision };
  };
  const record = (output: readonly number[], count: number) => {
    work.queries++;
    work.visited += output[2]!;
    work.supportNodes += count;
    work.bytes += 96;
  };
  const service: PointerTargetsService & { execution(): typeof work } = {
    query(root, rows, x, y, toLocal) {
      const { output, revision } = request(root, rows, x, y, toLocal, 0);
      if (
        output.length < 4 ||
        output[0] !== revision ||
        ![0, 1].includes(output[1]!) ||
        !Number.isSafeInteger(output[2]) ||
        output[2]! < 1 ||
        output[2]! > rows.length ||
        !Number.isSafeInteger(output[3]) ||
        output[3]! < 0 ||
        output[3]! > rows.length ||
        output.length !== 4 + output[3]! * 7 ||
        output.some((n) => !Number.isFinite(n))
      )
        throw new Error('Invalid native pointer path');
      const path = [];
      for (let i = 4; i < output.length; i += 7) {
        const id = output[i]!;
        if (!Number.isSafeInteger(id) || id < 1 || id > rows.length)
          throw new Error('Foreign native pointer target');
        path.push({ id, transform: captureTransform(output.slice(i + 1, i + 7)) });
      }
      record(output, rows.length);
      work.paths += path.length;
      return { hit: output[1] === 1, path };
    },
    noteFallback(reason) {
      work.tsFallbacks++;
      work.fallbackReasons[reason] = (work.fallbackReasons[reason] ?? 0) + 1;
    },
    execution: () => ({ ...work, fallbackReasons: { ...work.fallbackReasons } }),
    dispose() {
      if (closed) return;
      closed = true;
      try {
        native.close();
      } finally {
        releasePositions();
        trees.clear();
        roots = new WeakMap();
        work.closed = true;
      }
    },
  };
  if (work.strategy === 'linear-prefix')
    service.prefix = (root, rows, x, y, toLocal) => {
      const { output, revision } = request(root, rows, x, y, toLocal, 1);
      const terminal = output[1]!,
        count = output[3]!;
      if (
        output.length === 4 &&
        output[0] === revision &&
        terminal === -1 &&
        count === 0 &&
        Number.isSafeInteger(output[2]) &&
        output[2]! >= 1 &&
        output[2]! <= rows.length
      ) {
        record(output, rows.length);
        work.prefixQueries++;
        service.noteFallback('nonfinite-prefix');
        return;
      }
      if (
        output.length < 4 ||
        output[0] !== revision ||
        ![0, rows.length].includes(terminal) ||
        !Number.isSafeInteger(count) ||
        count < 0 ||
        count > rows.length ||
        output.length !== 4 + count * 11 ||
        output.some((n) => !Number.isFinite(n)) ||
        output[2] !== count + (terminal ? 0 : 1) ||
        (terminal ? count !== rows.length : count >= rows.length)
      )
        throw new Error('Invalid native pointer prefix');
      const steps = [];
      for (let i = 4; i < output.length; i += 11) {
        const id = output[i]!;
        if (id !== steps.length + 1) throw new Error('Foreign native prefix step');
        steps.push({
          id,
          position: createPointerPosition(output[i + 1]!, output[i + 2]!),
          transform: captureTransform(output.slice(i + 3, i + 9)),
          inverseTranslation: [output[i + 9]!, output[i + 10]!] as const,
        });
      }
      record(output, rows.length);
      work.prefixQueries++;
      work.prefixNodes += count - (terminal ? 1 : 0);
      return { terminal, steps };
    };
  return service;
}
