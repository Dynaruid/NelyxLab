// SPDX-License-Identifier: BSD-3-Clause
// CPU ownership sidecars never enter serialized frame values or native packets.
import type { ResourceId, PaintCommand } from './types.ts';
/** Shared ID encoding; resource ownership must not import frame/paint assembly. */
export function resourceKey(resource: ResourceId): string {
  return JSON.stringify([resource.id, resource.generation]);
}
export interface ResourceHold {
  dispose(): void;
}
export type ResourceRetainer = () => ResourceHold;
const factories = new WeakMap<ResourceId, { retain: ResourceRetainer; owner: object | null }>(),
  commandHolds = new WeakMap<PaintCommand, readonly ResourceHold[]>(),
  frameHolds = new WeakMap<readonly ResourceId[], readonly ResourceHold[]>();
const capturedIds = new WeakSet<ResourceId>();
/** @internal Only literal immutable IDs created at the resource capture boundary. */
export function isCapturedResourceId(resource: ResourceId): boolean {
  return capturedIds.has(resource);
}
export function bindResourceRetainer(
  resource: ResourceId,
  retain: ResourceRetainer,
  owner: object | null = null,
): void {
  if (capturedIds.has(resource))
    throw new Error(
      'Captured ResourceId bindings are immutable; bind the original input before capture',
    );
  factories.set(resource, { retain, owner });
}
export function resourceOwner(resource: ResourceId): object | null {
  return factories.get(resource)?.owner ?? null;
}
export function copyResourceId(
  resource: ResourceId,
  retain?: ResourceRetainer,
  owner: object | null = null,
): ResourceId {
  const copy = Object.freeze({ id: resource.id, generation: resource.generation }),
    binding = retain ? { retain, owner } : factories.get(resource);
  capturedIds.add(copy);
  if (binding) factories.set(copy, binding);
  return copy;
}
export function retainResource(resource: ResourceId): ResourceHold | null {
  return factories.get(resource)?.retain() ?? null;
}
/** @internal A live recording can move its existing holds. An already consumed
 * resource command must reacquire ownership through ordinary capture. */
export function canTransferCommandResources(command: PaintCommand): boolean {
  return (
    commandHolds.has(command) ||
    (!('resource' in command && factories.has(command.resource)) &&
      !(
        'paint' in command &&
        command.paint.shader?.kind === 'image' &&
        factories.has(command.paint.shader.image)
      ))
  );
}
function disposeAll(holds: readonly ResourceHold[]): void {
  let errors: unknown[] | undefined;
  for (let index = 0; index < holds.length; index++)
    try {
      holds[index]!.dispose();
    } catch (error) {
      (errors ??= []).push(error);
    }
  if (errors?.length === 1) throw errors[0];
  if (errors) throw new AggregateError(errors, 'Recorded resource retirement failed');
}
export function retainCommandResources(command: PaintCommand): void {
  if (!('resource' in command) && !('paint' in command && command.paint.shader?.kind === 'image'))
    return;
  const holds: ResourceHold[] = [];
  try {
    if ('resource' in command) {
      const hold = retainResource(command.resource);
      if (hold) holds.push(hold);
    }
    if ('paint' in command && command.paint.shader?.kind === 'image') {
      const hold = retainResource(command.paint.shader.image);
      if (hold) holds.push(hold);
    }
    if (holds.length) commandHolds.set(command, holds);
  } catch (error) {
    try {
      disposeAll(holds);
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'Resource capture and rollback failed');
    }
    throw error;
  }
}
export function releaseCommandResources(commands: readonly PaintCommand[]): void {
  let holds: ResourceHold[] | undefined;
  for (let index = 0; index < commands.length; index++) {
    const command = commands[index]!,
      owned = commandHolds.get(command);
    if (owned) {
      // Deleting the sidecar already deduplicates repeated command identities.
      // Detach every hold before invoking retirement callbacks, including failures.
      commandHolds.delete(command);
      holds ??= [];
      for (let hold = 0; hold < owned.length; hold++) holds.push(owned[hold]!);
    }
  }
  if (holds) disposeAll(holds);
}
/** Transfer the newly captured command ownership to one frame admission. */
export function ownFrameResources(
  resources: readonly ResourceId[],
  commands: readonly PaintCommand[],
): void {
  let holds: ResourceHold[] | undefined;
  for (let index = 0; index < commands.length; index++) {
    const command = commands[index]!,
      owned = commandHolds.get(command);
    if (owned) {
      commandHolds.delete(command);
      holds ??= [];
      for (let hold = 0; hold < owned.length; hold++) holds.push(owned[hold]!);
    }
  }
  if (holds) frameHolds.set(resources, holds);
}
export function releaseFrameResources(resources: readonly ResourceId[]): void {
  const holds = frameHolds.get(resources);
  if (holds) {
    frameHolds.delete(resources);
    disposeAll(holds);
  }
}
