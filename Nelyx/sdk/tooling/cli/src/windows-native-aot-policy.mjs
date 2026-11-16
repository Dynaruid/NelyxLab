// SPDX-License-Identifier: BSD-3-Clause
import { windowsHermesPolicy } from './windows-hermes-policy.mjs';

/** Typed emitters preserve their named kernels with a noinline directive.
 * Other application helpers use the qualified supplier's normal optimizer.
 * The native correspondence audit still rejects every unclassified body. */
export function windowsNativeAotPolicy(cohort) {
  const base = windowsHermesPolicy('optimized', cohort);
  if (base.flags.includes('-fno-inline')) return base;
  return Object.freeze({
    id: 'windows-hermes-260318099.0.7-native-aot-kernel-boundary-v2',
    profile: base.profile,
    flags: base.flags,
  });
}
