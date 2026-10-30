// SPDX-License-Identifier: BSD-3-Clause
import type { PaintCommand } from '../../ui/types.ts';

export interface PictureBatchPart {
  readonly from: number;
  readonly to: number;
  readonly state: boolean;
}
export interface PictureBatchPartition extends PictureBatchPart {
  readonly previous?: number;
}
const stateOperations = new Set([
  'save',
  'restore',
  'transform',
  'clip',
  'clipRect',
  'clipRRect',
  'clipPath',
  'saveLayer',
  'saveBackdropFilter',
]);

/** Split only a previously recorded batch. Balanced unchanged scopes stay
 * together; state around changing content moves into the composition program.
 * Existing boundaries remain stable so a stationary frame does not merge and
 * recompile the pieces again. There is no cross-frame search or history. */
export function partitionPictureBatch(
  commands: readonly PaintCommand[],
  previous: readonly PictureBatchPart[],
  unchanged: readonly boolean[],
): readonly PictureBatchPartition[] {
  const ends = Array<number>(commands.length).fill(-1),
    stack: number[] = [],
    differences = [0],
    effects = [0],
    old = new Map<number, number>();
  for (let index = 0; index < previous.length; index++) old.set(previous[index]!.from, index);
  for (let index = 0; index < commands.length; index++) {
    const op = commands[index]!.op;
    if (op === 'save' || op === 'saveLayer' || op === 'saveBackdropFilter') stack.push(index);
    else if (op === 'restore') ends[stack.pop()!] = index;
    differences.push(differences[index]! + (unchanged[index] ? 0 : 1));
    effects.push(
      effects[index]! +
        (!stateOperations.has(op) || op === 'saveLayer' || op === 'saveBackdropFilter' ? 1 : 0),
    );
  }
  const result: PictureBatchPartition[] = [];
  let pending: PictureBatchPartition | undefined,
    pendingUnchanged = false;
  const flush = () => {
    if (pending) {
      result.push(pending);
      pending = undefined;
    }
  };
  for (let index = 0; index < commands.length;) {
    const prior = old.get(index),
      part = prior === undefined ? undefined : previous[prior]!;
    if (part?.state) {
      flush();
      result.push({ from: index, to: index + 1, state: true });
      index++;
      continue;
    }
    if (part && differences[part.to] === differences[index]) {
      flush();
      result.push({ ...part, previous: prior! });
      index = part.to;
      continue;
    }
    const end = ends[index]!,
      same = end >= index && differences[end + 1] === differences[index];
    if (same) {
      if (effects[end + 1] === effects[index]) {
        flush();
        index = end + 1;
        continue;
      }
    } else if (stateOperations.has(commands[index]!.op)) {
      flush();
      result.push({ from: index, to: index + 1, state: true });
      index++;
      continue;
    }
    // Consecutive draws without a save scope belong to one painter's batch.
    // Separate unchanged scopes, rather than producing a picture per draw.
    const to = same ? end + 1 : index + 1,
      stable = same;
    if (pending && (pendingUnchanged !== stable || pending.to !== index)) flush();
    pending = { from: pending?.from ?? index, to, state: false };
    pendingUnchanged = stable;
    index = to;
  }
  flush();
  return result;
}
