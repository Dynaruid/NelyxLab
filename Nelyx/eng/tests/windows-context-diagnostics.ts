// SPDX-License-Identifier: BSD-3-Clause
/** Read-only diagnostic facade. Preserve missing capabilities, dynamic native
 * properties and native/private-field method receivers, including at close. */
export function timedNativeContext(
  native: object,
  measure: <T>(label: string, perform: () => T) => T,
): object {
  const timed = new Set<PropertyKey>([
      'beginRecording',
      'finishRecording',
      'nelyxReserve',
      'nelyxReserveEpoch',
      'nelyxSubmit',
      'nelyxSubmitFrame',
      'nelyxNotifications',
      'nelyxCancel',
      'nelyxClose',
      'nelyxReset',
      'nelyxStats',
      'dispose',
    ]),
    methods = new Map<PropertyKey, { value: Function; bound: (...args: unknown[]) => unknown }>();
  const read = (key: PropertyKey): unknown => {
    const value = Reflect.get(native, key, native);
    if (typeof value !== 'function' || key === 'constructor') return value;
    const previous = methods.get(key);
    if (previous && previous.value === value) return previous.bound;
    const bound = timed.has(key)
      ? (...args: unknown[]) =>
          measure('NativeJS.' + String(key), () => Reflect.apply(value, native, args))
      : (...args: unknown[]) => Reflect.apply(value, native, args);
    methods.set(key, { value, bound });
    return bound;
  };
  return new Proxy(Object.create(null), {
    get: (_target, key) => read(key),
    has: (_target, key) => Reflect.has(native, key),
    ownKeys: () => Reflect.ownKeys(native),
    getPrototypeOf: () => Reflect.getPrototypeOf(native),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(native, key);
      return descriptor
        ? {
            value: read(key),
            enumerable: descriptor.enumerable ?? false,
            configurable: true,
            writable: false,
          }
        : undefined;
    },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
    preventExtensions: () => false,
  });
}
