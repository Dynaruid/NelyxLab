// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';

/** prepare may recreate a deleted cache; existing or explicit inputs stay strict. */
export function readStaticHermesLocator(file, { allowMissing = false } = {}) {
  let locator;
  try {
    locator = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (allowMissing && error.code === 'ENOENT') return null;
    throw error;
  }
  if (
    locator?.schema !== 'nelyx.windows-static-hermes-locator/v1' ||
    typeof locator.directory !== 'string' ||
    !path.isAbsolute(locator.directory) ||
    typeof locator.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(locator.sha256)
  )
    throw Error('Prepared Static Hermes supplier locator changed');
  try {
    if (!fs.statSync(locator.directory).isDirectory())
      throw Error('Prepared Static Hermes supplier is not a directory');
  } catch (error) {
    if (allowMissing && error.code === 'ENOENT') return null;
    throw error;
  }
  return locator;
}
