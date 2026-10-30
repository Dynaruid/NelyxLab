// SPDX-License-Identifier: BSD-3-Clause
import { windowsHermesPolicy } from './windows-hermes-policy.mjs';

/** Exact supplier only. Keep the known loop-phi/inline exclusions for typed C. */
export function windowsTypedHermesPolicy(cohort, dialect = 'typescript') {
  if (!['typescript', 'flow'].includes(dialect))
    throw new TypeError('Choose a qualified typed input dialect');
  const base = windowsHermesPolicy('optimized', cohort);
  const pipeline = base.flags.find((flag) => flag.startsWith('-Xcustom-opt='));
  // shermes.cpp's custom branch bypasses runNativeBackendOptimizationPasses;
  // Pipeline.cpp currently installs StripDebugInsts there, before optimization.
  return Object.freeze({
    id: 'windows-hermes-94aa5e1d-typed-no-cfg-v1',
    dialect,
    flags: Object.freeze([
      '-typed',
      dialect === 'typescript' ? '-parse-ts' : '-parse-flow',
      ...base.flags.map((flag) => (flag === pipeline ? flag.replace('=', '=stripdebug,') : flag)),
    ]),
  });
}
