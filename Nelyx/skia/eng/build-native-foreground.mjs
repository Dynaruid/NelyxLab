// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
import {
  cleanSkiaOverrides,
  foregroundBuildEnv,
  foregroundCrate,
  foregroundSupply,
} from '../../sdk/tooling/cli/src/native-skia-supply.mjs';
import { withSignals } from '../../sdk/tooling/cli/src/publication.mjs';

const [mode = 'test', target = 'x86_64-pc-windows-msvc'] = process.argv.slice(2);
const selected = foregroundSupply.targets[target];
if (!['test', 'build'].includes(mode) || !selected)
  throw new Error('Usage: build-native-foreground.mjs [test|build] [supported Rust target]');

await withSignals(async (signal) => {
  const cache = path.resolve(import.meta.dirname, '../../../.cache/w9-skia');
  const env = { ...process.env, CARGO_TARGET_DIR: cache };
  cleanSkiaOverrides(env);
  Object.assign(env, await foregroundBuildEnv(path.join(cache, 'supply'), target, signal));
  await execute(
    'cargo',
    [
      mode,
      '--locked',
      '--target',
      target,
      '--manifest-path',
      path.join(foregroundCrate, 'Cargo.toml'),
      ...(mode === 'build' ? ['--release', '--lib'] : []),
    ],
    { env, signal },
  );
  console.log(
    JSON.stringify({ target, skia: foregroundSupply.skiaRevision, binarySha256: selected.sha256 }),
  );
});
