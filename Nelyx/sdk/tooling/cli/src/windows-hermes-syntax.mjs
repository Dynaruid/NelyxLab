// SPDX-License-Identifier: BSD-3-Clause
import { windowsHermesPolicy, windowsHermesSyntax } from './windows-hermes-policy.mjs';
import { windowsNativeHermesPin } from './windows-native-hermes-pin.mjs';
const legacySyntax = Object.freeze({
  id: 'windows-hermes-94aa5e1d-syntax-v1',
  supported: windowsHermesSyntax,
});
const nativeSyntax = Object.freeze({
  id: 'windows-hermes-260318099.0.7-native-fields-v1',
  supported: Object.freeze({
    ...windowsHermesSyntax,
    'class-field': true,
    'class-static-field': true,
    'class-private-field': true,
    'class-private-brand-check': true,
  }),
});
/** App bundling syntax is independent of compiler/VM producer identity. Only
 * the qualified direct VM preserves public fields and instance private fields.
 * Private methods/accessors and static private members keep their lowering: the pinned
 * compiler rejects some legal private method/accessor uses before execution.
 * Stock RNW keeps its existing syntax policy. */
export function windowsHermesSyntaxPolicy(cohort) {
  windowsHermesPolicy('optimized', cohort);
  return cohort.engineRevision === windowsNativeHermesPin.revision ? nativeSyntax : legacySyntax;
}
