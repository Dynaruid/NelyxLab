// SPDX-License-Identifier: BSD-3-Clause
import type { SourceScrollableDetails } from './scrollable-details.generated.ts';
type Owner = typeof SourceScrollableDetails;
const constants = new WeakMap<
  Owner,
  { vertical?: SourceScrollableDetails; horizontal?: SourceScrollableDetails }
>();
/** The selected ScrollView uses exactly the two argument-free const defaults.
 * Keep this boundary narrower than general ScrollableDetails construction. */
function constant(
  owner: Owner,
  axis: 'vertical' | 'horizontal',
  options: Record<string, never> = {},
): SourceScrollableDetails {
  if (Object.keys(options).length !== 0)
    throw new TypeError('Only argument-free ScrollableDetails constants are admitted');
  let values = constants.get(owner);
  if (!values) {
    values = {};
    constants.set(owner, values);
  }
  return values[axis] ?? (values[axis] = owner[axis]());
}
export function constantVerticalDetails(
  owner: Owner,
  options: Record<string, never> = {},
): SourceScrollableDetails {
  return constant(owner, 'vertical', options);
}
export function constantHorizontalDetails(
  owner: Owner,
  options: Record<string, never> = {},
): SourceScrollableDetails {
  return constant(owner, 'horizontal', options);
}
