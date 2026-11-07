// SPDX-License-Identifier: BSD-3-Clause
// Configuration metadata only. RawRadio remains the owner of selection policy.
const configurations = new WeakMap<object, () => boolean>();
const actions = new WeakMap<() => void, () => void>();

/** @internal Preserve the source capability through ControlInteraction's semantics wrapper. */
export function markToggleableRadioSemantics(value: object, canDeselect: () => boolean): void {
  configurations.set(value, canDeselect);
}
/** @internal Bind the original semantic action to its source policy and lifetime. */
export function inheritToggleableRadioSemantics(
  source: object | null | undefined,
  action: (() => void) | null,
): void {
  const canDeselect = source && configurations.get(source);
  if (canDeselect && action)
    actions.set(action, () => {
      if (canDeselect()) action();
    });
}
/** @internal A selected, enabled source Radio may advertise deselection. */
export function nativeRadioDeselect(action: (() => void) | null): (() => void) | null {
  return action === null ? null : (actions.get(action) ?? null);
}
