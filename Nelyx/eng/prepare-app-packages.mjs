// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** Repository App builds need package declarations; engine supply builds do not. */
export function prepareRepositoryAppPackages() {
  for (const target of ['core', 'cupertino', 'material', 'sdk']) {
    const result = spawnSync(
      process.execPath,
      [path.join(import.meta.dirname, 'build-packages.mjs'), target],
      {
        stdio: 'inherit',
        windowsHide: true,
        timeout: 1_200_000,
      },
    );
    if (result.error || result.status !== 0)
      throw Error('App package build failed: ' + target + ': ' + (result.error ?? result.status));
  }
}
