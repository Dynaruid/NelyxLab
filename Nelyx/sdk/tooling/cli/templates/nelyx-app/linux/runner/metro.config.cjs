// SPDX-License-Identifier: BSD-3-Clause
const path=require('node:path');const {createRunnerConfig}=require('@nelyx/metro/runner-config');
const config=createRunnerConfig({target:'linux',runnerRoot:__dirname,appRoot:path.resolve(__dirname,'../..')});
config.transformer.assetPlugins=[...(config.transformer.assetPlugins??[]),path.join(__dirname,'asset-paths.cjs')];
module.exports=config;
