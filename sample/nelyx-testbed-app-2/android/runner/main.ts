// SPDX-License-Identifier: BSD-3-Clause
import { registerApplication } from '@nelyx/sdk/platforms/android/application';
import { defineConfig, defineAssetManifest } from '@nelyx/sdk/runtime/config';
import assetConfig from './app-config.json' with { type: 'json' };
import application from '../../package.json' with { type: 'json' };
import App from './App.tsx';

const manifest = defineAssetManifest(assetConfig.assets);
const config = defineConfig(application.nelyx),
  settings = config.targets.android;
if (!settings) throw new Error('App does not configure android');
// Metro requires literal asset imports. Add imports here when adding bundled assets.
const sources = {
  ...Object.fromEntries(
    manifest
      .filter((asset) => asset.kind === 'font')
      .map((asset) => [asset.id, { uri: 'asset:/nelyx/fonts/' + asset.sha256 + '.ttf' }]),
  ),
  'component-image': require('../../assets/component-image.webp'),
};
if (!settings.profile) throw new Error('Android requires an explicit profile');
registerApplication(config.name, App, {
  profile: settings.profile,
  cohort: settings.cohort,
  assets: { manifest, sources },
});
