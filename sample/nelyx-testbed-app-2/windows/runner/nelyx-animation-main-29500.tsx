// SPDX-License-Identifier: BSD-3-Clause
import {registerApplication} from '@nelyx/sdk/platforms/windows/application';
import {defineConfig,defineAssetManifest} from '@nelyx/sdk/runtime/config';
import assetConfig from './app-config.json' with {type:'json'};
import application from '../../package.json' with {type:'json'};
import App from './App.tsx';

const manifest=defineAssetManifest(assetConfig.assets);
const config=defineConfig(application.nelyx),settings=config.targets.windows;
if(!settings)throw new Error('App does not configure windows');
const sources=Object.fromEntries(manifest.map(asset=>[asset.id,{uri:'nelyx-asset:/'+asset.path.slice(2)}]));
registerApplication(config.name,App,{profile:'rn-graphite-vulkan',cohort:'rn-0.83.10',assets:{manifest,sources}});
