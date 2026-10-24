// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';import {readApplication} from './application.mjs';
/** Prepare app-owned mobile/browser metadata without initializing a renderer. */
export async function configureRunner({app,target}){
  if(!['android','web'].includes(target))throw new Error('Use the explicit native adapter for this target');
  const value=await readApplication(app,target);if(value.profile.status!=='implemented')throw new Error('Implemented target profile required');
  if(target==='android'){const installed=value.load('@nelyx/metro/runner-config').inspectRunnerCohort({target,runnerRoot:value.runner,appRoot:value.app});if(installed.reactNative!==value.cohort.reactNative||installed.react!==value.cohort.react)throw new Error('Android configured cohort differs from its installation');}else{const installed=value.load('@nelyx/metro/web-config').inspectWebRunnerCohort({runnerRoot:value.runner});if(installed.react!==value.cohort.react||installed.reactNativeWeb!==value.cohort.frameworkVersion)throw new Error('Web configured cohort differs from its installation');}
  value.load('@nelyx/metro/assets').verifyAppAssets(value.app,value.config.assets);
  const config={name:value.config.name,target,assets:value.config.assets,profile:value.profile.id,cohort:value.cohort};
  fs.writeFileSync(path.join(value.runner,'app-config.json'),JSON.stringify(config,null,2)+'\n');return {app:value.app,runner:value.runner,config,qualification:value.profile.qualification};
}
