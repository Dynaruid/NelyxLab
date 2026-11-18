// SPDX-License-Identifier: BSD-3-Clause
/** Admission is checked both before creation and before skipping the first update.
 * Never call a user getter while checking an extension point. Construction identity
 * also excludes proxies and allows writable JS fields to change in the mount gap. */
export class InitialRenderConfiguration {
  private readonly constructed = new WeakMap<object, readonly unknown[]>();
  private readonly hooks;
  constructor(
    private readonly prototype: object,
    names: readonly string[],
    private readonly fields: readonly string[],
  ) {
    this.hooks = names.map((name) => {
      let owner = prototype;
      while (!Object.hasOwn(owner, name)) owner = Object.getPrototypeOf(owner);
      const { value, get } = Object.getOwnPropertyDescriptor(owner, name)!;
      return { name, owner, value, get };
    });
  }
  register(widget: object, ...values: unknown[]): void {
    this.constructed.set(widget, values);
  }
  matches(widget: object): boolean {
    const values = this.constructed.get(widget);
    if (!values || Object.getPrototypeOf(widget) !== this.prototype) return false;
    for (const { name, owner, value, get } of this.hooks) {
      let receiver: object | null = widget;
      while (receiver !== owner) {
        if (!receiver || Object.hasOwn(receiver, name)) return false;
        receiver = Object.getPrototypeOf(receiver);
      }
      const current = Object.getOwnPropertyDescriptor(owner, name);
      if (!current || current.value !== value || current.get !== get) return false;
    }
    return this.fields.every((name, i) => {
      const descriptor = Object.getOwnPropertyDescriptor(widget, name);
      return descriptor !== undefined && 'value' in descriptor && descriptor.value === values[i];
    });
  }
}

/** Listener spreads options at creation but reads their fields directly on update. */
export function stablePointerOptions(options: object, fields: readonly string[]): boolean {
  if (!Object.isFrozen(options)) return false;
  return fields.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    return descriptor ? descriptor.enumerable && 'value' in descriptor : !(key in options);
  });
}
