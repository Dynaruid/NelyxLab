// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import { sceneKeyFixture } from './scene-key-fixture.mjs';

const watchdog = setTimeout(() => {
  throw Error('Scene key checks exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    stdin: { contents: sceneKeyFixture(), loader: 'ts' },
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
  console.log(
    'Scene keys: exact uint32 boundaries, high generations, signed zero and getter/conversion/exception order PASS.',
  );
} finally {
  clearTimeout(watchdog);
}
