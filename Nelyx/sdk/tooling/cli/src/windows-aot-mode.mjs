// SPDX-License-Identifier: BSD-3-Clause
/** Canonical product modes. Retired names are rejected for commands and packages. */
export function windowsHermesExecutionMode(mode = 'bytecode') {
  if (!['bytecode', 'static-aot'].includes(mode)) throw Error('Choose Windows --hermes-mode bytecode or static-aot');
  return mode;
}
