// SPDX-License-Identifier: BSD-3-Clause
import { windowsHermesPolicy } from './windows-hermes-policy.mjs';

/** Match typed C to its supplier, including any stock RNW optimization exclusions. */
export function windowsTypedHermesPolicy(cohort, dialect = 'typescript') {
  if (!['typescript', 'flow'].includes(dialect))
    throw new TypeError('Choose a qualified typed input dialect');
  const base = windowsHermesPolicy('optimized', cohort);
  const pipeline = base.flags.find((flag) => flag.startsWith('-Xcustom-opt='));
  // shermes.cpp's custom branch bypasses runNativeBackendOptimizationPasses;
  // Pipeline.cpp currently installs StripDebugInsts there, before optimization.
  return Object.freeze({
    id: pipeline
      ? 'windows-hermes-94aa5e1d-typed-no-cfg-v1'
      : 'windows-hermes-260318099.0.7-typed-v1',
    dialect,
    flags: Object.freeze([
      '-typed',
      dialect === 'typescript' ? '-parse-ts' : '-parse-flow',
      ...base.flags.map((flag) => (flag === pipeline ? flag.replace('=', '=stripdebug,') : flag)),
    ]),
  });
}
