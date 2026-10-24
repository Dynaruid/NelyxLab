// SPDX-License-Identifier: BSD-3-Clause
// One cache is shared by generated modules through the single Core package identity.
// Weak receiver and method keys never root retired widgets/render objects.
const boundMethods = new WeakMap<object, WeakMap<object, unknown>>();

/** Bind a selected non-generic Dart method, retaining receiver/method equality. */
export function dartMethodTearOff<T extends object, A extends unknown[], R>(
  receiver: T,
  method: (this: T, ...args: A) => R,
): (...args: A) => R {
  let methods = boundMethods.get(receiver);
  if (!methods) {
    methods = new WeakMap<object, unknown>();
    boundMethods.set(receiver, methods);
  }
  let bound = methods.get(method) as ((...args: A) => R) | undefined;
  if (!bound) {
    bound = method.bind(receiver);
    methods.set(method, bound);
  }
  return bound;
}
