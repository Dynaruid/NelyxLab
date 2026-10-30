// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {defineConfig,defineAssetManifest} from '@nelyx/sdk/runtime/config';
import {createProviderRegistry} from '@nelyx/sdk/runtime/providers';
/** Read the root package configuration using this target's installed packages. */
export async function readApplication(app,target='windows'){
  app=fs.realpathSync(app);const runner=path.join(app,target,'runner');
  if(!fs.existsSync(path.join(runner,'package.json')))throw new Error('Independent target runner package.json absent: '+target);
  const load=createRequire(path.join(runner,'package.json'));
  const declared=defineConfig(JSON.parse(fs.readFileSync(path.join(app,'package.json'),'utf8')).nelyx);
  if(!declared.targets[target])throw new Error('App does not configure target: '+target);
  const prepared=load('@nelyx/metro/assets').prepareAppAssetConfiguration(app,runner);
  const config=Object.freeze({...declared,assets:defineAssetManifest(prepared.assets)});
  const registry=createProviderRegistry(),settings=config.targets[target],profile=registry.profile(target,settings.profile),cohort=registry.cohort(target,{...((settings.cohort) && ({cohort:settings.cohort}))},profile.id);
  return {app,runner,load,config,profile,cohort};
}
export function configureWindowsApplication(application){
  const {runner,config,cohort,profile}=application;
  const accessibility=process.env.NELYX_ACCESSIBILITY_ENABLED;
  if(accessibility!==undefined&&!['true','false'].includes(accessibility))throw Error('NELYX_ACCESSIBILITY_ENABLED must be true or false');
  fs.writeFileSync(path.join(runner,'app-config.json'),JSON.stringify({name:config.name,assets:config.assets,...(cohort?{cohort:cohort.id}:{}),...(profile?{profile:profile.id}:{}),...(accessibility!==undefined?{accessibilityEnabled:accessibility==='true'}:{})},null,2)+'\n');
}
