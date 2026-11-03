// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
export async function withNativeServiceExperimentFixture(runner, work, { manualMode } = {}) {
  runner = fs.realpathSync(runner);
  const file = path.join(runner, 'App.tsx'),
    original = fs.readFileSync(file),
    marker = 'onReady={() => {}}';
  if (original.toString().split(marker).length !== 2)
    throw Error('Experiment requires original App onReady');
  if (manualMode) {
    const text = original.toString().replaceAll('\r\n', '\n');
    if (text.split('main(undefined, { accessibilityEnabled })').length !== 2)
      throw Error('Manual mode requires the original App bootstrap');
  }
  const directory = fs.mkdtempSync(path.join(runner, '.rnw-native-experiment-'));
  let source =
    `import { installNativeServiceExperiment } from './${path.basename(directory)}/rnw-native-experiment.js';\n` +
    original
      .toString()
      .replace(
        marker,
        manualMode
          ? `onReady={(application) => installNativeServiceExperiment(application, { manual: true, expectedMode: ${JSON.stringify(manualMode)} })}`
          : 'onReady={installNativeServiceExperiment}',
      );
  if (manualMode) {
    source = source.replaceAll('\r\n', '\n');
    source = source.replace(
      'main(undefined, { accessibilityEnabled })',
      `main(undefined, { accessibilityEnabled, nativeModuleMode: ${JSON.stringify(manualMode)} })`,
    );
    if (['all', 'retained'].includes(manualMode))
      source = source.replace(
        '        windowViewport',
        '        nativeInputGeometry="retained"\n        windowViewport',
      );
  }
  const patched = Buffer.from(source);
  try {
    fs.copyFileSync(
      path.join(import.meta.dirname, 'rnw-native-experiment.js'),
      path.join(directory, 'rnw-native-experiment.js'),
    );
    fs.writeFileSync(file, patched);
    return await work();
  } finally {
    /* oxlint-disable no-unsafe-finally -- Refuse cleanup if user edits or directory ownership changed. */
    const current = fs.readFileSync(file);
    if (!current.equals(original) && !current.equals(patched))
      throw Error('App changed; refusing experiment rollback');
    fs.writeFileSync(file, original);
    if (
      path.dirname(fs.realpathSync(directory)) !== runner ||
      fs.lstatSync(directory).isSymbolicLink()
    )
      throw Error('Experiment fixture ownership changed');
    fs.rmSync(directory, { recursive: true, force: true });
    /* oxlint-enable no-unsafe-finally */
  }
}
