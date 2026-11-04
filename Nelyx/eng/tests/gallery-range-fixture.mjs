// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
export async function withGalleryRangeFixture(
  runner,
  work,
  {
    diagnostic = false,
    nativeServices = false,
    manualMode,
    backingAudit = false,
    scrollModules = false,
  } = {},
) {
  runner = fs.realpathSync(runner);
  const file = path.join(runner, 'App.tsx'),
    original = fs.readFileSync(file);
  const bootstrap = 'main(undefined, { accessibilityEnabled })';
  if (
    original.toString().split(bootstrap).length !== 2 ||
    original.toString().split('onReady={() => {}}').length !== 2 ||
    (scrollModules && !original.toString().includes('export default function App() {'))
  )
    throw Error('Gallery range requires the original runner bootstrap');
  const directory = fs.mkdtempSync(path.join(runner, '.rnw-gallery-range-'));
  nativeServices ||= !!manualMode || scrollModules;
  backingAudit ||= manualMode === 'backing' || manualMode === 'all';
  let source =
    (nativeServices
      ? `import { installNativeServiceExperiment } from './${path.basename(directory)}/rnw-native-experiment.js';\n`
      : '') +
    `import { GalleryRangeObservation } from '../../src/gallery-range.ts';\n` +
    `import { installGalleryRange } from './${path.basename(directory)}/rnw-gallery-range.js';\n` +
    `const galleryRange = new GalleryRangeObservation();\n` +
    original
      .toString()
      .replace(
        'export default function App() {',
        'export default function App() {' +
          (scrollModules
            ? `\n  const nativeModuleMode = (globalThis as { NelyxWindowsHost: { nativeModuleMode: import('../../src/native-module-mode.ts').NativeModuleMode } }).NelyxWindowsHost.nativeModuleMode;\n`
            : ''),
      )
      .replace(
        bootstrap,
        `main(undefined, { accessibilityEnabled, galleryRange${scrollModules ? ', nativeModuleMode' : manualMode ? ', nativeModuleMode: ' + JSON.stringify(manualMode) : ''} })`,
      )
      .replace(
        'onReady={() => {}}',
        `onReady={(application) => { ${nativeServices ? `installNativeServiceExperiment(application${manualMode ? ', { manual: true, expectedMode: ' + JSON.stringify(manualMode) + ' }' : ''}); ` : ''}installGalleryRange(application, galleryRange, { diagnostic: ${JSON.stringify(diagnostic)}, manual: ${!!manualMode}, backingAudit: ${backingAudit} }); }}`,
      );
  if (['all', 'retained'].includes(manualMode))
    source = source.replace(
      '        windowViewport',
      '        nativeInputGeometry="retained"\n        windowViewport',
    );
  if (['all', 'scroll', 'scroll-frame'].includes(manualMode))
    source = source.replace(
      '        windowViewport',
      '        nativeScrollFrame\n        windowViewport',
    );
  if (['all', 'scroll', 'scroll-input'].includes(manualMode))
    source = source.replace(
      '        windowViewport',
      '        nativeScrollInput\n        windowViewport',
    );
  if (scrollModules)
    source = source.replace(
      '        windowViewport',
      '        nativeScrollFrame={["scroll", "scroll-frame"].includes(nativeModuleMode)}\n        nativeScrollInput={["scroll", "scroll-input"].includes(nativeModuleMode)}\n        windowViewport',
    );
  const patched = Buffer.from(source);
  try {
    fs.copyFileSync(
      path.join(import.meta.dirname, 'rnw-gallery-range.js'),
      path.join(directory, 'rnw-gallery-range.js'),
    );
    if (nativeServices)
      fs.copyFileSync(
        path.join(import.meta.dirname, 'rnw-native-experiment.js'),
        path.join(directory, 'rnw-native-experiment.js'),
      );
    fs.writeFileSync(file, patched);
    return await work();
  } finally {
    /* oxlint-disable no-unsafe-finally -- Refuse rollback if the user edited App or directory ownership changed. */
    const current = fs.readFileSync(file);
    if (!current.equals(original) && !current.equals(patched))
      throw Error('Gallery range App changed; refusing rollback');
    fs.writeFileSync(file, original);
    if (
      path.dirname(fs.realpathSync(directory)) !== runner ||
      fs.lstatSync(directory).isSymbolicLink()
    )
      throw Error('Gallery range fixture ownership changed');
    fs.rmSync(directory, { recursive: true, force: true });
    /* oxlint-enable no-unsafe-finally */
  }
}
