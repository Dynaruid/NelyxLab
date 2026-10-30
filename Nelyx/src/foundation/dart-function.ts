// SPDX-License-Identifier: BSD-3-Clause
const originals = new WeakMap<Function, Function>();
const bridges = new WeakMap<Function, Map<string, Function>>();

/** Internal representation adapters preserve the source callable identity. */
export function sourceFunctionIdentity(value: Function): Function {
  return originals.get(value) ?? value;
}

/** The compiler supplies the exact physical source/target signature and a typed
 * conversion thunk. Capture the callable once; cache without invoking it. */
export function bridgeDartFunction<S extends Function, R extends Function>(
  source: S,
  signature: string,
  create: (source: S) => R,
): R {
  if (typeof source !== 'function' || !signature)
    throw new TypeError('Invalid source function representation');
  let cache = bridges.get(source);
  if (!cache) {
    cache = new Map();
    bridges.set(source, cache);
  }
  const previous = cache.get(signature);
  if (previous) return previous as R;
  const result = create(source);
  if (typeof result !== 'function' || Object.is(result, source) || originals.has(result))
    throw new TypeError('Function bridge must create a fresh callable');
  originals.set(result, sourceFunctionIdentity(source));
  cache.set(signature, result);
  return result;
}
