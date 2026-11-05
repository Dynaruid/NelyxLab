// SPDX-License-Identifier: BSD-3-Clause
/** Preserve the first failure and every later cleanup failure, in execution order. */
export function engineFailures(message: string, errors: readonly unknown[]): unknown {
  if (errors.length === 1) return errors[0];
  return new AggregateError(errors, `${message}: ${errors.map(String).join('; ')}`, {
    cause: errors[0],
  });
}

/** Run every owner cleanup, even when an earlier owner fails. */
export async function drainEngineOwners(
  message: string,
  actions: readonly (() => void | Promise<void>)[],
): Promise<void> {
  const errors: unknown[] = [];
  for (const action of actions) {
    try {
      await action();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw engineFailures(message, errors);
}

/** One terminal Promise, including synchronous throws and reentrant close calls. */
export function engineDisposer(action: () => void | Promise<void>): () => Promise<void> {
  let closing: Promise<void> | undefined;
  return () => (closing ??= Promise.resolve().then(action));
}
