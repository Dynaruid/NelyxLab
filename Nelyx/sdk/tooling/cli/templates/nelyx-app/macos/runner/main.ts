// SPDX-License-Identifier: BSD-3-Clause
import {registerApplication} from '@nelyx/sdk/platforms/macos/application';
import {defineConfig,defineAssetManifest} from '@nelyx/sdk/runtime/config';
import assetConfig from './app-config.json' with {type:'json'};
import application from '../../package.json' with {type:'json'};
import App from './App.tsx';

const manifest=defineAssetManifest(assetConfig.assets);
const config=defineConfig(application.nelyx),settings=config.targets.macos;
if(!settings)throw new Error('App does not configure macos');
// Metro requires literal asset imports. Add imports here when adding bundled assets.
const sources={
  "sample-font":require("../../assets/NotoSansKR.ttf"),
  "sample-emoji":require("../../assets/NotoColorEmoji.ttf"),
  "sample-arabic":require("../../assets/NotoNaskhArabic-Regular.ttf"),
  "sample-variable":require("../../assets/RobotoSlab-VariableFont_wght.ttf"),
  "sample-hebrew":require("../../assets/NotoSansHebrew.ttf"),
  "sample-image":require("../../assets/probe.png"),
  "sample-animation":require("../../assets/pulse.gif"),
};
registerApplication(config.name,App,{profile:settings.profile,cohort:settings.cohort,assets:{manifest,sources}});
